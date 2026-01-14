/**
 * Test script for Gemini Evaluation API
 * Run with: node test-evaluation.js
 */

require('dotenv').config();

const testEvaluationAPI = async () => {
  const baseURL = process.env.API_URL || 'https://muraji-api.wathbahs.com/api';
  
  console.log('🧪 Testing Gemini Evaluation API\n');
  console.log('================================\n');

  // Test 1: Check status
  console.log('1️⃣  Testing status endpoint...');
  try {
    const response = await fetch(`${baseURL}/evaluations/status`);
    const data = await response.json();
    console.log('   Status:', data.status);
    console.log('   Available:', data.available);
    console.log('   ✅ Status check passed\n');
  } catch (error) {
    console.log('   ❌ Status check failed:', error.message, '\n');
    console.log('   ⚠️  Make sure the API server is running: npm run dev\n');
    return;
  }

  // Test 2: Quick analysis
  console.log('2️⃣  Testing quick analysis...');
  try {
    const response = await fetch(`${baseURL}/evaluations/quick-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Employ FIPS-validated cryptography',
        description: 'This is a comprehensive description of cryptography requirements including FIPS validation, key management, and encryption standards.',
        fileCount: 3
      })
    });
    const data = await response.json();
    console.log('   Readiness Score:', data.quickAnalysis.readinessScore);
    console.log('   Readiness Level:', data.quickAnalysis.readinessLevel);
    console.log('   Can Proceed:', data.quickAnalysis.canProceedWithFullEvaluation);
    console.log('   ✅ Quick analysis passed\n');
  } catch (error) {
    console.log('   ❌ Quick analysis failed:', error.message, '\n');
  }

  // Test 3: Full evaluation (only if GEMINI_API_KEY is set)
  if (process.env.GEMINI_API_KEY) {
    console.log('3️⃣  Testing full AI evaluation...');
    console.log('   This may take 10-30 seconds...');
    try {
      const response = await fetch(`${baseURL}/evaluations/audit-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Employ FIPS-validated cryptography when used to protect the confidentiality of CUI',
          code: '3.13.11',
          description: 'Cryptography can be employed to support many security solutions including the protection of controlled unclassified information.',
          discussion: 'Cryptographic standards include FIPS-validated cryptography and/or NSA-approved cryptography.',
          applicability: 'Applicable',
          fileNames: ['crypto-policy.pdf', 'implementation-guide.docx'],
          fileContents: [
            'Company Cryptography Policy: All cryptographic systems must be FIPS 140-2 validated. We use AES-256 for data encryption.',
            'Implementation Guide: Step-by-step procedures for implementing FIPS-validated cryptography in our systems.'
          ]
        })
      });
      const data = await response.json();
      
      if (data.success) {
        console.log('   Status:', data.evaluation.status);
        console.log('   Score:', data.evaluation.score);
        console.log('   Compliance:', data.evaluation.complianceLevel);
        console.log('   Evidence Quality:', data.evaluation.evidenceQuality);
        console.log('   Summary:', data.evaluation.summary);
        console.log('   ✅ Full evaluation passed\n');
      } else {
        console.log('   ⚠️  Evaluation returned error:', data.message, '\n');
      }
    } catch (error) {
      console.log('   ❌ Full evaluation failed:', error.message, '\n');
    }
  } else {
    console.log('3️⃣  Skipping full AI evaluation');
    console.log('   ⚠️  GEMINI_API_KEY not set in .env file');
    console.log('   To test full evaluation:');
    console.log('   1. Get API key from https://makersuite.google.com/app/apikey');
    console.log('   2. Add to .env: GEMINI_API_KEY=your_key_here');
    console.log('   3. Run this test again\n');
  }

  console.log('================================');
  console.log('✅ All available tests completed!');
  console.log('\nFor full documentation, see: api/EVALUATION_API_GUIDE.md');
};

// Run tests
testEvaluationAPI().catch(console.error);
