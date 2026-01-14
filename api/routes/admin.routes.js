/**
 * Admin Routes
 * Handles admin-specific endpoints for users, audits, analytics, etc.
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/error.middleware');
const db = require('../config/database');

// =============================================================================
// USERS MANAGEMENT
// =============================================================================

/**
 * GET /api/admin/users
 * Get all users (admin only)
 */
router.get('/users', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const result = await db.query(`
      SELECT id, email, created_at, last_sign_in_at, is_active
      FROM users
      ORDER BY created_at DESC
    `);
    return res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}));

/**
 * GET /api/admin/users/:id/usage
 * Get user usage summary
 */
router.get('/users/:id/usage', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    // Get audit counts
    const auditsResult = await db.query(`
      SELECT 
        COUNT(*) as total_audits,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_audits
      FROM audit_projects
      WHERE user_id = $1
    `, [id]);

    const stats = auditsResult.rows[0] || {};

    return res.json({
      totalAudits: parseInt(stats.total_audits) || 0,
      completedAudits: parseInt(stats.completed_audits) || 0,
      collections: 0,
      apiCalls: 0,
      lastActivity: null
    });
  } catch (error) {
    console.error('Error fetching user usage:', error);
    return res.json({
      totalAudits: 0,
      completedAudits: 0,
      collections: 0,
      apiCalls: 0,
      lastActivity: null
    });
  }
}));

/**
 * PUT /api/admin/users/:id/status
 * Toggle user active status
 */
router.put('/users/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    await db.query(`
      UPDATE users SET is_active = $1, updated_at = NOW()
      WHERE id = $2
    `, [active, id]);

    return res.json({ success: true, active });
  } catch (error) {
    console.error('Error updating user status:', error);
    return res.status(500).json({ error: 'Failed to update user status' });
  }
}));

// =============================================================================
// AUDITS MANAGEMENT  
// =============================================================================

/**
 * GET /api/admin/audits
 * Get all audit projects (admin view)
 */
router.get('/audits', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const result = await db.query(`
      SELECT *
      FROM audit_projects
      ORDER BY created_at DESC
    `);
    return res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching audits:', error);
    return res.status(500).json({ error: 'Failed to fetch audits' });
  }
}));

/**
 * DELETE /api/admin/audits/:id
 * Delete audit project (admin)
 */
router.delete('/audits/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    await db.query('DELETE FROM audit_projects WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting audit:', error);
    return res.status(500).json({ error: 'Failed to delete audit' });
  }
}));

// =============================================================================
// ANALYTICS
// =============================================================================

/**
 * GET /api/admin/analytics
 * Get system analytics
 */
router.get('/analytics', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const [usersResult, auditsResult, expertsResult, submissionsResult] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM users').catch(() => ({ rows: [{ count: 0 }] })),
      db.query('SELECT COUNT(*) as count FROM audit_projects').catch(() => ({ rows: [{ count: 0 }] })),
      db.query('SELECT COUNT(*) as count FROM experts').catch(() => ({ rows: [{ count: 0 }] })),
      db.query('SELECT COUNT(*) as count FROM sub_criteria_submissions').catch(() => ({ rows: [{ count: 0 }] }))
    ]);

    return res.json({
      totalUsers: parseInt(usersResult.rows[0]?.count) || 0,
      totalAudits: parseInt(auditsResult.rows[0]?.count) || 0,
      totalExperts: parseInt(expertsResult.rows[0]?.count) || 0,
      totalSubmissions: parseInt(submissionsResult.rows[0]?.count) || 0
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.json({
      totalUsers: 0,
      totalAudits: 0,
      totalExperts: 0,
      totalSubmissions: 0
    });
  }
}));

// =============================================================================
// TRIALS MANAGEMENT
// =============================================================================

/**
 * GET /api/admin/trials
 * Get all trial users
 */
router.get('/trials', asyncHandler(async (req, res) => {
  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const result = await db.query(`
      SELECT *
      FROM user_status
      ORDER BY created_at DESC
    `);
    return res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching trials:', error);
    return res.status(500).json({ error: 'Failed to fetch trials' });
  }
}));

/**
 * PUT /api/admin/trials/:id
 * Update trial status
 */
router.put('/trials/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (!db.isDbConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    const result = await db.query(`
      UPDATE user_status 
      SET ${setClause}, updated_at = NOW()
      WHERE user_id = $${keys.length + 1}
      RETURNING *
    `, [...values, id]);

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating trial:', error);
    return res.status(500).json({ error: 'Failed to update trial' });
  }
}));

module.exports = router;
