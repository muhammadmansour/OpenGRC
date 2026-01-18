/**
 * Standards Routes
 * Handles audit standards and criteria endpoints
 */

const express = require('express');
const router = express.Router();
const standardsService = require('../services/standards.service');
const { asyncHandler } = require('../middleware/error.middleware');

// =============================================================================
// STANDARD CRITERIA (BUNDLES) ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /api/standards/criteria:
 *   get:
 *     summary: Get all standard criteria (bundles)
 *     tags: [Standards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all standard criteria
 */
router.get('/criteria', asyncHandler(async (req, res) => {
  const criteria = await standardsService.getAllCriteria();
  res.json({
    success: true,
    count: criteria.length,
    data: criteria
  });
}));

/**
 * @swagger
 * /api/standards/criteria/hierarchy:
 *   get:
 *     summary: Get criteria in hierarchical structure (parents with children)
 *     tags: [Standards]
 *     responses:
 *       200:
 *         description: Hierarchical list of criteria
 */
router.get('/criteria/hierarchy', asyncHandler(async (req, res) => {
  const hierarchy = await standardsService.getCriteriaHierarchy();
  res.json({
    success: true,
    count: hierarchy.length,
    data: hierarchy
  });
}));

/**
 * @swagger
 * /api/standards/criteria:
 *   post:
 *     summary: Store standard criteria (bundles)
 *     tags: [Standards]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required:
 *                 - code
 *                 - name
 *               properties:
 *                 code:
 *                   type: string
 *                 name:
 *                   type: string
 *                 authority:
 *                   type: string
 *                 description:
 *                   type: string
 *                 version:
 *                   type: string
 *                 url:
 *                   type: string
 *     responses:
 *       200:
 *         description: Criteria stored successfully
 */
router.post('/criteria', asyncHandler(async (req, res) => {
  const criteria = req.body;

  if (!Array.isArray(criteria)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Request body must be an array of criteria'
    });
  }

  const result = await standardsService.storeCriteria(criteria);
  res.json({
    success: result.success,
    message: `Stored ${result.stored} new criteria, updated ${result.updated} existing`,
    stored: result.stored,
    updated: result.updated,
    errors: result.errors
  });
}));

/**
 * @swagger
 * /api/standards/criteria/{code}:
 *   get:
 *     summary: Get a specific standard criteria by code
 *     tags: [Standards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Standard criteria details
 *       404:
 *         description: Criteria not found
 */
router.get('/criteria/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const criteria = await standardsService.getCriteriaByCode(code);

  if (!criteria) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Standard criteria not found: ${code}`
    });
  }

  res.json({
    success: true,
    data: criteria
  });
}));

/**
 * @swagger
 * /api/standards/criteria/{code}:
 *   delete:
 *     summary: Delete a standard criteria by code
 *     tags: [Standards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Criteria deleted successfully
 *       404:
 *         description: Criteria not found
 */
router.delete('/criteria/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const deleted = await standardsService.deleteCriteria(code);

  if (!deleted) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Standard criteria not found: ${code}`
    });
  }

  res.json({
    success: true,
    message: `Deleted criteria: ${code}`
  });
}));

// =============================================================================
// IMPORT STANDARDS ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /api/standards/import/{code}:
 *   post:
 *     summary: Import a standard from its URL
 *     tags: [Standards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Standard imported successfully
 */
router.post('/import/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const result = await standardsService.importStandardFromUrl(code);
  res.json(result);
}));

/**
 * @swagger
 * /api/standards/imported:
 *   get:
 *     summary: Get all imported standards
 *     tags: [Standards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of imported standards
 */
router.get('/imported', asyncHandler(async (req, res) => {
  const standards = await standardsService.getAllImportedStandards();
  res.json({
    success: true,
    count: standards.length,
    data: standards
  });
}));

/**
 * @swagger
 * /api/standards/imported/{code}:
 *   get:
 *     summary: Get imported standard data by code
 *     tags: [Standards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Imported standard data
 *       404:
 *         description: Standard not found
 */
router.get('/imported/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const standard = await standardsService.getImportedStandard(code);

  if (!standard) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Imported standard not found: ${code}`
    });
  }

  res.json({
    success: true,
    data: standard
  });
}));

// =============================================================================
// EXPERT STANDARDS ENDPOINTS (existing)
// =============================================================================

/**
 * GET /api/standards/expert/:expertId
 * Get standards for a specific expert
 */
router.get('/expert/:expertId', asyncHandler(async (req, res) => {
  const { expertId } = req.params;

  if (!expertId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'expertId is required'
    });
  }

  const standards = await standardsService.getStandardsForExpert(expertId);
  res.json(standards);
}));

/**
 * POST /api/standards/expert/:expertId
 * Save standards for an expert
 */
router.post('/expert/:expertId', asyncHandler(async (req, res) => {
  const { expertId } = req.params;
  const { domainId, categories } = req.body;

  if (!domainId || !categories) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'domainId and categories are required'
    });
  }

  const result = await standardsService.saveStandardsForExpert(
    expertId, 
    domainId, 
    categories
  );

  res.json({ success: result });
}));

module.exports = router;
