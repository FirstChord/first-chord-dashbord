const Database = require('better-sqlite3');
const path = require('path');

// Create/open database
const dbPath = path.join(__dirname, 'data', 'school.db');
const db = new Database(dbPath);

// Dean's students with MMS IDs and Soundslice course IDs
const deanStudents = [
  { mms_id: 'sdt_BMt3JD', name: 'Adam Rami', course: '7751' },
  { mms_id: 'sdt_Hf36Jh', name: 'Ariana Honeybunn', course: '13239' },
  { mms_id: 'sdt_yHtZJ8', name: 'Daniel Murray', course: '13981' },
  { mms_id: 'sdt_BDHTJN', name: 'Daniela Alvarez', course: '14089' },
  { mms_id: 'sdt_3nKZJB', name: 'Dylan Cook', course: '11355' },
  { mms_id: 'sdt_QnkRJT', name: 'Ada Neocleous', course: '15657' },
  { mms_id: 'sdt_3TTwJV', name: 'Emilia Douglas', course: '11376' },
  { mms_id: 'sdt_HrdXJK', name: 'Gil Wallace', course: '13243' },
  { mms_id: 'sdt_2sjZJs', name: 'Harrison Aitken', course: '11873' },
  { mms_id: 'sdt_svMqJy', name: 'Lola McGarry Panunzio', course: '12566' },
  { mms_id: 'sdt_2lJMJl', name: 'Mohammed Abdelrahman', course: '11618' },
  { mms_id: 'sdt_BlyZJD', name: 'Rachael Hill', course: '7951' },
  { mms_id: 'sdt_2lJyJj', name: 'Rayan Abdelrahman', course: '11616' },
  { mms_id: 'sdt_vHS3JK', name: 'Sandy Morgan', course: '8658' },
  { mms_id: 'sdt_vLG0JL', name: 'Sonny H', course: '8658' },
  { mms_id: 'sdt_sfbtJ5', name: 'Stella Hart', course: '12549' },
  { mms_id: 'sdt_Fq8ZJ1', name: 'Yahya Faraj', course: '7578' },
  { mms_id: 'sdt_NxMZJz', name: 'Zayn Speirs', course: '9221' },
  { mms_id: 'sdt_cYDxJM', name: 'James Taylor', course: '16009' },
  { mms_id: 'sdt_csfBJd', name: 'Charlotte Lawrie', course: '16165' },
  { mms_id: 'sdt_cfbyJQ', name: 'Harry Wallace', course: '16205' }
];

console.log('🎵 Updating Dean\'s students with Soundslice courses...');

// Prepare update statement
const updateStmt = db.prepare(`
  UPDATE students 
  SET soundslice_course = ? 
  WHERE mms_id = ?
`);

let successCount = 0;
let errorCount = 0;

// Update each student
for (const student of deanStudents) {
  try {
    const result = updateStmt.run(student.course, student.mms_id);
    if (result.changes > 0) {
      console.log(`✅ ${student.name} (${student.mms_id}) → Course ${student.course}`);
      successCount++;
    } else {
      console.log(`⚠️  ${student.name} (${student.mms_id}) - No record found`);
      errorCount++;
    }
  } catch (error) {
    console.log(`❌ ${student.name} (${student.mms_id}) - Error: ${error.message}`);
    errorCount++;
  }
}

console.log(`\n🎯 Update complete: ${successCount} updated, ${errorCount} errors`);

// Close database
db.close();
