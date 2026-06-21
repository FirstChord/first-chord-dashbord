// Fire-and-forget record of a parent message that was copied to send. Shared by
// the various "Copy message" buttons. Never throws and never blocks the copy —
// the Communication Log is a passive record, so a failed write must not affect
// the workflow.
export function logCommunicationCopy({ category, channel = 'whatsapp', mmsId, studentName, body, source }) {
  if (!`${body || ''}`.trim()) return;
  try {
    fetch('/api/admin/communications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, channel, mmsId, studentName, body, source }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // swallow — logging must never break copying
  }
}
