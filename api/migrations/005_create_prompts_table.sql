-- =============================================================================
-- Migration 005: Create ai_prompts table
-- Stores AI prompt templates that can be managed via API
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ai_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Identification
    key VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Full prompt template (use {{CONTEXT}} placeholder for dynamic data)
    content TEXT NOT NULL,

    -- State
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1
);

-- =============================================================================
-- Schema migration: convert old 3-column layout → single content column
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards)
-- =============================================================================

-- Step 1: Add content column if it doesn't exist yet
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_prompts' AND column_name = 'content'
    ) THEN
        ALTER TABLE ai_prompts ADD COLUMN content TEXT;
    END IF;
END $$;

-- Step 2: Migrate existing data from old columns into content (only if old columns exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_prompts' AND column_name = 'system_instruction'
    ) THEN
        UPDATE ai_prompts
        SET content = system_instruction
            || E'\n\n{{CONTEXT}}\n\n'
            || evaluation_instructions
            || E'\n\n'
            || output_format
        WHERE content IS NULL;
    END IF;
END $$;

-- Step 3: Make content NOT NULL (set a default for any remaining nulls first)
UPDATE ai_prompts SET content = '' WHERE content IS NULL;
ALTER TABLE ai_prompts ALTER COLUMN content SET NOT NULL;

-- Step 4: Drop old columns if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_prompts' AND column_name = 'system_instruction') THEN
        ALTER TABLE ai_prompts DROP COLUMN system_instruction;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_prompts' AND column_name = 'evaluation_instructions') THEN
        ALTER TABLE ai_prompts DROP COLUMN evaluation_instructions;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_prompts' AND column_name = 'output_format') THEN
        ALTER TABLE ai_prompts DROP COLUMN output_format;
    END IF;
END $$;

-- Step 5: Delete old seed rows so they get re-inserted with proper content below
DELETE FROM ai_prompts WHERE key IN ('audit_analyze', 'chat_evaluate', 'entity_extraction');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_prompts_key ON ai_prompts(key);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_is_active ON ai_prompts(is_active);

-- Comments
COMMENT ON TABLE ai_prompts IS 'AI prompt templates for Gemini analysis services';
COMMENT ON COLUMN ai_prompts.key IS 'Unique key to look up the prompt (e.g. audit_analyze, chat_evaluate)';
COMMENT ON COLUMN ai_prompts.content IS 'Full prompt template text. Use {{CONTEXT}} as placeholder for dynamic data injection.';

-- =============================================================================
-- Seed: audit_analyze prompt
-- =============================================================================
INSERT INTO ai_prompts (key, name, description, content)
VALUES (
    'audit_analyze',
    'Audit Analysis',
    'Analyzes evidence files against applied control requirements',
    'You are an expert compliance auditor. Your task is to thoroughly analyze the submitted evidence files and evaluate them against the specified control and requirements.

{{CONTEXT}}

**=== EVALUATION INSTRUCTIONS ===**
1. READ all evidence files
2. COMPARE against requirements
3. ANSWER audit questions
4. CHECK typical evidence items
5. IDENTIFY gaps
6. Respond ENTIRELY in English

**=== OUTPUT FORMAT (JSON only) ===**

{
  "overallAssessment": {
    "name": "{{REQ_NAME}}",
    "description": "{{REQ_DESC}}",
    "status": "...",
    "summary": "..."
  },
  "questionEvaluation": [{ "question": "...", "answered": "...", "evidenceFound": "...", "notes": "..." }],
  "typicalEvidenceCheck": [{ "evidenceItem": "...", "status": "...", "details": "..." }],
  "gaps": [{ "gap": "...", "recommendation": "..." }]
}'
) ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Seed: chat_evaluate prompt
-- =============================================================================
INSERT INTO ai_prompts (key, name, description, content)
VALUES (
    'chat_evaluate',
    'Chat Evaluation',
    'General-purpose AI compliance evaluation with context and files',
    'You are an expert compliance and audit evaluator. Analyze the provided context and ALL evidence files thoroughly, then provide a comprehensive evaluation.

{{CONTEXT}}

**EVALUATION TASK:**
Based on the context and evidence provided (including any attached documents), conduct a thorough compliance evaluation. Consider:
1. Completeness and quality of evidence
2. Alignment with requirements/standards
3. Gaps, weaknesses, or areas of concern
4. Specific, actionable recommendations

**RESPONSE FORMAT:**
Return a JSON object with this structure:

{
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
}

**CRITICAL:** Return ONLY the JSON object. No markdown code blocks, no additional text.'
) ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Seed: entity_extraction prompt
-- =============================================================================
INSERT INTO ai_prompts (key, name, description, content)
VALUES (
    'entity_extraction',
    'Entity Extraction',
    'Extracts structured entities from compliance, governance, and regulatory documents',
    'You are an expert entity extraction system specializing in compliance, governance, risk, and regulatory documents.

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
- Group similar/duplicate entities together

{{CONTEXT}}

**IMPORTANT GUIDELINES:**
1. Extract ALL entities, not just a sample
2. Include confidence scores (0.0 to 1.0)
3. Identify relationships between entities when possible
4. Group similar entities and note duplicates
5. For compliance documents, pay special attention to: controls, requirements, policies, standards, regulations
6. Return ONLY valid JSON, no markdown code blocks
7. Respond ENTIRELY in English

**OUTPUT FORMAT:**
Return a JSON object with this exact structure:

{
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
}'
) ON CONFLICT (key) DO NOTHING;
