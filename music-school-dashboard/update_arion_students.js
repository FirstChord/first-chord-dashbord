const Database = require('better-sqlite3');
const path = require('path');

// Open the database
const dbPath = path.join(__dirname, 'data', 'school.db');
const db = new Database(dbPath);

// Arion's students with their MMS IDs and Soundslice course URLs
const arionStudents = [
  {
    mms_id: 'sdt_yXFSJf',
    last_name: 'Norman',
    first_name: 'Indy',
    soundslice_course: 'https://www.soundslice.com/courses/14429/'
  },
  {
    mms_id: 'sdt_yXFnJm',
    last_name: 'Norman',
    first_name: 'Roar',
    soundslice_course: 'https://www.soundslice.com/courses/14428/'
  },
  {
    mms_id: 'sdt_H6CsJs',
    last_name: 'Feigin',
    first_name: 'Grisha',
    soundslice_course: 'https://www.soundslice.com/courses/11591/'
  },
  {
    mms_id: 'sdt_cGPBJ3',
    last_name: 'Mcintosh',
    first_name: 'Olivia',
    soundslice_course: 'https://www.soundslice.com/courses/16283/'
  },
  {
    mms_id: 'sdt_c8NbJl',
    last_name: 'Richmond',
    first_name: 'Jake',
    soundslice_course: 'https://www.soundslice.com/courses/16624/'
  },
  {
    mms_id: 'sdt_MPMWJy',
    last_name: 'Macdonald',
    first_name: 'Stephen',
    soundslice_course: '' // No Soundslice course yet
  }
];

console.log('Updating Arion\'s students with Soundslice course assignments...');

const updateStmt = db.prepare(`
  UPDATE students 
  SET soundslice_course = ? 
  WHERE mms_id = ?
`);

const selectStmt = db.prepare(`
  SELECT name, mms_id, soundslice_course 
  FROM students 
  WHERE mms_id = ?
`);

let updatedCount = 0;
let errors = 0;

for (const student of arionStudents) {
  try {
    // Check if student exists first
    const existingStudent = selectStmt.get(student.mms_id);
    
    if (!existingStudent) {
      console.log(`❌ Student ${student.first_name} ${student.last_name} (${student.mms_id}) not found in database`);
      errors++;
      continue;
    }
    
    // Update the student's Soundslice course
    const result = updateStmt.run(student.soundslice_course, student.mms_id);
    
    if (result.changes > 0) {
      console.log(`✅ Updated ${student.first_name} ${student.last_name} (${student.mms_id})`);
      console.log(`   Course: ${student.soundslice_course || 'No course assigned'}`);
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
for (const student of arionStudents) {
  const updatedStudent = selectStmt.get(student.mms_id);
  if (updatedStudent) {
    console.log(`${updatedStudent.name}: ${updatedStudent.soundslice_course || 'No course'}`);
  }
}

db.close();
