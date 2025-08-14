// Configuration for all external services

export const config = {

  services: {

    myMusicStaff: {

      apiUrl: process.env.MMS_API_URL || 'https://api.mymusicstaff.com',

      apiKey: process.env.MMS_API_KEY || 'dummy-key-for-dev',

      schoolId: process.env.MMS_SCHOOL_ID || 'your-school-id'

    },

    soundslice: {

      baseUrl: 'https://www.soundslice.com',

      // You'll need to figure out your school's folder structure

      schoolFolder: '/school/your-school-name'

    },

    thetaMusic: {

      baseUrl: 'https://trainer.thetamusic.com',

      schoolId: 'your-theta-school-id'

    }

  },

  // For development - replace with real IPs at school

  serverUrl: process.env.NODE_ENV === 'development' 

    ? 'http://localhost:3000' 

    : 'http://192.168.1.50:3000'

};

// Authentication configuration for each service
export const serviceAuth = {
  soundslice: {
    type: 'shared-school-account',
    username: 'schoolaccount@musicschool.com', // Your school account
    stayLoggedIn: true,
    note: 'All tutors use same login'
  },
  
  myMusicStaff: {
    type: 'individual-tutor-accounts',
    stayLoggedIn: true,
    accounts: {
      'Sarah': 'sarah@musicschool.com',
      'John': 'john@musicschool.com',
      'Mike': 'mike@musicschool.com',
      'Emma': 'emma@musicschool.com'
    }
  },
  
  thetaMusic: {
    type: 'individual-student-accounts',
    passwordPattern: 'FirstnameYear', // e.g., Emma2024
    note: 'Each student has own login'
  }
};

// URL generators for each service

export const generateUrls = {

  soundslice: (student) => {
    const course = student.soundslice_course || '12954';
    // Check if it's already a full URL or just a course ID
    if (course.startsWith('http')) {
      return course;
    }
    return `https://www.soundslice.com/courses/${course}/`;
  },

  

  thetaMusic: (studentId) => 

    `https://trainer.thetamusic.com/student/exercises?id=${studentId}`,

  

  myMusicStaff: (studentId) => 

    `https://app.mymusicstaff.com/Teacher/v2/en/students/details?id=${studentId}#AttendanceNotes`

};

// Smart URL generator that handles authentication state
export const generateSmartUrls = {
  soundslice: (student) => {
    if (!student) {
      return {
        url: 'https://www.soundslice.com/courses/12954/',
        requiresAuth: false,
        instruction: 'Access course materials'
      };
    }
    const course = student.soundslice_course || '12954';
    // Check if it's already a full URL or just a course ID
    const url = course.startsWith('http') ? course : `https://www.soundslice.com/courses/${course}/`;
    return {
      url: url,
      requiresAuth: false, // Assumes already logged in
      instruction: 'Access course materials'
    };
  },
  
  myMusicStaff: (student, tutorName) => {
    if (!student) {
      return {
        url: 'https://app.mymusicstaff.com/',
        requiresAuth: true,
        instruction: 'Login to view student details'
      };
    }
    return {
      url: `https://app.mymusicstaff.com/Teacher/v2/en/students/details?id=${student.mms_id}#AttendanceNotes`,
      requiresAuth: false, // Assumes tutor logged in
      instruction: 'Go to attendance & notes'
    };
  },
  
  thetaMusic: (student) => {
    if (!student) {
      return {
        url: 'https://trainer.thetamusic.com/login',
        requiresAuth: true,
        instruction: 'Login to access training materials'
      };
    }
    return {
      url: `https://trainer.thetamusic.com/login`,
      requiresAuth: true,
      credentials: {
        username: student.theta_username || student.parent_email,
        passwordHint: 'Check Bitwarden'
      },
      instruction: 'Password manager will auto-fill'
    };
  }
};
