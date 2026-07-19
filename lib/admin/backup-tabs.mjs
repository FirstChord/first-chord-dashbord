// The single home for which Sheets tabs the local backup covers.
// Contract (test-enforced in tests/admin/state-tab-contracts.test.mjs):
// every tab registered in buildManagedStateSheetDefinitions must appear either
// in BACKUP_TABS or in NON_BACKED_UP_TABS with a written reason. This exists
// because tab creation and backup coverage used to live in unrelated files and
// five non-rebuildable tabs (Cover_Bank_State + the Song_* lane) drifted out
// of the backup unnoticed until the 2026-07-19 restore drill.

export const BACKUP_TABS = [
  'Students',
  'Issue_Queue',
  'Event_Log',
  'Waiting_List_State',
  'Showcase_Task_State',
  'Holiday_Workflow_State',
  'Schedule_Context',
  'Parent_Understanding_State',
  'Tutor_Absence_State',
  'Cover_Bank_State',
  'Tutor_Lifecycle',
  'Planning_Items',
  'Planning_Progress_Log',
  'Practice_Notes_Log',
  'Communication_Log',
  'Incoming_Message_Inbox',
  'WhatsApp_Group_Map',
  'Proposals',
  'Tutor_Pay',
  'Expenses',
  'Expense_Log',
  'Finance_Snapshot',
  'Payroll_Runs',
  'Tutor_Wise',
  'Tutor_Phones',
  'Students_Archive',
  'Song_Assignments',
  'Song_Status_Log',
  'Song_Outcomes',
  'Song_Requests',
  'Stripe_Collected_Monthly',
];

// Tabs that may legitimately not exist yet when the backup runs.
export const OPTIONAL_MISSING_TABS = new Set(['Students_Archive', 'Tutor_Phones']);

// Managed tabs deliberately excluded from backup — each needs a reason that
// amounts to "fully rebuildable from an external truth, losing it costs nothing".
export const NON_BACKED_UP_TABS = new Map([
  ['Stripe_Amounts_Cache', 'full-replace cache rebuilt weekly by /api/cron/stripe-amounts from live Stripe'],
  ['Bridge_Status', 'heartbeat row; the bridge rewrites it within ~30 minutes of running'],
]);
