# First Chord OS Agent Guide

This file applies to the whole repository. It is the short, repository-contained
entry point for coding agents. Keep durable detail in the linked docs instead of
copying it here.

## Before Making A Change

1. Read `docs/admin/CURRENT_STATUS.md` for the active system state.
2. Read `docs/admin/STATE_TABS_SCHEMA.md` for data ownership, keys, writers,
   caches, logs, concurrency, and retention limits.
3. Read the focused workflow doc and tests from the map below.
4. For auth, deployment, credentials, integration health, backups, or recovery,
   read `docs/admin/OPERATIONS_RUNBOOK.md` and
   `docs/admin/HYGIENE_AND_SECRETS.md`.
5. Inspect the current implementation before trusting historical docs. Current
   code and tests beat stale snapshots, but a conflict with a canonical doc must
   be resolved or called out rather than silently ignored.

External handovers and the Obsidian vault may add operating context, but they
must not be the only source of a safety-critical implementation rule.

## Repository Shape

- `app/admin/`: admin pages and server-rendered composition.
- `app/api/admin/`: authenticated admin mutation/read routes.
- `components/admin/`: interactive admin UI.
- `lib/admin/*.js`: integration and workflow orchestration.
- `lib/admin/*-helpers.mjs`: preferably pure business rules.
- `lib/admin/sheets/`: Google Sheets lane adapters.
- `tests/admin/`: focused Node tests, usually matching helper names.
- `docs/admin/`: current architecture, workflow, policy, and recovery docs.
- `lib/config/students-registry.js`: portal configuration source.
- `lib/student-url-mappings.js`, `lib/student-helpers.js`,
  `lib/soundslice-mappings.js`, `lib/config/instruments.js`, and the ignored
  Theta credential output: generated artifacts; do not edit them to compensate
  for an upstream problem.

## Truth And State Boundaries

`docs/admin/STATE_TABS_SCHEMA.md` is authoritative for dashboard-owned Sheets
lanes. The compact model is:

- MMS owns lessons, calendar events, attendance, and MMS student state.
- Stripe owns provider-side customer, subscription, invoice, and payment facts.
- Google Sheets owns First Chord operational records and workflow state.
- The student registry owns portal-specific configuration.
- `Issue_Queue` is managed workflow state, not the underlying problem truth.
- `Event_Log`, `Planning_Progress_Log`, and similar logs are append-only history.
- `Schedule_Context` and Stripe snapshot lanes are caches, not provider truth.
- Derived summaries and AI proposals must never become authoritative facts merely
  because they are displayed or stored.

When combining sources, preserve identifiers, source, freshness, and uncertainty.
Do not silently choose a winner for a new conflict type.

## Workflow Map

| Area | Main UI / API | Domain and storage code | Read before changing | Focused tests |
|---|---|---|---|---|
| Students and issues | `app/admin/students/`, `app/admin/flags/`, `app/api/admin/students/`, `app/api/admin/issues/` | `lib/admin/students.js`, `lib/admin/issues.js`, `lib/admin/issue-queue.js`, `lib/admin/sheets/students.mjs`, `lib/admin/sheets/issues.mjs` | `OWNERSHIP_MATRIX.md`, `V3_LOOP_ARCHITECTURE.md` | `student-detail-helpers`, `issues-helpers`, `issue-queue*`, `student-archive-helpers` |
| Waiting and onboarding | `app/admin/waiting/`, `app/admin/onboard/`, `app/api/admin/waiting/`, `app/api/admin/onboard/` | `lib/admin/waiting-workflow.js`, `lib/admin/onboarding.js`, `lib/admin/registry.js`, `lib/admin/mms.js` | `SCHOOL_POLICY.md`, `OWNERSHIP_MATRIX.md` | `waiting-workflow`, `onboarding-helpers`, `registry-helpers`, `mms-helpers` |
| Payments and finance | `app/admin/finance/`, student Stripe routes | `lib/admin/stripe.js`, `lib/admin/payment-*.mjs`, `lib/admin/finance-*.mjs`, `lib/admin/sheets/finance.mjs` | `PAYMENTS_RULES.md`, finance section of `CURRENT_STATUS.md` | `payments-helpers`, `payment-*`, `finance-*`, `stripe-*` |
| Payroll | `app/admin/finance/payroll/`, `app/api/admin/payroll/` | `lib/admin/payroll-*.mjs`, `lib/admin/tutor-statement*`, `lib/admin/wise-helpers.mjs`, `lib/admin/mms.js` | `docs/workflows/06-paying-tutors.md`, `STATE_TABS_SCHEMA.md` | `payroll-*`, `mms-payroll-attendance`, `tutor-statement-*`, `wise-helpers` |
| Pauses and tutor absence | `app/admin/workflows/tutor-absence/`, planning pause actions | `lib/admin/tutor-absence*`, `lib/admin/pause-*.mjs`, `lib/admin/planning*` | `TUTOR_ABSENCE_PAUSE_BRIDGE.md`, `TUTOR_ABSENCE_SAFETY_AND_UX.md`, `PAYMENTS_RULES.md` | `tutor-absence-helpers`, `pause-*`, `planning-helpers` |
| Planning and recurring workflows | `app/admin/planning/`, `app/admin/showcase/`, `app/admin/holidays/` | `lib/admin/planning*`, `lib/admin/showcase*`, `lib/admin/holiday-workflow*`, `lib/admin/sheets/workflows.mjs` | `WORKFLOW_DESIGN_PRINCIPLES.md` | `planning-*`, `showcase`, `holiday-workflow` |
| Incoming WhatsApp intake | `app/admin/incoming-messages/`, `app/api/admin/incoming-messages/` | `lib/admin/incoming-messages.js`, `lib/admin/incoming-*.mjs`, `lib/admin/sheets/incoming-messages.mjs`, `tools/whatsapp-incoming-bridge/` | `WHATSAPP_INCOMING_BRIDGE.md` | `incoming-*`, `whatsapp-bridge-outbound-guard` |
| Practice Chat and notes | `app/api/practice-notes/`, `app/api/admin/practice-notes/` | `lib/admin/practice-*.mjs`, `lib/admin/practice-notes-email.js`, `lib/admin/sheets/practice-notes.mjs` | `PRACTICE_CHAT_DELIVERY_AUDIT.md`, `PRACTICE_CHAT_WHISPER_HARDENING.md` | `practice-*` |
| Parent understanding and communications | `app/admin/workflows/parent-understanding/`, `app/admin/communications/` | `lib/admin/parent-understanding*`, `lib/admin/communications*` | `WORKFLOW_DESIGN_PRINCIPLES.md`, `COPY_AND_TONE.md` | `parent-understanding-*`, `communications-helpers` |
| Health and recovery | health panels, cron routes, GitHub workflows | `lib/admin/health*`, integration adapters, `.github/workflows/` | `OPERATIONS_RUNBOOK.md`, `BUG_FIXES.md` | `health-helpers`, adapter/cache tests |

