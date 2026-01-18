/**
 * Standards Routes
 * Handles audit standards and criteria endpoints
 * 
 * NEW STRUCTURE:
 * - criteria table: Parent standards (e.g., 5.4)
 * - sub_criteria table: Children (e.g., 5.4.1, 5.4.2)
 */

const express = require('express');
const router = express.Router();
const standardsService = require('../services/standards.service');
const { asyncHandler } = require('../middleware/error.middleware');

// =============================================================================
// CRITERIA ENDPOINTS (Parent standards like 5.4)
// =============================================================================

/**
 * GET /api/standards/criteria
 * Get all criteria (parent standards)
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
 * GET /api/standards/criteria/hierarchy
 * Get criteria with their sub-criteria (full hierarchy)
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
 * GET /api/standards/criteria/:code
 * Get a single criteria by code
 */
router.get('/criteria/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const criteria = await standardsService.getCriteriaByCode(code);

  if (!criteria) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Criteria not found: ${code}`
    });
  }

  res.json({
    success: true,
    data: criteria
  });
}));

/**
 * POST /api/standards/criteria
 * Create or update a criteria
 * Body: { code, name, authority, description, version }
 */
router.post('/criteria', asyncHandler(async (req, res) => {
  const data = req.body;

  if (!data.code || !data.name) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'code and name are required'
    });
  }

  const result = await standardsService.storeCriteria(data);
  res.json({
    success: true,
    ...result
  });
}));

/**
 * DELETE /api/standards/criteria/:code
 * Delete a criteria (also deletes its sub-criteria)
 */
router.delete('/criteria/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const deleted = await standardsService.deleteCriteria(code);

  if (!deleted) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Criteria not found: ${code}`
    });
  }

  res.json({
    success: true,
    message: `Deleted criteria: ${code} and all its sub-criteria`
  });
}));

// =============================================================================
// SUB-CRITERIA ENDPOINTS (Children like 5.4.1, 5.4.2)
// =============================================================================

/**
 * GET /api/standards/criteria/:code/sub
 * Get all sub-criteria for a parent criteria
 */
router.get('/criteria/:code/sub', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const subCriteria = await standardsService.getSubCriteria(code);
  res.json({
    success: true,
    parent_code: code,
    count: subCriteria.length,
    data: subCriteria
  });
}));

/**
 * POST /api/standards/criteria/:code/sub
 * Create or update a sub-criteria under a parent
 * Body: { code, name, description, requirements_count, documents_count }
 */
router.post('/criteria/:code/sub', asyncHandler(async (req, res) => {
  const parentCode = req.params.code;
  const data = req.body;

  if (!data.code || !data.name) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'code and name are required'
    });
  }

  const result = await standardsService.storeSubCriteria(parentCode, data);
  res.json({
    success: true,
    parent_code: parentCode,
    ...result
  });
}));

/**
 * DELETE /api/standards/sub-criteria/:code
 * Delete a sub-criteria by code
 */
router.delete('/sub-criteria/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const deleted = await standardsService.deleteSubCriteria(code);

  if (!deleted) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Sub-criteria not found: ${code}`
    });
  }

  res.json({
    success: true,
    message: `Deleted sub-criteria: ${code}`
  });
}));

// =============================================================================
// BULK IMPORT ENDPOINT
// =============================================================================

/**
 * POST /api/standards/import
 * Bulk import criteria with sub-criteria
 * Body: [{ code, name, authority, ..., sub_criteria: [{code, name, ...}] }]
 */
router.post('/import', asyncHandler(async (req, res) => {
  const data = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Request body must be an array'
    });
  }

  const result = await standardsService.bulkImport(data);
  res.json({
    success: true,
    message: `Imported ${result.criteria} criteria and ${result.sub_criteria} sub-criteria`,
    ...result
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
