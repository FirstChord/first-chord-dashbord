# FirstChord Admin Dashboard — V2 Spec

## Architectural Clarifications

### 1. Brain in V2
`first-chord-brain` does not become a live REST API in V2.

In V2, Brain remains a codebase and job-run logic layer:
- Python job logic can run in GitHub Actions
- it is not yet a long-running hosted service
- hosted worker/API decisions are deferred until there is a real second consumer or a strong operational reason

### 2. Job runner in V2
GitHub Actions is the first V2 job runner.

Use it for:
- `generate-configs`
- `generate_fc_ids.py`

Do not add browser shell exec.

### 3. Existing dashboard safety
The current tutor/student dashboard remains production-critical.
V2 must continue to isolate admin work and avoid regressions to the existing dashboard.

### 4. Recurring lesson deduplication
Recurring lesson deduplication is required before wider onboarding rollout.

Before creating a recurring MMS lesson:
- query the real MMS event search mechanism
- check for an existing lesson/series for the same student, tutor, day, and time
- if found, do not create a duplicate

### 5. Tutor alignment
Tutor alignment is a workflow-level dual-write guarantee, not a true transaction.
Sheets tutor and registry tutor must each have separate success/failure visibility.

### 6. Issue state persistence
`Review_Flags` remains a generated snapshot.
Persistent issue state must live in a separate store.
For V2, a separate `Issue_Queue` sheet/tab is acceptable.

### 7. Review_Flags freshness
The admin dashboard must show flag freshness clearly.
Admins should be able to see when the current generated flags were last refreshed.

### 8. Instrument ownership
Instrument should move toward Sheets authority in V2, but only after current safety work is complete.

## Purpose

V2 is about making the existing admin workflows safer and more operationally trustworthy.

It is not mainly about adding new UI.
It is about:
- hardening onboarding
- removing fragile manual steps
- making issue handling stateful
- preparing for future payments, messaging, and agent workflows

## Current V1 Baseline

V1 already provides:
- admin auth
- student detail + edits
- waiting list
- onboarding across Sheets + registry + MMS
- recurring lesson support
- flags/issues page
- safe `REGISTRY ONLY` delete
- onboarding step tracking
- onboarding completion-status output
- automated tests for core admin logic

Current V1 gaps:
- recurring lesson dedupe not yet enforced
- registry write conflict retry not yet implemented
- tutor source duplication still exists in `tutors.js`
- `generate_fc_ids.py` is still manual
- `generate-configs && git push` is still manual
- issue state is not persistent
- onboarding is not yet resumable
- Review_Flags freshness is not surfaced enough
- two independent parsers for `students-registry.js` still exist

## Phase 1 — Safety and Correctness

### 1. Recurring lesson deduplication
Before creating a recurring MMS lesson:
- search MMS for existing matching lessons/series
- if one exists, skip creation and return the existing reference

This is the highest-priority V2 safety item.

### 2. Onboarding preflight checks
Before writing anything:
- check for existing Sheets row for the `mms_id`
- check for existing registry entry for the `mms_id`
- check MMS student status
- check existing MMS billing profile for the selected tutor
- check whether a matching lesson likely already exists

Show the preflight result before final confirmation.

### 3. Idempotent MMS step behavior
Make each MMS step check current live state before writing:
- activation: skip if already active
- billing profile: reuse existing if already present
- lesson creation: skip if matching lesson already exists

### 4. Concurrent registry write protection
Improve GitHub Contents API writes with retry-on-409 behavior:
- refetch latest SHA
- retry write safely
- surface a clear user-facing error if retry still fails

### 5. Tutor dual-write at onboarding
For new onboardings:
- write Sheets tutor
- write registry tutor
- track each result separately

Goal:
- stop creating new tutor conflicts for newly onboarded students

### 6. Unify tutor source
Remove the current duplicated tutor maintenance burden.
Create one canonical tutor source that both:
- admin onboarding
- Brain/generation logic
can consume

This can be:
- a shared JSON file
- or another simple shared source

### 7. MMS health check
Add a lightweight MMS health signal to the admin home page so token/config failures are visible quickly.

## Phase 2 — Infrastructure and Automation

### 1. Credential migration for generate_fc_ids.py
Before GitHub Actions can run `generate_fc_ids.py`, Brain must support Sheets auth via env vars, not only `~/token_musiclessons.json`.

