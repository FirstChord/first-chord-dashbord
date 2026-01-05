/**
 * MMS API Explorer
 *
 * This script tests various MyMusicStaff API endpoints to discover:
 * - Available endpoints
 * - Read vs Write permissions
 * - Calendar/schedule access
 * - Data structures returned
 */

const MMS_BASE_URL = 'https://api.mymusicstaff.com/v1';
const MMS_TOKEN = 'eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJJbXBlcnNvbmF0aW5nIjpmYWxzZSwiUHJvZmlsZU1vZGUiOiJBcGlLZXkiLCJTY2hvb2xJRCI6InNjaF9GeDVKUSIsIk5hbWUiOiJGaXJzdCBDaG9yZCBEYXNoYm9hcmQiLCJBdXRoVG9rZW4iOiJha193WUpmLldKTnNhclY4NjVUOGQ5Z1dVVGNUS1VDU1h1SzY5MGJZZVB2VkE0RURMQWM9IiwiaWF0IjoxNzU1MTU0NjM1fQ.jE6sNUVTtzRoT6LVSyf_4bVt3eCFSSFq93GvA0gkxZI';
const SCHOOL_ID = 'sch_Fx5JQ';

// Test endpoints to explore
const ENDPOINTS_TO_TEST = [
  // Search endpoints (known working)
  { path: '/search/students', method: 'POST', body: { Limit: 1, Offset: 0 }, category: 'Search' },
  { path: '/search/attendance', method: 'POST', body: { Limit: 1, Offset: 0, OrderBy: '-EventStartDate' }, category: 'Search' },

  // Calendar/Schedule endpoints (to discover)
  { path: '/search/events', method: 'POST', body: { Limit: 5, Offset: 0, OrderBy: '-EventStartDate' }, category: 'Calendar' },
  { path: '/search/lessons', method: 'POST', body: { Limit: 5, Offset: 0 }, category: 'Calendar' },
  { path: '/events', method: 'GET', body: null, category: 'Calendar' },
  { path: '/calendar', method: 'GET', body: null, category: 'Calendar' },
  { path: '/schedule', method: 'GET', body: null, category: 'Calendar' },

  // Teacher endpoints
  { path: '/search/teachers', method: 'POST', body: { Limit: 5, Offset: 0 }, category: 'Teachers' },
  { path: '/teachers', method: 'GET', body: null, category: 'Teachers' },

  // Billing/Payroll endpoints
  { path: '/search/billing', method: 'POST', body: { Limit: 5, Offset: 0 }, category: 'Billing' },
  { path: '/search/payments', method: 'POST', body: { Limit: 5, Offset: 0 }, category: 'Billing' },
  { path: '/billing', method: 'GET', body: null, category: 'Billing' },
  { path: '/payroll', method: 'GET', body: null, category: 'Billing' },

  // Family/Parent endpoints
  { path: '/search/families', method: 'POST', body: { Limit: 5, Offset: 0 }, category: 'Families' },
  { path: '/families', method: 'GET', body: null, category: 'Families' },

  // Notes endpoints
  { path: '/search/notes', method: 'POST', body: { Limit: 5, Offset: 0 }, category: 'Notes' },
  { path: '/notes', method: 'GET', body: null, category: 'Notes' },

  // School/Settings endpoints
  { path: '/school', method: 'GET', body: null, category: 'School' },
  { path: '/settings', method: 'GET', body: null, category: 'School' },
];

