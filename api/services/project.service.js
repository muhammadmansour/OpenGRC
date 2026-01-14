/**
 * Project Service
 * Handles audit project management
 */

const db = require('../config/database');
const crypto = require('crypto');

class ProjectService {
  /**
   * Create a new project
   */
  async createProject(params, userId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();

    const result = await db.query(`
      INSERT INTO audit_projects (
        id, name, description, expert_type, domain_id, status,
        created_by, user_id, settings, selected_standards, uploaded_files,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      projectId,
      params.name,
      params.description || '',
      params.expert_type,
      params.domain_id,
      'draft',
      params.created_by || 'anonymous',
      userId,
      JSON.stringify(params.settings || {}),
      JSON.stringify(params.selected_standards || null),
      JSON.stringify(params.uploaded_files || null),
      now,
      now
    ]);

    console.log(`Created project ${result.rows[0].id}: ${result.rows[0].name}`);
    return result.rows[0];
  }

  /**
   * Get project by ID
   */
  async getProject(projectId, userId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT * FROM audit_projects
      WHERE id = $1 AND user_id = $2
    `, [projectId, userId]);

    return result.rows[0] || null;
  }

  /**
   * Update project
   */
  async updateProject(projectId, updates, userId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    // Remove user_id from updates for security
    const safeUpdates = { ...updates };
    delete safeUpdates.user_id;
    delete safeUpdates.id;

    const allowedFields = [
      'name', 'description', 'expert_type', 'domain_id', 'status',
      'settings', 'selected_standards', 'uploaded_files', 'analysis_result',
      'citations_data', 'analysis_prompt'
    ];

    const fieldsToUpdate = Object.keys(safeUpdates).filter(k => allowedFields.includes(k));
    if (fieldsToUpdate.length === 0) {
      // Just return the existing project if no valid fields
      return this.getProject(projectId, userId);
    }

    const values = fieldsToUpdate.map(field => {
      const val = safeUpdates[field];
      // Stringify objects for JSON columns
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    });

    const setClause = fieldsToUpdate.map((field, i) => `${field} = $${i + 1}`).join(', ');

    const result = await db.query(`
      UPDATE audit_projects
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${fieldsToUpdate.length + 1} AND user_id = $${fieldsToUpdate.length + 2}
      RETURNING *
    `, [...values, projectId, userId]);

    if (result.rows.length === 0) {
      throw new Error(`Project ${projectId} not found or access denied`);
    }

    console.log(`Updated project ${projectId}`);
    return result.rows[0];
  }

  /**
   * Get all projects for a user
   */
  async getAllProjects(userId) {
    if (!db.isDbConfigured || !userId) {
      return [];
    }

    const result = await db.query(`
      SELECT * FROM audit_projects
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    return result.rows || [];
  }

  /**
   * Delete project
   */
  async deleteProject(projectId, userId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      DELETE FROM audit_projects
      WHERE id = $1 AND user_id = $2
    `, [projectId, userId]);

    if (result.rowCount === 0) {
      throw new Error(`Project ${projectId} not found or access denied`);
    }

    console.log(`Deleted project ${projectId}`);
    return true;
  }

  /**
   * Save standard analysis for a project
   */
  async saveStandardAnalysis(params) {
    if (!db.isDbConfigured) {
      return false;
    }

    // Upsert: try update first, then insert
    const updateResult = await db.query(`
      UPDATE standard_analyses
      SET standard_name_ar = $1, standard_name_en = $2, analysis_result = $3,
          raw_response = $4, score = $5, compliance_level = $6, status = $7, updated_at = NOW()
      WHERE project_id = $8 AND standard_id = $9
      RETURNING *
    `, [
      params.standardNameAr,
      params.standardNameEn,
      JSON.stringify(params.analysisResult),
      params.rawResponse,
      params.score,
      params.complianceLevel,
      params.status || 'completed',
      params.projectId,
      params.standardId
    ]);

    if (updateResult.rows.length === 0) {
      // Insert if not exists
      await db.query(`
        INSERT INTO standard_analyses (
          project_id, standard_id, standard_name_ar, standard_name_en,
          analysis_result, raw_response, score, compliance_level, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        params.projectId,
        params.standardId,
        params.standardNameAr,
        params.standardNameEn,
        JSON.stringify(params.analysisResult),
        params.rawResponse,
        params.score,
        params.complianceLevel,
        params.status || 'completed'
      ]);
    }

    console.log(`✅ Saved standard analysis for ${params.standardId}`);
    return true;
  }

  /**
   * Get all standard analyses for a project
   */
  async getStandardAnalyses(projectId) {
    if (!db.isDbConfigured) {
      return [];
    }

    const result = await db.query(`
      SELECT * FROM standard_analyses
      WHERE project_id = $1
      ORDER BY created_at ASC
    `, [projectId]);

    return result.rows || [];
  }

  /**
   * Calculate audit status from analyses
   */
  async calculateAuditStatus(projectId) {
    const analyses = await this.getStandardAnalyses(projectId);
    
    if (!analyses || analyses.length === 0) {
      return 'مسودة';
    }

    const completedAnalyses = analyses.filter(a => a.status === 'completed');
    const pendingOrAnalyzing = analyses.filter(a => a.status === 'pending' || a.status === 'analyzing');
    const validAnalyses = analyses.filter(a => a.status !== 'error');

    if (completedAnalyses.length === 0) {
      return 'مسودة';
    }

    if (completedAnalyses.length === validAnalyses.length && pendingOrAnalyzing.length === 0 && validAnalyses.length > 0) {
      return 'مكتمل';
    }

    return 'غير مكتمل';
  }

  /**
   * Update project status from analyses
   */
  async updateProjectStatusFromAnalyses(projectId, userId) {
    const auditStatus = await this.calculateAuditStatus(projectId);
    
    let projectStatus = 'draft';
    if (auditStatus === 'مكتمل') {
      projectStatus = 'completed';
    } else if (auditStatus === 'غير مكتمل') {
      projectStatus = 'in_progress';
    }

    const updatedProject = await this.updateProject(projectId, { status: projectStatus }, userId);
    console.log(`✅ Updated project ${projectId} status to: ${projectStatus}`);
    return updatedProject;
  }
}

// Singleton instance
const projectService = new ProjectService();

module.exports = projectService;
