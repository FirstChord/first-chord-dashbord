/**
 * Refresh Student_Lifecycle from MMS and append one Lifecycle_Snapshot row.
 *
 * This is a ritual, not a dashboard: run it termly, read the report it prints,
 * and the numbers land in Sheets so the next person can see them without
 * rerunning anything. Nothing here is read on page load and nothing acts on the
 * result automatically.
 *
 *   node scripts/refresh-student-lifecycle.mjs            # dry run, prints only
 *   node scripts/refresh-student-lifecycle.mjs --apply    # also writes to Sheets
 *
 * MMS is the only place the school's own history is recorded — attendance goes
 * back to 2019. /search/attendance ignores Limit and OrderBy and returns a
 * student's whole history in one call, so this is one request per student.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadLocalEnv } from './script-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
await loadLocalEnv(repoRoot);

const { buildLifecycleRow, summariseLifecycle, survivalByCohort } = await import(
  '../lib/admin/student-lifecycle.mjs'
);

const APPLY = process.argv.includes('--apply');
const CONCURRENCY = 5;
const TODAY = new Date().toISOString().slice(0, 10);
const MMS_BASE = 'https://api.mymusicstaff.com/v1';

const token = process.env.MMS_BEARER_TOKEN || process.env.MMS_DEFAULT_TOKEN;
if (!token) {
  console.error('No MMS token (MMS_BEARER_TOKEN) in the environment.');
  process.exit(1);
}

async function mms(endpoint, body) {
  const res = await fetch(`${MMS_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'x-schoolbox-version': 'main',
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
  if (!res.ok) return { __error: `HTTP ${res.status}` };
  return res.json();
}

async function fetchStudents() {
  const all = [];
  const limit = 500;
  for (let offset = 0; offset < 20000; offset += limit) {
    const data = await mms(
      `/search/students?offset=${offset}&limit=${limit}&orderby=FullName`,
      { IDs: [], SearchText: '', FirstName: null, LastName: null, Statuses: [], TeacherIDs: [], FamilyIDs: [], StudentGroupIDs: [] },
    );
    const batch = data?.ItemSubset ?? [];
    all.push(...batch);
    if (batch.length < limit) break;
  }
  return all;
}

const ATTEMPTS = 5;

async function fetchHistory(studentId) {
  let lastReason = 'unknown';

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const data = await mms('/search/attendance', {
        StudentIDs: [studentId], Limit: 1, Offset: 0, OrderBy: 'EventStartDate',
      });
      if (data.__error) return { error: data.__error, lessons: [] };
      const items = data?.ItemSubset ?? [];
      const total = data?.TotalItemCount ?? items.length;
      // The endpoint returns everything or nothing; a short page means the call
      // is lying about completeness and the row would understate tenure.
      if (items.length !== total) return { error: `truncated ${items.length}/${total}`, lessons: [] };
      return { error: '', lessons: items };
    } catch (error) {
      lastReason = error?.message || 'unknown';
      // Exponential backoff with jitter. Without the jitter the five workers
      // retry in lockstep and re-trigger the same rate limit together, which is
      // what left a couple of dozen students unread on earlier runs.
      const backoff = 600 * (2 ** attempt) + Math.floor(Math.random() * 400);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  return { error: `failed after ${ATTEMPTS} attempts (${lastReason})`, lessons: [] };
}

function pct(value) {
  return value === null ? '   . ' : `${String(value).padStart(3)}%`;
}

console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — refreshing student lifecycle as at ${TODAY}\n`);

const students = await fetchStudents();
console.log(`fetched ${students.length} students from MMS; pulling lesson history...`);

const rows = [];
const failures = [];
const queue = [...students];
let done = 0;

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const student = queue.shift();
      const { error, lessons } = await fetchHistory(student.ID);
      if (error) failures.push({ id: student.ID, name: student.FullName, error });
      else rows.push(buildLifecycleRow({ student, lessons, today: TODAY }));
      done += 1;
      if (done % 100 === 0) console.log(`  ${done}/${students.length}`);
    }
  }),
);

const summary = summariseLifecycle(rows, { today: TODAY });
const cohorts = survivalByCohort(rows, { today: TODAY });

console.log(`\nbuilt ${rows.length} rows; ${failures.length} students could not be read`);

console.log('\n── Where the school stands ──────────────────────────────');
console.log(`  students with lesson history   ${summary.studentsWithHistory}`);
console.log(`  currently attending            ${summary.activeStudents}`);
console.log(`    median tenure                ${summary.medianTenureYears}y   longest ${summary.longestTenureYears}y`);
console.log(`    with us 3+ years             ${summary.tenureThreeYearsPlus}`);
console.log(`  departed                       ${summary.departedStudents}`);
console.log(`    median lifetime              ${summary.medianLifetimeYears}y   longest ${summary.longestLifetimeYears}y`);
console.log(`    median lessons before going  ${summary.medianLessonsBeforeLeaving}`);
console.log(`    left within 3 months         ${summary.departuresWithinThreeMonths}`);
console.log(`      of which never really started (0-1 lessons)  ${summary.departuresNeverStarted}`);

console.log('\n── Survival by starting cohort ──────────────────────────');
console.log('  share still attending N months after their first lesson.');
console.log('  "." = that cohort has not existed long enough to say.\n');
console.log(`  ${'cohort'.padEnd(8)}${'n'.padStart(5)}   ${['3mo', '6mo', '12mo', '24mo'].map((h) => h.padStart(5)).join('')}`);
for (const cohort of cohorts) {
  console.log(
    `  ${cohort.cohort.padEnd(8)}${String(cohort.started).padStart(5)}   `
    + cohort.horizons.map((h) => pct(h.rate).padStart(5)).join(''),
  );
}
console.log('\n  Read down a column, not across a row: comparing cohorts at the');
console.log('  SAME horizon is the only fair comparison. Average lifetime by');
console.log('  cohort always falls for recent years and means nothing.');

if (failures.length) {
  console.log(`\n  ${failures.length} unreadable: ` + failures.slice(0, 5).map((f) => `${f.name || f.id} (${f.error})`).join(', '));
}

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply to update Sheets.');
  process.exit(0);
}

const { appendLifecycleSnapshotRow, replaceStudentLifecycleRows } = await import(
  '../lib/admin/sheets/student-lifecycle.mjs'
);
const { appendPlanningProgressLogRow, getPlanningItemRows, upsertPlanningItemRow } = await import(
  '../lib/admin/sheets.js'
);
const { buildLifecyclePlanningItem, buildLifecycleProgressNote, LIFECYCLE_PLANNING_ID } = await import(
  '../lib/admin/lifecycle-reminder.mjs'
);

const { written } = await replaceStudentLifecycleRows(rows);
console.log(`\nStudent_Lifecycle: wrote ${written} rows`);

const notes = `${students.length} students read, ${failures.length} unreadable`;
await appendLifecycleSnapshotRow(summary, notes);
console.log('Lifecycle_Snapshot: appended 1 row');

// Book the next one. Without this the snapshot lane holds a single row forever
// and the retention trend — the entire point of keeping it — never exists.
const completedAt = new Date();
const existingRows = await getPlanningItemRows();
const existing = existingRows.find((row) => row.planningId === LIFECYCLE_PLANNING_ID) || {};
const planningItem = buildLifecyclePlanningItem({ completedAt, existingItem: existing });

await upsertPlanningItemRow(planningItem);
await appendPlanningProgressLogRow({
  progressId: `planning_progress_lifecycle_${completedAt.toISOString().replace(/[^A-Za-z0-9]/gu, '_')}`,
  planningId: planningItem.planningId,
  progressNote: buildLifecycleProgressNote(summary, { unreadable: failures.length }),
  progressType: 'action_completed',
  createdAt: completedAt.toISOString(),
  createdBy: 'local_lifecycle_script',
});

console.log(`Next retention review booked for ${planningItem.targetDate}`);
