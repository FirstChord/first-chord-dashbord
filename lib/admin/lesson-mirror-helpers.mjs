/** @fileoverview Pure identity, wall-clock, and MMS normalization rules for the provider-neutral lesson mirror. */
import { createHash } from 'node:crypto';

export const LESSON_MIRROR_PROVIDER = 'mms';
export const LESSON_MIRROR_TIME_ZONE = 'Europe/London';

const ID_PREFIXES = Object.freeze({
  series: 'fc_lsr',
  event: 'fc_lev',
  participation: 'fc_lpt',
});

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

function nullableClean(value) {
  const result = clean(value);
  return result || null;
}

function integerOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function booleanOrNull(value) {
  return typeof value === 'boolean' ? value : null;
}

function entityId(kind, providerIdentity) {
  const prefix = ID_PREFIXES[kind];
  const identity = clean(providerIdentity);
  if (!prefix || !identity) throw new Error(`A valid ${kind} provider identity is required`);
  const digest = createHash('sha256')
    .update(`${LESSON_MIRROR_PROVIDER}:${kind}:${identity}`)
    .digest('hex')
    .slice(0, 24);
  return `${prefix}_${digest}`;
}

export function makeLessonMirrorId(kind, providerIdentity) {
  return entityId(kind, providerIdentity);
}

export function parseMmsLessonWallClock(value) {
  const source = clean(value);
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/u);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '00'] = match;
  const check = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ));
  if (
    check.getUTCFullYear() !== Number(year)
    || check.getUTCMonth() !== Number(month) - 1
    || check.getUTCDate() !== Number(day)
    || check.getUTCHours() !== Number(hour)
    || check.getUTCMinutes() !== Number(minute)
    || check.getUTCSeconds() !== Number(second)
  ) return null;
  return {
    localDate: `${year}-${month}-${day}`,
    localTime: `${hour}:${minute}:${second}`,
    source,
    timeZone: LESSON_MIRROR_TIME_ZONE,
  };
}

function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalise(value[key])]),
  );
}

export function lessonMirrorStateHash(snapshot) {
  return createHash('sha256').update(JSON.stringify(canonicalise(snapshot))).digest('hex');
}

function eventCategory(row = {}) {
  return {
    externalId: nullableClean(row.EventCategoryID || row.EventCategory?.ID),
    name: nullableClean(row.EventCategoryName || row.EventCategory?.Name),
  };
}

function eventLocation(row = {}) {
  return {
    externalId: nullableClean(row.EventLocationID || row.EventLocation?.ID || row.LocationID || row.Location?.ID),
    name: nullableClean(row.EventLocationName || row.EventLocation?.Name || row.LocationName || row.Location?.Name),
  };
}

function attendanceStudentId(row = {}) {
  return clean(row.StudentID || row.Student?.ID);
}

function addExternalRef(map, { entityKind, fcEntityId, referenceKind, externalId }) {
  const ref = clean(externalId);
  if (!ref) return;
  const key = [LESSON_MIRROR_PROVIDER, referenceKind, ref].join(':');
  const next = {
    entityKind,
    fcEntityId,
    provider: LESSON_MIRROR_PROVIDER,
    referenceKind,
    externalId: ref,
  };
  const previous = map.get(key);
  if (previous && (previous.entityKind !== entityKind || previous.fcEntityId !== fcEntityId)) {
    throw new Error(`MMS ${referenceKind} reference ${ref} maps to more than one First Chord entity`);
  }
  map.set(key, next);
}

