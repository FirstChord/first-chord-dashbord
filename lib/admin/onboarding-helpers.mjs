function pickFirst(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (`${value || ''}`.trim() !== '') {
      return `${value}`.trim();
    }
  }
  return '';
}

export function evaluateOnboardingDuplicateState({
  mmsId,
  tutorFullName,
  tutorShortName,
  sheetRows = [],
  registryEntry = null,
}) {
  const matchingSheetRows = sheetRows.filter((row) => pickFirst(row, ['mms_id', 'MMS ID', 'MMS Id', 'Student ID']) === mmsId);
  const matchingTutors = new Set(
    matchingSheetRows
      .map((row) => pickFirst(row, ['Tutor']))
      .filter(Boolean),
  );

  const hasSameTutorSheetRow = tutorFullName ? matchingTutors.has(tutorFullName) : false;
  const hasDifferentTutorSheetRow = matchingTutors.size > 0 && !hasSameTutorSheetRow;

  const registryTutor = registryEntry?.tutor || '';
  const registryMatchesTutor = Boolean(registryTutor && tutorShortName && registryTutor === tutorShortName);
  const registryExists = Boolean(registryEntry);

  const blockingReasons = [];
  const warnings = [];

  if (hasSameTutorSheetRow) {
    blockingReasons.push(`A Students sheet row already exists for ${mmsId} with tutor ${tutorFullName}.`);
  }

  if (registryExists && registryMatchesTutor) {
    blockingReasons.push(`A registry entry already exists for ${mmsId} with tutor ${tutorShortName}.`);
  }

  if (hasDifferentTutorSheetRow) {
    warnings.push('This student already has a Students sheet row for another tutor. This may be a valid multi-lesson case.');
  }

  if (registryExists && !registryMatchesTutor) {
    warnings.push(`This student already has a registry entry for tutor ${registryTutor}. The existing portal record will be kept.`);
  }

  return {
    exactDuplicate: blockingReasons.length > 0,
    blockingReasons,
    warnings,
    matchingTutorCount: matchingTutors.size,
    matchingTutors: [...matchingTutors],
    hasSameTutorSheetRow,
    hasDifferentTutorSheetRow,
    registryExists,
    registryTutor,
    registryMatchesTutor,
    shouldAppendRegistry: !registryExists,
  };
}

export function createOnboardingSteps() {
  return {
    duplicateCheck: { status: 'pending', detail: '' },
    sheetsWrite: { status: 'pending', detail: '' },
    registryWrite: { status: 'pending', detail: '' },
    mmsActivation: { status: 'pending', detail: '' },
    mmsBillingProfile: { status: 'pending', detail: '' },
    mmsFirstLesson: { status: 'pending', detail: '' },
  };
}

export function markOnboardingStep(steps, stepKey, status, detail = '') {
  return {
    ...steps,
    [stepKey]: {
      status,
      detail,
    },
  };
}

export function buildOnboardingRecoveryGuidance({ steps, duplicateState = null }) {
  const guidance = [];

  if (duplicateState?.exactDuplicate) {
    guidance.push('This student already exists for the selected tutor in the current dashboard lanes.');
    guidance.push('Review the existing student record before attempting another onboarding run.');
  }

  if (steps.sheetsWrite?.status === 'succeeded' && steps.mmsActivation?.status !== 'succeeded') {
    guidance.push('The student is in Sheets, but MMS activation is incomplete. Retry the MMS-side workflow only after checking the live student record.');
  }

  if (steps.mmsActivation?.status === 'succeeded' && steps.mmsBillingProfile?.status !== 'succeeded') {
    guidance.push('The student is active in MMS, but billing profile setup still needs attention before lesson creation is reliable.');
  }

  if (steps.mmsBillingProfile?.status === 'succeeded' && steps.mmsFirstLesson?.status !== 'succeeded') {
    guidance.push('Billing is ready, but the first lesson was not confirmed. Check the calendar before retrying to avoid duplicates.');
  }

  if (steps.registryWrite?.status === 'succeeded' && steps.mmsFirstLesson?.status === 'failed') {
    guidance.push('The portal-side record exists already. Avoid re-appending registry data during recovery.');
  }

  return guidance;
}

export function buildOnboardingCompletionStatus({ steps }) {
  const isReady = (step) => step?.status === 'succeeded' || step?.status === 'skipped';

  const sheetsReady = steps.sheetsWrite?.status === 'succeeded';
  const registryReady = isReady(steps.registryWrite);
  const mmsActivated = isReady(steps.mmsActivation);
  const billingReady = isReady(steps.mmsBillingProfile);
  const firstLessonReady = isReady(steps.mmsFirstLesson);

  return {
    canonicalRecord: {
      status: sheetsReady && registryReady ? 'complete' : 'incomplete',
      label: sheetsReady && registryReady ? 'Canonical student record created' : 'Canonical student record incomplete',
      detail: sheetsReady && registryReady
        ? 'Sheets and registry lanes are in place.'
        : 'A required canonical write is still incomplete.',
    },
    mmsOperationalState: {
      status: mmsActivated && billingReady && firstLessonReady ? 'complete' : mmsActivated ? 'partial' : 'incomplete',
      label: mmsActivated && billingReady && firstLessonReady ? 'MMS setup complete' : 'MMS setup still needs attention',
      detail: mmsActivated && billingReady && firstLessonReady
        ? 'Student is active, billable, and has a scheduled lesson in MMS.'
        : 'Activation, billing profile, or first lesson still needs follow-up.',
    },
    fcIdentityRefresh: {
      status: 'pending',
      label: 'FC identity refresh pending',
      detail: 'Run python3 generate_fc_ids.py in first-chord-brain to refresh FC exports and Review_Flags.',
    },
    portalActivation: {
      status: 'pending',
      label: 'Portal activation pending',
      detail: 'Run npm run generate-configs && git push in this repo to publish derived dashboard config changes.',
    },
  };
}
