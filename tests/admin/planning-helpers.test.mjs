import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPlanningProgress,
  buildFirstLessonCheckinPlanningId,
  buildFirstLessonCheckinPlanningItem,
  buildSchoolForwardReflections,
  buildSchoolForwardPlanningItem,
  buildPauseLessonDateSuggestions,
  calculateFirstLessonCheckinDate,
  calculateFridayReviewDate,
  calculateNextMeetingDate,
  buildPlanningDueSummary,
  buildPlanningSummary,
  buildStructuredPausePlanningDraft,
  derivePlanningMomentum,
  inferPlanningTargetDateFromText,
  isMeetingPlanningItem,
  normalisePlanningArea,
  normalisePlanningItemType,
  normalisePlanningOwner,
  normalisePlanningStatus,
} from '../../lib/admin/planning-helpers.mjs';

const NOW = new Date('2026-06-03T12:00:00.000Z');

test('normalises planning defaults conservatively', () => {
  assert.equal(normalisePlanningItemType('Initiative'), 'initiative');
  assert.equal(normalisePlanningItemType('bad'), 'idea');
  assert.equal(normalisePlanningStatus('WAITING'), 'waiting');
  assert.equal(normalisePlanningStatus('unknown'), 'inbox');
  assert.equal(normalisePlanningArea('Finance'), 'finance');
  assert.equal(normalisePlanningArea('random'), 'other');
  assert.equal(normalisePlanningOwner('Tom'), 'Tom');
  assert.equal(normalisePlanningOwner('Fenella'), 'Unassigned');
});

test('calculates Friday review and next meeting dates', () => {
  assert.equal(calculateFridayReviewDate(new Date('2026-06-12T10:00:00.000Z')), '2026-06-12');
  assert.equal(calculateFridayReviewDate(new Date('2026-06-12T10:00:00.000Z'), { skipToday: true }), '2026-06-19');
  assert.equal(calculateNextMeetingDate(new Date('2026-06-13T10:00:00.000Z')), '2026-06-15');
});

test('first-lesson check-in lands on the first Mon/Wed/Fri after the lesson', () => {
  // 2026-06-15 is a Monday; the surrounding days are known from the meeting-date test above.
  assert.equal(calculateFirstLessonCheckinDate('2026-06-15'), '2026-06-17'); // Mon -> Wed
  assert.equal(calculateFirstLessonCheckinDate('2026-06-16'), '2026-06-17'); // Tue -> Wed
  assert.equal(calculateFirstLessonCheckinDate('2026-06-17'), '2026-06-19'); // Wed -> Fri
  assert.equal(calculateFirstLessonCheckinDate('2026-06-19'), '2026-06-22'); // Fri -> next Mon
  assert.equal(calculateFirstLessonCheckinDate('2026-06-13'), '2026-06-15'); // Sat -> Mon
  assert.equal(calculateFirstLessonCheckinDate('2026-06-14'), '2026-06-15'); // Sun -> Mon
});

test('first-lesson check-in always falls within the week after the lesson on a check-in day', () => {
  const checkinWeekdays = new Set([1, 3, 5]); // Mon, Wed, Fri
  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const lesson = new Date(2026, 5, 1 + dayOffset); // local dates across two weeks
    const lessonInput = `${lesson.getFullYear()}-${String(lesson.getMonth() + 1).padStart(2, '0')}-${String(lesson.getDate()).padStart(2, '0')}`;
    const checkin = new Date(`${calculateFirstLessonCheckinDate(lessonInput)}T12:00:00`);
    const diffDays = Math.round((checkin - new Date(`${lessonInput}T12:00:00`)) / 86400000);
    assert.ok(diffDays >= 1 && diffDays <= 6, `check-in ${diffDays} days after lesson ${lessonInput}`);
    assert.ok(checkinWeekdays.has(checkin.getDay()), `check-in for ${lessonInput} not on a check-in day`);
  }
});

