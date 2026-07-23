import crypto from 'node:crypto';
import { normaliseNotesAccessCode } from './student-notes-access-helpers.mjs';

const FRIENDLY_WORDS = [
  'acorn', 'amber', 'apple', 'badger', 'basil', 'beach', 'berry', 'birch', 'bloom', 'bluebell',
  'breeze', 'brook', 'button', 'cedar', 'cherry', 'cloud', 'clover', 'cocoa', 'comet', 'coral',
  'cosy', 'daisy', 'dawn', 'dolphin', 'dove', 'dream', 'ember', 'fern', 'finch', 'forest',
  'fox', 'frost', 'garden', 'ginger', 'glade', 'glow', 'hazel', 'honey', 'island', 'ivy',
  'jolly', 'juniper', 'kite', 'lemon', 'lilac', 'luna', 'maple', 'meadow', 'mint', 'moon',
  'moss', 'music', 'ocean', 'olive', 'orchid', 'otter', 'peach', 'pebble', 'pine', 'plum',
  'poppy', 'rain', 'raven', 'reef', 'river', 'robin', 'rose', 'sage', 'shell', 'sky',
  'snow', 'spark', 'star', 'stone', 'sunny', 'swift', 'tiger', 'tulip', 'violet', 'willow',
  'wren', 'zebra', 'banjo', 'cello', 'chime', 'chord', 'drum', 'flute', 'groove', 'harp',
  'jazz', 'melody', 'note', 'piano', 'rhythm', 'song', 'tempo', 'tune', 'viola', 'waltz',
  'apricot', 'bamboo', 'biscuit', 'bubble', 'candle', 'copper', 'cricket', 'feather', 'heather', 'lantern',
  'magpie', 'marble', 'morning', 'panda', 'parrot', 'pearl', 'planet', 'ripple', 'silver', 'sunset',
];

function getRootSecret() {
  const secret = `${process.env.STUDENT_PORTAL_NOTES_SECRET || ''}`.trim();
  if (Buffer.byteLength(secret) < 32) {
    throw new Error('STUDENT_PORTAL_NOTES_SECRET must be configured with at least 32 bytes');
  }
  return secret;
}

export function assertStudentNotesSecretConfigured() {
  getRootSecret();
  return true;
}

function deriveKey(label) {
  return crypto.createHmac('sha256', getRootSecret()).update(`first-chord:${label}:v1`).digest();
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function decode(value) {
  return Buffer.from(`${value || ''}`, 'base64url');
}

export function generateStudentNotesCode() {
  const word = FRIENDLY_WORDS[crypto.randomInt(0, FRIENDLY_WORDS.length)];
  const digits = crypto.randomInt(10, 100);
  return `${word}-${digits}`;
}

export function buildStudentNotesVerifier(code, salt = crypto.randomBytes(16).toString('base64url')) {
  const normalised = normaliseNotesAccessCode(code);
  if (!normalised) throw new Error('A notes access code is required');
  const pepper = deriveKey('verifier').toString('base64url');
  const verifier = crypto.scryptSync(`${normalised}:${pepper}`, salt, 32).toString('base64url');
  return { salt, verifier };
}

export function verifyStudentNotesCode(code, { salt = '', verifier = '' } = {}) {
  if (!salt || !verifier) return false;
  const candidate = buildStudentNotesVerifier(code, salt).verifier;
  const expectedBuffer = decode(verifier);
  const candidateBuffer = decode(candidate);
  return expectedBuffer.length === candidateBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
}

export function encryptStudentNotesCode(code) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey('encryption'), iv);
  const ciphertext = Buffer.concat([cipher.update(`${code || ''}`, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [encode(iv), encode(tag), encode(ciphertext)].join('.');
}

export function decryptStudentNotesCode(payload = '') {
  const [ivValue, tagValue, ciphertextValue] = `${payload || ''}`.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Stored notes code cannot be decrypted');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey('encryption'), decode(ivValue));
  decipher.setAuthTag(decode(tagValue));
  return Buffer.concat([
    decipher.update(decode(ciphertextValue)),
    decipher.final(),
  ]).toString('utf8');
}

export function studentNotesCookieName(studentMmsId = '') {
  const digest = crypto.createHash('sha256').update(`${studentMmsId || ''}`).digest('hex').slice(0, 16);
  return `fc_notes_${digest}`;
}

export function createStudentNotesSession({ studentMmsId, credentialVersion, now = Date.now() }) {
  const payload = {
    sid: `${studentMmsId || ''}`,
    v: Number(credentialVersion || 0),
    exp: now + (365 * 24 * 60 * 60 * 1000),
  };
  const encoded = encode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', deriveKey('cookie')).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyStudentNotesSession(token, {
  studentMmsId,
  credentialVersion,
  now = Date.now(),
} = {}) {
  try {
    const [encoded, signature] = `${token || ''}`.split('.');
    if (!encoded || !signature) return false;
    const expected = crypto.createHmac('sha256', deriveKey('cookie')).update(encoded).digest();
    const supplied = decode(signature);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return false;
    const payload = JSON.parse(decode(encoded).toString('utf8'));
    return payload.sid === `${studentMmsId || ''}`
      && Number(payload.v) === Number(credentialVersion || 0)
      && Number(payload.exp) > now;
  } catch {
    return false;
  }
}
