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

    -- Prompt template parts
    system_instruction TEXT NOT NULL,
    evaluation_instructions TEXT NOT NULL,
    output_format TEXT NOT NULL,

    -- State
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_prompts_key ON ai_prompts(key);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_is_active ON ai_prompts(is_active);

-- Comments
COMMENT ON TABLE ai_prompts IS 'AI prompt templates for Gemini analysis services';
COMMENT ON COLUMN ai_prompts.key IS 'Unique key to look up the prompt (e.g. audit_analyze, chat_evaluate)';
COMMENT ON COLUMN ai_prompts.system_instruction IS 'The system/role instruction (persona and task description)';
COMMENT ON COLUMN ai_prompts.evaluation_instructions IS 'Step-by-step evaluation instructions';
COMMENT ON COLUMN ai_prompts.output_format IS 'Expected JSON output format template';

-- =============================================================================
-- Seed: audit_analyze prompt (from audit.service.js)
-- =============================================================================
INSERT INTO ai_prompts (key, name, description, system_instruction, evaluation_instructions, output_format)
VALUES (
    'audit_analyze',
    'Audit Analysis',
    'Used by POST /api/audit/analyze — analyzes evidence files against applied control requirements',
    'You are an expert compliance auditor. Your task is to thoroughly analyze the submitted evidence files and evaluate them against the specified control and requirements.',
    '1. READ all evidence files
2. COMPARE against requirements
3. ANSWER audit questions
4. CHECK typical evidence items
5. IDENTIFY gaps
6. Respond ENTIRELY in English',
    '{
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
-- Seed: chat_evaluate prompt (from gemini-chat.service.js)
-- =============================================================================
INSERT INTO ai_prompts (key, name, description, system_instruction, evaluation_instructions, output_format)
VALUES (
    'chat_evaluate',
    'Chat Evaluation',
    'Used by POST /api/chat — general-purpose AI compliance evaluation with context and files',
    'You are an expert compliance and audit evaluator. Analyze the provided context and ALL evidence files thoroughly, then provide a comprehensive evaluation.',
    '1. Completeness and quality of evidence
2. Alignment with requirements/standards
3. Gaps, weaknesses, or areas of concern
4. Specific, actionable recommendations',
    '{
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
}'
) ON CONFLICT (key) DO NOTHING;