Add support for:
- `SHEETS_REFRESH_TOKEN`
- `SHEETS_CLIENT_ID`
- `SHEETS_CLIENT_SECRET`

Keep local-file support if needed, but make env-var execution first-class.

### 2. generate-configs GitHub Action
Automate dashboard config generation:
- trigger on registry changes
- run `generate-configs`
- commit derived outputs
- let normal deploy flow continue

This removes one manual onboarding step.

### 3. generate_fc_ids.py via workflow dispatch
From the admin dashboard:
- dispatch a GitHub Actions workflow
- run the FC regeneration job
- poll workflow status
- show job state in admin

### 4. Scheduled reconciliation
Once the FC regeneration workflow exists, add scheduled runs as needed.
This belongs here, not in a later “intelligence” phase.

### 5. Review_Flags freshness visibility
Prominently surface:
- last generated date/time
- whether flags are fresh or stale

### 6. Instrument migration to Sheets
After safety work is stable:
- add/finalize authoritative instrument field in Sheets
- backfill from registry
- make onboarding write it consistently

This should be treated as a standalone migration, not mixed into the earliest safety pass.

## Phase 3 — Issue Queue and Recovery

### 1. Design Issue_Queue reconciliation rules first
Before building `Issue_Queue`, define what happens when:
- a generated Review_Flag disappears
- but a persisted issue row still exists

This needs an explicit rule.

Possible model:
- dashboard cross-references `Review_Flags` and `Issue_Queue`
- issues can show `resolved_upstream` when the source flag disappears
- human resolution remains separate from source regeneration

### 2. Add Issue_Queue
Create a separate writable issue-state store with fields like:
- issue ID
- type
- linked student / mms_id
- owner
- state
- created / updated timestamps
- notes
- resolution rule
- snooze date if needed

### 3. Add issue states and ownership
Recommended states:
- `open`
- `acknowledged`
- `in_progress`
- `resolved`
- `wont_fix`
- `snoozed_until`

Recommended owners:
- `unassigned`
- `finn`
- `tom`

### 4. Add resolution actions to /admin/flags
Examples:
- `TUTOR_CONFLICT`
  - update Sheets tutor to match registry
  - update registry tutor to match Sheets
- `REGISTRY_ONLY`
  - delete registry entry
- `SHEETS_ONLY`
  - create minimal registry stub

### 5. Onboarding resume/recovery
Treat this as a proper feature, not a small hardening tweak.

Add:
- live status endpoint for onboarding progress
- resume action that reruns only incomplete steps
- clear distinction between:
  - recorded success
  - confirmed live system state

### 6. Define a backlog target
Set an explicit operational goal, for example:
- zero `TUTOR_CONFLICT` issues by end of Phase 3

Without a target, issue tooling risks existing without systematic cleanup.

## Phase 4 — Intelligence Layer

### 1. Stripe/payment issue detection
Add payment-related issue types:
- `PAYMENT_FAILED`
- `BILLING_SUSPENDED`
- `ACTIVE_WITHOUT_SUBSCRIPTION`
- `SUBSCRIPTION_STATE_MISMATCH`

### 2. WhatsApp-ready issue categories
Add issue types and data rules for future messaging workflows:
- missing contact number
- onboarding follow-up needed
- payment reminder candidate
- portal setup incomplete
- lesson setup follow-up

### 3. Agent-operable issue types
Design some issue categories to be safely resolvable by bounded agents later.

### 4. Revisit Brain as hosted worker only if needed
Only move Brain toward a hosted worker/API if a real usage pattern demands it:
- second consumer
- scheduled intelligence workflows
- richer multi-surface orchestration

## Key Risks

### 1. generate_fc_ids.py Action blocker
If env-var-based Sheets credentials are not added to Brain first, the GitHub Actions plan for FC regeneration will fail.

### 2. Concurrent registry writes
Without retry-on-409 behavior, admin concurrency will produce opaque failures.

### 3. Two parsers for students-registry.js
Python and JS currently parse the same file independently.
V2 should define a stable format contract and test parity rather than letting them drift.

### 4. tutors.js drift
Tutor changes currently require updates in more than one place.
This should be fixed early.

### 5. Issue_Queue reconciliation ambiguity
If the relationship between generated flags and persisted issue state is not designed first, implementation will drift into confusion.

## Strongest Next Implementation Step

1. recurring lesson deduplication
2. concurrent registry write protection

These are the two highest-value current safety improvements before more automation is added.
