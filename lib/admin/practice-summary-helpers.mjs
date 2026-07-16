// Builds the tutor-facing practice summary: the deterministic "arc" view of a
// student's recent notes. Pure and read-only, like practice-timeline-helpers,
// and consumes the same normalised rows from getPracticeNoteLogRows.
//
// The core signal is recurrence: a multi-word phrase that appears in two or
// more different lessons of the *same student* is almost always a piece or a
// working theme ("Mr Tambourine Man", "hands together"). Phrases that appear
// Title-Cased in the raw text are classified as pieces — the ASR capitalises
// titles. This never guesses piece names from a vocabulary; it only surfaces
// what the notes themselves repeat, so ASR-corrupted spellings stay honest
// ("The Man Who Solved the World" is shown as written, not "corrected").

import { buildStudentPracticeTimeline, extractTempoPercentages } from './practice-timeline-helpers.mjs';

const STOPWORDS = new Set(`the a an and or so of to in on at for with we i you it that this was were is are be been being have has had do did does as up out over just really then next week weeks time lesson lessons today bit look looking looked little more some when what which how also going go get got well good great nice keep start started can could would should will now new like play played playing practice practicing practise practised work worked working song piece there here your my his her our their them they he she from into about after before because but not very much still try trying tried make making made last first one two three four five want wants need needs feel feeling felt say said think thought yeah okay right left let bring brought take took come came end again same other thing things way lot home continue continued coming along nicely slowly quickly added adding sounding sounds better easier harder if off starts started ends gets getting`.split(/\s+/));

// Words allowed to stay lowercase inside a Title-Cased piece name.
const SMALL_TITLE_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'is', 'it', 'by', 'me', 'my']);

// Progress-filler phrases that recur for every student and carry no content.
const FILLER_PHRASES = [
  'coming along',
  'all the way',
  'way through',
  'particular attention',
  'next time',
  'last time',
  'this week',
  'well done',
  'keep it up',
  'carry on',
  'have a look',
  'good progress',
  'really well',
];

function noteBodyText(note = {}) {
  return [note.whatWeDid, note.progressChallenges, note.practiceGoals]
    .map((value) => `${value || ''}`.trim())
    .filter(Boolean)
    .join('. ');
}

function sentencesOf(text = '') {
  return `${text}`.split(/[.!?\n]+/).map((part) => part.trim()).filter(Boolean);
}

