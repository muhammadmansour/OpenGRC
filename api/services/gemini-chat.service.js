/**
 * Gemini AI Chat Service
 * General-purpose AI chat service using Google's Gemini AI
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiChatService {
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
   * General chat method - works with any context and files
   * Now properly sends files to Gemini using multimodal API
   */
  async chat(context, files = []) {
    if (!this.model) {
      throw new Error('Gemini AI not initialized. Please set GEMINI_API_KEY in environment variables');
    }

    try {
      console.log('🤖 Sending request to Gemini AI...');
      console.log(`📄 Context: ${context.substring(0, 100)}...`);
      console.log(`📎 Files: ${files.length}`);
      
      // Build multimodal content parts
      const parts = this.buildMultimodalParts(context, files);
      
      console.log(`📦 Sending ${parts.length} parts to Gemini (text + files)`);
      
      // Send to Gemini with multimodal content
      const result = await this.model.generateContent(parts);
      const response = await result.response;
      const aiResponse = response.text();

      console.log('✅ Received response from Gemini AI');
      
      // Parse the response
      return this.parseResponse(aiResponse);
    } catch (error) {
      console.error('❌ Gemini AI chat error:', error.message);
      throw new Error(`AI Chat failed: ${error.message}`);
    }
  }

  /**
   * Build multimodal parts for Gemini (text + files)
   */
  buildMultimodalParts(context, files = []) {
    const parts = [];
    
    // Separate text and binary files
    const textFiles = files.filter(f => f.encoding === 'text');
    const binaryFiles = files.filter(f => f.encoding === 'base64');

    // Build the text prompt
    let textPrompt = `You are an expert compliance and audit evaluator. Analyze the provided context and ALL evidence files thoroughly, then provide a comprehensive evaluation.

**CONTEXT:**
${context}

`;

    // Add text files content to the prompt
    if (textFiles.length > 0) {
      textPrompt += `\n**TEXT-BASED EVIDENCE (${textFiles.length} file(s)):**\n`;
      textFiles.forEach((file, idx) => {
        textPrompt += `\n--- File ${idx + 1}: ${file.name} ---`;
        if (file.description) {
          textPrompt += `\nDescription: ${file.description}`;
        }
        textPrompt += `\nMIME Type: ${file.mimeType}\n`;
        textPrompt += `Content:\n${file.data.substring(0, 15000)}${file.data.length > 15000 ? '\n...[content truncated]' : ''}\n`;
      });
    }

    // Note about binary files that will be attached
    if (binaryFiles.length > 0) {
      textPrompt += `\n**ATTACHED DOCUMENT FILES (${binaryFiles.length} file(s)):**\n`;
      textPrompt += `The following files are attached as binary data for your analysis:\n`;
      binaryFiles.forEach((file, idx) => {
        textPrompt += `${idx + 1}. ${file.name} (${file.mimeType})`;
        if (file.description) {
          textPrompt += ` - ${file.description}`;
        }
        textPrompt += `\n`;
      });
      textPrompt += `\n**CRITICAL:** You MUST read and analyze the ACTUAL CONTENT of these attached PDF/image files. For each file, describe what you found in it.\n`;
    }

    if (files.length === 0) {
      textPrompt += `\nNo evidence files were submitted.\n`;
    }

    textPrompt += `
**EVALUATION TASK:**
Based on the context and evidence provided (including any attached documents), conduct a thorough compliance evaluation. Consider:
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
  "filesAnalyzed": [
    {"filename": "file1.pdf", "description": "Brief description of what this file contains", "relevance": "How relevant is this file to the audit requirement"},
    ...
  ],
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "evidenceQuality": "Excellent" | "Good" | "Adequate" | "Poor",
  "summary": "Brief 2-3 sentence overall assessment",
  "detailedAnalysis": "Comprehensive 3-5 paragraph analysis of findings, MUST mention specific content found in each file",
  "riskAssessment": "low" | "medium" | "high",
  "nextSteps": ["step 1", "step 2", ...],
  "note": "Any important notes or caveats"
}

**CRITICAL:** Return ONLY the JSON object. No markdown code blocks, no additional text.`;

    // Add text prompt as first part
    parts.push({ text: textPrompt });

    // Add binary files as inline data parts
    for (const file of binaryFiles) {
      try {
        // Gemini expects inlineData format for binary content
        const mimeType = file.mimeType || 'application/octet-stream';
        
        // Supported mime types for Gemini
        const supportedTypes = [
          'application/pdf',
          'image/png',
          'image/jpeg', 
          'image/webp',
          'image/gif',
          'image/heic',
          'image/heif',
          'text/plain',
          'text/html',
          'text/css',
          'text/javascript',
          'application/javascript',
          'text/x-python',
          'application/x-python-code',
          'text/markdown',
          'text/csv',
          'application/json',
          'application/xml',
          'text/xml'
        ];

        if (supportedTypes.some(t => mimeType.startsWith(t.split('/')[0]) || mimeType === t)) {
          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: file.data // base64 encoded
            }
          });
          console.log(`📎 Added ${file.name} (${mimeType}) as inline data`);
        } else {
          console.warn(`⚠️ Skipping unsupported file type: ${file.name} (${mimeType})`);
        }
      } catch (fileError) {
        console.error(`❌ Error adding file ${file.name}:`, fileError.message);
      }
    }

    return parts;
  }

  // buildPrompt method removed - now using buildMultimodalParts instead

  /**
   * Parse Gemini's response
   */
  parseResponse(responseText) {
    try {
      // Remove any markdown code blocks if present
      let jsonText = responseText.trim();
      jsonText = jsonText.replace(/^```json?\n?/i, '').replace(/\n?```$/,'');
      
      // Parse JSON
      const response = JSON.parse(jsonText);
      
      // Validate required fields
      if (!response.status) {
        response.status = 'Partially Compliant';
      }
      if (typeof response.score !== 'number') {
        response.score = 70;
      }
      if (!response.complianceLevel) {
        response.complianceLevel = 'medium';
      }

      // Add metadata
      response.timestamp = new Date().toISOString();
      response.aiModel = this.currentModelName || 'gemini-2.0-flash-exp';

      return response;
    } catch (error) {
      console.error('Failed to parse response JSON:', error.message);
      console.log('Raw response:', responseText);
      
      // Return fallback response
      return {
        status: 'Partially Compliant',
        compliance_status: 'Partially Compliant',
        effectiveness: 'Partially Effective',
        score: 70,
        complianceLevel: 'medium',
        strengths: ['Evidence submitted for review'],
        weaknesses: ['Unable to complete full AI analysis'],
        recommendations: ['Manual review recommended'],
        evidenceQuality: 'Adequate',
        summary: 'Automated evaluation could not be completed. Manual review is recommended.',
        detailedAnalysis: responseText,
        riskAssessment: 'medium',
        nextSteps: ['Conduct manual review', 'Request additional evidence if needed'],
        timestamp: new Date().toISOString(),
        aiModel: this.currentModelName || 'gemini-2.0-flash-exp',
        parseError: true
      };
    }
  }

  /**
   * Process multiple chats in batch
   */
  async chatBatch(items) {
    if (!this.model) {
      throw new Error('Gemini AI not initialized');
    }

    const results = [];
    
    for (const item of items) {
      try {
        const response = await this.chat(item.context, item.files || []);
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

  /**
   * Check if Gemini is available
   */
  isAvailable() {
    return this.model !== null;
  }
}

// Singleton instance
const geminiChatService = new GeminiChatService();

module.exports = geminiChatService;