test('buildFirstLessonCheckinPlanningItem is Unassigned, parent-area, and student-linked', () => {
  const item = buildFirstLessonCheckinPlanningItem({
    mmsId: 'sdt_abc123',
    studentName: 'Ada Lovelace',
    tutorName: 'Finn',
    lessonDate: '2026-06-15',
    lessonTime: '16:30',
  });
  assert.equal(item.owner, 'Unassigned');
  assert.equal(item.area, 'parent');
  assert.equal(item.status, 'active');
  assert.equal(item.itemType, 'action');
  assert.equal(item.linkedStudentId, 'sdt_abc123');
  assert.equal(item.targetDate, '2026-06-17');
  assert.match(item.title, /Ada Lovelace/);
  assert.match(item.nextAction, /Finn & Tom/);
});

test('first-lesson check-in planning id is deterministic per student', () => {
  assert.equal(buildFirstLessonCheckinPlanningId('sdt_abc123'), 'planning_first_lesson_checkin_sdt_abc123');
  assert.equal(
    buildFirstLessonCheckinPlanningId('sdt_abc123'),
    buildFirstLessonCheckinPlanningId('sdt_abc123'),
  );
  assert.notEqual(
    buildFirstLessonCheckinPlanningId('sdt_abc123'),
    buildFirstLessonCheckinPlanningId('sdt_xyz789'),
  );
});

test('buildSchoolForwardPlanningItem creates a weekly Friday prompt', () => {
  const item = buildSchoolForwardPlanningItem({
    now: new Date('2026-06-12T10:00:00.000Z'),
  });

  assert.equal(item.title, 'Friday: what moved the school forward?');
  assert.equal(item.status, 'waiting');
  assert.equal(item.area, 'workflow');
  assert.equal(item.targetDate, '2026-06-12');
  assert.match(item.outcome, /improving the school/u);
});

test('buildSchoolForwardReflections returns dated history from the Friday prompt', () => {
  const items = [{
    planningId: 'planning_weekly_school_forward_review',
    progress: [
      {
        progressId: 'old',
        progressNote: 'Defined the pause planning workflow.',
        createdAt: '2026-06-05T12:00:00.000Z',
      },
      {
        progressId: 'new',
        progressNote: 'Piloted Practice Chat with Finn, Tom, and Fennella.',
        createdAt: '2026-06-12T12:00:00.000Z',
      },
      {
        progressId: 'blank',
        progressNote: '',
        createdAt: '2026-06-13T12:00:00.000Z',
      },
    ],
  }];

  const reflections = buildSchoolForwardReflections(items);

  assert.equal(reflections.length, 2);
  assert.equal(reflections[0].progressId, 'new');
  assert.equal(reflections[1].progressId, 'old');
});

test('isMeetingPlanningItem includes decision, due, and school-forward work', () => {
  const now = new Date('2026-06-13T10:00:00.000Z');

  assert.equal(isMeetingPlanningItem({
    planningId: 'planning_weekly_school_forward_review',
    status: 'waiting',
  }, now), true);
  assert.equal(isMeetingPlanningItem({
    status: 'active',
    targetDate: '2026-06-15',
  }, now), true);
  assert.equal(isMeetingPlanningItem({
    status: 'waiting',
  }, now), true);
  assert.equal(isMeetingPlanningItem({
    status: 'active',
    owner: 'Finn',
    targetDate: '2026-06-30',
    nextAction: 'Review later',
    updatedAt: '2026-06-13T09:00:00.000Z',
  }, now), false);
});

test('infers target dates from operational capture notes', () => {
  assert.equal(
    inferPlanningTargetDateFromText('Pause Coban for Friday', new Date('2026-06-05T10:00:00.000Z')),
    '2026-06-08',
  );
  assert.equal(
    inferPlanningTargetDateFromText('Set up Anna McPhail Stripe 12th June', new Date('2026-06-05T10:00:00.000Z')),
    '2026-06-12',
  );
});

