---
status: canonical
audience: [human, agent]
last_verified: 2026-07-24
---
# Tutor And Student Surface Security

## Current Trust Boundaries

| Surface | Current gate | Treat as |
| --- | --- | --- |
| `/admin/*`, `/api/admin/*` | allowed Google account | authenticated admin |
| canonical `/dashboard` tutor roster | Google session when `TUTOR_DASHBOARD_AUTH_MODE=pilot|required` | authenticated pilot operator or mapped tutor |
| legacy `efficient-sparkle` `/dashboard` | low-friction public route while pilot mode is off there | staff-convenience surface, not durable tutor identity |
| raw student notes API | short-lived per-student capability issued with roster | narrow capability, not general account auth |
| student friendly URL | guessable public path/server rendering | public surface; avoid contact/provider secrets |
| MMS proxy/admin routes | admin session before server token use | privileged integration boundary |
| Practice Chat handoff | shared secret/origin plus self-attested tutor/student check | narrow accepted write exception, not verified identity |

The canonical service has a staged Google-login pilot. The first approved
account is shared by Finn and Tom and therefore proves an authorised
full-dashboard operator, not which person acted. The legacy public service still
allows self-selection during the pilot. A roster or capability token from that
legacy path proves only possession/context; do not represent `acting_tutor` as
verified until the public route is closed and individual mapped accounts are in
use.

## Guardrails

- Never expose server credentials, broad Sheets/MMS/Stripe reads, or arbitrary
  provider proxies to a public client.
- Prefer server-rendered projections or short-lived resource-scoped capabilities
  over arbitrary MMS IDs.
- Keep parent contacts, provider identifiers, payroll, payment, and broad student
  context off unauthenticated responses unless a separately reviewed narrow
  contract requires them.
- Capability tokens must be scoped, expiring, validated server-side, and must not
  become reusable general tutor credentials.
- A shared browser secret is coarse caller protection; it is not human identity.

## Practice Chat Exception

Practice Chat may update the selected MMS attendance and send one reviewed
lesson-note email only through the contract in
[Practice Chat delivery](../../workflows/practice-chat/delivery.md). The server
requires one unambiguous recorded tutor matching the self-attestation, shows the
server-derived student/recipient, requires recipient-specific human
confirmation, and claims the delivery key before provider work.

This exception does not permit other tutor-surface MMS writes, general Gmail or
WhatsApp sending, payment/registry changes, or broader sensitive reads.

## Current Security Step

Complete the staged tutor Google-login pilot in
[the active plan](../../plans/active/tutor-dashboard-auth-pilot.md): verify the
shared full-access account, pilot an exact-email scoped tutor, then close or
redirect the legacy public dashboard. Do this before persistent tutor
preferences, cross-period payroll history, broader student data, or new
consequential writes.

Migrate self-attested audit labels only after the authenticated identity is
actually bound to the action. The shared Finn/Tom account must never be
attributed to either individual.

Any new low-friction exception must document data projection, capability scope,
expiry, consequence, confirmation, audit, failure path, and why tutor auth was
not first.
