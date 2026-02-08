/**
 * Library Routes - V2
 * Versioned API endpoints for core_storedlibrary table
 * 
 * Base path: /api/libraries/v2
 * 
 * Includes all v1 functionality plus:
 * - Updated DGA (Qyias-6) library data with 483 requirement nodes
 * - DGA-specific endpoints for importing/managing DGA standards
 * - API version metadata
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const libraryService = require('../services/library.service');
const { asyncHandler } = require('../middleware/error.middleware');
const { convertToOpenGRC } = require('../utils/opengrc-converter');

// =============================================================================
// API VERSION INFO
// =============================================================================

const API_VERSION = {
  version: 'v2',
  released: '2026-02-08',
  changes: [
    'Added updated DGA Qyias-6 library with 483 requirement nodes (354 assessable)',
    'Added DGA-specific import/export endpoints',
    'Added API versioning support',
    'Full backward compatibility with v1 endpoints'
  ]
};

// =============================================================================
// LOAD DGA LIBRARY DATA
// =============================================================================

let dgaLibraryData = null;

function loadDgaLibrary() {
  if (!dgaLibraryData) {
    try {
      const dgaPath = path.join(__dirname, '..', 'scripts', 'qyias-6-library.json');
      dgaLibraryData = JSON.parse(fs.readFileSync(dgaPath, 'utf8'));
    } catch (err) {
      console.error('Warning: Could not load DGA library data:', err.message);
      dgaLibraryData = null;
    }
  }
  return dgaLibraryData;
}

// Pre-load on startup
loadDgaLibrary();

// =============================================================================
// V2-SPECIFIC ENDPOINTS
// =============================================================================

/**
 * GET /api/libraries/v2/version
 * Get API version information
 */
router.get('/version', (req, res) => {
  res.json({
    success: true,
    data: API_VERSION
  });
});

/**
 * GET /api/libraries/v2/dga
 * Get the embedded DGA (Qyias-6) library data
 * This returns the latest DGA digital transformation standards
 * Query params:
 *   - format: 'raw' (default), 'opengrc'
 *   - output: 'bundle', 'standard', 'full' (only when format=opengrc)
 */
router.get('/dga', (req, res) => {
  const { format, output } = req.query;
  const dgaData = loadDgaLibrary();

  if (!dgaData) {
    return res.status(500).json({
      error: 'Server Error',
      message: 'DGA library data not available'
    });
  }

  // If format=opengrc, convert to OpenGRC format
  if (format === 'opengrc') {
    try {
      const converted = convertToOpenGRC(dgaData, output || 'full');
      return res.json(converted);
    } catch (err) {
      return res.status(500).json({
        error: 'Conversion Error',
        message: err.message
      });
    }
  }

  // Default: return raw DGA library data
  const nodes = dgaData.content?.framework?.requirement_nodes || [];
  res.json({
    success: true,
    data: {
      ...dgaData,
      statistics: {
        total_nodes: nodes.length,
        perspectives: nodes.filter(n => n.depth === 1).length,
        axes: nodes.filter(n => n.depth === 2).length,
        standards: nodes.filter(n => n.depth === 3).length,
        requirements: nodes.filter(n => n.depth === 4).length,
        assessable: nodes.filter(n => n.assessable === true).length
      }
    }
  });
});

/**
 * GET /api/libraries/v2/dga/perspectives
 * Get DGA perspectives (top-level categories)
 */
