import { appendRegistryEntry, getRegistryEntryByMmsId, getRegistryEntries, updateRegistryEntry } from '@/lib/admin/registry';
import {
  getPauseHistoryRows,
  getReviewFlagsRows,
  getScheduleContextRows,
  getStudentsSheetRows,
  getWaitingListStateRows,
  updateStudentSheetRow,
} from '@/lib/admin/sheets';
import { generateFcStudentId, generateFriendlyUrl, normaliseInstrument } from './fc';
import { deriveStudentLifecycleStatus } from './lifecycle-helpers.mjs';
import { derivePaymentExpectation, derivePaymentMode } from './payments-helpers.mjs';
import { derivePaymentValueContext } from './payment-value-helpers.mjs';
import { buildPauseSummary, derivePauseCoverageContext } from './pause-helpers.mjs';
import { enrichScheduleContextsWithSharedSlots } from './schedule-context-helpers.mjs';
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
    lessonType: pickFirst(row, ['lesson_type', 'Lesson type', 'Lesson Type']),
    billingGroupId: pickFirst(row, ['billing_group_id', 'Billing group ID']),
    groupPartnerMmsId: pickFirst(row, ['group_partner_mms_id', 'Group partner MMS ID']),
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
  const [sheetRows, registryEntries, flagRows, pauseHistoryRows, waitingRows] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntries(),
    getReviewFlagsRows(),
    getPauseHistoryRows(),
    getWaitingListStateRows(),
  ]);

  const flagsByMmsId = buildFlagsMap(flagRows);
  const registryByMmsId = new Map(registryEntries.map((entry) => [entry.mmsId, entry]));
  const waitingByMmsId = new Map(waitingRows.map((row) => [row.mmsId, row]));

  return sheetRows
    .map(normaliseStudentRow)
    .filter((student) => student.mmsId)
    .map((student) => {
      const registry = registryByMmsId.get(student.mmsId) || null;
      const flags = flagsByMmsId.get(student.mmsId) || [];
      const waitingState = waitingByMmsId.get(student.mmsId) || null;
      const pauseSummary = buildPauseSummary({
        studentEmail: student.email,
        studentName: student.fullName,
        stripeSubscriptionId: student.stripeSubscriptionId,
        pauseRows: pauseHistoryRows,
      });
      const lifecycle = deriveStudentLifecycleStatus({
        ...student,
        registry,
        hasRegistryEntry: Boolean(registry),
        waitingState,
        pauseSummary,
      });

      return {
        ...student,
        instrument: student.instrument || registry?.instrument || '',
        fcStudentId: student.fcStudentId || registry?.fcStudentId || '',
        registry,
        registryTutor: registry?.tutor || '',
        waitingState,
        waitingStatus: waitingState?.status || '',
        pauseSummary,
        ...lifecycle,
        hasFlags: flags.length > 0,
        flags,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getAdminStudentByMmsId(mmsId) {
  const [sheetRows, registry, flagRows, pauseHistoryRows, waitingRows, scheduleRows] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntryByMmsId(mmsId),
    getReviewFlagsRows(),
    getPauseHistoryRows(),
    getWaitingListStateRows(),
    getScheduleContextRows(),
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
  const waitingState = waitingRows.find((row) => row.mmsId === mmsId) || null;
  const scheduleByMmsId = enrichScheduleContextsWithSharedSlots(scheduleRows);
  const scheduleContext = scheduleByMmsId.get(mmsId) || null;
  const pauseSummary = buildPauseSummary({
    studentEmail: sheetStudent.email,
    studentName: sheetStudent.fullName,
    stripeSubscriptionId: sheetStudent.stripeSubscriptionId,
    pauseRows: pauseHistoryRows,
  });
  const pauseCoverageContext = derivePauseCoverageContext({
    pauseSummary,
    scheduleContext,
  });
  const lifecycle = deriveStudentLifecycleStatus({
    ...sheetStudent,
    registry,
    hasRegistryEntry: Boolean(registry),
    waitingState,
    pauseSummary,
  });
  const paymentValueContext = derivePaymentValueContext({
    ...sheetStudent,
    instrument: sheetStudent.instrument || registry?.instrument || '',
    scheduleContext,
  });

  return {
    ...sheetStudent,
    instrument: sheetStudent.instrument || registry?.instrument || '',
    fcStudentId: sheetStudent.fcStudentId || registry?.fcStudentId || '',
    registry,
    registryTutor: registry?.tutor || '',
    waitingState,
    waitingStatus: waitingState?.status || '',
    scheduleContext,
    paymentValueContext,
    pauseSummary,
    pauseCoverageContext,
    ...lifecycle,
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

export async function createRegistryEntryForStudent(mmsId, registryOverrides = {}) {
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

  const instrument = normaliseInstrument(registryOverrides.instrument || student.instrument || '');
  if (!instrument) {
    throw new Error('Instrument is required to create a registry entry');
  }

  const soundsliceUrl = `${registryOverrides.soundsliceUrl || ''}`.trim();
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
    soundsliceUrl,
    thetaUsername,
    fcStudentId,
  });

  return getAdminStudentByMmsId(mmsId);
}
