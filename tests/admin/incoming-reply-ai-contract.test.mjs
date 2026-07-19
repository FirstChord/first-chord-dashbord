// Boundary tests for the incoming-reply model contract: redaction before the
// provider, refusal of ambiguous/unsafe input, fail-closed output validation,
// and a fake-fetch provider round trip (no API credit is spent here).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIncomingReplyAiInput,
  redactIncomingMessageText,
  validateIncomingReplyAiOutput,
} from '../../lib/admin/incoming-reply-ai-contract.mjs';
import { generateIncomingReplyDraft } from '../../lib/admin/incoming-reply-ai-provider.mjs';
import { buildReplyPolicyContext } from '../../lib/admin/incoming-reply-policy.mjs';

function insideWeekContext() {
  return buildReplyPolicyContext({
    record: {
      messageText: 'Sorry, we cannot make it on 23 July',
      suspectedCategory: 'one_off_absence',
      messageAt: '2026-07-20T09:00:00Z',
    },
  });
}

function ambiguousContext() {
  return buildReplyPolicyContext({
    record: {
      messageText: 'Hi, could we change the lesson time?',
      suspectedCategory: 'schedule',
      messageAt: '2026-07-20T09:00:00Z',
    },
  });
}

// --- redaction ----------------------------------------------------------------

test('redaction replaces known names with placeholders and strips contact details', () => {
  const redacted = redactIncomingMessageText(
    'Hi, Freya Brown cannot make Thursday. Call me on 07700 900123 or sarah@example.com — Sarah',
    { studentNames: ['Freya Brown'], parentNames: ['Sarah Brown', 'Sarah'] },
  );
  assert.ok(!redacted.includes('Freya'));
  assert.ok(!redacted.includes('Sarah'));
  assert.ok(!redacted.includes('07700'));
  assert.ok(!redacted.includes('example.com'));
  assert.ok(redacted.includes('[STUDENT_FIRST]'));
  assert.ok(redacted.includes('[PARENT_FIRST]'));
});

test('redaction bounds the message length', () => {
  const redacted = redactIncomingMessageText('word '.repeat(500), {});
  assert.ok(redacted.length <= 600);
});

// --- input projection -----------------------------------------------------------

test('ambiguous contexts are refused — the neutral draft never involves the model', () => {
  assert.throws(
    () => buildIncomingReplyAiInput(ambiguousContext(), { redactedMessage: 'anything' }),
    /neutral/i,
  );
});

test('a surviving identifier in the redacted message is refused', () => {
  assert.throws(
    () => buildIncomingReplyAiInput(insideWeekContext(), { redactedMessage: 'reach me at sarah@example.com' }),
    /identifier/i,
  );
});

test('the projected input carries only the policy context and redacted message', () => {
  const input = buildIncomingReplyAiInput(insideWeekContext(), { redactedMessage: '[STUDENT_FIRST] cannot make 23 July' });
  assert.deepEqual(Object.keys(input.context).sort(), ['allowedFacts', 'kind', 'lessonDateIso', 'message', 'noticeWindow', 'policyCase', 'schemaVersion']);
  assert.deepEqual(input.allowedFactIds, ['charged_inside_week', 'zoom_at_slot', 'practice_video']);
});

// --- output validation -----------------------------------------------------------

test('valid output passes; policy-violating drafts and unknown fact ids fail closed', () => {
  const policyContext = insideWeekContext();
  const allowedFactIds = ['charged_inside_week', 'zoom_at_slot', 'practice_video'];

  const good = validateIncomingReplyAiOutput({
    draft: 'Hi [PARENT_FIRST], thanks for letting us know — the lesson is still charged inside the week, but [STUDENT_FIRST] can Zoom at the usual time or have a practice video.',
    usedFactIds: ['charged_inside_week', 'zoom_at_slot'],
  }, { policyContext, allowedFactIds });
  assert.equal(good.valid, true);

  const swap = validateIncomingReplyAiOutput({
    draft: 'Hi [PARENT_FIRST], we can swap to Friday just this once.',
    usedFactIds: ['zoom_at_slot'],
  }, { policyContext, allowedFactIds });
  assert.equal(swap.valid, false);
  assert.ok(swap.errors.includes('one_off_reschedule_offered'));

  const unknownFact = validateIncomingReplyAiOutput({
    draft: 'Hi [PARENT_FIRST], the lesson is still charged this week.',
    usedFactIds: ['made_up_fact'],
  }, { policyContext, allowedFactIds });
  assert.equal(unknownFact.valid, false);
  assert.ok(unknownFact.errors.includes('unknown_fact_id:made_up_fact'));

  const wrongShape = validateIncomingReplyAiOutput({
    draft: 'Hi [PARENT_FIRST], all good.',
    usedFactIds: [],
    extra: true,
  }, { policyContext, allowedFactIds });
  assert.ok(wrongShape.errors.includes('output_shape_invalid'));
});

// --- provider (fake fetch, no credit) ---------------------------------------------

const FAKE_ENV = {
  ADMIN_AI_REPLY_DRAFT_ENABLED: 'true',
  ADMIN_AI_OPENAI_API_KEY: 'sk-test-not-real',
};

function fakeFetch(outputObject, { ok = true } = {}) {
  return async () => ({
    ok,
    json: async () => ({
      output_text: JSON.stringify(outputObject),
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    }),
  });
}

test('provider returns a validated draft on a compliant response', async () => {
  const result = await generateIncomingReplyDraft(insideWeekContext(), {
    redactedMessage: '[STUDENT_FIRST] cannot make 23 July',
    env: FAKE_ENV,
    fetchImpl: fakeFetch({
      draft: 'Hi [PARENT_FIRST], thanks for letting us know — inside the week the lesson is still charged, but a Zoom lesson at the usual time or a practice video both work.',
      usedFactIds: ['charged_inside_week', 'zoom_at_slot', 'practice_video'],
    }),
  });
  assert.ok(result.draft.startsWith('Hi [PARENT_FIRST]'));
  assert.equal(result.usage.totalTokens, 150);
});

test('provider fails closed when the model output violates the policy', async () => {
  await assert.rejects(
    generateIncomingReplyDraft(insideWeekContext(), {
      redactedMessage: '[STUDENT_FIRST] cannot make 23 July',
      env: FAKE_ENV,
      fetchImpl: fakeFetch({
        draft: 'Hi [PARENT_FIRST], no problem — we can just swap to Friday and you won’t be charged.',
        usedFactIds: ['zoom_at_slot'],
      }),
    }),
    (error) => {
      assert.equal(error.code, 'invalid_draft');
      assert.ok(error.details.includes('one_off_reschedule_offered'));
      assert.ok(error.details.includes('no_charge_claim_contradicts_notice_window'));
      return true;
    },
  );
});

test('provider refuses to run unconfigured', async () => {
  await assert.rejects(
    generateIncomingReplyDraft(insideWeekContext(), {
      redactedMessage: 'x',
      env: {},
      fetchImpl: async () => { throw new Error('must not be called'); },
    }),
    (error) => error.code === 'not_configured',
  );
});
