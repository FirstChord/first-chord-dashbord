// Student portal helper functions
import { thetaCredentials } from '@/lib/config/theta-credentials';

// Import existing soundslice mappings
import SOUNDSLICE_MAPPINGS from '@/lib/soundslice-mappings';

// Valid student IDs (security) - All students with friendly URLs
const VALID_STUDENT_IDS = [
  // Arion's students
  'sdt_6n94J7', // Matthew Donaldson (/matthew)
  'sdt_MPMWJy', // Stephen MacDonald (/stephen)
  'sdt_c8NbJl', // Jake Richmond (/jake)
  'sdt_cGPBJ3', // Olivia Mcintosh (/olivia)
  'sdt_yXFSJf', // Indy Norman (/indy)
  'sdt_yXFnJm', // Roar Norman (/roar)

  // David's students
  'sdt_638hJ9', // Vanessa (/vanessa)
  'sdt_L5l5JD', // Dimitra Ntarmou (/dimitra)
  'sdt_LqT2J4', // Fraser Ord (/fraser)
  'sdt_MhHLJ0', // Rebecca Mapata (/rebecca)
  'sdt_pGqXJ9', // Silver-Ray Noramly (/silverray)

  // Dean's students
  'sdt_2lJMJl', // Mohammed Abdelrahman (/mohammed)
  'sdt_2lJyJj', // Rayan Abdelrahman (/rayan)
  'sdt_2sjZJs', // Harrison Aitken (/harrison)
  'sdt_3TTwJV', // Emilia Douglas (/emilia)
  'sdt_3nKZJB', // Dylan Cook (/dylan-c)
  'sdt_BDHTJN', // Daniela Alvarez (/daniela)
  'sdt_BMt3JD', // Adam Rami (/adam)
  'sdt_BlyZJD', // Rachael Hill (/rachael)
  'sdt_Fq8ZJ1', // Yahya Faraj (/yahya)
  'sdt_Hf36Jh', // Ariana Honeybunn (/ariana)
  'sdt_HrdXJK', // Gil Wallace (/gil)
  'sdt_LT9sJN', // Sangat Singh (/sangat)
  'sdt_NxMZJz', // Zayn Speirs (/zayn)
  'sdt_QnkRJT', // Ada Neocleous (/ada)
  'sdt_cYDxJM', // James Taylor (/james-t)
  'sdt_cfbyJQ', // Harry Wallace (/harry-w)
  'sdt_csfBJd', // Charlotte Lawrie (/charlotte)
  'sdt_sfbtJ5', // Stella Hart (/stella-h)
  'sdt_svMqJy', // Lola McGarry Panunzio (/lola)
  'sdt_vHS3JK', // Sandy Morgan (/sandy)
  'sdt_vLG0JL', // Sonny H (/sonny-h)
  'sdt_yHtZJ8', // Daniel Murray (/daniel)

  // Eléna's students
  'sdt_60gYJ7', // Cecilia Zhuansun (/cecilia)
  'sdt_HlXyJl', // Sophia Papadakis (/sophia)
  'sdt_Kq3RJW', // Pablo Cunningham (/pablo)
  'sdt_M3RnJG', // Athena Papadakis (/athena)
  'sdt_vcJPJj', // Katerina Skouras (/katerina)
  'sdt_yFzkJ6', // Irruj Chander (/irruj)
  'sdt_yR33J4', // Aram Dogan (/aram)
  'sdt_yhJTJ0', // Vaidik Gupta (/vaidik)

  // Fennella's students
  'sdt_39hsJY', // Chiara Cavanna (/chiara)
  'sdt_6FRsJF', // Claire Lindsay (/claire-l)
  'sdt_BDH9J3', // Ceitdh Qui (/ceitdh)
  'sdt_H5yHJQ', // Charlie Gillespie (/charlie-g)
  'sdt_H5ysJM', // Beau Cassidy (/beau)
  'sdt_HVbNJk', // Melania R (/melania)
  'sdt_HWVBJL', // Alize Ekdi (/alize)
  'sdt_Mg2kJz', // Anna Kennedy (/anna)
  'sdt_QKcMJS', // Jenny O (/jenny)
  'sdt_QNVYJ4', // Nico Murdoch (/nico)
  'sdt_QPqsJC', // Natalie Wong (/natalie)
  'sdt_QpGPJv', // Alexander Murray (/alexander-m)
  'sdt_c8fFJ3', // Emma Snaraite (/emma)
  'sdt_cB0YJd', // Tormad MacRobert (/tormad)
  'sdt_ccgQJ8', // Paisley Hewitt (/paisley)
  'sdt_cfGhJh', // Sian Malyin (/sian)
  'sdt_ckzHJS', // Georgia Charalampous (/georgia)
  'sdt_cqlKJm', // Charles Moriarty (/charles)
  'sdt_cz6ZJz', // James Holden (/james-h)
  'sdt_v9m8JT', // Eliza Dem (/eliza)
  'sdt_ybcdJ7', // Elizabeth MacKenzie (/elizabeth)

  // Finn's students
  'sdt_2slYJ7', // Jo Vardy (/jo)
  'sdt_BDHFJM', // Arnav Rekhate (/arnav)
  'sdt_BDHJJF', // Claire McGinniss (/claire-m)
  'sdt_BDHKJs', // Archie Toner (/archie)
  'sdt_BDHdJ4', // Thomas Ward (/thomas)
  'sdt_BDsRJ9', // Rose Drew (/rose)
  'sdt_BpDPJZ', // Calan Clacherty (/calan)
  'sdt_H6CvJv', // Mathilde thallon (/mathilde)
  'sdt_K3h1JJ', // Aria Thomson (/aria)
  'sdt_K9pMJg', // Quin Cooper (/quin)
  'sdt_K9pNJt', // Joel Adler (/joel)
  'sdt_K9psJ9', // Hudson Woodford (/hudson)
  'sdt_KKfGJ0', // Leonardo Matassoni (/leonardo)
  'sdt_KKfZJC', // Simone De Maio (/simone)
  'sdt_Kq2TJR', // Rosemary Forbes (/rosemary)
  'sdt_Kq3XJP', // Laith Lombard (/laith)
  'sdt_Kv59Jb', // Eilidh Su Strachan (/eilidh)
  'sdt_Kv5QJh', // Katrina Caldwell (/katrina)
  'sdt_Kv5XJL', // Santi Freeth (/santi)
  'sdt_Kwb2J0', // Anji Goddard (/anji)
  'sdt_KwbMJR', // Carolyn Hilliard (/carolyn)
  'sdt_KwbvJG', // Alister McGhee (/alister)
  'sdt_N0zrJ8', // Jose Santi Dad (/jose)
  'sdt_Q2ntJX', // Peadar Chew (/peadar)
  'sdt_cZDlJQ', // Finlay Cackett (/finlay)
  'sdt_gWXHJN', // Nathan Ward (/nathan)
  'sdt_gwyQJr', // Alex Chang (/alex)
  'sdt_x48LJT', // Stella Cook (/stella-c)
  'sdt_yLv3J7', // Saketh Pamidimarry (/saketh)
  'sdt_yLvlJx', // Norman Boyle (/norman)

  // Jungyoun's students
  'sdt_2grxJL', // Ryan Ofee (/ryan)
  'sdt_635GJ0', // Ritisha Paryani (/ritisha)
  'sdt_6RJkJp', // Omar Mukhtar (/omar)
  'sdt_D9rnJT', // Rohan Nazir (/rohan)
  'sdt_DdZxJQ', // Sumer Rami (/sumer)
  'sdt_L5tgJX', // Alexander Palmer (/alexander-p)
  'sdt_N0z0Jq', // Tomasso Fossati (/tomasso)
  'sdt_NSmFJh', // Alessandro Matassoni (/alessandro)
  'sdt_NSmyJ3', // Zia Permall (/zia)
  'sdt_NXNKJJ', // Eva Lindsay (/eva)
  'sdt_c794J5', // Mateo Alonso (/mateo)

  // Kenny's students
  'sdt_60tqJf', // Iain Morrison (/iain)
  'sdt_L9nZJs', // Craig Mcaulay (/craig)
  'sdt_LTf0Jx', // Olivia Wong (/olivia-w)
  'sdt_LxdXJC', // Joe Wallace (/joe)
  'sdt_cZsDJp', // Katie Brown (/katie)
  'sdt_cZsMJD', // Nina Brown (/nina)

  // Kim's students
  'sdt_38MBJF', // Mark Chalmers (/mark)
  'sdt_BkflJy', // Reuben Barnes (/reuben)
  'sdt_DfTRJT', // Kin Shing Kenson Li (/kenson)
  'sdt_Fq8vJj', // Oscar Wallace (/oscar)
  'sdt_HbXMJZ', // Lyra Jackson (/lyra)
  'sdt_QbBNJq', // Caroline Bingley (/caroline)
  'sdt_QcCtJT', // Marco Sarconi (/marco)

  // Patrick's students
  'sdt_Q39JJ9', // Kushal Avvaru (/kushal)
  'sdt_QP01Jp', // Yarah Love (/yarah)
  'sdt_QSzJJ2', // Aras Korkmaz (/aras)
  'sdt_Qcm1JR', // Canan Dogan (/canan)
  'sdt_QfWBJx', // Eddie Roarty (/eddie)
  'sdt_c44QJk', // Tia Mustafayeva (/tia)
  'sdt_cJDjJj', // Suzanne Boyle (/suzanne)
  'sdt_cYvdJp', // Noah Hegde (/noah)
  'sdt_cqlvJb', // Shridhana Sathiyanarayanan (/shridhana)

  // Robbie's students
  'sdt_2s8CJk', // Charlie Mcdougall (/charlie-m)
  'sdt_3ZZwJ2', // Ailsa Hoebe (/ailsa)
  'sdt_c7hKJ8', // Emiliano Squillino (/emiliano)
  'sdt_vgjdJv', // Niamh Gallagher (/niamh-g)
  'sdt_vrbPJL', // Fox Slocombe (/fox)
  'sdt_w6T7Jd', // Vaila Donaghey (/vaila)
  'sdt_w6TSJX', // Arjun Darshini (/arjun)

  // Stef's students
  'sdt_6llSJ8', // Jamie Welsh (/jamie)
  'sdt_NS6bJW', // Tabitha Slocombe (/tabitha)
  'sdt_NSmPJr', // Ava Garcia Bree (/ava)
  'sdt_NdzdJM', // Elsa Thorton (/elsa)
  'sdt_czFfJy', // Bonnie Clark (/bonnie)
  'sdt_s2JpJx', // Roque Neto (/roque)
  'sdt_wwqLJ2', // Jack Alexander (/jack)

  // Tom's students
  'sdt_417JJ3', // Charlie Norton (/charlie-n)
  'sdt_6PjKJF', // Ruaraidh Somerville (/ruaraidh)
  'sdt_6ZrzJq', // Icaro Segnini-Hernandez (/icaro)
  'sdt_6yvpJb', // Les Graham (/les)
  'sdt_B4zSJc', // Florence Bartlett (/florence)
  'sdt_BMtHJs', // Luke Moran (/luke)
  'sdt_BtxmJ4', // Carol Turner (/carol)
  'sdt_D9ftJB', // Sadie Lowe (/sadie)
  'sdt_DdxtJZ', // Rosie Ward (/rosie-w)
  'sdt_F3FHJs', // Logan Wilson (/logan)
  'sdt_FXKDJS', // Cormac Morton (/cormac)
  'sdt_N8lVJ1', // Mohamed Zayed (/mohamed)
  'sdt_Nt4LJ3', // Stella French (/stella-f)
  'sdt_QjMGJc', // Carla Jurado (/carla)
  'sdt_cZ39Jz', // Annie Brown (/annie)
  'sdt_gDcVJp', // Luca Kennedy (/luca)
  'sdt_gpFVJS', // Duke Noramly (/duke)
  'sdt_pFYFJT', // Rosie & Johnny Kinniburgh (/rosie-k)
  'sdt_pT5MJz', // Sonny Ford (/sonny-f)
  'sdt_slc4Jq', // Harry Dafas (/harry-d)
  'sdt_vGjtJ7', // Cat Macfarlane (/cat)
  'sdt_w6TBJ3', // Rowan Moore (/rowan)

  // Unknown's students
  'sdt_6Zd7J3', // Niamh McCrudden (/niamh-m)
  'sdt_6nhSJM', // Giorgio O (/giorgio)
  'sdt_BDsMJk', // Teagan Samuel (/teagan)
  'sdt_MdD4JB', // Fallou Ndiaye (/fallou)
  'sdt_v1lcJ0', // Max Toner (/max)
  'sdt_y0SPJJ', // Zoe Bannatyne (/zoe)
  'sdt_ySKCJy', // Dylan Lyall (/dylan-l)

];

