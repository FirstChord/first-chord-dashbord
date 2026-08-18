/** @fileoverview Builds the tutor-facing practice summary by surfacing phrases the student's own notes repeat, never guessing piece names from a vocabulary. */
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
//
// That rule has been narrowed, deliberately. It produced two bad outcomes: one
// song arrived as several entries because the ASR spelled it several ways
// ("Who Sold the World", "Man Who Sold", "Who Solved the World" were all The
// Man Who Sold the World, each with its own lesson count), and the surviving
// label was a mishearing shown to the tutor as if it were the title.
//
// So a phrase is now matched against the song catalogue. When it matches, the
// catalogue's title is both the identity and the label: those variants collapse
// into one entry reading "The Man Who Sold the World". The catalogue is a
// curated list of real titles, not a guess, which is what makes this safe —
// and matching is strict, so Sweet Home Chicago never claims Sweet Home
// Alabama's lessons.
//
// The original rule still governs everything the catalogue does not cover: a
// phrase matching no title is shown exactly as the tutor said it, never
// corrected and never merged. Correctness for those is a catalogue-coverage
// question, not an algorithm one — the fix is to catalogue the song.

import { SONGS_CATALOGUE } from '../config/songs-catalogue.mjs';
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
// Once spellings are merged the tempo must come from the newest note mentioning
// *any* of them — otherwise a "now at 100%" written against one spelling is
// lost because the label came from another.
function latestTempoForAny(phrases = [], notesNewestFirst = []) {
  for (const note of notesNewestFirst) {
    for (const sentence of sentencesOf(noteBodyText(note))) {
      const haystack = wordsOf(sentence).join(' ');
      if (!phrases.some((phrase) => haystack.includes(phrase))) continue;
      const values = extractTempoPercentages(sentence);
      if (values.length) return values[values.length - 1];
    }
  }
  return null;
}

// --- Identifying one song written several ways -------------------------------

// Words that carry no identifying weight inside a title, so "The Man Who Sold
// the World" and "Man Who Sold" can be compared on what actually distinguishes
// them.
const TITLE_NOISE = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'is', 'it', 'by', 'me', 'my']);

function titleTokens(value = '') {
  return wordsOf(value).filter((word) => !TITLE_NOISE.has(word));
}

function editDistance(a = '', b = '') {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

// A mis-heard word, not a different one: "sold" -> "solved", "close" ->
// "closer".
//
// The shared opening is what does the work. Two edits alone is far too generous
// on short words — it let "sitting" match "getting", which pulled a Taylor
// Swift title into a student's Dock of the Bay. Mishearings overwhelmingly keep
// the start of the word, so requiring the first three letters to agree admits
// the real ASR slips and almost nothing else.
function sameWordHeardDifferently(a = '', b = '') {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  if (Math.abs(a.length - b.length) > 2) return false;
  if (a.slice(0, 3) !== b.slice(0, 3)) return false;
  return editDistance(a, b) <= 2;
}

const CATALOGUE_TITLES = Object.entries(SONGS_CATALOGUE).map(([songId, song]) => ({
  songId,
  title: song?.title || '',
  tokens: titleTokens(song?.title || ''),
})).filter((entry) => entry.tokens.length);

// The catalogue song a phrase names, or null when it names none unambiguously.
//
// Deliberately strict in two ways.
//
// *Every* distinctive word of the phrase must appear in the title. A phrase is
// a fragment of a title, so extra words in the title are expected ("man who
// sold" against The Man Who Sold the World) while an extra word in the phrase
// means it is something else. That asymmetry keeps Sweet Home Chicago and
// Sweet Home Alabama apart: "chicago" appears nowhere in the other title.
//
// And the match must be unique. "Riff Exercise", "Grade 1 Riff Exercise" and
// "Grade 3 Riff Exercise" are all in the catalogue, so "riff exercise"
// identifies none of them — naming it after whichever fit tightest would put a
// bass grade 3 title on a guitar student's card. Several entries sharing one
// title (the same song catalogued per instrument) is not ambiguity, because the
// name is what gets displayed.
function catalogueMatchesFor(phrase = '') {
  const tokens = titleTokens(phrase);
  // One distinctive word is not enough evidence: "world" alone would claim any
  // title containing it.
  if (tokens.length < 2) return [];

  const matches = CATALOGUE_TITLES.filter((entry) => tokens.every((token) => (
    entry.tokens.some((titleToken) => sameWordHeardDifferently(token, titleToken))
  )));

  // Several entries sharing one title (the same song catalogued per instrument)
  // is not ambiguity, because the name is what gets displayed.
  const byTitle = new Map();
  for (const entry of matches) {
    const key = entry.title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, { songId: entry.songId, title: entry.title });
  }
  return [...byTitle.values()];
}

