// HARDCODED SOUNDSLICE MAPPINGS - NO DATABASE NEEDED!
// This contains all the Soundslice course assignments for each student

const SOUNDSLICE_MAPPINGS = {
  // Arion's students
  'sdt_yXFSJf': 'https://www.soundslice.com/courses/14429/', // Indy Norman
  'sdt_yXFnJm': 'https://www.soundslice.com/courses/14428/', // Roar Norman
  'sdt_H6CsJs': 'https://www.soundslice.com/courses/11591/', // Grisha Feigin
  'sdt_cGPBJ3': 'https://www.soundslice.com/courses/16283/', // Olivia Mcintosh
  'sdt_c8NbJl': 'https://www.soundslice.com/courses/16624/', // Jake Richmond
  'sdt_MPMWJy': '', // Stephen MacDonald - No course yet
  
  // Kim's students
  'sdt_3L3TJJ': 'https://www.soundslice.com/courses/7950/', // Jim Aitken
  'sdt_36MKJz': 'https://www.soundslice.com/courses/10815/', // Amelia Henderson
  'sdt_3MPnJD': 'https://www.soundslice.com/courses/13588/', // Ruairidh McInnes
  'sdt_36ZqJ6': 'https://www.soundslice.com/courses/11529/', // Ava McQueen
  'sdt_3xBxJw': 'https://www.soundslice.com/courses/4833/', // Louis Mitchell
  'sdt_3Y6yJF': 'https://www.soundslice.com/courses/15425/', // Rachel Ravenscroft
  'sdt_HPYlJY': 'https://www.soundslice.com/courses/15543/', // Calum Williamson
  
  // Robbie's students
  'sdt_3fqfJ4': 'https://www.soundslice.com/courses/11356/', // Jessica Birch
  'sdt_3LnGJ4': 'https://www.soundslice.com/courses/8669/', // Isaac Coull
  'sdt_36GFJS': 'https://www.soundslice.com/courses/12071/', // Alexander Duncan
  'sdt_36F7JV': 'https://www.soundslice.com/courses/8864/', // Mason Foster
  'sdt_36F6JL': 'https://www.soundslice.com/courses/8619/', // Amy Foster
  'sdt_36ZRJ2': 'https://www.soundslice.com/courses/8670/', // Holly Hendry
  'sdt_MPM6JG': 'https://www.soundslice.com/courses/16396/', // Blake Nicol
  
  // Stef's students
  'sdt_37Z4J4': 'https://www.soundslice.com/courses/10024/', // Maria Baker
  'sdt_3LHQJH': 'https://www.soundslice.com/courses/8863/', // Theo Duncan
  'sdt_3LFNJJ': 'https://www.soundslice.com/courses/8207/', // Morven Duncan
  'sdt_3MZVJP': 'https://www.soundslice.com/courses/13505/', // Angus Kerr
  'sdt_3M1zJ6': 'https://www.soundslice.com/courses/10023/', // Lily Pritchard
  'sdt_37kBJV': 'https://www.soundslice.com/courses/10023/' // Eva Roberts
};

// Function to get Soundslice course for a student
export function getSoundsliceCourse(mmsId) {
  return SOUNDSLICE_MAPPINGS[mmsId] || null;
}

// Function to enhance student data with Soundslice courses
export function enhanceStudentsWithSoundslice(students) {
  return students.map(student => ({
    ...student,
    soundslice_course: getSoundsliceCourse(student.mms_id)
  }));
}

export default SOUNDSLICE_MAPPINGS;
