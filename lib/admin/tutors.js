export const ADMIN_TUTORS = {
  Arion: {
    fullName: 'Arion Xenos',
    teacherId: 'tch_zplpJw',
    instruments: ['guitar', 'piano'],
  },
  Calum: {
    fullName: 'Calum Steel',
    teacherId: 'tch_zMX5Jc',
    instruments: ['guitar'],
  },
  Chloe: {
    fullName: 'Chloe Mak',
    teacherId: 'tch_zQbNJk',
    instruments: ['guitar', 'piano'],
  },
  David: {
    fullName: 'David Husz',
    teacherId: 'tch_z2j2Jf',
    instruments: ['guitar', 'piano'],
  },
  Dean: {
    fullName: 'Dean Louden',
    teacherId: 'tch_zV9TJN',
    instruments: ['guitar', 'bass'],
  },
  'Eléna': {
    fullName: 'Eléna Esposito',
    teacherId: 'tch_zpy4J9',
    instruments: ['piano'],
  },
  Fennella: {
    fullName: 'Fennella McCallum',
    teacherId: 'tch_C2bJ9',
    instruments: ['singing', 'piano'],
  },
  Finn: {
    fullName: 'Finn Le Marinel',
    teacherId: 'tch_QhxJJ',
    instruments: ['guitar', 'bass', 'ukulele'],
  },
  Ines: {
    fullName: 'Ines Alban Zapata Peréz',
    teacherId: 'tch_zHJlJx',
    instruments: ['piano'],
  },
  Kenny: {
    fullName: 'Kenny Bates',
    teacherId: 'tch_zsyfJr',
    instruments: ['guitar'],
  },
  Kim: {
    fullName: 'Kim Grant',
    teacherId: 'tch_zVg1Js',
    instruments: ['guitar'],
  },
  Patrick: {
    fullName: 'Patrick Shand',
    teacherId: 'tch_zw9SJ3',
    instruments: ['guitar', 'piano'],
  },
  Robbie: {
    fullName: 'Robbie Tranter',
    teacherId: 'tch_zV9hJ2',
    instruments: ['guitar', 'bass'],
  },
  Scott: {
    fullName: 'Scott Brice',
    teacherId: 'tch_zMWrJR',
    instruments: ['guitar'],
  },
  Stef: {
    fullName: 'Stef McGlinchey',
    teacherId: 'tch_z5YmJX',
    instruments: ['guitar'],
  },
  Tom: {
    fullName: 'Tom Walters',
    teacherId: 'tch_mYJJR',
    instruments: ['guitar', 'bass'],
  },
};

export function getAllTutorOptions() {
  return Object.entries(ADMIN_TUTORS).map(([shortName, tutor]) => ({
    shortName,
    fullName: tutor.fullName,
    teacherId: tutor.teacherId,
    instruments: tutor.instruments,
  }));
}

export function getTutorFullNameByShortName(shortName) {
  return ADMIN_TUTORS[shortName]?.fullName || '';
}

export function getTutorsForInstrument(instrument) {
  const needle = (instrument || '').toLowerCase().trim();
  if (!needle) {
    return getAllTutorOptions();
  }

  return getAllTutorOptions().filter((tutor) => tutor.instruments.includes(needle));
}
