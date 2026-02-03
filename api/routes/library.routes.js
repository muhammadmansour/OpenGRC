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
 * Query params: 
 *   - is_published, is_loaded, locale, provider, urn, builtin, limit, offset (filters)
 *   - format: 'ciso' (default) or 'opengrc' (converts all libraries to OpenGRC bundle format)
 *   - output: 'bundle', 'standard', or 'full' (only when format=opengrc)
 */
router.get('/', asyncHandler(async (req, res) => {
  const { format, output } = req.query;
  
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
  
  // If format=opengrc, convert all libraries to OpenGRC format
  if (format === 'opengrc') {
    const convertedLibraries = [];
    const errors = [];
    
    for (const library of libraries) {
      try {
        const converted = convertToOpenGRC(library, output || 'bundle');
        convertedLibraries.push(converted.data);
      } catch (err) {
        errors.push({
          library_id: library.id,
          library_name: library.name,
          error: err.message
        });
      }
    }
    
    return res.json({
      success: true,
      count: convertedLibraries.length,
      format: 'opengrc',
      output: output || 'bundle',
      data: convertedLibraries,
      ...(errors.length > 0 && { conversion_errors: errors })
    });
  }

  // Default: return raw CISO format
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
 *   - format: 'ciso' (default, raw DB format) or 'opengrc' (converted format)
 *   - output: 'bundle', 'standard', or 'full' (only when format=opengrc)
 */
router.get('/urn/:urn', asyncHandler(async (req, res) => {
  const { urn } = req.params;
  const { locale, version, format, output } = req.query;

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

  // If format=opengrc, convert to OpenGRC format
  if (format === 'opengrc') {
    const converted = convertToOpenGRC(library, output || 'full');
    return res.json(converted);
  }

  // Default: format=ciso or not specified - return raw DB format
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
 *   - format: 'ciso' (default, raw DB format) or 'opengrc' (converted format)
 *   - output: 'bundle', 'standard', or 'full' (only when format=opengrc)
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { format, output } = req.query;
  
  const library = await libraryService.getLibraryById(id);

  if (!library) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Library not found: ${id}`
    });
  }

  // If format=opengrc, convert to OpenGRC format
  if (format === 'opengrc') {
    const converted = convertToOpenGRC(library, output || 'full');
    return res.json(converted);
  }

  // Default: format=ciso or not specified - return raw DB format
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
// PROVIDER-BASED ENDPOINTS (must come before /:id routes)
// =============================================================================

/**
 * @swagger
 * /api/libraries/provider/{provider}/controls:
 *   post:
 *     summary: Bulk update controls across all libraries from a provider
 *     description: |
 *       Updates typical_requirements and questions for controls across ALL libraries
 *       from a specific provider (e.g., NCA). This is useful when multiple libraries
 *       share the same control codes.
 *     tags: [Libraries]
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider name (e.g., "NCA")
 *         example: NCA
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - code
 *                   properties:
 *                     code:
 *                       type: string
 *                       description: Control code (e.g., "1-1-1")
 *                     typical_requirements:
 *                       type: string
 *                     questions:
 *                       type: object
 *     responses:
 *       200:
 *         description: Bulk update completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 provider:
 *                   type: string
 *                 libraries_processed:
 *                   type: integer
 *                 results:
 *                   type: array
 *       400:
 *         description: Validation error
 *       404:
 *         description: No libraries found for provider
 */
router.post('/provider/:provider/controls', asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'updates must be an array of control updates'
    });
  }

  if (updates.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'updates array cannot be empty'
    });
  }

  try {
    const result = await libraryService.bulkUpdateControlsByProvider(provider, updates);
    res.json({
      success: true,
      message: `Processed ${result.libraries_processed} libraries for provider: ${provider}`,
      ...result
    });
  } catch (err) {
    if (err.message.includes('No libraries found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: err.message
      });
    }
    throw err;
  }
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
// CONTROLS UPDATE ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /api/libraries/{id}/controls:
 *   get:
 *     summary: Get all controls from a library
 *     description: Returns all controls with their typical_requirements and questions fields
 *     tags: [Libraries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Library UUID
 *       - in: query
 *         name: assessable_only
 *         schema:
 *           type: boolean
 *         description: Only return assessable controls
 *       - in: query
 *         name: has_typical_requirements
 *         schema:
 *           type: boolean
 *         description: Filter by presence of typical_requirements
 *       - in: query
 *         name: has_questions
 *         schema:
 *           type: boolean
 *         description: Filter by presence of questions
 *     responses:
 *       200:
 *         description: List of controls
 *       404:
 *         description: Library not found
 */
router.get('/:id/controls', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const filters = {
    assessable_only: req.query.assessable_only === 'true',
    has_typical_requirements: req.query.has_typical_requirements !== undefined 
      ? req.query.has_typical_requirements === 'true' 
      : undefined,
    has_questions: req.query.has_questions !== undefined 
      ? req.query.has_questions === 'true' 
      : undefined
  };

  // Remove undefined values
  Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

  try {
    const result = await libraryService.getLibraryControls(id, filters);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: err.message
      });
    }
    throw err;
  }
}));

/**
 * @swagger
 * /api/libraries/{id}/controls:
 *   patch:
 *     summary: Update library controls with typical_requirements and questions
 *     description: |
 *       Update multiple controls in a library with their typical_requirements and/or questions.
 *       Each update object must have at least one identifier (id, urn, code, or ref_id) to match the control.
 *     tags: [Libraries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Library UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 description: Array of control updates
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Control UUID (urn)
 *                     urn:
 *                       type: string
 *                       description: Control URN
 *                     code:
 *                       type: string
 *                       description: Control code (e.g., "1-1-1")
 *                     ref_id:
 *                       type: string
 *                       description: Reference ID
 *                     typical_requirements:
 *                       type: string
 *                       description: |
 *                         Typical requirements/evidence needed for this control.
 *                         Can include bullet points using "- " prefix.
 *                       example: "- Approved cybersecurity strategy document\n- Board meeting minutes showing approval\n- Signature of Authorizing Official"
 *                     questions:
 *                       type: object
 *                       description: Assessment questions in JSON format
 *                       example:
 *                         q1:
 *                           text: "Is the cybersecurity strategy documented?"
 *                           type: "unique_choice"
 *                           options: ["yes", "no", "partial"]
 *                         q2:
 *                           text: "Is the strategy approved by management?"
 *                           type: "unique_choice"
 *                           options: ["yes", "no", "partial"]
 *           example:
 *             updates:
 *               - code: "1-1-1"
 *                 typical_requirements: "- Approved cybersecurity strategy document\n- Board meeting minutes showing approval\n- Signature of Authorizing Official\n- Evidence of communication to stakeholders"
 *                 questions:
 *                   q1:
 *                     text: "Is the cybersecurity strategy documented?"
 *                     type: "unique_choice"
 *                     options: ["yes", "no", "partial"]
 *                   q2:
 *                     text: "Is the strategy approved by management?"
 *                     type: "unique_choice"
 *                     options: ["yes", "no", "partial"]
 *     responses:
 *       200:
 *         description: Controls updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 library:
 *                   type: object
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     updated:
 *                       type: integer
 *                     not_found:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                 updated_items:
 *                   type: array
 *       400:
 *         description: Validation error
 *       404:
 *         description: Library not found
 */
router.patch('/:id/controls', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'updates must be an array of control updates'
    });
  }

  if (updates.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'updates array cannot be empty'
    });
  }

  // Validate each update has at least one identifier
  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];
    if (!update.id && !update.urn && !update.code && !update.ref_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Update at index ${i} must have at least one identifier (id, urn, code, or ref_id)`
      });
    }
  }

  try {
    const result = await libraryService.updateLibraryControls(id, updates);
    res.json({
      success: true,
      message: `Updated ${result.statistics.updated} of ${result.statistics.total} controls`,
      ...result
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: err.message
      });
    }
    throw err;
  }
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
