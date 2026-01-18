/**
 * Submission Service
 * Handles audit submissions and AI analysis
 */

const db = require('../config/database');

class SubmissionService {
  /**
   * Create a new submission
   */
  async createSubmission(params) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    await db.query(`
      INSERT INTO sub_criteria_submissions (
        ministry_id, ministry_name, criteria_id, sub_criteria_id,
        file_ids, status, submitted_date, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      params.ministryId || 'construction-audit',
      params.ministryName || 'Construction Audit',
      params.criteriaId,
      params.subCriteriaId || params.criteriaId,
      JSON.stringify(params.fileIds),
      'submitted'
    ]);

    // Get the last inserted ID
    const result = await db.query('SELECT LAST_INSERT_ID() as id');
    const id = result.rows[0].id;

    console.log(`Created submission ${id}`);
    return id;
  }

  /**
   * Update submission with AI analysis result
   */
  async updateSubmissionAIAnalysis(submissionId, aiAnalysisResult, score, complianceLevel, status = 'completed') {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    console.log('🔍 Updating AI analysis for submission:', submissionId);

    await db.query(`
      UPDATE sub_criteria_submissions
      SET ai_analysis_result = ?, score = ?, compliance_level = ?,
          status = ?, last_updated = NOW()
      WHERE id = ?
    `, [
      JSON.stringify(aiAnalysisResult),
      score,
      complianceLevel,
      status,
      submissionId
    ]);

    console.log('✅ Successfully updated AI analysis');
    return true;
  }

  /**
   * Update submission status
   */
  async updateSubmissionStatus(submissionId, status) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    await db.query(`
      UPDATE sub_criteria_submissions
      SET status = ?, last_updated = NOW()
      WHERE id = ?
    `, [status, submissionId]);

    console.log('✅ Updated submission status to:', status);
    return true;
  }

  /**
   * Get submission by ID
   */
  async getSubmission(submissionId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT * FROM sub_criteria_submissions
      WHERE id = ?
    `, [submissionId]);

    return result.rows[0] || null;
  }

  /**
   * Get submissions by ministry
   */
  async getSubmissionsByMinistry(ministryId) {
    if (!db.isDbConfigured) {
      return [];
    }

    const result = await db.query(`
      SELECT * FROM sub_criteria_submissions
      WHERE ministry_id = ?
      ORDER BY submitted_date DESC
    `, [ministryId]);

    return result.rows || [];
  }

  /**
   * Get submissions by criteria
   */
  async getSubmissionsByCriteria(criteriaId) {
    if (!db.isDbConfigured) {
      return [];
    }

    const result = await db.query(`
      SELECT * FROM sub_criteria_submissions
      WHERE criteria_id = ?
      ORDER BY submitted_date DESC
    `, [criteriaId]);

    return result.rows || [];
  }

  /**
   * Get all submissions
   */
  async getAllSubmissions() {
    if (!db.isDbConfigured) {
      return [];
    }

    const result = await db.query(`
      SELECT * FROM sub_criteria_submissions
      ORDER BY submitted_date DESC
    `);

    return result.rows || [];
  }

  /**
   * Get recent submissions
   */
  async getRecentSubmissions(limit = 10) {
    if (!db.isDbConfigured) {
      return [];
    }

    const result = await db.query(`
      SELECT * FROM sub_criteria_submissions
      ORDER BY last_updated DESC
      LIMIT ?
    `, [limit]);

    return result.rows || [];
  }

  /**
   * Get submission statistics
   */
  async getSubmissionStats() {
    if (!db.isDbConfigured) {
      return { total: 0, submitted: 0, processing: 0, completed: 0, error: 0 };
    }

    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error
      FROM sub_criteria_submissions
    `);

    const stats = result.rows[0] || {};
    return {
      total: parseInt(stats.total) || 0,
      submitted: parseInt(stats.submitted) || 0,
      processing: parseInt(stats.processing) || 0,
      completed: parseInt(stats.completed) || 0,
      error: parseInt(stats.error) || 0
    };
  }

  /**
   * Delete all submissions (debug/admin)
   */
  async clearAllSubmissions() {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    await db.query('DELETE FROM sub_criteria_submissions');
    console.log('All submissions cleared');
  }
}

// Singleton instance
const submissionService = new SubmissionService();

module.exports = submissionService;
