/** @fileoverview Single source of the GitHub repositories the dashboard calls, so a repo rename is an env change rather than a code hunt. */

// Renamed from the misspelled `first-chord-dashbord` on 2026-08-18. GitHub still
// redirects the old name, but the name here must always be exact: the registry
// write is a PUT, and a redirect on a non-GET method is where a request body can
// be dropped, so this is never allowed to lean on the redirect.
//
// `GITHUB_DASHBOARD_REPO` overrides the default so that a future rename needs no
// deploy — set the variable at the moment of the rename, confirm a registry write
// still commits, then move this default. Unsetting the variable is the rollback.
export const DEFAULT_DASHBOARD_REPO = 'FirstChord/first-chord-dashboard';
export const BRAIN_REPO = 'FirstChord/first-chord-brain';

export function getDashboardRepo(env = process.env) {
  return `${env.GITHUB_DASHBOARD_REPO || ''}`.trim() || DEFAULT_DASHBOARD_REPO;
}
