---
status: parked
audience: [human, agent]
last_verified: 2026-08-18
---
# Dashboard Custom Domain

## Why

Tutors reach the dashboard at
`https://first-chord-dashbord-production.up.railway.app/dashboard` — a
Railway-generated hostname carrying a misspelling ("dashbord"). It is the URL
they are given and bookmark, so it is not an internal address.

The GitHub repository was renamed to `FirstChord/first-chord-dashboard` on
2026-08-18. That is a separate system and changed nothing here: the Railway
domain is generated from the Railway **service** name, which is still
`first-chord-dashbord` inside project `pure-spontaneity`.

## Why not simply rename the Railway service

`railway domain --help` states there is a **maximum of one Railway-provided
domain per service**, so old and new generated domains cannot run side by side.
A rename is a hard cutover, and these all have the current host baked in:

- five cron workflows (`finance-snapshot`, `lesson-mirror`, `refresh-schedules`,
  `pause-expectations`, `stripe-amounts`) — each `exit 1`s on a bad response, so
  breakage is at least loud rather than silent
- `components/navigation/QuickLinks.js`
- `tools/whatsapp-incoming-bridge/bridge.js`
- `NEXT_PUBLIC_PRACTICE_CHAT_DASHBOARD_BASE_URL`
- the Practice Chat PWA, which is a separate repository and deploy (unverified)
- tutor bookmarks

A rename would also leave the misspelling behind on the other service:
`efficient-sparkle` additionally serves
`first-chord-dashbord-production-d599.up.railway.app`.

## The approach instead

Add a **custom domain**, which is a separate list from the generated one and has
no max-of-one limit, so both serve at once and there is no cutover:

1. Find where DNS for `firstchord.co.uk` is managed (registrar, or possibly the
   WordPress host). **This is the only step with an unknown in it.**
2. `railway domain dashboard.firstchord.co.uk` — Railway returns the CNAME to add
   and issues the certificate once it resolves.
3. Add the CNAME; verify the host serves the dashboard.
4. Migrate the references above one at a time, verifying each.
5. Give tutors the new URL when convenient.

Nothing is purchased: `firstchord.co.uk` is already owned, and a subdomain is
just a DNS record. The old URL keeps working throughout, so there is no deadline.

This is distinct from the existing WordPress student-portal rule
(`docs/operations/integrations/wordpress-redirects.md`), which *redirects* and so
still leaves the Railway hostname in the address bar. A custom domain serves
directly and does not.

## Resume when

Someone has confirmed where `firstchord.co.uk` DNS is administered. Until then
the misspelling is cosmetic and confined to a generated hostname — the
repository, the code and the docs are all consistent and correct.
