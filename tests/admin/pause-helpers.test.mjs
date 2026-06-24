import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPauseSummary, derivePauseCoverageContext, normalisePauseHistoryRow } from '../../lib/admin/pause-helpers.mjs';

test('normalisePauseHistoryRow handles Pause History field variations', () => {
  const row = normalisePauseHistoryRow({
    'Student Name': 'Owen Example',
    Email: 'parent@example.com',
    Tutor: 'Chloe',
    'Subscription ID': 'sub_123',
    'Start Date': '2026-05-01',
    'End Date': '2026-05-10',
    'Stripe Status': 'paused',
  });

  assert.equal(row.studentName, 'Owen Example');
  assert.equal(row.email, 'parent@example.com');
  assert.equal(row.subscriptionId, 'sub_123');
  assert.equal(row.stripeStatus, 'paused');
});

test('buildPauseSummary finds a current pause by subscription id', () => {
  const summary = buildPauseSummary({
    studentEmail: 'parent@example.com',
    stripeSubscriptionId: 'sub_123',
    studentName: 'Owen Example',
    currentDate: '2026-05-05',
    pauseRows: [
      {
        subscriptionId: 'sub_123',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
        stripeStatus: 'paused',
      },
    ],
  });

  assert.equal(summary.hasPauseHistory, true);
  assert.equal(summary.currentlyPaused, true);
  assert.equal(summary.upcomingPause, false);
  assert.equal(summary.latestPause.subscriptionId, 'sub_123');
  assert.equal(summary.matchConfidence, 'high');
  assert.equal(summary.matchedBy, 'subscription_id');
});

test('buildPauseSummary falls back to email and student name matching', () => {
  const summary = buildPauseSummary({
    studentEmail: 'parent@example.com',
    studentName: 'Owen Example',
    stripeSubscriptionId: '',
    pauseRows: [
      {
        studentName: 'Owen Example',
        email: 'parent@example.com',
        startDate: '2025-01-01',
        endDate: '2025-01-10',
        stripeStatus: 'paused',
      },
    ],
  });

  assert.equal(summary.hasPauseHistory, true);
  assert.equal(summary.currentlyPaused, false);
  assert.equal(summary.upcomingPause, false);
  assert.equal(summary.matchConfidence, 'medium');
  assert.equal(summary.matchedBy, 'email_and_student_name');
});

test('buildPauseSummary labels email-only matches as low confidence', () => {
  const summary = buildPauseSummary({
    studentEmail: 'family@example.com',
    studentName: 'Sibling One',
    stripeSubscriptionId: '',
    pauseRows: [
      {
        studentName: 'Sibling Two',
        email: 'family@example.com',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
        stripeStatus: 'paused',
      },
    ],
    currentDate: '2026-05-05',
  });

  assert.equal(summary.hasPauseHistory, true);
  assert.equal(summary.currentlyPaused, true);
  assert.equal(summary.matchConfidence, 'low');
  assert.equal(summary.matchedBy, 'email_only');
});

test('buildPauseSummary treats future pause windows as upcoming, not current', () => {
  const summary = buildPauseSummary({
    studentEmail: 'parent@example.com',
    stripeSubscriptionId: 'sub_123',
    currentDate: '2026-05-12',
    pauseRows: [
      {
        subscriptionId: 'sub_123',
        startDate: '2026-05-28',
        endDate: '2026-06-03',
        stripeStatus: 'scheduled',
      },
    ],
  });

  assert.equal(summary.hasPauseHistory, true);
  assert.equal(summary.currentlyPaused, false);
  assert.equal(summary.upcomingPause, true);
  assert.equal(summary.latestPause.startDate, '2026-05-28');
});

test('derivePauseCoverageContext maps pause windows onto the usual lesson slot', () => {
  const coverage = derivePauseCoverageContext({
    currentDate: '2026-07-07',
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: true,
      latestPause: {
        startDate: '2026-07-01',
        endDate: '2026-07-21',
      },
    },
    scheduleContext: {
      status: 'found',
      confidence: 'high',
      usualWeekday: 'Tuesday',
      usualTime: '18:00',
    },
  });

  assert.equal(coverage.status, 'covers_future_or_current_lesson');
  assert.equal(coverage.confidence, 'high');
  assert.equal(coverage.coveredLessonCount, 3);
  assert.deepEqual(
    coverage.coveredLessonDates.map((lesson) => lesson.date),
    ['2026-07-07', '2026-07-14', '2026-07-21'],
  );
  assert.equal(coverage.nextBillableLessonDate, '2026-07-28');
  assert.match(coverage.nextBillableLessonLabel, /Tue 28 Jul/i);
  assert.match(coverage.summary, /3 usual lessons/i);
});

test('derivePauseCoverageContext recommends returning active once covered lessons have passed', () => {
  const coverage = derivePauseCoverageContext({
    currentDate: '2026-07-22',
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: false,
      latestPause: {
        startDate: '2026-07-01',
        endDate: '2026-07-21',
      },
    },
    scheduleContext: {
      status: 'found',
      confidence: 'high',
      usualWeekday: 'Tuesday',
      usualTime: '18:00',
    },
  });

  assert.equal(coverage.status, 'covered_lessons_passed');
  assert.equal(coverage.remainingCoveredLessonCount, 0);
  assert.match(coverage.recommendation, /return to Stripe active expected/i);
});

test('derivePauseCoverageContext flags pause windows that miss the usual lesson day', () => {
  const coverage = derivePauseCoverageContext({
    currentDate: '2026-07-03',
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: true,
      latestPause: {
        startDate: '2026-07-01',
        endDate: '2026-07-03',
      },
    },
    scheduleContext: {
      status: 'found',
      confidence: 'high',
      usualWeekday: 'Tuesday',
      usualTime: '18:00',
    },
  });

  assert.equal(coverage.status, 'no_usual_lesson_covered');
  assert.equal(coverage.coveredLessonCount, 0);
  assert.match(coverage.recommendation, /Review manually/i);
});
