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
    let prompt = `You are an expert compliance auditor. Your task is to EVALUATE the submitted evidence file(s) against the provided audit questions and typical evidence requirements.

**EVALUATION OBJECTIVE:**
Determine if the submitted evidence adequately addresses the audit questions and meets the typical evidence expectations.

`;

    // Add questions section
    if (questions.length > 0) {
      prompt += `**AUDIT QUESTIONS - Evaluate if the evidence answers these (${questions.length}):**\n`;
      questions.forEach((q, idx) => {
        prompt += `Q${idx + 1}: ${q}\n`;
      });
      prompt += `\n`;
    }

    // Add typical evidence section  
    if (typicalEvidence.length > 0) {
      prompt += `**TYPICAL EVIDENCE - Check if the submitted files contain these (${typicalEvidence.length}):**\n`;
      typicalEvidence.forEach((e, idx) => {
        prompt += `E${idx + 1}: ${e}\n`;
      });
      prompt += `\n`;
    }

    // Add file info
    if (files.length > 0) {
      prompt += `**SUBMITTED EVIDENCE FILES (${files.length}):**\n`;
      files.forEach((file, idx) => {
        prompt += `File ${idx + 1}: ${file.name} (${file.mimeType})\n`;
      });
      prompt += `\n`;
    }

    prompt += `**YOUR EVALUATION TASK:**

1. **READ** the submitted evidence file(s) thoroughly
2. **EVALUATE** each audit question:
   - Does the evidence answer this question? (Yes/Partially/No)
   - What specific content in the file supports your answer?
   - Quote or reference specific sections from the file
3. **CHECK** each typical evidence item:
   - Is this type of evidence present in the submitted files? (Present/Partial/Missing)
   - Where exactly in the file(s) did you find it?
4. **IDENTIFY** gaps between what's expected and what's provided
5. **SCORE** the overall compliance (0-100)

**OUTPUT FORMAT (JSON only, no markdown):**

{
  "overallAssessment": {
    "status": "Compliant" | "Partially Compliant" | "Non-Compliant" | "Insufficient Evidence",
    "score": <0-100>,
    "summary": "2-3 sentence summary of findings"
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
      "contentSummary": "What this file contains",
      "relevantSections": ["Key sections relevant to the audit"],
      "coversQuestions": [1, 2],
      "coversEvidence": [1, 3]
    }
  ],
  "gaps": [
    {
      "gap": "What's missing",
      "severity": "High" | "Medium" | "Low",
      "impact": "Why this matters",
      "recommendation": "How to fix"
    }
  ],
  "strengths": ["What the evidence does well"],
  "recommendations": ["Specific actions to improve compliance"]
}

**CRITICAL INSTRUCTIONS:**
- You MUST read and analyze the actual content of the submitted file(s)
- Quote or reference specific content to support your evaluation
- Be specific - don't give generic answers
- If a question cannot be answered from the evidence, clearly state that
- Return ONLY valid JSON, no markdown code blocks or extra text`;

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
