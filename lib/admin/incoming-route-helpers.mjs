export function buildBridgeMutationResponse({ mode = '', groupSyncSummary = null } = {}) {
  const response = { success: true };

  if (mode === 'sync_groups' && groupSyncSummary) {
    response.groupSyncSummary = groupSyncSummary;
  }

  return response;
}