test('puts pause reminders on meeting days two to five days before the pause', () => {
  assert.equal(
    inferPlanningTargetDateFromText('Pause Eddie for Saturday 13th June', new Date('2026-06-05T10:00:00.000Z')),
    '2026-06-11',
  );
  assert.equal(
    inferPlanningTargetDateFromText('Pause Lyra March 12th', new Date('2026-02-05T10:00:00.000Z')),
    '2026-03-09',
  );
  assert.equal(
    inferPlanningTargetDateFromText('Pause Coban for Tuesday 9th June', new Date('2026-06-05T10:00:00.000Z')),
    '2026-06-05',
  );
});

test('buildStructuredPausePlanningDraft creates an unambiguous single lesson pause action', () => {
  const draft = buildStructuredPausePlanningDraft({
    studentName: 'Sam Reid',
    pauseType: 'single',
    lessonDate: '2026-06-13',
    now: NOW,
  });

  assert.equal(draft.isComplete, true);
  assert.equal(draft.title, 'Pause Sam Reid lesson on Sat, 13 Jun 2026');
  assert.equal(draft.targetDate, '2026-06-11');
  assert.match(draft.notes, /Pause type: single lesson/u);
  assert.match(draft.nextAction, /Run pause tool for this lesson/u);
});

test('buildStructuredPausePlanningDraft treats return date as first date back for away periods', () => {
  const draft = buildStructuredPausePlanningDraft({
    studentName: 'Léo TERHZAZ',
    pauseType: 'range',
    firstPauseDate: '2026-06-25',
    returnDate: '2026-08-13',
    extraNote: 'Summer holiday.',
    now: NOW,
  });

  assert.equal(draft.isComplete, true);
  assert.equal(draft.title, 'Pause Léo TERHZAZ from Thu, 25 Jun 2026; returning Thu, 13 Aug 2026');
  assert.equal(draft.targetDate, '2026-06-22');
  assert.match(draft.notes, /Returning from: Thu, 13 Aug 2026/u);
  assert.match(draft.notes, /not the last lesson to pause/u);
  assert.match(draft.notes, /Summer holiday/u);
});

test('buildStructuredPausePlanningDraft reports missing range fields', () => {
  const draft = buildStructuredPausePlanningDraft({
    pauseType: 'range',
    firstPauseDate: '2026-06-25',
  });

  assert.equal(draft.isComplete, false);
  assert.deepEqual(draft.missingFields, ['returning from date']);
});

test('buildPauseLessonDateSuggestions repeats cached lesson dates weekly', () => {
  const suggestions = buildPauseLessonDateSuggestions({
    status: 'found',
    nextLessonAt: '2026-06-07T18:30:00',
    usualTime: '18:30',
    teacherName: 'Fennella McCallum',
  }, {
    now: new Date('2026-06-03T12:00:00.000Z'),
    count: 3,
  });

  assert.deepEqual(suggestions.map((entry) => entry.date), [
    '2026-06-07',
    '2026-06-14',
    '2026-06-21',
  ]);
  assert.match(suggestions[0].lessonLabel, /18:30 with Fennella McCallum/u);
});

test('buildPauseLessonDateSuggestions rolls stale cached next lesson forward', () => {
  const suggestions = buildPauseLessonDateSuggestions({
    status: 'found',
    nextLessonAt: '2026-05-18T16:30:00',
    usualTime: '16:30',
  }, {
    now: new Date('2026-06-03T12:00:00.000Z'),
    count: 2,
  });

  assert.deepEqual(suggestions.map((entry) => entry.date), [
    '2026-06-08',
    '2026-06-15',
  ]);
});