async function testEndpoint(endpoint) {
  const url = `${MMS_BASE_URL}${endpoint.path}`;

  const options = {
    method: endpoint.method,
    headers: {
      'Authorization': `Bearer ${MMS_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'x-schoolbox-version': 'main'
    }
  };

  if (endpoint.body && endpoint.method === 'POST') {
    options.body = JSON.stringify(endpoint.body);
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }

    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      category: endpoint.category,
      status: response.status,
      statusText: response.statusText,
      success: response.ok,
      hasData: !!data,
      dataType: typeof data,
      sampleKeys: data && typeof data === 'object' ? Object.keys(data).slice(0, 10) : [],
      recordCount: data?.ItemSubset?.length || data?.length || null,
      firstRecord: data?.ItemSubset?.[0] || null,
      error: !response.ok ? (data?.message || data?.error || text.substring(0, 200)) : null
    };
  } catch (error) {
    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      category: endpoint.category,
      status: 'ERROR',
      success: false,
      error: error.message
    };
  }
}

async function exploreAPI() {
  console.log('🔍 MMS API Explorer');
  console.log('===================\n');
  console.log(`Base URL: ${MMS_BASE_URL}`);
  console.log(`School ID: ${SCHOOL_ID}`);
  console.log(`Testing ${ENDPOINTS_TO_TEST.length} endpoints in parallel...\n`);

  const results = {
    working: [],
    notFound: [],
    forbidden: [],
    errors: []
  };

  // Test all endpoints in parallel for speed
  const testPromises = ENDPOINTS_TO_TEST.map(endpoint => testEndpoint(endpoint));
  const testResults = await Promise.all(testPromises);

  // Process results
  testResults.forEach(result => {
    console.log(`Testing: ${result.method} ${result.endpoint}...`);

    if (result.success) {
      results.working.push(result);
      console.log(`  ✅ SUCCESS - Status: ${result.status}, Records: ${result.recordCount || 'N/A'}`);
    } else if (result.status === 404) {
      results.notFound.push(result);
      console.log(`  ❌ NOT FOUND (404)`);
    } else if (result.status === 403 || result.status === 401) {
      results.forbidden.push(result);
      console.log(`  🔒 FORBIDDEN (${result.status})`);
    } else {
      results.errors.push(result);
      console.log(`  ⚠️  ERROR - ${result.status}: ${result.error?.substring(0, 100)}`);
    }
  })

  console.log('\n\n📊 Summary Report');
  console.log('==================\n');

  console.log(`✅ Working Endpoints (${results.working.length}):`);
  results.working.forEach(r => {
    console.log(`   ${r.method} ${r.endpoint}`);
    console.log(`      Category: ${r.category}`);
    console.log(`      Records: ${r.recordCount || 'N/A'}`);
    console.log(`      Keys: ${r.sampleKeys.join(', ')}`);
    console.log('');
  });

  console.log(`\n❌ Not Found (${results.notFound.length}):`);
  results.notFound.forEach(r => {
    console.log(`   ${r.method} ${r.endpoint} (${r.category})`);
  });

  console.log(`\n🔒 Forbidden (${results.forbidden.length}):`);
  results.forbidden.forEach(r => {
    console.log(`   ${r.method} ${r.endpoint} (${r.category})`);
  });

  console.log(`\n⚠️  Errors (${results.errors.length}):`);
  results.errors.forEach(r => {
    console.log(`   ${r.method} ${r.endpoint} - ${r.error?.substring(0, 100)}`);
  });

  // Save detailed results to JSON
  const fs = require('fs');
  const outputPath = './mms-api-exploration-results.json';
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      working: results.working.length,
      notFound: results.notFound.length,
      forbidden: results.forbidden.length,
      errors: results.errors.length
    },
    results: results
  }, null, 2));

  console.log(`\n📄 Detailed results saved to: ${outputPath}`);

  return results;
}

// Test write permissions on known working endpoints
async function testWritePermissions() {
  console.log('\n\n🔐 Testing Write Permissions');
  console.log('=============================\n');

  const writeTests = [
    {
      name: 'Update Attendance',
      method: 'PUT',
      path: '/attendance/att_test123',
      body: { AttendanceStatus: 'Present' }
    },
    {
      name: 'Create Event',
      method: 'POST',
      path: '/events',
      body: {
        StudentID: 'sdt_test',
        TeacherID: 'tch_QhxJJ',
        EventStartDate: new Date().toISOString(),
        Duration: 30
      }
    },
    {
      name: 'Update Student Note',
      method: 'PUT',
      path: '/notes/note_test123',
      body: { StudentNote: 'Test note from API' }
    }
  ];

  console.log('⚠️  WARNING: These are test write operations');
  console.log('They may fail due to permissions or invalid IDs (expected)\n');

  for (const test of writeTests) {
    console.log(`Testing: ${test.name}...`);
    const result = await testEndpoint({
      path: test.path,
      method: test.method,
      body: test.body,
      category: 'Write Test'
    });

    console.log(`   Status: ${result.status} - ${result.success ? 'SUCCESS' : result.error?.substring(0, 100)}`);
  }
}

// Run the exploration
exploreAPI().then(async (results) => {
  // If we found working endpoints, test write permissions
  if (results.working.length > 0) {
    await testWritePermissions();
  }

  console.log('\n✅ Exploration complete!\n');
}).catch(error => {
  console.error('Fatal error:', error);
});
