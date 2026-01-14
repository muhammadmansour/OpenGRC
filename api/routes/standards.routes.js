/**
 * Standards Routes
 * Handles audit standards and criteria endpoints
 */

const express = require('express');
const router = express.Router();
const standardsService = require('../services/standards.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * GET /api/standards/:expertId
 * Get standards for a specific expert
 */
router.get('/:expertId', asyncHandler(async (req, res) => {
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
 * POST /api/standards/:expertId
 * Save standards for an expert
 */
router.post('/:expertId', asyncHandler(async (req, res) => {
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
