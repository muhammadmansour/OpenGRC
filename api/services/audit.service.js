/**
 * Audit Service
 * Uses Gemini AI to analyze evidence files against audit questions and typical evidence requirements.
 * Supports Gemini File Search (referencing pre-uploaded files) and inline file uploads.
 */

const geminiChatService = require('./gemini-chat.service');
const promptService = require('./prompt.service');

// File manager for looking up Gemini Files API metadata (uri, mimeType)
let fileManager = null;
try {
  const { GoogleAIFileManager } = require('@google/generative-ai/server');
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    fileManager = new GoogleAIFileManager(apiKey);
    console.log('✅ GoogleAIFileManager initialized for file metadata lookup');
  }
} catch (err) {
  console.warn('⚠️ GoogleAIFileManager not available:', err.message);
}

class AuditService {
  
  /**
   * Get current model name from chat service
   */
  get currentModelName() {
    return geminiChatService.currentModelName;
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return geminiChatService.isAvailable();
  }

  /**
   * Analyze evidence against applied control requirements using Gemini AI.
   * 
   * Supports two modes:
   * 1. Gemini File Search: References pre-uploaded files via fileData parts
   * 2. Inline files: Sends base64/text files directly (legacy compatibility)
   * 
   * @param {Object} params
   * @param {string} params.assessment_type - "requirement" | "control" (default: auto-detect)
   * @param {Object} params.applied_control - The control being evaluated
   * @param {Object} params.gemini_file_search - Gemini file references (file_ids, store_id, evidences)
   * @param {Array}  params.requirements - Compliance requirements to check against
   * @param {Array}  params.questions - Audit questions to evaluate
   * @param {Array}  params.typical_evidence - Expected/typical evidence descriptions
   * @param {Object} params.analysis_config - Toggles for analysis sections
   * @param {Array}  params.files - Legacy: inline file uploads (base64/text)
   * @param {Object} params.options - Legacy: additional options
   */
  async analyze(params = {}) {
    if (!this.isAvailable()) {
      throw new Error('Audit service not initialized. Please set GEMINI_API_KEY');
    }

    const {
      assessment_type,
      applied_control = {},
      gemini_file_search = {},
      requirements = [],
      questions = [],
      typical_evidence = [],
      analysis_config = {},
      // Legacy support
      files = [],
      options = {}
    } = params;

    try {
      const evidences = gemini_file_search.evidences || [];
      const fileIds = gemini_file_search.file_ids || [];

      // Resolve assessment type: explicit > auto-detect
      const resolvedType = this.resolveAssessmentType(assessment_type, applied_control, requirements);

      console.log('📋 Starting audit analysis...');
      console.log(`🔖 Assessment type: ${resolvedType}`);
      console.log(`🎯 Applied Control: ${applied_control.ref_id || 'N/A'} - ${applied_control.name || 'N/A'}`);
      console.log(`📁 Gemini File IDs: ${fileIds.length}`);
      console.log(`📎 Evidence entries: ${evidences.length}`);
      console.log(`📜 Requirements: ${requirements.length}`);
      console.log(`❓ Questions: ${questions.length}`);
      console.log(`📄 Typical Evidence: ${typical_evidence.length}`);
      console.log(`📎 Inline files (legacy): ${files.length}`);

      // Build the audit prompt (async - loads prompt template from DB)
      const auditPrompt = await this.buildAuditPrompt({
        assessment_type: resolvedType,
        applied_control,
        gemini_file_search,
        requirements,
        questions,
        typical_evidence,
        analysis_config,
        files,
        options
      });

      // Log the prompt
      console.log('\n' + '='.repeat(80));
      console.log('🤖 PROMPT SENT TO GEMINI:');
      console.log('='.repeat(80));
      console.log(auditPrompt.substring(0, 2000) + (auditPrompt.length > 2000 ? '\n...[truncated in log]' : ''));
      console.log('='.repeat(80) + '\n');

      // Build content parts (prompt + file references) - async to support file metadata lookup
      const { parts, skippedFiles } = await this.buildContentParts(auditPrompt, gemini_file_search, files);

      console.log(`📦 Sending ${parts.length} parts to Gemini`);

      // Send to Gemini
      const result = await geminiChatService.model.generateContent(parts);
      const response = await result.response;
      const aiResponse = response.text();

      console.log('✅ Audit analysis completed');

      const parsed = this.parseAuditResponse(aiResponse);

      // Attach skipped files info so the caller knows what wasn't analyzed
      if (skippedFiles && skippedFiles.length > 0) {
        parsed.skippedFiles = skippedFiles;
        parsed.fileWarning = `${skippedFiles.length} file(s) could not be attached. Use Gemini Files API format (files/{name}) instead of fileSearchStores/ paths.`;
      }

      return parsed;
    } catch (error) {
      console.error('❌ Audit analysis error:', error.message);
      throw new Error(`Audit analysis failed: ${error.message}`);
    }
  }

