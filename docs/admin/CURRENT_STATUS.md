# Admin Current Status

Last updated: 2026-05-14

This is the tracked current-status entrypoint for agents working from the `music-school-dashboard` repository.

The local workspace file `../CURRENT_HANDOVER.md` may contain extra machine/session context, but this file is the durable repo-tracked source for current admin-dashboard direction.

## Active Direction

V3 is focused on closing loops:

1. detect or surface a recurring admin problem
2. show enough context to make the right decision
3. provide a bounded action path
4. store the outcome
5. log consequential actions

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

## Current Slice

Waiting-list closeout has been added to onboarding:

- successful onboarding marks matching waiting-list records as `onboarded`
- sibling-group onboarding closes both waiting records
- existing waiting notes are preserved with an auto-close line appended
- closeout writes an `Event_Log` row
- onboarding success UI confirms which MMS IDs were closed out
- closeout failure is reported as a warning without hiding successful onboarding

Before deployment, verify with:

```bash
npm run test:admin
npm run build
```

## Best Next Slices

1. **Verify waiting-list closeout against real data**
   - Test one real onboarding flow locally.
   - Confirm `Waiting_List_State` shows `onboarded`.
   - Confirm `Event_Log` records `waiting_onboarded_by_onboarding`.

2. **Identity mismatch clarity in `/admin/flags`**
   - When a registry-only or sheets-only issue has a likely same-name/different-MMS-ID match, show that clue.
   - Keep this as a diagnostic hint, not an auto-fix.

3. **Pause loop maturity**
   - Make pause issue cards clearer about whether the mismatch comes from `Pause History`, sheet expectation, or live Stripe.
   - Keep Stripe pause/resume mutation commands out of scope.

4. **Communication draft layer**
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
- Stripe = payment-provider truth
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
