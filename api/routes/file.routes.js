/**
 * File Routes
 * Handles file upload and management endpoints
 */

const express = require('express');
const router = express.Router();
const fileService = require('../services/file.service');
const { asyncHandler } = require('../middleware/error.middleware');
const config = require('../config');

/**
 * POST /api/files/upload-url
 * Generate a signed URL for file upload
 */
router.post('/upload-url', asyncHandler(async (req, res) => {
  const { fileName, fileSize, contentType, collectionId } = req.body;

  if (!fileName || !fileSize) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'fileName and fileSize are required'
    });
  }

  // Validate file
  const validation = fileService.validateFile(fileName, fileSize);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Validation Error',
      message: validation.error
    });
  }

  const result = await fileService.generateUploadUrl(
    fileName, 
    fileSize, 
    contentType, 
    collectionId || config.defaultCollectionId
  );

  res.json(result);
}));

/**
 * POST /api/files/process
 * Process an uploaded file
 */
router.post('/process', asyncHandler(async (req, res) => {
  const { fileId } = req.body;

  if (!fileId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'fileId is required'
    });
  }

  const result = await fileService.processFile(fileId);
  res.json(result);
}));

/**
 * GET /api/files/:id/status
 * Get file processing status
 */
router.get('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await fileService.getFileStatus(id);
  res.json(result);
}));

/**
 * POST /api/files/:id/wait-ready
 * Wait for file to be ready (long polling)
 */
router.post('/:id/wait-ready', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await fileService.waitForFileReady(id);
  res.json(result);
}));

/**
 * GET /api/files
 * List files by collection
 */
router.get('/', asyncHandler(async (req, res) => {
  const { 
    collectionId, 
    page = 1, 
    pageSize = 100, 
    orderBy = 'updated_at', 
    orderDirection = 'desc' 
  } = req.query;

  const targetCollectionId = collectionId || config.defaultCollectionId;

  const result = await fileService.listFilesByCollectionId(
    targetCollectionId,
    parseInt(page),
    parseInt(pageSize),
    orderBy,
    orderDirection
  );

  res.json(result);
}));

/**
 * GET /api/files/:id
 * Get file info
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await fileService.getFile(id);
  res.json(result);
}));

module.exports = router;