test('buildPauseLessonDateSuggestions can pivot from a selected first missed lesson', () => {
  const suggestions = buildPauseLessonDateSuggestions({
    status: 'found',
    nextLessonAt: '2026-06-07T18:30:00',
    usualTime: '18:30',
  }, {
    now: new Date('2026-06-03T12:00:00.000Z'),
    count: 4,
    startDate: '2026-06-21',
  });

  assert.deepEqual(suggestions.map((entry) => entry.date), [
    '2026-06-21',
    '2026-06-28',
    '2026-07-05',
    '2026-07-12',
  ]);
});

test('summarises planning items due today and overdue', () => {
  const summary = buildPlanningDueSummary([
    {
      planningId: 'planning_1',
      title: 'Pause Coban',
      status: 'active',
      targetDate: '2026-06-05',
    },
    {
      planningId: 'planning_2',
      title: 'Message Elena students',
      status: 'inbox',
      targetDate: '2026-06-04',
    },
    {
      planningId: 'planning_3',
      title: 'Done task',
      status: 'done',
      targetDate: '2026-06-05',
    },
    {
      planningId: 'planning_4',
      title: 'Future task',
      status: 'active',
      targetDate: '2026-06-08',
    },
  ], new Date('2026-06-05T10:00:00.000Z'));

  assert.equal(summary.today, '2026-06-05');
  assert.equal(summary.dueToday, 1);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.dueNow, 2);
  assert.deepEqual(summary.dueNowTitles, ['Message Elena students', 'Pause Coban']);
});

test('marks active initiatives with no next action clearly', () => {
  const momentum = derivePlanningMomentum({
    planningId: 'planning_1',
    itemType: 'initiative',
    status: 'active',
    nextAction: '',
    updatedAt: '2026-06-03T10:00:00.000Z',
  }, [], NOW);

  assert.equal(momentum, 'no_next_action');
});

test('uses recent progress to show movement', () => {
  const momentum = derivePlanningMomentum({
    planningId: 'planning_1',
    itemType: 'initiative',
    status: 'active',
    nextAction: 'Pilot with five families',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }, [{
    planningId: 'planning_1',
    createdAt: '2026-06-01T10:00:00.000Z',
    progressNote: 'Drafted pilot checklist',
  }], NOW);

  assert.equal(momentum, 'moving');
});

test('marks stale active initiatives as stalled', () => {
  const momentum = derivePlanningMomentum({
    planningId: 'planning_1',
    itemType: 'initiative',
    status: 'active',
    nextAction: 'Review with Tom',
    updatedAt: '2026-05-10T10:00:00.000Z',
  }, [], NOW);

  assert.equal(momentum, 'stalled');
});

test('attaches progress rows and builds summary counts', () => {
  const items = attachPlanningProgress([
    {
      planningId: 'planning_1',
      title: 'Parent Understanding Workflow',
      itemType: 'initiative',
      status: 'active',
      owner: 'Finn',
      area: 'parent',
      nextAction: 'Pilot with five families',
      updatedAt: '2026-05-10T10:00:00.000Z',
    },
    {
      planningId: 'planning_2',
      title: 'Sunday piano groups',
      itemType: 'idea',
      status: 'inbox',
      owner: 'Unassigned',
      area: 'other',
      updatedAt: '2026-06-02T10:00:00.000Z',
    },
  ], [
    {
      progressId: 'progress_1',
      planningId: 'planning_1',
      progressNote: 'Built V1 workflow page',
      progressType: 'note',
      createdAt: '2026-06-02T10:00:00.000Z',
    },
  ], NOW);
  const summary = buildPlanningSummary(items);

  assert.equal(items[0].latestProgress.progressNote, 'Built V1 workflow page');
  assert.equal(items[0].momentum, 'moving');
  assert.equal(items[1].momentum, 'inbox');
  assert.equal(summary.total, 2);
  assert.equal(summary.open, 2);
  assert.equal(summary.inbox, 1);
  assert.equal(summary.initiatives, 1);
  assert.equal(summary.activeInitiatives, 1);
  assert.equal(summary.moving, 1);
  assert.equal(summary.needsAttention, 0);
});
