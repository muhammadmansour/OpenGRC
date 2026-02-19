/**
 * Import Saudi PDPL Library Script
 * 
 * This script will:
 * - Check if the PDPL library already exists
 * - Create a new library or update the existing one
 * 
 * Run: node api/scripts/import-pdpl.js
 * 
 * Optional env: API_URL (defaults to https://muraji-api.wathbahs.com)
 */

const fs = require('fs');
const path = require('path');

// API URL - change for local development
const API_BASE_URL = process.env.API_URL || 'https://muraji-api.wathbahs.com';

async function importLibrary() {
  try {
    // Read the library JSON file
    const libraryPath = path.join(__dirname, 'saudi-pdpl-library.json');
    const libraryData = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));

    console.log(`📚 Processing library: ${libraryData.name}`);
    console.log(`   URN: ${libraryData.urn}`);
    console.log(`   Ref ID: ${libraryData.ref_id}`);
    console.log(`   Provider: ${libraryData.provider}`);
    console.log(`   Version: ${libraryData.version}`);
    console.log(`   Requirement Nodes: ${libraryData.content.framework.requirement_nodes.length}`);
    console.log(`   Assessable: ${libraryData.content.framework.requirement_nodes.filter(n => n.assessable).length}`);
    console.log(`   Scores: ${libraryData.content.framework.scores.length} levels`);
    console.log(`   API: ${API_BASE_URL}`);

    // Step 1: Check if library already exists by URN
    console.log('\n🔍 Step 1: Checking if PDPL library already exists...');
    
    const searchResponse = await fetch(`${API_BASE_URL}/api/libraries?search=PDPL`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    let existingId = null;
    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      const existing = (searchResult.data || []).find(lib => 
        lib.urn === libraryData.urn || lib.ref_id === libraryData.ref_id
      );
      if (existing) {
        existingId = existing.id;
        console.log(`   ⚠️  Found existing library: ${existing.name} (ID: ${existingId})`);
      } else {
        console.log('   ✅ No existing PDPL library found');
      }
    }

    if (existingId) {
      // Update existing library
      console.log('\n📝 Step 2: Updating existing library...');
      
      const updateResponse = await fetch(`${API_BASE_URL}/api/libraries/${existingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(libraryData),
      });

      const result = await updateResponse.json();

      if (updateResponse.ok) {
        console.log('\n✅ Library updated successfully!');
        console.log(`   ID: ${result.data?.id || existingId}`);
        console.log(`   Name: ${result.data?.name || libraryData.name}`);
      } else {
        console.error('\n❌ Failed to update library:');
        console.error(`   Error: ${result.error}`);
        console.error(`   Message: ${result.message}`);
        
        // If update fails, try delete + create
        console.log('\n🔄 Trying delete + create approach...');
        
        const deleteResponse = await fetch(`${API_BASE_URL}/api/libraries/${existingId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });

        if (deleteResponse.ok) {
          console.log('   ✅ Old library deleted');
          existingId = null; // Fall through to create
        } else {
          console.error('   ❌ Could not delete old library');
          process.exit(1);
        }
      }
    }

    if (!existingId) {
      // Create new library
      console.log('\n📝 Step 2: Creating new library...');
      
      const createResponse = await fetch(`${API_BASE_URL}/api/libraries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(libraryData),
      });

      const result = await createResponse.json();

      if (createResponse.ok || createResponse.status === 201) {
        console.log('\n✅ Library created successfully!');
        console.log(`   ID: ${result.data?.id}`);
        console.log(`   Name: ${result.data?.name}`);
        console.log(`   URN: ${result.data?.urn}`);
      } else {
        console.error('\n❌ Failed to create library:');
        console.error(`   Status: ${createResponse.status}`);
        console.error(`   Error: ${result.error}`);
        console.error(`   Message: ${result.message}`);
        process.exit(1);
      }
    }

    console.log('\n🎉 Saudi PDPL library import complete!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Make sure the API server is running on', API_BASE_URL);
    }
    process.exit(1);
  }
}

importLibrary();
