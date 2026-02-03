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
    let prompt = `You are an expert compliance auditor and evidence evaluator. Your task is to analyze the provided evidence files and evaluate them against the given audit questions and typical evidence requirements.

**AUDIT CONTEXT:**
${options.context || 'Evaluate the provided evidence for compliance and completeness.'}

`;

    // Add questions section
    if (questions.length > 0) {
      prompt += `**AUDIT QUESTIONS TO EVALUATE (${questions.length}):**\n`;
      questions.forEach((q, idx) => {
        prompt += `${idx + 1}. ${q}\n`;
      });
      prompt += `\n`;
    }

    // Add typical evidence section
    if (typicalEvidence.length > 0) {
      prompt += `**TYPICAL/EXPECTED EVIDENCE (${typicalEvidence.length}):**\n`;
      typicalEvidence.forEach((e, idx) => {
        prompt += `${idx + 1}. ${e}\n`;
      });
      prompt += `\n`;
    }

    // Add file info
    if (files.length > 0) {
      prompt += `**EVIDENCE FILES PROVIDED (${files.length}):**\n`;
      files.forEach((file, idx) => {
        prompt += `${idx + 1}. ${file.name} (${file.mimeType})\n`;
      });
      prompt += `\n**CRITICAL:** Thoroughly analyze ALL attached evidence files.\n\n`;
    }

    prompt += `**YOUR ANALYSIS TASK:**
1. Review each evidence file carefully
2. Evaluate how well the evidence answers each audit question
3. Compare the provided evidence against the typical/expected evidence
4. Identify gaps, strengths, and areas of concern
5. Provide specific recommendations

**OUTPUT FORMAT:**
Return a JSON object with this exact structure:

{
  "overallAssessment": {
    "status": "Compliant" | "Partially Compliant" | "Non-Compliant" | "Insufficient Evidence",
    "score": <number 0-100>,
    "summary": "Brief overall assessment summary"
  },
  "questionAnalysis": [
    {
      "questionNumber": 1,
      "question": "The audit question text",
      "answer": "Detailed answer based on evidence",
      "evidenceFound": ["List of relevant evidence found"],
      "status": "Answered" | "Partially Answered" | "Not Answered",
      "confidence": 0.95,
      "gaps": ["Any gaps identified"]
    }
  ],
  "evidenceAnalysis": [
    {
      "fileName": "document.pdf",
      "description": "What this document contains",
      "relevance": "High" | "Medium" | "Low",
      "coversTypicalEvidence": ["Which typical evidence items this covers"],
      "keyFindings": ["Important findings from this document"]
    }
  ],
  "typicalEvidenceComparison": [
    {
      "typicalEvidence": "Expected evidence description",
      "status": "Present" | "Partially Present" | "Missing",
      "foundIn": ["List of files where found"],
      "notes": "Additional notes"
    }
  ],
  "gaps": [
    {
      "description": "Gap description",
      "severity": "High" | "Medium" | "Low",
      "recommendation": "How to address this gap"
    }
  ],
  "strengths": ["List of strengths identified"],
  "recommendations": ["List of actionable recommendations"],
  "entities": [
    {
      "text": "Entity text",
      "type": "PERSON|ORGANIZATION|POLICY|CONTROL|STANDARD|DATE|etc",
      "context": "Where found",
      "source": "filename"
    }
  ],
  "relationships": [
    {
      "entity1": "First entity",
      "relation": "relationship type",
      "entity2": "Second entity"
    }
  ]
}

**IMPORTANT:**
1. Be thorough and specific in your analysis
2. Reference specific content from the evidence files
3. Clearly indicate what is present vs missing
4. Provide actionable recommendations
5. Return ONLY valid JSON, no markdown code blocks`;

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
