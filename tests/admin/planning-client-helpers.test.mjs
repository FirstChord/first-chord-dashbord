import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shortPreview,
  formatTargetDate,
  firstName,
  isStudentOwnContact,
  formatDateInput,
  addDaysToDateInput,
  parseReadablePlanningDate,
  extractPauseDatesFromPlanningItem,
  buildPaymentPausePrefillUrl,
  buildPauseConfirmationMessage,
  isPausePlanningItem,
  isDueNowPlanningItem,
  isOpenPlanningItem,
  getPlanningStory,
  getPlanningWhatToDo,
  dueChipLabel,
  hasPlanningLink,
  findStudentSuggestions,
  inferStudentFromText,
  truncateTitle,
  applySmartDefaults,
} from '../../lib/admin/planning-client-helpers.mjs';

test('shortPreview truncates with an ellipsis past the max', () => {
  assert.equal(shortPreview('short', 50), 'short');
  assert.equal(shortPreview('a'.repeat(10), 5), 'aaaa...');
  assert.equal(shortPreview('  trimmed  ', 50), 'trimmed');
});

test('formatTargetDate: blank → blank, invalid → input, valid → readable', () => {
  assert.equal(formatTargetDate(''), '');
  assert.equal(formatTargetDate('not-a-date'), 'not-a-date');
  const out = formatTargetDate('2026-07-06');
  assert.match(out, /Jul/);
  assert.match(out, /6/);
});

test('firstName takes the first whitespace-delimited token', () => {
  assert.equal(firstName('Ada Lovelace'), 'Ada');
  assert.equal(firstName('  '), '');
  assert.equal(firstName('Madonna'), 'Madonna');
});

test('isStudentOwnContact treats no-parent / parent==student as the student being their own contact', () => {
  assert.equal(isStudentOwnContact({ fullName: 'Sian Malyin' }), true); // no parent
  assert.equal(isStudentOwnContact({ fullName: 'Sian Malyin', parentFirstName: 'Sian', parentLastName: 'Malyin' }), true);
  assert.equal(isStudentOwnContact({ fullName: 'Ada Smith', parentFirstName: 'Rachel', parentLastName: 'Smith' }), false);
});

test('date input helpers round-trip and shift correctly', () => {
  assert.equal(formatDateInput(new Date(2026, 6, 4)), '2026-07-04');
  assert.equal(addDaysToDateInput('2026-07-04', 3), '2026-07-07');
  assert.equal(addDaysToDateInput('2026-07-04', -2), '2026-07-02');
  assert.equal(addDaysToDateInput('not-a-date', 3), 'not-a-date');
});

test('parseReadablePlanningDate reads "Mon, 6 Jul 2026" → ISO', () => {
  assert.equal(parseReadablePlanningDate('Mon, 6 Jul 2026'), '2026-07-06');
  assert.equal(parseReadablePlanningDate('Sat 12 Sept 2026'), '2026-09-12');
  assert.equal(parseReadablePlanningDate('garbage'), '');
});

test('extractPauseDatesFromPlanningItem reads structured, single, and range notes', () => {
  assert.deepEqual(
    extractPauseDatesFromPlanningItem({ notes: 'First lesson to pause date: 2026-07-06\nReturning from date: 2026-07-20' }),
    { startDate: '2026-07-06', endDate: '2026-07-20' },
  );
  // single structured date → start === end
  assert.deepEqual(
    extractPauseDatesFromPlanningItem({ notes: 'Lesson date: 2026-07-06' }),
    { startDate: '2026-07-06', endDate: '2026-07-06' },
  );
  assert.deepEqual(extractPauseDatesFromPlanningItem({ notes: 'no dates here' }), { startDate: '', endDate: '' });
});

test('buildPaymentPausePrefillUrl returns empty without a student/dates, and a populated URL otherwise', () => {
  assert.equal(buildPaymentPausePrefillUrl({ item: {}, student: null }), '');
  assert.equal(buildPaymentPausePrefillUrl({ item: { notes: 'Lesson date: 2026-07-06' }, student: { fullName: 'Ada' } }), ''); // no mmsId
  const url = buildPaymentPausePrefillUrl({
    item: { planningId: 'p1', notes: 'First lesson to pause date: 2026-07-06\nReturning from date: 2026-07-20', targetDate: '2026-07-01' },
    student: { mmsId: 'sdt_1', fullName: 'Ada Smith', email: 'a@example.com', tutor: 'Kenny' },
  });
  assert.match(url, /payment-pause-pwa/);
  assert.match(url, /mmsId=sdt_1/);
  assert.match(url, /source=dashboard-planning/);
});

