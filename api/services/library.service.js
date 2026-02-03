/**
 * Library Service
 * Handles CRUD operations for core_storedlibrary table
 */

const db = require('../config/database');
const crypto = require('crypto');

class LibraryService {
  
  /**
   * Generate SHA-256 hash for content
   */
  generateHash(content) {
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    return crypto.createHash('sha256').update(contentString).digest('hex');
  }

  /**
   * Get all libraries with optional filters
   */
  async getAllLibraries(filters = {}) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    let sql = `SELECT * FROM core_storedlibrary`;
    const values = [];
    const conditions = [];
    let paramCount = 1;

    // Apply filters
    if (filters.is_published !== undefined) {
      conditions.push(`is_published = $${paramCount++}`);
      values.push(filters.is_published);
    }

    if (filters.is_loaded !== undefined) {
      conditions.push(`is_loaded = $${paramCount++}`);
      values.push(filters.is_loaded);
    }

    if (filters.locale) {
      conditions.push(`locale = $${paramCount++}`);
      values.push(filters.locale);
    }

    if (filters.provider) {
      conditions.push(`provider ILIKE $${paramCount++}`);
      values.push(`%${filters.provider}%`);
    }

    if (filters.urn) {
      conditions.push(`urn = $${paramCount++}`);
      values.push(filters.urn);
    }

    if (filters.builtin !== undefined) {
      conditions.push(`builtin = $${paramCount++}`);
      values.push(filters.builtin);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      sql += ` LIMIT ${parseInt(filters.limit)}`;
    }

    if (filters.offset) {
      sql += ` OFFSET ${parseInt(filters.offset)}`;
    }