export function isValidStudentId(studentId) {
  return VALID_STUDENT_IDS.includes(studentId);
}

export function getStudentInfo(studentId) {
  if (!isValidStudentId(studentId)) {
    return null;
  }

  const thetaCredential = thetaCredentials[studentId];
  const soundsliceUrl = SOUNDSLICE_MAPPINGS[studentId];

  return {
    id: studentId,
    name: extractNameFromCredentials(thetaCredential),
    thetaCredentials: thetaCredential ? {
      username: thetaCredential,
      password: thetaCredential
    } : null,
    soundsliceUrl: soundsliceUrl,
    hasTheta: !!thetaCredential,
    hasSoundslice: !!soundsliceUrl
  };
}

function extractNameFromCredentials(credential) {
  if (!credential) return 'Student';

  // Extract name from credentials like 'mathildefc' -> 'Mathilde'
  const name = credential.replace('fc', '').replace('firstchord', '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function generateStudentUrl(studentId) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl}/student/${studentId}`;
}

// Get student data including notes (reuses existing API)
export async function getStudentData(studentId) {
  if (!isValidStudentId(studentId)) {
    return null;
  }

  const studentInfo = getStudentInfo(studentId);
  if (!studentInfo) return null;

  try {
    // Use optimized API call with caching for student portals
    const mmsClient = (await import('@/lib/mms-client-cached')).default;
    const notesResult = await mmsClient.getStudentNotes(studentId, { studentPortal: true });

    if (notesResult.success) {
      // Transform the MMS data format to match what StudentNotes expects
      const transformedNotes = {
        lesson_date: notesResult.date,
        notes: notesResult.notes,
        tutor_name: notesResult.tutor,
        attendance: notesResult.attendanceStatus
      };

      return {
        ...studentInfo,
        notes: transformedNotes,
        notesSuccess: true,
        notesSource: 'mms-direct'
      };
    } else {
      // Return student info without notes if API fails
      return {
        ...studentInfo,
        notes: null,
        notesSuccess: false,
        notesSource: 'unavailable'
      };
    }
  } catch (error) {
    console.error('Error fetching student data:', error);
    return {
      ...studentInfo,
      notes: null,
      notesSuccess: false,
      notesSource: 'error'
    };
  }
}
