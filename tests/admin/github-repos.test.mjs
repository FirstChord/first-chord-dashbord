import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BRAIN_REPO,
  DEFAULT_DASHBOARD_REPO,
  getDashboardRepo,
} from '../../lib/admin/github-repos.mjs';

test('the default is the repository name GitHub actually serves today', () => {
  // Deliberately asserts the misspelling. When the repo is renamed this test is
  // the reminder that the default has to move with it, not a typo to tidy up.
  assert.equal(DEFAULT_DASHBOARD_REPO, 'FirstChord/first-chord-dashbord');
  assert.equal(BRAIN_REPO, 'FirstChord/first-chord-brain');
  assert.equal(getDashboardRepo({}), DEFAULT_DASHBOARD_REPO);
});

test('GITHUB_DASHBOARD_REPO overrides the default so a rename needs no deploy', () => {
  assert.equal(
    getDashboardRepo({ GITHUB_DASHBOARD_REPO: 'FirstChord/first-chord-dashboard' }),
    'FirstChord/first-chord-dashboard',
  );
});

test('a blank or whitespace override falls back rather than requesting /repos/', () => {
  assert.equal(getDashboardRepo({ GITHUB_DASHBOARD_REPO: '' }), DEFAULT_DASHBOARD_REPO);
  assert.equal(getDashboardRepo({ GITHUB_DASHBOARD_REPO: '   ' }), DEFAULT_DASHBOARD_REPO);
  assert.equal(getDashboardRepo({ GITHUB_DASHBOARD_REPO: '  FirstChord/x  ' }), 'FirstChord/x');
});