    const result = await db.query(sql, values);
    return result.rows;
  }

  /**
   * Get library by ID
   */
  async getLibraryById(id) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      `SELECT * FROM core_storedlibrary WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get library by URN, locale, and version
   */
  async getLibraryByUrn(urn, locale = 'en', version = null) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    let sql = `SELECT * FROM core_storedlibrary WHERE urn = $1 AND locale = $2`;
    const values = [urn, locale];

    if (version !== null) {
      sql += ` AND version = $3`;
      values.push(version);
    } else {
      sql += ` ORDER BY version DESC LIMIT 1`;
    }

    const result = await db.query(sql, values);
    return result.rows[0] || null;
  }

  /**
   * Get library by hash checksum
   */
  async getLibraryByHash(hash) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      `SELECT * FROM core_storedlibrary WHERE hash_checksum = $1`,
      [hash]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new library
   */
  async createLibrary(data) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    // Validate required fields
    if (!data.name) {
      throw new Error('name is required');
    }
    if (!data.content) {
      throw new Error('content is required');
    }
    if (data.version === undefined || data.version === null) {
      throw new Error('version is required');
    }

    // Generate hash if not provided
    const hashChecksum = data.hash_checksum || this.generateHash(data.content);

    // Check if library with same hash already exists
    const existing = await this.getLibraryByHash(hashChecksum);
    if (existing) {
      throw new Error(`Library with same content already exists (id: ${existing.id})`);
    }

    const sql = `
      INSERT INTO core_storedlibrary (
        urn, ref_id, provider, name, description, annotation, translations,
        locale, default_locale, copyright, version, packager, publication_date,
        builtin, objects_meta, dependencies, is_loaded, hash_checksum, content,
        autoload, is_published
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21
      ) RETURNING *
    `;

    const values = [
      data.urn || null,
      data.ref_id || null,
      data.provider || null,
      data.name,
      data.description || null,
      data.annotation || null,
      data.translations ? JSON.stringify(data.translations) : null,
      data.locale || 'en',
      data.default_locale !== undefined ? data.default_locale : true,
      data.copyright || null,
      data.version,
      data.packager || null,
      data.publication_date || null,
      data.builtin || false,
      JSON.stringify(data.objects_meta || {}),
      data.dependencies ? JSON.stringify(data.dependencies) : null,
      data.is_loaded || false,
      hashChecksum,
      JSON.stringify(data.content),
      data.autoload || false,
      data.is_published || false
    ];

    const result = await db.query(sql, values);
    return result.rows[0];
  }

  /**
   * Update a library
   */
  async updateLibrary(id, data) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    // Check if library exists
    const existing = await this.getLibraryById(id);
    if (!existing) {
      return null;
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'urn', 'ref_id', 'provider', 'name', 'description', 'annotation',
      'translations', 'locale', 'default_locale', 'copyright', 'version',
      'packager', 'publication_date', 'builtin', 'objects_meta', 'dependencies',
      'is_loaded', 'content', 'autoload', 'is_published'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        let value = data[field];
        
        // Handle JSON fields
        if (['translations', 'objects_meta', 'dependencies', 'content'].includes(field)) {
          value = JSON.stringify(value);
        }
        
        updateFields.push(`${field} = $${paramCount++}`);
        values.push(value);
      }
    }

    // Recalculate hash if content changed
    if (data.content) {
      const newHash = this.generateHash(data.content);
      updateFields.push(`hash_checksum = $${paramCount++}`);
      values.push(newHash);
    }

    // Always update updated_at
    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 1) {
      // Only updated_at, no real changes
      return existing;
    }

    values.push(id);
    const sql = `
      UPDATE core_storedlibrary 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(sql, values);
    return result.rows[0];
  }

  /**
   * Delete a library
   */
  async deleteLibrary(id) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      `DELETE FROM core_storedlibrary WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Publish/unpublish a library
   */
  async setPublished(id, isPublished) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      `UPDATE core_storedlibrary 
       SET is_published = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [isPublished, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Set library as loaded/unloaded
   */
  async setLoaded(id, isLoaded) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      `UPDATE core_storedlibrary 
       SET is_loaded = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [isLoaded, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get library content only
   */
  async getLibraryContent(id) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      `SELECT id, name, urn, version, content FROM core_storedlibrary WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Search libraries by name or description
   */
  async searchLibraries(searchTerm, limit = 20) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      `SELECT id, urn, ref_id, provider, name, description, locale, version, 
              is_published, is_loaded, created_at, updated_at
       FROM core_storedlibrary 
       WHERE name ILIKE $1 OR description ILIKE $1 OR urn ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );
    return result.rows;
  }

  /**
   * Get library statistics
   */
  async getStatistics() {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_published = true) as published,
        COUNT(*) FILTER (WHERE is_loaded = true) as loaded,
        COUNT(*) FILTER (WHERE builtin = true) as builtin,
        COUNT(DISTINCT locale) as locales,
        COUNT(DISTINCT provider) as providers
      FROM core_storedlibrary
    `);
    return result.rows[0];
  }

  /**
   * Get all versions of a library by URN
   */
  async getLibraryVersions(urn) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      `SELECT id, urn, name, version, locale, is_published, is_loaded, created_at
       FROM core_storedlibrary 
       WHERE urn = $1
       ORDER BY version DESC`,
      [urn]
    );
    return result.rows;
  }

  /**
   * Duplicate a library with new version
   */
  async duplicateLibrary(id, newVersion) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const existing = await this.getLibraryById(id);
    if (!existing) {
      throw new Error('Library not found');
    }

    // Check if version already exists
    if (existing.urn) {
      const versionExists = await this.getLibraryByUrn(existing.urn, existing.locale, newVersion);
      if (versionExists) {
        throw new Error(`Version ${newVersion} already exists for this library`);
      }
    }

    const newData = {
      ...existing,
      version: newVersion,
      is_published: false,
      is_loaded: false,
      hash_checksum: undefined // Will be regenerated
    };
    delete newData.id;
    delete newData.created_at;
    delete newData.updated_at;

    return await this.createLibrary(newData);
  }

  /**
   * Update library controls with typical_evidence and questions
   * @param {string} libraryId - Library UUID
   * @param {Array} updates - Array of updates with { id?, code?, ref_id?, typical_evidence?, questions? }
   * @returns {Object} Updated library and statistics
   */
  async updateLibraryControls(libraryId, updates) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('updates must be a non-empty array');
    }

    // Get the library
    const library = await this.getLibraryById(libraryId);
    if (!library) {
      throw new Error(`Library not found: ${libraryId}`);
    }

    // Parse content if it's a string
    let content = library.content;
    if (typeof content === 'string') {
      content = JSON.parse(content);
    }

    // Find the requirement_nodes array in content
    // It could be at content.framework.requirement_nodes or content.requirement_nodes
    let requirementNodes = null;
    let nodePath = null;

    if (content?.framework?.requirement_nodes) {
      requirementNodes = content.framework.requirement_nodes;
      nodePath = 'framework.requirement_nodes';
    } else if (content?.requirement_nodes) {
      requirementNodes = content.requirement_nodes;
      nodePath = 'requirement_nodes';
    }

    if (!requirementNodes || !Array.isArray(requirementNodes)) {
      throw new Error('Library content does not contain requirement_nodes array');
    }

    // Create lookup maps for faster matching
    const nodesByUrn = new Map();
    const nodesByRefId = new Map();
    const nodesByCode = new Map();

    requirementNodes.forEach((node, index) => {
      if (node.urn) nodesByUrn.set(node.urn, { node, index });
      if (node.ref_id) nodesByRefId.set(node.ref_id, { node, index });
      if (node.code) nodesByCode.set(node.code, { node, index });
    });

    // Track statistics
    const stats = {
      total: updates.length,
      updated: 0,
      not_found: 0,
      errors: []
    };

    const updatedItems = [];

    // Process each update
    for (const update of updates) {
      try {
        // Find the matching node by id (urn), code, or ref_id
        let match = null;

        if (update.id && nodesByUrn.has(update.id)) {
          match = nodesByUrn.get(update.id);
        } else if (update.urn && nodesByUrn.has(update.urn)) {
          match = nodesByUrn.get(update.urn);
        } else if (update.code && nodesByCode.has(update.code)) {
          match = nodesByCode.get(update.code);
        } else if (update.code && nodesByRefId.has(update.code)) {
          match = nodesByRefId.get(update.code);
        } else if (update.ref_id && nodesByRefId.has(update.ref_id)) {
          match = nodesByRefId.get(update.ref_id);
        }

        if (!match) {
          stats.not_found++;
          stats.errors.push({
            identifier: update.id || update.urn || update.code || update.ref_id || 'unknown',
            error: 'Control not found in library'
          });
          continue;
        }

        // Update the node with typical_requirements and/or questions
        const { node, index } = match;
        let wasUpdated = false;

        if (update.typical_evidence !== undefined) {
          requirementNodes[index].typical_evidence = update.typical_evidence;
          wasUpdated = true;
        }

        if (update.questions !== undefined) {
          // Ensure questions is stored as an object/JSON
          requirementNodes[index].questions = typeof update.questions === 'string' 
            ? JSON.parse(update.questions) 
            : update.questions;
          wasUpdated = true;
        }

        if (wasUpdated) {
          stats.updated++;
          updatedItems.push({
            identifier: update.id || update.urn || update.code || update.ref_id,
            ref_id: node.ref_id,
            name: node.name
          });
        }
      } catch (err) {
        stats.errors.push({
          identifier: update.id || update.urn || update.code || update.ref_id || 'unknown',
          error: err.message
        });
      }
    }

    // Update the content back in the library
    if (nodePath === 'framework.requirement_nodes') {
      content.framework.requirement_nodes = requirementNodes;
    } else {
      content.requirement_nodes = requirementNodes;
    }

    // Calculate new hash and update library
    const newHash = this.generateHash(content);

    const result = await db.query(`
      UPDATE core_storedlibrary 
      SET content = $1, hash_checksum = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, name, urn, version, updated_at
    `, [JSON.stringify(content), newHash, libraryId]);

    return {
      library: result.rows[0],
      statistics: stats,
      updated_items: updatedItems
    };
  }

  /**
   * Get all controls from a library with their typical_evidence and questions
   * @param {string} libraryId - Library UUID
   * @param {Object} filters - Optional filters { has_typical_evidence, has_questions, assessable_only }
   * @returns {Array} Array of controls
   */
  async getLibraryControls(libraryId, filters = {}) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const library = await this.getLibraryById(libraryId);
    if (!library) {
      throw new Error(`Library not found: ${libraryId}`);
    }

    // Parse content if it's a string
    let content = library.content;
    if (typeof content === 'string') {
      content = JSON.parse(content);
    }

    // Find the requirement_nodes array
    let requirementNodes = content?.framework?.requirement_nodes || content?.requirement_nodes || [];

    // Apply filters
    let controls = requirementNodes.map(node => ({
      urn: node.urn,
      ref_id: node.ref_id,
      code: node.code,
      name: node.name,
      description: node.description,
      assessable: node.assessable,
      depth: node.depth,
      parent_urn: node.parent_urn,
      typical_evidence: node.typical_evidence || null,
      questions: node.questions || null,
      implementation_groups: node.implementation_groups
    }));

    if (filters.assessable_only) {
      controls = controls.filter(c => c.assessable === true);
    }

    if (filters.has_typical_evidence === true) {
      controls = controls.filter(c => c.typical_evidence);
    } else if (filters.has_typical_evidence === false) {
      controls = controls.filter(c => !c.typical_evidence);
    }

    if (filters.has_questions === true) {
      controls = controls.filter(c => c.questions);
    } else if (filters.has_questions === false) {
      controls = controls.filter(c => !c.questions);
    }

    return {
      library_id: library.id,
      library_name: library.name,
      library_urn: library.urn,
      total_controls: controls.length,
      controls
    };
  }

  /**
   * Bulk update controls across multiple libraries by provider
   * @param {string} provider - Provider name (e.g., 'NCA')
   * @param {Array} updates - Array of updates with { code, typical_requirements?, questions? }
   * @returns {Object} Statistics of updates
   */
  async bulkUpdateControlsByProvider(provider, updates) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    // Find all libraries by provider
    const libraries = await this.getAllLibraries({ provider });

    if (libraries.length === 0) {
      throw new Error(`No libraries found for provider: ${provider}`);
    }

    const results = [];

    for (const library of libraries) {
      try {
        const result = await this.updateLibraryControls(library.id, updates);
        results.push({
          library_id: library.id,
          library_name: library.name,
          ...result.statistics
        });
      } catch (err) {
        results.push({
          library_id: library.id,
          library_name: library.name,
          error: err.message
        });
      }
    }

    return {
      provider,
      libraries_processed: libraries.length,
      results
    };
  }
}

module.exports = new LibraryService();
