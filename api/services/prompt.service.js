/**
 * Prompt Service
 * CRUD operations for ai_prompts table with in-memory caching
 */

const db = require('../config/database');

// In-memory cache: key -> { prompt, fetchedAt }
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Hardcoded fallbacks (used when DB is unavailable)
const FALLBACK_PROMPTS = {
  audit_analyze: {
    key: 'audit_analyze',
    name: 'Audit Analysis',
    system_instruction: 'You are an expert compliance auditor. Your task is to thoroughly analyze the submitted evidence files and evaluate them against the specified control and requirements.',
    evaluation_instructions: `1. READ all evidence files
2. COMPARE against requirements
3. ANSWER audit questions
4. CHECK typical evidence items
5. IDENTIFY gaps
6. Respond ENTIRELY in English`,
    output_format: `{
  "overallAssessment": {
    "name": "{{REQ_NAME}}",
    "description": "{{REQ_DESC}}",
    "status": "...",
    "summary": "..."
  },
  "questionEvaluation": [{ "question": "...", "answered": "...", "evidenceFound": "...", "notes": "..." }],
  "typicalEvidenceCheck": [{ "evidenceItem": "...", "status": "...", "details": "..." }],
  "gaps": [{ "gap": "...", "recommendation": "..." }]
}`
  },
  entity_extraction: {
    key: 'entity_extraction',
    name: 'Entity Extraction',
    system_instruction: `You are an expert entity extraction system specializing in compliance, governance, risk, and regulatory documents.

**YOUR TASK:**
Extract ALL relevant entities from the provided documents. Focus on:
1. People and their roles/titles
2. Organizations, departments, and teams
3. Policies, procedures, and standards
4. Controls, requirements, and regulations
5. Dates, deadlines, and time periods
6. Locations and jurisdictions
7. Systems, applications, and technologies
8. Risks, threats, and vulnerabilities
9. Compliance frameworks (ISO, NIST, SOC, GDPR, etc.)
10. Legal references and contractual terms

**EXTRACTION GUIDELINES:**
- Extract EVERY entity found, not just a sample
- Include the exact text as it appears in the document
- Provide confidence scores based on clarity and context
- Identify relationships between entities when evident
- Note the source file for each entity
- Group similar/duplicate entities together`,
    evaluation_instructions: `1. Extract ALL entities, not just a sample
2. Include confidence scores (0.0 to 1.0)
3. Identify relationships between entities when possible
4. Group similar entities and note duplicates
5. For compliance documents, pay special attention to: controls, requirements, policies, standards, regulations
6. Return ONLY valid JSON, no markdown code blocks
7. Respond ENTIRELY in English`,
    output_format: `{
  "entities": [
    {
      "text": "The exact text of the entity",
      "type": "ENTITY_TYPE",
      "category": "primary category",
      "confidence": 0.95,
      "context": "Brief surrounding context where found",
      "source": "filename or text input",
      "metadata": {}
    }
  ],
  "summary": {
    "totalEntities": 0,
    "byType": { "PERSON": 0, "ORGANIZATION": 0 },
    "bySource": { "filename1.pdf": 0 }
  },
  "relationships": [
    {
      "entity1": "Entity text 1",
      "relation": "relationship type",
      "entity2": "Entity text 2",
      "confidence": 0.85
    }
  ],
  "keyFindings": ["Important finding 1", "Important finding 2"],
  "documentSummary": "Brief summary of what the documents contain"
}`
  },
  chat_evaluate: {
    key: 'chat_evaluate',
    name: 'Chat Evaluation',
    system_instruction: 'You are an expert compliance and audit evaluator. Analyze the provided context and ALL evidence files thoroughly, then provide a comprehensive evaluation.',
    evaluation_instructions: `1. Completeness and quality of evidence
2. Alignment with requirements/standards
3. Gaps, weaknesses, or areas of concern
4. Specific, actionable recommendations`,
    output_format: `{
  "status": "Fully Compliant | Partially Compliant | Non-Compliant | Not Applicable",
  "compliance_status": "Fully Compliant | Partially Compliant | Non-Compliant | Not Applicable",
  "effectiveness": "Highly Effective | Effective | Partially Effective | Ineffective | Not Applicable",
  "score": 0,
  "complianceLevel": "high | medium | low",
  "filesAnalyzed": [
    {"filename": "file1.pdf", "description": "Brief description of what this file contains", "relevance": "How relevant is this file to the audit requirement"}
  ],
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "evidenceQuality": "Excellent | Good | Adequate | Poor",
  "summary": "Brief 2-3 sentence overall assessment",
  "detailedAnalysis": "Comprehensive 3-5 paragraph analysis of findings, MUST mention specific content found in each file",
  "riskAssessment": "low | medium | high",
  "nextSteps": ["step 1", "step 2"],
  "note": "Any important notes or caveats"
}`
  }
};

