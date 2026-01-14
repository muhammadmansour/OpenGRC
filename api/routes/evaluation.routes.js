/**
 * Evaluation Routes
 * Handles AI-powered audit item evaluation endpoints
 */

const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini-evaluation.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * POST /api/evaluations/audit-item
 * Evaluate a single audit item with evidence files
 */
router.post('/audit-item', asyncHandler(async (req, res) => {
  const { 
    title, 
    code, 
    description, 
    discussion, 
    applicability, 
    files,
    // Backward compatibility with old format
    fileNames, 
    fileContents 
  } = req.body;

  // Validation
  if (!title || !code) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'title and code are required fields'
    });
  }

  // Check if Gemini is available
  if (!geminiService.isAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'AI evaluation service is not configured. Please set GEMINI_API_KEY in environment variables'
    });
  }

  console.log(`📝 Evaluating audit item: ${code} - ${title}`);
  console.log(`📎 Files received: ${(files || []).length}`);
  
  if (files && files.length > 0) {
    files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.name} (${file.mimeType}) [${file.encoding}]`);
    });
  }

  // Prepare item data
  const itemData = {
    title,
    code,
    description,
    discussion,
    applicability,
    files: files || [] // New format with file objects {name, mimeType, data, encoding}
  };

  try {
    // Get AI evaluation with files
    const evaluation = await geminiService.evaluateAuditItemWithFiles(itemData);

    res.status(200).json({
      success: true,
      evaluation,
      metadata: {
        itemCode: code,
        itemTitle: title,
        evaluatedAt: new Date().toISOString(),
        filesAnalyzed: (files || []).length
      }
    });
  } catch (error) {
    console.error('❌ Evaluation error:', error);
    res.status(500).json({
      error: 'Evaluation Failed',
      message: error.message,
      details: 'The AI evaluation service encountered an error. Please try again or contact support.'
    });
  }
}));

/**
 * POST /api/evaluations/batch
 * Evaluate multiple audit items in batch
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
      message: 'AI evaluation service is not configured'
    });
  }

  console.log(`📝 Batch evaluating ${items.length} audit items`);

  const results = await geminiService.evaluateBatch(items);

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
 * POST /api/evaluations/recommendations
 * Generate strategic recommendations based on evaluation history
 */
router.post('/recommendations', asyncHandler(async (req, res) => {
  const { evaluationHistory } = req.body;

  if (!evaluationHistory || !Array.isArray(evaluationHistory)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'evaluationHistory array is required'
    });
  }

  if (!geminiService.isAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'AI evaluation service is not configured'
    });
  }

  const recommendations = await geminiService.generateRecommendations(evaluationHistory);

  res.status(200).json({
    success: true,
    recommendations,
    generatedAt: new Date().toISOString()
  });
}));

/**
 * GET /api/evaluations/status
 * Check if evaluation service is available
 */
router.get('/status', asyncHandler(async (req, res) => {
  const isAvailable = geminiService.isAvailable();
  
  res.json({
    available: isAvailable,
    service: 'Gemini AI Evaluation',
    model: isAvailable ? 'gemini-1.5-flash' : null,
    status: isAvailable ? 'ready' : 'not configured',
    message: isAvailable 
      ? 'AI evaluation service is ready' 
      : 'GEMINI_API_KEY environment variable not set'
  });
}));

/**
 * POST /api/evaluations/quick-analysis
 * Quick analysis without full evaluation (for preview)
 */
router.post('/quick-analysis', asyncHandler(async (req, res) => {
  const { title, description, fileCount } = req.body;

  if (!title) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'title is required'
    });
  }

  // Provide quick heuristic analysis without calling Gemini
  const hasDescription = description && description.length > 50;
  const hasFiles = fileCount && fileCount > 0;

  let quickScore = 50;
  const issues = [];
  const suggestions = [];

  if (hasDescription) {
    quickScore += 20;
    suggestions.push('Good: Detailed description provided');
  } else {
    issues.push('Missing or insufficient description');
    suggestions.push('Add more detailed description');
  }

  if (hasFiles) {
    quickScore += 20;
    suggestions.push(`Good: ${fileCount} evidence file(s) submitted`);
  } else {
    issues.push('No evidence files submitted');
    suggestions.push('Upload supporting evidence documents');
  }

  const readinessLevel = quickScore >= 70 ? 'Ready' : quickScore >= 50 ? 'Needs Improvement' : 'Not Ready';

  res.json({
    success: true,
    quickAnalysis: {
      readinessScore: quickScore,
      readinessLevel,
      issues,
      suggestions,
      canProceedWithFullEvaluation: quickScore >= 50
    }
  });
}));

module.exports = router;
