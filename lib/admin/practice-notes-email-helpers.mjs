function clean(value = '') {
  return `${value || ''}`.trim();
}

function escapeHtml(value = '') {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function encodeHeader(value = '') {
  return clean(value).replace(/[\r\n]+/gu, ' ');
}

function encodeBase64Url(value = '') {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/u, '');
}

function noteTextToHtml(noteText = '') {
  return clean(noteText)
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph
      .split(/\r?\n/u)
      .map((line) => escapeHtml(line))
      .join('<br>')}</p>`)
    .join('\n');
}

export function buildPracticeNoteEmailContent({
  studentName = '',
  tutorName = '',
  noteText = '',
} = {}) {
  const student = clean(studentName) || 'your lesson';
  const tutor = clean(tutorName);
  const intro = tutor
    ? `Here are the practice notes from ${student}'s lesson with ${tutor}.`
    : `Here are the practice notes from ${student}'s lesson.`;
  const plain = [
    'Hi,',
    '',
    intro,
    '',
    clean(noteText),
    '',
    'Best,',
    'First Chord Music School',
  ].join('\n');

  const html = [
    '<p>Hi,</p>',
    `<p>${escapeHtml(intro)}</p>`,
    noteTextToHtml(noteText),
    '<p>Best,<br>First Chord Music School</p>',
  ].filter(Boolean).join('\n');

  return { plain, html };
}

export function buildPracticeNoteEmailSubject({ studentName = '' } = {}) {
  const student = clean(studentName);
  return student ? `Practice notes for ${student}` : 'Practice notes';
}

export function buildGmailRawMessage({
  fromEmail = '',
  fromName = '',
  toEmail = '',
  subject = '',
  plainText = '',
  html = '',
} = {}) {
  const boundary = `firstchord_${Date.now().toString(36)}`;
  const from = fromName
    ? `${encodeHeader(fromName)} <${encodeHeader(fromEmail)}>`
    : encodeHeader(fromEmail);
  const message = [
    `From: ${from}`,
    `To: ${encodeHeader(toEmail)}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    plainText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return encodeBase64Url(message);
}
