/**
 * Extraction Routes
 * Handles extraction references and standards management
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * @swagger
 * /api/extractions:
 *   get:
 *     summary: Get all extraction references
 *     tags: [Extractions]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *     responses:
 *       200:
 *         description: List of extraction references
 */
router.get('/', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let countQuery = 'SELECT COUNT(*) as count FROM extraction_references';
  let dataQuery = `
    SELECT * FROM extraction_references
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const params = [parseInt(limit), offset];

  if (search) {
    countQuery += ` WHERE metadata::text ILIKE $1`;
    dataQuery = `
      SELECT * FROM extraction_references
      WHERE metadata::text ILIKE $3
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    params.push(`%${search}%`);
  }

  try {
    const countResult = search 
      ? await db.query(countQuery, [`%${search}%`])
      : await db.query(countQuery);
    const dataResult = await db.query(dataQuery, params);

    res.json({
      data: dataResult.rows || [],
      total: parseInt(countResult.rows[0]?.count || 0),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching extraction references:', error);
    res.json({ data: [], total: 0, page: 1, limit: 10 });
  }
}));

/**
 * @swagger
 * /api/extractions/{id}:
 *   get:
 *     summary: Get extraction reference by ID
 *     tags: [Extractions]
 */
router.get('/:id', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { id } = req.params;

  const result = await db.query(
    'SELECT * FROM extraction_references WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Not Found', message: `Extraction reference ${id} not found` });
  }

  res.json(result.rows[0]);
}));

/**
 * @swagger
 * /api/extractions:
 *   post:
 *     summary: Create extraction reference
 *     tags: [Extractions]
 */
router.post('/', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const userId = req.userId || req.user?.id;
  const { fileIds, extractionPrompt, metadata } = req.body;

  const result = await db.query(`
    INSERT INTO extraction_references (user_id, file_ids, extraction_prompt, metadata, extraction_date, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
    RETURNING *
  `, [userId, JSON.stringify(fileIds), extractionPrompt, JSON.stringify(metadata || {})]);

  res.status(201).json(result.rows[0]);
}));

/**
 * @swagger
 * /api/extractions/{id}:
 *   put:
 *     summary: Update extraction reference
 *     tags: [Extractions]
 */
router.put('/:id', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { id } = req.params;
  const { metadata, status } = req.body;

  // Build update query dynamically
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(metadata));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const result = await db.query(`
    UPDATE extraction_references
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, values);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Not Found', message: `Extraction reference ${id} not found` });
  }

  res.json(result.rows[0]);
}));

/**
 * @swagger
 * /api/extractions/{id}:
 *   delete:
 *     summary: Delete extraction reference
 *     tags: [Extractions]
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { id } = req.params;

  // Delete associated standards first
  await db.query('DELETE FROM extracted_standards WHERE extraction_reference_id = $1', [id]);
  
  // Delete the reference
  await db.query('DELETE FROM extraction_references WHERE id = $1', [id]);

  res.json({ success: true, message: `Extraction reference ${id} deleted` });
}));

/**
 * @swagger
 * /api/extractions/{id}/standards:
 *   get:
 *     summary: Get standards for extraction reference
 *     tags: [Extractions]
 */
router.get('/:id/standards', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { id } = req.params;

  const result = await db.query(`
    SELECT * FROM extracted_standards
    WHERE extraction_reference_id = $1
    ORDER BY category_id, standard_id
  `, [id]);

  res.json(result.rows || []);
}));

/**
 * @swagger
 * /api/extractions/{id}/standards:
 *   post:
 *     summary: Save standards for extraction reference
 *     tags: [Extractions]
 */
router.post('/:id/standards', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { id } = req.params;
  const { standards } = req.body;

  if (!Array.isArray(standards)) {
    return res.status(400).json({ error: 'standards must be an array' });
  }

  // Delete existing standards
  await db.query('DELETE FROM extracted_standards WHERE extraction_reference_id = $1', [id]);

  // Insert new standards
  for (const standard of standards) {
    await db.query(`
      INSERT INTO extracted_standards (
        extraction_reference_id, standard_id, name_ar, name_en,
        description_ar, description_en, complexity_level, estimated_time_hours,
        mandatory, type, evidence_documents, category_id, category_name_ar,
        category_name_en, category_description_ar, category_description_en,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
    `, [
      id,
      standard.standard_id,
      standard.name_ar || standard.name?.ar,
      standard.name_en || standard.name?.en,
      standard.description_ar || standard.description?.ar,
      standard.description_en || standard.description?.en,
      standard.complexity_level,
      standard.estimated_time_hours,
      standard.mandatory || false,
      standard.type,
      JSON.stringify(standard.evidence_documents || []),
      standard.category_id,
      standard.category_name_ar || standard.category_name?.ar,
      standard.category_name_en || standard.category_name?.en,
      standard.category_description_ar || standard.category_description?.ar,
      standard.category_description_en || standard.category_description?.en
    ]);
  }

  res.json({ success: true, count: standards.length });
}));

/**
 * @swagger
 * /api/extractions/{standardId}/requirements:
 *   get:
 *     summary: Get requirements for a standard
 *     tags: [Extractions]
 */
router.get('/standards/:standardId/requirements', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { standardId } = req.params;

  const result = await db.query(`
    SELECT * FROM extracted_requirements
    WHERE extracted_standard_id = $1
    ORDER BY requirement_index
  `, [standardId]);

  res.json(result.rows || []);
}));

module.exports = router;
