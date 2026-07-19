// The Lesson Cancellation Policy as executable test cases (the classifier
// spec in PLAN_proposals-inbox.md). If one of these fails after a wording
// tweak, the tweak changed policy behaviour — check the policy note first.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNeutralAcknowledgementDraft,
  buildReplyPolicyContext,
  classifyNoticeWindow,
  classifyReplyPolicyCase,
  materialiseReplyDraft,
  validateIncomingReplyDraft,
} from '../../lib/admin/incoming-reply-policy.mjs';

// --- the #1 subtlety: one-off moves never, permanent changes gladly ---------

test('"can we miss Thursday?" is a one-off absence, never a swap conversation', () => {
  const { policyCase } = classifyReplyPolicyCase({
    messageText: 'Hi, can we miss Thursday this week? Something has come up',
    suspectedCategory: 'one_off_absence',
  });
  assert.equal(policyCase, 'one_off_absence');
});

test('"change our slot going forward" is a welcomed permanent change', () => {
  const { policyCase, ambiguityFlags } = classifyReplyPolicyCase({
    messageText: 'Would it be possible to change our slot going forward? Thursdays are getting hard',
    suspectedCategory: 'schedule',
  });
  assert.equal(policyCase, 'permanent_change');
  assert.deepEqual(ambiguityFlags, []);
});

test('"move Thursdays to Wednesdays" (plural weekdays) reads as permanent', () => {
  const { policyCase } = classifyReplyPolicyCase({
    messageText: 'Could we move Thursdays to Wednesdays?',
    suspectedCategory: 'schedule',
  });
  assert.equal(policyCase, 'permanent_change');
});

test('a slot-change message with no one-off/permanent marker is ambiguous — never guessed', () => {
  const { policyCase, ambiguityFlags } = classifyReplyPolicyCase({
    messageText: 'Hi, could we change the lesson time?',
    suspectedCategory: 'schedule',
  });
  assert.equal(policyCase, 'general');
  assert.ok(ambiguityFlags.includes('one_off_vs_permanent_unclear'));
});

test('mixed one-off and permanent signals are ambiguous', () => {
  const { ambiguityFlags } = classifyReplyPolicyCase({
    messageText: 'We cant make this week — actually could we change the slot going forward too?',
    suspectedCategory: 'schedule',
  });
  assert.ok(ambiguityFlags.includes('one_off_vs_permanent_unclear'));
});

test('leaving messages route to the ending case', () => {
  const { policyCase } = classifyReplyPolicyCase({
    messageText: 'We have decided to stop lessons after this term',
    suspectedCategory: 'leaving',
  });
  assert.equal(policyCase, 'ending');
});

test('extended breaks route to the pause flow case', () => {
  const { policyCase } = classifyReplyPolicyCase({
    messageText: 'We are going away for three weeks in October',
    suspectedCategory: 'extended_absence',
  });
  assert.equal(policyCase, 'extended_break');
});

// --- notice windows ----------------------------------------------------------

test('notice windows: 7+ days, inside the week, same day, past/unknown', () => {
  assert.equal(classifyNoticeWindow({ lessonDateIso: '2026-07-27', messageDateIso: '2026-07-20' }), 'seven_plus');
  assert.equal(classifyNoticeWindow({ lessonDateIso: '2026-07-23', messageDateIso: '2026-07-20' }), 'inside_week');
  assert.equal(classifyNoticeWindow({ lessonDateIso: '2026-07-20', messageDateIso: '2026-07-20' }), 'same_day');
  assert.equal(classifyNoticeWindow({ lessonDateIso: '2026-07-19', messageDateIso: '2026-07-20' }), 'unknown');
  assert.equal(classifyNoticeWindow({ lessonDateIso: '', messageDateIso: '2026-07-20' }), 'unknown');
});

test('notice windows use the Europe/London message date around midnight', () => {
  // 23:30Z is already 00:30 the next day during BST. The lesson is therefore
  // six school dates away, not seven, and remains inside the week.
  assert.equal(classifyNoticeWindow({
    lessonDateIso: '2026-07-26',
    messageDateIso: '2026-07-19T23:30:00Z',
  }), 'inside_week');
  assert.equal(classifyNoticeWindow({
    lessonDateIso: '2026-07-27',
    messageDateIso: '2026-07-19T23:30:00Z',
  }), 'seven_plus');

  const context = buildReplyPolicyContext({
    record: {
      messageText: 'Sorry, we cannot make it on 26 July',
      suspectedCategory: 'one_off_absence',
      messageAt: '2026-07-19T23:30:00Z',
    },
  });
  assert.equal(context.messageDateIso, '2026-07-20');
  assert.equal(context.noticeWindow, 'inside_week');
});