  /**
   * Auto-detect or validate the assessment type.
   * @param {string|undefined} explicit - Caller-supplied type
   * @param {Object} applied_control
   * @param {Array} requirements
   * @returns {"requirement"|"control"}
   */
  resolveAssessmentType(explicit, applied_control = {}, requirements = []) {
    if (explicit === 'requirement' || explicit === 'control') return explicit;

    // Auto-detect: if there's a meaningful applied control but no requirements, it's a control assessment
    const hasControl = applied_control.name || applied_control.description;
    const hasRequirement = requirements.length > 0 && (requirements[0].name || requirements[0].description);

    if (hasControl && !hasRequirement) return 'control';
    // Default to requirement assessment
    return 'requirement';
  }

  /**
   * Build the audit analysis prompt with all context.
   * Uses named {{PLACEHOLDER}} tokens in the template loaded from DB/fallback.
   * Picks the prompt template based on assessment_type:
   *   - "requirement" → audit_analyze_requirement
   *   - "control"     → audit_analyze_control
   */
  async buildAuditPrompt(params = {}) {
    const {
      assessment_type = 'requirement',
      applied_control = {},
      gemini_file_search = {},
      requirements = [],
      questions = [],
      typical_evidence = [],
      analysis_config = {},
      files = [],
      options = {}
    } = params;

    // Merge with defaults
    const config = {
      return_compliance_result: true,
      include_entity_extraction: false,
      include_compliance_check: false,
      include_gap_analysis: true,
      include_typical_evidence_check: true,
      include_recommendations: false,
      response_language: 'auto',
      question_answer_values: ['"Yes"', '"No"', '"Partial"'],
      compliance_result_values: ['"Compliant"', '"Partially Compliant"', '"Non-Compliant"', '"Not Applicable"'],
      ...analysis_config
    };

    // --- Requirement ---
    const req = requirements.length > 0 ? requirements[0] : {};

    // --- Evidence list ---
    const evidences = gemini_file_search.evidences || [];
    const fileIds = gemini_file_search.file_ids || [];
    let evidenceList = '';
    if (evidences.length > 0) {
      evidences.forEach((ev, idx) => {
        evidenceList += `${idx + 1}. ${ev.evidence_name || 'Unnamed file'}`;
        if (ev.evidence_description) evidenceList += ` — ${ev.evidence_description}`;
        evidenceList += `\n`;
      });
    } else if (fileIds.length > 0) {
      fileIds.forEach((fid, idx) => {
        evidenceList += `${idx + 1}. ${fid}\n`;
      });
    } else if (files.length > 0) {
      files.forEach((file, idx) => {
        evidenceList += `${idx + 1}. ${file.name} (${file.mimeType})\n`;
      });
    } else {
      evidenceList = '(No evidence files submitted)\n';
    }

    // --- Typical evidence list ---
    let typicalEvidenceList = '';
    if (typical_evidence.length > 0) {
      typical_evidence.forEach((e, idx) => {
        typicalEvidenceList += `${idx + 1}. ${e}\n`;
      });
    } else {
      typicalEvidenceList = '(None specified)\n';
    }

    // --- Questions list ---
    let questionsList = '';
    if (questions.length > 0) {
      questions.forEach((q, idx) => {
        questionsList += `${idx + 1}. ${q}\n`;
      });
    } else {
      questionsList = '(No questions provided)\n';
    }

    // --- Conditional sections (2–8) ---
    let conditionalSections = '';

    // Section 2: Overall Compliance/Effectiveness Assessment
    if (config.return_compliance_result) {
      if (assessment_type === 'control') {
        conditionalSections += `### 2. OVERALL CONTROL EFFECTIVENESS ASSESSMENT

Provide an overall assessment of the applied control using EXACTLY one of these values: ${config.compliance_result_values.join(', ')}

**Assessment Criteria:**

- **"Compliant"**: ALL questions are answered "Yes" and all evidence demonstrates the control is fully implemented, operational, and effective.
- **"Partially Compliant"**: SOME questions are answered "Yes" or "Partial", showing the control is partially implemented but has gaps in coverage, documentation, or effectiveness.
- **"Non-Compliant"**: ALL or most questions are answered "No", meaning the submitted evidence does not demonstrate that the control is implemented at all, or the evidence is entirely irrelevant.
- **"Not Applicable"**: The control does not apply to this organization or context.

**CRITICAL**: If all questions are answered "No" because the evidence is unrelated to the control, the overall status MUST be "Non-Compliant", NOT "Partially Compliant".

Include:
- \`status\`: One of the compliance result values
- \`score\`: 0-100 effectiveness score
- \`summary\`: Brief explanation of the control effectiveness determination

---

`;
      } else {
        conditionalSections += `### 2. OVERALL COMPLIANCE ASSESSMENT

Provide an overall compliance assessment using EXACTLY one of these values: ${config.compliance_result_values.join(', ')}

**Compliance Criteria:**

- **"Compliant"**: ALL questions are answered "Yes" and all required evidence is present and sufficient.
- **"Partially Compliant"**: SOME questions are answered "Yes" or "Partial", showing the organization has made progress but has gaps. At least some evidence is relevant to the requirement.
- **"Non-Compliant"**: ALL or most questions are answered "No", meaning the submitted evidence does not address the requirement at all, or is entirely irrelevant.
- **"Not Applicable"**: The requirement does not apply to this organization or context.

**CRITICAL**: If all questions are answered "No" because the evidence is unrelated to the requirement, the overall status MUST be "Non-Compliant", NOT "Partially Compliant".

Include:
- \`status\`: One of the compliance result values
- \`score\`: 0-100 compliance score
- \`summary\`: Brief explanation of the compliance determination

---

`;
      }
    }

    // Section 3: Entity Extraction
    if (config.include_entity_extraction) {
      conditionalSections += `### 3. ENTITY EXTRACTION

Extract key entities from the evidence documents:
- Organization names
- Policy/document names and versions
- Dates (creation, review, expiry)
- People/roles mentioned
- Systems/technologies referenced

---

`;
    }

    // Section 4: Compliance Check
    if (config.include_compliance_check) {
      if (assessment_type === 'control') {
        conditionalSections += `### 4. IMPLEMENTATION CHECK

For the applied control, assess:
- Whether the evidence demonstrates the control is implemented
- Specific configurations, policies, or processes that support the control
- Any gaps in implementation or operational effectiveness

---

`;
      } else {
        conditionalSections += `### 4. COMPLIANCE CHECK

For each requirement, assess:
- Whether the evidence directly addresses the requirement
- Specific clauses or sections that are met or unmet
- Any conditions or caveats

---

`;
      }
    }

    // Section 5: Gap Analysis
    if (config.include_gap_analysis) {
      if (assessment_type === 'control') {
        conditionalSections += `### 5. GAP ANALYSIS

Identify gaps between:
- What the control requires for full implementation vs. what the evidence demonstrates
- Missing documentation, configurations, or operational procedures
- Areas where the control's coverage or effectiveness is insufficient

---

`;
      } else {
        conditionalSections += `### 5. GAP ANALYSIS

Identify gaps between:
- What the requirement demands vs. what the evidence provides
- Missing documentation or processes
- Areas where evidence is weak or insufficient

---

`;
      }
    }

    // Section 6: Typical Evidence Check
    if (config.include_typical_evidence_check && typical_evidence.length > 0) {
      let teList = '';
      typical_evidence.forEach((e, idx) => {
        teList += `${idx + 1}. ${e}\n`;
      });
      conditionalSections += `### 6. TYPICAL EVIDENCE CHECK

Compare the uploaded evidence against the typical evidence list:
${teList}
For each typical evidence item, indicate whether it was found, partially found, or not found in the uploaded documents.

---

`;
    }

    // Section 7: Recommendations
    if (config.include_recommendations) {
      if (assessment_type === 'control') {
        conditionalSections += `### 7. RECOMMENDATIONS

Provide actionable recommendations to:
- Improve control implementation and operational effectiveness
- Close identified gaps in coverage or documentation
- Strengthen evidence of the control's effectiveness

---

`;
      } else {
        conditionalSections += `### 7. RECOMMENDATIONS

Provide actionable recommendations to:
- Close identified gaps
- Strengthen existing evidence
- Achieve full compliance

---

`;
      }
    }

    // Section 8: Response Language
    conditionalSections += `### 8. RESPONSE LANGUAGE

`;
    if (config.response_language === 'auto') {
      conditionalSections += `Respond in the same language as the requirement and questions. If mixed languages are detected, use the predominant language.\n`;
    } else if (config.response_language) {
      conditionalSections += `Respond entirely in ${config.response_language}.\n`;
    } else {
      conditionalSections += `Respond in the same language as the requirement and questions.\n`;
    }

    // --- Response format JSON (dynamic based on enabled sections) ---
    let responseFormat = '{\n';

    // Always include questionAnswers
    responseFormat += `  "questionAnswers": [
    {
      "question": "Exact question text",
      "answer": "Yes | No | Partial",
      "justification": "Explanation referencing evidence"
    }
  ]`;

    if (config.return_compliance_result) {
      responseFormat += `,
  "overallAssessment": {
    "status": "Compliant | Partially Compliant | Non-Compliant | Not Applicable",
    "score": 0-100,
    "summary": "Brief explanation"
  }`;
    }

    if (config.include_entity_extraction) {
      responseFormat += `,
  "entityExtraction": {
    "organizations": [],
    "documents": [],
    "dates": [],
    "roles": [],
    "systems": []
  }`;
    }

    if (config.include_compliance_check) {
      responseFormat += `,
  "complianceCheck": {
    "details": []
  }`;
    }

    if (config.include_gap_analysis) {
      responseFormat += `,
  "gapAnalysis": {
    "gaps": [
      {
        "requirement": "What is required",
        "currentState": "What evidence shows",
        "gap": "What is missing"
      }
    ]
  }`;
    }

    if (config.include_typical_evidence_check && typical_evidence.length > 0) {
      responseFormat += `,
  "typicalEvidenceCheck": [
    {
      "typicalEvidence": "Expected item",
      "status": "Found | Partially Found | Not Found",
      "details": "Explanation"
    }
  ]`;
    }

    if (config.include_recommendations) {
      responseFormat += `,
  "recommendations": [
    {
      "priority": "High | Medium | Low",
      "recommendation": "Action to take",
      "rationale": "Why this matters"
    }
  ]`;
    }

    responseFormat += '\n}';

    // --- Choose prompt key based on assessment type ---
    const promptKey = assessment_type === 'control'
      ? 'audit_analyze_control'
      : 'audit_analyze_requirement';

    // --- Build type-specific placeholder values ---
    const placeholders = {
      EVIDENCE_LIST: evidenceList,
      TYPICAL_EVIDENCE_LIST: typicalEvidenceList,
      QUESTION_ANSWER_VALUES: config.question_answer_values.join(', '),
      QUESTIONS_LIST: questionsList,
      CONDITIONAL_SECTIONS: conditionalSections,
      RESPONSE_FORMAT: responseFormat
    };

    if (assessment_type === 'control') {
      // Control assessment: control is primary, requirements provide context
      placeholders.CTRL_NAME = applied_control.name || 'N/A';
      placeholders.CTRL_DESCRIPTION = applied_control.description || 'N/A';
      placeholders.CTRL_STATUS = applied_control.status || 'N/A';
      placeholders.CTRL_CATEGORY = applied_control.category || 'N/A';
      placeholders.CTRL_CSF_FUNCTION = applied_control.csf_function || 'N/A';

      // Build optional mapped requirements section
      if (requirements.length > 0) {
        let reqSection = '**Mapped Requirements (for context):**\n';
        requirements.forEach((r, idx) => {
          reqSection += `${idx + 1}. **${r.ref_id || 'N/A'}** — ${r.name || 'N/A'}\n`;
          if (r.description) reqSection += `   ${r.description}\n`;
        });
        placeholders.MAPPED_REQUIREMENTS_SECTION = reqSection;
      } else {
        placeholders.MAPPED_REQUIREMENTS_SECTION = '';
      }
    } else {
      // Requirement assessment: requirement is primary, control provides context
      placeholders.REQ_REF_ID = req.ref_id || 'N/A';
      placeholders.REQ_NAME = req.name || 'N/A';
      placeholders.REQ_DESCRIPTION = req.description || 'N/A';

      // Build optional related control section
      if (applied_control.name || applied_control.description) {
        let ctrlSection = '**Related Applied Control (for context):**\n';
        ctrlSection += `- Name: ${applied_control.name || 'N/A'}\n`;
        ctrlSection += `- Description: ${applied_control.description || 'N/A'}\n`;
        ctrlSection += `- Status: ${applied_control.status || 'N/A'}\n`;
        ctrlSection += `- Category: ${applied_control.category || 'N/A'}\n`;
        ctrlSection += `- CSF Function: ${applied_control.csf_function || 'N/A'}\n`;
        placeholders.RELATED_CONTROL_SECTION = ctrlSection;
      } else {
        placeholders.RELATED_CONTROL_SECTION = '';
      }
    }

    // --- Build final prompt using named placeholders ---
    let prompt;
    try {
      prompt = await promptService.buildPrompt(promptKey, placeholders);
    } catch (err) {
      // Fall back to legacy combined prompt if the type-specific prompt is not found
      console.warn(`⚠️ Prompt "${promptKey}" not found, falling back to "audit_analyze": ${err.message}`);
      // For legacy prompt, supply all placeholders
      placeholders.REQ_REF_ID = placeholders.REQ_REF_ID || req.ref_id || 'N/A';
      placeholders.REQ_NAME = placeholders.REQ_NAME || req.name || 'N/A';
      placeholders.REQ_DESCRIPTION = placeholders.REQ_DESCRIPTION || req.description || 'N/A';
      placeholders.CTRL_NAME = placeholders.CTRL_NAME || applied_control.name || 'N/A';
      placeholders.CTRL_DESCRIPTION = placeholders.CTRL_DESCRIPTION || applied_control.description || 'N/A';
      placeholders.CTRL_STATUS = placeholders.CTRL_STATUS || applied_control.status || 'N/A';
      placeholders.CTRL_CATEGORY = placeholders.CTRL_CATEGORY || applied_control.category || 'N/A';
      placeholders.CTRL_CSF_FUNCTION = placeholders.CTRL_CSF_FUNCTION || applied_control.csf_function || 'N/A';
      prompt = await promptService.buildPrompt('audit_analyze', placeholders);
    }

    return prompt;
  }

