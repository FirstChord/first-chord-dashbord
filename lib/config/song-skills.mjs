// What a song teaches, as opposed to what a song is.
//
// The catalogue already carried this. Sixty-eight distinct tags across two
// hundred and thirty songs, and roughly two thirds of them describe a skill
// rather than a category — strumming, legato, syncopation, note reading,
// hands together. Nobody had separated the teaching vocabulary from the filing
// vocabulary, so none of it could be used.
//
// This file does that separation, and it does it as a *mapping* rather than as
// a migration. No catalogue entry has to change: skills are derived from the
// tags a song already has. A song can still declare `skills` explicitly when
// the tags are wrong or missing, and that always wins.
//
// Why it matters beyond tidiness: a song is a vehicle, but the thing that
// transfers between songs is the skill. "This student has met syncopation four
// times and struggled each time" is unanswerable while the unit of knowledge is
// the song. Every difficulty-rating or sequencing idea downstream needs this
// layer to exist first.

// Broad areas, so a card can group skills instead of listing fifteen chips.
export const SKILL_AREAS = {
  technique: 'Technique',
  rhythm: 'Rhythm',
  harmony: 'Harmony',
  reading: 'Reading',
  expression: 'Expression',
};

export const SONG_SKILLS = {
  // --- technique ---
  open_chords: { label: 'Open chords', area: 'technique' },
  barre_chords: { label: 'Barre chords', area: 'technique' },
  chord_changes: { label: 'Chord changes', area: 'technique' },
  strumming: { label: 'Strumming', area: 'technique' },
  fingerpicking: { label: 'Fingerpicking', area: 'technique' },
  arpeggios: { label: 'Arpeggios', area: 'technique' },
  muting: { label: 'Muting', area: 'technique' },
  single_notes: { label: 'Single-note playing', area: 'technique' },
  scales: { label: 'Scales', area: 'technique' },
  hand_position: { label: 'Hand position', area: 'technique' },
  hands_together: { label: 'Hands together', area: 'technique' },
  position_shifts: { label: 'Position shifts', area: 'technique' },
  capo: { label: 'Capo', area: 'technique' },
  evenness: { label: 'Evenness', area: 'technique' },

  // --- rhythm ---
  steady_pulse: { label: 'Steady pulse', area: 'rhythm' },
  syncopation: { label: 'Syncopation', area: 'rhythm' },
  swing_feel: { label: 'Swing feel', area: 'rhythm' },
  groove: { label: 'Groove', area: 'rhythm' },
  compound_time: { label: 'Compound time', area: 'rhythm' },
  waltz_time: { label: 'Waltz time', area: 'rhythm' },
  eighth_notes: { label: 'Eighth notes', area: 'rhythm' },

  // --- harmony ---
  minor_tonality: { label: 'Minor tonality', area: 'harmony' },
  chord_progressions: { label: 'Chord progressions', area: 'harmony' },
  chord_melody: { label: 'Chord melody', area: 'harmony' },

  // --- reading ---
  note_reading: { label: 'Note reading', area: 'reading' },
  bass_clef: { label: 'Bass clef', area: 'reading' },
  intervals: { label: 'Intervals', area: 'reading' },
  playing_by_ear: { label: 'Playing by ear', area: 'reading' },

  // --- expression ---
  dynamics: { label: 'Dynamics', area: 'expression' },
  phrasing: { label: 'Phrasing', area: 'expression' },
  legato: { label: 'Legato', area: 'expression' },
  staccato: { label: 'Staccato', area: 'expression' },
  tone: { label: 'Tone', area: 'expression' },
};

// Existing catalogue tag -> the skills it implies. A tag may imply more than
// one ("muted strumming" is both), which is why every value is a list.
export const TAG_SKILLS = {
  'open chords': ['open_chords'],
  'barre chords': ['barre_chords'],
  'chord changes': ['chord_changes'],
  chords: ['chord_changes'],
  'jazz chords': ['chord_changes', 'chord_progressions'],
  'minor chords': ['minor_tonality', 'chord_changes'],
  'classic progression': ['chord_progressions'],
  'chord melody': ['chord_melody'],
  strumming: ['strumming'],
  'muted strumming': ['strumming', 'muting'],
  muting: ['muting'],
  fingerpicking: ['fingerpicking'],
  'travis picking': ['fingerpicking'],
  'picking pattern': ['fingerpicking'],
  arpeggios: ['arpeggios'],
  arpeggio: ['arpeggios'],
  'broken chords': ['arpeggios'],
  'single notes': ['single_notes'],
  'riff-based': ['single_notes'],
  scales: ['scales'],
  'five-finger position': ['hand_position'],
  'left hand': ['hand_position'],
  'right hand': ['hand_position'],
  'hand position shifts': ['position_shifts'],
  leaps: ['position_shifts'],
  'hands together': ['hands_together'],
  'hands alternating': ['hands_together'],
  capo: ['capo'],
  evenness: ['evenness'],
  'repeated notes': ['evenness'],

  rhythm: ['steady_pulse'],
  'steady pulse': ['steady_pulse'],
  'steady rhythm': ['steady_pulse'],
  syncopation: ['syncopation'],
  'swing feel': ['swing_feel'],
  shuffle: ['swing_feel'],
  groove: ['groove'],
  'funk groove': ['groove'],
  'reggae feel': ['groove'],
  'compound time': ['compound_time'],
  'theory: 6/8 time': ['compound_time'],
  'waltz time': ['waltz_time'],
  'theory: eighth notes': ['eighth_notes'],

  'note reading': ['note_reading'],
  'bass clef': ['bass_clef'],
  intervals: ['intervals'],
  'by ear': ['playing_by_ear'],
  imitation: ['playing_by_ear'],

  dynamics: ['dynamics'],
  phrasing: ['phrasing'],
  'blues phrasing': ['phrasing'],
  legato: ['legato'],
  staccato: ['staccato'],
  tone: ['tone'],
};

// Tags that are filing, not teaching: what a song *is*, where it came from, or
// what it sounds like. Kept explicit so the coverage report can tell "this tag
// is deliberately not a skill" apart from "nobody has classified this yet".
export const NON_SKILL_TAGS = new Set([
  'technical',
  'technique',
  'exam piece',
  '2025 syllabus',
  'RSL 2018 book',
  'RSL legacy book',
  'classical',
  'pop',
  'rock',
  'blues',
  'ballad',
  'singalong',
  'storytelling song',
  'solo',
]);
