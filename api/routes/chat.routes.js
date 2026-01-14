/**
 * Chat Routes
 * Handles AI-powered chat and analysis endpoints
 */

const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini-chat.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * POST /api/chat
 * General AI chat endpoint - accepts context and files
 */
router.post('/', asyncHandler(async (req, res) => {
  const { context, files = [] } = req.body;

  // Validation
  if (!context) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'context is required'
    });
  }

  // Check if Gemini is available
  if (!geminiService.isAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'AI chat service is not configured. Please set GEMINI_API_KEY in environment variables'
    });
  }

  console.log(`💬 Starting AI analysis...`);
  console.log(`📄 Context length: ${context.length} characters`);
  console.log(`📎 Files received: ${files.length}`);
  
  if (files.length > 0) {
    files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.name} (${file.mimeType}) [${file.encoding}]`);
    });
  }

  try {
    // Get AI response
    const response = await geminiService.chat(context, files);

    res.status(200).json({
      success: true,
      response,
      metadata: {
        timestamp: new Date().toISOString(),
        contextLength: context.length,
        filesAnalyzed: files.length
      }
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({
      error: 'Chat Failed',
      message: error.message,
      details: 'The AI chat service encountered an error. Please try again or contact support.'
    });
  }
}));

/**
 * POST /api/chat/batch
 * Batch processing multiple contexts
 */
router.post('/batch', asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'items array is required and cannot be empty'
    });
  }

  if (!geminiService.isAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'AI chat service is not configured'
    });
  }

  console.log(`💬 Batch processing ${items.length} items`);

  const results = await geminiService.chatBatch(items);

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
 * GET /api/chat/status
 * Check if chat service is available
 */
router.get('/status', asyncHandler(async (req, res) => {
  const isAvailable = geminiService.isAvailable();
  
  res.json({
    available: isAvailable,
    service: 'Gemini AI Chat',
    model: isAvailable ? geminiService.currentModelName : null,
    status: isAvailable ? 'ready' : 'not configured',
    message: isAvailable 
      ? 'AI chat service is ready' 
      : 'GEMINI_API_KEY environment variable not set'
  });
}));

module.exports = router;
