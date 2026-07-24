---
status: active-plan
audience: [human, agent]
last_verified: 2026-07-24
---

# Tutor dashboard Google-login pilot

## Objective

Move the tutor dashboard from self-selected public identity to exact-email
Google authentication without disrupting the established student portals or
forcing every tutor through an untested login flow at once.

The first pilot uses `musiclessons@firstchord.co.uk`, shared by Finn and Tom.
That account is an existing admin identity and deliberately receives full tutor
dashboard access, including the tutor selector. It proves that an approved
First Chord operator is signed in, but it cannot distinguish Finn from Tom in
audit history. Do not label either person individually from this shared session.

## Current phase

Phase 1 is implemented:

- `TUTOR_DASHBOARD_AUTH_MODE=pilot` makes the canonical service require a
  Google session for `/dashboard` and its roster, schedule, notes, and song
  APIs;
- existing admins receive full tutor-dashboard access;
- a separate full-access email list and exact email-to-tutor map are available
  for later non-admin accounts;
- the login screen requests only Google's basic account identity and makes clear
  that Gmail access is not requested;
- the legacy `efficient-sparkle` service remains in auth mode `off` during the
  pilot, so it is still public and the school must not describe the overall
  dashboard as secured yet.

Canonical pilot URL:

```text
https://first-chord-dashbord-production.up.railway.app/dashboard
```

Legacy comparison/fallback URL:

```text
https://efficient-sparkle-production.up.railway.app/dashboard
```

## Configuration

Set these only on the canonical admin service for the first pilot:

```text
TUTOR_DASHBOARD_AUTH_MODE=pilot
```

The shared `musiclessons@firstchord.co.uk` account already receives full access
because it is in `ADMIN_ALLOWED_EMAILS`. No tutor email needs to be committed to
Git.

Later options:

```text
TUTOR_DASHBOARD_FULL_ACCESS_EMAILS=operations@example.com
TUTOR_DASHBOARD_EMAIL_MAP={"tom@example.com":"Tom","cover@example.com":["Finn","Tom"]}
```

The full-access list is for trusted operators who need every tutor profile. The
map is for ordinary tutors and must use exact addresses; never whitelist the
whole `gmail.com` domain. The compact `email=Tutor,email=Tutor` map syntax is
also accepted for emergency/manual configuration.

## Pilot checks

Test with Finn/Tom on both a phone and a computer:

1. A private browser opening the canonical pilot URL reaches `/tutor/login`.
2. `musiclessons@firstchord.co.uk` signs in and can select Finn, Tom, and other
   tutor profiles.
3. Roster, today's schedule, recent notes, note history/summary, song
   assignments, song requests/outcomes, and Practice Chat still open normally.
4. Signing out returns to `/tutor/login`; reopening the dashboard requires an
   approved session.
5. An unapproved Google account is denied.
6. The public Test Studenty/student-profile flow is unchanged.

Do not use a real parent email as an automated smoke test for Practice Chat.
Use the normal recipient-specific human confirmation if a real lesson note is
tested.

## Success gates before wider rollout

- Finn/Tom complete several normal dashboard sessions without login friction.
- Mobile account selection, session persistence, and sign-out are understood.
- Unauthenticated calls to every protected tutor API fail on the canonical
  service.
- A synthetic or agreed pilot account proves that a scoped tutor can open only
  their mapped tutor profile.
- Removing an account from authorization is tested and takes effect on the next
  request/session check.
- Every active tutor has one verified login email and a confirmed tutor key.
- The legacy public dashboard is redirected or put behind the same gate.

Only after all gates pass may the project describe the tutor dashboard as
private or bind `acting_tutor` audit labels to authenticated identity.

## Email storage decision

The pilot deliberately uses environment configuration. It is small, reversible,
and keeps personal login addresses out of Git.

If email maintenance becomes cumbersome, add a managed `Tutor_Access` Sheets
lane through a separate reviewed change. That change must define headers,
authorization owner, fail-closed behavior, cache/revocation time, admin editing,
audit history, backup coverage, and recovery in
`docs/architecture/data/state-tabs.md`. Do not make a manually created,
undocumented tab an authorization source.

## Implementation map

| Responsibility | Source |
|---|---|
| Google sign-in and session roles | `lib/admin/auth.js` |
| Pure email mapping/access rules | `lib/tutor-auth-helpers.mjs` |
| Server session enforcement | `lib/tutor-auth.js` |
| Tutor login UI | `app/tutor/login/page.js`, `components/tutor-dashboard/TutorAuthButton.js` |
| Protected dashboard composition | `app/dashboard/page.js`, `app/dashboard/page-client.js` |
| Protected data boundaries | `app/api/sync/`, `app/api/students/`, `app/api/tutor-schedule/`, `app/api/notes/`, `app/api/song-assignments/`, `app/api/song-outcomes/`, `app/api/song-requests/` |
| Focused contracts | `tests/admin/tutor-auth-helpers.test.mjs`, `tests/admin/tutor-auth-route-boundary.test.mjs`, `tests/admin/tutor-surface-token.test.mjs` |

## Rollback and recovery

- Set `TUTOR_DASHBOARD_AUTH_MODE=off` on the canonical service and redeploy to
  restore the previous low-friction behavior. This reopens the known public
  trust boundary; use it only as a time-bounded pilot rollback.
- A Google-login failure does not require changing student portal access,
  Practice Chat delivery claims, MMS, or Sheets state.
- Confirm `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, and the Google OAuth callback URL using the main
  operations runbook.
- Do not add the shared musiclessons account to a second identity mapping or
  infer whether Finn or Tom acted from a shared session.

## Next decision

After the Finn/Tom pilot, choose one or two tutors with their own Google
addresses for the scoped pilot. Confirm the email-to-tutor map and test
cross-tutor denial before creating a Sheets-backed access registry or cutting
over the full roster.
