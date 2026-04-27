import { getRegistryEntryByMmsId } from '@/lib/admin/registry';
import { getStudentsSheetRows } from '@/lib/admin/sheets';
import { getStudentOperationalState } from '@/lib/admin/mms';
import {
  buildOnboardingCompletionStatus,
  buildOnboardingRecoveryGuidance,
  createOnboardingSteps,
  evaluateOnboardingDuplicateState,
  markOnboardingStep,
} from './onboarding-helpers.mjs';

export {
  buildOnboardingCompletionStatus,
  buildOnboardingRecoveryGuidance,
  createOnboardingSteps,
  evaluateOnboardingDuplicateState,
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
}) {
  const [sheetRows, registryEntry, operationalState] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntryByMmsId(mmsId),
    getStudentOperationalState({
      studentId: mmsId,
      teacherId,
      lessonDate,
      lessonTime,
    }),
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
  };
}
