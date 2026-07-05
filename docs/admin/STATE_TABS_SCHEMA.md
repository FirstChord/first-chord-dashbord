# State Tabs Schema

Last updated: 2026-07-04

This note is the canonical map for dashboard-owned state lanes. It documents the Google Sheets tabs that store workflow state, cache snapshots, append-only logs, or derived context. It is intentionally about dashboard state, not the main `Students` operational sheet.

## Principle

External systems own external truth. The dashboard stores workflow state, action history, cached snapshots, and derived context that helps humans close loops.

Lane meanings:

- `truth` = primary operational truth owned by a source system, usually outside this table
- `cache` = dashboard-held snapshot of external truth
- `workflow-state` = current state for a human/admin loop
- `append-only-log` = audit/history; do not rewrite rows
- `derived-context` = dashboard interpretation that reduces guessing but is not source truth

## Tabs

| Tab | Lane | Purpose | Key | Write Pattern | Main Writers | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Issue_Queue` | workflow-state | Persistent issue objects generated from review/payment/pause/practice-delivery checks | `issue_id` | keyed upsert | `upsertIssueQueueRow`, `upsertIssueQueueRows`, issue action APIs | Issues are operational objects, not just warnings. `source_present` tracks whether the latest source scan still detects them. |
| `Event_Log` | append-only-log | Append-only history of consequential actions | `event_id` | append-only | `appendEventLogRow`, `appendEventLogRows` | Do not edit in place. Use for audit/memory. |
| `Waiting_List_State` | workflow-state | Manual waiting-list status/notes over MMS waiting-list data | `mms_id` | keyed upsert | `upsertWaitingListStateRow` | MMS remains the source for waiting students/contact facts. |
| `Showcase_Task_State` | workflow-state | Recurring showcase checklist progress | `workflow_key` + `task_id` | keyed upsert | `upsertShowcaseTaskStateRow` | Stores checklist completion only; reference copy lives in code/docs. |
| `Holiday_Workflow_State` | workflow-state | Recurring holiday workflow checklist progress | `workflow_key` + `task_id` | keyed upsert | `upsertHolidayWorkflowStateRow` | Same pattern as showcase workflows. |
| `Schedule_Context` | cache | Cached selected MMS schedule facts per student | `mms_id` | keyed upsert | `upsertScheduleContextRow` | Snapshot/cache, not truth. Refresh from MMS when a student is new or a slot changes. |
| `Parent_Understanding_State` | workflow-state | Parent check-in campaign workflow state | `student_mms_id` | keyed upsert | `upsertParentUnderstandingStateRow` | Manual, approval-first. Does not auto-send WhatsApp, edit MMS, or notify tutors. |
| `Tutor_Absence_State` | workflow-state | Tutor absence workflow decisions/messages | `absence_id` | keyed upsert | `upsertTutorAbsenceStateRow` | Absence workflows should end in cover or cancellation decision plus parent-message tracking. Long-absence capture previews MMS across a date range, then still writes one normal per-date absence record. Cancelled days also auto-create idempotent structured pause `Planning_Items` per affected student unless the student is already paused-expected or marked not-needed. Repeated cancelled dates for the same student are grouped into an away-period pause plan; when the period expands, superseded single-lesson or shorter-period plans are parked, not deleted. Parent communication can be grouped by student/period, but stored workflow state remains per dated absence so finance, payment handling, and audit trails stay precise. |
| `Planning_Items` | workflow-state | Brain/planning capture for ideas, actions, initiatives, learning notes, and strategic notes | `planning_id` | keyed upsert | `upsertPlanningItemRow` | Human-created work, not system-detected issues. Can link to students/tutors/workflows. School notes preserve thinking/context; linked actions carry executable work. `parked` is the soft-delete/archive state: keep the history, remove from active work, and do not let parked pause cards drive finance pause forecasting. `owner` ∈ `Unassigned`/`Finn`/`Tom`/`Fennella` (assignment; a "Fennella" planning filter surfaces her items — Fennella currently logs in via the shared admin identity, own auth deferred). `plan_mode` ∈ `task` (same-day, ticked done) / `ongoing` (worked across sessions — log progress in `Planning_Progress_Log` + set the next meeting day in `target_date`); default `task`, orthogonal to `item_type` (category). |
| `Planning_Progress_Log` | append-only-log | Append-only progress history for planning items | `progress_id` | append-only | `appendPlanningProgressLogRow` | Momentum log. Do not overwrite history. |
| `Practice_Notes_Log` | append-only-log + workflow-state | Practice Chat lesson-note memory, portal note read source, and Level 2 delivery audit/idempotency state | `note_id` for snapshots; `delivery_key` for Level 2 delivery records | snapshots append with duplicate guard; Level 2 delivery rows upsert by `delivery_key`; portal reads select latest sent/completed row first, then fall back to MMS | `appendPracticeNoteLogRow`, `upsertPracticeNoteLogRow`, `getPracticeNoteLogRows`, `POST /api/practice-notes`, `POST /api/practice-notes/mms-test`, `GET /api/notes/[studentId]`, `getStudentData` | Dashboard-owned learning/context memory. New Level 2 rows can include selected MMS attendance ID/event ID, target-selection reason, recipient, Gmail message/thread ID, send status, sent timestamp, email error, manual follow-up state, `operation_status`, and `completed_at`. Sent/completed rows are parent-visible in portals. Draft/in-progress/failed snapshots are not parent-visible. MMS remains fallback and attendance/payroll continuity source. Rows with `manual_follow_up_needed = TRUE` surface as `practice_delivery` issues in the Issue Queue; the issue quick action clears the flag with a single-cell write (a full-row upsert would blank the columns `normalisePracticeNoteLogRow` does not map). |
| `Communication_Log` | append-only-log | Passive record of parent messages copied to send from the dashboard | `message_id` | append-only (dedup by student+body within a short window) | `appendCommunicationLogRow`, `logCommunication`, `POST /api/admin/communications` | Record-only logbook, written as a fire-and-forget side-effect of existing "Copy message" buttons. Copied does not prove sent. No approval, no sending. Does not change any workflow. |
| `Incoming_Message_Inbox` | workflow-state | Review inbox for inbound parent/tutor messages captured by manual paste or a future starred-WhatsApp/n8n bridge | `incoming_id` | keyed upsert by deterministic incoming ID; admin hard-delete only for test/noise rows | `upsertIncomingMessageInboxRow`, `deleteIncomingMessageInboxRow`, `captureIncomingMessage`, `correctIncomingMessage`, `convertIncomingMessageToPlanning`, `POST /api/admin/incoming-messages` | Intake lane only. Classification/matching are deterministic hints for review (`one_off_absence`, `extended_absence`, `summer_break`, `payment`, etc.) and must not auto-pause payments, message parents, or alter workflow state. External bridge writes require `INCOMING_MESSAGE_INGEST_SECRET`; dashboard admins can paste manually/correct reviewed interpretation. `Convert to plan` creates a linked `Planning_Items` action (id `planning_<incoming_id>`, idempotent), records it in `created_planning_id`, marks the row `converted`, and returns a copy-paste WhatsApp reply draft — the reply is never auto-sent. Every review action (archive/ignore/correct/convert) stamps `reviewed_by` (admin email) and `reviewed_at` (ISO) so there's an audit trail of who actioned each message and when. |
| `WhatsApp_Group_Map` | workflow-state | Reviewable map of WhatsApp group IDs observed by the incoming-message bridge | `chat_id` | keyed upsert by WhatsApp chat ID | `upsertWhatsappGroupMapRow`, `captureIncomingMessage`, `correctIncomingMessage`, `syncWhatsappGroups`, `reviewWhatsappGroup`, `POST /api/admin/incoming-messages` | Group IDs are useful matching hints for small parent/tutor groups, but are not source truth until reviewed. Populated reactively (starred capture) or in bulk via `mode: sync_groups` (`buildGroupSyncPlan`: keep groups whose title has an instrument token and that were active within 6 months; auto-match by participant phone then title name). `mode: review_group` confirms/ignores a group directly from the map (no message needed). `confirmed` group maps are used as high-confidence future matching evidence and store selected student context (`matched_mms_id`, `matched_fc_id`, parent name/phone, tutor, instrument, `confirmed_by`, `confirmed_at`); a sync never downgrades a `confirmed` group. `status` values: `review` / `confirmed` / `ignored`. Sibling groups (one chat, multiple students) hold extra students in `additional_mms_ids` (comma list, added manually via `mode: add_group_student`); matching then disambiguates by the student named in each message, and flags "needs manual review" when a shared-group message names nobody rather than guessing. Renamed groups, old students, and changed tutors need human review before relying on the map. |
| `Students_Archive` | append-only-log | Archive copy before dashboard-driven student removal from `Students` | inherited student row plus archive metadata | append-only | `archiveAndDeleteStudentSheetRow` | Safety record for destructive student removal. Metadata columns: `archived_at`, `archived_by`, `archive_note`, and `date_left` (the `YYYY-MM` month the student left, captured by the one-click "Mark student as left" action — feeds roster-movement / "when did billing stop"). Column self-heals on next archive write. |
| `Tutor_Pay` | workflow-state | Finance/payroll pay assumptions, including sensitive salary rows, invoice cadence, and payroll-active flag | `tutor` | keyed upsert/manual sheet edit | `upsertTutorPayRow`, Finance sheet edits | Private finance config. Salaries must stay in Sheets/Railway runtime surfaces, not committed to git. Blank `invoice_cadence` defaults to weekly; biweekly/fortnightly tutors should be marked explicitly. |
| `Expenses` | workflow-state | Recurring fixed-overhead assumptions used by the finance run-rate | `name` | keyed upsert/manual sheet edit | `upsertExpenseRow`, Finance sheet edits | This is for recurring monthly/weekly/annual assumptions such as rent, software, insurance. It affects estimated margin. The old `General` buffer is ignored if present because miscellaneous spend now lives in `Expense_Log`. |
| `Expense_Log` | append-by-default log | Actual spend memory for one-off or variable card/bank spending | `expense_id` | append by default; admin delete only for mistaken entries | `appendExpenseLogRow`, `deleteExpenseLogRow`, `/admin/finance` add-spend form | Use for paint, repairs, staff coffees/lunches, one-off room improvements, etc. Reconcile against the bank account at month-end and add missing lines. Month-to-date totals reset by calendar month and are included in finance snapshots as separate cash-view fields. Deletion is a correction path for accidental entries, not normal editing. |
| `Finance_Snapshot` | append-only-log + derived-context | Dated finance run-rate snapshots | `snapshot_id` | append-only | `appendFinanceSnapshotRow`, `/api/cron/finance-snapshot` | Estimate series, not accounting. Includes run-rate fields plus current-month `Expense_Log` totals/cash-view margin for month-end context. Useful for trend visibility and seasonal changes. |
| `Payroll_Runs` | workflow-state + append-by-period ledger | Tutor payroll review/payment state for each tutor and pay period | `payroll_id` | keyed upsert by tutor+period | `upsertPayrollRunRow`, `/admin/finance/payroll` | V1 reconciliation ledger, not bank/payment truth. MMS attendance remains the source for lesson attendance; `Tutor_Pay` supplies rate/cadence; this tab stores Tom/Finn review status, paid status, adjustments, invoice status, and notes. |
| `Tutor_Wise` | reference (sensitive) | Wise batch-payment recipient details per tutor, used to generate the Wise CSV | `tutor` | manual sheet edit only | `getTutorWiseRows`, `/admin/finance/payroll/wise-csv` | Sensitive recipient data — lives only in Sheets/Railway, never committed to git (same rule as salaries). Read-only from the dashboard; populated by hand. `tutor` must match the tutor's short name (the `ADMIN_TUTORS` key, e.g. `Kenny`) or full name (e.g. `Kenny Bates`) as shown on the payroll cards — **not** `Tutor_Pay`, which only holds salaried owners + overrides. `buildWiseBatch` joins on `tutorShortName` then `tutor` (full name). Prefer storing only the opaque `recipient_id`; `recipient_detail` (raw bank numbers) is optional if Wise pays the saved recipient by id. |
| `Stripe_Amounts_Cache` | cache | Per-student Stripe subscription billing amounts (the finance estimate's "actuals" feed) | `mms_id` | full replace each refresh | `replaceStripeAmountsCacheRows`, `/api/cron/stripe-amounts` | Rewritten wholesale by the Monday cron (row set follows the roster; per-row upserts would crawl). Consumers apply a 14-day staleness guard (`buildStripeAmountsMap`): a dead cron degrades students back to the price-table estimate, never blocks the page. Live Stripe truth stays in Stripe. |
| `Stripe_Collected_Monthly` | cache | One row per calendar month: total Stripe paid-invoice collections, for estimate-vs-reality calibration | `month` (`YYYY-MM`) | keyed upsert | `upsertStripeCollectedMonthlyRow`, `/api/cron/stripe-amounts` | Feeds the finance page "Estimate vs reality" panel and the `/api/admin/finance/overview` JSON. Collected = paid invoices *created* in the month; weekly billing means five-Monday months run naturally ~15% high. |

## Format Contracts

Some source formats are fragile because they come from human-edited external systems. Do not change these without updating the relevant parser/tests:

- MMS sign-up form labels `Preferred days` and `Preferred times` feed waiting-list availability matching. If the MMS form wording changes, update the waiting-list parser/tests before relying on capacity hints.
- The Google Sheets `Students` header row is a contract for dashboard reads, FC regeneration, backups, and archive/delete flows. Protect the header row in Google Sheets with an edit-warning. If a column is renamed or moved, update the readers/tests intentionally.
- GitHub scheduled workflows can be disabled after long inactivity. The schedule-refresh cron is useful, but it should still be checked from the health/operations rhythm rather than assumed permanent.
- **Pause planning notes → pause forecast.** `buildPauseForecast` (`lib/admin/pause-forecast.mjs`) parses pause-window dates from the `Planning_Items` notes written by `buildStructuredPausePlanningDraft`: `First lesson to pause date: YYYY-MM-DD` + `Returning from date: YYYY-MM-DD` (away period), and `Lesson date: YYYY-MM-DD` (single lesson). Parked pause items are ignored; done items can still forecast because "done" means the admin action was completed, not that the future/active pause stopped existing. If that helper's note wording changes, update the regexes/tests in `pause-forecast.mjs` — otherwise the forecast silently stops seeing those pauses (it does surface an `unparsedCount`, but only for items it recognises as pauses by title/notes).
- **Tutor absence grouped pause IDs.** `buildTutorAbsencePausePlanningBundle` creates single-date IDs as `planning_tutor_absence_pause_...` and grouped period IDs as `planning_tutor_absence_pause_period_<tutor>_<studentMmsId>_<firstDate>_<lastDate>`. When a later saved absence extends a block, the older grouped period ID is deliberately superseded and parked. Do not hard-delete those rows; finance ignores `parked`, while `Planning_Progress_Log` preserves why the visible card changed. See `docs/admin/TUTOR_ABSENCE_PAUSE_BRIDGE.md` for the full workflow map.
- **Payroll period IDs.** `buildPayrollRunId` creates stable IDs from tutor short name + period start/end. Do not manually change `period_start`, `period_end`, or `tutor_short_name` on saved payroll rows; the payroll page will treat that as a different run. Use `adjustment_amount` + `notes` for corrections.
- **Wise batch-payment CSV columns.** `WISE_CSV_HEADERS` in `lib/admin/wise-helpers.mjs` is the exact column order Wise expects on batch upload: `recipientId, name, recipientEmail, recipientDetail, sourceCurrency, targetCurrency, amountCurrency, amount, paymentReference, receiverType`. `amount` (tutor's owed figure) and `paymentReference` (`FC pay <periodEnd>`, kept short for Wise's per-currency length limit) are generated; the rest come from the `Tutor_Wise` sheet. Only **reviewed** payroll rows with a positive owed amount are emitted (`buildWiseBatch`). If Wise changes its expected CSV format, update `WISE_CSV_HEADERS` + the wise-helpers tests. The dashboard only generates the file; a human uploads and approves it in Wise (payroll stays reconciliation, not execution).
- **MMS attendance statuses → payroll classification.** `resolveSlotState` in `lib/admin/payroll-helpers.mjs` maps literal MMS `AttendanceStatus` strings to pay buckets: `Present`/`Attended`/`Completed` and `AbsentNoMakeup` → **payable** (the last is absent-but-invoiced: practice-video / no-makeup policy); `AbsentNotice` → **excluded £0** (absent with notice, not invoiced); `Unrecorded`/blank → **needs review**. If MMS renames or adds an absence status, an unknown value falls safely to "needs review" (it never silently pays), but `PAYABLE_STATUSES`/`EXCLUDED_STATUSES` + the payroll tests should be updated to classify it. The mapping mirrors the tutor's own invoicing (validated against a real Kenny invoice 2026-06-27).
- **Stripe API fields → amounts cache.** `mapSubscriptionToAmounts`/`summariseCollectedInvoices` (`lib/admin/stripe-amounts-helpers.mjs`) rely on: `subscription.items.data[].price.unit_amount` (pence) × `.quantity`, `price.recurring.interval`/`interval_count`, `subscription.pause_collection`, `subscription.discount.coupon.{percent_off,amount_off}`, and `invoice.{status,amount_paid,created}`. The `STRIPE_API_KEY` is a **restricted read key** — scopes verified 2026-07-04: customers, subscriptions, invoices, prices readable; charges/payouts/balance_transactions denied (bank-level cash truth is deliberately out of reach). If the key is rotated, keep at least those four read scopes or the Monday `/api/cron/stripe-amounts` refresh fails. The cron shares `FINANCE_SNAPSHOT_SECRET` (same trust domain, same pipeline).
- **Assumptions version → snapshot notes.** Every `Finance_Snapshot` row's `notes` column carries `PRICE_ASSUMPTIONS_VERSION` (`lib/admin/finance-assumptions.mjs`). Changing any price-table/hourly-rate/VAT constant without bumping that string makes a series step-change untraceable — the constants carry bump-reminder comments.

## Setup And Backup Checks

Run this to create/verify dashboard-owned state tabs and required headers:

```bash
npm run ensure:state-tabs
```

Run this to back up `Students` plus dashboard-owned state tabs to ignored local CSV/JSON files:

```bash
npm run backup:sheets
```

`npm run backup:sheets` also updates the Planning item `planning_operational_sheets_backup` so the next fortnightly backup appears in the existing dated planning/overview flow.

## Shared Upsert Helper

`lib/admin/sheets.js` now contains `upsertManagedSheetRow()`, which centralises the common pattern:

1. ensure the managed sheet and required headers exist
2. read current rows
3. find the row by key
4. append if missing, update if present
5. invalidate the short in-process read cache for that sheet

This currently covers the one-row state upserts. Bulk issue sync still has custom logic because it batches appends and updates multiple rows.

## Read Cache Contract

Shared sheet reads use a short in-process cache in `lib/admin/sheets/core.mjs`.

- fresh cache window: repeat reads return immediately
- bounded stale window: recently-stale rows may render immediately while a background refresh updates the cache
- hard max age: old rows block for a fresh Google Sheets read

Dashboard-owned writes call `invalidateSheetReadCache()` for the affected tab. External writers, such as separate tools or manual Sheets edits, can therefore be briefly stale but should not remain stale beyond the hard cap. If a workflow needs immediate external truth, use an explicit refresh or a direct source read instead of relying on cached rows.

## Concurrency And Limits

Google Sheets is acceptable for the current scale because writes are low-volume and mostly human-triggered. The main risk is two users editing the same keyed row at nearly the same time. The current pattern is last-write-wins.

Use append-only tabs for history (`Event_Log`, `Planning_Progress_Log`, archives). Use keyed upserts for current workflow state.

Watch for:

- duplicate keys caused by manual sheet edits
- stale browser tabs overwriting a newer state row
- wide bulk syncs taking longer than expected
- state rows drifting from external truth when MMS/Stripe/registry changes outside the dashboard
- append-only logs containing student/parent data that must stay out of git and public storage

If those become real operational problems, the next hardening step is per-row revision metadata or moving high-write workflow state to a small database. Do not introduce that until Sheets becomes a measured bottleneck.

## What Not To Store Here

- live Stripe truth
- live MMS schedule truth
- MMS attendance/completion truth
- canonical student contact truth
- registry/portal config truth
- AI decisions as authoritative state
