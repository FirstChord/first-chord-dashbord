#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
const dbPath = path.join(__dirname, 'data', 'school.db');
const db = new Database(dbPath);

// Student to course mappings (extracted from Soundslice URLs)
const studentCourses = {
  'sdt_gwyQJr': '4370',   // Chang Alex
  'sdt_BDHKJs': '13888',  // Toner Archie
  'sdt_K3h1JJ': '4360',   // Thomson Aria
  'sdt_BDHFJM': '14033',  // Rekhate Arnav
  'sdt_BpDPJZ': '6917',   // Clacherty Calan
  'sdt_BDHJJF': '8101',   // McGinniss Claire
  'sdt_Kv59Jb': '7458',   // Strachan Eilidh
  'sdt_cZDlJQ': '16374',  // Cackett Finlay
  'sdt_K9psJ9': '4446',   // Woodford Hudson
  'sdt_2slYJ7': '11672',  // Vardy Jo
  'sdt_K9pNJt': '4353',   // Adler Joel
  'sdt_N0zrJ8': '9866',   // Santi Dad Jose
  'sdt_Kq3XJP': '4363',   // Lombard Laith
  'sdt_KKfGJ0': '4410',   // Matassoni Leonardo
  'sdt_H6CvJv': '9009',   // thallon Mathilde
  'sdt_gWXHJN': '4405',   // Ward Nathan
  'sdt_yLvlJx': '13639',  // Boyle Norman
  'sdt_Kq3RJW': '4366',   // Cunningham Pablo
  'sdt_Q2ntJX': '15601',  // Chew Peadar
  'sdt_K9pMJg': '4361',   // Cooper Quin
  'sdt_BDsRJ9': '6753',   // Drew Rose
  'sdt_Kq2TJR': '4367',   // Forbes Rosemary
  'sdt_yLv3J7': '11720',  // Pamidimarry Saketh
  'sdt_Kv5XJL': '4857',   // Freeth Santi
  'sdt_30TGJh': '11502',  // Pert Saul
  'sdt_KKfZJC': '4411',   // De Maio Simone
  'sdt_x48LJT': '12954'   // Cook Stella
};

console.log('🎵 Updating Soundslice course assignments for Finn\'s students...');

const updateCourse = db.prepare(`
  UPDATE students 
  SET soundslice_course = ?, updated_at = CURRENT_TIMESTAMP 
  WHERE mms_id = ?
`);

let updatedCount = 0;
let notFoundCount = 0;

for (const [mmsId, courseId] of Object.entries(studentCourses)) {
  try {
    const result = updateCourse.run(courseId, mmsId);
    if (result.changes > 0) {
      console.log(`✅ Updated ${mmsId} → Course ${courseId}`);
      updatedCount++;
    } else {
      console.log(`❌ Student not found: ${mmsId}`);
      notFoundCount++;
    }
  } catch (error) {
    console.error(`❌ Error updating ${mmsId}:`, error.message);
    notFoundCount++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   ✅ Successfully updated: ${updatedCount} students`);
console.log(`   ❌ Not found/errors: ${notFoundCount} students`);

// Verify the updates by showing Finn's students with their courses
console.log(`\n🔍 Verification - Finn's students with Soundslice courses:`);
const finnStudents = db.prepare(`
  SELECT name, mms_id, soundslice_course, updated_at 
  FROM students 
  WHERE current_tutor = 'Finn' 
  ORDER BY name
`).all();

finnStudents.forEach(student => {
  const courseUrl = student.soundslice_course ? 
    `https://www.soundslice.com/courses/${student.soundslice_course}/` : 
    'No course assigned';
  console.log(`   ${student.name} (${student.mms_id}) → ${courseUrl}`);
});

db.close();
console.log('\n✨ Database updated successfully!');