function oneOffContext({ messageText, messageAt, scheduleContext = null }) {
  return buildReplyPolicyContext({
    record: { messageText, suspectedCategory: 'one_off_absence', messageAt },
    scheduleContext,
  });
}

test('7+ days notice grants free cancellation and Zoom, never a charge', () => {
  const context = oneOffContext({
    messageText: 'Freya cant come on 30 July, sorry',
    messageAt: '2026-07-20T09:00:00Z',
  });
  assert.equal(context.noticeWindow, 'seven_plus');
  assert.deepEqual(context.allowedFacts.map((fact) => fact.id), ['no_charge_cancel', 'zoom_at_slot']);
  assert.equal(context.neutralFallback, false);
});

test('inside the week grants charged + Zoom + practice video', () => {
  const context = oneOffContext({
    messageText: 'Sorry, we cannot make it on 23 July',
    messageAt: '2026-07-20T09:00:00Z',
  });
  assert.equal(context.noticeWindow, 'inside_week');
  assert.deepEqual(context.allowedFacts.map((fact) => fact.id), ['charged_inside_week', 'zoom_at_slot', 'practice_video']);
});

test('same-day cancellation grants only the charged fact — no video, no Zoom', () => {
  const context = oneOffContext({
    messageText: 'So sorry, Max is off sick today and will miss the lesson on 20 July',
    messageAt: '2026-07-20T08:00:00Z',
  });
  assert.equal(context.noticeWindow, 'same_day');
  assert.deepEqual(context.allowedFacts.map((fact) => fact.id), ['charged_same_day']);
});

test('no date in the message falls back to Schedule_Context for the lesson date', () => {
  const context = oneOffContext({
    messageText: 'Hi, Anna is ill and cant make her lesson, sorry',
    messageAt: '2026-07-20T09:00:00Z',
    scheduleContext: { status: 'found', nextLessonAt: '2026-07-22T16:00' },
  });
  assert.equal(context.lessonDateSource, 'schedule_context');
  assert.equal(context.noticeWindow, 'inside_week');
});

test('the ambiguity rule: no lesson date from anywhere means neutral fallback', () => {
  const context = oneOffContext({
    messageText: 'Hi, Anna is ill and cant make her lesson, sorry',
    messageAt: '2026-07-20T09:00:00Z',
  });
  assert.ok(context.ambiguityFlags.includes('lesson_date_unknown'));
  assert.equal(context.neutralFallback, true);
  assert.deepEqual(context.allowedFacts, []);
});

// --- deterministic draft validation -------------------------------------------

const INSIDE_WEEK_CONTEXT = oneOffContext({
  messageText: 'Sorry, we cannot make it on 23 July',
  messageAt: '2026-07-20T09:00:00Z',
});
const SEVEN_PLUS_CONTEXT = oneOffContext({
  messageText: 'Freya cant come on 30 July, sorry',
  messageAt: '2026-07-20T09:00:00Z',
});
const SAME_DAY_CONTEXT = oneOffContext({
  messageText: 'Max will miss the lesson on 20 July, so sorry',
  messageAt: '2026-07-20T08:00:00Z',
});

test('a draft offering a one-off swap or make-up is rejected in every window', () => {
  for (const context of [INSIDE_WEEK_CONTEXT, SEVEN_PLUS_CONTEXT, SAME_DAY_CONTEXT]) {
    const swap = validateIncomingReplyDraft('Hi [PARENT_FIRST], no problem — we can swap to Friday just this once.', context);
    assert.equal(swap.valid, false);
    assert.ok(swap.errors.includes('one_off_reschedule_offered'));
  }
  const move = validateIncomingReplyDraft('Hi [PARENT_FIRST], we can move the lesson to next Tuesday.', INSIDE_WEEK_CONTEXT);
  assert.equal(move.valid, false);
  assert.ok(move.errors.includes('one_off_reschedule_offered'));

  const fridayInstead = validateIncomingReplyDraft(
    'Hi [PARENT_FIRST], we can do Friday instead for [STUDENT_FIRST].',
    INSIDE_WEEK_CONTEXT,
  );
  assert.ok(fridayInstead.errors.includes('one_off_reschedule_offered'));

  const anotherTime = validateIncomingReplyDraft(
    'Hi [PARENT_FIRST], we can fit [STUDENT_FIRST] in at another time.',
    INSIDE_WEEK_CONTEXT,
  );
  assert.ok(anotherTime.errors.includes('one_off_reschedule_offered'));
});