// Fold piece candidates that name the same catalogue song into one entry.
// Unmatched candidates are never folded — grouping requires positive evidence.
function mergePiecesBySong(candidates = [], notesNewestFirst = []) {
  const groups = [];
  const bySong = new Map();

  const place = (candidate, match) => {
    // Keyed by title, not id: the same song catalogued for two instruments must
    // still collapse to one entry.
    const key = match.title.toLowerCase();
    if (!bySong.has(key)) {
      const group = { songId: match.songId, title: match.title, members: [] };
      bySong.set(key, group);
      groups.push(group);
    }
    bySong.get(key).members.push(candidate);
  };

  // First the phrases that name exactly one song. These establish which songs
  // this student is actually working on.
  const ambiguous = [];
  for (const candidate of candidates) {
    const matches = catalogueMatchesFor(candidate.phrase);
    if (matches.length === 1) place(candidate, matches[0]);
    else if (matches.length > 1) ambiguous.push({ candidate, matches });
    else groups.push({ songId: '', title: '', members: [candidate] });
  }

  // Then the fragments that name several. "man who solved" fits both The Man
  // Who Sold the World and The Man Who Can't Be Moved, so it identifies neither
  // on its own — but if this student's other notes already name one of them, it
  // is that one. Evidence from the same student, not a guess.
  for (const { candidate, matches } of ambiguous) {
    const established = matches.filter((match) => bySong.has(match.title.toLowerCase()));
    if (established.length === 1) place(candidate, established[0]);
    else groups.push({ songId: '', title: '', members: [candidate] });
  }

  return groups.map(({ songId, title, members }) => {
    // The count is the number of distinct lessons the song appeared in. Adding
    // the per-spelling counts would double-count a lesson whose note happened
    // to spell the title two ways.
    const dates = [...new Set(members.flatMap((entry) => entry.dates))].sort();
    // Longest wording wins among the tutor's own spellings. Only used when the
    // catalogue has nothing to say.
    const best = [...members].sort((a, b) => (
      titleTokens(b.phrase).length - titleTokens(a.phrase).length
      || b.label.length - a.label.length
    ))[0];
    // A matched song is named by the catalogue. The tutor's wording is what the
    // ASR heard, and showing "Who Sold the World" to the person teaching the
    // song is showing them the mistake rather than the piece.
    const catalogueTitle = title;
    const group = members;
    const phrases = group.map((entry) => entry.phrase);
    return {
      label: catalogueTitle || best.label,
      // Whether the name is a curated title or a transcription, so a consumer
      // can tell a known song from something only ever heard once.
      songId,
      dates,
      phrase: best.phrase,
      phrases,
      lessonCount: dates.length,
      firstDate: dates[0] || '',
      lastDate: dates[dates.length - 1] || '',
      latestTempo: latestTempoForAny(phrases, notesNewestFirst),
    };
  }).sort((a, b) => b.lessonCount - a.lessonCount || b.label.length - a.label.length);
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
  const candidates = [];
  const themes = [];
  for (const [phrase, count] of recurring.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)) {
    const dates = perLesson.filter((lesson) => lesson.grams.has(phrase)).map((lesson) => lesson.date);
    const label = titleCasedLabel(phrase, fullText);
    if (label) {
      candidates.push({ label, phrase, dates });
    } else {
      themes.push({ phrase, lessonCount: count });
    }
  }

  const pieces = mergePiecesBySong(candidates, newestFirst);

  // A piece usually also recurs as a lowercase fragment; drop themes that are
  // contained in a piece phrase. Every merged spelling counts, or a theme
  // matching the spelling that lost the label would survive as a duplicate.
  const filteredThemes = themes.filter(({ phrase }) => (
    !pieces.some((piece) => piece.phrases.some((piecePhrase) => (
      piecePhrase.includes(phrase) || phrase.includes(piecePhrase)
    )))
  ));

  return {
    pieces: pieces.slice(0, maxPieces),
    themes: filteredThemes.slice(0, maxThemes),
  };
}

