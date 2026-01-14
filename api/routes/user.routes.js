/**
 * User Routes
 * Handles user settings and preferences endpoints
 */

const express = require('express');
const router = express.Router();
const userService = require('../services/user.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * GET /api/users/me/settings
 * Get current user settings
 */
router.get('/me/settings', asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'User ID not found'
    });
  }

  const settings = await userService.getUserSettings(userId);
  res.json(settings || {});
}));

/**
 * PUT /api/users/me/settings
 * Update user settings
 */
router.put('/me/settings', asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'User ID not found'
    });
  }

  const settings = await userService.upsertUserSettings(userId, req.body);
  res.json(settings || {});
}));

/**
 * GET /api/users/me/selected-expert
 * Get user's selected expert
 */
router.get('/me/selected-expert', asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?.id;

  const expertId = await userService.getSelectedExpert(userId);
  res.json({ expertId });
}));

/**
 * PUT /api/users/me/selected-expert
 * Set user's selected expert
 */
router.put('/me/selected-expert', asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?.id;
  const { expertId } = req.body;

  if (!expertId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'expertId is required'
    });
  }

  await userService.saveSelectedExpert(userId, expertId);
  res.json({ success: true, expertId });
}));

/**
 * DELETE /api/users/me/selected-expert
 * Clear user's selected expert
 */
router.delete('/me/selected-expert', asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?.id;

  await userService.clearSelectedExpert(userId);
  res.json({ success: true });
}));

/**
 * GET /api/users/me/preferences/:key
 * Get a specific preference
 */
router.get('/me/preferences/:key', asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?.id;
  const { key } = req.params;
  const { defaultValue } = req.query;

  const value = await userService.getPreference(userId, key, defaultValue);
  res.json({ key, value });
}));

/**
 * PUT /api/users/me/preferences
 * Update preferences
 */
router.put('/me/preferences', asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?.id;

  await userService.updatePreferences(userId, req.body);
  res.json({ success: true });
}));

module.exports = router;