Test names in the table refer to `tests/admin/*.test.mjs`.

## Non-Obvious Hazards

- Issue reads may synchronize `Issue_Queue`, but they must not change student
  payment truth. High-confidence Pause History reconciliation is an explicit
  preview-and-confirm action on `/admin/flags`; only its confirmed POST may write
  `Students.payment_expectation`, and every change must append `Event_Log`.
- Onboarding writes across Sheets, the registry, and MMS. It can partially
  succeed. Preserve step results and recovery detail; never turn a warning into
  unconditional success.
- Pause planning dates are also encoded in exact note labels parsed by
  `lib/admin/pause-forecast.mjs`. Copy changes can affect finance forecasts.
- Sheets updates are generally last-write-wins. Do not assume transactional
  claims or safe concurrent mutation.
- Practice Chat delivery has a narrow pilot gate, delivery-key idempotency, and
  retry-email-only behavior. Do not broaden its audience or remove confirmation.
- `Communication_Log` means a message was copied to send, not proven sent.
- Incoming-message classifications and matched students are proposals. They do
  not authorise archive, pause, payment, planning, or messaging actions.
- Public tutor surfaces deliberately trade stronger identity for low friction.
  Do not add new sensitive reads or consequential writes before tutor auth exists.
- `npm run test:admin`, `npm run build`, `npm run dev`, and `npm run validate`
  run config generation first. Inspect the generated diff and never commit local
  credentials or unrelated generated churn.

## Approval And Action Boundaries

Keep truth, calculations, validation, permissions, workflow state, and
consequential actions deterministic.

Do not add automatic sending, payment execution, attendance changes, student
activation/archive, issue resolution, payment-expectation changes, or planning
state changes from unreviewed text or AI output. A proposal must be shown with
its evidence, validated by existing rules, approved at the established human
boundary, executed by the existing workflow, and logged.

Never expose broad Sheets, MMS, Stripe, Gmail, shell, filesystem, or arbitrary
HTTP access to an assistant. Prefer narrow read models and typed action proposals.

## Validation By Change Type

Start with the smallest matching test file, then run the full admin suite.

```bash
node --test tests/admin/<focused-file>.test.mjs
node --test tests/admin/*.test.mjs
npm run hygiene:check
npm run lint
```

Use the direct `node --test` command during a read-only investigation because
`npm run test:admin` has a config-generating pretest hook.

- Pure rule change: add/update focused fixtures, including unknown and failure
  cases; run the full admin suite.
- Sheets adapter change: verify header/key compatibility, append/upsert behavior,
  cache invalidation, and no accidental unbounded reads.
- API mutation change: check auth, validation, idempotency/retry, partial failure,
  audit logging, and the client error path.
- Finance/payroll/pause change: test dates, money rounding, unknown evidence,
  test-student exclusion, and provider-vs-cache labeling; manually inspect the
  relevant review screen without executing payment.
- Messaging change: verify recipient and student scoping, preview/copy wording,
  duplicate-send protection, and that no send occurs without its explicit gate.
- UI-only change: verify loading, success, error, empty, narrow viewport, and
  keyboard/focus behavior. Do not rely on a full-page reload to mask stale state.
- Deployment/config change: run the production build only when writes to generated
  local artifacts are acceptable, inspect `git diff`, then use the runbook smoke
  checks for every affected integration.

The current suite mainly covers helpers; route and component behavior still need
manual checks unless a change adds contract-level coverage.

`.github/workflows/ci.yml` repeats install, admin tests, application lint, and a
production build for pull requests and pushes to `main`. Do not weaken or skip a
failing check to merge a change; fix the failure or document why the workflow
itself is wrong.

## Safe Change And Recovery Checklist

Before finishing:

1. Confirm the authoritative owner for every field read or written.
2. Search for all consumers of changed exports, labels, tab headers, event types,
   and route payload fields.
3. Preserve fail-safe handling for missing, stale, conflicting, or unknown data.
4. Add or update tests and note any required manual check.
5. Inspect `git status --short` and `git diff`; preserve unrelated user changes.
6. Update the focused canonical doc when ownership, workflow, security, recovery,
   or an integration contract changes.
7. For rollback, revert the code/deploy first, then follow
   `docs/admin/OPERATIONS_RUNBOOK.md`. Do not reverse append-only logs or repair
   provider/Sheets state by guesswork; reconcile from authoritative evidence and
   record the recovery action.
