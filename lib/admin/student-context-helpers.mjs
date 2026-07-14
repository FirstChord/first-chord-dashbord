import { deriveStudentLifecycleStatus } from './lifecycle-helpers.mjs';
import {
  derivePaymentExpectation,
  derivePaymentMode,
  normalisePaymentExpectation,
  normalisePaymentMode,
} from './payments-helpers.mjs';
import { derivePaymentValueContext } from './payment-value-helpers.mjs';
import { buildPauseSummary, derivePauseCoverageContext } from './pause-helpers.mjs';
import { derivePauseExpectationDecision } from './pause-auto-sync-helpers.mjs';
import { enrichScheduleContextsWithSharedSlots } from './schedule-context-helpers.mjs';
import { buildTestStudentIdSet, isTestStudentRecord } from './test-student-helpers.mjs';

const REGISTRY_FALLBACK_FIELDS = [
  'instrument',
  'lessonType',
  'billingGroupId',
  'groupPartnerMmsId',
  'lessonFrequency',
  'fcStudentId',
];

const CONFLICT_FIELDS = [
  'firstName',
  'lastName',
  'instrument',
  'lessonType',
  'billingGroupId',
  'groupPartnerMmsId',
  'lessonFrequency',
  'fcStudentId',
];

function hasValue(value) {
  return `${value ?? ''}`.trim() !== '';
}

function comparable(value) {
  return `${value ?? ''}`.trim().toLowerCase();
}

export function pickFirstStudentValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (hasValue(value)) return value;
  }
  return '';
}