function buildEvent(row, { calendarObserved, attendanceObserved }) {
  const externalId = clean(calendarObserved ? (row.ID || row.EventID) : (row.EventID || row.ID));
  if (!externalId) throw new Error('An MMS lesson event row has no event ID');
  const wallClock = parseMmsLessonWallClock(row.StartDate || row.EventStartDate);
  if (!wallClock) throw new Error(`MMS event ${externalId} has no valid lesson wall-clock start`);
  const sourceSeriesId = nullableClean(row.SeriesID || row.EventSeriesID);
  const category = eventCategory(row);
  const location = eventLocation(row);
  const snapshot = {
    fcEventId: entityId('event', externalId),
    fcSeriesId: sourceSeriesId ? entityId('series', sourceSeriesId) : null,
    localDate: wallClock.localDate,
    localTime: wallClock.localTime,
    timeZone: wallClock.timeZone,
    sourceStart: wallClock.source,
    durationMinutes: integerOrNull(row.Duration ?? row.EventDuration),
    tutorExternalId: nullableClean(row.TeacherID || row.Teacher?.ID),
    originalTutorExternalId: nullableClean(row.OriginalTeacherID || row.OriginalTeacher?.ID),
    locationExternalId: location.externalId,
    locationName: location.name,
    categoryExternalId: category.externalId,
    categoryName: category.name,
    allDay: booleanOrNull(row.AllDay),
    sourceStatus: nullableClean(row.Status || row.EventStatus),
    sourceRecurring: booleanOrNull(row.Recurring ?? row.IsRecurring),
    sourceRecurrence: row.RepeatDetails && typeof row.RepeatDetails === 'object'
      ? canonicalise(row.RepeatDetails)
      : null,
    calendarObserved: Boolean(calendarObserved),
    attendanceObserved: Boolean(attendanceObserved),
  };
  return {
    ...snapshot,
    sourceEventId: externalId,
    sourceSeriesId,
    stateHash: lessonMirrorStateHash(snapshot),
  };
}

function mergeEvent(previous, next) {
  if (!previous) return next;
  const preferred = next.calendarObserved ? next : previous;
  const other = preferred === next ? previous : next;
  const snapshot = {
    fcEventId: preferred.fcEventId,
    fcSeriesId: preferred.fcSeriesId || other.fcSeriesId || null,
    localDate: preferred.localDate || other.localDate,
    localTime: preferred.localTime || other.localTime,
    timeZone: preferred.timeZone || other.timeZone,
    sourceStart: preferred.sourceStart || other.sourceStart,
    durationMinutes: preferred.durationMinutes ?? other.durationMinutes,
    tutorExternalId: preferred.tutorExternalId || other.tutorExternalId || null,
    originalTutorExternalId: preferred.originalTutorExternalId || other.originalTutorExternalId || null,
    locationExternalId: preferred.locationExternalId || other.locationExternalId || null,
    locationName: preferred.locationName || other.locationName || null,
    categoryExternalId: preferred.categoryExternalId || other.categoryExternalId || null,
    categoryName: preferred.categoryName || other.categoryName || null,
    allDay: preferred.allDay ?? other.allDay ?? null,
    sourceStatus: preferred.sourceStatus || other.sourceStatus || null,
    sourceRecurring: preferred.sourceRecurring ?? other.sourceRecurring ?? null,
    sourceRecurrence: preferred.sourceRecurrence || other.sourceRecurrence || null,
    calendarObserved: previous.calendarObserved || next.calendarObserved,
    attendanceObserved: previous.attendanceObserved || next.attendanceObserved,
  };
  return {
    ...snapshot,
    sourceEventId: preferred.sourceEventId,
    sourceSeriesId: preferred.sourceSeriesId || other.sourceSeriesId || null,
    stateHash: lessonMirrorStateHash(snapshot),
  };
}

function buildParticipation({ event, attendance }) {
  const studentExternalId = attendanceStudentId(attendance);
  if (!studentExternalId) throw new Error(`MMS event ${event.sourceEventId} contains an attendance without a student ID`);
  const attendanceExternalId = nullableClean(attendance.ID || attendance.AttendanceID);
  const providerIdentity = `${event.sourceEventId}:${studentExternalId}`;
  const snapshot = {
    fcParticipationId: entityId('participation', providerIdentity),
    fcEventId: event.fcEventId,
    studentExternalId,
    rawAttendanceStatus: nullableClean(attendance.AttendanceStatus || attendance.Status),
  };
  return {
    ...snapshot,
    attendanceExternalId,
    stateHash: lessonMirrorStateHash(snapshot),
  };
}

