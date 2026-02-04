/**
 * Entity Extraction Service
 * Uses the same Gemini Chat Service for AI operations
 */

const geminiChatService = require('./gemini-chat.service');

class EntityExtractionService {
  
  /**
   * Get current model name from chat service
   */
  get currentModelName() {
    return geminiChatService.currentModelName;
  }

  /**
   * Check if service is available (uses chat service)
   */
  isAvailable() {
    return geminiChatService.isAvailable();
  }

  /**
   * Extract entities from files and/or text
   * @param {string} context - Additional context or custom extraction prompt
   * @param {Array} files - Array of files to extract entities from
   * @param {Object} options - Extraction options
   */
  async extractEntities(context, files = [], options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Entity Extraction service not initialized. Please set GEMINI_API_KEY');
    }

    try {
      console.log('🔍 Starting entity extraction...');
      console.log(`📄 Context length: ${context?.length || 0} characters`);
      console.log(`📎 Files: ${files.length}`);
      
      // Build the extraction prompt
      const extractionPrompt = this.buildExtractionPrompt(context, files, options);
      
      // Log the exact prompt being sent to Gemini
      console.log('\n' + '='.repeat(80));
      console.log('🤖 EXACT PROMPT SENT TO GEMINI (extractEntities):');
      console.log('='.repeat(80));
      console.log(extractionPrompt);
      console.log('='.repeat(80) + '\n');
      
      console.log(`📦 Sending request to Gemini for extraction`);
      
      // Use the chat service's model directly
      const parts = this.buildMultimodalParts(extractionPrompt, files);
      const result = await geminiChatService.model.generateContent(parts);
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
   * Build the extraction prompt
   */
  buildExtractionPrompt(context, files = [], options = {}) {
    const entityTypes = options.entityTypes || [
      'PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'TIME', 
      'MONEY', 'PERCENT', 'EMAIL', 'PHONE', 'URL',
      'PRODUCT', 'EVENT', 'LAW', 'REGULATION', 'STANDARD',
      'CONTROL', 'RISK', 'POLICY', 'PROCEDURE', 'REQUIREMENT'
    ];

    const extractionInstructions = context || this.getDefaultPrompt();

    let prompt = `You are an expert entity extraction system. Your task is to extract all relevant entities from the provided documents and text.

**EXTRACTION INSTRUCTIONS:**
${extractionInstructions}

**ENTITY TYPES TO EXTRACT:**
${entityTypes.join(', ')}

`;

    // Add file info
    if (files.length > 0) {
      prompt += `\n**DOCUMENTS TO ANALYZE (${files.length} file(s)):**\n`;
      files.forEach((file, idx) => {
        prompt += `${idx + 1}. ${file.name} (${file.mimeType})\n`;
      });
      prompt += `\n**CRITICAL:** Read and extract entities from ALL attached documents.\n`;
    }

    prompt += `
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
      "ORGANIZATION": <count>
    },
    "bySource": {
      "filename1.pdf": <count>
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
        text: `\n--- Content of ${file.name} ---\n${file.data.substring(0, 20000)}${file.data.length > 20000 ? '\n...[truncated]' : ''}\n` 
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
    if (!this.isAvailable()) {
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
}

// Singleton instance
const entityExtractionService = new EntityExtractionService();

module.exports = entityExtractionService;
