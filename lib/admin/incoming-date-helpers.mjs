// Deterministic date/duration extraction from parent WhatsApp messages, so a
// converted incoming message can carry its pause window into the structured
// pause draft (and the reply) instead of the admin re-reading the message.
// Pure and reference-dated: pass the message timestamp as referenceDate so
// relative phrases ("next Friday", "in two weeks") resolve the same way in
// tests and production. Everything works in UTC days; output is YYYY-MM-DD.
//
// Deliberately conservative: a return date is only ever taken from an explicit
// marker ("back on…", "till…") or start + duration — never guessed from "the
// latest date mentioned", because lists of missed lessons ("away on the 7th,
// the 14th and the 21st") would make that wrong.

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sept: 8, sep: 8, october: 9, oct: 9,
  november: 10, nov: 10, december: 11, dec: 11,
};
const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

const WEEKDAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const WEEKDAY_PATTERN = Object.keys(WEEKDAYS).join('|');

const NUMBER_WORDS = {
  one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  couple: 2, few: 3,
};

// Words that mark the date after them as a return/back date rather than a start.
const RETURN_MARKER = /\b(back|return(?:s|ing)?|resum(?:e|es|ing)|restart(?:s|ing)?|until|till|til)\b/iu;

function toUtcDay(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));
  // Reject rollovers like 31 April.
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

function startOfUtcDay(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toIso(date) {
  return date ? date.toISOString().slice(0, 10) : '';
}

// A date with no year means the next occurrence: if it already passed more
// than 14 days before the reference, it's about next year (grace window so
// "last Friday the 20th" style mentions stay nearby instead of jumping ahead).
function inferYear(month, day, reference) {
  const thisYear = toUtcDay(reference.getUTCFullYear(), month, day);
  if (thisYear && thisYear.getTime() >= reference.getTime() - 14 * DAY_MS) return thisYear;
  return toUtcDay(reference.getUTCFullYear() + 1, month, day);
}

function nextWeekday(target, reference) {
  const diff = ((target - reference.getUTCDay()) + 7) % 7 || 7;
  return new Date(reference.getTime() + diff * DAY_MS);
}

function normaliseYear(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (value >= 1000) return value;
  return 2000 + value;
}

// Collects every date mention as { date, index, snippet } so the marker words
// just before each one can decide its role.
function collectDateTokens(text, reference) {
  const tokens = [];
  const push = (date, match, kind = 'explicit') => {
    if (date) tokens.push({ date, index: match.index, snippet: match[0].trim(), kind });
  };

  // ISO: 2026-04-10
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/gu)) {
    push(toUtcDay(Number(match[1]), Number(match[2]) - 1, Number(match[3])), match);
  }

  // "10th April", "the 24th of June", "24 june"
  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_PATTERN})\\b`, 'giu');
  for (const match of text.matchAll(dayMonth)) {
    push(inferYear(MONTHS[match[2].toLowerCase()], Number(match[1]), reference), match);
  }

  // "April 10th", "june 24"
  const monthDay = new RegExp(`\\b(${MONTH_PATTERN})\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'giu');
  for (const match of text.matchAll(monthDay)) {
    push(inferYear(MONTHS[match[1].toLowerCase()], Number(match[2]), reference), match);
  }

  // "early/mid/late august" → 5th/15th/25th (real parent phrasing: "back mid august")
  const fuzzyMonth = new RegExp(`\\b(early|mid|late)[-\\s]?(${MONTH_PATTERN})\\b`, 'giu');
  for (const match of text.matchAll(fuzzyMonth)) {
    const day = { early: 5, mid: 15, late: 25 }[match[1].toLowerCase()];
    push(inferYear(MONTHS[match[2].toLowerCase()], day, reference), match);
  }

  // Numeric: 18/04, 21.06, 18/04/2026 (UK day-first; invalid months reject
  // times like "5.15pm" naturally)
  for (const match of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b(?!\s*(?:am|pm))/giu)) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    if (month < 0 || month > 11 || day < 1 || day > 31) continue;
    const year = match[3] ? normaliseYear(match[3]) : null;
    push(year ? toUtcDay(year, month, day) : inferYear(month, day, reference), match);
  }

  // "next friday", "on monday", "from monday", "until thursday"
  const weekday = new RegExp(`\\b(?:next|this|on|from|until|till|til|by)\\s+(${WEEKDAY_PATTERN})\\b`, 'giu');
  for (const match of text.matchAll(weekday)) {
    push(nextWeekday(WEEKDAYS[match[1].toLowerCase()], reference), match, 'weekday');
  }

  // today / tomorrow / next week / in N weeks
  for (const match of text.matchAll(/\btoday\b/giu)) push(reference, match);
  for (const match of text.matchAll(/\btomorrow\b/giu)) push(new Date(reference.getTime() + DAY_MS), match);
  for (const match of text.matchAll(/\bnext week\b/giu)) {
    // The Monday of next week.
    const monday = new Date(reference.getTime() + ((8 - reference.getUTCDay()) % 7 || 7) * DAY_MS);
    push(monday, match);
  }
  const inWeeks = new RegExp(`\\bin\\s+(\\d+|${Object.keys(NUMBER_WORDS).join('|')})\\s+(week|weeks)\\b`, 'giu');
  for (const match of text.matchAll(inWeeks)) {
    const count = Number(match[1]) || NUMBER_WORDS[match[1].toLowerCase()] || 0;
    if (count) push(new Date(reference.getTime() + count * 7 * DAY_MS), match);
  }

  // "on Monday the 19th of August": the weekday guess ("on monday" → next
  // Monday from the reference) is wrong whenever an explicit date follows it —
  // the explicit date wins and the weekday token is dropped.
  const kept = tokens.filter((token) => token.kind !== 'weekday'
    || !tokens.some((other) => other.kind === 'explicit'
      && other.index >= token.index
      && other.index - token.index <= 24));

  // Same calendar day mentioned two ways keeps the earliest mention's
  // position; then sort by position in the message.
  const seen = new Map();
  for (const token of kept.sort((a, b) => a.index - b.index)) {
    const key = toIso(token.date);
    if (!seen.has(key)) seen.set(key, token);
  }
  return [...seen.values()];
}