function mergeParticipation(previous, next) {
  if (!previous) return next;
  const snapshot = {
    fcParticipationId: previous.fcParticipationId,
    fcEventId: previous.fcEventId,
    studentExternalId: previous.studentExternalId,
    rawAttendanceStatus: next.rawAttendanceStatus || previous.rawAttendanceStatus || null,
  };
  return {
    ...snapshot,
    attendanceExternalId: next.attendanceExternalId || previous.attendanceExternalId || null,
    stateHash: lessonMirrorStateHash(snapshot),
  };
}

function seriesFromProviderRow(row) {
  const sourceSeriesId = clean(row.SeriesID || row.EventSeriesID);
  if (!sourceSeriesId) return null;
  const snapshot = {
    fcSeriesId: entityId('series', sourceSeriesId),
    observedRecurrence: null,
  };
  return {
    ...snapshot,
    sourceSeriesId,
    stateHash: lessonMirrorStateHash(snapshot),
  };
}

function sortedValues(map, key) {
  return [...map.values()].sort((a, b) => `${a[key]}`.localeCompare(`${b[key]}`));
}

export function normaliseMmsLessonMirror({ calendarRows = [], attendanceRows = [] } = {}) {
  if (!Array.isArray(calendarRows) || !Array.isArray(attendanceRows)) {
    throw new Error('Calendar and attendance rows must be arrays');
  }
  const series = new Map();
  const events = new Map();
  const participations = new Map();
  const externalRefs = new Map();

  for (const row of calendarRows) {
    const event = buildEvent(row || {}, { calendarObserved: true, attendanceObserved: false });
    events.set(event.fcEventId, mergeEvent(events.get(event.fcEventId), event));
    addExternalRef(externalRefs, {
      entityKind: 'event', fcEntityId: event.fcEventId, referenceKind: 'event', externalId: event.sourceEventId,
    });

    const nextSeries = seriesFromProviderRow(row || {});
    if (nextSeries) {
      series.set(nextSeries.fcSeriesId, nextSeries);
      addExternalRef(externalRefs, {
        entityKind: 'series', fcEntityId: nextSeries.fcSeriesId, referenceKind: 'series', externalId: nextSeries.sourceSeriesId,
      });
    }

    for (const attendance of row?.Attendances || []) {
      const participation = buildParticipation({ event, attendance });
      participations.set(
        participation.fcParticipationId,
        mergeParticipation(participations.get(participation.fcParticipationId), participation),
      );
      addExternalRef(externalRefs, {
        entityKind: 'participation',
        fcEntityId: participation.fcParticipationId,
        referenceKind: 'attendance',
        externalId: participation.attendanceExternalId,
      });
    }
  }

  for (const row of attendanceRows) {
    const event = buildEvent(row || {}, { calendarObserved: false, attendanceObserved: true });
    events.set(event.fcEventId, mergeEvent(events.get(event.fcEventId), event));
    addExternalRef(externalRefs, {
      entityKind: 'event', fcEntityId: event.fcEventId, referenceKind: 'event', externalId: event.sourceEventId,
    });
    const nextSeries = seriesFromProviderRow(row || {});
    if (nextSeries) {
      series.set(nextSeries.fcSeriesId, nextSeries);
      addExternalRef(externalRefs, {
        entityKind: 'series', fcEntityId: nextSeries.fcSeriesId, referenceKind: 'series', externalId: nextSeries.sourceSeriesId,
      });
    }
    const participation = buildParticipation({ event, attendance: row || {} });
    participations.set(
      participation.fcParticipationId,
      mergeParticipation(participations.get(participation.fcParticipationId), participation),
    );
    addExternalRef(externalRefs, {
      entityKind: 'participation',
      fcEntityId: participation.fcParticipationId,
      referenceKind: 'attendance',
      externalId: participation.attendanceExternalId,
    });
  }

  return {
    series: sortedValues(series, 'fcSeriesId'),
    events: sortedValues(events, 'fcEventId'),
    participations: sortedValues(participations, 'fcParticipationId'),
    externalRefs: [...externalRefs.values()].sort((a, b) => (
      `${a.provider}:${a.referenceKind}:${a.externalId}`.localeCompare(`${b.provider}:${b.referenceKind}:${b.externalId}`)
    )),
  };
}
