import { getRegistryEntries } from '@/lib/admin/registry';
import {
  getPauseHistoryRows,
  getReviewFlagsRows,
  getScheduleContextRows,
  getStudentsSheetRows,
  getWaitingListStateRows,
  prefetchSheetValues,
  SCHEDULE_CONTEXT_SHEET,
  WAITING_LIST_STATE_SHEET,
} from '@/lib/admin/sheets';
import { buildStudentContextCollection } from './student-context-helpers.mjs';

export async function loadStudentContextCollection({
  includeFlags = false,
  includeSchedule = false,
  excludeTestStudents = false,
  currentDate = new Date(),
} = {}) {
  // The busiest read path in the app: five tabs, on every student list and
  // every student page. One batchGet warms them all for the cost of one
  // request against a 60-per-minute quota that cannot be raised; the readers
  // below then find their data cached and ask for nothing.
  await prefetchSheetValues([
    'Students',
    ...(includeFlags ? ['Review_Flags'] : []),
    "'Pause History'",
    WAITING_LIST_STATE_SHEET,
    ...(includeSchedule ? [SCHEDULE_CONTEXT_SHEET] : []),
  ]);

  const [rawSheetRows, registryEntries, flagRows, pauseHistoryRows, waitingRows, scheduleRows] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntries(),
    includeFlags ? getReviewFlagsRows() : Promise.resolve([]),
    getPauseHistoryRows(),
    getWaitingListStateRows(),
    includeSchedule ? getScheduleContextRows() : Promise.resolve(null),
  ]);

  return buildStudentContextCollection({
    rawSheetRows,
    registryEntries,
    flagRows,
    pauseHistoryRows,
    waitingRows,
    scheduleRows,
    excludeTestStudents,
    currentDate,
  });
}
