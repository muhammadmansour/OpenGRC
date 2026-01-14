/**
 * Domain Routes
 * Handles domain references and templates endpoints
 */

const express = require('express');
const router = express.Router();
const domainService = require('../services/domain.service');
const { asyncHandler } = require('../middleware/error.middleware');

// =============================================================================
// DOMAIN REFERENCES
// =============================================================================

/**
 * GET /api/domains/references/:expertId
 * Get all domain references for an expert
 */
router.get('/references/:expertId', asyncHandler(async (req, res) => {
  const { expertId } = req.params;

  const references = await domainService.getAllDomainReferences(expertId);
  res.json(references);
}));

/**
 * GET /api/domains/references/:expertId/:domainId
 * Get specific domain reference
 */
router.get('/references/:expertId/:domainId', asyncHandler(async (req, res) => {
  const { expertId, domainId } = req.params;

  const reference = await domainService.getDomainReference(domainId, expertId);
  
  if (!reference) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Reference not found for expert ${expertId} and domain ${domainId}`
    });
  }

  res.json(reference);
}));

/**
 * POST /api/domains/references
 * Save domain reference
 */
router.post('/references', asyncHandler(async (req, res) => {
  const { domainId, expertId, content, name, referenceId } = req.body;

  if (!domainId || !expertId || !content) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'domainId, expertId, and content are required'
    });
  }

  const reference = await domainService.saveDomainReference(
    domainId, 
    expertId, 
    content, 
    name, 
    referenceId
  );

  res.status(referenceId ? 200 : 201).json(reference);
}));

/**
 * DELETE /api/domains/references/:id
 * Delete domain reference by ID
 */
router.delete('/references/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { expertId } = req.query;

  await domainService.deleteDomainReferenceById(id, expertId);
  res.json({ success: true, message: `Reference ${id} deleted` });
}));

// =============================================================================
// DOMAIN TEMPLATES
// =============================================================================

/**
 * GET /api/domains/templates/:expertId
 * Get all domain templates for an expert
 */
router.get('/templates/:expertId', asyncHandler(async (req, res) => {
  const { expertId } = req.params;

  const templates = await domainService.getAllDomainTemplates(expertId);
  res.json(templates);
}));

/**
 * GET /api/domains/templates/:expertId/:domainId
 * Get specific domain template
 */
router.get('/templates/:expertId/:domainId', asyncHandler(async (req, res) => {
  const { expertId, domainId } = req.params;

  const template = await domainService.getDomainTemplate(domainId, expertId);
  
  if (!template) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Template not found for expert ${expertId} and domain ${domainId}`
    });
  }

  res.json(template);
}));

/**
 * POST /api/domains/templates
 * Save domain template
 */
router.post('/templates', asyncHandler(async (req, res) => {
  const { domainId, expertId, content, name, templateId } = req.body;

  if (!domainId || !expertId || !content) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'domainId, expertId, and content are required'
    });
  }

  const template = await domainService.saveDomainTemplate(
    domainId, 
    expertId, 
    content, 
    name, 
    templateId
  );

  res.status(templateId ? 200 : 201).json(template);
}));

/**
 * DELETE /api/domains/templates/:id
 * Delete domain template by ID
 */
router.delete('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  await domainService.deleteDomainTemplateById(id);
  res.json({ success: true, message: `Template ${id} deleted` });
}));

module.exports = router;