// --- Confirmed song links -----------------------------------------------------

// What the tutor actually selected in Practice Chat, keyed by song. These are
// validated catalogue ids, so they are evidence rather than inference — the
// difference the `songIdSource` field exists to record.
function confirmedSongEvidence(notes = []) {
  const bySong = new Map();
  for (const note of (Array.isArray(notes) ? notes : [])) {
    const date = note.lessonDate || note.emailSentAt || note.completedAt || note.createdAt || '';
    const songIds = Array.isArray(note.songIds) ? note.songIds : [];
    const songTitles = Array.isArray(note.songTitles) ? note.songTitles : [];
    songIds.forEach((songId, index) => {
      if (!songId) return;
      if (!bySong.has(songId)) {
        bySong.set(songId, {
          // Catalogue first. The title stored on the note is the fallback for a
          // song that has since been renamed or removed.
          title: SONGS_CATALOGUE[songId]?.title || songTitles[index] || '',
          dates: new Set(),
        });
      }
      if (date) bySong.get(songId).dates.add(date);
    });
  }
  return bySong;
}

const SOURCE_RANK = { confirmed: 0, inferred: 1, '': 2 };

/**
 * Fold tutor-confirmed song links into the mined pieces.
 *
 * Confirmed links are exact and mined phrases are not, so where both describe
 * the same song the identity is recorded as confirmed. The lesson count stays
 * the union of both: a song confirmed once and mined across five lessons has
 * still been in flight for five, and dropping to "1 lesson" as tutors adopt the
 * selector would read as a regression rather than as better data. What the
 * count is made of is kept visible in `confirmedLessonCount`.
 *
 * A confirmed song nothing mentioned by name still appears — that is the whole
 * point of capturing the link.
 */
function withConfirmedSongs(pieces = [], notes = [], { maxPieces = 4 } = {}) {
  const confirmed = confirmedSongEvidence(notes);
  const claimed = new Set();

  const merged = pieces.map((piece) => {
    const evidence = piece.songId ? confirmed.get(piece.songId) : null;
    if (!evidence) {
      return { ...piece, songIdSource: piece.songId ? 'inferred' : '', confirmedLessonCount: 0 };
    }
    claimed.add(piece.songId);
    const dates = [...new Set([...(piece.dates || []), ...evidence.dates])].sort();
    return {
      ...piece,
      label: evidence.title || piece.label,
      songIdSource: 'confirmed',
      dates,
      lessonCount: dates.length,
      firstDate: dates[0] || '',
      lastDate: dates[dates.length - 1] || '',
      confirmedLessonCount: evidence.dates.size,
    };
  });

  for (const [songId, evidence] of confirmed) {
    if (claimed.has(songId) || !evidence.title) continue;
    const dates = [...evidence.dates].sort();
    merged.push({
      label: evidence.title,
      songId,
      songIdSource: 'confirmed',
      dates,
      phrase: '',
      phrases: [],
      lessonCount: dates.length,
      firstDate: dates[0] || '',
      lastDate: dates[dates.length - 1] || '',
      latestTempo: null,
      confirmedLessonCount: dates.length,
    });
  }

  return merged
    .sort((a, b) => (
      b.lessonCount - a.lessonCount
      || SOURCE_RANK[a.songIdSource] - SOURCE_RANK[b.songIdSource]
      || b.label.length - a.label.length
    ))
    .slice(0, maxPieces);
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
    // Mined wider than the four that get shown, so a piece that would have been
    // cut can still merge with its confirmed link before the list is capped.
    ...(() => {
      const { pieces, themes } = extractRecurringThemes(notes, { maxPieces: 8 });
      return { pieces: withConfirmedSongs(pieces, notes, { maxPieces: 4 }), themes };
    })(),
  };
}
