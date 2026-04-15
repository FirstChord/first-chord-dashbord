import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database setup
const dbPath = path.join(__dirname, 'data', 'school.db');
const db = new Database(dbPath);

console.log('🎸 Setting up Kenny\'s students...');

// Kenny's students data from the provided list
const kennyStudents = [
  {
    last_name: 'Mcaulay',
    first_name: 'Craig',
    mms_id: 'sdt_L9nZJs',
    soundslice_username: 'craigfc',
    soundslice_course: 'https://www.soundslice.com/courses/17288/',
    instrument: 'Guitar'
  },
  {
    last_name: 'Wong',
    first_name: 'Olivia',
    mms_id: 'sdt_LTf0Jx',
    soundslice_username: 'oliviafc',
    soundslice_course: 'https://www.soundslice.com/courses/17290/',
    instrument: 'Guitar'
  },
  {
    last_name: 'Brown',
    first_name: 'Katie',
    mms_id: 'sdt_cZsDJp',
    soundslice_username: 'katiefc',
    soundslice_course: 'https://www.soundslice.com/courses/17317/',
    instrument: 'Guitar'
  },
  {
    last_name: 'Brown',
    first_name: 'Nina',
    mms_id: 'sdt_cZsMJD',
    soundslice_username: 'ninafc',
    soundslice_course: 'https://www.soundslice.com/courses/17318/',
    instrument: 'Guitar'
  },
  {
    last_name: 'Wallace',
    first_name: 'Joe',
    mms_id: 'sdt_LxdXJC',
    soundslice_username: '',
    soundslice_course: '',
    instrument: 'Guitar'
  },
  {
    last_name: 'Morrison',
    first_name: 'Iain',
    mms_id: '', // Missing MMS ID - will need to be updated later
    soundslice_username: '',
    soundslice_course: 'https://www.soundslice.com/courses/17354/',
    instrument: 'Guitar'
  }
];

// Prepare insert/update statement
const insertStudent = db.prepare(`
  INSERT OR REPLACE INTO students (
    name, first_name, last_name, mms_id, email, 
    current_tutor, soundslice_course, soundslice_username, 
    theta_id, parent_email, instrument, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateCount = {
  inserted: 0,
  updated: 0,
  errors: 0
};

// Process each student
kennyStudents.forEach(student => {
  try {
    const fullName = `${student.first_name} ${student.last_name}`;
    
    // Check if student already exists
    const existingStudent = db.prepare('SELECT id, name FROM students WHERE mms_id = ? OR (first_name = ? AND last_name = ?)').get(
      student.mms_id || '', 
      student.first_name, 
      student.last_name
    );
    
    const result = insertStudent.run(
      fullName,                    // name
      student.first_name,          // first_name  
      student.last_name,           // last_name
      student.mms_id || null,      // mms_id
      '',                          // email (will be updated from MMS later)
      'Kenny',                     // current_tutor
      student.soundslice_course,   // soundslice_course
      student.soundslice_username, // soundslice_username
      '',                          // theta_id (will be updated later)
      '',                          // parent_email (will be updated from MMS later)
      student.instrument,          // instrument
      'Active'                     // status
    );
    
    if (existingStudent) {
      updateCount.updated++;
      console.log(`✅ Updated: ${fullName} (${student.mms_id || 'NO MMS ID'})`);
    } else {
      updateCount.inserted++;
      console.log(`➕ Added: ${fullName} (${student.mms_id || 'NO MMS ID'})`);
    }
    
    // Show details for verification
    if (student.soundslice_course) {
      console.log(`   🎵 Soundslice: ${student.soundslice_username} → ${student.soundslice_course}`);
    }
    if (!student.mms_id) {
      console.log(`   ⚠️  Missing MMS ID - will need to be added later`);
    }
    
  } catch (error) {
    updateCount.errors++;
    console.error(`❌ Error processing ${student.first_name} ${student.last_name}:`, error.message);
  }
});

// Verify the results
console.log('\n📊 Summary:');
console.log(`   Inserted: ${updateCount.inserted}`);
console.log(`   Updated: ${updateCount.updated}`);
console.log(`   Errors: ${updateCount.errors}`);

// Check final count for Kenny
const finalCount = db.prepare('SELECT COUNT(*) as count FROM students WHERE current_tutor = ?').get('Kenny');
console.log(`\n🎸 Kenny now has ${finalCount.count} students in the database`);

// Show all Kenny's students for verification
console.log('\n📋 Kenny\'s students:');
const kennyStudentsInDb = db.prepare(`
  SELECT name, mms_id, soundslice_username, soundslice_course 
  FROM students 
  WHERE current_tutor = ? 
  ORDER BY name
`).all('Kenny');

kennyStudentsInDb.forEach(student => {
  console.log(`   • ${student.name}: MMS=${student.mms_id || 'MISSING'}, Soundslice=${student.soundslice_username || 'NONE'}`);
});

// Close database
db.close();
console.log('\n✅ Kenny\'s students setup complete!');