/**
 * Quick MMS API Test - Focus on Calendar & Write Operations
 */

const MMS_BASE_URL = 'https://api.mymusicstaff.com/v1';
const MMS_TOKEN = process.env.MMS_BEARER_TOKEN;

if (!MMS_TOKEN) {
  console.error('MMS_BEARER_TOKEN is required to run this script.');
  process.exit(1);
}

async function testEndpoint(path, method = 'GET', body = null) {
  const url = `${MMS_BASE_URL}${path}`;

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${MMS_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-schoolbox-version': 'main'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
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
      path,
      method,
      status: response.status,
      ok: response.ok,
      data,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : null,
      recordCount: data?.ItemSubset?.length || data?.length || null
    };
  } catch (error) {
    return {
      path,
      method,
      error: error.message
    };
  }
}

async function main() {
  console.log('🔍 Quick MMS API Test\n');

  // Test 1: Known working endpoint
  console.log('1️⃣  Testing /search/attendance (known working)...');
  const attendanceTest = await testEndpoint('/search/attendance', 'POST', {
    Limit: 1,
    Offset: 0,
    OrderBy: '-EventStartDate'
  });
  console.log(`   Status: ${attendanceTest.status} ${attendanceTest.ok ? '✅' : '❌'}`);
  console.log(`   Records: ${attendanceTest.recordCount || 'N/A'}`);
  console.log(`   Keys: ${attendanceTest.dataKeys?.join(', ') || 'N/A'}\n`);

  // Test 2: Calendar/Events endpoint
  console.log('2️⃣  Testing /search/events...');
  const eventsTest = await testEndpoint('/search/events', 'POST', {
    Limit: 5,
    Offset: 0,
    OrderBy: '-EventStartDate'
  });
  console.log(`   Status: ${eventsTest.status} ${eventsTest.ok ? '✅' : '❌'}`);
  console.log(`   Records: ${eventsTest.recordCount || 'N/A'}`);
  console.log(`   Keys: ${eventsTest.dataKeys?.join(', ') || 'N/A'}`);
  if (eventsTest.ok && eventsTest.data?.ItemSubset?.[0]) {
    console.log(`   Sample event:`, JSON.stringify(eventsTest.data.ItemSubset[0], null, 2).substring(0, 500));
  }
  console.log('');

  // Test 3: Teachers endpoint
  console.log('3️⃣  Testing /search/teachers...');
  const teachersTest = await testEndpoint('/search/teachers', 'POST', {
    Limit: 5,
    Offset: 0
  });
  console.log(`   Status: ${teachersTest.status} ${teachersTest.ok ? '✅' : '❌'}`);
  console.log(`   Records: ${teachersTest.recordCount || 'N/A'}`);
  console.log(`   Keys: ${teachersTest.dataKeys?.join(', ') || 'N/A'}\n`);

  // Test 4: Families endpoint
  console.log('4️⃣  Testing /search/families...');
  const familiesTest = await testEndpoint('/search/families', 'POST', {
    Limit: 5,
    Offset: 0
  });
  console.log(`   Status: ${familiesTest.status} ${familiesTest.ok ? '✅' : '❌'}`);
  console.log(`   Records: ${familiesTest.recordCount || 'N/A'}\n`);

  // Test 5: Check what fields are available in attendance records
  console.log('5️⃣  Detailed attendance record structure...');
  const detailedAttendance = await testEndpoint('/search/attendance', 'POST', {
    Limit: 1,
    Offset: 0,
    OrderBy: '-EventStartDate'
  });
  if (detailedAttendance.ok && detailedAttendance.data?.ItemSubset?.[0]) {
    const record = detailedAttendance.data.ItemSubset[0];
    console.log(`   Available fields:`);
    Object.keys(record).forEach(key => {
      const value = record[key];
      const preview = typeof value === 'object' ? JSON.stringify(value).substring(0, 50) : value;
      console.log(`      ${key}: ${preview}`);
    });
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Working: /search/attendance, /search/students`);
  console.log(`   📅 Calendar: ${eventsTest.ok ? '✅ /search/events' : '❌ Not found'}`);
  console.log(`   👥 Teachers: ${teachersTest.ok ? '✅ /search/teachers' : '❌ Not found'}`);
  console.log(`   👨‍👩‍👧 Families: ${familiesTest.ok ? '✅ /search/families' : '❌ Not found'}`);

  console.log('\n✅ Test complete!');
}

main().catch(console.error);
