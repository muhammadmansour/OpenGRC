/**
 * Library Routes
 * CRUD endpoints for core_storedlibrary table
 */

const express = require('express');
const router = express.Router();
const libraryService = require('../services/library.service');
const { asyncHandler } = require('../middleware/error.middleware');
const { convertToOpenGRC } = require('../utils/opengrc-converter');

// =============================================================================
// GET ENDPOINTS
// =============================================================================

/**
 * GET /api/libraries
 * Get all libraries with optional filters
 * Query params: is_published, is_loaded, locale, provider, urn, builtin, limit, offset
 */
router.get('/', asyncHandler(async (req, res) => {
  const filters = {
    is_published: req.query.is_published !== undefined ? req.query.is_published === 'true' : undefined,
    is_loaded: req.query.is_loaded !== undefined ? req.query.is_loaded === 'true' : undefined,
    locale: req.query.locale,
    provider: req.query.provider,
    urn: req.query.urn,
    builtin: req.query.builtin !== undefined ? req.query.builtin === 'true' : undefined,
    limit: req.query.limit,
    offset: req.query.offset
  };

  // Remove undefined values
  Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

  const libraries = await libraryService.getAllLibraries(filters);
  res.json({
    success: true,
    count: libraries.length,
    data: libraries
  });
}));

/**
 * GET /api/libraries/stats
 * Get library statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await libraryService.getStatistics();
  res.json({
    success: true,
    data: stats
  });
}));

/**
 * GET /api/libraries/search
 * Search libraries by name, description, or URN
 * Query params: q (search term), limit
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit } = req.query;

  if (!q) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Search term (q) is required'
    });
  }

  const libraries = await libraryService.searchLibraries(q, limit ? parseInt(limit) : 20);
  res.json({
    success: true,
    count: libraries.length,
    data: libraries
  });
}));

/**
 * GET /api/libraries/urn/:urn
 * Get library by URN (latest version or specific version/locale)
 * Query params: 
 *   - locale: language locale (default: 'en')
 *   - version: specific version number
 *   - provider: 'ciso' (default, raw DB format) or 'opengrc' (converted format)
 *   - output: 'bundle', 'standard', or 'full' (only when provider=opengrc)
 */
router.get('/urn/:urn', asyncHandler(async (req, res) => {
  const { urn } = req.params;
  const { locale, version, provider, output } = req.query;

  const library = await libraryService.getLibraryByUrn(
    urn,
    locale || 'en',
    version ? parseInt(version) : null
  );

  if (!library) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Library not found: ${urn}`
    });
  }

  // If provider=opengrc, convert to OpenGRC format
  if (provider === 'opengrc') {
    const converted = convertToOpenGRC(library, output || 'full');
    return res.json(converted);
  }

  // Default: provider=ciso or not specified - return raw DB format
  res.json({
    success: true,
    data: library
  });
}));

/**
 * GET /api/libraries/urn/:urn/versions
 * Get all versions of a library by URN
 */
router.get('/urn/:urn/versions', asyncHandler(async (req, res) => {
  const { urn } = req.params;
  const versions = await libraryService.getLibraryVersions(urn);

  res.json({
    success: true,
    urn,
    count: versions.length,
    data: versions
  });
}));

/**
 * GET /api/libraries/:id
 * Get library by ID
 * Query params: 
 *   - provider: 'ciso' (default, raw DB format) or 'opengrc' (converted format)
 *   - output: 'bundle', 'standard', or 'full' (only when provider=opengrc)
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { provider, output } = req.query;
  
  const library = await libraryService.getLibraryById(id);

  if (!library) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Library not found: ${id}`
    });
  }

  // If provider=opengrc, convert to OpenGRC format
  if (provider === 'opengrc') {
    const converted = convertToOpenGRC(library, output || 'full');
    return res.json(converted);
  }

  // Default: provider=ciso or not specified - return raw DB format
  res.json({
    success: true,
    data: library
  });
}));

/**
 * GET /api/libraries/:id/content
 * Get library content only (lighter response)
 */
router.get('/:id/content', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const library = await libraryService.getLibraryContent(id);

  if (!library) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Library not found: ${id}`
    });
  }

  res.json({
    success: true,
    data: library
  });
}));

// =============================================================================
// POST ENDPOINTS
// =============================================================================

/**
 * POST /api/libraries
 * Create a new library
 * Body: { name, content, version, urn?, provider?, description?, ... }
 */
router.post('/', asyncHandler(async (req, res) => {
  const data = req.body;

  // Validate required fields
  if (!data.name) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'name is required'
    });
  }

  if (!data.content) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'content is required'
    });
  }

  if (data.version === undefined || data.version === null) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'version is required'
    });
  }

  const library = await libraryService.createLibrary(data);
  res.status(201).json({
    success: true,
    message: 'Library created successfully',
    data: library
  });
}));

/**
 * POST /api/libraries/:id/duplicate
 * Duplicate a library with a new version
 * Body: { version: newVersionNumber }
 */
router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { version } = req.body;

  if (version === undefined || version === null) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'version is required for duplication'
    });
  }

  const library = await libraryService.duplicateLibrary(id, version);
  res.status(201).json({
    success: true,
    message: 'Library duplicated successfully',
    data: library
  });
}));

// =============================================================================
// PUT/PATCH ENDPOINTS
// =============================================================================

/**
 * PUT /api/libraries/:id
 * Update a library
 * Body: { name?, content?, version?, ... }
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const library = await libraryService.updateLibrary(id, data);

  if (!library) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Library not found: ${id}`
    });
  }

  res.json({
    success: true,
    message: 'Library updated successfully',
    data: library
  });
}));

/**
 * PATCH /api/libraries/:id/publish
 * Publish or unpublish a library
 * Body: { is_published: boolean }
 */
router.patch('/:id/publish', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_published } = req.body;

  if (is_published === undefined) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'is_published is required'
    });
  }

  const library = await libraryService.setPublished(id, is_published);

  if (!library) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Library not found: ${id}`
    });
  }

  res.json({
    success: true,
    message: is_published ? 'Library published' : 'Library unpublished',
    data: library
  });
}));

/**
 * PATCH /api/libraries/:id/load
 * Set library as loaded or unloaded
 * Body: { is_loaded: boolean }
 */
router.patch('/:id/load', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_loaded } = req.body;

  if (is_loaded === undefined) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'is_loaded is required'
    });
  }

  const library = await libraryService.setLoaded(id, is_loaded);

  if (!library) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Library not found: ${id}`
    });
  }

  res.json({
    success: true,
    message: is_loaded ? 'Library loaded' : 'Library unloaded',
    data: library
  });
}));

// =============================================================================
// DELETE ENDPOINTS
// =============================================================================

/**
 * DELETE /api/libraries/:id
 * Delete a library
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await libraryService.deleteLibrary(id);

  if (!deleted) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Library not found: ${id}`
    });
  }

  res.json({
    success: true,
    message: 'Library deleted successfully'
  });
}));

module.exports = router;