  /**
   * Build content parts for Gemini API call.
   * Combines: text prompt + Gemini file references (fileData) + inline files (inlineData)
   * 
   * Supported file_id formats:
   *   - "files/abc123" → Gemini Files API (looked up via GoogleAIFileManager)
   *   - "https://generativelanguage.googleapis.com/v1beta/files/abc123" → direct URI
   * 
   * NOT supported (skipped with warning):
   *   - "fileSearchStores/..." → Vertex AI file search store paths (not compatible with Google AI SDK)
   */
  async buildContentParts(textPrompt, geminiFileSearch = {}, inlineFiles = []) {
    const parts = [];
    const skippedFiles = [];

    // 1. Text prompt
    parts.push({ text: textPrompt });

    // 2. Gemini File Search references (pre-uploaded files)
    const fileIds = geminiFileSearch.file_ids || [];
    const evidences = geminiFileSearch.evidences || [];

    for (const fileId of fileIds) {
      // ── Guard: reject file search store paths ──
      // These are Vertex AI resources and cannot be used as fileData with Google AI SDK.
      // They need to be uploaded via the Gemini Files API instead (returns "files/{name}" format).
      if (fileId.startsWith('fileSearchStores/') || fileId.includes('/fileSearchStores/')) {
        console.warn(`⚠️ Skipping unsupported file ID format: ${fileId}`);
        console.warn(`   fileSearchStores/ paths are Vertex AI resources and cannot be used as fileData.`);
        console.warn(`   Upload files via the Gemini Files API instead → returns "files/{name}" format.`);
        const evidence = evidences.find(e => e.gemini_file_id === fileId);
        skippedFiles.push({
          fileId,
          evidenceName: evidence?.evidence_name || 'Unknown',
          reason: 'fileSearchStores/ paths are not supported. Use Gemini Files API (files/{name} format).'
        });
        continue;
      }

      try {
        // Try to look up file metadata from Gemini Files API
        if (fileManager && fileId.startsWith('files/')) {
          console.log(`🔍 Looking up file metadata for: ${fileId}`);
          const fileMeta = await fileManager.getFile(fileId);
          
          parts.push({
            fileData: {
              fileUri: fileMeta.uri,
              mimeType: fileMeta.mimeType
            }
          });
          console.log(`📁 Added Gemini file: ${fileId} (${fileMeta.mimeType}, uri: ${fileMeta.uri})`);
        } else if (fileId.startsWith('https://')) {
          // Direct URI provided - need mime_type from evidences
          const evidence = evidences.find(e => e.gemini_file_id === fileId);
          const mimeType = evidence?.mime_type || 'application/pdf';

          parts.push({
            fileData: {
              fileUri: fileId,
              mimeType: mimeType
            }
          });
          console.log(`📁 Added Gemini file (direct URI): ${fileId} (${mimeType})`);
        } else if (fileId.startsWith('files/')) {
          // Files API format but no file manager - construct URI manually
          const evidence = evidences.find(e => e.gemini_file_id === fileId);
          const mimeType = evidence?.mime_type || 'application/pdf';
          const fileUri = `https://generativelanguage.googleapis.com/v1beta/${fileId}`;

          parts.push({
            fileData: {
              fileUri: fileUri,
              mimeType: mimeType
            }
          });
          console.log(`📁 Added Gemini file (constructed URI): ${fileId} (${mimeType})`);
        } else {
          // Unknown format
          console.warn(`⚠️ Skipping unrecognized file ID format: ${fileId}`);
          console.warn(`   Expected format: "files/{name}" (from Gemini Files API upload)`);
          skippedFiles.push({
            fileId,
            reason: 'Unrecognized format. Expected "files/{name}" from Gemini Files API.'
          });
        }
      } catch (fileError) {
        console.error(`❌ Error processing file ${fileId}:`, fileError.message);
        skippedFiles.push({
          fileId,
          reason: `Lookup failed: ${fileError.message}`
        });
      }
    }

    // If files were skipped, append a note to the prompt
    if (skippedFiles.length > 0) {
      let note = `\n\n**[SYSTEM NOTE]** ${skippedFiles.length} file(s) could not be attached for analysis:\n`;
      for (const sf of skippedFiles) {
        note += `- ${sf.evidenceName || sf.fileId}: ${sf.reason}\n`;
      }
      note += `\nPlease assess based on whatever evidence IS available. If no files are attached, state that clearly.\n`;
      parts[0].text += note;
      console.warn(`⚠️ ${skippedFiles.length} file(s) skipped — analysis will proceed without them`);
    }

    // 3. Inline text files (legacy support)
    const textFiles = inlineFiles.filter(f => f.encoding === 'text');
    for (const file of textFiles) {
      parts.push({
        text: `\n--- Content of ${file.name} ---\n${file.data.substring(0, 30000)}${file.data.length > 30000 ? '\n...[truncated]' : ''}\n`
      });
    }

    // 4. Inline binary files (legacy support)
    const binaryFiles = inlineFiles.filter(f => f.encoding === 'base64');
    for (const file of binaryFiles) {
      try {
        const mimeType = file.mimeType || 'application/octet-stream';
        const supportedTypes = [
          'application/pdf',
          'image/png', 'image/jpeg', 'image/webp', 'image/gif',
          'text/plain', 'text/html', 'text/csv', 'text/markdown',
          'application/json', 'application/xml', 'text/xml'
        ];

        if (supportedTypes.some(t => mimeType.startsWith(t.split('/')[0]) || mimeType === t)) {
          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: file.data
            }
          });
          console.log(`📎 Added inline file: ${file.name} (${mimeType})`);
        } else {
          console.warn(`⚠️ Skipping unsupported file type: ${file.name} (${mimeType})`);
        }
      } catch (fileError) {
        console.error(`❌ Error adding file ${file.name}:`, fileError.message);
      }
    }

    return { parts, skippedFiles };
  }

  /**
   * Parse the audit response from Gemini.
   * Handles the new modular response format (questionAnswers, overallAssessment, gapAnalysis, etc.)
   * and also gracefully accepts the old format for backward compatibility.
   */
  parseAuditResponse(responseText) {
    try {
      let jsonText = responseText.trim();
      jsonText = jsonText.replace(/^```json?\n?/i, '').replace(/\n?```$/, '');

      const response = JSON.parse(jsonText);

      // Build cleaned response — pass through all known sections
      const cleaned = {
        success: true,
        // Question answers (new key) — also check old key for backward compat
        questionAnswers: response.questionAnswers || response.questionEvaluation || [],
        // Overall assessment
        overallAssessment: response.overallAssessment || null,
        // Entity extraction
        entityExtraction: response.entityExtraction || null,
        // Compliance check
        complianceCheck: response.complianceCheck || null,
        // Gap analysis (new structure) — also check old flat array
        gapAnalysis: response.gapAnalysis || (response.gaps ? { gaps: response.gaps } : null),
        // Typical evidence check
        typicalEvidenceCheck: response.typicalEvidenceCheck || null,
        // Recommendations
        recommendations: response.recommendations || null
      };

      // Remove null sections (not requested)
      Object.keys(cleaned).forEach(key => {
        if (cleaned[key] === null) delete cleaned[key];
      });

      return cleaned;
    } catch (error) {
      console.error('Failed to parse audit response:', error.message);
      console.log('Raw response:', responseText.substring(0, 500));

      return {
        success: false,
        overallAssessment: {
          status: 'Non-Compliant',
          score: 0,
          summary: 'Failed to parse audit analysis results'
        },
        questionAnswers: [],
        rawResponse: responseText,
        parseError: error.message
      };
    }
  }

  /**
   * Batch audit analysis
   */
  async analyzeBatch(items) {
    if (!this.isAvailable()) {
      throw new Error('Audit service not initialized');
    }

    const results = [];

    for (const item of items) {
      try {
        const response = await this.analyze(item);
        results.push({
          itemId: item.id || item.applied_control?.id,
          success: true,
          response
        });
      } catch (error) {
        results.push({
          itemId: item.id || item.applied_control?.id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}

// Singleton instance
const auditService = new AuditService();

module.exports = auditService;
