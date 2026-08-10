/** @fileoverview Read-only MMS-to-PostgreSQL lesson mirror orchestration; it never writes to MMS or changes consumers. */
import { randomUUID } from 'node:crypto';

import { normaliseMmsLessonMirror } from './lesson-mirror-helpers.mjs';
import {
  beginLessonMirrorSync,
  failLessonMirrorSync,
  persistLessonMirrorSnapshot,
} from './lesson-mirror-store.mjs';
import {
  LESSON_MIRROR_MMS_PAGE_SIZE,
  searchMmsLessonAttendance,
  searchMmsLessonCalendar,
} from './mms.js';

export async function syncMmsLessonMirror({
  startDate,
  endDateExclusive,
  triggerKind = 'manual',
  pageSize = LESSON_MIRROR_MMS_PAGE_SIZE,
  maxPages = 20,
  now = () => new Date(),
  syncRunId = randomUUID(),
  fetchCalendar = searchMmsLessonCalendar,
  fetchAttendance = searchMmsLessonAttendance,
  normalise = normaliseMmsLessonMirror,
  store = {},
  database = null,
  env = process.env,
} = {}) {
  const begin = store.begin || beginLessonMirrorSync;
  const persist = store.persist || persistLessonMirrorSnapshot;
  const fail = store.fail || failLessonMirrorSync;
  const startedAt = now().toISOString();
  await begin({
    syncRunId,
    source: 'mms',
    triggerKind,
    startDate,
    endDateExclusive,
    startedAt,
    database,
    env,
  });

  try {
    // Keep provider load predictable: one verified whole-school endpoint walk at
    // a time. Normal school windows fit in one page per endpoint today.
    const calendar = await fetchCalendar({ startDate, endDateExclusive, pageSize, maxPages });
    const attendance = await fetchAttendance({ startDate, endDateExclusive, pageSize, maxPages });
    const snapshot = normalise({ calendarRows: calendar.rows, attendanceRows: attendance.rows });
    const observedAt = now().toISOString();
    return await persist({
      syncRunId,
      observedAt,
      calendarExpectedCount: calendar.reportedTotal,
      calendarReceivedCount: calendar.rows.length,
      attendanceExpectedCount: attendance.reportedTotal,
      attendanceReceivedCount: attendance.rows.length,
      snapshot,
      database,
      env,
    });
  } catch (error) {
    try {
      await fail({ syncRunId, error, completedAt: now().toISOString(), database, env });
    } catch (trackingError) {
      error.lessonMirrorTrackingError = trackingError;
    }
    throw error;
  }
}
