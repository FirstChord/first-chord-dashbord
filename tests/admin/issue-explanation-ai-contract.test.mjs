import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IssueAiBriefingError,
  buildIssueAiBriefingInput,
  validateIssueAiBriefing,
} from '../../lib/admin/issue-explanation-ai-contract.mjs';
import {
  generateIssueAiBriefing,
  isIssueAiBriefingConfigured,
} from '../../lib/admin/issue-explanation-ai-provider.mjs';

function explanation(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'issue_explanation',
    generatedAt: '2026-07-15T10:30:00.000Z',
    status: { code: 'recorded_not_rechecked', label: 'Recorded — not rechecked', detail: 'The detector was not rerun.' },
    rule: {
      name: 'Live subscription check',
      statement: 'Show this issue when active billing is expected but the recorded subscription ended.',
      result: 'The last scan found a cancelled subscription.',
    },
    source: { code: 'stripe_live', label: 'Recorded live Stripe scan result', detectorRechecked: false },
    queue: { label: 'Open', sourcePresent: true },
    evidence: [
      { label: 'Payment expectation', value: 'Stripe Active Expected', sourceRole: 'Current deterministic context' },
      { label: 'Subscription status at recorded scan', value: 'Cancelled', sourceRole: 'Recorded Stripe evidence' },
    ],
    ambiguity: [{ code: 'stripe_live_not_refreshed', explanation: 'The live Stripe facts may have changed.' }],
    notChecked: ['Stripe was not refreshed.'],
    nextStep: { actionCode: 'review_payment_state', label: 'Refresh Stripe, then review the current payment state.', approvalRequired: true },
    ...overrides,
  };
}

function validBriefing(overrides = {}) {
  return {
    headline: 'Billing status needs a fresh check',
    explanation: 'The last recorded scan found a cancelled subscription while active billing was expected.',
    whatToCheck: 'Refresh Stripe and compare the current subscription with the recorded expectation.',
    caveat: 'Stripe was not refreshed for this explanation, so the provider state may have changed.',
    evidenceRefs: ['evidence_1', 'evidence_2'],
    ...overrides,
  };
}

test('builds a bounded model input from only the deterministic explanation', () => {
  const input = buildIssueAiBriefingInput(explanation());

  assert.equal(input.context.kind, 'issue_briefing_input');
  assert.deepEqual(input.allowedEvidenceRefs, ['evidence_1', 'evidence_2']);
  assert.equal(input.requiredCaveat, true);
  assert.equal(input.context.evidence[1].id, 'evidence_2');
  assert.doesNotMatch(JSON.stringify(input.context), /generatedAt|mmsId|customerId/iu);
});

test('refuses direct identifiers before any provider call', () => {
  assert.throws(
    () => buildIssueAiBriefingInput(explanation({
      rule: { name: 'Unsafe', statement: 'Check the account.', result: 'Email parent@example.com.' },
    })),
    (error) => error instanceof IssueAiBriefingError && error.code === 'unsafe_input',
  );
});

test('accepts only grounded, bounded output with required uncertainty', () => {
  const input = buildIssueAiBriefingInput(explanation());
  const result = validateIssueAiBriefing(validBriefing(), input);

  assert.equal(result.valid, true);
  assert.deepEqual(result.briefing.evidenceRefs, ['evidence_1', 'evidence_2']);

  assert.ok(validateIssueAiBriefing(validBriefing({ caveat: '' }), input).errors.includes('caveat_required'));
  assert.ok(validateIssueAiBriefing(validBriefing({ evidenceRefs: ['evidence_99'] }), input).errors.includes('unknown_evidence_ref:evidence_99'));
  assert.ok(validateIssueAiBriefing({ ...validBriefing(), extra: 'not allowed' }, input).errors.includes('output_shape_invalid'));
  assert.ok(validateIssueAiBriefing(validBriefing({ headline: 123 }), input).errors.includes('headline_invalid'));
  assert.ok(validateIssueAiBriefing(validBriefing({ evidenceRefs: [{ id: 'evidence_1' }] }), input).errors.includes('evidence_refs_invalid'));
});

test('rejects identifier leakage and claims that consequential work was completed', () => {
  const input = buildIssueAiBriefingInput(explanation());
  assert.ok(validateIssueAiBriefing(validBriefing({ explanation: 'Contact parent@example.com.' }), input).errors.includes('direct_identifier_not_allowed'));
  assert.ok(validateIssueAiBriefing(validBriefing({ explanation: 'We have cancelled the subscription.' }), input).errors.includes('completed_action_claim_not_allowed'));
});

test('provider uses a separate server-only key, store false and structured output', async () => {
  const env = {
    ADMIN_AI_ISSUE_BRIEFING_ENABLED: 'true',
    ADMIN_AI_OPENAI_API_KEY: 'test-server-key',
    ADMIN_AI_OPENAI_MODEL: 'gpt-test',
  };
  let captured;
  const result = await generateIssueAiBriefing(explanation(), {
    env,
    requestId: '00000000-0000-4000-8000-000000000001',
    nowImpl: () => 100,
    fetchImpl: async (url, init) => {
      captured = { url, init, body: JSON.parse(init.body) };
      return {
        ok: true,
        async json() {
          return { output_text: JSON.stringify(validBriefing()), usage: { input_tokens: 80, output_tokens: 40, total_tokens: 120 } };
        },
      };
    },
  });

  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  assert.equal(captured.init.headers.Authorization, 'Bearer test-server-key');
  assert.equal(captured.body.store, false);
  assert.equal(captured.body.model, 'gpt-test');
  assert.equal(captured.body.text.format.type, 'json_schema');
  assert.equal(Object.hasOwn(captured.body, 'tools'), false);
  assert.equal(result.briefing.headline, validBriefing().headline);
  assert.deepEqual(result.usage, { inputTokens: 80, outputTokens: 40, totalTokens: 120 });
});

test('provider remains disabled unless both the dedicated flag and key exist', async () => {
  assert.equal(isIssueAiBriefingConfigured({ ADMIN_AI_OPENAI_API_KEY: 'key' }), false);
  assert.equal(isIssueAiBriefingConfigured({ ADMIN_AI_ISSUE_BRIEFING_ENABLED: 'true' }), false);

  await assert.rejects(
    generateIssueAiBriefing(explanation(), { env: {}, fetchImpl: async () => assert.fail('must not call provider') }),
    (error) => error instanceof IssueAiBriefingError && error.code === 'not_configured',
  );
});
