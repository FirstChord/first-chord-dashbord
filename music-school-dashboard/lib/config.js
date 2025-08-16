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
        url: 'https://trainer.thetamusic.com/en/user/login',
        requiresAuth: true,
        instruction: 'Login to access training materials'
      };
    }
    
    // Finn's students with Theta Music credentials
    const thetaCredentials = {
      'sdt_cZDlJQ': 'Finnlayfc',    // Finlay Cackett
      'sdt_gwyQJr': 'alexfirstchord',       // Alex Chang
      'sdt_KwbvJG': 'alisterfc',    // Alister McGhee
      'sdt_Kwb2J0': 'anjifc',       // Anji Goddard
      'sdt_BDHKJs': 'archiefc',     // Archie Toner
      'sdt_K3h1JJ': 'ariafc',       // Aria Thomson
      'sdt_BpDPJZ': 'calanfc',      // Calan Clacherty
      'sdt_KwbMJR': 'carolynfc',    // Carolyn Hilliard
      'sdt_BDHJJF': 'clairefc',     // Claire McGinness
      'sdt_Kv59Jb': 'eilidhfc',     // Eilidh Qiu
      'sdt_K9psJ9': 'hudsonfc',     // Hudson Woodford
      'sdt_2slYJ7': 'jofc',         // Jo Vardy
      'sdt_K9pNJt': 'joelfc',       // Joel Adler
      'sdt_N0zrJ8': 'josefc',       // Jose Santi Dad
      'sdt_Kv5QJh': 'katrinafc',    // Katrina Caldwell
      'sdt_Kq3XJP': 'laithfc',      // Laith Lombard
      'sdt_KKfGJ0': 'leonardofc',   // Leonardo Matassoni
      'sdt_H6CvJv': 'mathildefc',   // Mathilde thallon
      'sdt_gWXHJN': 'nathanfc',     // Nathan Ward
      'sdt_yLvlJx': 'normanfc',     // Norman Boyle
      'sdt_Kq3RJW': 'pablofc',      // Pablo Cunningham
      'sdt_K9pMJg': 'quinfc',       // Quin Cooper
      'sdt_BDsRJ9': 'rosefc',       // Rose Drew
      'sdt_Kq2TJR': 'rosemaryfc',   // Rosemary Forbes
      'sdt_yLv3J7': 'sakethfc',     // Saketh Pamidimarry
      'sdt_Kv5XJL': 'santifc',      // Santi Freeth
      'sdt_x48LJT': 'stellafc',     // Stella Cook
      'sdt_BDHdJ4': 'thomasfc',     // Thomas Ward
      'sdt_BDHFJM': 'arnavfc',      // Arnav Rekhate
      'sdt_KKfZJC': 'simonefc',     // Simone De Maio
      'sdt_Q2ntJX': 'peadarfc',     // Paedar Chew
      
      // Dean's students with Theta Music credentials
      'sdt_BMt3JD': 'adamfc',       // Adam Rami
      'sdt_Hf36Jh': 'arianafc',     // Ariana Honeybunn
      'sdt_yHtZJ8': 'danielfc',     // Daniel Murray
      'sdt_BDHTJN': 'danielafc',    // Daniela Alvarez
      'sdt_3nKZJB': 'dylanfc',      // Dylan Cook
      'sdt_QnkRJT': 'adafc',        // Ada Neocleous
      'sdt_3TTwJV': 'emiliafc',     // Emilia Douglas
      'sdt_HrdXJK': 'gilfc',        // Gil Wallace
      'sdt_2sjZJs': 'harrisonfc',   // Harrison Aitken
      'sdt_svMqJy': 'lolafc',       // Lola McGarry Panunzio
      'sdt_2lJMJl': 'mohammedfc',   // Mohammed Abdelrahman
      'sdt_BlyZJD': 'rachaelfc',    // Rachael Hill
      'sdt_2lJyJj': 'rayanfc',      // Rayan Abdelrahman
      'sdt_vHS3JK': 'sandyfc',      // Sandy Morgan
      'sdt_vLG0JL': 'sonnyfc',      // Sonny H
      'sdt_sfbtJ5': 'stellafc',     // Stella Hart
      'sdt_Fq8ZJ1': 'yahyafc',      // Yahya Faraj
      'sdt_NxMZJz': 'zaynfc',       // Zayn Speirs
      'sdt_cYDxJM': 'jamesfc',      // James Taylor
      'sdt_csfBJd': 'charlottefc',  // Charlotte Lawrie
      'sdt_cfbyJQ': 'harryfc'       // Harry Wallace
    };

    const credential = thetaCredentials[student.mms_id];
    
    if (credential) {
      return {
        url: 'https://trainer.thetamusic.com/en/user/login',
        requiresAuth: false,
        autoLogin: true,
        credentials: {
          username: credential,
          password: credential
        },
        instruction: 'Auto-fill enabled - credentials will be filled automatically'
      };
    }

    return {
      url: 'https://trainer.thetamusic.com/en/user/login',
      requiresAuth: true,
      credentials: {
        username: student.theta_username || student.parent_email,
        passwordHint: 'Check Bitwarden'
      },
      instruction: 'Password manager will auto-fill'
    };
  }
};
