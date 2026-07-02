export const INCOMING_MESSAGE_STATUSES = ['inbox', 'converted', 'ignored', 'needs_review'];
export const INCOMING_MESSAGE_CATEGORIES = [
  'one_off_absence',
  'extended_absence',
  'summer_break',
  'absence_pause',
  'leaving',
  'payment',
  'schedule',
  'concern',
  'general',
];

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

function collapse(value = '') {
  return clean(value).replace(/\s+/gu, ' ');
}

function normaliseText(value = '') {
  return collapse(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^\p{Letter}\p{Number}\s+]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function firstName(value = '', fallback = 'there') {
  const first = clean(value).split(/\s+/u)[0];
  return first || fallback;
}

export function normalisePhone(value = '') {
  const digits = clean(value).replace(/[^\d+]/gu, '');
  if (!digits) return '';
  if (digits.startsWith('+44')) return `0${digits.slice(3)}`;
  if (digits.startsWith('44') && digits.length > 10) return `0${digits.slice(2)}`;
  return digits.replace(/^\+/, '');
}

function phoneComparable(value = '') {
  const phone = normalisePhone(value).replace(/\D/gu, '');
  return phone.length >= 9 ? phone.slice(-9) : phone;
}

function normaliseEnum(value, allowed, fallback) {
  const candidate = clean(value).toLowerCase();
  return allowed.includes(candidate) ? candidate : fallback;
}

export function buildIncomingMessageId({ source = '', externalMessageId = '', messageText = '', messageAt = '', senderPhone = '' } = {}) {
  const stable = [
    normaliseText(source) || 'manual',
    clean(externalMessageId) || '',
    clean(messageAt) || '',
    normalisePhone(senderPhone) || '',
    collapse(messageText).slice(0, 280),
  ].join('::');
  let hash = 0x811c9dc5;
  for (let index = 0; index < stable.length; index += 1) {
    hash ^= stable.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `incoming_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function normaliseIncomingMessagePayload(payload = {}, { now = new Date() } = {}) {
  const source = clean(payload.source || payload.Source || 'manual_paste') || 'manual_paste';
  const messageText = collapse(payload.messageText || payload.message_text || payload.body || payload.text || payload.Message || '');
  const externalMessageId = clean(payload.externalMessageId || payload.external_message_id || payload.messageId || payload.message_id || '');
  const capturedAt = clean(payload.capturedAt || payload.captured_at) || now.toISOString();

  return {
    incomingId: clean(payload.incomingId || payload.incoming_id) || buildIncomingMessageId({
      source,
      externalMessageId,
      messageText,
      messageAt: payload.messageAt || payload.message_at || payload.timestamp || '',
      senderPhone: payload.senderPhone || payload.sender_phone || '',
    }),
    source,
    externalMessageId,
    capturedAt,
    messageAt: clean(payload.messageAt || payload.message_at || payload.timestamp || ''),
    chatId: clean(payload.chatId || payload.chat_id || ''),
    chatName: clean(payload.chatName || payload.chat_name || ''),
    senderName: clean(payload.senderName || payload.sender_name || payload.fromName || ''),
    senderPhone: clean(payload.senderPhone || payload.sender_phone || payload.from || ''),
    messageText,
    capturedBy: clean(payload.capturedBy || payload.captured_by || ''),
    status: normaliseEnum(payload.status, INCOMING_MESSAGE_STATUSES, 'inbox'),
    reviewNote: clean(payload.reviewNote || payload.review_note || ''),
    createdPlanningId: clean(payload.createdPlanningId || payload.created_planning_id || ''),
    rawJson: clean(payload.rawJson || payload.raw_json || ''),
  };
}

export function classifyIncomingMessage(messageText = '') {
  const text = normaliseText(messageText);
  const hasAny = (terms) => terms.some((term) => text.includes(term));
  const hasRegex = (pattern) => pattern.test(text);

  const summerTerms = [
    'summer',
    'summer holiday',
    'school holiday',
    'schools are off',
    'schools off',
    'schools return',
    'schools go back',
    'back to school',
    'after the holidays',
  ];
  if (
    hasAny(summerTerms)
    || (
      hasAny(['camp', 'holiday', 'away'])
      && hasAny(['july', 'august', 'school', 'return', 'back'])
    )
    || (
      hasAny(['last lesson', 'last lessons'])
      && hasAny(['july', 'august', 'summer', 'holiday', 'camp', 'school', 'return', 'back'])
    )
  ) {
    return { category: 'summer_break', reasons: ['Message sounds like a summer/holiday break rather than lessons ending'] };
  }

  const leavingTerms = [
    'leaving lessons',
    'stop lessons',
    'ending lessons',
    'end lessons',
    'cancel subscription',
    'cancel payments',
    'last lesson',
  ];
  if (hasAny(leavingTerms)) {
    return { category: 'leaving', reasons: ['Message sounds like lessons may be ending'] };
  }

  const extendedTerms = [
    'pause',
    'holiday',
    'away for',
    'going away',
    'returning',
    'back on',
    'back from',
    'for two weeks',
    'for 2 weeks',
    'for three weeks',
    'for 3 weeks',
  ];
  if (hasAny(extendedTerms) || hasRegex(/\bfor\s+\d+\s+(week|weeks|month|months)\b/u)) {
    return { category: 'extended_absence', reasons: ['Message may describe a multi-lesson absence or pause period'] };
  }

  const oneOffTerms = [
    'cant make',
    'can t make',
    'cannot make',
    'can not make',
    'miss lesson',
    'missed lesson',
    'missing lesson',
    'absent',
    'not able to make',
    'unable to make',
    'off sick',
    'sick',
    'ill',
    'cancel lesson',
    'cancelled lesson',
  ];
  if (hasAny(oneOffTerms)) {
    return { category: 'one_off_absence', reasons: ['Message sounds like a one-off missed lesson'] };
  }

  const absenceTerms = [
    'pause',
    'away',
    'holiday',
    'cant make',
    'can t make',
    'cannot make',
    'can not make',
    'miss lesson',
    'missed lesson',
    'missing lesson',
    'absent',
    'not able to make',
    'unable to make',
    'off sick',
    'sick',
    'ill',
    'cancel lesson',
    'cancelled lesson',
  ];
  if (hasAny(absenceTerms)) {
    return { category: 'absence_pause', reasons: ['Message may affect attendance, pause, or lesson cover'] };
  }

  const paymentTerms = ['payment', 'stripe', 'bank', 'paid', 'charge', 'charged', 'failed payment', 'direct debit'];
  if (hasAny(paymentTerms)) {
    return { category: 'payment', reasons: ['Message mentions payment or billing'] };
  }

  const scheduleTerms = ['change time', 'change slot', 'move lesson', 'different time', 'reschedule', 'new slot', 'swap'];
  if (hasAny(scheduleTerms)) {
    return { category: 'schedule', reasons: ['Message mentions lesson timing or slot changes'] };
  }

  const concernTerms = ['worried', 'concern', 'unhappy', 'struggling', 'upset', 'complaint', 'confused'];
  if (hasAny(concernTerms)) {
    return { category: 'concern', reasons: ['Message may contain a parent/student concern'] };
  }

  return { category: 'general', reasons: [] };
}

function studentSearchFields(student = {}) {
  return [
    student.fullName,
    student.firstName,
    student.lastName,
    `${student.parentFirstName || ''} ${student.parentLastName || ''}`,
    student.contactNumber,
    student.email,
  ].filter(Boolean);
}

export function matchIncomingMessageToStudent(message = {}, students = [], { groupMapRows = [] } = {}) {
  const confirmedGroup = groupMapRows.find((row) => (
    row.chatId
    && row.chatId === message.chatId
    && row.status === 'confirmed'
    && row.matchedMmsId
  ));
  if (confirmedGroup) {
    const groupStudentIds = [
      confirmedGroup.matchedMmsId,
      ...`${confirmedGroup.additionalMmsIds || ''}`.split(',').map((id) => id.trim()),
    ].filter(Boolean);
    const uniqueGroupStudentIds = [...new Set(groupStudentIds)];

    // Single-student group: the confirmed map is the answer.
    if (uniqueGroupStudentIds.length <= 1) {
      return {
        matchedMmsId: confirmedGroup.matchedMmsId || '',
        matchedStudentName: confirmedGroup.matchedStudentName || '',
        matchConfidence: 'high',
        matchReasons: 'confirmed WhatsApp group map matches this student',
        score: 0.98,
      };
    }

    // Shared (sibling) group: pick the student the message actually names.
    const nameHaystack = normaliseText([message.messageText, message.senderName].filter(Boolean).join(' '));
    const nameTokens = new Set(nameHaystack.split(' ').filter(Boolean));
    const groupStudents = uniqueGroupStudentIds
      .map((id) => students.find((entry) => entry.mmsId === id))
      .filter(Boolean);
    const named = groupStudents.filter((entry) => {
      const full = normaliseText(entry.fullName || '');
      const first = normaliseText(entry.firstName || '');
      return (full && nameHaystack.includes(full)) || (first && nameTokens.has(first));
    });

    if (named.length === 1) {
      return {
        matchedMmsId: named[0].mmsId || '',
        matchedStudentName: named[0].fullName || '',
        matchConfidence: 'high',
        matchReasons: 'named student in a shared WhatsApp group',
        score: 0.95,
      };
    }

    // Ambiguous: don't guess which sibling — flag for manual review.
    const names = groupStudents.map((entry) => entry.fullName).filter(Boolean).join(', ');
    return {
      matchedMmsId: '',
      matchedStudentName: '',
      matchConfidence: 'none',
      matchReasons: `shared WhatsApp group with ${groupStudents.length} students (${names}) — no student named in the message, needs manual review`,
      score: 0,
    };
  }

  const senderPhone = phoneComparable(message.senderPhone);
  const haystack = normaliseText([
    message.messageText,
    message.senderName,
    message.chatName,
    message.senderPhone,
  ].filter(Boolean).join(' '));
  const firstNameCounts = new Map();

  for (const student of students) {
    const first = normaliseText(student.firstName || '');
    if (first) firstNameCounts.set(first, (firstNameCounts.get(first) || 0) + 1);
  }

  const candidates = [];
  for (const student of students) {
    const reasons = [];
    let score = 0;
    const studentPhone = phoneComparable(student.contactNumber);
    if (senderPhone && studentPhone && senderPhone === studentPhone) {
      score = Math.max(score, 0.95);
      reasons.push('sender phone matches student contact number');
    }

    const fullName = normaliseText(student.fullName || '');
    if (fullName && haystack.includes(fullName)) {
      score = Math.max(score, 0.9);
      reasons.push('message includes full student name');
    }

    const firstName = normaliseText(student.firstName || '');
    const lastName = normaliseText(student.lastName || '');
    if (firstName && lastName && haystack.includes(firstName) && haystack.includes(lastName)) {
      score = Math.max(score, 0.78);
      reasons.push('message includes student first and last name');
    }

    if (firstName && firstNameCounts.get(firstName) === 1 && haystack.includes(firstName)) {
      score = Math.max(score, 0.52);
      reasons.push('message includes a unique student first name');
    }

    const parentName = normaliseText(`${student.parentFirstName || ''} ${student.parentLastName || ''}`);
    if (parentName && haystack.includes(parentName)) {
      score = Math.max(score, 0.64);
      reasons.push('message includes parent name from Students sheet');
    }

    if (score > 0) {
      candidates.push({
        student,
        score,
        reasons,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) {
    return {
      matchedMmsId: '',
      matchedStudentName: '',
      matchConfidence: 'none',
      matchReasons: '',
      score: 0,
    };
  }

  const matchConfidence = best.score >= 0.85 ? 'high' : best.score >= 0.6 ? 'medium' : 'low';
  return {
    matchedMmsId: best.student.mmsId || '',
    matchedStudentName: best.student.fullName || '',
    matchConfidence,
    matchReasons: best.reasons.join(' | '),
    score: best.score,
  };
}

export function buildIncomingMessageRecord(payload = {}, { students = [], groupMapRows = [], now = new Date() } = {}) {
  const message = normaliseIncomingMessagePayload(payload, { now });
  const classification = classifyIncomingMessage(message.messageText);
  const match = matchIncomingMessageToStudent(message, students, { groupMapRows });

  return {
    ...message,
    suspectedCategory: classification.category,
    matchedMmsId: match.matchedMmsId,
    matchedStudentName: match.matchedStudentName,
    matchConfidence: match.matchConfidence,
    matchReasons: [...classification.reasons, match.matchReasons].filter(Boolean).join(' | '),
    rawJson: message.rawJson || JSON.stringify(payload || {}),
  };
}

export function isWhatsappGroupChatId(chatId = '') {
  return clean(chatId).endsWith('@g.us');
}

export function buildWhatsappGroupMapRecord(record = {}, existing = {}) {
  if (!isWhatsappGroupChatId(record.chatId)) return null;

  const now = new Date().toISOString();
  const lastSeenAt = record.capturedAt || now;
  return {
    chatId: record.chatId || existing.chatId || '',
    chatName: record.chatName || existing.chatName || '',
    firstSeenAt: existing.firstSeenAt || lastSeenAt,
    lastSeenAt,
    lastIncomingId: record.incomingId || existing.lastIncomingId || '',
    lastMessageAt: record.messageAt || existing.lastMessageAt || '',
    lastSenderName: record.senderName || existing.lastSenderName || '',
    lastSenderPhone: record.senderPhone || existing.lastSenderPhone || '',
    matchedMmsId: record.matchedMmsId || existing.matchedMmsId || '',
    matchedFcId: record.matchedFcId || existing.matchedFcId || '',
    matchedStudentName: record.matchedStudentName || existing.matchedStudentName || '',
    additionalMmsIds: record.additionalMmsIds ?? existing.additionalMmsIds ?? '',
    parentName: record.parentName || existing.parentName || '',
    parentPhone: record.parentPhone || existing.parentPhone || '',
    tutorName: record.tutorName || existing.tutorName || '',
    instrument: record.instrument || existing.instrument || '',
    matchConfidence: record.matchConfidence || existing.matchConfidence || '',
    matchReasons: record.matchReasons || existing.matchReasons || '',
    status: record.groupMapStatus || existing.status || 'review',
    confirmedBy: record.confirmedBy || existing.confirmedBy || '',
    confirmedAt: record.confirmedAt || existing.confirmedAt || '',
    notes: existing.notes || '',
    rawJson: record.rawJson || existing.rawJson || '',
  };
}

// Instrument keywords used to recognise a First Chord group by its title.
// Every FC group title contains an instrument; personal groups don't. The
// roster's own instruments are unioned in at call time so new instruments are
// picked up automatically.
export const FIRST_CHORD_INSTRUMENT_KEYWORDS = [
  'guitar', 'piano', 'keyboard', 'keys', 'voice', 'vocal', 'vocals', 'singing', 'sing',
  'ukulele', 'uke', 'bass', 'drums', 'drum', 'violin', 'viola', 'cello', 'sax',
  'saxophone', 'flute', 'clarinet', 'trumpet', 'theory', 'mandolin', 'banjo',
];

export function detectInstrumentInName(name = '', extraInstruments = []) {
  const tokens = new Set(normaliseText(name).split(' ').filter(Boolean));
  if (!tokens.size) return '';

  const keywords = new Set(FIRST_CHORD_INSTRUMENT_KEYWORDS);
  for (const instrument of extraInstruments) {
    for (const token of normaliseText(instrument).split(' ')) {
      if (token.length >= 3) keywords.add(token);
    }
  }

  for (const keyword of keywords) {
    if (tokens.has(keyword)) return keyword;
  }
  return '';
}

// Matches a whole WhatsApp group to a student using participant phone numbers
// (deterministic, strongest) and the student name in the group title.
export function matchGroupToStudent({ chatName = '', participantPhones = [] } = {}, students = []) {
  const comparablePhones = new Set(
    (participantPhones || [])
      .map((phone) => phoneComparable(phone))
      .filter((phone) => phone.length >= 9),
  );
  const haystack = normaliseText(chatName);

  const firstNameCounts = new Map();
  for (const student of students) {
    const first = normaliseText(student.firstName || '');
    if (first) firstNameCounts.set(first, (firstNameCounts.get(first) || 0) + 1);
  }

  const titleTokens = haystack.split(' ').filter(Boolean);
  const candidates = [];
  for (const student of students) {
    const reasons = [];
    let score = 0;

    const studentPhone = phoneComparable(student.contactNumber);
    if (studentPhone && comparablePhones.has(studentPhone)) {
      score = Math.max(score, 0.95);
      reasons.push('a group member’s number matches this student’s contact number');
    }

    const fullName = normaliseText(student.fullName || '');
    if (fullName && haystack.includes(fullName)) {
      score = Math.max(score, 0.9);
      reasons.push('group name includes the full student name');
    }

    const firstName = normaliseText(student.firstName || '');
    const lastName = normaliseText(student.lastName || '');
    if (firstName && lastName && haystack.includes(firstName) && haystack.includes(lastName)) {
      score = Math.max(score, 0.78);
      reasons.push('group name includes student first and last name');
    }

    // FC group titles are "{First name} {Instrument} Lessons" — first name plus
    // the student's own instrument disambiguates same-name students (e.g. two
    // Alexes on different instruments) even with no matchable phone.
    const firstInTitle = firstName && titleTokens.includes(firstName);
    const instrumentTokens = normaliseText(student.instrument || '').split(' ').filter((token) => token.length >= 3);
    const instrumentInTitle = instrumentTokens.some((token) => titleTokens.includes(token));
    if (firstInTitle && instrumentInTitle) {
      const uniqueFirst = firstNameCounts.get(firstName) === 1;
      score = Math.max(score, uniqueFirst ? 0.9 : 0.7);
      reasons.push(uniqueFirst
        ? 'group name matches student first name and instrument'
        : 'group name matches a shared first name and instrument — confirm');
    }

    if (firstInTitle && firstNameCounts.get(firstName) === 1) {
      score = Math.max(score, 0.55);
      reasons.push('group name includes a unique student first name');
    }

    if (score > 0) candidates.push({ student, score, reasons });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) {
    return { matchedMmsId: '', matchedStudentName: '', matchConfidence: 'none', matchReasons: '', score: 0 };
  }

  return {
    matchedMmsId: best.student.mmsId || '',
    matchedStudentName: best.student.fullName || '',
    matchConfidence: best.score >= 0.85 ? 'high' : best.score >= 0.6 ? 'medium' : 'low',
    matchReasons: best.reasons.join(' | '),
    score: best.score,
  };
}

// Turns a raw bridge group dump into the set of First Chord groups worth
// importing: title must contain an instrument, and the group must have been
// active within the window (default 6 months). Unknown last-active is kept
// (fail-open) so a groups-only sync never silently drops a live group.
export function buildGroupSyncPlan({ groups = [], students = [], now = new Date(), activeWithinMonths = 6 } = {}) {
  const rosterInstruments = [...new Set(students.map((student) => student.instrument).filter(Boolean))];
  const cutoff = new Date(now).getTime() - activeWithinMonths * 30 * 24 * 60 * 60 * 1000;

  const summary = {
    totalGroups: 0,
    kept: 0,
    matched: 0,
    skippedNotGroup: 0,
    skippedNoInstrument: 0,
    skippedInactive: 0,
  };
  const records = [];

  for (const group of groups) {
    const chatId = clean(group.chatId || group.id);
    if (!isWhatsappGroupChatId(chatId)) {
      summary.skippedNotGroup += 1;
      continue;
    }
    summary.totalGroups += 1;

    const chatName = clean(group.chatName || group.subject);
    const instrument = detectInstrumentInName(chatName, rosterInstruments);
    if (!instrument) {
      summary.skippedNoInstrument += 1;
      continue;
    }

    const lastActiveAt = clean(group.lastActiveAt);
    const lastActiveMs = Date.parse(lastActiveAt);
    if (Number.isFinite(lastActiveMs) && lastActiveMs < cutoff) {
      summary.skippedInactive += 1;
      continue;
    }

    const match = matchGroupToStudent({ chatName, participantPhones: group.participantPhones || [] }, students);
    if (match.matchedMmsId) summary.matched += 1;
    summary.kept += 1;

    records.push({
      chatId,
      chatName,
      instrument,
      lastActiveAt,
      matchedMmsId: match.matchedMmsId,
      matchedStudentName: match.matchedStudentName,
      matchConfidence: match.matchConfidence,
      matchReasons: match.matchReasons,
    });
  }

  return { records, summary };
}

// Roster-based bucketing for a synced group: if we matched a current student
// it's worth reviewing; if not, it's almost certainly an old student or a
// non-lesson group, so park it as `unmatched` (hidden by default). Preserve
// only human decisions (`confirmed`/`ignored`); `review`/`unmatched` are
// auto-assigned, so re-bucket them on every sync (matching improves over time).
export function decideSyncedGroupStatus(existingStatus = '', hasMatch = false) {
  if (existingStatus === 'confirmed') return 'confirmed';
  if (existingStatus === 'ignored') return 'ignored';
  return hasMatch ? 'review' : 'unmatched';
}

export function groupIncomingMessages(rows = []) {
  return [...rows]
    .map((row) => ({
      ...row,
      status: normaliseEnum(row.status, INCOMING_MESSAGE_STATUSES, 'inbox'),
      suspectedCategory: normaliseEnum(row.suspectedCategory, INCOMING_MESSAGE_CATEGORIES, 'general'),
    }))
    .sort((a, b) => {
      const aMs = new Date(a.capturedAt || a.messageAt || '').getTime();
      const bMs = new Date(b.capturedAt || b.messageAt || '').getTime();
      return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
    });
}

export function labelIncomingCategory(value = '') {
  const labels = {
    one_off_absence: 'One-off absence',
    extended_absence: 'Extended absence',
    summer_break: 'Summer break',
    absence_pause: 'Absence / pause',
    leaving: 'Leaving',
    payment: 'Payment',
    schedule: 'Schedule',
    concern: 'Concern',
    general: 'General',
  };
  return labels[normaliseEnum(value, INCOMING_MESSAGE_CATEGORIES, 'general')];
}

export function labelIncomingStatus(value = '') {
  const labels = {
    inbox: 'Inbox',
    converted: 'Archived',
    ignored: 'Ignored',
    needs_review: 'Needs review',
  };
  return labels[normaliseEnum(value, INCOMING_MESSAGE_STATUSES, 'inbox')];
}

const CATEGORY_PLANNING_AREA = {
  one_off_absence: 'workflow',
  extended_absence: 'workflow',
  summer_break: 'workflow',
  absence_pause: 'workflow',
  leaving: 'finance',
  payment: 'finance',
  schedule: 'workflow',
  concern: 'parent',
  general: 'parent',
};

// Suggested WhatsApp reply for a reviewed message. This is a copy-paste draft
// the human edits and sends manually — the inbox never auto-sends (see the
// bridge boundary doc). Tone mirrors buildTutorAbsenceMessage.
export function buildIncomingReplyTemplate({
  category = '',
  senderName = '',
  parentName = '',
  studentName = '',
  tutorName = '',
} = {}) {
  const parentFirst = firstName(senderName || parentName, 'there');
  const studentFirst = firstName(studentName, 'your child');
  const tutorFirst = firstName(tutorName, 'their tutor');
  const cat = normaliseEnum(category, INCOMING_MESSAGE_CATEGORIES, 'general');

  switch (cat) {
    case 'one_off_absence':
      return `Hi ${parentFirst}! Thanks so much for letting us know ${studentFirst} can’t make it — no problem at all, these things happen.\n\nWe’ll pop it on our records, and ${tutorFirst} will pick things up nicely at the next lesson. See you then!`;
    case 'extended_absence':
    case 'absence_pause':
      return `Hi ${parentFirst}! Thanks for letting us know ${studentFirst} will be away for a little while — that’s absolutely fine.\n\nWe’ll get the break sorted on our side so the payment side lines up properly, and ${tutorFirst} will be all set to pick back up the moment you’re back. Whenever you have the return date, just pop it over and we’ll take care of the rest.`;
    case 'summer_break':
      return `Hi ${parentFirst}! Thanks for the heads up about the summer break.\n\nWe’ll note ${studentFirst}’s last lesson before the holidays and make sure everything’s lined up and ready for when schools go back. Have a lovely summer!`;
    case 'leaving':
      return `Hi ${parentFirst}, thanks for letting us know — we’re really sorry to see ${studentFirst} go, and it’s been a joy having them with us.\n\nWe’ll sort the final lesson and tidy up the payment side from our end, then confirm once it’s all done. The door’s always open if ${studentFirst} ever fancies coming back.`;
    case 'payment':
      return `Hi ${parentFirst}! Thanks for flagging this — no worries at all.\n\nWe’ll take a proper look at the payment side and come back to you shortly to get it sorted.`;
    case 'schedule':
      return `Hi ${parentFirst}! Thanks for letting us know.\n\nWe’ll have a look at ${studentFirst}’s slot and see what we can do, then come back to you with the options.`;
    case 'concern':
      return `Hi ${parentFirst}, thanks for taking the time to raise this — we really appreciate it, and we want to get things just right for ${studentFirst}.\n\nWe’ll take a proper look and come back to you soon.`;
    default:
      return `Hi ${parentFirst}! Thanks for your message — we’ve got it, and we’ll come back to you shortly.`;
  }
}

// Maps a reviewed incoming message into Planning_Item fields. The suggested
// reply travels in the notes so context stays with the plan.
export function buildIncomingPlanningDraft({ record = {}, student = {}, replyTemplate = '' } = {}) {
  const category = normaliseEnum(record.suspectedCategory, INCOMING_MESSAGE_CATEGORIES, 'general');
  const label = labelIncomingCategory(category);
  const studentName = record.matchedStudentName || student.fullName || '';
  const who = studentName || record.senderName || 'Incoming message';
  const senderLine = [record.senderName, record.senderPhone].filter(Boolean).join(' · ');

  const notes = [
    `From WhatsApp incoming inbox (${record.source || 'manual'}).`,
    senderLine ? `Sender: ${senderLine}` : '',
    record.chatName ? `Chat: ${record.chatName}` : '',
    record.messageAt ? `Message time: ${record.messageAt}` : '',
    '',
    `Message: ${record.messageText || ''}`,
    record.reviewNote ? `Reviewer note: ${record.reviewNote}` : '',
    replyTemplate ? `\nSuggested reply (send manually in WhatsApp):\n${replyTemplate}` : '',
  ].filter((part) => part !== '').join('\n');

  return {
    title: `${label}: ${who}`,
    notes,
    itemType: 'action',
    owner: 'Unassigned',
    status: 'active',
    area: CATEGORY_PLANNING_AREA[category] || 'parent',
    linkedStudentIds: record.matchedMmsId ? [record.matchedMmsId] : [],
    nextAction: `Reply to ${firstName(record.senderName || student.parentFirstName, 'the parent')} and action the ${label.toLowerCase()}.`,
  };
}