router.get('/dga/perspectives', (req, res) => {
  const dgaData = loadDgaLibrary();

  if (!dgaData) {
    return res.status(500).json({
      error: 'Server Error',
      message: 'DGA library data not available'
    });
  }

  const nodes = dgaData.content?.framework?.requirement_nodes || [];
  const perspectives = nodes
    .filter(n => n.depth === 1)
    .map(p => {
      const axes = nodes.filter(n => n.depth === 2 && n.parent_urn === p.urn);
      const standards = nodes.filter(n => n.depth === 3 && axes.some(a => a.urn === n.parent_urn));
      const requirements = nodes.filter(n => n.depth === 4 && n.assessable && standards.some(s => s.urn === n.parent_urn));

      return {
        ref_id: p.ref_id,
        name: p.name,
        description: p.description,
        axes_count: axes.length,
        standards_count: standards.length,
        requirements_count: requirements.length,
        axes: axes.map(a => ({
          ref_id: a.ref_id,
          name: a.name,
          standards_count: nodes.filter(n => n.depth === 3 && n.parent_urn === a.urn).length
        }))
      };
    });

  res.json({
    success: true,
    count: perspectives.length,
    data: perspectives
  });
});

/**
 * GET /api/libraries/v2/dga/requirements
 * Get all assessable DGA requirements
 * Query params: perspective (1-10), axis (e.g. "1-1"), standard (e.g. "5.1.1")
 */
router.get('/dga/requirements', (req, res) => {
  const { perspective, axis, standard } = req.query;
  const dgaData = loadDgaLibrary();

  if (!dgaData) {
    return res.status(500).json({
      error: 'Server Error',
      message: 'DGA library data not available'
    });
  }

  const nodes = dgaData.content?.framework?.requirement_nodes || [];
  let requirements = nodes.filter(n => n.assessable === true);

  // Filter by standard (depth 3 parent)
  if (standard) {
    const standardUrn = `urn:intuitem:risk:req_node:qyias:${standard}`;
    requirements = requirements.filter(n => n.parent_urn === standardUrn);
  }

  // Filter by axis (depth 2 parent - through standards)
  if (axis && !standard) {
    const axisUrn = `urn:intuitem:risk:req_node:qyias:${axis}`;
    const standardsInAxis = nodes
      .filter(n => n.depth === 3 && n.parent_urn === axisUrn)
      .map(n => n.urn);
    requirements = requirements.filter(n => standardsInAxis.includes(n.parent_urn));
  }

  // Filter by perspective (depth 1 - through axes and standards)
  if (perspective && !axis && !standard) {
    const perspUrn = `urn:intuitem:risk:req_node:qyias:${perspective}`;
    const axesInPersp = nodes
      .filter(n => n.depth === 2 && n.parent_urn === perspUrn)
      .map(n => n.urn);
    const standardsInPersp = nodes
      .filter(n => n.depth === 3 && axesInPersp.includes(n.parent_urn))
      .map(n => n.urn);
    requirements = requirements.filter(n => standardsInPersp.includes(n.parent_urn));
  }

  res.json({
    success: true,
    count: requirements.length,
    filters: { perspective, axis, standard },
    data: requirements.map(r => ({
      ref_id: r.ref_id,
      name: r.name,
      description: r.description,
      parent_urn: r.parent_urn,
      urn: r.urn
    }))
  });
});

/**
 * POST /api/libraries/v2/dga/import
 * Import/update the DGA library into the database
 * This will create a new library entry or update existing DGA library
 */
router.post('/dga/import', asyncHandler(async (req, res) => {
  const dgaData = loadDgaLibrary();

  if (!dgaData) {
    return res.status(500).json({
      error: 'Server Error',
      message: 'DGA library data not available'
    });
  }

  // Check if DGA library already exists
  const existing = await libraryService.getLibraryByUrn(
    dgaData.urn,
    dgaData.locale
  );

  let result;
  if (existing) {
    // Update the existing library with new content
    result = await libraryService.updateLibrary(existing.id, {
      name: dgaData.name,
      description: dgaData.description,
      content: dgaData.content,
      version: dgaData.version,
      copyright: dgaData.copyright,
      provider: dgaData.provider,
      publication_date: dgaData.publication_date
    });

    res.json({
      success: true,
      action: 'updated',
      message: 'DGA library updated successfully',
      data: {
        id: result.id,
        name: result.name,
        urn: result.urn,
        version: result.version
      }
    });
  } else {
    // Create new library
    result = await libraryService.createLibrary(dgaData);

    res.status(201).json({
      success: true,
      action: 'created',
      message: 'DGA library imported successfully',
      data: {
        id: result.id,
        name: result.name,
        urn: result.urn,
        version: result.version
      }
    });
  }
}));

