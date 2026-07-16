import { getActiveTutorOptions } from './tutors.js';
import { getCoverBankStateRows, getScheduleContextRows, upsertCoverBankStateRow } from './sheets.js';
import {
  buildExternalTutorKey,
  deriveTeachingDaysByTeacherId,
  normaliseAvailableDays,
  normaliseCoverBankCallStatus,
  normaliseCoverBankNotice,
  normaliseCoverBankTutorType,
  normaliseCoverBankWilling,
} from './cover-bank-helpers.mjs';

function hydrateState(row = {}) {
  return {
    callStatus: normaliseCoverBankCallStatus(row.callStatus),
    willing: normaliseCoverBankWilling(row.willing),
    notice: normaliseCoverBankNotice(row.notice),
    availableDays: normaliseAvailableDays(row.availableDays),
    notes: row.notes || '',
    lastContactedAt: row.lastContactedAt || '',
    updatedAt: row.updatedAt || '',
    updatedBy: row.updatedBy || '',
  };
}

export async function getCoverBankWorkflow() {
  const [tutors, stateRows, scheduleRows] = await Promise.all([
    getActiveTutorOptions(),
    getCoverBankStateRows(),
    getScheduleContextRows(),
  ]);

  const stateByTutorKey = new Map(stateRows.map((row) => [row.tutorKey, row]));
  const teachingDaysByTeacherId = deriveTeachingDaysByTeacherId(scheduleRows);

  const internalRecords = tutors.map((tutor) => {
    const row = stateByTutorKey.get(tutor.shortName) || {};
    return {
      tutor: {
        tutorKey: tutor.shortName,
        tutorName: tutor.fullName,
        tutorType: 'internal',
        phone: row.phone || '',
        instruments: tutor.instruments || [],
        teachingDays: [...(teachingDaysByTeacherId.get(tutor.teacherId) || [])],
      },
      state: hydrateState(row),
    };
  });

  const externalRecords = stateRows
    .filter((row) => normaliseCoverBankTutorType(row.tutorType) === 'external')
    .map((row) => ({
      tutor: {
        tutorKey: row.tutorKey,
        tutorName: row.tutorName,
        tutorType: 'external',
        phone: row.phone || '',
        instruments: row.instruments || [],
        teachingDays: [],
      },
      state: hydrateState(row),
    }));

  const records = [...internalRecords, ...externalRecords];
  const completedCount = records.filter((record) => record.state.callStatus === 'completed').length;

  return {
    records,
    progress: {
      total: records.length,
      completed: completedCount,
    },
  };
}

export async function saveCoverBankRecord({
  tutorKey = '',
  tutorName = '',
  tutorType = '',
  phone = '',
  instruments = [],
  callStatus = '',
  willing = '',
  notice = '',
  availableDays = [],
  notes = '',
  lastContactedAt = '',
  updatedBy = '',
}) {
  const normalisedType = normaliseCoverBankTutorType(tutorType);
  const resolvedTutorKey = `${tutorKey || ''}`.trim()
    || (normalisedType === 'external' ? buildExternalTutorKey(tutorName) : '');

  if (!resolvedTutorKey) {
    throw new Error('tutorKey is required');
  }

  const stateRow = {
    recordId: `cover_bank:${resolvedTutorKey}`,
    tutorKey: resolvedTutorKey,
    tutorName: `${tutorName || ''}`.trim(),
    tutorType: normalisedType,
    phone: `${phone || ''}`.trim(),
    instruments: Array.isArray(instruments) ? instruments : [],
    callStatus: normaliseCoverBankCallStatus(callStatus),
    willing: normaliseCoverBankWilling(willing),
    notice: normaliseCoverBankNotice(notice),
    availableDays: normaliseAvailableDays(availableDays),
    notes: `${notes || ''}`.trim(),
    lastContactedAt,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await upsertCoverBankStateRow(stateRow);

  return stateRow;
}