test('a no-charge claim inside the week contradicts the notice window', () => {
  const result = validateIncomingReplyDraft(
    'Hi [PARENT_FIRST], no problem — you won’t be charged for Thursday.',
    INSIDE_WEEK_CONTEXT,
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('no_charge_claim_contradicts_notice_window'));
});

test('a charged claim with 7+ days notice contradicts the notice window', () => {
  const result = validateIncomingReplyDraft(
    'Hi [PARENT_FIRST], that lesson will be charged as normal.',
    SEVEN_PLUS_CONTEXT,
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('charge_claim_contradicts_notice_window'));
});

test('a video promise on a same-day cancellation is rejected', () => {
  const result = validateIncomingReplyDraft(
    'Hi [PARENT_FIRST], sorry to hear it — we’ll send a practice video instead.',
    SAME_DAY_CONTEXT,
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('video_promise_on_same_day'));
});

test('a compliant inside-week draft passes: charged, Zoom or video offered warmly', () => {
  const result = validateIncomingReplyDraft(
    'Hi [PARENT_FIRST], thanks for letting us know. As it’s inside the week the lesson is still charged, but [STUDENT_FIRST] can have a Zoom lesson at the usual time, or a practice video with notes for next lesson — whichever suits. 🙂',
    INSIDE_WEEK_CONTEXT,
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test('a compliant 7+ days draft passes: cancelled without charge, Zoom offered', () => {
  const result = validateIncomingReplyDraft(
    'Hi [PARENT_FIRST], thanks for the heads up — with over a week’s notice that lesson is simply not charged. If [STUDENT_FIRST] would rather keep it, a Zoom lesson at the usual time works too.',
    SEVEN_PLUS_CONTEXT,
  );
  assert.deepEqual(result.errors, []);
});

test('drafts must open Hi/Hello/Hey — never Heya', () => {
  const heya = validateIncomingReplyDraft('Heya [PARENT_FIRST], thanks for letting us know.', INSIDE_WEEK_CONTEXT);
  assert.ok(heya.errors.includes('opening_must_be_hi_hello_hey'));
  const noGreeting = validateIncomingReplyDraft('Thanks for letting us know, no problem.', INSIDE_WEEK_CONTEXT);
  assert.ok(noGreeting.errors.includes('opening_must_be_hi_hello_hey'));
});

test('identifiers, phones and completed-action claims are rejected', () => {
  assert.ok(validateIncomingReplyDraft('Hi there, email us at office@firstchord.co.uk', INSIDE_WEEK_CONTEXT).errors.includes('email_not_allowed'));
  assert.ok(validateIncomingReplyDraft('Hi there, call 07700 900123 anytime', INSIDE_WEEK_CONTEXT).errors.includes('phone_not_allowed'));
  assert.ok(validateIncomingReplyDraft('Hi there, we have already cancelled the payment.', INSIDE_WEEK_CONTEXT).errors.includes('completed_action_claim_not_allowed'));
});

test('the neutral fallback draft passes its own validation and commits to nothing', () => {
  const context = oneOffContext({
    messageText: 'Hi, Anna cant make her lesson, sorry',
    messageAt: '2026-07-20T09:00:00Z',
  });
  assert.equal(context.neutralFallback, true);
  const draft = buildNeutralAcknowledgementDraft();
  const result = validateIncomingReplyDraft(draft, context);
  assert.deepEqual(result.errors, []);

  const committed = validateIncomingReplyDraft('Hi [PARENT_FIRST], no problem, that lesson is cancelled.', context);
  assert.ok(committed.errors.includes('policy_outcome_in_neutral_draft'));
});

test('materialising placeholders substitutes first names with warm fallbacks', () => {
  assert.equal(
    materialiseReplyDraft('Hi [PARENT_FIRST], [STUDENT_FIRST] is welcome to Zoom.', { parentName: 'Sarah Brown', studentName: 'Freya Brown' }),
    'Hi Sarah, Freya is welcome to Zoom.',
  );
  assert.equal(
    materialiseReplyDraft('Hi [PARENT_FIRST], [STUDENT_FIRST] is welcome.', {}),
    'Hi there, your child is welcome.',
  );
});
