/**
 * Import/Update Qyias Library Script
 * 
 * This script will:
 * - Delete the existing DGA/Qyias library (if exists)
 * - Create the new library with updated data
 * 
 * Run: node api/scripts/import-qyias.js
 */

const fs = require('fs');
const path = require('path');

// Production API URL
const API_BASE_URL = process.env.API_URL || 'https://muraji-api.wathbahs.com';

// Known library ID from production (DGA Qyias library)
const EXISTING_LIBRARY_ID = '4ffff593-eed2-417a-97a8-620b887f4ca6';

async function importLibrary() {
  try {
    // Read the library JSON file
    const libraryPath = path.join(__dirname, 'qyias-library.json');
    const libraryData = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));

    console.log(`📚 Processing library: ${libraryData.name}`);
    console.log(`   URN: ${libraryData.urn}`);
    console.log(`   Version: ${libraryData.version}`);
    console.log(`   Controls: ${libraryData.content.framework.requirement_nodes.length} requirement nodes`);
    console.log(`   API: ${API_BASE_URL}`);

    // Step 1: Delete the existing library
    console.log('\n🗑️  Step 1: Deleting existing DGA library...');
    console.log(`   Library ID: ${EXISTING_LIBRARY_ID}`);
    
    const deleteResponse = await fetch(`${API_BASE_URL}/api/libraries/${EXISTING_LIBRARY_ID}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (deleteResponse.ok) {
      console.log('   ✅ Existing library deleted successfully');
    } else if (deleteResponse.status === 404) {
      console.log('   ⚠️  Library not found (may already be deleted)');
    } else {
      const error = await deleteResponse.json();
      console.log(`   ⚠️  Delete warning: ${error.message || 'Unknown error'}`);
    }

    // Step 2: Create the new library
    console.log('\n📝 Step 2: Creating new library with updated data...');
    
    const createResponse = await fetch(`${API_BASE_URL}/api/libraries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(libraryData),
    });

    const result = await createResponse.json();

    if (createResponse.ok) {
      console.log('\n✅ Library created successfully!');
      console.log(`   ID: ${result.data.id}`);
      console.log(`   Name: ${result.data.name}`);
      console.log(`   URN: ${result.data.urn}`);
    } else {
      console.error('\n❌ Failed to create library:');
      console.error(`   Error: ${result.error}`);
      console.error(`   Message: ${result.message}`);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Make sure the API server is running on', API_BASE_URL);
    }
  }
}

importLibrary();
