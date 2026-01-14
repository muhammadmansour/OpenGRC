/**
 * Submission Routes
 * Handles audit submissions endpoints
 */

const express = require('express');
const router = express.Router();
const submissionService = require('../services/submission.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * POST /api/submissions
 * Create new submission
 */
router.post('/', asyncHandler(async (req, res) => {
  const { criteriaId, fileIds, ministryId, ministryName, subCriteriaId } = req.body;

  if (!criteriaId || !fileIds || !Array.isArray(fileIds)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'criteriaId and fileIds (array) are required'
    });
  }

  const submissionId = await submissionService.createSubmission({
    criteriaId,
    subCriteriaId: subCriteriaId || criteriaId,
    fileIds,
    ministryId,
    ministryName
  });

  res.status(201).json({ id: submissionId });
}));

/**
 * GET /api/submissions
 * Get all submissions
 */
router.get('/', asyncHandler(async (req, res) => {
  const { ministryId, criteriaId, limit } = req.query;

  let submissions;
  
  if (ministryId) {
    submissions = await submissionService.getSubmissionsByMinistry(ministryId);
  } else if (criteriaId) {
    submissions = await submissionService.getSubmissionsByCriteria(criteriaId);
  } else if (limit) {
    submissions = await submissionService.getRecentSubmissions(parseInt(limit));
  } else {
    submissions = await submissionService.getAllSubmissions();
  }

  res.json(submissions);
}));

/**
 * GET /api/submissions/stats
 * Get submission statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await submissionService.getSubmissionStats();
  res.json(stats);
}));

/**
 * GET /api/submissions/:id
 * Get submission by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const submission = await submissionService.getSubmission(id);
  
  if (!submission) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Submission ${id} not found`
    });
  }

  res.json(submission);
}));

/**
 * PUT /api/submissions/:id/status
 * Update submission status
 */
router.put('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['submitted', 'processing', 'completed', 'error'].includes(status)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Valid status is required (submitted, processing, completed, error)'
    });
  }

  await submissionService.updateSubmissionStatus(id, status);
  res.json({ success: true, status });
}));

/**
 * PUT /api/submissions/:id/analysis
 * Update submission with AI analysis result
 */
router.put('/:id/analysis', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { aiAnalysisResult, score, complianceLevel, status } = req.body;

  await submissionService.updateSubmissionAIAnalysis(
    id, 
    aiAnalysisResult, 
    score, 
    complianceLevel, 
    status || 'completed'
  );

  res.json({ success: true });
}));

/**
 * DELETE /api/submissions
 * Clear all submissions (admin only)
 */
router.delete('/', asyncHandler(async (req, res) => {
  await submissionService.clearAllSubmissions();
  res.json({ success: true, message: 'All submissions cleared' });
}));

module.exports = router;
