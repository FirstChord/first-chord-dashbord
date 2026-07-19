import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROPOSAL_TTL_DAYS,
  applyProposalDecision,
  buildProposalRecord,
  deriveEffectiveProposalStatus,
  hashProposalSourceText,
  selectOpenProposalForLinkedId,
  summariseProposalTelemetry,
} from '../../lib/admin/proposal-helpers.mjs';

function makeProposal(overrides = {}) {
  return buildProposalRecord({
    proposalId: 'prop_test',
    lane: 'incoming_reply',
    createdBy: 'model:test',
    linkedId: 'incoming_abc',
    mmsId: 'sdt_x',
    evidence: { sourceTextHash: hashProposalSourceText('original message') },
    proposalBody: 'Hi Sarah, thanks for letting us know.',
    now: new Date('2026-07-19T10:00:00Z'),
    ...overrides,
  });
}

test('buildProposalRecord starts proposed with the evidence serialised', () => {
  const record = makeProposal();
  assert.equal(record.status, 'proposed');
  assert.equal(record.appliedBody, '');
  assert.ok(JSON.parse(record.evidenceJson).sourceTextHash);
});

test('an open proposal expires after the TTL', () => {
  const record = makeProposal();
  const justInside = new Date(new Date(record.createdAt).getTime() + (PROPOSAL_TTL_DAYS * 24 - 1) * 60 * 60 * 1000);
  const justPast = new Date(new Date(record.createdAt).getTime() + (PROPOSAL_TTL_DAYS * 24 + 1) * 60 * 60 * 1000);
  assert.equal(deriveEffectiveProposalStatus(record, { sourceText: 'original message', now: justInside }), 'proposed');
  assert.equal(deriveEffectiveProposalStatus(record, { sourceText: 'original message', now: justPast }), 'expired');
});

test('an open proposal is superseded when the underlying message text changes', () => {
  const record = makeProposal();
  const now = new Date('2026-07-19T12:00:00Z');
  assert.equal(deriveEffectiveProposalStatus(record, { sourceText: 'original message', now }), 'proposed');
  assert.equal(deriveEffectiveProposalStatus(record, { sourceText: 'edited message', now }), 'superseded');
});

test('decided statuses are never re-derived', () => {
  const record = { ...makeProposal(), status: 'approved' };
  assert.equal(deriveEffectiveProposalStatus(record, { sourceText: 'edited message', now: new Date('2027-01-01') }), 'approved');
});

test('selectOpenProposalForLinkedId returns the newest open proposal only', () => {
  const older = { ...makeProposal(), proposalId: 'prop_old', createdAt: '2026-07-18T10:00:00.000Z' };
  const newer = { ...makeProposal(), proposalId: 'prop_new', createdAt: '2026-07-19T10:00:00.000Z' };
  const rejected = { ...makeProposal(), proposalId: 'prop_rej', status: 'rejected' };
  const now = new Date('2026-07-19T12:00:00Z');
  const picked = selectOpenProposalForLinkedId([rejected, older, newer], 'incoming_abc', { sourceText: 'original message', now });
  assert.equal(picked.proposalId, 'prop_new');
  assert.equal(selectOpenProposalForLinkedId([rejected], 'incoming_abc', { now }), null);
});

test('decisions: use keeps the body, edit replaces it, discard records the reason', () => {
  const now = new Date('2026-07-19T11:00:00Z');
  const used = applyProposalDecision(makeProposal(), { decision: 'use', actorEmail: 'finn@x', now });
  assert.equal(used.status, 'approved');
  assert.equal(used.appliedBody, used.proposalBody);
  assert.equal(used.appliedAt, now.toISOString());

  const edited = applyProposalDecision(makeProposal(), { decision: 'edit', finalBody: 'Hi Sarah — all sorted differently.', actorEmail: 'finn@x', now });
  assert.equal(edited.status, 'approved');
  assert.notEqual(edited.appliedBody, edited.proposalBody);

  const discarded = applyProposalDecision(makeProposal(), { decision: 'discard', rejectionReason: 'wrong tone', actorEmail: 'finn@x', now });
  assert.equal(discarded.status, 'rejected');
  assert.equal(discarded.rejectionReason, 'wrong tone');
  assert.equal(discarded.appliedBody, '');
});

test('deciding a non-open proposal throws', () => {
  const decided = { ...makeProposal(), status: 'approved' };
  assert.throws(() => applyProposalDecision(decided, { decision: 'use' }));
});

test('telemetry separates used-unmodified, edited and discarded', () => {
  const now = new Date('2026-07-19T11:00:00Z');
  const rows = [
    applyProposalDecision(makeProposal(), { decision: 'use', now }),
    applyProposalDecision(makeProposal(), { decision: 'use', now }),
    applyProposalDecision(makeProposal(), { decision: 'edit', finalBody: 'Hi Sarah, changed.', now }),
    applyProposalDecision(makeProposal(), { decision: 'discard', now }),
    makeProposal(),
  ];
  const summary = summariseProposalTelemetry(rows);
  assert.equal(summary.usedUnmodified, 2);
  assert.equal(summary.edited, 1);
  assert.equal(summary.discarded, 1);
  assert.equal(summary.proposed, 1);
  assert.equal(summary.usedUnmodifiedRate, 0.5);
});
