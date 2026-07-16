export const COVER_BANK_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const COVER_BANK_CALL_STATUS_OPTIONS = [
  { value: 'not_called', label: 'Not Called' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'completed', label: 'Completed' },
];

// Every cover is arranged by asking anyway, so "maybe" carries no information —
// the answer is yes or no. The nuance that matters is notice tolerance below.
export const COVER_BANK_WILLING_OPTIONS = [
  { value: '', label: 'Not asked' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export const COVER_BANK_NOTICE_OPTIONS = [
  { value: '', label: 'Not asked' },
  { value: 'same_day', label: 'Same-day OK' },
  { value: 'needs_notice', label: 'Needs notice' },
];

const CALL_STATUS_VALUES = new Set(COVER_BANK_CALL_STATUS_OPTIONS.map((option) => option.value));
const WILLING_VALUES = new Set(COVER_BANK_WILLING_OPTIONS.map((option) => option.value).filter(Boolean));
const NOTICE_VALUES = new Set(COVER_BANK_NOTICE_OPTIONS.map((option) => option.value).filter(Boolean));
const WEEKDAY_SET = new Set(COVER_BANK_WEEKDAYS);

export function normaliseCoverBankCallStatus(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return CALL_STATUS_VALUES.has(normalised) ? normalised : 'not_called';
}

export function normaliseCoverBankWilling(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return WILLING_VALUES.has(normalised) ? normalised : '';
}

export function normaliseCoverBankNotice(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return NOTICE_VALUES.has(normalised) ? normalised : '';
}

export function normaliseCoverBankTutorType(value = '') {
  return `${value || ''}`.trim().toLowerCase() === 'external' ? 'external' : 'internal';
}

// Keeps days in Monday-first order regardless of tick order on the call.
export function normaliseAvailableDays(days = []) {
  const requested = new Set(
    (Array.isArray(days) ? days : [])
      .map((day) => `${day || ''}`.trim())
      .filter((day) => WEEKDAY_SET.has(day)),
  );
  return COVER_BANK_WEEKDAYS.filter((day) => requested.has(day));
}

export function buildExternalTutorKey(name = '') {
  const slug = `${name || ''}`
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `ext:${slug}` : '';
}

// teacherId → Set of weekdays that tutor already teaches, from Schedule_Context.
export function deriveTeachingDaysByTeacherId(scheduleRows = []) {
  const teachingDays = new Map();
  for (const row of scheduleRows) {
    if (row?.status !== 'found' || !row.teacherId || !WEEKDAY_SET.has(row.usualWeekday)) {
      continue;
    }
    if (!teachingDays.has(row.teacherId)) {
      teachingDays.set(row.teacherId, new Set());
    }
    teachingDays.get(row.teacherId).add(row.usualWeekday);
  }
  return teachingDays;
}

export function weekdayFromDateInput(value = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(`${value || ''}`)) return '';
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[date.getUTCDay()];
}

// Ranked cover candidates for an absence: firm yeses with the day ticked, an
// absence usually being a same-day ask. Order: free + same-day OK, then free +
// needs-notice/unasked, then already-teaching (flagged, not hidden — partial
// days exist). Within a group, more matched instruments first. Instrument
// mismatch never excludes — a candidate may still run a useful lesson.
export function rankCoverCandidates({ coverBankRecords = [], weekday = '', neededInstruments = [], absentTutorKey = '' } = {}) {
  const needed = new Set(neededInstruments.map((instrument) => `${instrument || ''}`.trim().toLowerCase()).filter(Boolean));

  return coverBankRecords
    .filter((record) => (
      record.tutor?.tutorKey
      && record.tutor.tutorKey !== absentTutorKey
      && record.state?.willing === 'yes'
      && (record.state?.availableDays || []).includes(weekday)
    ))
    .map((record) => {
      const instruments = (record.tutor.instruments || []).map((instrument) => `${instrument}`.toLowerCase());
      const alreadyTeaching = (record.tutor.teachingDays || []).includes(weekday);
      return {
        tutorKey: record.tutor.tutorKey,
        tutorName: record.tutor.tutorName,
        tutorType: record.tutor.tutorType || 'internal',
        phone: record.tutor.phone || '',
        notice: record.state.notice || '',
        notes: record.state.notes || '',
        alreadyTeaching,
        matchedInstruments: [...needed].filter((instrument) => instruments.includes(instrument)),
      };
    })
    .sort((a, b) => {
      const group = (candidate) => (candidate.alreadyTeaching ? 2 : candidate.notice === 'same_day' ? 0 : 1);
      return group(a) - group(b)
        || b.matchedInstruments.length - a.matchedInstruments.length
        || a.tutorName.localeCompare(b.tutorName);
    });
}

// A tutor counts as cover for a day when they said yes and ticked the day.
// Teaching that day doesn't remove them — it flags them (they may still have a
// free part of the day), so callers render them second with a teaching chip.
export function summariseCoverForDay(records = [], weekday = '') {
  const candidates = records.filter((record) => (
    record.state?.willing === 'yes'
    && (record.state?.availableDays || []).includes(weekday)
  ));

  return {
    free: candidates.filter((record) => !(record.tutor?.teachingDays || []).includes(weekday)),
    alreadyTeaching: candidates.filter((record) => (record.tutor?.teachingDays || []).includes(weekday)),
  };
}
