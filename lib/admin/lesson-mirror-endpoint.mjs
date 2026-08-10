/** @fileoverview Secret-gated daily lesson-mirror scheduling with bounded London calendar windows. */
import { lessonMirrorFailureCode } from './lesson-mirror-store.mjs';
import { syncMmsLessonMirror } from './lesson-mirror-sync.mjs';

export const LESSON_MIRROR_LOOKBACK_DAYS = 14;
export const LESSON_MIRROR_FUTURE_DAYS = 42;

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

function timingSafeEqualString(leftValue = '', rightValue = '') {
  const left = clean(leftValue);
  const right = clean(rightValue);
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function londonDate(at) {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) throw new Error('A valid lesson-mirror schedule time is required');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDateDays(isoDate, days) {
  const match = `${isoDate || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) throw new Error('A valid ISO lesson-mirror date is required');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildScheduledLessonMirrorWindow({
  at = new Date(),
  lookbackDays = LESSON_MIRROR_LOOKBACK_DAYS,
  futureDays = LESSON_MIRROR_FUTURE_DAYS,
} = {}) {
  if (!Number.isInteger(lookbackDays) || lookbackDays < 0 || lookbackDays > 365) {
    throw new Error('Lesson-mirror lookback must be between 0 and 365 days');
  }
  if (!Number.isInteger(futureDays) || futureDays < 0 || futureDays > 365) {
    throw new Error('Lesson-mirror future horizon must be between 0 and 365 days');
  }
  const today = londonDate(at);
  return {
    today,
    startDate: addDateDays(today, -lookbackDays),
    // End dates are exclusive: include today and exactly futureDays after it.
    endDateExclusive: addDateDays(today, futureDays + 1),
    lookbackDays,
    futureDays,
  };
}

export function createLessonMirrorPostHandler({
  sync = syncMmsLessonMirror,
  now = () => new Date(),
  env = process.env,
} = {}) {
  return async function POST(request) {
    const expectedSecret = clean(env.SCHEDULE_REFRESH_SECRET);
    if (!expectedSecret) {
      return Response.json({ error: 'Lesson mirror schedule is not configured' }, { status: 503 });
    }
    const providedSecret = request.headers.get('x-firstchord-schedule-secret') || '';
    if (!timingSafeEqualString(providedSecret, expectedSecret)) {
      return Response.json({ error: 'Invalid or missing schedule refresh secret' }, { status: 401 });
    }

    const window = buildScheduledLessonMirrorWindow({ at: now() });
    try {
      const result = await sync({
        startDate: window.startDate,
        endDateExclusive: window.endDateExclusive,
        triggerKind: 'scheduled',
      });
      return Response.json({
        success: true,
        window,
        syncRunId: result.syncRunId,
        status: result.status,
        seriesCount: result.seriesCount,
        eventCount: result.eventCount,
        participationCount: result.participationCount,
      });
    } catch (error) {
      const failureCode = lessonMirrorFailureCode(error);
      console.error('Scheduled lesson mirror sync failed', {
        failureCode,
        trackingFailed: Boolean(error?.lessonMirrorTrackingError),
      });
      return Response.json({
        success: false,
        error: 'Scheduled lesson mirror sync failed',
        failureCode,
        window,
      }, { status: 500 });
    }
  };
}
