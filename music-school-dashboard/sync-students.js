// Test database and sync students from MMS
const { PrismaClient } = require('./lib/generated/prisma');
const mmsClient = require('./lib/mms-client.js').default;

const prisma = new PrismaClient();

async function syncStudentsFromMMS() {
  try {
    console.log('🔄 Starting student sync from MMS...');
    
    // Test database connection first
    console.log('📊 Testing database connection...');
    const studentCount = await prisma.student.count();
    console.log(`✅ Database connected. Current student count: ${studentCount}`);
    
    // Get students from MMS
    console.log('📡 Fetching students from MMS...');
    const mmsResult = await mmsClient.getStudentsForTeacher('Arion');
    
    if (mmsResult.success) {
      console.log(`✅ Got ${mmsResult.students.length} students from MMS`);
      
      // Clear existing students for this tutor
      await prisma.student.deleteMany({ where: { tutor: 'Arion' } });
      console.log('🗑️ Cleared existing students for Arion');
      
      // Insert new students
      const studentsToInsert = mmsResult.students.map(student => ({
        name: student.name,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email || '',
        tutor: 'Arion',
        mms_id: student.mms_id,
        status: student.status,
        instrument: student.instrument || 'Guitar',
        parent_email: student.parent_email || '',
        family_id: student.family_id,
        next_event_date: student.next_event_date,
        profile_picture_url: student.profile_picture_url,
        is_active: student.is_active
      }));
      
      const result = await prisma.student.createMany({
        data: studentsToInsert
      });
      
      console.log(`✅ Inserted ${result.count} students into database`);
      
      // Verify the data
      const dbStudents = await prisma.student.findMany({ where: { tutor: 'Arion' } });
      console.log(`✅ Database now has ${dbStudents.length} students for Arion`);
      
    } else {
      console.error('❌ Failed to get students from MMS:', mmsResult.message);
    }
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncStudentsFromMMS();
