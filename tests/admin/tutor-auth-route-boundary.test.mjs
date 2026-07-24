import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const protectedRouteUrls = [
  '../../app/api/sync/route.js',
  '../../app/api/students/route.js',
  '../../app/api/tutor-schedule/route.js',
  '../../app/api/notes/[studentId]/route.js',
  '../../app/api/song-assignments/route.js',
  '../../app/api/song-outcomes/route.js',
  '../../app/api/song-requests/route.js',
].map((path) => new URL(path, import.meta.url));

test('every tutor-dashboard data route applies the session boundary', async () => {
  for (const routeUrl of protectedRouteUrls) {
    const source = await readFile(routeUrl, 'utf8');
    assert.match(
      source,
      /requireTutorDashboardAccess/u,
      `${routeUrl.pathname} must enforce the tutor session when pilot mode is enabled`,
    );
  }
});

test('the dashboard server page redirects unauthorised pilot users before rendering', async () => {
  const source = await readFile(
    new URL('../../app/dashboard/page.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /getTutorDashboardAccess\(\)/u);
  assert.match(source, /access\.enforced && !access\.authorized/u);
  assert.match(source, /redirect\('\/tutor\/login'\)/u);
  assert.match(source, /filterTutorOptionsForAccess/u);
});

test('student portal notes retain their separate family-code boundary', async () => {
  const source = await readFile(
    new URL('../../app/api/student-portal/[studentId]/notes/route.js', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /requireTutorDashboardAccess/u);
});
