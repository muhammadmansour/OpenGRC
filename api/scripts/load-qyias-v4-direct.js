#!/usr/bin/env node
/**
 * Direct DB loader for Qyias V4 library
 * 
 * This script:
 * 1. Ensures the core_storedlibrary table exists (runs migration if needed)
 * 2. Reads qyias-v4-library.json
 * 3. Inserts/upserts the library directly into PostgreSQL
 * 
 * Usage: node scripts/load-qyias-v4-direct.js
 * 
 * Environment variables (or uses defaults from .env):
 *   PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

// Load .env if available
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...vals] = line.split('=');
      if (key && vals.length) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    });
  }
} catch (e) { /* ignore */ }

const DB_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE || 'morage',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'password123',
};

async function main() {
  const jsonPath = path.join(__dirname, 'qyias-v4-library.json');

  console.log('=== Direct DB Loader: Qyias V4 ===\n');
  console.log(`📂 JSON source: ${jsonPath}`);
  console.log(`🗄️  Database: ${DB_CONFIG.database}@${DB_CONFIG.host}:${DB_CONFIG.port}\n`);

  // 1. Read the library JSON
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ File not found:', jsonPath);
    process.exit(1);
  }

  const libraryData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`✅ Loaded library: ${libraryData.name}`);
  console.log(`   URN: ${libraryData.urn}`);
  console.log(`   Requirement nodes: ${libraryData.content?.framework?.requirement_nodes?.length || 0}`);

  // 2. Generate hash
  const contentString = JSON.stringify(libraryData.content);
  const hashChecksum = crypto.createHash('sha256').update(contentString).digest('hex');
  console.log(`   Hash: ${hashChecksum.substring(0, 16)}...`);

  // 3. Connect to DB
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    console.log('\n🔌 Connected to PostgreSQL');

    // 4. Ensure UUID extension exists
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // 5. Create table if not exists
    console.log('📋 Ensuring core_storedlibrary table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS core_storedlibrary (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        urn VARCHAR(255),
        ref_id VARCHAR(100),
        provider VARCHAR(200),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        annotation TEXT,
        translations JSONB,
        locale VARCHAR(100) NOT NULL DEFAULT 'en',
        default_locale BOOLEAN NOT NULL DEFAULT TRUE,
        copyright VARCHAR(4096),
        version INTEGER NOT NULL,
        packager VARCHAR(100),
        publication_date DATE,
        builtin BOOLEAN NOT NULL DEFAULT FALSE,
        objects_meta JSONB NOT NULL DEFAULT '{}',
        dependencies JSONB,
        is_loaded BOOLEAN NOT NULL DEFAULT FALSE,
        hash_checksum VARCHAR(64) NOT NULL,
        content JSONB NOT NULL,
        autoload BOOLEAN NOT NULL DEFAULT FALSE,
        CONSTRAINT core_storedlibrary_unique_urn_locale_version 
          UNIQUE (urn, locale, version)
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_storedlibrary_urn ON core_storedlibrary(urn)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_storedlibrary_hash ON core_storedlibrary(hash_checksum)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_storedlibrary_is_loaded ON core_storedlibrary(is_loaded)');
    console.log('   ✅ Table ready');

    // 6. Check if library already exists
    const existing = await client.query(
      'SELECT id, name, is_loaded FROM core_storedlibrary WHERE urn = $1 AND locale = $2 AND version = $3',
      [libraryData.urn, libraryData.locale || 'ar', libraryData.version || 1]
    );

    const objectsMeta = libraryData.objects_meta || {
      framework: 1,
      requirement_node: libraryData.content?.framework?.requirement_nodes?.length || 0,
    };

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      console.log(`\n⚠️  Library already exists (ID: ${row.id}, is_loaded: ${row.is_loaded})`);
      console.log('   Updating with latest content...');

      await client.query(`
        UPDATE core_storedlibrary SET
          ref_id = $1,
          provider = $2,
          name = $3,
          description = $4,
          copyright = $5,
          version = $6,
          packager = $7,
          publication_date = $8,
          objects_meta = $9,
          hash_checksum = $10,
          content = $11,
          is_loaded = TRUE,
          is_published = TRUE,
          updated_at = NOW()
        WHERE urn = $12 AND locale = $13 AND version = $14
        RETURNING id
      `, [
        libraryData.ref_id || 'qyias-digital-transformation-standards-v4',
        libraryData.provider || 'DGA',
        libraryData.name,
        libraryData.description || '',
        libraryData.copyright || '',
        libraryData.version || 1,
        libraryData.packager || 'wathba',
        libraryData.publication_date || '2024-03-19',
        JSON.stringify(objectsMeta),
        hashChecksum,
        JSON.stringify(libraryData.content),
        libraryData.urn,
        libraryData.locale || 'ar',
        libraryData.version || 1,
      ]);

      console.log('   ✅ Updated successfully (is_loaded = TRUE)');
    } else {
      console.log('\n📥 Inserting new library...');

      const result = await client.query(`
        INSERT INTO core_storedlibrary (
          urn, ref_id, provider, name, description, annotation, translations,
          locale, default_locale, copyright, version, packager, publication_date,
          builtin, objects_meta, dependencies, is_loaded, hash_checksum, content,
          autoload, is_published
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          $20, $21
        ) RETURNING id
      `, [
        libraryData.urn,
        libraryData.ref_id || 'qyias-digital-transformation-standards-v4',
        libraryData.provider || 'DGA',
        libraryData.name,
        libraryData.description || '',
        null,  // annotation
        null,  // translations
        libraryData.locale || 'ar',
        true,  // default_locale
        libraryData.copyright || '',
        libraryData.version || 1,
        libraryData.packager || 'wathba',
        libraryData.publication_date || '2024-03-19',
        false, // builtin
        JSON.stringify(objectsMeta),
        null,  // dependencies
        true,  // is_loaded = TRUE (marking as loaded directly)
        hashChecksum,
        JSON.stringify(libraryData.content),
        false, // autoload
        true,  // is_published
      ]);

      console.log(`   ✅ Inserted with ID: ${result.rows[0].id}`);
    }

    // 7. Verify
    const verify = await client.query(
      'SELECT id, name, urn, is_loaded, is_published, objects_meta FROM core_storedlibrary WHERE urn = $1',
      [libraryData.urn]
    );

    if (verify.rows.length > 0) {
      const lib = verify.rows[0];
      console.log('\n📊 Verification:');
      console.log(`   ID:           ${lib.id}`);
      console.log(`   Name:         ${lib.name}`);
      console.log(`   URN:          ${lib.urn}`);
      console.log(`   is_loaded:    ${lib.is_loaded}`);
      console.log(`   is_published: ${lib.is_published}`);
      console.log(`   objects_meta: ${JSON.stringify(lib.objects_meta)}`);
    }

    // 8. Show all libraries in table
    const all = await client.query('SELECT id, name, urn, is_loaded FROM core_storedlibrary ORDER BY created_at');
    console.log(`\n📚 All libraries in core_storedlibrary (${all.rows.length} total):`);
    all.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.name} (loaded: ${row.is_loaded}) - ${row.urn}`);
    });

    console.log('\n✅ Done!');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
