// Turns a student's practice-note log into a chronological progression view for
// tutors: "pick up where you left off". Pure and read-only — it consumes the
// already-normalised rows from getPracticeNoteLogRows (which now derive the
// structured what_we_did / progress / goals fields from raw text, so Level 2
// notes are included). It only surfaces signals we can extract reliably:
// chronology, the most recent lesson's goals, and the school's tempo-percentage
// convention ("sitting at 70%, now 100%"). It does not attempt to guess piece
// names from ASR-corrupted text.

function noteTimeValue(note = {}) {
  const candidates = [note.lessonDate, note.emailSentAt, note.completedAt, note.createdAt];
  for (const candidate of candidates) {
    const time = new Date(candidate || '').getTime();
    if (Number.isFinite(time)) return time;
  }
  return null;
}

function hasContent(note = {}) {
  return Boolean(
    `${note.whatWeDid || ''}`.trim()
    || `${note.progressChallenges || ''}`.trim()
    || `${note.practiceGoals || ''}`.trim()
    || `${note.rawNoteText || ''}`.trim(),
  );
}

// The school logs practice tempo as a percentage of target ("Cissy Strut was at
// 90 today", "now it's at 100"). We only trust an explicit percent sign to keep
// this signal clean; bare numbers ("bar 29", "Grade 6") are too ambiguous.
export function extractTempoPercentages(text = '') {
  const values = [];
  const regex = /(\d{1,3})\s*%/g;
  let match = regex.exec(`${text || ''}`);
  while (match) {
    const value = Number(match[1]);
    if (value >= 1 && value <= 200) values.push(value);
    match = regex.exec(`${text || ''}`);
  }
  return values;
}

function buildTimelineEntry(note = {}) {
  const combined = [note.whatWeDid, note.progressChallenges, note.practiceGoals]
    .map((value) => `${value || ''}`.trim())
    .filter(Boolean)
    .join('\n');
  const tempoValues = extractTempoPercentages(combined || note.rawNoteText || '');

  return {
    noteId: note.noteId || '',
    date: note.lessonDate || note.emailSentAt || note.completedAt || note.createdAt || '',
    tutorName: note.tutorName || '',
    whatWeDid: `${note.whatWeDid || ''}`.trim(),
    progressChallenges: `${note.progressChallenges || ''}`.trim(),
    practiceGoals: `${note.practiceGoals || ''}`.trim(),
    tempoValues,
    attendance: note.mmsAttendanceStatus || '',
    delivered: note.emailSendStatus === 'sent' || Boolean(note.gmailMessageId),
    source: note.source || '',
  };
}

// Accepts the normalised rows from getPracticeNoteLogRows (any order) and
// returns a chronological timeline plus the quick-glance fields a tutor wants
// before the next lesson. `entries` run oldest -> newest.
export function buildStudentPracticeTimeline(notes = []) {
  const withContent = (Array.isArray(notes) ? notes : []).filter(hasContent);
  const chronological = withContent
    .map((note) => ({ note, time: noteTimeValue(note) }))
    .sort((a, b) => {
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time - b.time;
    })
    .map(({ note }) => buildTimelineEntry(note));

  const latest = chronological[chronological.length - 1] || null;
  const tempoTrend = chronological
    .filter((entry) => entry.tempoValues.length)
    .map((entry) => ({ date: entry.date, value: Math.max(...entry.tempoValues) }));

  return {
    studentMmsId: withContent[0]?.studentMmsId || '',
    studentName: withContent.find((note) => note.studentName)?.studentName || '',
    noteCount: chronological.length,
    latestTutor: latest?.tutorName || '',
    lastLessonDate: latest?.date || '',
    // The single most useful thing for the next lesson: what the student was
    // asked to practise last time.
    nextLessonFocus: latest?.practiceGoals || '',
    tempoTrend,
    entries: chronological,
  };
}
