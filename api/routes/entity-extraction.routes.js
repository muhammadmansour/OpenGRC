/**
 * Entity Extraction Routes
 * Handles AI-powered entity extraction from files and text
 */

const express = require('express');
const router = express.Router();
const entityExtractionService = require('../services/entity-extraction.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * @swagger
 * tags:
 *   name: Entity Extraction
 *   description: AI-powered entity extraction endpoints
 */

/**
 * @swagger
 * /api/entity-extraction/extract:
 *   post:
 *     summary: Extract entities from files
 *     description: Uses AI to extract named entities, relationships, and key information from documents. The extraction prompt is built into the API.
 *     tags: [Entity Extraction]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               files:
 *                 type: array
 *                 description: Array of files to extract entities from
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - mimeType
 *                     - encoding
 *                     - data
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "policy-document.pdf"
 *                     mimeType:
 *                       type: string
 *                       example: "application/pdf"
 *                     encoding:
 *                       type: string
 *                       enum: [base64, text]
 *                       example: "base64"
 *                     data:
 *                       type: string
 *                       description: File content (base64 encoded or plain text)
 *               options:
 *                 type: object
 *                 properties:
 *                   entityTypes:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Specific entity types to extract (optional)
 *                     example: ["PERSON", "ORGANIZATION", "CONTROL", "POLICY"]
 *     responses:
 *       200:
 *         description: Entities extracted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 entities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       text:
 *                         type: string
 *                       type:
 *                         type: string
 *                       confidence:
 *                         type: number
 *                 summary:
 *                   type: object
 *                 relationships:
 *                   type: array
 *                 keyFindings:
 *                   type: array
 *       400:
 *         description: Validation error - files required
 *       503:
 *         description: Service unavailable
 */
router.post('/extract', asyncHandler(async (req, res) => {
  const { files = [], options = {} } = req.body;

  // Check if service is available
  if (!entityExtractionService.isAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Entity extraction service is not configured. Please set GEMINI_API_KEY'
    });
  }

  // Validation - files are required
  if (!files || files.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'files array is required and must contain at least one file'
    });
  }

  // Validate each file has required fields
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.name || !file.mimeType || !file.encoding || !file.data) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `File at index ${i} is missing required fields (name, mimeType, encoding, data)`
      });
    }
  }

  console.log(`🔍 Entity extraction request received`);
  console.log(`   Files: ${files.length}`);
  
  files.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file.name} (${file.mimeType}) [${file.encoding}]`);
  });

  try {
    // Use built-in prompt (null context uses default prompt in service)
    const result = await entityExtractionService.extractEntities(null, files, options);

    res.status(200).json({
      success: true,
      ...result,
      metadata: {
        timestamp: new Date().toISOString(),
        filesProcessed: files.length,
        model: entityExtractionService.currentModelName
      }
    });
  } catch (error) {
    console.error('❌ Entity extraction error:', error);
    res.status(500).json({
      error: 'Extraction Failed',
      message: error.message,
      details: 'The entity extraction service encountered an error. Please try again.'
    });
  }
}));

/**
 * @swagger
 * /api/entity-extraction/batch:
 *   post:
 *     summary: Batch entity extraction
 *     description: Extract entities from multiple file sets in one request
 *     tags: [Entity Extraction]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     context:
 *                       type: string
 *                     files:
 *                       type: array
 *                     options:
 *                       type: object
 *     responses:
 *       200:
 *         description: Batch extraction results
 */
router.post('/batch', asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'items array is required and cannot be empty'
    });
  }

  if (!entityExtractionService.isAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Entity extraction service is not configured'
    });
  }

  console.log(`🔍 Batch extraction: ${items.length} items`);

  const results = await entityExtractionService.extractBatch(items);

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  res.status(200).json({
    success: true,
    summary: {
      total: items.length,
      successful: successCount,
      failed: failureCount
    },
    results
  });
}));

/**
 * @swagger
 * /api/entity-extraction/specific:
 *   post:
 *     summary: Extract specific entity types
 *     description: Extract only specified entity types from documents
 *     tags: [Entity Extraction]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entityTypes
 *             properties:
 *               context:
 *                 type: string
 *               files:
 *                 type: array
 *               entityTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["PERSON", "ORGANIZATION", "DATE"]
 *     responses:
 *       200:
 *         description: Specific entities extracted
 */
router.post('/specific', asyncHandler(async (req, res) => {
  const { context, files = [], entityTypes } = req.body;

  if (!entityTypes || !Array.isArray(entityTypes) || entityTypes.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'entityTypes array is required'
    });
  }

  if (!context && files.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Either context or files must be provided'
    });
  }

  if (!entityExtractionService.isAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Entity extraction service is not configured'
    });
  }

  console.log(`🔍 Specific entity extraction: ${entityTypes.join(', ')}`);

  try {
    const result = await entityExtractionService.extractSpecificEntities(
      context, 
      files, 
      entityTypes
    );

    res.status(200).json({
      success: true,
      requestedTypes: entityTypes,
      ...result
    });
  } catch (error) {
    console.error('❌ Specific extraction error:', error);
    res.status(500).json({
      error: 'Extraction Failed',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/entity-extraction/status:
 *   get:
 *     summary: Check entity extraction service status
 *     description: Verify if the entity extraction service is available
 *     tags: [Entity Extraction]
 *     responses:
 *       200:
 *         description: Service status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const isAvailable = entityExtractionService.isAvailable();
  
  res.json({
    available: isAvailable,
    service: 'Entity Extraction (Gemini AI)',
    model: isAvailable ? entityExtractionService.currentModelName : null,
    status: isAvailable ? 'ready' : 'not configured',
    message: isAvailable 
      ? 'Entity extraction service is ready' 
      : 'GEMINI_API_KEY environment variable not set',
    supportedEntityTypes: [
      'PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'TIME',
      'MONEY', 'PERCENT', 'EMAIL', 'PHONE', 'URL',
      'PRODUCT', 'EVENT', 'LAW', 'REGULATION', 'STANDARD',
      'CONTROL', 'RISK', 'POLICY', 'PROCEDURE', 'REQUIREMENT'
    ]
  });
}));

module.exports = router;
