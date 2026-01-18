/**
 * Database Configuration
 * MySQL connection pool setup
 */

const mysql = require('mysql2/promise');
const config = require('./index');

// Create MySQL connection pool
let pool = null;
let isDbConfigured = false;

// Check if MySQL is configured
if (config.mysql.host && config.mysql.database) {
  try {
    pool = mysql.createPool(config.mysql);
    isDbConfigured = true;
    
    // Test connection on startup
    pool.query('SELECT 1')
      .then(() => {
        console.log('✅ MySQL connected successfully');
      })
      .catch(err => {
        console.error('❌ MySQL connection error:', err.message);
        isDbConfigured = false;
      });

  } catch (err) {
    console.error('❌ Failed to create MySQL pool:', err.message);
    isDbConfigured = false;
  }
} else {
  console.warn('⚠️ MySQL not configured. Database operations will fail.');
}

/**
 * Execute a query with parameters
 * @param {string} text - SQL query (uses ? placeholders)
 * @param {Array} params - Query parameters
 * @returns {Promise<{rows: Array, rowCount: number}>}
 */
async function query(text, params = []) {
  if (!pool) {
    throw new Error('Database not configured');
  }
  const start = Date.now();
  const [rows, fields] = await pool.query(text, params);
  const duration = Date.now() - start;
  if (config.nodeEnv === 'development') {
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: Array.isArray(rows) ? rows.length : 0 });
  }
  // Return in PostgreSQL-compatible format for easier migration
  return { 
    rows: Array.isArray(rows) ? rows : [rows], 
    rowCount: Array.isArray(rows) ? rows.length : (rows.affectedRows || 0)
  };
}

/**
 * Get a connection from the pool for transactions
 * @returns {Promise<Connection>}
 */
async function getClient() {
  if (!pool) {
    throw new Error('Database not configured');
  }
  return pool.getConnection();
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
  const placeholders = keys.map(() => '?').join(', ');
  const columns = keys.join(', ');
  
  const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
  const [result] = await pool.query(sql, values);
  
  // Fetch the inserted row
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [result.insertId]);
  return rows[0];
}

/**
 * Helper: Update and return the updated row
 */
async function updateOne(table, id, data, idColumn = 'id') {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(key => `${key} = ?`).join(', ');
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = ?`;
  await pool.query(sql, [...values, id]);
  
  // Fetch the updated row
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [id]);
  return rows[0];
}

/**
 * Helper: Find one by ID
 */
async function findById(table, id, idColumn = 'id') {
  const sql = `SELECT * FROM ${table} WHERE ${idColumn} = ?`;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

/**
 * Helper: Find all with optional conditions
 */
async function findAll(table, conditions = {}, orderBy = 'created_at DESC', limit = null) {
  let sql = `SELECT * FROM ${table}`;
  const values = [];
  
  const conditionKeys = Object.keys(conditions);
  if (conditionKeys.length > 0) {
    const whereClause = conditionKeys.map(key => `${key} = ?`).join(' AND ');
    sql += ` WHERE ${whereClause}`;
    values.push(...Object.values(conditions));
  }
  
  if (orderBy) {
    sql += ` ORDER BY ${orderBy}`;
  }
  
  if (limit) {
    sql += ` LIMIT ${parseInt(limit)}`;
  }
  
  const [rows] = await pool.query(sql, values);
  return rows;
}

/**
 * Helper: Delete by ID
 */
async function deleteById(table, id, idColumn = 'id') {
  const sql = `DELETE FROM ${table} WHERE ${idColumn} = ?`;
  const [result] = await pool.query(sql, [id]);
  return result.affectedRows > 0;
}

/**
 * Helper: Count rows
 */
async function count(table, conditions = {}) {
  let sql = `SELECT COUNT(*) as count FROM ${table}`;
  const values = [];
  
  const conditionKeys = Object.keys(conditions);
  if (conditionKeys.length > 0) {
    const whereClause = conditionKeys.map(key => `${key} = ?`).join(' AND ');
    sql += ` WHERE ${whereClause}`;
    values.push(...Object.values(conditions));
  }
  
  const [rows] = await pool.query(sql, values);
  return parseInt(rows[0].count);
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
