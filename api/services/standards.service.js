/**
 * Standards Service
 * Handles audit standards and criteria management
 */

const yaml = require('js-yaml');
const db = require('../config/database');

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
}

// Singleton instance
const standardsService = new StandardsService();

module.exports = standardsService;
