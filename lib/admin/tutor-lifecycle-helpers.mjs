import { randomUUID } from 'node:crypto';

function text(value = '') {
  return `${value || ''}`.trim();
}

function key(value = '') {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function normaliseTutorLifecycleDate(value = '') {
  return /^\d{4}-\d{2}-\d{2}$/u.test(text(value)) ? text(value) : '';
}

export function tutorMatchesIdentity(value = '', tutor = {}) {
  const candidate = key(value);
  return Boolean(candidate) && [tutor.shortName, tutor.fullName].some((name) => key(name) === candidate);
}

export function buildTutorLifecycleEvent({ tutor = {}, previousStatus = 'active', nextStatus = 'active', actorEmail = '', occurredAt, note = '' } = {}) {
  return {
    eventId: randomUUID(),
    occurredAt,
    actorEmail,
    entityType: 'tutor',
    entityId: tutor.teacherId || tutor.shortName || '',
    eventType: `tutor_lifecycle_${nextStatus}`,
    mmsId: tutor.teacherId || '',
    studentName: tutor.fullName || tutor.shortName || '',
    issueId: '',
    payloadJson: JSON.stringify({
      source: 'admin_tutor_lifecycle',
      tutor_short_name: tutor.shortName || '',
      tutor_name: tutor.fullName || '',
      teacher_id: tutor.teacherId || '',
      previous_status: previousStatus,
      next_status: nextStatus,
      final_teaching_date: tutor.finalTeachingDate || '',
      replacement_tutor_short_name: tutor.replacementTutorShortName || '',
      note: text(note),
    }),
  };
}
