# State Tabs Schema

Last updated: 2026-06-21

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
| `Issue_Queue` | workflow-state | Persistent issue objects generated from review/payment/pause checks | `issue_id` | keyed upsert | `upsertIssueQueueRow`, `upsertIssueQueueRows`, issue action APIs | Issues are operational objects, not just warnings. `source_present` tracks whether the latest source scan still detects them. |
| `Event_Log` | append-only-log | Append-only history of consequential actions | `event_id` | append-only | `appendEventLogRow`, `appendEventLogRows` | Do not edit in place. Use for audit/memory. |
| `Waiting_List_State` | workflow-state | Manual waiting-list status/notes over MMS waiting-list data | `mms_id` | keyed upsert | `upsertWaitingListStateRow` | MMS remains the source for waiting students/contact facts. |
| `Showcase_Task_State` | workflow-state | Recurring showcase checklist progress | `workflow_key` + `task_id` | keyed upsert | `upsertShowcaseTaskStateRow` | Stores checklist completion only; reference copy lives in code/docs. |
| `Holiday_Workflow_State` | workflow-state | Recurring holiday workflow checklist progress | `workflow_key` + `task_id` | keyed upsert | `upsertHolidayWorkflowStateRow` | Same pattern as showcase workflows. |
| `Schedule_Context` | cache | Cached selected MMS schedule facts per student | `mms_id` | keyed upsert | `upsertScheduleContextRow` | Snapshot/cache, not truth. Refresh from MMS when a student is new or a slot changes. |
| `Parent_Understanding_State` | workflow-state | Parent check-in campaign workflow state | `student_mms_id` | keyed upsert | `upsertParentUnderstandingStateRow` | Manual, approval-first. Does not auto-send WhatsApp, edit MMS, or notify tutors. |
| `Tutor_Absence_State` | workflow-state | Tutor absence workflow decisions/messages | `absence_id` | keyed upsert | `upsertTutorAbsenceStateRow` | Absence workflows should end in cover or cancellation decision plus parent-message tracking. |
| `Planning_Items` | workflow-state | Brain/planning capture for ideas, actions, initiatives, learning notes, and strategic notes | `planning_id` | keyed upsert | `upsertPlanningItemRow` | Human-created work, not system-detected issues. Can link to students/tutors/workflows. School notes preserve thinking/context; linked actions carry executable work. |
| `Planning_Progress_Log` | append-only-log | Append-only progress history for planning items | `progress_id` | append-only | `appendPlanningProgressLogRow` | Momentum log. Do not overwrite history. |
| `Practice_Notes_Log` | append-only-log + workflow-state | Practice Chat lesson-note memory, portal note read source, and Level 2 delivery audit/idempotency state | `note_id` for snapshots; `delivery_key` for Level 2 delivery records | snapshots append with duplicate guard; Level 2 delivery rows upsert by `delivery_key`; portal reads select latest sent/completed row first, then fall back to MMS | `appendPracticeNoteLogRow`, `upsertPracticeNoteLogRow`, `getPracticeNoteLogRows`, `POST /api/practice-notes`, `POST /api/practice-notes/mms-test`, `GET /api/notes/[studentId]`, `getStudentData` | Dashboard-owned learning/context memory. New Level 2 rows can include selected MMS attendance ID/event ID, target-selection reason, recipient, Gmail message/thread ID, send status, sent timestamp, email error, manual follow-up state, `operation_status`, and `completed_at`. Sent/completed rows are parent-visible in portals. Draft/in-progress/failed snapshots are not parent-visible. MMS remains fallback and attendance/payroll continuity source. |
| `Communication_Log` | append-only-log | Passive record of parent messages copied to send from the dashboard | `message_id` | append-only (dedup by student+body within a short window) | `appendCommunicationLogRow`, `logCommunication`, `POST /api/admin/communications` | Record-only logbook, written as a fire-and-forget side-effect of existing "Copy message" buttons. Copied does not prove sent. No approval, no sending. Does not change any workflow. |
| `Students_Archive` | append-only-log | Archive copy before dashboard-driven student removal from `Students` | inherited student row plus archive metadata | append-only | `archiveAndDeleteStudentSheetRow` | Safety record for destructive student removal. |

## Format Contracts

Some source formats are fragile because they come from human-edited external systems. Do not change these without updating the relevant parser/tests:

- MMS sign-up form labels `Preferred days` and `Preferred times` feed waiting-list availability matching. If the MMS form wording changes, update the waiting-list parser/tests before relying on capacity hints.
- The Google Sheets `Students` header row is a contract for dashboard reads, FC regeneration, backups, and archive/delete flows. Protect the header row in Google Sheets with an edit-warning. If a column is renamed or moved, update the readers/tests intentionally.
- GitHub scheduled workflows can be disabled after long inactivity. The schedule-refresh cron is useful, but it should still be checked from the health/operations rhythm rather than assumed permanent.

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
