// Pure helpers for Song_Requests — the tutor "request this song" curation
// queue. The dashboard only appends status='new' rows; resolution happens in
// the add-song skill / sheet, so there is no update logic here.
import { randomUUID } from 'node:crypto';

export const REQUEST_QUERY_MAX_LENGTH = 120;

// Validates a request and returns the row to append, or { error }.
// requestedBy comes from the verified token payload, never the request body.
export function buildSongRequestRow({
  mmsId = '',
  queryText = '',
  instrument = '',
  requestedBy = '',
  now = new Date(),
  makeId = randomUUID,
} = {}) {
  const cleanMmsId = `${mmsId}`.trim();
  const cleanQuery = `${queryText}`.trim().slice(0, REQUEST_QUERY_MAX_LENGTH);

  if (!/^sdt_\w+$/.test(cleanMmsId)) {
    return { error: 'invalid_student_id' };
  }
  if (!cleanQuery) {
    return { error: 'empty_query' };
  }

  const timestamp = now.toISOString();
  return {
    row: {
      requestId: `sr_${makeId()}`,
      requestedAt: timestamp,
      requestedBy: `${requestedBy}`.trim(),
      mmsId: cleanMmsId,
      instrument: `${instrument}`.trim(),
      queryText: cleanQuery,
      status: 'new',
      songId: '',
      resolutionNote: '',
      resolvedAt: '',
      updatedAt: timestamp,
    },
  };
}
