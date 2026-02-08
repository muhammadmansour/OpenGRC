/**
 * Audit Service
 * Uses Gemini AI to analyze evidence files against audit questions and typical evidence requirements.
 * Supports Gemini File Search (referencing pre-uploaded files) and inline file uploads.
 */

const geminiChatService = require('./gemini-chat.service');

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

      console.log('📋 Starting audit analysis...');
      console.log(`🎯 Applied Control: ${applied_control.ref_id || 'N/A'} - ${applied_control.name || 'N/A'}`);
      console.log(`📁 Gemini File IDs: ${fileIds.length}`);
      console.log(`📎 Evidence entries: ${evidences.length}`);
      console.log(`📜 Requirements: ${requirements.length}`);
      console.log(`❓ Questions: ${questions.length}`);
      console.log(`📄 Typical Evidence: ${typical_evidence.length}`);
      console.log(`📎 Inline files (legacy): ${files.length}`);

      // Build the audit prompt
      const auditPrompt = this.buildAuditPrompt({
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

      // Build content parts (prompt + file references)
      const parts = this.buildContentParts(auditPrompt, gemini_file_search, files);

      console.log(`📦 Sending ${parts.length} parts to Gemini`);

      // Send to Gemini
      const result = await geminiChatService.model.generateContent(parts);
      const response = await result.response;
      const aiResponse = response.text();

      console.log('✅ Audit analysis completed');

      return this.parseAuditResponse(aiResponse);
    } catch (error) {
      console.error('❌ Audit analysis error:', error.message);
      throw new Error(`Audit analysis failed: ${error.message}`);
    }
  }

  /**
   * Build the audit analysis prompt with all context
   */
  buildAuditPrompt(params = {}) {
    const {
      applied_control = {},
      gemini_file_search = {},
      requirements = [],
      questions = [],
      typical_evidence = [],
      analysis_config = {},
      files = [],
      options = {}
    } = params;

    // Default analysis config - all enabled
    const config = {
      include_entity_extraction: true,
      include_compliance_check: true,
      include_gap_analysis: true,
      include_recommendations: true,
      ...analysis_config
    };

    let prompt = `You are an expert compliance auditor. Your task is to thoroughly analyze the submitted evidence files and evaluate them against the specified control and requirements.

`;

    // === APPLIED CONTROL SECTION ===
    if (applied_control && (applied_control.ref_id || applied_control.name)) {
      prompt += `**=== APPLIED CONTROL ===**
`;
      if (applied_control.ref_id) prompt += `Reference ID: ${applied_control.ref_id}\n`;
      if (applied_control.name) prompt += `Name: ${applied_control.name}\n`;
      if (applied_control.description) prompt += `Description: ${applied_control.description}\n`;
      if (applied_control.status) prompt += `Status: ${applied_control.status}\n`;
      if (applied_control.category) prompt += `Category: ${applied_control.category}\n`;
      if (applied_control.csf_function) prompt += `CSF Function: ${applied_control.csf_function}\n`;
      prompt += `\n`;
    }

    // === REQUIREMENTS SECTION ===
    if (requirements.length > 0) {
      prompt += `**=== COMPLIANCE REQUIREMENTS (${requirements.length}) ===**
Evaluate if the submitted evidence satisfies these requirements:
`;
      requirements.forEach((req, idx) => {
        prompt += `\nRequirement ${idx + 1}:\n`;
        if (req.ref_id) prompt += `  ID: ${req.ref_id}\n`;
        if (req.name) prompt += `  Name: ${req.name}\n`;
        if (req.description) prompt += `  Description: ${req.description}\n`;
        if (req.framework) prompt += `  Framework: ${req.framework}\n`;
        if (req.provider) prompt += `  Provider: ${req.provider}\n`;
      });
      prompt += `\n`;
    }

    // === QUESTIONS SECTION ===
    if (questions.length > 0) {
      prompt += `**=== AUDIT QUESTIONS (${questions.length}) ===**
Evaluate if the submitted evidence answers these questions:
`;
      questions.forEach((q, idx) => {
        prompt += `Q${idx + 1}: ${q}\n`;
      });
      prompt += `\n`;
    }

    // === TYPICAL EVIDENCE SECTION ===
    if (typical_evidence.length > 0) {
      prompt += `**=== TYPICAL/EXPECTED EVIDENCE (${typical_evidence.length}) ===**
Check if the submitted files contain or demonstrate these:
`;
      typical_evidence.forEach((e, idx) => {
        prompt += `E${idx + 1}: ${e}\n`;
      });
      prompt += `\n`;
    }

    // === EVIDENCE FILES SECTION ===
    const evidences = gemini_file_search.evidences || [];
    const fileIds = gemini_file_search.file_ids || [];

    if (evidences.length > 0) {
      prompt += `**=== SUBMITTED EVIDENCE FILES (${evidences.length}) ===**
The following evidence files have been uploaded and are attached for your analysis:
`;
      evidences.forEach((ev, idx) => {
        prompt += `\nEvidence ${idx + 1}:`;
        if (ev.evidence_name) prompt += ` ${ev.evidence_name}`;
        prompt += `\n`;
        if (ev.evidence_description) prompt += `  Description: ${ev.evidence_description}\n`;
        if (ev.gemini_file_id) prompt += `  File Reference: ${ev.gemini_file_id}\n`;
      });
      prompt += `\n`;
    } else if (fileIds.length > 0) {
      prompt += `**=== SUBMITTED EVIDENCE FILES (${fileIds.length}) ===**
${fileIds.length} file(s) are attached for your analysis.
`;
      prompt += `\n`;
    }

    // Legacy inline files
    if (files.length > 0) {
      prompt += `**=== INLINE EVIDENCE FILES (${files.length}) ===**
`;
      files.forEach((file, idx) => {
        prompt += `File ${idx + 1}: ${file.name} (${file.mimeType})\n`;
      });
      prompt += `\n`;
    }

    // === ADDITIONAL CONTEXT ===
    if (options.context) {
      prompt += `**=== ADDITIONAL CONTEXT ===**
${options.context}

`;
    }

    // === EVALUATION INSTRUCTIONS ===
    prompt += `**=== YOUR EVALUATION INSTRUCTIONS ===**

You must carefully:
1. **READ** the actual content of ALL submitted evidence files thoroughly
2. **COMPARE** the evidence against each compliance requirement
3. **ANSWER** each audit question based on what you find in the files
4. **CHECK** if each typical evidence item is present or addressed
5. **IDENTIFY** any gaps, missing elements, or areas of concern
6. **SCORE** overall compliance (0-100)
`;

    if (config.include_entity_extraction) {
      prompt += `7. **EXTRACT** key entities (people, dates, policies, systems) mentioned in the evidence
`;
    }

    prompt += `
**CRITICAL:**
- READ the actual content of submitted files - don't just look at filenames
- QUOTE or reference specific content from the files as evidence
- Be SPECIFIC - generic answers are not acceptable
- If no files are provided or files are empty, state that clearly

`;

    // === OUTPUT FORMAT ===
    prompt += `**=== OUTPUT FORMAT (JSON only) ===**

{
  "overallAssessment": {
    "status": "Compliant" | "Partially Compliant" | "Non-Compliant" | "Insufficient Evidence",
    "score": <0-100>,
    "summary": "2-3 sentence assessment"
  },`;

    if (config.include_compliance_check && requirements.length > 0) {
      prompt += `
  "requirementEvaluation": [
    {
      "ref_id": "Requirement reference ID",
      "name": "Requirement name",
      "met": true | false | "partial",
      "evidenceAlignment": "How well does the evidence align",
      "specificFindings": "What in the files specifically addresses this requirement",
      "confidence": <0.0-1.0>
    }
  ],`;
    }

    if (questions.length > 0) {
      prompt += `
  "questionEvaluation": [
    {
      "questionNumber": 1,
      "question": "The question text",
      "answered": "Yes" | "Partially" | "No",
      "evidenceFound": "Specific content/quote from the file that answers this",
      "sourceFile": "filename or evidence name where found",
      "confidence": <0.0-1.0>,
      "notes": "Additional observations"
    }
  ],`;
    }

    if (typical_evidence.length > 0) {
      prompt += `
  "typicalEvidenceCheck": [
    {
      "evidenceItem": "The typical evidence description",
      "status": "Present" | "Partial" | "Missing",
      "foundIn": "filename or evidence name, or 'Not found'",
      "details": "What was found or what's missing"
    }
  ],`;
    }

    prompt += `
  "fileAnalysis": [
    {
      "fileName": "evidence name or file reference",
      "contentSummary": "What this file actually contains",
      "relevantSections": ["Key sections relevant to the requirements"],
      "relevanceScore": <0.0-1.0>
    }
  ],`;

    if (config.include_gap_analysis) {
      prompt += `
  "gaps": [
    {
      "gap": "What's missing",
      "severity": "High" | "Medium" | "Low",
      "impact": "Why this matters for compliance",
      "recommendation": "How to address this gap"
    }
  ],`;
    }

    prompt += `
  "strengths": ["What the evidence does well"],`;

    if (config.include_recommendations) {
      prompt += `
  "recommendations": ["Specific actions to achieve full compliance"],`;
    }

    if (config.include_entity_extraction) {
      prompt += `
  "entities": [
    {
      "type": "person" | "date" | "policy" | "system" | "organization" | "standard" | "process",
      "value": "The extracted entity",
      "context": "Where/how it was mentioned"
    }
  ],`;
    }

    prompt += `
  "controlAssessment": {
    "controlId": "${applied_control.ref_id || 'N/A'}",
    "controlName": "${applied_control.name || 'N/A'}",
    "implementationStatus": "Implemented" | "Partially Implemented" | "Not Implemented" | "Not Applicable",
    "effectivenessRating": "Highly Effective" | "Effective" | "Partially Effective" | "Ineffective" | "Not Assessed"
  }
}

**CRITICAL:** Return ONLY valid JSON, no markdown code blocks, no additional text.`;

    return prompt;
  }

  /**
   * Build content parts for Gemini API call.
   * Combines: text prompt + Gemini file references (fileData) + inline files (inlineData)
   */
  buildContentParts(textPrompt, geminiFileSearch = {}, inlineFiles = []) {
    const parts = [];

    // 1. Text prompt
    parts.push({ text: textPrompt });

    // 2. Gemini File Search references (pre-uploaded files)
    const fileIds = geminiFileSearch.file_ids || [];
    for (const fileId of fileIds) {
      // fileId format: "files/abc123" or full URI
      // Construct the full URI if not already provided
      let fileUri = fileId;
      if (!fileId.startsWith('http')) {
        fileUri = `https://generativelanguage.googleapis.com/v1beta/${fileId}`;
      }

      parts.push({
        fileData: {
          fileUri: fileUri,
          mimeType: 'application/octet-stream' // Gemini will auto-detect
        }
      });
      console.log(`📁 Added Gemini file reference: ${fileId}`);
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

    return parts;
  }

  /**
   * Parse the audit response from Gemini
   */
  parseAuditResponse(responseText) {
    try {
      let jsonText = responseText.trim();
      jsonText = jsonText.replace(/^```json?\n?/i, '').replace(/\n?```$/, '');

      const response = JSON.parse(jsonText);

      // Ensure required fields exist
      if (!response.overallAssessment) {
        response.overallAssessment = {
          status: 'Insufficient Evidence',
          score: 0,
          summary: 'Unable to complete assessment'
        };
      }
      if (!response.requirementEvaluation) {
        response.requirementEvaluation = [];
      }
      if (!response.questionEvaluation) {
        response.questionEvaluation = [];
      }
      if (!response.typicalEvidenceCheck) {
        response.typicalEvidenceCheck = [];
      }
      if (!response.fileAnalysis) {
        response.fileAnalysis = [];
      }
      if (!response.gaps) {
        response.gaps = [];
      }
      if (!response.strengths) {
        response.strengths = [];
      }
      if (!response.recommendations) {
        response.recommendations = [];
      }
      if (!response.entities) {
        response.entities = [];
      }
      if (!response.controlAssessment) {
        response.controlAssessment = {};
      }

      // Add metadata
      response.timestamp = new Date().toISOString();
      response.aiModel = this.currentModelName;
      response.success = true;

      return response;
    } catch (error) {
      console.error('Failed to parse audit response:', error.message);
      console.log('Raw response:', responseText.substring(0, 500));

      return {
        success: false,
        overallAssessment: {
          status: 'Error',
          score: 0,
          summary: 'Failed to parse audit results'
        },
        requirementEvaluation: [],
        questionEvaluation: [],
        typicalEvidenceCheck: [],
        fileAnalysis: [],
        gaps: [],
        strengths: [],
        recommendations: ['Manual review recommended due to parsing error'],
        entities: [],
        controlAssessment: {},
        rawResponse: responseText,
        timestamp: new Date().toISOString(),
        aiModel: this.currentModelName,
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
