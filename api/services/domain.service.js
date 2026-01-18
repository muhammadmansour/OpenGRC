/**
 * Domain Settings Service
 * Handles domain references and templates management
 */

const db = require('../config/database');

class DomainService {
  /**
   * Get all domain references for an expert
   */
  async getAllDomainReferences(expertId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    if (!expertId || typeof expertId !== 'string' || expertId.trim().length === 0) {
      throw new Error('Invalid expertId: must be a non-empty string');
    }

    const result = await db.query(`
      SELECT * FROM domain_references
      WHERE expert_id = ?
      ORDER BY created_at DESC
    `, [expertId.trim()]);

    return result.rows || [];
  }

  /**
   * Get domain reference by domain and expert ID
   */
  async getDomainReference(domainId, expertId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT * FROM domain_references
      WHERE domain_id = ? AND expert_id = ?
    `, [domainId.trim(), expertId.trim()]);

    return result.rows[0] || null;
  }

  /**
   * Save or update domain reference
   */
  async saveDomainReference(domainId, expertId, content, name, referenceId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }

    const trimmedDomainId = domainId.trim();
    const trimmedExpertId = expertId.trim();
    const trimmedContent = content.trim();

    console.log('💾 Saving domain reference:', { domainId: trimmedDomainId, expertId: trimmedExpertId });

    // If referenceId is provided, update existing record
    if (referenceId) {
      await db.query(`
        UPDATE domain_references
        SET content = ?, name = ?, updated_at = NOW()
        WHERE id = ?
      `, [trimmedContent, name?.trim() || null, referenceId]);

      const result = await db.query('SELECT * FROM domain_references WHERE id = ?', [referenceId]);
      if (result.rows.length === 0) {
        throw new Error(`Reference ${referenceId} not found`);
      }
      return result.rows[0];
    }

    // Insert new record
    await db.query(`
      INSERT INTO domain_references (domain_id, expert_id, content, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [trimmedDomainId, trimmedExpertId, trimmedContent, name?.trim() || null]);

    // Get the inserted record
    const result = await db.query(`
      SELECT * FROM domain_references 
      WHERE domain_id = ? AND expert_id = ? 
      ORDER BY created_at DESC LIMIT 1
    `, [trimmedDomainId, trimmedExpertId]);

    console.log('✅ Domain reference saved successfully');
    return result.rows[0];
  }

  /**
   * Delete domain reference by ID
   */
  async deleteDomainReferenceById(referenceId, expertId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    // Verify ownership if expertId is provided
    if (expertId) {
      const checkResult = await db.query(`
        SELECT expert_id FROM domain_references WHERE id = ?
      `, [referenceId]);

      if (checkResult.rows.length === 0) {
        throw new Error(`Reference ${referenceId} not found`);
      }

      if (checkResult.rows[0].expert_id !== expertId.trim()) {
        throw new Error('Reference does not belong to the specified expert');
      }
    }

    await db.query('DELETE FROM domain_references WHERE id = ?', [referenceId]);
    console.log(`✅ Deleted reference ${referenceId}`);
    return true;
  }

  /**
   * Get all domain templates for an expert
   */
  async getAllDomainTemplates(expertId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT * FROM domain_templates
      WHERE expert_id = ?
      ORDER BY created_at DESC
    `, [expertId.trim()]);

    return result.rows || [];
  }

  /**
   * Get domain template by domain and expert ID
   */
  async getDomainTemplate(domainId, expertId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT * FROM domain_templates
      WHERE domain_id = ? AND expert_id = ?
    `, [domainId.trim(), expertId.trim()]);

    return result.rows[0] || null;
  }

  /**
   * Save or update domain template
   */
  async saveDomainTemplate(domainId, expertId, content, name, templateId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }

    const trimmedDomainId = domainId.trim();
    const trimmedExpertId = expertId.trim();
    const trimmedContent = content.trim();

    console.log('💾 Saving domain template:', { domainId: trimmedDomainId, expertId: trimmedExpertId });

    // If templateId is provided, update existing record
    if (templateId) {
      await db.query(`
        UPDATE domain_templates
        SET content = ?, name = ?, updated_at = NOW()
        WHERE id = ?
      `, [trimmedContent, name?.trim() || null, templateId]);

      const result = await db.query('SELECT * FROM domain_templates WHERE id = ?', [templateId]);
      if (result.rows.length === 0) {
        throw new Error(`Template ${templateId} not found`);
      }
      return result.rows[0];
    }

    // Try update first based on domain_id and expert_id
    const updateResult = await db.query(`
      SELECT id FROM domain_templates WHERE domain_id = ? AND expert_id = ?
    `, [trimmedDomainId, trimmedExpertId]);

    if (updateResult.rows.length > 0) {
      await db.query(`
        UPDATE domain_templates
        SET content = ?, name = ?, updated_at = NOW()
        WHERE domain_id = ? AND expert_id = ?
      `, [trimmedContent, name?.trim() || null, trimmedDomainId, trimmedExpertId]);

      const result = await db.query(`
        SELECT * FROM domain_templates WHERE domain_id = ? AND expert_id = ?
      `, [trimmedDomainId, trimmedExpertId]);

      console.log('✅ Domain template updated successfully');
      return result.rows[0];
    }

    // Insert if not exists
    await db.query(`
      INSERT INTO domain_templates (domain_id, expert_id, content, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [trimmedDomainId, trimmedExpertId, trimmedContent, name?.trim() || null]);

    const result = await db.query(`
      SELECT * FROM domain_templates WHERE domain_id = ? AND expert_id = ?
    `, [trimmedDomainId, trimmedExpertId]);

    console.log('✅ Domain template saved successfully');
    return result.rows[0];
  }

  /**
   * Delete domain template by ID
   */
  async deleteDomainTemplateById(templateId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    await db.query('DELETE FROM domain_templates WHERE id = ?', [templateId]);
    return true;
  }
}

// Singleton instance
const domainService = new DomainService();

module.exports = domainService;
