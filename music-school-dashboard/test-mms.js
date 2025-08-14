// Test MMS API directly
const mmsClient = require('./lib/mms-client.js').default;

async function testMMS() {
  console.log('Testing hardcoded MMS token...');
  
  try {
    const result = await mmsClient.getStudentsForTeacher('Arion');
    console.log('MMS Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('MMS Error:', error);
  }
}

testMMS();