// =============================================================================
// V1 ENDPOINTS (fully compatible, same as /api/libraries)
// =============================================================================

/**
 * GET /api/libraries/v2
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
      api_version: 'v2',
      data: convertedLibraries,
      ...(errors.length > 0 && { conversion_errors: errors })
    });
  }

  // Default: return raw CISO format
  res.json({
    success: true,
    count: libraries.length,
    api_version: 'v2',
    data: libraries
  });
}));

/**
 * GET /api/libraries/v2/stats
 * Get library statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await libraryService.getStatistics();
  res.json({
    success: true,
    api_version: 'v2',
    data: stats
  });
}));

/**
 * GET /api/libraries/v2/search
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
    api_version: 'v2',
    data: libraries
  });
}));

/**
 * GET /api/libraries/v2/urn/:urn
 * Get library by URN (latest version or specific version/locale)
 * Query params: 
 *   - locale: language locale (default: 'en')
 *   - version: specific version number
 *   - format: 'ciso' (default) or 'opengrc'
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

  // Default: return raw CISO format
  res.json({
    success: true,
    api_version: 'v2',
    data: library
  });
}));

/**
 * GET /api/libraries/v2/urn/:urn/versions
 * Get all versions of a library by URN
 */
router.get('/urn/:urn/versions', asyncHandler(async (req, res) => {
  const { urn } = req.params;
  const versions = await libraryService.getLibraryVersions(urn);

  res.json({
    success: true,
    urn,
    count: versions.length,
    api_version: 'v2',
    data: versions
  });
}));

/**
 * GET /api/libraries/v2/:id
 * Get library by ID
 * Query params: 
 *   - format: 'ciso' (default) or 'opengrc'
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

  // Default: return raw CISO format
  res.json({
    success: true,
    api_version: 'v2',
    data: library
  });
}));

/**
 * GET /api/libraries/v2/:id/content
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
    api_version: 'v2',
    data: library
  });
}));

// =============================================================================
// PROVIDER-BASED ENDPOINTS
// =============================================================================

/**
 * POST /api/libraries/v2/provider/:provider/controls
 * Bulk update controls across all libraries from a provider
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
      api_version: 'v2',
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
 * POST /api/libraries/v2
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
    api_version: 'v2',
    data: library
  });
}));

/**
 * POST /api/libraries/v2/:id/duplicate
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
    api_version: 'v2',
    data: library
  });
}));

// =============================================================================
// PUT/PATCH ENDPOINTS
// =============================================================================

/**
 * PUT /api/libraries/v2/:id
 * Update a library
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
    api_version: 'v2',
    data: library
  });
}));

/**
 * PATCH /api/libraries/v2/:id/publish
 * Publish or unpublish a library
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
    api_version: 'v2',
    data: library
  });
}));

/**
 * PATCH /api/libraries/v2/:id/load
 * Set library as loaded or unloaded
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
    api_version: 'v2',
    data: library
  });
}));

// =============================================================================
// CONTROLS ENDPOINTS
// =============================================================================

/**
 * GET /api/libraries/v2/:id/controls
 * Get all controls from a library
 */
router.get('/:id/controls', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const filters = {
    assessable_only: req.query.assessable_only === 'true',
    has_typical_evidence: req.query.has_typical_evidence !== undefined 
      ? req.query.has_typical_evidence === 'true' 
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
      api_version: 'v2',
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
 * PATCH /api/libraries/v2/:id/controls
 * Update library controls with typical_evidence and questions
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
      api_version: 'v2',
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
 * DELETE /api/libraries/v2/:id
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
    message: 'Library deleted successfully',
    api_version: 'v2'
  });
}));

module.exports = router;
