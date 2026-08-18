/** @fileoverview Reads the sheet, registry, and MMS state behind onboarding duplicate detection and the preflight check. */
import {
  assertRegistryWriteAvailable,
  getRegistryEntryByMmsId,
} from '@/lib/admin/registry';
import { getStudentsSheetRows } from '@/lib/admin/sheets';
import { getStudentOperationalState, getValidatedMmsFreeCalendarSlot } from '@/lib/admin/mms';
import { evaluateOnboardingDuplicateState } from './onboarding-helpers.mjs';

export {
  buildOnboardingCompletionStatus,
  buildOnboardingRecoveryGuidance,
  createOnboardingSteps,
  evaluateOnboardingDuplicateState,
  isOnboardingCoreOperationallyComplete,
  markOnboardingStep,
} from './onboarding-helpers.mjs';

export async function getOnboardingDuplicateState({ mmsId, tutorFullName, tutorShortName }) {
  const [sheetRows, registryEntry] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntryByMmsId(mmsId),
  ]);

  return evaluateOnboardingDuplicateState({
    mmsId,
    tutorFullName,
    tutorShortName,
    sheetRows,
    registryEntry,
  });
}

export async function getOnboardingPreflightState({
  mmsId,
  tutorFullName,
  tutorShortName,
  teacherId = '',
  lessonDate = '',
  lessonTime = '',
  lessonLength = '',
  freeEventId = '',
}) {
  await assertRegistryWriteAvailable();

  const [sheetRows, registryEntry, operationalState, freeSlot] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntryByMmsId(mmsId),
    getStudentOperationalState({
      studentId: mmsId,
      teacherId,
      lessonDate,
      lessonTime,
    }),
    freeEventId
      ? getValidatedMmsFreeCalendarSlot({
          eventId: freeEventId,
          teacherId,
          lessonDate,
          lessonTime,
          durationMinutes: lessonLength,
        })
      : Promise.resolve(null),
  ]);

  const duplicateState = evaluateOnboardingDuplicateState({
    mmsId,
    tutorFullName,
    tutorShortName,
    sheetRows,
    registryEntry,
  });

  return {
    duplicateState,
    operationalState,
    freeSlot,
  };
}
