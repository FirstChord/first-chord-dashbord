import { getRegistryEntries } from '@/lib/admin/registry';
import {
  getPauseHistoryRows,
  getReviewFlagsRows,
  getScheduleContextRows,
  getStudentsSheetRows,
  getWaitingListStateRows,
} from '@/lib/admin/sheets';
import { buildStudentContextCollection } from './student-context-helpers.mjs';

export async function loadStudentContextCollection({
  includeFlags = false,
  includeSchedule = false,
  excludeTestStudents = false,
  currentDate = new Date(),
} = {}) {
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
