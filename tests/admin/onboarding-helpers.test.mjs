import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOnboardingCompletionStatus,
  buildOnboardingRecoveryGuidance,
  createOnboardingSteps,
  evaluateOnboardingDuplicateState,
  isOnboardingOperationallyComplete,
  markOnboardingStep,
} from '../../lib/admin/onboarding-helpers.mjs';

test('blocks an exact duplicate when the same MMS ID already exists for the same tutor', () => {
  const state = evaluateOnboardingDuplicateState({
    mmsId: 'sdt_same',
    tutorFullName: 'Arion Xenos',
    tutorShortName: 'Arion',
    sheetRows: [
      { mms_id: 'sdt_same', Tutor: 'Arion Xenos' },
    ],
    registryEntry: { mmsId: 'sdt_same', tutor: 'Arion' },
  });

  assert.equal(state.exactDuplicate, true);
  assert.equal(state.shouldAppendRegistry, false);
  assert.match(state.blockingReasons.join(' '), /already exists/);
});

test('allows a multi-tutor case with warnings and keeps the existing registry entry', () => {
  const state = evaluateOnboardingDuplicateState({
    mmsId: 'sdt_multi',
    tutorFullName: 'Arion Xenos',
    tutorShortName: 'Arion',
    sheetRows: [
      { mms_id: 'sdt_multi', Tutor: 'Fennella McCallum' },
    ],
    registryEntry: { mmsId: 'sdt_multi', tutor: 'Fennella' },
  });

  assert.equal(state.exactDuplicate, false);
  assert.equal(state.shouldAppendRegistry, false);
  assert.equal(state.warnings.length, 2);
  assert.match(state.warnings.join(' '), /multi-lesson case/);
});

test('allows a brand new onboarding with no duplicate warnings', () => {
  const state = evaluateOnboardingDuplicateState({
    mmsId: 'sdt_new',
    tutorFullName: 'Arion Xenos',
    tutorShortName: 'Arion',
    sheetRows: [],
    registryEntry: null,
  });

  assert.equal(state.exactDuplicate, false);
  assert.equal(state.shouldAppendRegistry, true);
  assert.deepEqual(state.warnings, []);
});

test('blocks full onboarding and points to recovery when Sheets exists without registry', () => {
  const state = evaluateOnboardingDuplicateState({
    mmsId: 'sdt_partial',
    tutorFullName: 'Finn Le Marinel',
    tutorShortName: 'Finn',
    sheetRows: [
      { mms_id: 'sdt_partial', Tutor: 'Finn Le Marinel' },
    ],
    registryEntry: null,
  });

  assert.equal(state.exactDuplicate, true);
  assert.equal(state.partialCanonicalRecord, true);
  assert.equal(state.shouldAppendRegistry, true);
  assert.match(state.blockingReasons.join(' '), /SHEETS ONLY/);
  assert.match(state.blockingReasons.join(' '), /instead of rerunning full onboarding/i);
});

test('createOnboardingSteps starts every onboarding step in a pending state', () => {
  const steps = createOnboardingSteps();

  assert.deepEqual(Object.keys(steps), [
    'registryPreflight',
    'duplicateCheck',
    'sheetsWrite',
    'registryWrite',
    'mmsActivation',
    'mmsBillingProfile',
    'mmsFirstLesson',
  ]);
  assert.equal(steps.mmsFirstLesson.status, 'pending');
});

test('markOnboardingStep updates only the targeted step', () => {
  const steps = createOnboardingSteps();
  const next = markOnboardingStep(steps, 'sheetsWrite', 'succeeded', 'Inserted into Students sheet at row 10.');

  assert.equal(next.sheetsWrite.status, 'succeeded');
  assert.match(next.sheetsWrite.detail, /row 10/);
  assert.equal(next.registryWrite.status, 'pending');
});

test('buildOnboardingRecoveryGuidance explains partial failure after sheets success', () => {
  let steps = createOnboardingSteps();
  steps = markOnboardingStep(steps, 'duplicateCheck', 'succeeded', 'No blocking duplicate found.');
  steps = markOnboardingStep(steps, 'sheetsWrite', 'succeeded', 'Inserted into Students sheet at row 12.');
  steps = markOnboardingStep(steps, 'registryWrite', 'succeeded', 'Appended new registry entry.');
  steps = markOnboardingStep(steps, 'mmsActivation', 'failed', 'MMS activate student failed: 500');
  steps = markOnboardingStep(steps, 'mmsBillingProfile', 'skipped', 'Skipped because MMS activation did not complete.');
  steps = markOnboardingStep(steps, 'mmsFirstLesson', 'skipped', 'Skipped because MMS activation did not complete.');

  const guidance = buildOnboardingRecoveryGuidance({ steps });

  assert.equal(guidance.length >= 1, true);
  assert.match(guidance.join(' '), /student is in Sheets/i);
});

