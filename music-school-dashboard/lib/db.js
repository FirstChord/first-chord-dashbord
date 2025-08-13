import Database from 'better-sqlite3';
import path from 'path';
import { readFileSync } from 'fs';

// Initialize database
const dbPath = path.join(process.cwd(), 'data', 'school.db');
const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    mms_id TEXT UNIQUE,
    soundslice_username TEXT,
    soundslice_course TEXT,
    theta_id TEXT,
    parent_email TEXT,
    current_tutor TEXT,
    instrument TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lesson_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    lesson_date DATETIME,
    notes TEXT,
    tutor_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students (id)
  );

  CREATE TABLE IF NOT EXISTS tutors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    email TEXT,
    color TEXT DEFAULT '#3B82F6'
  );
`);

// Seed with dummy data if empty
const count = db.prepare('SELECT COUNT(*) as count FROM students').get();
if (count.count === 0) {
  console.log('Seeding database with dummy data...');
  const dummyData = JSON.parse(
    readFileSync(path.join(process.cwd(), 'data', 'students.json'), 'utf8')
  );
  
  const insertStudent = db.prepare(`
    INSERT INTO students (name, mms_id, soundslice_username, soundslice_course, theta_id, parent_email, current_tutor, instrument)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertNote = db.prepare(`
    INSERT INTO lesson_notes (student_id, lesson_date, notes, tutor_name)
    VALUES (?, ?, ?, ?)
  `);
  
  const insertTutor = db.prepare(`
    INSERT OR IGNORE INTO tutors (name) VALUES (?)
  `);
  
  // Insert tutors
  ['Sarah', 'John', 'Mike', 'Emma'].forEach(tutor => {
    insertTutor.run(tutor);
  });
  
  // Insert students and sample notes
  dummyData.forEach((student, index) => {
    insertStudent.run(
      student.name,
      student.mms_id,
      student.soundslice_username,
      student.soundslice_course,
      student.theta_id,
      student.parent_email,
      student.current_tutor,
      student.instrument
    );
    
    // Add sample previous note
    insertNote.run(
      index + 1,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      student.sample_note,
      student.current_tutor
    );
  });
}

// Export database functions
export function getAllStudents() {
  const students = db.prepare('SELECT * FROM students ORDER BY name').all();
  return students;
}

export function getStudentsByTutor(tutorName) {
  const students = db.prepare('SELECT * FROM students WHERE current_tutor = ? ORDER BY name').all(tutorName);
  return students;
}

export function getStudentByMmsId(mmsId) {
  const student = db.prepare('SELECT * FROM students WHERE mms_id = ?').get(mmsId);
  return student;
}

export function upsertStudent(studentData) {
  const { name, mms_id, soundslice_username, soundslice_course, theta_id, parent_email, current_tutor, instrument } = studentData;
  
  // Check if student exists
  const existing = db.prepare('SELECT id, soundslice_course FROM students WHERE mms_id = ?').get(mms_id);
  
  if (existing) {
    // Update existing student, preserving soundslice_course if new value is null
    const updateStmt = db.prepare(`
      UPDATE students 
      SET name = ?, 
          soundslice_username = ?, 
          soundslice_course = COALESCE(?, soundslice_course),
          theta_id = ?, 
          parent_email = ?, 
          current_tutor = ?, 
          instrument = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE mms_id = ?
    `);
    updateStmt.run(name, soundslice_username, soundslice_course, theta_id, parent_email, current_tutor, instrument, mms_id);
    return existing.id;
  } else {
    // Insert new student
    const insertStmt = db.prepare(`
      INSERT INTO students (name, mms_id, soundslice_username, soundslice_course, theta_id, parent_email, current_tutor, instrument)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = insertStmt.run(name, mms_id, soundslice_username, soundslice_course, theta_id, parent_email, current_tutor, instrument);
    return result.lastInsertRowid;
  }
}

export function upsertLessonNote(studentId, lessonDate, notes, tutorName) {
  const stmt = db.prepare(`
    INSERT INTO lesson_notes (student_id, lesson_date, notes, tutor_name)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(studentId, lessonDate, notes, tutorName);
}

export function getLatestLessonNote(studentId) {
  const note = db.prepare(`
    SELECT * FROM lesson_notes 
    WHERE student_id = ? 
    ORDER BY lesson_date DESC 
    LIMIT 1
  `).get(studentId);
  return note;
}

export default db;
