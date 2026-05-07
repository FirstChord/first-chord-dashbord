import { appendRegistryEntry, getRegistryEntryByMmsId, getRegistryEntries, updateRegistryEntry } from '@/lib/admin/registry';
import { getPauseHistoryRows, getReviewFlagsRows, getStudentsSheetRows, updateStudentSheetRow } from '@/lib/admin/sheets';
import { generateFcStudentId, generateFriendlyUrl, normaliseInstrument } from './fc';
import { derivePaymentExpectation, derivePaymentMode } from './payments-helpers.mjs';
import { buildPauseSummary } from './pause-helpers.mjs';
import { getTutorShortNameByFullName } from './tutors.js';

function pickFirst(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (`${value || ''}`.trim() !== '') {
      return value;
    }
  }
  return '';
}

function normaliseStudentRow(row) {
  const mmsId = pickFirst(row, ['mms_id', 'MMS ID', 'MMS Id', 'Student ID']);
  const firstName = pickFirst(row, ['Student forename', 'First Name', 'Forename']);
  const lastName = pickFirst(row, ['Student Surname', 'Last Name', 'Surname']);
  const tutor = pickFirst(row, ['Tutor']);
  const instrument = pickFirst(row, ['Instrument']);
  const email = pickFirst(row, ['Email']);
  const contactNumber = pickFirst(row, ['Contact Number', 'Phone', 'Telephone']);
  const lessonLength = pickFirst(row, ['Lesson length', 'Lesson Length']);
  const fcStudentId = pickFirst(row, ['FC Student ID']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return {
    mmsId,
    firstName,
    lastName,
    fullName,
    tutor,
    instrument,
    email,
    contactNumber,
    lessonLength,
    fcStudentId,
    parentFirstName: pickFirst(row, ['Parent forename', 'Parent First Name']),
    parentLastName: pickFirst(row, ['Parent surname', 'Parent Last Name']),
    stripeCustomerId: pickFirst(row, ['stripe_customer_id']),
    stripeSubscriptionId: pickFirst(row, ['stripe_subscription_id']),
    paymentMode: derivePaymentMode({
      explicitMode: pickFirst(row, ['payment_mode', 'Payment mode', 'Payment Mode']),
      fullName,
    }),
    paymentExpectation: derivePaymentExpectation({
      explicitExpectation: pickFirst(row, ['payment_expectation', 'Payment expectation', 'Payment Expectation']),
      paymentMode: derivePaymentMode({
        explicitMode: pickFirst(row, ['payment_mode', 'Payment mode', 'Payment Mode']),
        fullName,
      }),
    }),
    raw: row,
  };
}

function buildFlagsMap(flags) {
  const byMmsId = new Map();

  for (const flag of flags) {
    const mmsId = pickFirst(flag, ['mms_id', 'MMS ID', 'student_mms_id']);
    if (!mmsId) continue;

    const list = byMmsId.get(mmsId) || [];
    list.push({
      category: pickFirst(flag, ['category', 'Category']),
      detail: pickFirst(flag, ['detail', 'Detail', 'message', 'Message']),
    });
    byMmsId.set(mmsId, list);
  }

  return byMmsId;
}

export async function getAdminStudents() {
  const [sheetRows, registryEntries, flagRows, pauseHistoryRows] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntries(),
    getReviewFlagsRows(),
    getPauseHistoryRows(),
  ]);

  const flagsByMmsId = buildFlagsMap(flagRows);
  const registryByMmsId = new Map(registryEntries.map((entry) => [entry.mmsId, entry]));

  return sheetRows
    .map(normaliseStudentRow)
    .filter((student) => student.mmsId)
    .map((student) => {
      const registry = registryByMmsId.get(student.mmsId) || null;
      const flags = flagsByMmsId.get(student.mmsId) || [];

      return {
        ...student,
        instrument: student.instrument || registry?.instrument || '',
        fcStudentId: student.fcStudentId || registry?.fcStudentId || '',
        registry,
        registryTutor: registry?.tutor || '',
        pauseSummary: buildPauseSummary({
          studentEmail: student.email,
          stripeSubscriptionId: student.stripeSubscriptionId,
          pauseRows: pauseHistoryRows,
        }),
        hasFlags: flags.length > 0,
        flags,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getAdminStudentByMmsId(mmsId) {
  const [sheetRows, registry, flagRows, pauseHistoryRows] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntryByMmsId(mmsId),
    getReviewFlagsRows(),
    getPauseHistoryRows(),
  ]);

  const sheetStudent = sheetRows
    .map(normaliseStudentRow)
    .find((student) => student.mmsId === mmsId);

  if (!sheetStudent) {
    return null;
  }

  const flags = flagRows
    .filter((flag) => pickFirst(flag, ['mms_id', 'MMS ID', 'student_mms_id']) === mmsId)
    .map((flag) => ({
      category: pickFirst(flag, ['category', 'Category']),
      detail: pickFirst(flag, ['detail', 'Detail', 'message', 'Message']),
    }));

  return {
    ...sheetStudent,
    instrument: sheetStudent.instrument || registry?.instrument || '',
    fcStudentId: sheetStudent.fcStudentId || registry?.fcStudentId || '',
    registry,
    registryTutor: registry?.tutor || '',
    pauseSummary: buildPauseSummary({
      studentEmail: sheetStudent.email,
      stripeSubscriptionId: sheetStudent.stripeSubscriptionId,
      pauseRows: pauseHistoryRows,
    }),
    hasFlags: flags.length > 0,
    flags,
  };
}

export async function updateAdminStudent({ mmsId, sheetsUpdates = {}, registryUpdates = {} }) {
  if (Object.keys(sheetsUpdates).length > 0) {
    await updateStudentSheetRow(mmsId, sheetsUpdates);
  }

  if (Object.keys(registryUpdates).length > 0) {
    await updateRegistryEntry(mmsId, registryUpdates);
  }

  return getAdminStudentByMmsId(mmsId);
}

export async function createRegistryEntryForStudent(mmsId) {
  const student = await getAdminStudentByMmsId(mmsId);

  if (!student) {
    throw new Error(`Student ${mmsId} was not found in Sheets`);
  }

  if (student.registry) {
    return student;
  }

  const tutorShortName = getTutorShortNameByFullName(student.tutor);
  if (!tutorShortName) {
    throw new Error(`Could not map Sheets tutor "${student.tutor}" to a registry tutor short name`);
  }

  const instrument = normaliseInstrument(student.instrument || '');
  const fcStudentId = student.fcStudentId || generateFcStudentId(student.firstName, student.lastName, student.email);
  const thetaUsername = `${student.firstName || ''}${student.lastName || ''}fc`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const friendlyUrl = await generateFriendlyUrl(student.firstName, student.lastName);

  await appendRegistryEntry({
    mmsId: student.mmsId,
    firstName: student.firstName,
    lastName: student.lastName,
    friendlyUrl,
    tutor: tutorShortName,
    instrument,
    soundsliceUrl: '',
    thetaUsername,
    fcStudentId,
  });

  return getAdminStudentByMmsId(mmsId);
}