function extractDurationWeeks(text) {
  if (/\bfortnight\b/iu.test(text)) return 2;
  const pattern = new RegExp(
    `\\b(\\d+|${Object.keys(NUMBER_WORDS).join('|')})\\s+(?:of\\s+)?(week|weeks|month|months)\\b`,
    'iu',
  );
  const match = pattern.exec(text);
  if (!match) return null;
  const count = Number(match[1]) || NUMBER_WORDS[match[1].toLowerCase()] || 0;
  if (!count) return null;
  return match[2].toLowerCase().startsWith('month') ? count * 4 : count;
}

export function extractDatesFromMessage(messageText = '', { referenceDate = new Date() } = {}) {
  const text = `${messageText || ''}`;
  const reference = startOfUtcDay(referenceDate);
  const tokens = collectDateTokens(text, reference);
  const durationWeeks = extractDurationWeeks(text);

  const starts = [];
  const returns = [];
  for (const token of tokens) {
    // The ~24 characters before a date carry its role ("back on", "till the");
    // weekday snippets carry the marker inside the match ("until friday").
    // "to" is too common to scan the whole lead for ("going to France on…"),
    // but immediately before a date it means a range end: "from 18/04 to 02/05".
    const lead = text.slice(Math.max(0, token.index - 24), token.index);
    const isReturn = RETURN_MARKER.test(`${lead} ${token.snippet}`) || /\bto\s+(?:the\s+)?$/iu.test(lead);
    (isReturn ? returns : starts).push(token);
  }

  let startDate = starts.length
    ? starts.reduce((min, token) => (token.date < min.date ? token : min)).date
    : null;
  let returnDate = returns.length ? returns[0].date : null;

  // Return-only mention ("she's back on the 21st") still needs a start for a
  // window; without one the caller only gets the return date.
  if (!startDate && returnDate && durationWeeks) {
    startDate = new Date(returnDate.getTime() - durationWeeks * 7 * DAY_MS);
  }
  if (startDate && !returnDate && durationWeeks) {
    returnDate = new Date(startDate.getTime() + durationWeeks * 7 * DAY_MS);
  }

  // "away from 20 Dec, back on 5 Jan" — a return before the start means it
  // wrapped into the next year.
  if (startDate && returnDate && returnDate.getTime() <= startDate.getTime()) {
    const rolled = toUtcDay(returnDate.getUTCFullYear() + 1, returnDate.getUTCMonth(), returnDate.getUTCDate());
    returnDate = rolled && rolled.getTime() > startDate.getTime() ? rolled : null;
  }

  return {
    startDate: toIso(startDate),
    returnDate: toIso(returnDate),
    dates: tokens.map((token) => toIso(token.date)).sort(),
    durationWeeks,
    matches: tokens.map((token) => token.snippet),
  };
}

// "2026-06-24" → "Wednesday 24 June" for reply drafts (year left out — the
// human edits and sends the reply, and near dates read better without it).
export function formatFriendlyDate(iso = '') {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(`${iso || ''}`.trim());
  if (!match) return '';
  const date = toUtcDay(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}
