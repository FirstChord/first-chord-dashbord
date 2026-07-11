import { buildWaitingCapacityMatches } from './capacity-helpers.mjs';
import { getMmsFreeCalendarSlotContext } from './mms.js';
import { getActiveTutorOptions } from './tutors.js';
import { getWaitingWorkflowStudents, isActiveWaitingStatus } from './waiting-workflow.js';

export async function getWaitingStudentsWithCapacity({
  forceRefreshSlots = false,
  lookaheadDays = 30,
  throwOnSlotError = false,
} = {}) {
  const students = (await getWaitingWorkflowStudents())
    .filter((student) => isActiveWaitingStatus(student.waitingStatus));
  let freeSlotContext;

  try {
    freeSlotContext = await getMmsFreeCalendarSlotContext({
      lookaheadDays,
      forceRefresh: forceRefreshSlots,
    });
  } catch (error) {
    if (throwOnSlotError) {
      throw error;
    }

    freeSlotContext = {
      slots: [],
      fetchedAt: '',
      expiresAt: '',
      fromCache: false,
      lookaheadDays,
      error: error.message || 'Could not load MMS free slots',
    };
  }

  return {
    students: buildWaitingCapacityMatches({
      waitingStudents: students,
      freeSlots: freeSlotContext.slots,
      tutors: await getActiveTutorOptions(),
    }),
    capacityContext: {
      fetchedAt: freeSlotContext.fetchedAt,
      expiresAt: freeSlotContext.expiresAt,
      fromCache: freeSlotContext.fromCache,
      lookaheadDays: freeSlotContext.lookaheadDays,
      slotCount: freeSlotContext.slots.length,
      error: freeSlotContext.error || '',
    },
  };
}
