import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStudentPracticeTimeline,
  extractTempoPercentages,
} from '../../lib/admin/practice-timeline-helpers.mjs';

test('extractTempoPercentages only trusts explicit percent signs', () => {
  assert.deepEqual(extractTempoPercentages('sitting at 70%, now up to 100 %'), [70, 100]);
  assert.deepEqual(extractTempoPercentages('bar 29 of the B section, Grade 6'), []);
  assert.deepEqual(extractTempoPercentages(''), []);
});

test('buildStudentPracticeTimeline orders notes oldest to newest', () => {
  const timeline = buildStudentPracticeTimeline([
    { studentMmsId: 'sdt_1', studentName: 'Ada', lessonDate: '2026-06-18', tutorName: 'Tom', whatWeDid: 'Third lesson.', practiceGoals: 'Work up to bar 29.' },
    { studentMmsId: 'sdt_1', lessonDate: '2026-06-04', tutorName: 'Tom', whatWeDid: 'First lesson.' },
    { studentMmsId: 'sdt_1', lessonDate: '2026-06-11', tutorName: 'Tom', whatWeDid: 'Second lesson.' },
  ]);

  assert.equal(timeline.noteCount, 3);
  assert.equal(timeline.studentName, 'Ada');
  assert.deepEqual(timeline.entries.map((entry) => entry.whatWeDid), [
    'First lesson.',
    'Second lesson.',
    'Third lesson.',
  ]);
  assert.equal(timeline.lastLessonDate, '2026-06-18');
  assert.equal(timeline.nextLessonFocus, 'Work up to bar 29.');
  assert.equal(timeline.latestTutor, 'Tom');
});

test('buildStudentPracticeTimeline builds a tempo trend from percentage mentions', () => {
  const timeline = buildStudentPracticeTimeline([
    { studentMmsId: 'sdt_1', lessonDate: '2026-06-04', progressChallenges: 'Was at 70%.' },
    { studentMmsId: 'sdt_1', lessonDate: '2026-06-11', progressChallenges: 'Now at 85%.' },
    { studentMmsId: 'sdt_1', lessonDate: '2026-06-18', progressChallenges: 'Up to 100% today.' },
  ]);

  assert.deepEqual(timeline.tempoTrend, [
    { date: '2026-06-04', value: 70 },
    { date: '2026-06-11', value: 85 },
    { date: '2026-06-18', value: 100 },
  ]);
});

test('buildStudentPracticeTimeline ignores empty notes', () => {
  const timeline = buildStudentPracticeTimeline([
    { studentMmsId: 'sdt_1', lessonDate: '2026-06-04', whatWeDid: '', progressChallenges: '', practiceGoals: '', rawNoteText: '' },
    { studentMmsId: 'sdt_1', lessonDate: '2026-06-11', whatWeDid: 'Real content.' },
  ]);

  assert.equal(timeline.noteCount, 1);
  assert.equal(timeline.entries[0].whatWeDid, 'Real content.');
});
