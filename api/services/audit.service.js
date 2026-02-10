/**
 * Audit Service
 * Uses Gemini AI to analyze evidence files against audit questions and typical evidence requirements.
 * Supports Gemini File Search (referencing pre-uploaded files) and inline file uploads.
 */

const geminiChatService = require('./gemini-chat.service');

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

    // Default analysis config
    const config = {
      include_entity_extraction: false,
      include_compliance_check: false,
      include_gap_analysis: true,
      include_recommendations: false,
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
    prompt += `**=== EVALUATION INSTRUCTIONS ===**
1. READ all evidence files
2. COMPARE against requirements
3. ANSWER audit questions
4. CHECK typical evidence items
5. IDENTIFY gaps
6. TRANSLATE the outcomes (in output sections) to proper Arabic that holds the symantic meaning

`;

    // === OUTPUT FORMAT ===
    prompt += `**=== OUTPUT FORMAT (JSON only) ===**

{
  "ref_id": "${applied_control.ref_id || ''}",
  "name": "${applied_control.name || ''}",
  "description": "${applied_control.description || ''}",
  "status": "${applied_control.status || ''}",
  "category": "${applied_control.category || ''}",
  "csf_function": "${applied_control.csf_function || ''}",
  "overallAssessment": {
    "controlName": "${applied_control.name || ''}",
    "controlDescription": "${applied_control.description || ''}",
    "status": "...",
    "summary": "..."
  },
  "questionEvaluation": [{ "questionNumber": 1, "question": "...", "answered": "...", "evidenceFound": "...", "sourceFile": "...", "confidence": 0.0, "notes": "..." }],
  "typicalEvidenceCheck": [{ "evidenceItem": "...", "status": "...", "foundIn": "...", "details": "..." }],
  "gaps": [{ "gap": "...", "recommendation": "..." }]
}`;

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
   * Parse the audit response from Gemini
   */
  parseAuditResponse(responseText) {
    try {
      let jsonText = responseText.trim();
      jsonText = jsonText.replace(/^```json?\n?/i, '').replace(/\n?```$/, '');

      const response = JSON.parse(jsonText);

      // Only keep the fields defined in the prompt output format
      const cleaned = {
        success: true,
        ref_id: response.ref_id || '',
        name: response.name || '',
        description: response.description || '',
        status: response.status || '',
        category: response.category || '',
        csf_function: response.csf_function || '',
        overallAssessment: response.overallAssessment || {
          controlName: '',
          controlDescription: '',
          status: '',
          summary: ''
        },
        questionEvaluation: response.questionEvaluation || [],
        typicalEvidenceCheck: response.typicalEvidenceCheck || [],
        gaps: response.gaps || []
      };

      return cleaned;
    } catch (error) {
      console.error('Failed to parse audit response:', error.message);
      console.log('Raw response:', responseText.substring(0, 500));

      return {
        success: false,
        ref_id: '',
        name: '',
        description: '',
        status: '',
        category: '',
        csf_function: '',
        overallAssessment: {
          controlName: '',
          controlDescription: '',
          status: 'خطأ',
          summary: 'فشل في تحليل نتائج التدقيق'
        },
        questionEvaluation: [],
        typicalEvidenceCheck: [],
        gaps: [],
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
