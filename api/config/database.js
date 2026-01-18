/**
 * Database Configuration
 * PostgreSQL connection pool setup
 */

const { Pool } = require('pg');
const config = require('./index');

// Create PostgreSQL connection pool
let pool = null;
let isDbConfigured = false;

// Check if PostgreSQL is configured
if (config.postgres.host && config.postgres.database) {
  try {
    pool = new Pool(config.postgres);
    isDbConfigured = true;
    
    // Test connection on startup
    pool.query('SELECT NOW()')
      .then(() => {
        console.log('✅ PostgreSQL connected successfully');
      })
      .catch(err => {
        console.error('❌ PostgreSQL connection error:', err.message);
        isDbConfigured = false;
      });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });

  } catch (err) {
    console.error('❌ Failed to create PostgreSQL pool:', err.message);
    isDbConfigured = false;
  }
} else {
  console.warn('⚠️ PostgreSQL not configured. Database operations will fail.');
}

/**
 * Execute a query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<{rows: Array, rowCount: number}>}
 */
async function query(text, params) {
  if (!pool) {
    throw new Error('Database not configured');
  }
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (config.nodeEnv === 'development') {
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
  }
  return result;
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Client>}
 */
async function getClient() {
  if (!pool) {
    throw new Error('Database not configured');
  }
  return pool.connect();
}

/**
 * Check database connection
 */
async function checkConnection() {
  if (!pool) {
    throw new Error('Database not configured');
  }
  await pool.query('SELECT 1');
  return true;
}

/**
 * Helper: Insert and return the inserted row
 */
async function insertOne(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.join(', ');
  
  const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Helper: Update and return the updated row
 */
async function updateOne(table, id, data, idColumn = 'id') {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = $${keys.length + 1} RETURNING *`;
  const result = await query(sql, [...values, id]);
  return result.rows[0];
}

/**
 * Helper: Find one by ID
 */
async function findById(table, id, idColumn = 'id') {
  const sql = `SELECT * FROM ${table} WHERE ${idColumn} = $1`;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Helper: Find all with optional conditions
 */
async function findAll(table, conditions = {}, orderBy = 'created_at DESC', limit = null) {
  let sql = `SELECT * FROM ${table}`;
  const values = [];
  
  const conditionKeys = Object.keys(conditions);
  if (conditionKeys.length > 0) {
    const whereClause = conditionKeys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    sql += ` WHERE ${whereClause}`;
    values.push(...Object.values(conditions));
  }
  
  if (orderBy) {
    sql += ` ORDER BY ${orderBy}`;
  }
  
  if (limit) {
    sql += ` LIMIT ${parseInt(limit)}`;
  }
  
  const result = await query(sql, values);
  return result.rows;
}

/**
 * Helper: Delete by ID
 */
async function deleteById(table, id, idColumn = 'id') {
  const sql = `DELETE FROM ${table} WHERE ${idColumn} = $1 RETURNING *`;
  const result = await query(sql, [id]);
  return result.rowCount > 0;
}

/**
 * Helper: Count rows
 */
async function count(table, conditions = {}) {
  let sql = `SELECT COUNT(*) as count FROM ${table}`;
  const values = [];
  
  const conditionKeys = Object.keys(conditions);
  if (conditionKeys.length > 0) {
    const whereClause = conditionKeys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    sql += ` WHERE ${whereClause}`;
    values.push(...Object.values(conditions));
  }
  
  const result = await query(sql, values);
  return parseInt(result.rows[0].count);
}

module.exports = {
  pool,
  query,
  getClient,
  checkConnection,
  isDbConfigured,
  // Helper functions
  insertOne,
  updateOne,
  findById,
  findAll,
  deleteById,
  count
};
