import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createAssistantContextService } from '../../lib/admin/assistant-context-service.mjs';

const GENERATED_AT = '2026-07-14T12:00:00.000Z';

function dependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    values: {
      getStudents: async () => {
        calls.push('students');
        return [{
          mms_id: 'sdt_SELECTED',
          'Student forename': 'PrivateFirst',
          'Student Surname': 'PrivateLast',
          Email: 'private@example.com',
          'Contact Number': '07123 456789',
          Instrument: 'Piano',
          'Lesson length': '30',
          Tutor: 'PrivateTutor',
          payment_mode: 'stripe',
          payment_expectation: 'stripe_active_expected',
          stripe_customer_id: '',
          stripe_subscription_id: '',
        }, {
          mms_id: 'sdt_TEST',
          'Student forename': 'Test',
          'Student Surname': 'Student',
          is_test_student: 'true',
        }];
      },
      getRegistry: async () => {
        calls.push('registry');
        return [{ mmsId: 'sdt_SELECTED', firstName: 'PrivateFirst', soundsliceUrl: 'https://private.example' }];
      },
      getFlags: async () => {
        calls.push('flags');
        return [];
      },
      getPauses: async () => {
        calls.push('pauses');
        return [];
      },
      getWaiting: async () => {
        calls.push('waiting');
        return { available: true, rows: [{ mmsId: 'sdt_SELECTED', status: 'contacted', updatedAt: '2026-07-13' }] };
      },
      getSchedule: async () => {
        calls.push('schedule');
        return { available: true, rows: [{ mmsId: 'sdt_SELECTED', status: 'found', usualWeekday: 'Monday', usualTime: '16:00', teacherName: 'PrivateTutor' }] };
      },
      getQueue: async () => {
        calls.push('queue');
        return { available: true, rows: [] };
      },
      ...overrides,
    },
  };
}

test('student context reads only required bounded sources and returns a redacted projection', async () => {
  const injected = dependencies();
  const service = createAssistantContextService(injected.values);
  const result = await service.getStudentContext({ mmsId: 'sdt_SELECTED', generatedAt: GENERATED_AT });

  assert.equal(result.found, true);
  assert.deepEqual([...injected.calls].sort(), ['flags', 'pauses', 'registry', 'schedule', 'students', 'waiting']);
  assert.equal(result.context.profile.instrument, 'Piano');
  assert.equal(result.context.payment.customerLinkRecorded, false);
  assert.deepEqual(result.availability.issueQueue, { available: false, reason: 'not_requested' });
  assert.doesNotMatch(JSON.stringify(result), /PrivateFirst|PrivateLast|PrivateTutor|private@example|07123|sdt_SELECTED|private\.example/i);
});

test('static payment issue is re-evaluated and queue state is comparison evidence only', async () => {
  const injected = dependencies({
    getQueue: async () => ({
      available: true,
      rows: [{
        mmsId: 'sdt_SELECTED', source: 'payment_static', issueType: 'STRIPE SETUP INCOMPLETE',
        status: 'acknowledged', sourcePresent: true,
      }],
    }),
  });
  const service = createAssistantContextService(injected.values);
  const result = await service.getIssueContext({
    mmsId: 'sdt_SELECTED',
    source: 'payment_static',
    issueType: 'STRIPE SETUP INCOMPLETE',
    generatedAt: GENERATED_AT,
  });

  assert.equal(result.found, true);
  assert.equal(result.context.detector.evaluated, true);
  assert.equal(result.context.detector.currentPresent, true);
  assert.equal(result.context.queue.status, 'acknowledged');
  assert.equal(result.context.issue.actionCode, 'review_payment_state');
});

test('live Stripe context never claims it was refreshed', async () => {
  const injected = dependencies({
    getQueue: async () => ({ available: true, rows: [{
      mmsId: 'sdt_SELECTED', source: 'stripe_live', issueType: 'PAYMENT FAILED', status: 'open', sourcePresent: true,
    }] }),
  });
  const service = createAssistantContextService(injected.values);
  const result = await service.getIssueContext({
    mmsId: 'sdt_SELECTED', source: 'stripe_live', issueType: 'PAYMENT FAILED', generatedAt: GENERATED_AT,
  });

  assert.equal(result.context.detector.evaluated, false);
  assert.equal(result.context.detector.currentPresent, null);
  assert.ok(result.context.ambiguityCodes.includes('stripe_live_not_refreshed'));
});

test('test students and malformed identifiers are not retrievable', async () => {
  const injected = dependencies();
  const service = createAssistantContextService(injected.values);
  const testResult = await service.getStudentContext({ mmsId: 'sdt_TEST', generatedAt: GENERATED_AT });
  assert.equal(testResult.found, false);
  assert.equal(testResult.context, null);
  await assert.rejects(() => service.getStudentContext({ mmsId: '../secrets' }), /valid exact MMS/);
  await assert.rejects(() => service.getIssueContext({
    mmsId: 'sdt_SELECTED', source: 'shell', issueType: 'DO THING',
  }), /not allowlisted/);
});

test('service source has no mutation, broad issue scan, shell, or live-provider dependency', async () => {
  const source = await readFile(new URL('../../lib/admin/assistant-context-service.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /getAdminIssues|scanLiveStripeIssues|getLiveStripeSnapshot|ensureManagedSheet|upsert[A-Z]|append[A-Z]|update[A-Z]|send[A-Z]|child_process|exec\(/u);
  assert.doesNotMatch(source, /app\/api|\/api\/mms|stripe\.js|practice-notes-email/u);
});
