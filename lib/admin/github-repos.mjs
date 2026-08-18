/** @fileoverview Single source of the GitHub repositories the dashboard calls, so a repo rename is an env change rather than a code hunt. */

// The dashboard's own repository name is misspelled on GitHub ("dashbord").
// Renaming it must not require a deploy to land first, so the live name is the
// default here and `GITHUB_DASHBOARD_REPO` overrides it: set the new full name
// in the Railway env at the moment of the rename, confirm a registry write still
// commits, then change this default at leisure. Unsetting the variable is the
// rollback.
//
// The name must always be exact. GitHub redirects a GET for a renamed repo, but
// the registry write is a PUT, and a redirect on a non-GET method is where the
// request body gets dropped — so this is never allowed to lean on the redirect.
export const DEFAULT_DASHBOARD_REPO = 'FirstChord/first-chord-dashbord';
export const BRAIN_REPO = 'FirstChord/first-chord-brain';

export function getDashboardRepo(env = process.env) {
  return `${env.GITHUB_DASHBOARD_REPO || ''}`.trim() || DEFAULT_DASHBOARD_REPO;
}
