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
    this.currentModelName = 'gemini-1.5-flash-latest';
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
   * Evaluate audit item with Gemini AI
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
   * Build evaluation prompt for Gemini
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
