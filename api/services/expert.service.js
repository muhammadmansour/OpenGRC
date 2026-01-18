/**
 * Expert Service
 * Handles expert management operations
 */

const db = require('../config/database');

class ExpertService {
  /**
   * Get all active experts
   */
  async getAllExperts() {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT * FROM experts
      WHERE is_active = true
      ORDER BY name_ar ASC
    `);

    return result.rows || [];
  }

  /**
   * Get all experts including inactive (for admin)
   */
  async getAllExpertsIncludingInactive() {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT * FROM experts
      ORDER BY name_ar ASC
    `);

    return result.rows || [];
  }

  /**
   * Get expert by ID
   */
  async getExpertById(expertId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT * FROM experts
      WHERE expert_id = ?
    `, [expertId]);

    return result.rows[0] || null;
  }

  /**
   * Create new expert
   */
  async createExpert(expert) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    await db.query(`
      INSERT INTO experts (
        expert_id, name_ar, name_en, description, icon, domain_id,
        is_active, purpose, system_prompt, industry_focus, has_yaml,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      expert.expert_id,
      expert.name_ar,
      expert.name_en,
      expert.description || null,
      expert.icon || null,
      expert.domain_id,
      expert.is_active ?? true,
      expert.purpose || null,
      expert.system_prompt || null,
      expert.industry_focus || null,
      expert.has_yaml ?? false
    ]);

    const result = await db.query('SELECT * FROM experts WHERE expert_id = ?', [expert.expert_id]);
    console.log('✅ Expert created successfully:', result.rows[0].expert_id);
    return result.rows[0];
  }

  /**
   * Update expert
   */
  async updateExpert(expertId, updates) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const allowedFields = [
      'name_ar', 'name_en', 'description', 'icon', 'domain_id',
      'is_active', 'purpose', 'system_prompt', 'industry_focus', 'has_yaml'
    ];

    const fieldsToUpdate = Object.keys(updates).filter(k => allowedFields.includes(k));
    if (fieldsToUpdate.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fieldsToUpdate.map(field => `${field} = ?`).join(', ');
    const values = fieldsToUpdate.map(field => updates[field]);

    await db.query(`
      UPDATE experts
      SET ${setClause}, updated_at = NOW()
      WHERE expert_id = ?
    `, [...values, expertId]);

    const result = await db.query('SELECT * FROM experts WHERE expert_id = ?', [expertId]);
    if (result.rows.length === 0) {
      throw new Error(`Expert ${expertId} not found`);
    }

    console.log('✅ Expert updated successfully:', expertId);
    return result.rows[0];
  }

  /**
   * Delete expert
   */
  async deleteExpert(expertId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      DELETE FROM experts WHERE expert_id = ?
    `, [expertId]);

    if (result.rowCount === 0) {
      throw new Error(`Expert ${expertId} not found`);
    }

    console.log('✅ Expert deleted successfully:', expertId);
  }

  /**
   * Get expert with references
   */
  async getExpertWithReferences(expertId) {
    const expert = await this.getExpertById(expertId);
    if (!expert) {
      return null;
    }

    try {
      const refResult = await db.query(`
        SELECT * FROM domain_references
        WHERE expert_id = ?
        ORDER BY created_at DESC
      `, [expertId]);

      return { expert, references: refResult.rows || [] };
    } catch (error) {
      console.error('Error fetching references:', error);
      return { expert, references: [] };
    }
  }
}

// Singleton instance
const expertService = new ExpertService();

module.exports = expertService;