class PromptService {

  /**
   * Get a prompt by its key.
   * Returns from cache if fresh, otherwise fetches from DB.
   * Falls back to hardcoded defaults if DB is unavailable.
   */
  async getByKey(key) {
    // Check cache first
    const cached = cache.get(key);
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
      return cached.prompt;
    }

    // Try DB
    try {
      if (!db.isDbConfigured) throw new Error('DB not configured');

      const result = await db.query(
        'SELECT * FROM ai_prompts WHERE key = $1 AND is_active = true',
        [key]
      );

      if (result.rows.length > 0) {
        const prompt = result.rows[0];
        cache.set(key, { prompt, fetchedAt: Date.now() });
        return prompt;
      }
    } catch (err) {
      console.warn(`⚠️ Could not fetch prompt "${key}" from DB: ${err.message}`);
    }

    // Fallback
    const fallback = FALLBACK_PROMPTS[key];
    if (fallback) {
      console.log(`📝 Using fallback prompt for "${key}"`);
      return fallback;
    }

    return null;
  }

  /**
   * Get all prompts
   */
  async getAll() {
    if (!db.isDbConfigured) {
      return Object.values(FALLBACK_PROMPTS);
    }

    const result = await db.query(
      'SELECT * FROM ai_prompts ORDER BY key ASC'
    );
    return result.rows;
  }

  /**
   * Get prompt by ID
   */
  async getById(id) {
    if (!db.isDbConfigured) throw new Error('Database not configured');

    const result = await db.query(
      'SELECT * FROM ai_prompts WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new prompt
   */
  async create(data) {
    if (!db.isDbConfigured) throw new Error('Database not configured');

    const { key, name, description, system_instruction, evaluation_instructions, output_format } = data;

    if (!key || !name || !system_instruction || !evaluation_instructions || !output_format) {
      throw new Error('Missing required fields: key, name, system_instruction, evaluation_instructions, output_format');
    }

    const result = await db.query(
      `INSERT INTO ai_prompts (key, name, description, system_instruction, evaluation_instructions, output_format)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [key, name, description || null, system_instruction, evaluation_instructions, output_format]
    );

    // Invalidate cache
    cache.delete(key);

    return result.rows[0];
  }

  /**
   * Update a prompt by ID
   */
  async update(id, data) {
    if (!db.isDbConfigured) throw new Error('Database not configured');

    const fields = [];
    const values = [];
    let paramIdx = 1;

    const allowedFields = [
      'name', 'description', 'system_instruction',
      'evaluation_instructions', 'output_format', 'is_active'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIdx}`);
        values.push(data[field]);
        paramIdx++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Auto-increment version and update timestamp
    fields.push(`version = version + 1`);
    fields.push(`updated_at = NOW()`);

    values.push(id);

    const result = await db.query(
      `UPDATE ai_prompts SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Invalidate cache for this key
    cache.delete(result.rows[0].key);

    return result.rows[0];
  }

  /**
   * Delete a prompt by ID
   */
  async delete(id) {
    if (!db.isDbConfigured) throw new Error('Database not configured');

    // Get key before deleting (for cache invalidation)
    const existing = await this.getById(id);

    const result = await db.query(
      'DELETE FROM ai_prompts WHERE id = $1 RETURNING *',
      [id]
    );

    if (existing) {
      cache.delete(existing.key);
    }

    return result.rowCount > 0;
  }

  /**
   * Clear the prompt cache (force reload from DB)
   */
  clearCache() {
    cache.clear();
    console.log('🔄 Prompt cache cleared');
  }
}

// Singleton
const promptService = new PromptService();

module.exports = promptService;
