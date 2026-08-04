/**
 * @fileoverview Fail-safe persistence boundary for linking an inbox message to a Planning Item.
 */

export async function persistIncomingPlanningConversion({
  corrected = {},
  planningId = '',
  draft = {},
  actorEmail = '',
} = {}, {
  savePlanningItem,
  upsertIncomingMessage,
} = {}) {
  if (typeof savePlanningItem !== 'function' || typeof upsertIncomingMessage !== 'function') {
    throw new Error('Incoming planning conversion dependencies are required');
  }

  // The plan is authoritative for whether the conversion succeeded. Only
  // archive/link the inbox row after that write returns successfully.
  const planningItem = await savePlanningItem({
    planningId,
    item: draft,
    actorEmail,
    progressNote: `Created from incoming WhatsApp message ${corrected.incomingId}.`,
  });
  const row = {
    ...corrected,
    status: 'converted',
    createdPlanningId: planningItem.planningId,
    resolutionType: 'planning_task',
  };
  await upsertIncomingMessage(row);

  return { planningItem, row };
}