test('buildPauseConfirmationMessage addresses adults directly and parents in third person', () => {
  const item = { notes: 'First lesson to pause date: 2026-07-06\nReturning from date: 2026-07-20' };
  const adult = buildPauseConfirmationMessage({ item, student: { fullName: 'Sian Malyin', tutor: 'Kenny Bates' } });
  assert.match(adult, /paused your payment/);
  assert.match(adult, /will next see you on/);

  const parent = buildPauseConfirmationMessage({ item, student: { fullName: 'Ada Smith', parentFirstName: 'Rachel', parentLastName: 'Smith', tutor: 'Kenny Bates' } });
  assert.match(parent, /Hi Rachel/);
  assert.match(parent, /paused payment for Ada/);
});

test('isPausePlanningItem / isOpenPlanningItem / isDueNowPlanningItem classify items', () => {
  assert.equal(isPausePlanningItem({ title: 'Pause Ada' }), true);
  assert.equal(isPausePlanningItem({ title: 'Email parent' }), false);
  assert.equal(isOpenPlanningItem({ status: 'active' }), true);
  assert.equal(isOpenPlanningItem({ status: 'done' }), false);
  const now = new Date('2026-07-10T12:00:00Z');
  assert.equal(isDueNowPlanningItem({ status: 'active', targetDate: '2026-07-10' }, now), true);
  assert.equal(isDueNowPlanningItem({ status: 'active', targetDate: '2026-07-20' }, now), false); // future
  assert.equal(isDueNowPlanningItem({ status: 'done', targetDate: '2026-07-01' }, now), false); // done
});

test('getPlanningStory frames pause cards and falls back to the title', () => {
  const opts = [{ mmsId: 'sdt_1', fullName: 'Ada Smith' }];
  const range = getPlanningStory({ linkedStudentId: 'sdt_1', notes: 'Pause — First lesson to pause date: 2026-07-06\nReturning from date: 2026-07-20' }, opts);
  assert.match(range, /Pause Ada Smith from/);
  assert.equal(getPlanningStory({ title: 'Order new chairs' }), 'Order new chairs');
  assert.equal(getPlanningStory({ title: '' }), 'This needs a look today.');
});

test('getPlanningWhatToDo prefers nextAction, then pause/tutor-absence framing', () => {
  assert.equal(getPlanningWhatToDo({ nextAction: 'Call the parent' }), 'Call the parent');
  assert.match(getPlanningWhatToDo({ title: 'Pause Ada' }), /pause the payment/);
  assert.match(getPlanningWhatToDo({ linkedWorkflowId: 'tutor-absence' }), /tutor-absence workflow/);
});

test('dueChipLabel: today, overdue, future, and no-date', () => {
  const now = new Date('2026-07-10T12:00:00Z');
  assert.equal(dueChipLabel('2026-07-10', now), 'Today');
  assert.equal(dueChipLabel('2026-07-09', now), 'Overdue 1 day');
  assert.equal(dueChipLabel('2026-07-07', now), 'Overdue 3 days');
  assert.equal(dueChipLabel('', now), 'No date');
  assert.match(dueChipLabel('2026-07-20', now), /Jul/); // future → formatted date
});

test('hasPlanningLink is true when any link field is set', () => {
  assert.equal(hasPlanningLink({ linkedStudentId: 'sdt_1' }), true);
  assert.equal(hasPlanningLink({ linkedWorkflowId: 'tutor-absence' }), true);
  assert.equal(hasPlanningLink({}), false);
});

test('truncateTitle takes the first line, strips bullets, and caps length', () => {
  assert.equal(truncateTitle('- First line\nSecond line'), 'First line');
  assert.equal(truncateTitle('x'.repeat(100), 10), 'xxxxxxxxx...');
});

test('applySmartDefaults promotes inbox actions/initiatives to active', () => {
  assert.equal(applySmartDefaults({ itemType: 'action', status: 'inbox' }).status, 'active');
  assert.equal(applySmartDefaults({ itemType: 'idea', status: 'inbox' }).status, 'inbox'); // ideas stay
});

const STUDENTS = [
  { mmsId: 'sdt_theo', fullName: 'Theodore Brown', tutor: 'Kenny', instrument: 'Guitar' },
  { mmsId: 'sdt_ada', fullName: 'Ada Lovelace', tutor: 'Calum', instrument: 'Piano' },
];

test('findStudentSuggestions ranks prefix/substring matches', () => {
  const out = findStudentSuggestions(STUDENTS, 'theo');
  assert.equal(out[0].mmsId, 'sdt_theo');
  assert.deepEqual(findStudentSuggestions(STUDENTS, ''), []);
});

test('inferStudentFromText avoids the stop-word trap and resolves real names', () => {
  // "the" must NOT latch onto Theodore (the stop-word guard)
  assert.equal(inferStudentFromText(STUDENTS, 'pause the lesson next week'), null);
  // a real first name resolves
  assert.equal(inferStudentFromText(STUDENTS, 'Ada is away on holiday')?.mmsId, 'sdt_ada');
});