test('buildOnboardingRecoveryGuidance treats idempotent skipped MMS steps as ready', () => {
  let steps = createOnboardingSteps();
  steps = markOnboardingStep(steps, 'sheetsWrite', 'succeeded', 'Inserted into Students.');
  steps = markOnboardingStep(steps, 'registryWrite', 'succeeded', 'Registry entry created.');
  steps = markOnboardingStep(steps, 'mmsActivation', 'skipped', 'Already active.');
  steps = markOnboardingStep(steps, 'mmsBillingProfile', 'skipped', 'Billing profile already existed.');
  steps = markOnboardingStep(steps, 'mmsFirstLesson', 'failed', 'Lesson creation failed.');

  const guidance = buildOnboardingRecoveryGuidance({ steps });
  const message = guidance.join(' ');

  assert.doesNotMatch(message, /MMS activation is incomplete/);
  assert.doesNotMatch(message, /billing profile setup still needs attention/);
  assert.match(message, /first lesson was not confirmed/);
});

test('buildOnboardingRecoveryGuidance stops before writes when registry preflight fails', () => {
  let steps = createOnboardingSteps();
  steps = markOnboardingStep(steps, 'registryPreflight', 'failed', 'GitHub registry token is read-only.');

  const guidance = buildOnboardingRecoveryGuidance({ steps });

  assert.match(guidance.join(' '), /No student records were written/);
  assert.match(guidance.join(' '), /GitHub registry write access/);
});

test('buildOnboardingRecoveryGuidance directs a missing registry record to narrow recovery', () => {
  let steps = createOnboardingSteps();
  steps = markOnboardingStep(steps, 'registryPreflight', 'succeeded', 'Registry write path is available.');
  steps = markOnboardingStep(steps, 'duplicateCheck', 'failed', 'Students exists but registry is missing.');

  const guidance = buildOnboardingRecoveryGuidance({
    steps,
    duplicateState: {
      exactDuplicate: true,
      partialCanonicalRecord: true,
    },
  });

  assert.match(guidance.join(' '), /Do not rerun full onboarding/);
  assert.match(guidance.join(' '), /Create registry entry/);
});

test('buildOnboardingRecoveryGuidance identifies a registry failure after Sheets succeeded', () => {
  let steps = createOnboardingSteps();
  steps = markOnboardingStep(steps, 'sheetsWrite', 'succeeded', 'Inserted into Students.');
  steps = markOnboardingStep(steps, 'registryWrite', 'failed', 'GitHub registry update failed: 403');

  const guidance = buildOnboardingRecoveryGuidance({ steps });

  assert.match(guidance.join(' '), /Students row was written/);
  assert.match(guidance.join(' '), /SHEETS ONLY/);
});

test('buildOnboardingRecoveryGuidance explains exact duplicate blocks', () => {
  let steps = createOnboardingSteps();
  steps = markOnboardingStep(steps, 'duplicateCheck', 'failed', 'A Students sheet row already exists.');

  const guidance = buildOnboardingRecoveryGuidance({
    steps,
    duplicateState: {
      exactDuplicate: true,
    },
  });

  assert.match(guidance.join(' '), /already exists/i);
  assert.match(guidance.join(' '), /existing student record/i);
});

test('buildOnboardingCompletionStatus marks canonical and MMS state separately', () => {
  let steps = createOnboardingSteps();
  steps = markOnboardingStep(steps, 'sheetsWrite', 'succeeded', 'Inserted into Students sheet at row 10.');
  steps = markOnboardingStep(steps, 'registryWrite', 'succeeded', 'Appended new registry entry.');
  steps = markOnboardingStep(steps, 'mmsActivation', 'succeeded', 'Student activated in MMS.');
  steps = markOnboardingStep(steps, 'mmsBillingProfile', 'succeeded', 'Billing profile is ready.');
  steps = markOnboardingStep(steps, 'mmsFirstLesson', 'failed', 'MMS create lesson failed.');

  const status = buildOnboardingCompletionStatus({ steps });

  assert.equal(status.canonicalRecord.status, 'complete');
  assert.equal(status.mmsOperationalState.status, 'partial');
  assert.equal(status.fcIdentityRefresh.status, 'pending');
  assert.equal(status.portalActivation.status, 'pending');
});

test('buildOnboardingCompletionStatus treats skipped idempotent MMS steps as ready', () => {
  let steps = createOnboardingSteps();
  steps = markOnboardingStep(steps, 'sheetsWrite', 'succeeded', 'Inserted into Students sheet at row 10.');
  steps = markOnboardingStep(steps, 'registryWrite', 'skipped', 'Existing registry entry retained.');
  steps = markOnboardingStep(steps, 'mmsActivation', 'skipped', 'Student was already active in MMS.');
  steps = markOnboardingStep(steps, 'mmsBillingProfile', 'skipped', 'Existing billing profile reused in MMS.');
  steps = markOnboardingStep(steps, 'mmsFirstLesson', 'skipped', 'Matching recurring lesson series already existed in MMS.');

  const status = buildOnboardingCompletionStatus({ steps });

  assert.equal(status.canonicalRecord.status, 'complete');
  assert.equal(status.mmsOperationalState.status, 'complete');
});

test('isOnboardingOperationallyComplete requires both canonical and MMS completion', () => {
  assert.equal(isOnboardingOperationallyComplete({
    canonicalRecord: { status: 'complete' },
    mmsOperationalState: { status: 'complete' },
  }), true);
  assert.equal(isOnboardingOperationallyComplete({
    canonicalRecord: { status: 'complete' },
    mmsOperationalState: { status: 'partial' },
  }), false);
  assert.equal(isOnboardingOperationallyComplete({
    canonicalRecord: { status: 'incomplete' },
    mmsOperationalState: { status: 'complete' },
  }), false);
});
