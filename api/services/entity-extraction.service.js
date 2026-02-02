/**
 * Entity Extraction Service
 * Uses Google's Gemini AI to extract entities from files and text
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class EntityExtractionService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.currentModelName = 'gemini-2.0-flash-exp';
    this.initializeGemini();
  }

  /**
   * Initialize Gemini AI with API key
   * Uses same configuration as Chat API
   */
  initializeGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️  GEMINI_API_KEY not found - Entity Extraction service unavailable');
      return;
    }

    // Same model list as Chat API
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
          console.log(`✅ Entity Extraction service initialized with ${modelName}`);
          break;
        } catch (modelError) {
          console.warn(`⚠️  Model ${modelName} not available: ${modelError.message}`);
        }
      }
      
      if (!this.model) {
        throw new Error('No Gemini models available');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Entity Extraction service:', error.message);
    }
  }

  /**
   * Extract entities from files and/or text
   * @param {string} context - Additional context or custom extraction prompt
   * @param {Array} files - Array of files to extract entities from
   * @param {Object} options - Extraction options
   */
  async extractEntities(context, files = [], options = {}) {
    if (!this.model) {
      throw new Error('Entity Extraction service not initialized. Please set GEMINI_API_KEY');
    }

    try {
      console.log('🔍 Starting entity extraction...');
      console.log(`📄 Context length: ${context?.length || 0} characters`);
      console.log(`📎 Files: ${files.length}`);
      
      const parts = this.buildExtractionParts(context, files, options);
      
      console.log(`📦 Sending ${parts.length} parts to Gemini for extraction`);
      
      const result = await this.model.generateContent(parts);
      const response = await result.response;
      const aiResponse = response.text();

      console.log('✅ Entity extraction completed');
      
      return this.parseExtractionResponse(aiResponse);
    } catch (error) {
      console.error('❌ Entity extraction error:', error.message);
      throw new Error(`Entity extraction failed: ${error.message}`);
    }
  }

  /**
   * Default extraction prompt - built into the codebase
   */
  getDefaultPrompt() {
    return `You are an expert entity extraction system specializing in compliance, governance, risk, and regulatory documents.

**YOUR TASK:**
Extract ALL relevant entities from the provided documents. Focus on:
1. People and their roles/titles
2. Organizations, departments, and teams
3. Policies, procedures, and standards
4. Controls, requirements, and regulations
5. Dates, deadlines, and time periods
6. Locations and jurisdictions
7. Systems, applications, and technologies
8. Risks, threats, and vulnerabilities
9. Compliance frameworks (ISO, NIST, SOC, GDPR, etc.)
10. Legal references and contractual terms

**EXTRACTION GUIDELINES:**
- Extract EVERY entity found, not just a sample
- Include the exact text as it appears in the document
- Provide confidence scores based on clarity and context
- Identify relationships between entities when evident
- Note the source file for each entity
- Group similar/duplicate entities together`;
  }

  /**
   * Build multimodal parts for entity extraction
   */
  buildExtractionParts(context, files = [], options = {}) {
    const parts = [];
    
    const textFiles = files.filter(f => f.encoding === 'text');
    const binaryFiles = files.filter(f => f.encoding === 'base64');

    // Entity types to extract (can be customized via options)
    const entityTypes = options.entityTypes || [
      'PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'TIME', 
      'MONEY', 'PERCENT', 'EMAIL', 'PHONE', 'URL',
      'PRODUCT', 'EVENT', 'LAW', 'REGULATION', 'STANDARD',
      'CONTROL', 'RISK', 'POLICY', 'PROCEDURE', 'REQUIREMENT'
    ];

    // Use built-in prompt, with optional context override
    const extractionInstructions = context || this.getDefaultPrompt();

    let textPrompt = `You are an expert entity extraction system. Your task is to extract all relevant entities from the provided documents and text.

**EXTRACTION INSTRUCTIONS:**
${extractionInstructions}

**ENTITY TYPES TO EXTRACT:**
${entityTypes.join(', ')}

`;

    // Add text files content
    if (textFiles.length > 0) {
      textPrompt += `\n**TEXT CONTENT (${textFiles.length} file(s)):**\n`;
      textFiles.forEach((file, idx) => {
        textPrompt += `\n--- File ${idx + 1}: ${file.name} ---\n`;
        textPrompt += `${file.data.substring(0, 20000)}${file.data.length > 20000 ? '\n...[content truncated]' : ''}\n`;
      });
    }

    // Note about binary files
    if (binaryFiles.length > 0) {
      textPrompt += `\n**ATTACHED DOCUMENTS (${binaryFiles.length} file(s)):**\n`;
      textPrompt += `The following documents are attached for entity extraction:\n`;
      binaryFiles.forEach((file, idx) => {
        textPrompt += `${idx + 1}. ${file.name} (${file.mimeType})\n`;
      });
      textPrompt += `\n**CRITICAL:** Read and extract entities from ALL attached documents.\n`;
    }

    textPrompt += `
**OUTPUT FORMAT:**
Return a JSON object with this exact structure:

{
  "entities": [
    {
      "text": "The exact text of the entity",
      "type": "ENTITY_TYPE",
      "category": "primary category",
      "confidence": 0.95,
      "context": "Brief surrounding context where found",
      "source": "filename or 'text input'",
      "metadata": {}
    }
  ],
  "summary": {
    "totalEntities": <number>,
    "byType": {
      "PERSON": <count>,
      "ORGANIZATION": <count>,
      ...
    },
    "bySource": {
      "filename1.pdf": <count>,
      ...
    }
  },
  "relationships": [
    {
      "entity1": "Entity text 1",
      "relation": "relationship type",
      "entity2": "Entity text 2",
      "confidence": 0.85
    }
  ],
  "keyFindings": [
    "Important finding 1",
    "Important finding 2"
  ],
  "documentSummary": "Brief summary of what the documents contain"
}

**IMPORTANT GUIDELINES:**
1. Extract ALL entities, not just a sample
2. Include confidence scores (0.0 to 1.0)
3. Identify relationships between entities when possible
4. Group similar entities and note duplicates
5. For compliance documents, pay special attention to: controls, requirements, policies, standards, regulations
6. Return ONLY valid JSON, no markdown code blocks`;

    parts.push({ text: textPrompt });

    // Add binary files
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
          console.log(`📎 Added ${file.name} (${mimeType}) for extraction`);
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
   * Parse the extraction response
   */
  parseExtractionResponse(responseText) {
    try {
      let jsonText = responseText.trim();
      jsonText = jsonText.replace(/^```json?\n?/i, '').replace(/\n?```$/, '');
      
      const response = JSON.parse(jsonText);
      
      // Ensure required fields
      if (!response.entities) {
        response.entities = [];
      }
      if (!response.summary) {
        response.summary = {
          totalEntities: response.entities.length,
          byType: {},
          bySource: {}
        };
      }
      if (!response.relationships) {
        response.relationships = [];
      }
      if (!response.keyFindings) {
        response.keyFindings = [];
      }

      // Add metadata
      response.timestamp = new Date().toISOString();
      response.aiModel = this.currentModelName;
      response.success = true;

      return response;
    } catch (error) {
      console.error('Failed to parse extraction response:', error.message);
      console.log('Raw response:', responseText.substring(0, 500));
      
      return {
        success: false,
        entities: [],
        summary: { totalEntities: 0, byType: {}, bySource: {} },
        relationships: [],
        keyFindings: [],
        documentSummary: 'Failed to parse extraction results',
        rawResponse: responseText,
        timestamp: new Date().toISOString(),
        aiModel: this.currentModelName,
        parseError: error.message
      };
    }
  }

  /**
   * Extract specific entity types only
   */
  async extractSpecificEntities(context, files = [], entityTypes = []) {
    return this.extractEntities(context, files, { entityTypes });
  }

  /**
   * Batch extraction from multiple file sets
   */
  async extractBatch(items) {
    if (!this.model) {
      throw new Error('Entity Extraction service not initialized');
    }

    const results = [];
    
    for (const item of items) {
      try {
        const response = await this.extractEntities(
          item.context, 
          item.files || [], 
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

  /**
   * Check if service is available
   */
  isAvailable() {
    return this.model !== null;
  }
}

// Singleton instance
const entityExtractionService = new EntityExtractionService();

module.exports = entityExtractionService;
