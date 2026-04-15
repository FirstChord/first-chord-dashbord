// External service configurations
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