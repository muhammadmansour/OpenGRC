/**
 * Audit Routes
 * Handles AI-powered audit analysis endpoints
 */

const express = require('express');
const router = express.Router();
const auditService = require('../services/audit.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * @swagger
 * tags:
 *   name: Audit
 *   description: AI-powered audit analysis endpoints
 */

/**
 * @swagger
 * /api/audit/analyze:
 *   post:
 *     summary: Analyze evidence against audit questions
 *     description: Uses AI to analyze evidence files against audit questions and typical evidence requirements
 *     tags: [Audit]
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
 *                 description: Array of evidence files to analyze
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
 *                       example: "access-control-policy.pdf"
 *                     mimeType:
 *                       type: string
 *                       example: "application/pdf"
 *                     encoding:
 *                       type: string
 *                       enum: [base64, text]
 *                     data:
 *                       type: string
 *               questions:
 *                 type: array
 *                 description: Audit questions to evaluate
 *                 items:
 *                   type: string
 *                 example: ["Is there a documented access control policy?", "Are access reviews performed regularly?"]
 *               typicalEvidence:
 *                 type: array
 *                 description: Expected/typical evidence for this audit
 *                 items:
 *                   type: string
 *                 example: ["Access Control Policy document", "Access review logs", "User provisioning procedures"]
 *               options:
 *                 type: object
 *                 properties:
 *                   context:
 *                     type: string
 *                     description: Additional context for the audit
 *                     example: "ISO 27001 Access Control audit for Q1 2026"
 *     responses:
 *       200:
 *         description: Audit analysis completed
 *       400:
 *         description: Validation error
 *       503:
 *         description: Service unavailable
 */
router.post('/analyze', asyncHandler(async (req, res) => {
  const { files = [], questions = [], typicalEvidence = [], options = {} } = req.body;

  // Check if service is available
  if (!auditService.isAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Audit service is not configured. Please set GEMINI_API_KEY'
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

  console.log(`📋 Audit analysis request received`);
  console.log(`   Files: ${files.length}`);
  console.log(`   Questions: ${questions.length}`);
  console.log(`   Typical Evidence: ${typicalEvidence.length}`);
  
  files.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file.name} (${file.mimeType}) [${file.encoding}]`);
  });

  try {
    const result = await auditService.analyze(files, questions, typicalEvidence, options);

    res.status(200).json({
      success: true,
      ...result,
      metadata: {
        timestamp: new Date().toISOString(),
        filesProcessed: files.length,
        questionsEvaluated: questions.length,
        typicalEvidenceChecked: typicalEvidence.length,
        model: auditService.currentModelName
      }
    });
  } catch (error) {
    console.error('❌ Audit analysis error:', error);
    res.status(500).json({
      error: 'Audit Failed',
      message: error.message,
      details: 'The audit service encountered an error. Please try again.'
    });
  }
}));

/**
 * @swagger
 * /api/audit/batch:
 *   post:
 *     summary: Batch audit analysis
 *     description: Analyze multiple audit items in one request
 *     tags: [Audit]
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
 *                     files:
 *                       type: array
 *                     questions:
 *                       type: array
 *                     typicalEvidence:
 *                       type: array
 *                     options:
 *                       type: object
 *     responses:
 *       200:
 *         description: Batch audit results
 */
router.post('/batch', asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'items array is required and cannot be empty'
    });
  }

  if (!auditService.isAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Audit service is not configured'
    });
  }

  console.log(`📋 Batch audit: ${items.length} items`);

  const results = await auditService.analyzeBatch(items);

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
 * /api/audit/status:
 *   get:
 *     summary: Check audit service status
 *     description: Verify if the audit service is available
 *     tags: [Audit]
 *     responses:
 *       200:
 *         description: Service status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const isAvailable = auditService.isAvailable();
  
  res.json({
    available: isAvailable,
    service: 'Audit Analysis (Gemini AI)',
    model: isAvailable ? auditService.currentModelName : null,
    status: isAvailable ? 'ready' : 'not configured',
    message: isAvailable 
      ? 'Audit service is ready' 
      : 'GEMINI_API_KEY environment variable not set'
  });
}));

module.exports = router;
