const Database = require('better-sqlite3');
const path = require('path');

// Open the database
const dbPath = path.join(__dirname, 'data', 'school.db');
const db = new Database(dbPath);

// Stef's students with their MMS IDs and Soundslice course URLs
const stefStudents = [
  {
    mms_id: 'sdt_NSmPJr',
    last_name: 'Garcia Bree',
    first_name: 'Ava',
    soundslice_course: 'https://www.soundslice.com/courses/10024/'
  },
  {
    mms_id: 'sdt_NdzdJM',
    last_name: 'Thorton',
    first_name: 'Elsa',
    soundslice_course: 'https://www.soundslice.com/courses/8863/'
  },
  {
    mms_id: 'sdt_wwqLJ2',
    last_name: 'Alexander',
    first_name: 'Jack',
    soundslice_course: 'https://www.soundslice.com/courses/8207/'
  },
  {
    mms_id: 'sdt_s2JpJx',
    last_name: 'Neto',
    first_name: 'Roque',
    soundslice_course: 'https://www.soundslice.com/courses/13505/'
  },
  {
    mms_id: 'sdt_NS6bJW',
    last_name: 'Slocombe',
    first_name: 'Tabitha',
    soundslice_course: 'https://www.soundslice.com/courses/10023/'
  },
  {
    mms_id: 'sdt_czFfJy',
    last_name: 'Clark',
    first_name: 'Bonnie',
    soundslice_course: 'https://www.soundslice.com/courses/10023/'
  }
];

console.log('Updating Stef\'s students with Soundslice course assignments...');

const updateStmt = db.prepare(`
  UPDATE students 
  SET soundslice_course = ?, current_tutor = 'Stef'
  WHERE mms_id = ?
`);

const selectStmt = db.prepare(`
  SELECT name, mms_id, soundslice_course, current_tutor 
  FROM students 
  WHERE mms_id = ?
`);

let updatedCount = 0;
let errors = 0;

for (const student of stefStudents) {
  try {
    // Check if student exists first
    const existingStudent = selectStmt.get(student.mms_id);
    
    if (!existingStudent) {
      console.log(`❌ Student ${student.first_name} ${student.last_name} (${student.mms_id}) not found in database`);
      errors++;
      continue;
    }
    
    // Update the student's Soundslice course and assign to Stef
    const result = updateStmt.run(student.soundslice_course, student.mms_id);
    
    if (result.changes > 0) {
      console.log(`✅ Updated ${student.first_name} ${student.last_name} (${student.mms_id})`);
      console.log(`   Course: ${student.soundslice_course}`);
      console.log(`   Tutor: Stef (was ${existingStudent.current_tutor})`);
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
for (const student of stefStudents) {
  const updatedStudent = selectStmt.get(student.mms_id);
  if (updatedStudent) {
    console.log(`${updatedStudent.name}: ${updatedStudent.soundslice_course} (Tutor: ${updatedStudent.current_tutor})`);
  }
}

db.close();
