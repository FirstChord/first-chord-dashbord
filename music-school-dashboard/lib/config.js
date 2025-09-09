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
      'sdt_cfbyJQ': 'harryfc',      // Harry Wallace
      
      // TODO: Add Theta Music credentials for other tutors' students when ready
      // Following the pattern: 'mms_id': '[firstname]fc' for both username and password
      
      // Eve's students - Add when Theta Music accounts are created
      // 'sdt_XXXXX': '[firstname]fc',
      
      // Arion's students - Add when Theta Music accounts are created  
      // 'sdt_XXXXX': '[firstname]fc',
      
      // Eléna's students with Theta Music credentials
      'sdt_vcJPJj': 'katerinafc',       // Katerina Skouras
      'sdt_Kq3RJW': 'pablofc',          // Pablo Cunningham
      'sdt_yR33J4': 'aramfc',           // Aram Dogan
      'sdt_60gYJ7': 'ceciliafc',        // Cecilia Zhuansun
      'sdt_M3RnJG': 'athenafc',         // Athena Papadakis
      'sdt_yFzkJ6': 'irrujfc',          // Irruj Chander
      'sdt_HlXyJl': 'sophiafc',         // Sophia Papadakis
      'sdt_yhJTJ0': 'vaidikfc',         // Vaidik Gupta
      
      // David's students with Theta Music credentials
      'sdt_BDH9J3': 'ceitdhfc',         // Ceitdh Qui
      'sdt_MhHLJ0': 'rebeccafc',        // Rebecca Mapata
      'sdt_pGqXJ9': 'silverrayfc',      // Silver-Ray Noramly
      
      // Fennella's students with Theta Music credentials
      'sdt_ySKCJy': 'dylanfc',      // Dylan Lyall
      'sdt_v1lcJ0': 'maxfc',        // Max Toner
      'sdt_MdD4JB': 'falloufc',     // Fallou Ndiaye
      'sdt_cqlKJm': 'charlesfc',    // Charles Moriarty
      'sdt_cz6ZJz': 'jamesfc',      // James Holden
      'sdt_cB0YJd': 'tormadfc',     // Tormad MacRobert
      'sdt_HWVBJL': 'alizefc',      // Alize Ekdi
      'sdt_y0SPJJ': 'zoefc',        // Zoe Bannatyne
      'sdt_H5ysJM': 'beaufc',       // Beau Cassidy
      'sdt_Mg2kJz': 'annafc',       // Anna Kennedy
      'sdt_H5yHJQ': 'charliefc',    // Charlie Gillespie
      'sdt_QpGPJv': 'alexanderfc',  // Alexander Murray
      'sdt_ybcdJ7': 'elizabethfc',  // Elizabeth MacKenzie (Note: duplicate ID - using first occurrence)
      // 'sdt_ybcdJ7': 'elliotfc',  // Elliot - DUPLICATE ID, needs unique MMS ID
      // 'sdt_ybcdJ7': 'léofc',     // Léo TERHZAZ - DUPLICATE ID, needs unique MMS ID
      // 'sdt_ybcdJ7': 'yarahfc',   // Yarah Love - DUPLICATE ID, needs unique MMS ID
      'sdt_HVbNJk': 'melaniafc',    // Melania R
      'sdt_v9m8JT': 'elizafc',      // Eliza Dem
      'sdt_QPqsJC': 'nataliefc',    // Natalie Wong
      'sdt_39hsJY': 'chiarafc',     // Chiara Cavanna
      'sdt_QKcMJS': 'jennyfc',      // Jenny O'Donnell
      'sdt_BtxmJ4': 'carolfc',      // Carol Turner
      'sdt_QNVYJ4': 'nicofc',       // Nico Murdoch
      'sdt_ccgQJ8': 'paisleyfc',    // Paisley Hewitt
      'sdt_cfGhJh': 'sianfc',       // Sian Malyin
      'sdt_ckzHJS': 'georgiafc',    // Georgia Charalampous (Note: duplicate ID - using first occurrence)
      // 'sdt_ckzHJS': 'thomasfc',  // Thomas McGrath - DUPLICATE ID, needs unique MMS ID
      'sdt_6FRsJF': 'clairefc',     // Claire Lindsay
      'sdt_c8fFJ3': 'emmafc',       // Emma Snaraite
      'sdt_6Zd7J3': 'niamhfc',      // Niamh McCrudden
      'sdt_6nhSJM': 'giorgiofc',    // Giorgio O'Neil
      
      // Jungyoun's students with Theta Music credentials
      'sdt_c794J5': 'mateofc',      // Mateo Alonso
      'sdt_NSmFJh': 'alessandrofc', // Alessandro Matassoni
      'sdt_NXNKJJ': 'evafc',        // Eva Lindsay
      'sdt_D9rnJT': 'rohanfc',      // Rohan Nazir
      'sdt_DdZxJQ': 'sumerfc',      // Sumer Rami
      'sdt_N0z0Jq': 'tomassofc',    // Tomasso Fossati
      'sdt_NSmyJ3': 'ziafc',        // Zia Permall
      'sdt_2grxJL': 'ryanfc',       // Ryan Ofee
      'sdt_638hJ9': 'vanessafc',    // Vanessa V
      
      // Kim's students - Add when Theta Music accounts are created
      // 'sdt_XXXXX': '[firstname]fc',
      
      // Patrick's students with Theta Music credentials
      'sdt_QSzJJ2': 'arasfc',       // Aras Korkmaz
      'sdt_Q39JJ9': 'kushalfc',     // Kushal Avvaru
      'sdt_Qcm1JR': 'cananfc',      // Canan Dogan
      'sdt_QfWBJx': 'eddiefc',      // Eddie Roarty
      'sdt_cJDjJj': 'suzannefc',    // Suzanne Boyle
      'sdt_QP01Jp': 'yarahfc',      // Yarah Love
      'sdt_cqlvJb': 'shridhanafc',  // Shridhana Sathiyanarayanan
      'sdt_cYvdJp': 'noahfc',       // Noah Hegde
      'sdt_c44QJk': 'tiafc',        // Tia Mustafayeva
      
      // Robbie's students - Add when Theta Music accounts are created
      // 'sdt_XXXXX': '[firstname]fc',
      
      // Stef's students - Add when Theta Music accounts are created
      // 'sdt_XXXXX': '[firstname]fc',
      
      // Tom's students with Theta Music credentials
      'sdt_BtxmJ4': 'carolfc',          // Carol Turner
      'sdt_vGjtJ7': 'catfc',            // Cat Macfarlane
      'sdt_417JJ3': 'charliefc',        // Charlie Norton
      'sdt_FXKDJS': 'cormacfc',         // Cormac Morton
      'sdt_gpFVJS': 'dukefc',           // Duke Noramly
      'sdt_B4zSJc': 'florencefc',       // Florence Bartlett
      'sdt_slc4Jq': 'harryfc',          // Harry Dafas
      'sdt_F3FHJs': 'loganfc',          // Logan Wilson
      'sdt_gDcVJp': 'lucafc',           // Luca Kennedy
      'sdt_BMtHJs': 'lukefc',           // Luke Moran
      'sdt_N8lVJ1': 'mohamedfc',        // Mohamed Zayed
      'sdt_DdxtJZ': 'rosiefc',          // Rosie Ward
      'sdt_pFYFJT': 'rosie & johnnyfc', // Rosie & Johnny Kinniburgh
      'sdt_w6TBJ3': 'rowanfc',          // Rowan Moore
      'sdt_D9ftJB': 'sadiefc',          // Sadie Lowe
      'sdt_pT5MJz': 'sonnyfc',          // Sonny Ford
      'sdt_Nt4LJ3': 'stellafc',         // Stella French
      'sdt_QjMGJc': 'carlafc',          // Carla Jurado
      'sdt_6yvpJb': 'lesfc',            // Les Graham
      'sdt_6PjKJF': 'ruaraidhfc',       // Ruaraidh Somerville
      'sdt_6ZrzJq': 'icarofc',          // Icaro Segnini-Hernandez
      'sdt_cZ39Jz': 'anniefc'           // Annie Brown
    };

    // Instrument overrides - specify correct instruments for students
    const instrumentOverrides = {
      // Fennella's students with correct instruments
      'sdt_ySKCJy': 'Voice',        // Dylan Lyall
      'sdt_v1lcJ0': 'Piano',        // Max Toner
      'sdt_MdD4JB': 'Piano',        // Fallou Ndiaye
      'sdt_cqlKJm': 'Piano',        // Charles Moriarty
      'sdt_cz6ZJz': 'Piano',        // James Holden
      'sdt_cB0YJd': 'Piano',        // Tormad MacRobert
      'sdt_HWVBJL': 'Piano',        // Alize Ekdi
      'sdt_y0SPJJ': 'Piano',        // Zoe Bannatyne
      'sdt_H5ysJM': 'Voice',        // Beau Cassidy
      'sdt_Mg2kJz': 'Piano',        // Anna Kennedy
      'sdt_H5yHJQ': 'Piano',        // Charlie Gillespie
      'sdt_QpGPJv': 'Piano',        // Alexander Murray
      'sdt_ybcdJ7': 'Piano',        // Elizabeth MacKenzie (first occurrence)
      // Note: Elliot (Piano), Léo (Voice), Yarah (Piano) need unique IDs
      'sdt_HVbNJk': 'Piano / Voice', // Melania R
      'sdt_v9m8JT': 'Voice',        // Eliza Dem
      'sdt_QPqsJC': 'Piano',        // Natalie Wong
      'sdt_39hsJY': 'Piano',        // Chiara Cavanna
      'sdt_QKcMJS': 'Voice',        // Jenny O'Donnell
      'sdt_BtxmJ4': 'Voice',        // Carol Turner
      'sdt_QNVYJ4': 'Voice',        // Nico Murdoch
      'sdt_ccgQJ8': 'Piano',        // Paisley Hewitt
      'sdt_cfGhJh': 'Voice',        // Sian Malyin
      'sdt_ckzHJS': 'Voice',        // Georgia Charalampous (first occurrence)
      // Note: Thomas (Piano) needs unique ID
      'sdt_6FRsJF': 'Piano',        // Claire Lindsay
      'sdt_c8fFJ3': 'Piano',        // Emma Snaraite
      'sdt_6Zd7J3': 'Piano',        // Niamh McCrudden
      'sdt_6nhSJM': 'Piano'         // Giorgio O'Neil
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

// Export instrument overrides for use in MMS client
export const instrumentOverrides = {
  // Fennella's students with correct instruments
  'sdt_ySKCJy': 'Voice',        // Dylan Lyall
  'sdt_v1lcJ0': 'Piano',        // Max Toner
  'sdt_MdD4JB': 'Piano',        // Fallou Ndiaye
  'sdt_cqlKJm': 'Piano',        // Charles Moriarty
  'sdt_cz6ZJz': 'Piano',        // James Holden
  'sdt_cB0YJd': 'Piano',        // Tormad MacRobert
  'sdt_HWVBJL': 'Piano',        // Alize Ekdi
  'sdt_y0SPJJ': 'Piano',        // Zoe Bannatyne
  'sdt_H5ysJM': 'Voice',        // Beau Cassidy
  'sdt_Mg2kJz': 'Piano',        // Anna Kennedy
  'sdt_H5yHJQ': 'Piano',        // Charlie Gillespie
  'sdt_QpGPJv': 'Piano',        // Alexander Murray
  'sdt_ybcdJ7': 'Piano',        // Elizabeth MacKenzie (first occurrence)
  // Note: Elliot (Piano), Léo (Voice), Yarah (Piano) need unique IDs
  'sdt_HVbNJk': 'Piano / Voice', // Melania R
  'sdt_v9m8JT': 'Voice',        // Eliza Dem
  'sdt_QPqsJC': 'Piano',        // Natalie Wong
  'sdt_39hsJY': 'Piano',        // Chiara Cavanna
  'sdt_QKcMJS': 'Voice',        // Jenny O'Donnell
  'sdt_BtxmJ4': 'Voice',        // Carol Turner
  'sdt_QNVYJ4': 'Voice',        // Nico Murdoch
  'sdt_ccgQJ8': 'Piano',        // Paisley Hewitt
  'sdt_cfGhJh': 'Voice',        // Sian Malyin
  'sdt_ckzHJS': 'Voice',        // Georgia Charalampous (first occurrence)
  // Note: Thomas (Piano) needs unique ID
  'sdt_6FRsJF': 'Piano',        // Claire Lindsay
  'sdt_c8fFJ3': 'Piano',        // Emma Snaraite
  'sdt_6Zd7J3': 'Piano',        // Niamh McCrudden
  'sdt_6nhSJM': 'Piano',        // Giorgio O'Neil
  
  // Patrick's students with correct instruments
  'sdt_QSzJJ2': 'Piano',        // Aras Korkmaz
  'sdt_Q39JJ9': 'Guitar',       // Kushal Avvaru
  'sdt_Qcm1JR': 'Guitar',       // Canan Dogan
  'sdt_QfWBJx': 'Guitar',       // Eddie Roarty
  'sdt_cJDjJj': 'Guitar',       // Suzanne Boyle
  'sdt_QP01Jp': 'Guitar',       // Yarah Love
  'sdt_cqlvJb': 'Piano',        // Shridhana Sathiyanarayanan
  'sdt_cYvdJp': 'Guitar',       // Noah Hegde
  'sdt_c44QJk': 'Guitar',       // Tia Mustafayeva
  
  // Jungyoun's students with correct instruments (all Piano)
  'sdt_c794J5': 'Piano',        // Mateo Alonso
  'sdt_NSmFJh': 'Piano',        // Alessandro Matassoni
  'sdt_NXNKJJ': 'Piano',        // Eva Lindsay
  'sdt_D9rnJT': 'Piano',        // Rohan Nazir
  'sdt_DdZxJQ': 'Piano',        // Sumer Rami
  'sdt_N0z0Jq': 'Piano',        // Tomasso Fossati
  'sdt_NSmyJ3': 'Piano',        // Zia Permall
  'sdt_2grxJL': 'Piano',        // Ryan Ofee
  'sdt_638hJ9': 'Piano',        // Vanessa V
  
  // Tom's students with correct instruments (defaulting to Guitar - update as needed)
  'sdt_BtxmJ4': 'Guitar',       // Carol Turner
  'sdt_vGjtJ7': 'Guitar',       // Cat Macfarlane
  'sdt_417JJ3': 'Guitar',       // Charlie Norton
  'sdt_FXKDJS': 'Guitar',       // Cormac Morton
  'sdt_gpFVJS': 'Guitar',       // Duke Noramly
  'sdt_B4zSJc': 'Guitar',       // Florence Bartlett
  'sdt_slc4Jq': 'Guitar',       // Harry Dafas
  'sdt_F3FHJs': 'Guitar',       // Logan Wilson
  'sdt_gDcVJp': 'Guitar',       // Luca Kennedy
  'sdt_BMtHJs': 'Guitar',       // Luke Moran
  'sdt_N8lVJ1': 'Guitar',       // Mohamed Zayed
  'sdt_DdxtJZ': 'Guitar',       // Rosie Ward
  'sdt_pFYFJT': 'Guitar',       // Rosie & Johnny Kinniburgh
  'sdt_w6TBJ3': 'Guitar',       // Rowan Moore
  'sdt_D9ftJB': 'Guitar',       // Sadie Lowe
  'sdt_pT5MJz': 'Guitar',       // Sonny Ford
  'sdt_Nt4LJ3': 'Guitar',       // Stella French
  'sdt_QjMGJc': 'Guitar',       // Carla Jurado
  'sdt_6yvpJb': 'Guitar',       // Les Graham
  'sdt_6PjKJF': 'Guitar',       // Ruaraidh Somerville
  'sdt_6ZrzJq': 'Guitar',       // Icaro Segnini-Hernandez
  'sdt_cZ39Jz': 'Guitar',       // Annie Brown
  
  // Eléna's students with correct instruments (all Piano)
  'sdt_vcJPJj': 'Piano',        // Katerina Skouras
  'sdt_Kq3RJW': 'Piano',        // Pablo Cunningham
  'sdt_yR33J4': 'Piano',        // Aram Dogan
  'sdt_60gYJ7': 'Piano',        // Cecilia Zhuansun
  'sdt_M3RnJG': 'Piano',        // Athena Papadakis
  'sdt_yFzkJ6': 'Piano',        // Irruj Chander
  'sdt_HlXyJl': 'Piano',        // Sophia Papadakis
  'sdt_yhJTJ0': 'Piano',        // Vaidik Gupta
  
  // David's students with correct instruments
  'sdt_BDH9J3': 'Piano',        // Ceitdh Qui
  'sdt_MhHLJ0': 'Piano',        // Rebecca Mapata
  'sdt_pGqXJ9': 'Piano / Guitar' // Silver-Ray Noramly
};
