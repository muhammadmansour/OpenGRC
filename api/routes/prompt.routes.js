/**
 * Prompt Routes
 * CRUD API for managing AI prompt templates
 */

const express = require('express');
const router = express.Router();
const promptService = require('../services/prompt.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * GET /api/prompts
 * List all prompts
 */
router.get('/', asyncHandler(async (req, res) => {
  const prompts = await promptService.getAll();

  res.json({
    success: true,
    data: prompts,
    count: prompts.length
  });
}));

/**
 * GET /api/prompts/:id
 * Get a prompt by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const prompt = await promptService.getById(req.params.id);

  if (!prompt) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Prompt not found'
    });
  }

  res.json({ success: true, data: prompt });
}));

/**
 * POST /api/prompts
 * Create a new prompt
 */
router.post('/', asyncHandler(async (req, res) => {
  const { key, name, description, content } = req.body;

  if (!key || !name || !content) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Required fields: key, name, content'
    });
  }

  const prompt = await promptService.create(req.body);

  res.status(201).json({ success: true, data: prompt });
}));

/**
 * PUT /api/prompts/:id
 * Update a prompt
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const prompt = await promptService.update(req.params.id, req.body);

  if (!prompt) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Prompt not found'
    });
  }

  res.json({ success: true, data: prompt });
}));

/**
 * DELETE /api/prompts/:id
 * Delete a prompt
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await promptService.delete(req.params.id);

  if (!deleted) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Prompt not found'
    });
  }

  res.json({ success: true, message: 'Prompt deleted' });
}));

/**
 * POST /api/prompts/cache/clear
 * Clear the prompt cache (forces reload from DB)
 */
router.post('/cache/clear', asyncHandler(async (req, res) => {
  promptService.clearCache();

  res.json({ success: true, message: 'Prompt cache cleared' });
}));

module.exports = router;