function wordsOf(text = '') {
  // Curly apostrophes normalise to straight so "Don’t" and "don't" agree.
  return `${text}`.toLowerCase().replace(/’/gu, "'").replace(/[^a-z0-9' ]+/gu, ' ').split(/\s+/).filter(Boolean);
}

function escapeRegex(value = '') {
  return `${value}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Speaker/name tokens (student and tutor first names) poison phrase mining —
// "Finn: So Arnav" recurs every lesson. Any gram containing one is dropped.
function nameTokensFor(notes = []) {
  const tokens = new Set();
  for (const note of notes) {
    for (const name of [note.studentName, note.tutorName]) {
      for (const token of wordsOf(name || '')) {
        if (token.length > 1) tokens.add(token);
      }
    }
  }
  return tokens;
}

function gramsForNote(note, nameTokens) {
  const grams = new Set();
  for (const sentence of sentencesOf(noteBodyText(note))) {
    const w = wordsOf(sentence);
    for (let n = 2; n <= 4; n += 1) {
      for (let i = 0; i + n <= w.length; i += 1) {
        const gram = w.slice(i, i + n);
        if (STOPWORDS.has(gram[0]) || STOPWORDS.has(gram[n - 1])) continue;
        if (gram.every((word) => STOPWORDS.has(word))) continue;
        if (gram.some((word) => /^\d+$/.test(word) || nameTokens.has(word))) continue;
        const phrase = gram.join(' ');
        if (FILLER_PHRASES.some((filler) => phrase.includes(filler))) continue;
        grams.add(phrase);
      }
    }
  }
  return grams;
}

// A phrase is a piece when some occurrence in the raw text is Title-Cased:
// every non-small word starts uppercase, beyond just a sentence opener.
// Returns the best-cased occurrence as the display label, or null.
function titleCasedLabel(phrase, fullText) {
  const pattern = phrase.split(' ')
    .map((word) => word.split("'").map(escapeRegex).join("['’]"))
    .join("[\\s,'’\\-.]+");
  const regex = new RegExp(pattern, 'giu');
  let best = null;
  let match = regex.exec(fullText);
  while (match) {
    const occurrence = match[0];
    const parts = occurrence.split(/[\s,\-.]+/).filter(Boolean);
    const capitalised = parts.every((word, index) => {
      const lower = word.toLowerCase();
      if (SMALL_TITLE_WORDS.has(lower) && index > 0) return true;
      return /^[A-Z]/u.test(word);
    });
    if (capitalised && (!best || occurrence.length >= best.length)) best = occurrence;
    match = regex.exec(fullText);
  }
  return best;
}

// Latest tempo % mentioned in the same sentence as the phrase, newest note
// first; "was at 90, now 100" yields 100 (the last value in the sentence).
function latestTempoFor(phrase, notesNewestFirst) {
  for (const note of notesNewestFirst) {
    for (const sentence of sentencesOf(noteBodyText(note))) {
      if (!wordsOf(sentence).join(' ').includes(phrase)) continue;
      const values = extractTempoPercentages(sentence);
      if (values.length) return values[values.length - 1];
    }
  }
  return null;
}

// Recurring pieces and working themes across a student's notes. Notes may be
// in any order; entries with no content are ignored.
export function extractRecurringThemes(notes = [], { maxPieces = 4, maxThemes = 4 } = {}) {
  const timeline = buildStudentPracticeTimeline(notes);
  const ordered = timeline.entries; // oldest -> newest, content only
  if (ordered.length < 2) return { pieces: [], themes: [] };

  const nameTokens = nameTokensFor(notes);
  const perLesson = ordered.map((entry) => ({
    date: entry.date,
    grams: gramsForNote(entry, nameTokens),
  }));

  const lessonCount = new Map();
  for (const lesson of perLesson) {
    for (const gram of lesson.grams) lessonCount.set(gram, (lessonCount.get(gram) || 0) + 1);
  }

  let recurring = [...lessonCount.entries()].filter(([, count]) => count >= 2);
  // Prefer the longest phrasing: drop a gram contained in a recurring longer
  // gram that appears at least as often.
  recurring = recurring.filter(([gram, count]) => (
    !recurring.some(([other, otherCount]) => other !== gram && other.includes(gram) && otherCount >= count)
  ));

  const fullText = ordered.map((entry) => noteBodyText(entry)).join('. ');
  const newestFirst = [...ordered].reverse();
  const pieces = [];
  const themes = [];
  for (const [phrase, count] of recurring.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)) {
    const dates = perLesson.filter((lesson) => lesson.grams.has(phrase)).map((lesson) => lesson.date);
    const label = titleCasedLabel(phrase, fullText);
    if (label) {
      pieces.push({
        label,
        phrase,
        lessonCount: count,
        firstDate: dates[0] || '',
        lastDate: dates[dates.length - 1] || '',
        latestTempo: latestTempoFor(phrase, newestFirst),
      });
    } else {
      themes.push({ phrase, lessonCount: count });
    }
  }

  // A piece usually also recurs as a lowercase fragment; drop themes that are
  // contained in a piece phrase.
  const filteredThemes = themes.filter(({ phrase }) => (
    !pieces.some((piece) => piece.phrase.includes(phrase) || phrase.includes(piece.phrase))
  ));

  return {
    pieces: pieces.slice(0, maxPieces),
    themes: filteredThemes.slice(0, maxThemes),
  };
}

function tokenOverlap(a = '', b = '') {
  const setA = new Set(wordsOf(a).filter((word) => word.length > 2 && !STOPWORDS.has(word)));
  const setB = new Set(wordsOf(b).filter((word) => word.length > 2 && !STOPWORDS.has(word)));
  if (!setA.size || !setB.size) return 0;
  let hits = 0;
  for (const word of setA) if (setB.has(word)) hits += 1;
  return hits / Math.min(setA.size, setB.size);
}

const CARRIED_OVER_THRESHOLD = 0.35;

// The complete Summary-tab view model. `now` is injectable for tests.
export function buildPracticeSummary(notes = [], { now = Date.now() } = {}) {
  const timeline = buildStudentPracticeTimeline(notes);
  const entries = timeline.entries;
  const latest = entries[entries.length - 1] || null;

  const carriedOver = Boolean(
    latest?.practiceGoals
    && entries.slice(0, -1).some((entry) => (
      tokenOverlap(latest.practiceGoals, entry.practiceGoals) >= CARRIED_OVER_THRESHOLD
    )),
  );

  const lastTime = new Date(timeline.lastLessonDate || '').getTime();
  const daysSinceLastLesson = Number.isFinite(lastTime)
    ? Math.max(0, Math.round((now - lastTime) / 86400000))
    : null;

  return {
    noteCount: timeline.noteCount,
    firstDate: entries[0]?.date || '',
    lastLessonDate: timeline.lastLessonDate,
    daysSinceLastLesson,
    focus: {
      text: timeline.nextLessonFocus,
      date: timeline.lastLessonDate,
      carriedOver,
    },
    latestProgress: latest?.progressChallenges || '',
    ...extractRecurringThemes(notes),
  };
}
