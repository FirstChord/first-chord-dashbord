import test from 'node:test';
import assert from 'node:assert/strict';

import { extractDatesFromMessage, formatFriendlyDate } from '../../lib/admin/incoming-date-helpers.mjs';

// Reference dates are fixed so relative phrases resolve deterministically.
// Cases are synthetic and use fixed reference dates so relative phrases remain
// representative without retaining a family's message history.

test('extracts an explicit from/till window with ordinals and month names', () => {
  const result = extractDatesFromMessage(
    'Hi, Alex will be away for holiday from the 24th of June till the 21st of July',
    { referenceDate: new Date('2026-06-19T10:00:00Z') },
  );
  assert.equal(result.startDate, '2026-06-24');
  assert.equal(result.returnDate, '2026-07-21');
});

test('extracts numeric UK dates and fuzzy month returns ("back mid august")', () => {
  const result = extractDatesFromMessage(
    'we will be on holiday starting 21.06 and be back to Glasgow mid august',
    { referenceDate: new Date('2026-06-14T10:00:00Z') },
  );
  assert.equal(result.startDate, '2026-06-21');
  assert.equal(result.returnDate, '2026-08-15');
});

test('resolves "starting in two weeks" against the message date', () => {
  const result = extractDatesFromMessage(
    'he will be away during the summer, starting in two weeks and will be back mid august',
    { referenceDate: new Date('2026-06-15T10:00:00Z') },
  );
  assert.equal(result.startDate, '2026-06-29');
  assert.equal(result.returnDate, '2026-08-15');
  assert.equal(result.durationWeeks, 2);
});

test('rolls a January return into the next year for a December start', () => {
  const result = extractDatesFromMessage(
    'away for Christmas from the 21st of December until the 6th of January inclusive',
    { referenceDate: new Date('2026-12-14T10:00:00Z') },
  );
  assert.equal(result.startDate, '2026-12-21');
  assert.equal(result.returnDate, '2027-01-06');
});

test('computes the return date from start + duration ("two weeks from Monday")', () => {
  // Reference is Friday 6 March 2026; next Monday is the 9th.
  const result = extractDatesFromMessage(
    "Hi Finn, we're away for two weeks from Monday",
    { referenceDate: new Date('2026-03-06T10:00:00Z') },
  );
  assert.equal(result.startDate, '2026-03-09');
  assert.equal(result.returnDate, '2026-03-23');
  assert.equal(result.durationWeeks, 2);
});

test('handles today and relative weekdays for one-off absences', () => {
  const today = extractDatesFromMessage(
    'Aria won’t be able to make her lesson today - last minute change of plans',
    { referenceDate: new Date('2026-07-03T08:00:00Z') },
  );
  assert.equal(today.startDate, '2026-07-03');
  assert.equal(today.returnDate, '');

  // Reference is Monday 29 June; next Friday is 3 July.
  const friday = extractDatesFromMessage(
    'Alex cannot make his lesson next Friday',
    { referenceDate: new Date('2026-06-29T08:00:00Z') },
  );
  assert.equal(friday.startDate, '2026-07-03');
});

test('reads "from 18/04 to 02/05" as a range', () => {
  const result = extractDatesFromMessage(
    "We'll be away on vacation from 18/04 to 02/05.",
    { referenceDate: new Date('2026-04-01T10:00:00Z') },
  );
  assert.equal(result.startDate, '2026-04-18');
  assert.equal(result.returnDate, '2026-05-02');
});

test('an explicit date beats the weekday guess in "on Monday the 19th of August"', () => {
  const result = extractDatesFromMessage(
    'we would like to restart on Monday the 19th of august if possible',
    { referenceDate: new Date('2026-06-17T10:00:00Z') },
  );
  assert.deepEqual(result.dates, ['2026-08-19']);
  // "restart" marks it as a return, so there is no start.
  assert.equal(result.startDate, '');
  assert.equal(result.returnDate, '2026-08-19');
});

test('never invents a return date from a list of missed lessons', () => {
  const result = extractDatesFromMessage(
    'Nina will be away on the 7 April, the 14 April and the 21 April. Thanks',
    { referenceDate: new Date('2026-03-26T10:00:00Z') },
  );
  assert.equal(result.startDate, '2026-04-07');
  assert.equal(result.returnDate, '');
  assert.equal(result.dates.length, 3);
});

test('ignores times, prices, and messages with no dates', () => {
  assert.equal(extractDatesFromMessage('Would 5.15pm work for the 2.15 - 3.45 slot?', { referenceDate: new Date('2026-06-01T10:00:00Z') }).dates.length, 0);
  const none = extractDatesFromMessage('Ok thanks, see you then!', { referenceDate: new Date('2026-06-01T10:00:00Z') });
  assert.equal(none.startDate, '');
  assert.equal(none.returnDate, '');
  assert.equal(none.durationWeeks, null);
});

test('a date without a year lands on the next occurrence', () => {
  // "10 January" said in November means January next year.
  const result = extractDatesFromMessage(
    'lessons resume on the 10th of January',
    { referenceDate: new Date('2026-11-20T10:00:00Z') },
  );
  assert.equal(result.returnDate, '2027-01-10');
});

test('understands a fortnight', () => {
  const result = extractDatesFromMessage(
    'we are away for a fortnight from the 1st of August',
    { referenceDate: new Date('2026-07-20T10:00:00Z') },
  );
  assert.equal(result.startDate, '2026-08-01');
  assert.equal(result.returnDate, '2026-08-15');
  assert.equal(result.durationWeeks, 2);
});

test('formatFriendlyDate renders a UK-readable day', () => {
  assert.equal(formatFriendlyDate('2026-06-24'), 'Wednesday 24 June');
  assert.equal(formatFriendlyDate(''), '');
  assert.equal(formatFriendlyDate('not-a-date'), '');
});
