/**
 * Gemini AI Evaluation Service
 * Uses Google's Gemini AI to evaluate audit items and evidence files
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');

class GeminiEvaluationService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.currentModelName = 'gemini-2.0-flash-exp';
    this.initializeGemini();
  }

  /**
   * Initialize Gemini AI with API key
   */
  initializeGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️  GEMINI_API_KEY not found in environment variables');
      return;
    }

    // Try different model names in order of preference
    const modelNames = [
      'gemini-2.0-flash-exp',
      'gemini-exp-1206',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      
      // Try the first available model
      for (const modelName of modelNames) {
        try {
          this.model = this.genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
              temperature: 0.4,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 8192,
            }
          });
          this.currentModelName = modelName;
          console.log(`✅ Gemini AI initialized successfully with ${modelName}`);
          break;
        } catch (modelError) {
          console.warn(`⚠️  Model ${modelName} not available: ${modelError.message}`);
        }
      }
      
      if (!this.model) {
        throw new Error('No Gemini models available');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI:', error.message);
    }
  }

  /**
   * General evaluation method - works with any context and files
   */
  async evaluate(context, files = []) {
    if (!this.model) {
      throw new Error('Gemini AI not initialized. Please set GEMINI_API_KEY in environment variables');
    }

    try {
      console.log('🤖 Sending evaluation request to Gemini AI...');
      console.log(`📄 Context: ${context.substring(0, 100)}...`);
      console.log(`📎 Files: ${files.length}`);
      
      // Build prompt
      const prompt = this.buildPrompt(context, files);
      
      // Send to Gemini
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const evaluation = response.text();

      console.log('✅ Received evaluation from Gemini AI');
      
      // Parse the evaluation response
      return this.parseEvaluation(evaluation, {});
    } catch (error) {
      console.error('❌ Gemini AI evaluation error:', error.message);
      throw new Error(`AI Evaluation failed: ${error.message}`);
    }
  }

  /**
   * Evaluate audit item with Gemini AI (legacy method for backward compatibility)
   */
  async evaluateAuditItem(itemData, fileContents = []) {
    if (!this.model) {
      throw new Error('Gemini AI not initialized. Please set GEMINI_API_KEY in environment variables');
    }

    try {
      const prompt = this.buildEvaluationPrompt(itemData, fileContents);
      
      console.log('🤖 Sending evaluation request to Gemini AI...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const evaluation = response.text();

      console.log('✅ Received evaluation from Gemini AI');
      
      // Parse the evaluation response
      return this.parseEvaluation(evaluation, itemData);
    } catch (error) {
      console.error('❌ Gemini AI evaluation error:', error.message);
      throw new Error(`AI Evaluation failed: ${error.message}`);
    }
  }

  /**
   * Build evaluation prompt (general purpose)
   */
  buildPrompt(context, files = []) {
    // Separate text and binary files
    const textFiles = files.filter(f => f.encoding === 'text');
    const binaryFiles = files.filter(f => f.encoding === 'base64');

    let prompt = `You are an expert compliance and audit evaluator. Analyze the provided context and evidence files, then provide a comprehensive evaluation.

**CONTEXT:**
${context}

`;

    // Add text files content
    if (textFiles.length > 0) {
      prompt += `\n**TEXT-BASED EVIDENCE (${textFiles.length} file(s)):**\n`;
      textFiles.forEach((file, idx) => {
        prompt += `\n--- File ${idx + 1}: ${file.name} ---`;
        if (file.description) {
          prompt += `\nDescription: ${file.description}`;
        }
        prompt += `\nMIME Type: ${file.mimeType}\n`;
        prompt += `Content:\n${file.data.substring(0, 15000)}${file.data.length > 15000 ? '\n...[content truncated for length]' : ''}\n`;
      });
    }

    // Add binary files information
    if (binaryFiles.length > 0) {
      prompt += `\n**DOCUMENT FILES SUBMITTED (${binaryFiles.length} file(s)):**\n`;
      binaryFiles.forEach((file, idx) => {
        prompt += `\n${idx + 1}. **${file.name}**`;
        if (file.description) {
          prompt += `\n   Description: ${file.description}`;
        }
        prompt += `\n   MIME Type: ${file.mimeType}`;
        if (file.size) {
          prompt += `\n   Size: ${(file.size / 1024).toFixed(2)} KB`;
        }
        prompt += `\n   Status: File submitted and available for review`;
        
        if (file.mimeType === 'application/pdf') {
          prompt += `\n   Note: PDF document submitted - manual review recommended`;
        }
        prompt += `\n`;
      });
    }

    if (files.length === 0) {
      prompt += `\nNo evidence files were submitted.\n`;
    }

    prompt += `\n**EVALUATION TASK:**
Based on the context and evidence provided, conduct a thorough compliance evaluation. Consider:
1. Completeness and quality of evidence
2. Alignment with requirements/standards
3. Gaps, weaknesses, or areas of concern
4. Specific, actionable recommendations

**RESPONSE FORMAT:**
Return a JSON object with this structure:

{
  "status": "Fully Compliant" | "Partially Compliant" | "Non-Compliant" | "Not Applicable",
  "compliance_status": "Fully Compliant" | "Partially Compliant" | "Non-Compliant" | "Not Applicable",
  "effectiveness": "Highly Effective" | "Effective" | "Partially Effective" | "Ineffective" | "Not Applicable",
  "score": <number 0-100>,
  "complianceLevel": "high" | "medium" | "low",
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "evidenceQuality": "Excellent" | "Good" | "Adequate" | "Poor",
  "summary": "Brief 2-3 sentence overall assessment",
  "detailedAnalysis": "Comprehensive 3-5 paragraph analysis of findings",
  "riskAssessment": "low" | "medium" | "high",
  "nextSteps": ["step 1", "step 2", ...],
  "note": "Any important notes or caveats"
}

**CRITICAL:** Return ONLY the JSON object. No markdown code blocks, no additional text.`;

    return prompt;
  }

  /**
   * Build evaluation prompt with file support for Gemini (legacy)
   */
  buildPromptWithFiles(itemData) {
    const { title, code, description, discussion, applicability, files = [] } = itemData;

    // Separate text and binary files
    const textFiles = files.filter(f => f.encoding === 'text');
    const binaryFiles = files.filter(f => f.encoding === 'base64');

    let prompt = `You are an expert audit evaluator analyzing compliance evidence. You will be provided with audit item details and submitted evidence files.

**AUDIT ITEM INFORMATION:**
- Code: ${code || 'N/A'}
- Title: ${title || 'N/A'}
- Description: ${description || 'No description provided'}
- Discussion: ${discussion || 'No discussion provided'}
- Applicability: ${applicability || 'Not specified'}

**SUBMITTED EVIDENCE (${files.length} file(s)):**
`;

    // Add text files content
    if (textFiles.length > 0) {
      prompt += `\n**TEXT-BASED EVIDENCE:**\n`;
      textFiles.forEach((file, idx) => {
        prompt += `\n--- File ${idx + 1}: ${file.name} ---`;
        if (file.description) {
          prompt += `\nDescription: ${file.description}`;
        }
        prompt += `\nMIME Type: ${file.mimeType}\n`;
        prompt += `Content:\n${file.data.substring(0, 15000)}${file.data.length > 15000 ? '\n...[content truncated for length]' : ''}\n`;
      });
    }

    // Add binary files information
    if (binaryFiles.length > 0) {
      prompt += `\n**BINARY/DOCUMENT FILES SUBMITTED:**\n`;
      binaryFiles.forEach((file, idx) => {
        prompt += `\n${idx + 1}. **${file.name}**`;
        if (file.description) {
          prompt += `\n   Description: ${file.description}`;
        }
        prompt += `\n   MIME Type: ${file.mimeType}`;
        if (file.size) {
          prompt += `\n   Size: ${(file.size / 1024).toFixed(2)} KB`;
        }
        prompt += `\n   Status: File submitted and available`;
        
        // For PDFs, note that the file is available
        if (file.mimeType === 'application/pdf') {
          prompt += `\n   Note: This is a PDF document. While I cannot directly read the PDF content in this format, `;
          prompt += `the file has been submitted as evidence. The audit team should manually review this document.`;
        }
        prompt += `\n`;
      });
    }

    if (files.length === 0) {
      prompt += `\nNo evidence files have been submitted for this audit item.\n`;
    }

    prompt += `\n**EVALUATION TASK:**
Analyze the audit item and all submitted evidence to provide a comprehensive evaluation. Consider:
1. The completeness and quality of submitted evidence
2. Whether the evidence demonstrates compliance with the audit requirements
3. Gaps or weaknesses in the evidence
4. Specific recommendations for improvement

**IMPORTANT NOTES:**
- For binary files (PDFs, images, etc.), acknowledge their submission and note that manual review is needed
- Base your evaluation on the text evidence provided and the fact that documents have been submitted
- Provide actionable recommendations even if some evidence requires manual review

**RESPONSE FORMAT:**
Provide your evaluation as a JSON object with this exact structure:

{
  "status": "Fully Compliant" | "Partially Compliant" | "Non-Compliant" | "Not Applicable",
  "compliance_status": "Fully Compliant" | "Partially Compliant" | "Non-Compliant" | "Not Applicable",
  "effectiveness": "Highly Effective" | "Effective" | "Partially Effective" | "Ineffective" | "Not Applicable",
  "score": <number 0-100>,
  "complianceLevel": "high" | "medium" | "low",
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "evidenceQuality": "Excellent" | "Good" | "Adequate" | "Poor",
  "summary": "2-3 sentence overall assessment",
  "detailedAnalysis": "Comprehensive 3-5 paragraph analysis",
  "riskAssessment": "low" | "medium" | "high",
  "nextSteps": ["step 1", "step 2", ...],
  "note": "Any important notes or caveats"
}

**CRITICAL:** Return ONLY the JSON object. No markdown formatting, no additional text.`;

    return prompt;
  }

  /**
   * Build evaluation prompt for Gemini (legacy)
   */
  buildEvaluationPrompt(itemData, fileContents) {
    const { title, code, description, discussion, applicability, fileNames } = itemData;

    let prompt = `You are an expert audit evaluator. Analyze the following audit item and evidence files, then provide a comprehensive evaluation.

**AUDIT ITEM INFORMATION:**
- Code: ${code || 'N/A'}
- Title: ${title || 'N/A'}
- Description: ${description || 'No description provided'}
- Discussion: ${discussion || 'No discussion provided'}
- Applicability: ${applicability || 'Not specified'}

**SUBMITTED EVIDENCE FILES:**
${fileNames && fileNames.length > 0 
  ? fileNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n')
  : 'No files submitted'}

**FILE CONTENTS:**
${fileContents.length > 0 
  ? fileContents.map((content, idx) => `
--- File ${idx + 1}: ${fileNames[idx] || 'Unknown'} ---
${content.substring(0, 10000)} ${content.length > 10000 ? '...[truncated]' : ''}
`).join('\n')
  : 'File contents not available for analysis'}

**EVALUATION REQUIREMENTS:**
Please provide a structured evaluation in the following JSON format:

{
  "status": "Fully Compliant" | "Partially Compliant" | "Non-Compliant" | "Not Applicable",
  "effectiveness": "Highly Effective" | "Effective" | "Partially Effective" | "Ineffective" | "Not Applicable",
  "score": <number between 0-100>,
  "complianceLevel": "high" | "medium" | "low",
  "strengths": [
    "List key strengths found in the evidence"
  ],
  "weaknesses": [
    "List gaps or areas needing improvement"
  ],
  "recommendations": [
    "Provide specific actionable recommendations"
  ],
  "evidenceQuality": "Excellent" | "Good" | "Adequate" | "Poor",
  "summary": "Brief overall assessment (2-3 sentences)",
  "detailedAnalysis": "Comprehensive analysis of the audit item and evidence (3-5 paragraphs)",
  "riskAssessment": "low" | "medium" | "high",
  "nextSteps": [
    "Suggested next steps or actions"
  ]
}

**IMPORTANT:** Return ONLY the JSON object, no additional text before or after.`;

    return prompt;
  }

  /**
   * Parse Gemini's evaluation response
   */
  parseEvaluation(evaluationText, itemData) {
    try {
      // Remove any markdown code blocks if present
      let jsonText = evaluationText.trim();
      jsonText = jsonText.replace(/^```json?\n?/i, '').replace(/\n?```$/,'');
      
      // Parse JSON
      const evaluation = JSON.parse(jsonText);
      
      // Validate required fields
      if (!evaluation.status) {
        evaluation.status = 'Partially Compliant';
      }
      if (typeof evaluation.score !== 'number') {
        evaluation.score = 70;
      }
      if (!evaluation.complianceLevel) {
        evaluation.complianceLevel = 'medium';
      }

      // Add metadata
      evaluation.evaluatedAt = new Date().toISOString();
      evaluation.aiModel = this.currentModelName || 'gemini-1.5-flash-latest';
      evaluation.itemCode = itemData.code;
      evaluation.itemTitle = itemData.title;

      return evaluation;
    } catch (error) {
      console.error('Failed to parse evaluation JSON:', error.message);
      console.log('Raw response:', evaluationText);
      
      // Return fallback evaluation
      return {
        status: 'Partially Compliant',
        effectiveness: 'Partially Effective',
        score: 70,
        complianceLevel: 'medium',
        strengths: ['Evidence submitted for review'],
        weaknesses: ['Unable to complete full AI analysis'],
        recommendations: ['Manual review recommended'],
        evidenceQuality: 'Adequate',
        summary: 'Automated evaluation could not be completed. Manual review is recommended.',
        detailedAnalysis: evaluationText,
        riskAssessment: 'medium',
        nextSteps: ['Conduct manual review', 'Request additional evidence if needed'],
        evaluatedAt: new Date().toISOString(),
        aiModel: this.currentModelName || 'gemini-1.5-flash-latest',
        itemCode: itemData.code,
        itemTitle: itemData.title,
        parseError: true
      };
    }
  }

  /**
   * Evaluate multiple audit items in batch
   */
  async evaluateBatch(items) {
    if (!this.model) {
      throw new Error('Gemini AI not initialized');
    }

    const results = [];
    
    for (const item of items) {
      try {
        const evaluation = await this.evaluateAuditItem(item, item.fileContents || []);
        results.push({
          itemId: item.id,
          success: true,
          evaluation
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

  /**
   * Generate recommendations based on evaluation
   */
  async generateRecommendations(evaluationHistory) {
    if (!this.model) {
      throw new Error('Gemini AI not initialized');
    }

    const prompt = `Based on the following audit evaluation history, provide strategic recommendations for improvement:

${JSON.stringify(evaluationHistory, null, 2)}

Please analyze patterns and provide:
1. Overall compliance trends
2. Common weaknesses across evaluations
3. Priority areas for improvement
4. Strategic recommendations for better compliance

Return your analysis in a clear, structured format.`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  /**
   * Check if Gemini is available
   */
  isAvailable() {
    return this.model !== null;
  }
}

// Singleton instance
const geminiEvaluationService = new GeminiEvaluationService();

module.exports = geminiEvaluationService;
