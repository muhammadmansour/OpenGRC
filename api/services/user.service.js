/**
 * User Settings Service
 * Handles user settings and preferences
 */

const db = require('../config/database');

class UserService {
  /**
   * Get user settings from database
   */
  async getUserSettings(userId) {
    if (!db.isDbConfigured || !userId) {
      return null;
    }

    try {
      const result = await db.query(`
        SELECT * FROM user_settings
        WHERE user_id = $1
      `, [userId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching user settings:', error);
      return null;
    }
  }

  /**
   * Create or update user settings
   */
  async upsertUserSettings(userId, settings) {
    if (!db.isDbConfigured || !userId) {
      return null;
    }

    try {
      // Try update first
      const updateResult = await db.query(`
        UPDATE user_settings
        SET selected_expert_id = COALESCE($1, selected_expert_id),
            preferences = COALESCE($2, preferences),
            updated_at = NOW()
        WHERE user_id = $3
        RETURNING *
      `, [
        settings.selected_expert_id,
        settings.preferences ? JSON.stringify(settings.preferences) : null,
        userId
      ]);

      if (updateResult.rows.length > 0) {
        return updateResult.rows[0];
      }

      // Insert if not exists
      const insertResult = await db.query(`
        INSERT INTO user_settings (user_id, selected_expert_id, preferences, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING *
      `, [
        userId,
        settings.selected_expert_id || null,
        JSON.stringify(settings.preferences || {})
      ]);

      return insertResult.rows[0];
    } catch (error) {
      console.error('Error upserting user settings:', error);
      return null;
    }
  }

  /**
   * Get selected expert ID for user
   */
  async getSelectedExpert(userId) {
    if (!userId) {
      return null;
    }

    const settings = await this.getUserSettings(userId);
    return settings?.selected_expert_id || null;
  }

  /**
   * Save selected expert ID for user
   */
  async saveSelectedExpert(userId, expertId) {
    if (!userId) {
      return;
    }

    await this.upsertUserSettings(userId, {
      selected_expert_id: expertId
    });
  }

  /**
   * Clear selected expert for user
   */
  async clearSelectedExpert(userId) {
    if (!userId) {
      return;
    }

    await this.upsertUserSettings(userId, {
      selected_expert_id: null
    });
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId, preferences) {
    if (!userId) {
      return;
    }

    const currentSettings = await this.getUserSettings(userId);
    const mergedPreferences = {
      ...(currentSettings?.preferences || {}),
      ...preferences
    };

    await this.upsertUserSettings(userId, {
      preferences: mergedPreferences
    });
  }

  /**
   * Get a specific preference value
   */
  async getPreference(userId, key, defaultValue) {
    if (!userId) {
      return defaultValue;
    }

    const settings = await this.getUserSettings(userId);
    const prefs = typeof settings?.preferences === 'string' 
      ? JSON.parse(settings.preferences) 
      : settings?.preferences;
    return prefs?.[key] ?? defaultValue;
  }
}

// Singleton instance
const userService = new UserService();

module.exports = userService;
