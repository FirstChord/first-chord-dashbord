const Database = require('better-sqlite3');
const path = require('path');

// Open the database
const dbPath = path.join(__dirname, 'data', 'school.db');
const db = new Database(dbPath);

// Tom's students with their MMS IDs and Soundslice course URLs
const tomStudents = [
  {
    mms_id: 'sdt_BtxmJ4',
    last_name: 'Turner',
    first_name: 'Carol',
    soundslice_course: 'https://www.soundslice.com/courses/6979/'
  },
  {
    mms_id: 'sdt_vGjtJ7',
    last_name: 'Macfarlane',
    first_name: 'Cat',
    soundslice_course: 'https://www.soundslice.com/courses/8842/'
  },
  {
    mms_id: 'sdt_417JJ3',
    last_name: 'Norton',
    first_name: 'Charlie',
    soundslice_course: 'https://www.soundslice.com/courses/6672/'
  },
  {
    mms_id: 'sdt_FXKDJS',
    last_name: 'Morton',
    first_name: 'Cormac',
    soundslice_course: 'https://www.soundslice.com/courses/5434/'
  },
  {
    mms_id: 'sdt_gpFVJS',
    last_name: 'Noramly',
    first_name: 'Duke',
    soundslice_course: 'https://www.soundslice.com/courses/4963/'
  },
  {
    mms_id: 'sdt_B4zSJc',
    last_name: 'Bartlett',
    first_name: 'Florence',
    soundslice_course: 'https://www.soundslice.com/courses/7566/'
  },
  {
    mms_id: 'sdt_slc4Jq',
    last_name: 'Dafas',
    first_name: 'Harry',
    soundslice_course: 'https://www.soundslice.com/courses/12632/'
  },
  {
    mms_id: 'sdt_yRbrJR',
    last_name: 'Yagoub',
    first_name: 'Ismail',
    soundslice_course: 'https://www.soundslice.com/courses/14024/'
  },
  {
    mms_id: 'sdt_pj05JC',
    last_name: 'Plazalski',
    first_name: 'Kai',
    soundslice_course: 'https://www.soundslice.com/courses/6394/'
  },
  {
    mms_id: 'sdt_F3FHJs',
    last_name: 'Wilson',
    first_name: 'Logan',
    soundslice_course: 'https://www.soundslice.com/courses/4975/'
  },
  {
    mms_id: 'sdt_gDcVJp',
    last_name: 'Kennedy',
    first_name: 'Luca',
    soundslice_course: 'https://www.soundslice.com/courses/4831/'
  },
  {
    mms_id: 'sdt_BMtHJs',
    last_name: 'Moran',
    first_name: 'Luke',
    soundslice_course: 'https://www.soundslice.com/courses/7757/'
  },
  {
    mms_id: 'sdt_N8lVJ1',
    last_name: 'Zayed',
    first_name: 'Mohamed',
    soundslice_course: 'https://www.soundslice.com/courses/10230/'
  },
  {
    mms_id: 'sdt_DdxtJZ',
    last_name: 'Ward',
    first_name: 'Rosie',
    soundslice_course: 'https://www.soundslice.com/courses/10246/'
  },
  {
    mms_id: 'sdt_pFYFJT',
    last_name: 'Kinniburgh',
    first_name: 'Rosie & Johnny',
    soundslice_course: 'https://www.soundslice.com/courses/6131/'
  },
  {
    mms_id: 'sdt_w6TBJ3',
    last_name: 'Moore',
    first_name: 'Rowan',
    soundslice_course: 'https://www.soundslice.com/courses/8464/'
  },
  {
    mms_id: 'sdt_D9ftJB',
    last_name: 'Lowe',
    first_name: 'Sadie',
    soundslice_course: 'https://www.soundslice.com/courses/10247/'
  },
  {
    mms_id: 'sdt_pT5MJz',
    last_name: 'Ford',
    first_name: 'Sonny',
    soundslice_course: 'https://www.soundslice.com/courses/6045/'
  },
  {
    mms_id: 'sdt_Nt4LJ3',
    last_name: 'French',
    first_name: 'Stella',
    soundslice_course: 'https://www.soundslice.com/courses/9135/'
  },
  {
    mms_id: 'sdt_QjMGJc',
    last_name: 'Jurado',
    first_name: 'Carla',
    soundslice_course: 'https://www.soundslice.com/courses/15453/'
  },
  {
    mms_id: 'sdt_QRdgJG',
    last_name: 'Davidson',
    first_name: 'Mia',
    soundslice_course: 'https://www.soundslice.com/courses/15750/'
  }
];

console.log('Updating Tom\'s students with Soundslice course assignments...');

const updateStmt = db.prepare(`
  UPDATE students 
  SET soundslice_course = ?, current_tutor = 'Tom'
  WHERE mms_id = ?
`);

const selectStmt = db.prepare(`
  SELECT name, mms_id, soundslice_course, current_tutor 
  FROM students 
  WHERE mms_id = ?
`);

let updatedCount = 0;
let errors = 0;

for (const student of tomStudents) {
  try {
    // Check if student exists first
    const existingStudent = selectStmt.get(student.mms_id);
    
    if (!existingStudent) {
      console.log(`❌ Student ${student.first_name} ${student.last_name} (${student.mms_id}) not found in database`);
      errors++;
      continue;
    }
    
    // Update the student's Soundslice course and assign to Tom
    const result = updateStmt.run(student.soundslice_course, student.mms_id);
    
    if (result.changes > 0) {
      console.log(`✅ Updated ${student.first_name} ${student.last_name} (${student.mms_id})`);
      console.log(`   Course: ${student.soundslice_course}`);
      console.log(`   Tutor: Tom (was ${existingStudent.current_tutor})`);
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
console.log('\nVerifying updates (showing first 10):');
for (let i = 0; i < Math.min(10, tomStudents.length); i++) {
  const student = tomStudents[i];
  const updatedStudent = selectStmt.get(student.mms_id);
  if (updatedStudent) {
    console.log(`${updatedStudent.name}: ${updatedStudent.soundslice_course} (Tutor: ${updatedStudent.current_tutor})`);
  }
}

if (tomStudents.length > 10) {
  console.log(`... and ${tomStudents.length - 10} more students`);
}

db.close();
