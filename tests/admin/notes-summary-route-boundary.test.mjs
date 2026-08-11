import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const routeUrl = new URL('../../app/api/notes/[studentId]/route.js', import.meta.url);
const guardUrl = new URL('../../lib/admin/notes-route-auth.mjs', import.meta.url);
const priorRatingUrl = new URL('../../app/api/notes/[studentId]/prior-rating/route.js', import.meta.url);

test('notes summary mode is token-gated and built only from the owned practice-notes path', async () => {
  const source = await readFile(routeUrl, 'utf8');
  // The guard moved to a shared module when a sibling route needed the same
  // check, so its two halves are pinned separately now: the route must apply
  // the guard, and the guard must still be the one that verifies the token.
  const guard = await readFile(guardUrl, 'utf8');

  // Every handler authorises with the per-student tutor token before any read.
  assert.match(guard, /verifyStudentNotesToken/u);
  assert.match(guard, /requireTutorDashboardAccess/u);
  assert.match(source, /from '@\/lib\/admin\/notes-route-auth\.mjs'/u);
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

test('the prior-rating route is the one write on this boundary, and only evaluation telemetry', async () => {
  // The tutor-token surface is deliberately read-only (AGENTS.md: no
  // consequential writes before tutor auth exists, Practice Chat Level 2 aside).
  // The six-week evaluation adds one narrow exception — a 1-5 answer landing on
  // a telemetry row — so it gets pinned here rather than quietly widening the
  // rule. If this route ever grows a second thing to write, this test should
  // fail and someone should have to argue for it.
  const source = await readFile(priorRatingUrl, 'utf8');

  assert.match(source, /from '@\/lib\/admin\/notes-route-auth\.mjs'/u);
  assert.match(source, /authorizeNotesRequest\(request, studentId\)/u);
  assert.match(source, /authorizeTutorSession/u);

  // It writes exactly one row, in exactly one lane.
  assert.match(source, /upsertPracticeChatSessionRow/u);
  assert.doesNotMatch(source, /PracticeNoteLog|StudentsRow|IssueQueue|PlanningItem|EventLog/u);

  // And nothing consequential: no provider, no parent, no workflow state.
  assert.doesNotMatch(source, /sendEmail|gmail|mmsClient|attendance|stripe/iu);

  // The score is validated server-side; a client-supplied number outside 1-5
  // must not reach the sheet.
  assert.match(source, /rating < 1 \|\| rating > 5/u);
});
