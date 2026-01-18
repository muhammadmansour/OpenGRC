/**
 * Standards Service
 * Handles audit standards and criteria management
 */

const yaml = require('js-yaml');
const db = require('../config/database');
// Using native fetch (Node 18+)

class StandardsService {
  /**
   * Get standards for a specific expert from database
   */
  async getStandardsForExpert(expertId) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    if (!expertId || typeof expertId !== 'string' || expertId.trim().length === 0) {
      throw new Error('Invalid expertId: must be a non-empty string');
    }

    const trimmedExpertId = expertId.trim();
    console.log('🔍 Fetching standards for expert:', trimmedExpertId);

    const result = await db.query(`
      SELECT * FROM domain_references
      WHERE expert_id = $1
      ORDER BY created_at DESC
    `, [trimmedExpertId]);

    if (!result.rows || result.rows.length === 0) {
      console.log(`⚠️ No references found for expert: ${trimmedExpertId}`);
      return [];
    }

    console.log(`✅ Found ${result.rows.length} reference(s) for expert: ${trimmedExpertId}`);

    // Parse content from domain_references to extract standards
    const allCategories = [];
    let totalStandardsCount = 0;

    for (const record of result.rows) {
      try {
        if (record.content) {
          const parsed = yaml.load(record.content);
          
          if (parsed?.domain?.standards_matrix?.categories) {
            const categories = parsed.domain.standards_matrix.categories.map(cat => ({
              id: cat.id || `category-${Math.random().toString(36).substr(2, 9)}`,
              name: cat.name || { ar: 'فئة', en: 'Category' },
              description: cat.description,
              standards: (cat.standards || []).map(std => ({
                id: std.id || `standard-${Math.random().toString(36).substr(2, 9)}`,
                name: std.name || { ar: 'معيار', en: 'Standard' },
                description: std.description || { ar: '', en: '' },
                complexity_level: std.complexity_level || 'medium',
                estimated_time_hours: std.estimated_time_hours || 0,
                mandatory: std.mandatory || false,
                type: std.type || 'optional',
                cross_domain_ids: std.cross_domain_ids,
                requirements: std.requirements,
                evidence_documents: std.evidence_documents,
                sub_standards: std.sub_standards
              }))
            }));
            
            // Merge categories
            categories.forEach(cat => {
              const existingIndex = allCategories.findIndex(existing => existing.id === cat.id);
              if (existingIndex >= 0) {
                const existing = allCategories[existingIndex];
                const mergedStandards = [
                  ...existing.standards,
                  ...cat.standards.map(std => ({
                    ...std,
                    id: `${std.id}-ref-${record.id}`
                  }))
                ];
                allCategories[existingIndex] = { ...existing, standards: mergedStandards };
              } else {
                allCategories.push(cat);
              }
            });

            const standardsInThisRef = categories.reduce((sum, cat) => sum + (cat.standards?.length || 0), 0);
            totalStandardsCount += standardsInThisRef;
          }
        }
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse content for reference ${record.id}:`, parseError.message);
      }
    }

    console.log(`✅ Total categories: ${allCategories.length}, Total standards: ${totalStandardsCount}`);
    return allCategories;
  }

  /**
   * Save standards to database for an expert
   */
  async saveStandardsForExpert(expertId, domainId, categories) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    console.log('💾 Saving standards for expert:', expertId);

    const records = [];

    categories.forEach(category => {
      category.standards.forEach(standard => {
        records.push({
          expert_id: expertId,
          domain_id: domainId,
          category_id: category.id,
          category_name_ar: category.name.ar,
          category_name_en: category.name.en,
          category_description_ar: category.description?.ar,
          category_description_en: category.description?.en,
          standard_id: standard.id,
          standard_name_ar: standard.name.ar,
          standard_name_en: standard.name.en,
          standard_description_ar: standard.description.ar,
          standard_description_en: standard.description.en,
          complexity_level: standard.complexity_level,
          estimated_time_hours: standard.estimated_time_hours,
          mandatory: standard.mandatory,
          type: standard.type,
          requirements: standard.requirements || null,
          evidence_documents: standard.evidence_documents || null,
          sub_standards: standard.sub_standards || null,
          cross_domain_ids: standard.cross_domain_ids || null
        });
      });
    });

    // Delete existing standards for this expert first
    try {
      await db.query('DELETE FROM audit_standards WHERE expert_id = $1', [expertId]);
    } catch (error) {
      console.warn('⚠️ Error deleting existing standards:', error.message);
    }

    // Insert new standards
    if (records.length > 0) {
      for (const record of records) {
        await db.query(`
          INSERT INTO audit_standards (
            expert_id, domain_id, category_id, category_name_ar, category_name_en,
            category_description_ar, category_description_en, standard_id,
            standard_name_ar, standard_name_en, standard_description_ar, standard_description_en,
            complexity_level, estimated_time_hours, mandatory, type,
            requirements, evidence_documents, sub_standards, cross_domain_ids,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
        `, [
          record.expert_id, record.domain_id, record.category_id,
          record.category_name_ar, record.category_name_en,
          record.category_description_ar, record.category_description_en,
          record.standard_id, record.standard_name_ar, record.standard_name_en,
          record.standard_description_ar, record.standard_description_en,
          record.complexity_level, record.estimated_time_hours,
          record.mandatory, record.type,
          JSON.stringify(record.requirements), JSON.stringify(record.evidence_documents),
          JSON.stringify(record.sub_standards), JSON.stringify(record.cross_domain_ids)
        ]);
      }

      console.log(`✅ Saved ${records.length} standard records for expert: ${expertId}`);
    }

    return true;
  }

  /**
   * Store standard criteria (bundles) to database
   * Supports hierarchical structure with parent_code
   * @param {Array} criteria - Array of standard criteria objects
   * @returns {Promise<{success: boolean, stored: number, errors: Array}>}
   */
  async storeCriteria(criteria) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    if (!Array.isArray(criteria)) {
      throw new Error('Criteria must be an array');
    }

    console.log(`📦 Storing ${criteria.length} standard criteria...`);

    const results = { success: true, stored: 0, updated: 0, errors: [] };

    // Sort criteria so parents are processed first (shorter codes first)
    const sortedCriteria = [...criteria].sort((a, b) => 
      (a.code || '').length - (b.code || '').length
    );

    for (const item of sortedCriteria) {
      try {
        // Validate required fields
        if (!item.code || !item.name) {
          results.errors.push({ code: item.code, error: 'Missing required fields (code, name)' });
          continue;
        }

        // Look up parent_id if parent_code is provided
        let parentId = null;
        if (item.parent_code) {
          const parentResult = await db.query(
            'SELECT id FROM standard_criteria WHERE code = $1',
            [item.parent_code]
          );
          if (parentResult.rows.length > 0) {
            parentId = parentResult.rows[0].id;
          }
        }

        // Check if criteria already exists
        const existing = await db.query(
          'SELECT id FROM standard_criteria WHERE code = $1',
          [item.code]
        );

        if (existing.rows.length > 0) {
          // Update existing
          await db.query(`
            UPDATE standard_criteria SET
              name = $1,
              authority = $2,
              description = $3,
              version = $4,
              url = $5,
              parent_id = $6,
              updated_at = NOW()
            WHERE code = $7
          `, [
            item.name,
            item.authority || null,
            item.description || null,
            item.version || null,
            item.url || null,
            parentId,
            item.code
          ]);
          results.updated++;
        } else {
          // Insert new
          await db.query(`
            INSERT INTO standard_criteria (code, name, authority, description, version, url, parent_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          `, [
            item.code,
            item.name,
            item.authority || null,
            item.description || null,
            item.version || null,
            item.url || null,
            parentId
          ]);
          results.stored++;
        }
      } catch (error) {
        console.error(`❌ Error storing criteria ${item.code}:`, error.message);
        results.errors.push({ code: item.code, error: error.message });
        results.success = false;
      }
    }

    console.log(`✅ Stored: ${results.stored}, Updated: ${results.updated}, Errors: ${results.errors.length}`);
    return results;
  }

  /**
   * Get all stored standard criteria with hierarchy info
   * @returns {Promise<Array>}
   */
  async getAllCriteria() {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT 
        c.*,
        p.code as parent_code,
        p.name as parent_name
      FROM standard_criteria c
      LEFT JOIN standard_criteria p ON c.parent_id = p.id
      ORDER BY c.code
    `);

    return result.rows;
  }

  /**
   * Get criteria with children (hierarchical structure)
   * @returns {Promise<Array>}
   */
  async getCriteriaHierarchy() {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    // Get all parent criteria (no parent_id)
    const parents = await db.query(`
      SELECT * FROM standard_criteria
      WHERE parent_id IS NULL
      ORDER BY code
    `);

    // For each parent, get children
    const hierarchy = [];
    for (const parent of parents.rows) {
      const children = await db.query(`
        SELECT * FROM standard_criteria
        WHERE parent_id = $1
        ORDER BY code
      `, [parent.id]);

      hierarchy.push({
        ...parent,
        children: children.rows
      });
    }

    return hierarchy;
  }

  /**
   * Get criteria by code
   * @param {string} code - The standard code
   * @returns {Promise<Object|null>}
   */
  async getCriteriaByCode(code) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      'SELECT * FROM standard_criteria WHERE code = $1',
      [code]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete criteria by code
   * @param {string} code - The standard code
   * @returns {Promise<boolean>}
   */
  async deleteCriteria(code) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      'DELETE FROM standard_criteria WHERE code = $1',
      [code]
    );

    return result.rowCount > 0;
  }

