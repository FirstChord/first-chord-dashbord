import test from 'node:test';
import assert from 'node:assert/strict';

import {
  firstName,
  labelFor,
  statusAfterEdit,
  buildStatusPatch,
  buildEmptyDetails,
  hasSavedWorkflowState,
  hasUnderstandingAssessment,
  hasWorkflowActivity,
  getRecordRiskSignals,
  matchesQueueSearch,
  deriveNextActions,
} from '../../lib/admin/parent-understanding-client-helpers.mjs';

const record = (details = {}, overrides = {}) => ({
  student: { studentName: 'Ada Smith', parentName: 'Rachel Smith', tutor: 'Kenny', mmsId: 'sdt_1' },
  state: { workflowStatus: 'not_started', details, ...overrides },
});

test('firstName / labelFor basics', () => {
  assert.equal(firstName('Rachel Smith'), 'Rachel');
  assert.equal(firstName(''), 'there');
  assert.equal(labelFor([{ value: 'a', label: 'Alpha' }], 'a'), 'Alpha');
  assert.equal(labelFor([], 'x'), 'x');
});

test('statusAfterEdit keeps terminal statuses, else moves to in_progress', () => {
  assert.equal(statusAfterEdit('completed'), 'completed');
  assert.equal(statusAfterEdit('needs_follow_up'), 'needs_follow_up');
  assert.equal(statusAfterEdit('not_started'), 'in_progress');
});

test('buildStatusPatch maps next status to workflow + loop status', () => {
  assert.deepEqual(buildStatusPatch('completed'), { workflowStatus: 'completed', loopStatus: 'closed' });
  assert.deepEqual(buildStatusPatch('needs_follow_up'), { workflowStatus: 'needs_follow_up', loopStatus: 'open_admin_follow_up_needed' });
  assert.deepEqual(buildStatusPatch('whatever'), { workflowStatus: 'in_progress', loopStatus: 'partially_closed' });
});

test('buildEmptyDetails returns the full shape and merges provided values', () => {
  const out = buildEmptyDetails({ understanding: { cancellations: { understands: 'yes' } }, adminFollowUpNote: 'call back' });
  assert.equal(out.understanding.cancellations.understands, 'yes');
  assert.equal(out.understanding.showcases.understands, ''); // default filled
  assert.equal(out.feedback.practiceAtHome, 'unknown');
  assert.equal(out.communication.communityGroupStatus, 'unknown');
  assert.equal(out.adminFollowUpNote, 'call back');
});

test('workflow-activity / assessment detection', () => {
  assert.equal(hasSavedWorkflowState(record({}, { updatedAt: '2026-07-01' })), true);
  assert.equal(hasSavedWorkflowState(record({})), false);
  assert.equal(hasUnderstandingAssessment(record({ understanding: { cancellations: { understands: 'yes' } } })), true);
  assert.equal(hasUnderstandingAssessment(record({})), false);
  assert.equal(hasWorkflowActivity(record({ adminFollowUpNote: 'note' })), true);
  assert.equal(hasWorkflowActivity(record({})), false);
});

test('getRecordRiskSignals: flags missing assessment only when there is other activity', () => {
  // activity (a note) but no understanding assessment → flag the missing checklist
  assert.deepEqual(getRecordRiskSignals(record({ adminFollowUpNote: 'chase' })), ['Understanding checklist not assessed']);
  // nothing at all → no signals
  assert.deepEqual(getRecordRiskSignals(record({})), []);
});

test('matchesQueueSearch matches name/parent/tutor/mmsId, empty query → all', () => {
  assert.equal(matchesQueueSearch(record({}), ''), true);
  assert.equal(matchesQueueSearch(record({}), 'rachel'), true);
  assert.equal(matchesQueueSearch(record({}), 'kenny'), true);
  assert.equal(matchesQueueSearch(record({}), 'zzz'), false);
});

test('deriveNextActions suggests follow-ups from partial understanding, else a default', () => {
  const actions = deriveNextActions(record({ understanding: { cancellations: { understands: 'partial' } } }));
  assert.ok(actions.some((a) => /cancellation\/holiday policy/.test(a)));
  assert.deepEqual(deriveNextActions(record({})), ['No obvious follow-up from the current answers.']);
});
