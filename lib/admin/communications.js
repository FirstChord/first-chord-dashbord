import { randomUUID } from 'node:crypto';
import { appendCommunicationLogRow, getCommunicationLogRows } from '@/lib/admin/sheets';
import {
  groupCommunicationLog,
  isDuplicateCommunication,
  normaliseCommunicationLogEntry,
} from '@/lib/admin/communications-helpers.mjs';

export async function getCommunicationLog() {
  const rows = await getCommunicationLogRows();
  return groupCommunicationLog(rows);
}

// Append-only record of a parent message that was copied to send. De-duplicates a
// repeated copy of the same message to the same student within the dedup window,
// so clicking Copy twice doesn't create two rows. Never throws on a duplicate —
// returns { logged: false } instead.
export async function logCommunication(input = {}) {
  const now = new Date();
  const entry = normaliseCommunicationLogEntry({
    ...input,
    loggedAt: now.toISOString(),
  });

  if (!entry.body) {
    return { logged: false, reason: 'empty' };
  }

  const existing = await getCommunicationLogRows();
  if (isDuplicateCommunication(entry, existing, { now })) {
    return { logged: false, reason: 'duplicate' };
  }

  const messageId = `comm_${randomUUID()}`;
  await appendCommunicationLogRow({ ...entry, messageId });
  return { logged: true, messageId };
}
