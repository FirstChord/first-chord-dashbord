const Database = require('better-sqlite3');
const path = require('path');

// Open the database
const dbPath = path.join(__dirname, 'data', 'school.db');
const db = new Database(dbPath);

// Robbie's students with their MMS IDs and Soundslice course URLs
const robbieStudents = [
  {
    mms_id: 'sdt_3ZZwJ2',
    last_name: 'Hoebe',
    first_name: 'Ailsa',
    soundslice_course: 'https://www.soundslice.com/courses/11356/'
  },
  {
    mms_id: 'sdt_w6TSJX',
    last_name: 'Darshini',
    first_name: 'Arjun',
    soundslice_course: 'https://www.soundslice.com/courses/8669/'
  },
  {
    mms_id: 'sdt_w6TSJX', // Note: This appears to be a duplicate MMS ID
    last_name: 'Mcdougall',
    first_name: 'Charlie',
    soundslice_course: 'https://www.soundslice.com/courses/12071/'
  },
  {
    mms_id: 'sdt_vrbPJL',
    last_name: 'Slocombe',
    first_name: 'Fox',
    soundslice_course: 'https://www.soundslice.com/courses/8864/'
  },
  {
    mms_id: 'sdt_vgjdJv',
    last_name: 'Gallagher',
    first_name: 'Niamh',
    soundslice_course: 'https://www.soundslice.com/courses/8619/'
  },
  {
    mms_id: 'sdt_w6T7Jd',
    last_name: 'Donaghey',
    first_name: 'Vaila',
    soundslice_course: 'https://www.soundslice.com/courses/8670/'
  },
  {
    mms_id: 'sdt_c7hKJ8',
    last_name: 'Squillino',
    first_name: 'Emiliano',
    soundslice_course: 'https://www.soundslice.com/courses/16396/'
  }
];

console.log('Updating Robbie\'s students with Soundslice course assignments...');
console.log('⚠️  Note: Arjun and Charlie appear to have the same MMS ID (sdt_w6TSJX)');

const updateStmt = db.prepare(`
  UPDATE students 
  SET soundslice_course = ?, current_tutor = 'Robbie'
  WHERE mms_id = ?
`);

const selectStmt = db.prepare(`
  SELECT name, mms_id, soundslice_course, current_tutor 
  FROM students 
  WHERE mms_id = ?
`);

let updatedCount = 0;
let errors = 0;

for (const student of robbieStudents) {
  try {
    // Check if student exists first
    const existingStudent = selectStmt.get(student.mms_id);
    
    if (!existingStudent) {
      console.log(`❌ Student ${student.first_name} ${student.last_name} (${student.mms_id}) not found in database`);
      errors++;
      continue;
    }
    
    // Update the student's Soundslice course and assign to Robbie
    const result = updateStmt.run(student.soundslice_course, student.mms_id);
    
    if (result.changes > 0) {
      console.log(`✅ Updated ${student.first_name} ${student.last_name} (${student.mms_id})`);
      console.log(`   Course: ${student.soundslice_course}`);
      console.log(`   Tutor: Robbie (was ${existingStudent.current_tutor})`);
      updatedCount++;
    } else {
      console.log(`⚠️  No changes made for ${student.first_name} ${student.last_name} (${student.mms_id})`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${student.first_name} ${student.last_name}:`, error.message);
    errors++;
  }
}

console.log(`\nUpdate complete! Updated ${updatedCount} students with ${errors} errors.`);

// Verify the updates
console.log('\nVerifying updates:');
const uniqueMmsIds = [...new Set(robbieStudents.map(s => s.mms_id))];
for (const mmsId of uniqueMmsIds) {
  const updatedStudent = selectStmt.get(mmsId);
  if (updatedStudent) {
    console.log(`${updatedStudent.name}: ${updatedStudent.soundslice_course} (Tutor: ${updatedStudent.current_tutor})`);
  }
}

db.close();
