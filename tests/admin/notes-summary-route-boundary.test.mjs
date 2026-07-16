import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const routeUrl = new URL('../../app/api/notes/[studentId]/route.js', import.meta.url);

test('notes summary mode is token-gated and built only from the owned practice-notes path', async () => {
  const source = await readFile(routeUrl, 'utf8');

  // Every handler authorises with the per-student tutor token before any read.
  assert.match(source, /verifyStudentNotesToken/u);
  assert.match(source, /authorizeNotesRequest\(request, studentId\)/u);

  // The summary is deterministic and reads normalised Practice_Notes_Log rows,
  // never MMS-shaped notes: buildPracticeSummary must only ever be fed by
  // getPracticeNoteLogRows.
  assert.match(source, /searchParams\.get\('summary'\)/u);
  assert.match(source, /buildPracticeSummary\(rows\)/u);
  assert.match(source, /getPracticeNoteLogRows\(studentId\)/u);
  assert.doesNotMatch(source, /buildPracticeSummary\((?!rows\))/u);

  // Read-only surface: no writes and no AI provider on the tutor token boundary.
  assert.doesNotMatch(source, /upsert|append|update|delete|send|generateIssueAiBriefing|ai-provider/u);
});
