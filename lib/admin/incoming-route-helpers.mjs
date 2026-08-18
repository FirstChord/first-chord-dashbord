/** @fileoverview Shapes the response body for incoming-message bridge mutations. */
export function buildBridgeMutationResponse({ mode = '', groupSyncSummary = null } = {}) {
  const response = { success: true };

  if (mode === 'sync_groups' && groupSyncSummary) {
    response.groupSyncSummary = groupSyncSummary;
  }

  return response;
}
