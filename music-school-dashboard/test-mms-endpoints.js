// Test MMS API endpoints from within the dashboard context
import mmsClient from './lib/mms-client.js';

async function testEndpoints() {
  console.log('🔍 Testing MMS API Endpoints\n');

  // Test 1: Get attendance (known working)
  console.log('1️⃣  Testing attendance endpoint...');
  const attendance = await mmsClient.getStudentNotes('sdt_H6CvJv');
  console.log('   Result:', attendance.success ? '✅' : '❌');
  if (attendance.success) {
    console.log('   Date:', attendance.date);
    console.log('   Tutor:', attendance.tutor);
  }
  console.log('');

  // Test 2: Try to fetch events directly
  console.log('2️⃣  Testing /search/events endpoint...');
  try {
    const eventsResult = await mmsClient.fetchFromMMS('/search/events', 'POST', {
      Limit: 5,
      Offset: 0,
      OrderBy: '-EventStartDate'
    });
    console.log('   Result:', eventsResult.success ? '✅' : '❌');
    if (eventsResult.success && eventsResult.data) {
      console.log('   Record count:', eventsResult.data.ItemSubset?.length || eventsResult.data.TotalCount || 'N/A');
      console.log('   Available keys:', Object.keys(eventsResult.data).join(', '));

      if (eventsResult.data.ItemSubset && eventsResult.data.ItemSubset[0]) {
        console.log('   Sample event keys:', Object.keys(eventsResult.data.ItemSubset[0]).join(', '));
        console.log('   Sample event:', JSON.stringify(eventsResult.data.ItemSubset[0], null, 2).substring(0, 800));
      }
    } else {
      console.log('   Error:', eventsResult.error);
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }
  console.log('');

  // Test 3: Try to fetch lessons
  console.log('3️⃣  Testing /search/lessons endpoint...');
  try {
    const lessonsResult = await mmsClient.fetchFromMMS('/search/lessons', 'POST', {
      Limit: 5,
      Offset: 0
    });
    console.log('   Result:', lessonsResult.success ? '✅' : '❌');
    if (lessonsResult.success && lessonsResult.data) {
      console.log('   Record count:', lessonsResult.data.ItemSubset?.length || 'N/A');
    } else {
      console.log('   Error:', lessonsResult.error);
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }
  console.log('');

  // Test 4: Get detailed attendance record to see calendar info
  console.log('4️⃣  Examining attendance record structure for calendar data...');
  try {
    const detailedAttendance = await mmsClient.fetchFromMMS('/search/attendance', 'POST', {
      Limit: 1,
      Offset: 0,
      OrderBy: '-EventStartDate'
    });

    if (detailedAttendance.success && detailedAttendance.data?.ItemSubset?.[0]) {
      const record = detailedAttendance.data.ItemSubset[0];
      console.log('   Available fields in attendance record:');
      Object.keys(record).sort().forEach(key => {
        const value = record[key];
        let preview;
        if (typeof value === 'object' && value !== null) {
          preview = `{${Object.keys(value).join(', ')}}`;
        } else if (typeof value === 'string' && value.length > 50) {
          preview = value.substring(0, 50) + '...';
        } else {
          preview = value;
        }
        console.log(`      ${key}: ${preview}`);
      });
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }
  console.log('');

  console.log('✅ Test complete!\n');
}

testEndpoints().catch(console.error);
