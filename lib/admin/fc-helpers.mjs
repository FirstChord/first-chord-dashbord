import { createHash } from 'node:crypto';

export function normaliseInstrument(raw) {
  const value = (raw || '').toLowerCase();
  if (value.includes('piano') || value.includes('keyboard')) return 'Piano';
  if (value.includes('ukulele') || value.includes('uke')) return 'Ukulele';
  if (value.includes('singing') || value.includes('voice') || value.includes('vocal')) return 'Singing';
  if (value.includes('bass')) return 'Bass';
  if (value.includes('guitar')) return 'Guitar';
  return raw || '';
}

export function normaliseExperienceLevel(value) {
  const input = (value || '').toLowerCase().trim();
  if (['1', 'beginner', 'complete beginner', 'a complete beginner', 'no'].includes(input)) {
    return 'a complete beginner';
  }
  if (['2', 'some', 'some experience', 'has some experience', 'yes'].includes(input)) {
    return 'has some experience';
  }
  if (['3', 'intermediate', 'at an intermediate level'].includes(input)) {
    return 'at an intermediate level';
  }
  return 'a complete beginner';
}

export function generateFcStudentId(forename, surname, email) {
  const seed = `${(forename || '').trim().toLowerCase()}:${(surname || '').trim().toLowerCase()}:${(email || '').trim().toLowerCase()}`;
  return `fc_std_${createHash('sha256').update(seed).digest('hex').slice(0, 8)}`;
}

