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
    return {
      matchedMmsId: confirmedGroup.matchedMmsId || '',
      matchedStudentName: confirmedGroup.matchedStudentName || '',
      matchConfidence: 'high',
      matchReasons: 'confirmed WhatsApp group map matches this student',
      score: 0.98,
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
    converted: 'Converted',
    ignored: 'Ignored',
    needs_review: 'Needs review',
  };
  return labels[normaliseEnum(value, INCOMING_MESSAGE_STATUSES, 'inbox')];
}
