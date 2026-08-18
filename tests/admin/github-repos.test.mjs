import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BRAIN_REPO,
  DEFAULT_DASHBOARD_REPO,
  getDashboardRepo,
} from '../../lib/admin/github-repos.mjs';

test('the default is the repository name GitHub actually serves today', () => {
  // Pinned deliberately: GitHub redirects the previous name, so a wrong default
  // here fails silently on reads and only bites on the registry write.
  assert.equal(DEFAULT_DASHBOARD_REPO, 'FirstChord/first-chord-dashboard');
  assert.equal(BRAIN_REPO, 'FirstChord/first-chord-brain');
  assert.equal(getDashboardRepo({}), DEFAULT_DASHBOARD_REPO);
});

test('GITHUB_DASHBOARD_REPO overrides the default so a rename needs no deploy', () => {
  assert.equal(
    getDashboardRepo({ GITHUB_DASHBOARD_REPO: 'FirstChord/renamed-later' }),
    'FirstChord/renamed-later',
  );
});

test('a blank or whitespace override falls back rather than requesting /repos/', () => {
  assert.equal(getDashboardRepo({ GITHUB_DASHBOARD_REPO: '' }), DEFAULT_DASHBOARD_REPO);
  assert.equal(getDashboardRepo({ GITHUB_DASHBOARD_REPO: '   ' }), DEFAULT_DASHBOARD_REPO);
  assert.equal(getDashboardRepo({ GITHUB_DASHBOARD_REPO: '  FirstChord/x  ' }), 'FirstChord/x');
});
