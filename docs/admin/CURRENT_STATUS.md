# Admin Current Status

Last updated: 2026-05-16

This is the tracked current-status entrypoint for agents working from the `music-school-dashboard` repository.

The local workspace file `../CURRENT_HANDOVER.md` may contain extra machine/session context, but this file is the durable repo-tracked source for current admin-dashboard direction.

## Active Direction

V3 established the dashboard's loop-closing pattern:

1. detect or surface a recurring admin problem
2. show enough context to make the right decision
3. provide a bounded action path
4. store the outcome
5. log consequential actions

V4 is now adding lightweight context layers on top of those loops. The goal is to make each student, issue, payment, and workflow easier to understand and delegate without adding a large state machine or new database.

The active surface is the private admin dashboard under `/admin`.

## Recent Completed Work

- Persistent `/admin/flags` issue loop using `Issue_Queue` and `Event_Log`
- calmer flag cards with clearer primary actions and collapsed detail
- system-cleared bulk resolve for stale no-longer-detected issues
- active issue summary counts instead of historical noise
- payment-mode and payment-expectation policy fields
- live/manual Stripe checks, including payment failure visibility
- pause-history expectation checks, including future pause windows treated as upcoming rather than current
- pause/payment action audit trail
- waiting-list state and notes
- waiting-list closeout through successful onboarding
- recurring workflow surfaces for showcase and holiday operations
- V4 derived lifecycle context on student detail and relevant flags
- V4 MMS schedule context cached into `Schedule_Context`
- V4 baseline payment value context using schedule duration and current pricing
- first read-only capacity view at `/admin/capacity`
- waiting-list capacity hints on `/admin/waiting`
- V4.1 first performance/navigation pass: shared MMS free-slot cache plus grouped admin nav
- V4.1 scalable navigation model: top nav is now Overview, Issues, Workflows, and Planning, with student lookup as a header utility
- waiting cards now show MMS sign-up context, parsed note facts, parent/contact phone when available, and the full MMS note behind a detail toggle

## Current Slice

The active V4 slice is context layering, not new automation.

- `deriveStudentLifecycleStatus()` is read-only context. It does not change issue generation, onboarding, Stripe actions, or stored state.
- `Schedule_Context` is a cached Sheets tab populated from MMS calendar events. It is refreshed manually per student or by the bulk schedule refresh route, not on every page load.
- Payment value context is baseline operational context only. It uses the cached schedule duration and school price table.
- Shared MMS lesson slots are treated as group lessons when multiple students have the same teacher, next lesson start, and duration in `Schedule_Context`.
- For example, Emily Grifa and Nina Gavlin share a 45 minute slot, so each should show group pricing: `£20/week`, not one-to-one 45 minute pricing.
- `/admin/capacity` reads current free capacity from MMS calendar events with category `Free`. This is the right starting source for real available slots; do not duplicate those into a new Sheets tab unless a manual overlay becomes necessary.
- `/admin/capacity` and `/admin/waiting` share a short-lived server cache for MMS `Free` calendar slots via `getMmsFreeCalendarSlotContext()`, so navigating between those pages should not trigger repeated MMS calendar searches inside the cache window.
- The same capacity page also shows schedule-cache health so student schedule hardening remains visible.
- `/admin/waiting` now parses instruments from the MMS sign-up note and shows possible free slots only when the tutor teaches the parsed instrument. These are hints only; they do not reserve slots, assign tutors, send messages, or start onboarding.
- `/admin/waiting` is the placement/contact decision surface: it shows parent contact details, MMS note context, and possible capacity matches before handing off to `/admin/onboard` for execution.
- Admin navigation is intentionally action-led:
  - `Overview` = today's operating summary
  - `Issues` = detected problems and issue-loop actions
  - `Workflows` = waiting list, onboarding, showcase, holidays, and future task/communication flows
  - `Planning` = capacity, schedule health, seasonal planning, and future finance/capacity layers
- Student records remain important context, but they are accessed through header search, issue links, workflow links, or `/admin/students`; they are not a primary top-nav mode.

Before deployment, verify with:

```bash
npm run test:admin
npm run build
```

## Best Next Slices

1. **V4.1 performance hardening**
   - Add TTL caching to other expensive overview checks if they still feel slow, especially MMS/GitHub health.
   - Keep automatic cohort-wide API calls rare; prefer cached summaries plus explicit refresh actions.
   - Review which admin pages should be daily top-level navigation versus planning/background tools.

2. **Schedule context hardening**
   - Confirm the bulk MMS schedule refresh is cheap enough operationally.
   - Review edge cases: group lessons, substitute teachers, one-off lessons, missing future calendar events.
   - Use `/admin/capacity` to monitor stale, missing, low-confidence, and shared schedule cache records.

3. **Payment value refinement**
   - Keep values baseline, not accounting.
   - Add only small explanations where value affects payment flags or prioritisation.

4. **Waiting-list capacity matching refinement**
   - Improve ranking for multi-instrument enquiries.
   - Add day/time preference parsing only if the MMS notes reliably contain it.
   - Keep matches as suggestions until the placement workflow is intentionally designed.

5. **Pause loop maturity**
   - Make pause issue cards clearer about whether the mismatch comes from `Pause History`, sheet expectation, or live Stripe.
   - Keep Stripe pause/resume mutation commands out of scope.

6. **Contact role model**
   - Clarify billing/admin contact roles before any message automation.

7. **Future capacity overlay**
   - Add future-hire or tentative availability only after the MMS `Free` slot view is useful.
   - Keep this separate from real MMS calendar availability.

8. **Communication draft layer**
   - Add draft and approval records before any WhatsApp Cloud API integration.
   - Do not auto-send.

## Do Not Do Next

- Do not add heavy assignment/owner systems yet.
- Do not wire WhatsApp auto-send.
- Do not add Stripe mutation commands from `/admin/flags`.
- Do not create a new database just to replace Sheets.
- Do not make flags more complex than necessary.
- Do not edit generated dashboard config files directly.

## Source Of Truth

- Google Sheets `Students` = operational school truth
- `lib/config/students-registry.js` = portal/dashboard registry truth
- MMS = lesson and billing-profile operational truth
- MMS calendar category `Free` = current real free-slot truth
- Stripe = payment-provider truth
- `Schedule_Context` = dashboard cache of selected MMS lesson context
- `Pause History` = intentional pause-window truth
- generated FC tabs and generated dashboard config files = derived outputs

## Read Order

1. `docs/admin/CURRENT_STATUS.md`
2. `docs/admin/V3_LOOP_ARCHITECTURE.md`
3. `docs/admin/INDEX.md`
4. `docs/admin/ADMIN_IMPLEMENTATION_LOG.md`
5. `docs/admin/OWNERSHIP_MATRIX.md`
6. `docs/admin/SCHOOL_POLICY.md`
7. `docs/admin/PAYMENTS_RULES.md` if working on Stripe or pauses

Treat V1/V2 drafts and session handoff files as historical unless this file points to them.
