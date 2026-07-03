import { createHmac, timingSafeEqual } from 'node:crypto';

const STUDENT_NOTES_SCOPE = 'student_notes';
const DEFAULT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function clean(value = '') {
  return `${value || ''}`.trim();
}

function base64urlJson(payload = {}) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function parseBase64urlJson(value = '') {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function getTutorSurfaceTokenSecret(env = process.env) {
  // The tutor dashboard Railway service may only have the MMS token configured.
  // Use it as a server-side HMAC secret fallback; it is never sent to the client.
  return clean(
    env.TUTOR_DASHBOARD_TOKEN_SECRET
    || env.STUDENT_PORTAL_TOKEN_SECRET
    || env.NEXTAUTH_SECRET
    || env.PRACTICE_CHAT_API_SECRET
    || env.MMS_BEARER_TOKEN
    || env.MMS_DEFAULT_TOKEN,
  );
}

export function signTutorSurfaceToken(payload = {}, secret = '') {
  const tokenSecret = clean(secret);
  if (!tokenSecret) {
    throw new Error('signTutorSurfaceToken requires a secret');
  }
  const body = base64urlJson(payload);
  const signature = createHmac('sha256', tokenSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyTutorSurfaceToken(token = '', secret = '', { now = Date.now() } = {}) {
  const tokenSecret = clean(secret);
  const [body, signature] = clean(token).split('.');
  if (!tokenSecret || !body || !signature) return null;

  const expected = createHmac('sha256', tokenSecret).update(body).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  const payload = parseBase64urlJson(body);
  if (!payload) return null;
  if (payload.exp && Number(payload.exp) < now) return null;
  return payload;
}

export function buildStudentNotesToken({
  studentId = '',
  tutor = '',
  secret = '',
  now = Date.now(),
  ttlMs = DEFAULT_TOKEN_TTL_MS,
} = {}) {
  const sid = clean(studentId);
  if (!sid) {
    throw new Error('buildStudentNotesToken requires a studentId');
  }
  return signTutorSurfaceToken({
    scope: STUDENT_NOTES_SCOPE,
    sid,
    tutor: clean(tutor),
    iat: now,
    exp: now + ttlMs,
  }, secret);
}

export function verifyStudentNotesToken(token = '', {
  studentId = '',
  secret = '',
  now = Date.now(),
} = {}) {
  const payload = verifyTutorSurfaceToken(token, secret, { now });
  if (!payload) return null;
  if (payload.scope !== STUDENT_NOTES_SCOPE) return null;
  if (payload.sid !== clean(studentId)) return null;
  return payload;
}

export function addStudentNotesTokens(students = [], {
  tutor = '',
  secret = getTutorSurfaceTokenSecret(),
  now = Date.now(),
} = {}) {
  if (!secret) return students;
  return students.map((student) => {
    const studentId = clean(student.mms_id || student.ID || student.id || student.studentId);
    if (!studentId) return student;
    const token = buildStudentNotesToken({ studentId, tutor, secret, now });
    return {
      ...student,
      noteAccessToken: token,
      note_access_token: token,
    };
  });
}