export function normaliseStudentSheetRow(row = {}) {
  const mmsId = pickFirstStudentValue(row, ['mms_id', 'MMS ID', 'MMS Id', 'Student ID']);
  const firstName = pickFirstStudentValue(row, ['Student forename', 'First Name', 'Forename']);
  const lastName = pickFirstStudentValue(row, ['Student Surname', 'Last Name', 'Surname']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const stripeCustomerId = pickFirstStudentValue(row, ['stripe_customer_id']);
  const stripeSubscriptionId = pickFirstStudentValue(row, ['stripe_subscription_id']);
  const explicitPaymentMode = pickFirstStudentValue(row, ['payment_mode', 'Payment mode', 'Payment Mode']);
  const paymentMode = derivePaymentMode({ explicitMode: explicitPaymentMode, fullName });
  const explicitPaymentExpectation = pickFirstStudentValue(row, [
    'payment_expectation',
    'Payment expectation',
    'Payment Expectation',
  ]);

  return {
    mmsId,
    firstName,
    lastName,
    fullName,
    tutor: pickFirstStudentValue(row, ['Tutor']),
    instrument: pickFirstStudentValue(row, ['Instrument']),
    email: pickFirstStudentValue(row, ['Email']),
    contactNumber: pickFirstStudentValue(row, ['Contact Number', 'Phone', 'Telephone']),
    lessonLength: pickFirstStudentValue(row, ['Lesson length', 'Lesson Length']),
    lessonType: pickFirstStudentValue(row, ['lesson_type', 'Lesson type', 'Lesson Type']),
    billingGroupId: pickFirstStudentValue(row, ['billing_group_id', 'Billing group ID']),
    groupPartnerMmsId: pickFirstStudentValue(row, ['group_partner_mms_id', 'Group partner MMS ID']),
    lessonFrequency: pickFirstStudentValue(row, ['lesson_frequency', 'Lesson frequency', 'Lesson Frequency']),
    fcStudentId: pickFirstStudentValue(row, ['FC Student ID']),
    parentFirstName: pickFirstStudentValue(row, ['Parent forename', 'Parent First Name']),
    parentLastName: pickFirstStudentValue(row, ['Parent surname', 'Parent Last Name']),
    stripeCustomerId,
    stripeSubscriptionId,
    paymentMode,
    paymentExpectation: derivePaymentExpectation({
      explicitExpectation: explicitPaymentExpectation,
      paymentMode,
      stripeCustomerId,
      stripeSubscriptionId,
    }),
    isTestStudent: isTestStudentRecord({ raw: row }),
    raw: row,
    _contextInputs: {
      explicitPaymentMode,
      explicitPaymentExpectation,
    },
  };
}

function buildFlagsMap(flagRows = []) {
  const byMmsId = new Map();
  for (const flag of flagRows) {
    const mmsId = pickFirstStudentValue(flag, ['mms_id', 'MMS ID', 'student_mms_id']);
    if (!mmsId) continue;
    const flags = byMmsId.get(mmsId) || [];
    flags.push({
      category: pickFirstStudentValue(flag, ['category', 'Category']),
      detail: pickFirstStudentValue(flag, ['detail', 'Detail', 'message', 'Message']),
    });
    byMmsId.set(mmsId, flags);
  }
  return byMmsId;
}

function scheduleFreshness(scheduleContext, currentDate, staleAfterDays) {
  if (!scheduleContext?.checkedAt) return 'unknown';
  const checkedAt = new Date(scheduleContext.checkedAt);
  const now = currentDate instanceof Date ? currentDate : new Date(currentDate);
  if (Number.isNaN(checkedAt.getTime()) || Number.isNaN(now.getTime())) return 'unknown';
  return now.getTime() - checkedAt.getTime() > staleAfterDays * 24 * 60 * 60 * 1000
    ? 'stale'
    : 'fresh';
}

function buildFieldProvenance(student, registry) {
  const fields = {};
  const conflicts = [];

  for (const field of REGISTRY_FALLBACK_FIELDS) {
    const sheetPresent = hasValue(student[field]);
    const registryPresent = hasValue(registry?.[field]);
    fields[field] = {
      owner: ['instrument', 'fcStudentId'].includes(field) ? 'transitional_split' : 'students_sheet',
      selectedSource: sheetPresent ? 'students_sheet' : registryPresent ? 'student_registry' : 'missing',
      resolution: 'students_sheet_then_registry',
    };
  }

  for (const field of CONFLICT_FIELDS) {
    if (
      hasValue(student[field])
      && hasValue(registry?.[field])
      && comparable(student[field]) !== comparable(registry[field])
    ) {
      conflicts.push({
        field,
        code: 'sheet_registry_mismatch',
        selectedSource: 'students_sheet',
        severity: field === 'fcStudentId' ? 'high' : 'review',
      });
    }
  }

  const explicitMode = student._contextInputs?.explicitPaymentMode || '';
  const explicitExpectation = student._contextInputs?.explicitPaymentExpectation || '';
  fields.paymentMode = {
    owner: 'students_sheet',
    selectedSource: normalisePaymentMode(explicitMode) ? 'students_sheet' : 'derived_payment_rule',
    resolution: normalisePaymentMode(explicitMode) ? 'explicit' : 'manual_allowlist_or_default',
  };
  fields.paymentExpectation = {
    owner: 'students_sheet',
    selectedSource: normalisePaymentExpectation(explicitExpectation) ? 'students_sheet' : 'derived_payment_rule',
    resolution: normalisePaymentExpectation(explicitExpectation) ? 'explicit' : 'payment_mode_and_linkage_default',
  };

  return { fields, conflicts };
}

function mergeRegistryFallbacks(student, registry) {
  return REGISTRY_FALLBACK_FIELDS.reduce(
    (result, field) => ({ ...result, [field]: student[field] || registry?.[field] || '' }),
    { ...student },
  );
}

export function buildStudentContextCollection({
  rawSheetRows = [],
  registryEntries = [],
  flagRows = [],
  pauseHistoryRows = [],
  waitingRows = [],
  scheduleRows = null,
  excludeTestStudents = false,
  currentDate = new Date(),
  scheduleStaleAfterDays = 21,
} = {}) {
  const normalisedStudents = rawSheetRows.map(normaliseStudentSheetRow);
  const testStudentIds = buildTestStudentIdSet(normalisedStudents, registryEntries);
  const selectedRegistryEntries = excludeTestStudents
    ? registryEntries.filter((entry) => !testStudentIds.has(entry.mmsId))
    : registryEntries;
  const registryByMmsId = new Map(selectedRegistryEntries.map((entry) => [entry.mmsId, entry]));
  const flagsByMmsId = buildFlagsMap(flagRows);
  const waitingByMmsId = new Map(waitingRows.map((row) => [row.mmsId, row]));
  const scheduleLoaded = Array.isArray(scheduleRows);
  const scheduleByMmsId = scheduleLoaded
    ? enrichScheduleContextsWithSharedSlots(scheduleRows)
    : new Map();
  const duplicateMmsIds = [...normalisedStudents.reduce((counts, student) => {
    if (student.mmsId) counts.set(student.mmsId, (counts.get(student.mmsId) || 0) + 1);
    return counts;
  }, new Map()).entries()]
    .filter(([, count]) => count > 1)
    .map(([mmsId]) => mmsId);

  const students = normalisedStudents
    .filter((student) => student.mmsId)
    .filter((student) => !excludeTestStudents || !testStudentIds.has(student.mmsId))
    .map((student) => {
      const registry = registryByMmsId.get(student.mmsId) || null;
      const waitingState = waitingByMmsId.get(student.mmsId) || null;
      const scheduleContext = scheduleByMmsId.get(student.mmsId) || null;
      const pauseSummary = buildPauseSummary({
        studentEmail: student.email,
        studentName: student.fullName,
        stripeSubscriptionId: student.stripeSubscriptionId,
        pauseRows: pauseHistoryRows,
        currentDate,
      });
      const mergedStudent = mergeRegistryFallbacks(student, registry);
      const lifecycle = deriveStudentLifecycleStatus({
        ...mergedStudent,
        registry,
        hasRegistryEntry: Boolean(registry),
        waitingState,
        pauseSummary,
      });
      const flags = flagsByMmsId.get(student.mmsId) || [];
      const fieldProvenance = buildFieldProvenance(student, registry);
      const base = {
        ...mergedStudent,
        registry,
        registryEntry: registry,
        registryTutor: registry?.tutor || '',
        waitingState,
        waitingStatus: waitingState?.status || '',
        pauseSummary,
        isTestStudent: isTestStudentRecord({ ...student, registry, registryEntry: registry }),
        ...lifecycle,
        hasFlags: flags.length > 0,
        flags,
      };
      delete base._contextInputs;

      if (scheduleLoaded) {
        base.scheduleContext = scheduleContext;
        base.paymentValueContext = derivePaymentValueContext(base);
        base.pauseCoverageContext = derivePauseCoverageContext({
          pauseSummary,
          scheduleContext,
          currentDate,
        });
        base.pauseExpectationDecision = derivePauseExpectationDecision(base, { currentDate });
      }

      base.provenance = {
        schemaVersion: 1,
        sources: {
          studentsSheet: { role: 'source_truth', present: true, freshness: 'unknown' },
          studentRegistry: { role: 'source_truth', present: Boolean(registry), freshness: 'not_recorded' },
          waitingState: { role: 'workflow_state', present: Boolean(waitingState), observedAt: waitingState?.updatedAt || '' },
          pauseHistory: {
            role: 'external_history',
            present: Boolean(pauseSummary.hasPauseHistory),
            matchedBy: pauseSummary.matchedBy || '',
            matchConfidence: pauseSummary.matchConfidence || 'none',
          },
          scheduleContext: {
            role: 'cache',
            loaded: scheduleLoaded,
            present: Boolean(scheduleContext),
            checkedAt: scheduleContext?.checkedAt || '',
            freshness: scheduleFreshness(scheduleContext, currentDate, scheduleStaleAfterDays),
            confidence: scheduleContext?.confidence || 'none',
          },
        },
        fields: fieldProvenance.fields,
        conflicts: fieldProvenance.conflicts,
        derivations: {
          lifecycle: { inputs: ['paymentExpectation', 'pauseSummary', 'waitingState', 'studentRegistry'] },
          paymentValue: { inputs: ['instrument', 'lessonType', 'lessonLength', 'scheduleContext'] },
          pauseExpectation: { inputs: ['paymentExpectation', 'pauseSummary', 'pauseCoverageContext'] },
        },
      };

      return base;
    });

  const studentByMmsId = new Map();
  for (const student of students) {
    if (!studentByMmsId.has(student.mmsId)) studentByMmsId.set(student.mmsId, student);
  }

  return {
    students,
    studentByMmsId,
    testStudentIds,
    registryEntries: selectedRegistryEntries,
    registryByMmsId,
    duplicateMmsIds,
  };
}
