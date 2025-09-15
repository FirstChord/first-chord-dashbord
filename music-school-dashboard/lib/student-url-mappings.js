// Friendly URL mappings for student portals
// Maps friendly names to MMS student IDs

export const STUDENT_URL_MAPPINGS = {
  // Test batch of 10 students with diverse names
  'mathilde': 'sdt_H6CvJv',           // Mathilde thallon
  'alex': 'sdt_gwyQJr',               // Alex Chang  
  'archie': 'sdt_BDHKJs',             // Archie Toner
  'aria': 'sdt_K3h1JJ',               // Aria Thomson
  'finlay': 'sdt_cZDlJQ',             // Finlay Cackett
  'hudson': 'sdt_K9psJ9',             // Hudson Woodford
  'joel': 'sdt_K9pNJt',               // Joel Adler
  'leonardo': 'sdt_KKfGJ0',           // Leonardo Matassoni
  'pablo': 'sdt_Kq3RJW',              // Pablo Cunningham
  'rose': 'sdt_BDsRJ9',               // Rose Drew
  'sangat': 'sdt_LT9sJN',             // Sangat Singh
  
  // Extended mappings for more students (comment out duplicates)
  'alister': 'sdt_KwbvJG',            // Alister McGhee
  'anji': 'sdt_Kwb2J0',               // Anji Goddard
  'arnav': 'sdt_BDHFJM',              // Arnav Rekhate
  'calan': 'sdt_BpDPJZ',              // Calan Clacherty
  'carolyn': 'sdt_KwbMJR',            // Carolyn Hilliard
  'claire': 'sdt_BDHJJF',             // Claire McGinniss
  'eilidh': 'sdt_Kv59Jb',             // Eilidh Su Strachan
  'eliza': 'sdt_v9m8JT',              // Eliza Dem
  'guy': 'sdt_L15vJh',                // guy Pilsworth
  'jo': 'sdt_2slYJ7',                 // Jo Vardy
  'jose': 'sdt_N0zrJ8',               // Jose Pernas
  'katrina': 'sdt_Kv5QJh',            // Katrina Caldwell
  'laith': 'sdt_Kq3XJP',              // Laith Lombard
  'nathan': 'sdt_gWXHJN',             // Nathan Ward
  'norman': 'sdt_yLvlJx',             // Norman Boyle
  'paul': 'sdt_v2XJJZ',               // Paul Maher
  'peadar': 'sdt_Q2ntJX',             // Peadar Chew
  'quin': 'sdt_K9pMJg',               // Quin Cooper
  'rosemary': 'sdt_Kq2TJR',           // Rosemary Forbes
  'saketh': 'sdt_yLv3J7',             // Saketh Pamidimarry
  'sandra': 'sdt_6fw7Jc',             // Sandra Brown
  'santi': 'sdt_Kv5XJL',              // Santi Freeth
  'simone': 'sdt_KKfZJC',             // Simone De Maio
  'stella': 'sdt_x48LJT',             // Stella Cook
  'teagan': 'sdt_BDsMJk',             // Teagan Samuel
  'thomas': 'sdt_BDHdJ4',             // Thomas Ward
};

// Reverse mapping for getting friendly name from student ID
export const STUDENT_ID_TO_URL = Object.fromEntries(
  Object.entries(STUDENT_URL_MAPPINGS).map(([name, id]) => [id, name])
);

// Get student ID from friendly URL
export function getStudentIdFromUrl(friendlyName) {
  const normalizedName = friendlyName.toLowerCase().trim();
  return STUDENT_URL_MAPPINGS[normalizedName] || null;
}

// Get friendly URL from student ID
export function getFriendlyUrlFromId(studentId) {
  return STUDENT_ID_TO_URL[studentId] || null;
}

// Check if friendly name exists
export function isValidFriendlyName(friendlyName) {
  const normalizedName = friendlyName.toLowerCase().trim();
  return normalizedName in STUDENT_URL_MAPPINGS;
}

// Get all available friendly names
export function getAllFriendlyNames() {
  return Object.keys(STUDENT_URL_MAPPINGS);
}