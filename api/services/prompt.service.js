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
   * Add a computed `content` field that combines all 3 prompt parts.
   * This is used by frontends that display a single text area.
   */
  enrichWithContent(prompt) {
    if (!prompt) return prompt;
    const p = { ...prompt };
    p.content = [
      `=== SYSTEM INSTRUCTION ===`,
      p.system_instruction,
      ``,
      `=== EVALUATION INSTRUCTIONS ===`,
      p.evaluation_instructions,
      ``,
      `=== OUTPUT FORMAT ===`,
      p.output_format
    ].join('\n');
    return p;
  }

  /**
   * Parse a combined `content` string back into the 3 separate fields.
   */
  parseContent(content) {
    const parts = {};
    const sections = content.split(/^=== (SYSTEM INSTRUCTION|EVALUATION INSTRUCTIONS|OUTPUT FORMAT) ===$/m);

    // sections array: ['', 'SYSTEM INSTRUCTION', '...text...', 'EVALUATION INSTRUCTIONS', '...text...', 'OUTPUT FORMAT', '...text...']
    for (let i = 1; i < sections.length; i += 2) {
      const label = sections[i];
      const text = (sections[i + 1] || '').trim();
      if (label === 'SYSTEM INSTRUCTION') parts.system_instruction = text;
      if (label === 'EVALUATION INSTRUCTIONS') parts.evaluation_instructions = text;
      if (label === 'OUTPUT FORMAT') parts.output_format = text;
    }

    return parts;
  }

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
   * Get all prompts (with computed content field)
   */
  async getAll() {
    if (!db.isDbConfigured) {
      return Object.values(FALLBACK_PROMPTS).map(p => this.enrichWithContent(p));
    }

    const result = await db.query(
      'SELECT * FROM ai_prompts ORDER BY key ASC'
    );
    return result.rows.map(p => this.enrichWithContent(p));
  }

  /**
   * Get prompt by ID (with computed content field)
   */
  async getById(id) {
    if (!db.isDbConfigured) throw new Error('Database not configured');

    const result = await db.query(
      'SELECT * FROM ai_prompts WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.enrichWithContent(result.rows[0]) : null;
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
   * Update a prompt by ID.
   * Accepts either individual fields OR a combined `content` string.
   */
  async update(id, data) {
    if (!db.isDbConfigured) throw new Error('Database not configured');

    // If frontend sent a single `content` field, parse it into the 3 DB fields
    if (data.content && !data.system_instruction && !data.evaluation_instructions && !data.output_format) {
      const parsed = this.parseContent(data.content);
      if (parsed.system_instruction) data.system_instruction = parsed.system_instruction;
      if (parsed.evaluation_instructions) data.evaluation_instructions = parsed.evaluation_instructions;
      if (parsed.output_format) data.output_format = parsed.output_format;
    }

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
