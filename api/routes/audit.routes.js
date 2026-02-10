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
 *     summary: Analyze evidence against applied control requirements
 *     description: |
 *       Uses Gemini AI to analyze evidence files against compliance requirements.
 *       Supports two modes:
 *       - **Gemini File Search**: Reference pre-uploaded files via gemini_file_search.file_ids
 *       - **Inline files**: Send base64/text files directly (legacy)
 *     tags: [Audit]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               applied_control:
 *                 type: object
 *                 description: The control being evaluated
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   ref_id:
 *                     type: string
 *                     example: "AC-1"
 *                   name:
 *                     type: string
 *                     example: "Access Control Policy"
 *                   description:
 *                     type: string
 *                   status:
 *                     type: string
 *                     example: "active"
 *                   category:
 *                     type: string
 *                     example: "policy"
 *                   csf_function:
 *                     type: string
 *                     example: "protect"
 *               gemini_file_search:
 *                 type: object
 *                 description: Gemini file references for pre-uploaded evidence files
 *                 properties:
 *                   file_ids:
 *                     type: array
 *                     description: Gemini file IDs (e.g. "files/abc123")
 *                     items:
 *                       type: string
 *                   store_id:
 *                     type: string
 *                     description: Gemini file search store ID
 *                   evidences:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         gemini_file_id:
 *                           type: string
 *                         gemini_store_id:
 *                           type: string
 *                         evidence_name:
 *                           type: string
 *                         evidence_description:
 *                           type: string
 *               requirements:
 *                 type: array
 *                 description: Compliance requirements to check against
 *                 items:
 *                   type: object
 *                   properties:
 *                     ref_id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     framework:
 *                       type: string
 *                     provider:
 *                       type: string
 *               questions:
 *                 type: array
 *                 description: Audit questions to evaluate
 *                 items:
 *                   type: string
 *               typical_evidence:
 *                 type: array
 *                 description: Expected/typical evidence descriptions
 *                 items:
 *                   type: string
 *               analysis_config:
 *                 type: object
 *                 description: Toggle analysis sections on/off
 *                 properties:
 *                   include_entity_extraction:
 *                     type: boolean
 *                     default: true
 *                   include_compliance_check:
 *                     type: boolean
 *                     default: true
 *                   include_gap_analysis:
 *                     type: boolean
 *                     default: true
 *                   include_recommendations:
 *                     type: boolean
 *                     default: true
 *               files:
 *                 type: array
 *                 description: "Legacy: inline file uploads (base64/text)"
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     mimeType:
 *                       type: string
 *                     encoding:
 *                       type: string
 *                       enum: [base64, text]
 *                     data:
 *                       type: string
 *     responses:
 *       200:
 *         description: Audit analysis completed
 *       400:
 *         description: Validation error
 *       503:
 *         description: Service unavailable
 */
router.post('/analyze', asyncHandler(async (req, res) => {
  const {
    applied_control = {},
    gemini_file_search = {},
    requirements = [],
    questions = [],
    typical_evidence = [],
    analysis_config = {},
    // Legacy support
    files = [],
    typicalEvidence = [],
    options = {}
  } = req.body;

  // Check if service is available
  if (!auditService.isAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Audit service is not configured. Please set GEMINI_API_KEY'
    });
  }

  // Determine file source
  const hasGeminiFiles = (gemini_file_search.file_ids && gemini_file_search.file_ids.length > 0);
  const hasInlineFiles = (files && files.length > 0);

  // Validation - need at least some evidence or context
  if (!hasGeminiFiles && !hasInlineFiles && requirements.length === 0 && questions.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Request must include at least one of: gemini_file_search.file_ids, files, requirements, or questions'
    });
  }

  // Validate inline files if provided (legacy)
  if (hasInlineFiles) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name || !file.mimeType || !file.encoding || !file.data) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `File at index ${i} is missing required fields (name, mimeType, encoding, data)`
        });
      }
    }
  }

  const fileIds = gemini_file_search.file_ids || [];
  const evidences = gemini_file_search.evidences || [];
  // Merge typical_evidence with legacy typicalEvidence
  const mergedTypicalEvidence = typical_evidence.length > 0 ? typical_evidence : typicalEvidence;

  console.log(`📋 Audit analysis request received`);
  console.log(`   Applied Control: ${applied_control.ref_id || 'N/A'} - ${applied_control.name || 'N/A'}`);
  console.log(`   Gemini File IDs: ${fileIds.length}`);
  console.log(`   Evidence entries: ${evidences.length}`);
  console.log(`   Requirements: ${requirements.length}`);
  console.log(`   Questions: ${questions.length}`);
  console.log(`   Typical Evidence: ${mergedTypicalEvidence.length}`);
  console.log(`   Inline files: ${files.length}`);

  try {
    const result = await auditService.analyze({
      applied_control,
      gemini_file_search,
      requirements,
      questions,
      typical_evidence: mergedTypicalEvidence,
      analysis_config,
      files,
      options
    });

    res.status(200).json(result);
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
 *     description: Analyze multiple audit items in one request. Each item uses the same body format as /analyze.
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
 *                     applied_control:
 *                       type: object
 *                     gemini_file_search:
 *                       type: object
 *                     requirements:
 *                       type: array
 *                     questions:
 *                       type: array
 *                     typical_evidence:
 *                       type: array
 *                     analysis_config:
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
      : 'GEMINI_API_KEY environment variable not set',
    supportedModes: {
      gemini_file_search: 'Reference pre-uploaded files via file_ids',
      inline_files: 'Send base64/text files directly (legacy)'
    }
  });
}));

module.exports = router;