  /**
   * Import a standard from its URL (fetch and store the full standard data)
   * @param {string} code - The standard code to import
   * @returns {Promise<Object>}
   */
  async importStandardFromUrl(code) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    // Get the criteria to find the URL
    const criteria = await this.getCriteriaByCode(code);
    if (!criteria) {
      throw new Error(`Standard criteria not found: ${code}`);
    }

    if (!criteria.url) {
      throw new Error(`No URL defined for standard: ${code}`);
    }

    console.log(`📥 Importing standard ${code} from ${criteria.url}...`);

    try {
      const response = await fetch(criteria.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const standardData = await response.json();

      // Store the imported standard data
      const existing = await db.query(
        'SELECT id FROM imported_standards WHERE code = $1',
        [code]
      );

      if (existing.rows.length > 0) {
        await db.query(`
          UPDATE imported_standards SET
            name = $1,
            authority = $2,
            description = $3,
            data = $4,
            updated_at = NOW()
          WHERE code = $5
        `, [
          standardData.name || criteria.name,
          standardData.authority || criteria.authority,
          standardData.description || criteria.description,
          JSON.stringify(standardData),
          code
        ]);
      } else {
        await db.query(`
          INSERT INTO imported_standards (code, name, authority, description, data, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `, [
          code,
          standardData.name || criteria.name,
          standardData.authority || criteria.authority,
          standardData.description || criteria.description,
          JSON.stringify(standardData)
        ]);
      }

      // Update criteria status
      await db.query(
        'UPDATE standard_criteria SET status = $1, imported_at = NOW() WHERE code = $2',
        ['imported', code]
      );

      console.log(`✅ Successfully imported standard: ${code}`);
      return { success: true, code, data: standardData };
    } catch (error) {
      console.error(`❌ Failed to import standard ${code}:`, error.message);
      throw error;
    }
  }

  /**
   * Get imported standard data
   * @param {string} code - The standard code
   * @returns {Promise<Object|null>}
   */
  async getImportedStandard(code) {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(
      'SELECT * FROM imported_standards WHERE code = $1',
      [code]
    );

    if (result.rows[0]) {
      const row = result.rows[0];
      return {
        ...row,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      };
    }

    return null;
  }

  /**
   * Get all imported standards
   * @returns {Promise<Array>}
   */
  async getAllImportedStandards() {
    if (!db.isDbConfigured) {
      throw new Error('Database not configured');
    }

    const result = await db.query(`
      SELECT id, code, name, authority, description, created_at, updated_at
      FROM imported_standards
      ORDER BY authority, name
    `);

    return result.rows;
  }
}

// Singleton instance
const standardsService = new StandardsService();

module.exports = standardsService;
