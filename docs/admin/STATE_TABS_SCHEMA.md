# State Tabs Schema

Last updated: 2026-06-10

This note documents the dashboard-owned Google Sheets tabs that store workflow state, cache snapshots, or audit history. It is intentionally about dashboard state, not the main `Students` operational sheet.

## Principle

External systems own external truth. The dashboard stores workflow state, action history, cached snapshots, and derived context that helps humans close loops.

## Tabs

| Tab | Purpose | Key | Write Pattern | Main Writers | Notes |
| --- | --- | --- | --- | --- | --- |
| `Issue_Queue` | Persistent issue objects generated from review/payment/pause checks | `issue_id` | keyed upsert | `upsertIssueQueueRow`, `upsertIssueQueueRows`, issue action APIs | Issues are operational objects, not just warnings. `source_present` tracks whether the latest source scan still detects them. |
| `Event_Log` | Append-only history of consequential actions | `event_id` | append-only | `appendEventLogRow`, `appendEventLogRows` | Do not edit in place. Use for audit/memory. |
| `Waiting_List_State` | Manual waiting-list status/notes over MMS waiting-list data | `mms_id` | keyed upsert | `upsertWaitingListStateRow` | MMS remains the source for waiting students/contact facts. |
| `Showcase_Task_State` | Recurring showcase checklist progress | `workflow_key` + `task_id` | keyed upsert | `upsertShowcaseTaskStateRow` | Stores checklist completion only; reference copy lives in code/docs. |
| `Holiday_Workflow_State` | Recurring holiday workflow checklist progress | `workflow_key` + `task_id` | keyed upsert | `upsertHolidayWorkflowStateRow` | Same pattern as showcase workflows. |
| `Schedule_Context` | Cached selected MMS schedule facts per student | `mms_id` | keyed upsert | `upsertScheduleContextRow` | Snapshot/cache, not truth. Refresh from MMS when a student is new or a slot changes. |
| `Parent_Understanding_State` | Parent check-in campaign workflow state | `student_mms_id` | keyed upsert | `upsertParentUnderstandingStateRow` | Manual, approval-first. Does not auto-send WhatsApp, edit MMS, or notify tutors. |
| `Tutor_Absence_State` | Tutor absence workflow decisions/messages | `absence_id` | keyed upsert | `upsertTutorAbsenceStateRow` | Absence workflows should end in cover or cancellation decision plus parent-message tracking. |
| `Planning_Items` | Brain/planning capture for ideas, actions, and initiatives | `planning_id` | keyed upsert | `upsertPlanningItemRow` | Human-created work, not system-detected issues. Can link to students/tutors/workflows. |
| `Planning_Progress_Log` | Append-only progress history for planning items | `progress_id` | append-only | `appendPlanningProgressLogRow` | Momentum log. Do not overwrite history. |
| `Students_Archive` | Archive copy before dashboard-driven student removal from `Students` | inherited student row plus archive metadata | append-only | `archiveAndDeleteStudentSheetRow` | Safety record for destructive student removal. |

## Shared Upsert Helper

`lib/admin/sheets.js` now contains `upsertManagedSheetRow()`, which centralises the common pattern:

1. ensure the managed sheet and required headers exist
2. read current rows
3. find the row by key
4. append if missing, update if present
5. invalidate the short in-process read cache for that sheet

This currently covers the one-row state upserts. Bulk issue sync still has custom logic because it batches appends and updates multiple rows.

## Concurrency And Limits

Google Sheets is acceptable for the current scale because writes are low-volume and mostly human-triggered. The main risk is two users editing the same keyed row at nearly the same time. The current pattern is last-write-wins.

Use append-only tabs for history (`Event_Log`, `Planning_Progress_Log`, archives). Use keyed upserts for current workflow state.

Watch for:

- duplicate keys caused by manual sheet edits
- stale browser tabs overwriting a newer state row
- wide bulk syncs taking longer than expected
- state rows drifting from external truth when MMS/Stripe/registry changes outside the dashboard

If those become real operational problems, the next hardening step is per-row revision metadata or moving high-write workflow state to a small database. Do not introduce that until Sheets becomes a measured bottleneck.

## What Not To Store Here

- live Stripe truth
- live MMS schedule truth
- canonical student contact truth
- registry/portal config truth
- AI decisions as authoritative state
