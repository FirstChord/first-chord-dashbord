const Database = require('better-sqlite3');
const path = require('path');

// Open the database
const dbPath = path.join(__dirname, 'data', 'school.db');
const db = new Database(dbPath);

// Kim's students with their MMS IDs and Soundslice course URLs
const kimStudents = [
  {
    mms_id: 'sdt_BkflJy',
    last_name: 'Barnes',
    first_name: 'Rueben',
    soundslice_course: 'https://www.soundslice.com/courses/7950/'
  },
  {
    mms_id: 'sdt_DfTRJT',
    last_name: 'Li',
    first_name: 'Kin Shing Kenson',
    soundslice_course: 'https://www.soundslice.com/courses/10815/'
  },
  {
    mms_id: 'sdt_HbXMJZ',
    last_name: 'Jackson',
    first_name: 'Lyra',
    soundslice_course: 'https://www.soundslice.com/courses/13588/'
  },
  {
    mms_id: 'sdt_38MBJF',
    last_name: 'Chalmers',
    first_name: 'Mark',
    soundslice_course: 'https://www.soundslice.com/courses/11529/'
  },
  {
    mms_id: 'sdt_Fq8vJj',
    last_name: 'Wallace',
    first_name: 'Oscar',
    soundslice_course: 'https://www.soundslice.com/courses/4833/'
  },
  {
    mms_id: 'sdt_QcCtJT',
    last_name: 'Marco',
    first_name: 'Sarconi',
    soundslice_course: 'https://www.soundslice.com/courses/15425/'
  },
  {
    mms_id: 'sdt_QbBNJq',
    last_name: 'Bingley',
    first_name: 'Caroline',
    soundslice_course: 'https://www.soundslice.com/courses/15543/'
  }
];

console.log('Updating Kim\'s students with Soundslice course assignments...');

const updateStmt = db.prepare(`
  UPDATE students 
  SET soundslice_course = ?, current_tutor = 'Kim'
  WHERE mms_id = ?
`);

const selectStmt = db.prepare(`
  SELECT name, mms_id, soundslice_course, current_tutor 
  FROM students 
  WHERE mms_id = ?
`);

let updatedCount = 0;
let errors = 0;

for (const student of kimStudents) {
  try {
    // Check if student exists first
    const existingStudent = selectStmt.get(student.mms_id);
    
    if (!existingStudent) {
      console.log(`❌ Student ${student.first_name} ${student.last_name} (${student.mms_id}) not found in database`);
      errors++;
      continue;
    }
    
    // Update the student's Soundslice course and assign to Kim
    const result = updateStmt.run(student.soundslice_course, student.mms_id);
    
    if (result.changes > 0) {
      console.log(`✅ Updated ${student.first_name} ${student.last_name} (${student.mms_id})`);
      console.log(`   Course: ${student.soundslice_course}`);
      console.log(`   Tutor: Kim (was ${existingStudent.current_tutor})`);
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
for (const student of kimStudents) {
  const updatedStudent = selectStmt.get(student.mms_id);
  if (updatedStudent) {
    console.log(`${updatedStudent.name}: ${updatedStudent.soundslice_course} (Tutor: ${updatedStudent.current_tutor})`);
  }
}

db.close();
