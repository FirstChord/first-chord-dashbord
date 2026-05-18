import { buildWaitingCapacityMatches } from './capacity-helpers.mjs';
import { getMmsFreeCalendarSlotContext } from './mms.js';
import { getAllTutorOptions } from './tutors.js';
import { getWaitingWorkflowStudents } from './waiting-workflow.js';

export async function getWaitingStudentsWithCapacity({
  forceRefreshSlots = false,
  lookaheadDays = 30,
  throwOnSlotError = false,
} = {}) {
  const students = await getWaitingWorkflowStudents();
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
      tutors: getAllTutorOptions(),
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
