/**
 * Audit Service
 * Uses Gemini AI to analyze evidence files against audit questions and typical evidence requirements
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
   * Analyze evidence files against audit questions
   * @param {Array} files - Array of evidence files to analyze
   * @param {Array} questions - Array of audit questions to evaluate
   * @param {Array} typicalEvidence - Array of expected/typical evidence descriptions
   * @param {Object} options - Additional options
   */
  async analyze(files = [], questions = [], typicalEvidence = [], options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Audit service not initialized. Please set GEMINI_API_KEY');
    }

    try {
      console.log('📋 Starting audit analysis...');
      console.log(`📎 Files: ${files.length}`);
      console.log(`❓ Questions: ${questions.length}`);
      console.log(`📄 Typical Evidence: ${typicalEvidence.length}`);
      
      // Build the audit prompt
      const auditPrompt = this.buildAuditPrompt(files, questions, typicalEvidence, options);
      
      console.log(`📦 Sending request to Gemini for audit analysis`);
      
      // Use the chat service's model directly
      const parts = this.buildMultimodalParts(auditPrompt, files);
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
   * Build the audit analysis prompt
   */
  buildAuditPrompt(files = [], questions = [], typicalEvidence = [], options = {}) {
    let prompt = `You are an expert compliance auditor. Your task is to EVALUATE the submitted evidence file(s) and determine if they satisfy the compliance requirement.

**=== AUDIT CONTEXT ===**
${options.context || 'General compliance audit evaluation'}

`;

    // Add questions section
    if (questions.length > 0) {
      prompt += `**=== AUDIT QUESTIONS (${questions.length}) ===**
Evaluate if the submitted evidence answers these questions:
`;
      questions.forEach((q, idx) => {
        prompt += `Q${idx + 1}: ${q}\n`;
      });
      prompt += `\n`;
    }

    // Add typical evidence section  
    if (typicalEvidence.length > 0) {
      prompt += `**=== TYPICAL/EXPECTED EVIDENCE (${typicalEvidence.length}) ===**
Check if the submitted files contain or demonstrate these:
`;
      typicalEvidence.forEach((e, idx) => {
        prompt += `E${idx + 1}: ${e}\n`;
      });
      prompt += `\n`;
    }

    // Add file info
    if (files.length > 0) {
      prompt += `**=== SUBMITTED EVIDENCE FILES (${files.length}) ===**
`;
      files.forEach((file, idx) => {
        prompt += `File ${idx + 1}: ${file.name} (${file.mimeType})\n`;
      });
      prompt += `\n`;
    }

    prompt += `**=== YOUR EVALUATION INSTRUCTIONS ===**

You must carefully analyze the AUDIT CONTEXT above which contains:
- The evidence name and description
- The linked compliance requirement (Framework, Provider, Requirement ID, Name, Description)

Then evaluate if the SUBMITTED EVIDENCE FILES satisfy:
1. The compliance requirement described in the context
2. Each of the AUDIT QUESTIONS
3. Each of the TYPICAL/EXPECTED EVIDENCE items

**EVALUATION STEPS:**
1. **READ** the submitted file(s) thoroughly - examine actual content
2. **COMPARE** the file content against the requirement in the context
3. **ANSWER** each audit question based on what you find in the files
4. **CHECK** if typical evidence items are present
5. **IDENTIFY** any gaps or missing elements
6. **SCORE** overall compliance (0-100)

**=== OUTPUT FORMAT (JSON only) ===**

{
  "overallAssessment": {
    "status": "Compliant" | "Partially Compliant" | "Non-Compliant" | "Insufficient Evidence",
    "score": <0-100>,
    "summary": "2-3 sentence assessment based on the requirement in context"
  },
  "requirementEvaluation": {
    "requirementMet": true | false | "partial",
    "evidenceAlignment": "How well does the submitted evidence align with the requirement",
    "specificFindings": "What in the file specifically addresses the requirement"
  },
  "questionEvaluation": [
    {
      "questionNumber": 1,
      "question": "The question text",
      "answered": "Yes" | "Partially" | "No",
      "evidenceFound": "Specific content/quote from the file that answers this",
      "sourceFile": "filename where found",
      "confidence": <0.0-1.0>,
      "notes": "Additional observations"
    }
  ],
  "typicalEvidenceCheck": [
    {
      "evidenceItem": "The typical evidence description",
      "status": "Present" | "Partial" | "Missing",
      "foundIn": "filename or 'Not found'",
      "details": "What was found or what's missing"
    }
  ],
  "fileAnalysis": [
    {
      "fileName": "submitted-file.pdf",
      "contentSummary": "What this file actually contains",
      "relevantSections": ["Key sections/content relevant to the requirement"],
      "coversQuestions": [1, 2],
      "coversEvidence": [1, 3]
    }
  ],
  "gaps": [
    {
      "gap": "What's missing based on the requirement",
      "severity": "High" | "Medium" | "Low",
      "impact": "Why this matters for compliance",
      "recommendation": "How to address this gap"
    }
  ],
  "strengths": ["What the evidence does well"],
  "recommendations": ["Specific actions to achieve full compliance"]
}

**CRITICAL:**
- READ the actual content of submitted files - don't just look at filenames
- USE the requirement details from AUDIT CONTEXT to guide your evaluation
- QUOTE or reference specific content from the files
- Be SPECIFIC - generic answers are not acceptable
- Return ONLY valid JSON, no markdown code blocks`;

    return prompt;
  }

  /**
   * Build multimodal parts for Gemini
   */
  buildMultimodalParts(textPrompt, files = []) {
    const parts = [];
    
    // Add text prompt first
    parts.push({ text: textPrompt });

    // Add text files content inline
    const textFiles = files.filter(f => f.encoding === 'text');
    for (const file of textFiles) {
      parts.push({ 
        text: `\n--- Content of ${file.name} ---\n${file.data.substring(0, 30000)}${file.data.length > 30000 ? '\n...[truncated]' : ''}\n` 
      });
    }

    // Add binary files as inline data
    const binaryFiles = files.filter(f => f.encoding === 'base64');
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
          console.log(`📎 Added ${file.name} (${mimeType}) for audit analysis`);
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
   * Parse the audit response
   */
  parseAuditResponse(responseText) {
    try {
      let jsonText = responseText.trim();
      jsonText = jsonText.replace(/^```json?\n?/i, '').replace(/\n?```$/, '');
      
      const response = JSON.parse(jsonText);
      
      // Ensure required fields
      if (!response.overallAssessment) {
        response.overallAssessment = {
          status: 'Insufficient Evidence',
          score: 0,
          summary: 'Unable to complete assessment'
        };
      }
      if (!response.questionAnalysis) {
        response.questionAnalysis = [];
      }
      if (!response.evidenceAnalysis) {
        response.evidenceAnalysis = [];
      }
      if (!response.typicalEvidenceComparison) {
        response.typicalEvidenceComparison = [];
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
        questionAnalysis: [],
        evidenceAnalysis: [],
        typicalEvidenceComparison: [],
        gaps: [],
        strengths: [],
        recommendations: ['Manual review recommended due to parsing error'],
        entities: [],
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
        const response = await this.analyze(
          item.files || [],
          item.questions || [],
          item.typicalEvidence || [],
          item.options || {}
        );
        results.push({
          itemId: item.id,
          success: true,
          response
        });
      } catch (error) {
        results.push({
          itemId: item.id,
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
