import { buildFinanceScenario } from './finance-scenario.mjs';
import { buildPauseForecast } from './pause-forecast.mjs';

// Unified forward outlook: the pause walk-forward (dated, on the weekly timeline) plus
// the waiting list as pipeline (undated upside). One call site for "what's coming".
//
// CONSTRAINT: Waiting_List_State rows carry no future expected-start-date field
// (headers: mms_id, status, note, parent_name, parent_email, date_started, updated_at —
// date_started is when they *joined the list*, not when lessons would begin). So waiting
// students cannot be placed on the weekly timeline; the pipeline is a "potential margin
// if converted" summary, not a set of dated onboard windows. Pure, read-only.

function round(n) {
  return Math.round(n * 100) / 100;
}

// Status vocabulary mirrors WAITING_STATUS_OPTIONS in lib/admin/waiting-workflow.js
// (not imported — that file pulls in MMS/Sheets I/O and this module stays pure).
// "Waiting" = still in the funnel and could convert. Excluded: 'onboarded' (already on
// the roster, so already inside activeCount), 'closed' (left the funnel), and
// 'no_response' (gone cold — counting them would inflate the upside).
const WAITING_PIPELINE_STATUSES = new Set([
  'new',
  'contacted',
  'welcome_group_added',
  'welcome_call_booked',
  'call_completed',
  'onboarding_ready',
]);

// Blank/unknown statuses normalise to 'new', matching normaliseWaitingStatus in
// waiting-workflow.js — a state row with no recognised status is an untouched enquiry.
function normaliseStatus(value) {
  const status = `${value || ''}`.trim().toLowerCase();
  return WAITING_PIPELINE_STATUSES.has(status) || status === 'onboarded' || status === 'closed' || status === 'no_response'
    ? status
    : 'new';
}

export function buildForwardOutlook({
  totals = {},
  activeCount = 0,
  activeMmsIds = null,
  pauseItems = [],
  waitingRows = [],
  weeks = 12,
  now = new Date(),
} = {}) {
  // Dated lane: planned pauses on the weekly timeline. Passed through unchanged —
  // the walk-forward math lives in buildPauseForecast, not here.
  const pauses = buildPauseForecast({ totals, activeCount, activeMmsIds, pauseItems, weeks, now });

  // Undated lane: the waiting list valued at today's average contribution per student
  // (net revenue − variable pay, from the break-even model — the margin a converted
  // student adds before fixed costs, which don't move with volume).
  const base = buildFinanceScenario(totals, activeCount, {});
  const byStatus = {};
  let waitingCount = 0;
  for (const row of waitingRows) {
    const status = normaliseStatus(row.status);
    if (!WAITING_PIPELINE_STATUSES.has(status)) continue;
    byStatus[status] = (byStatus[status] || 0) + 1;
    waitingCount += 1;
  }
  const potentialMonthly = round(waitingCount * base.avgContributionPerStudent);

  const pipeline = {
    waitingCount,
    byStatus,
    avgContributionPerStudent: base.avgContributionPerStudent,
    potentialMonthly,
    timelined: false,
    note: 'Upside if every waiting student converts — the waiting list has no expected start dates, so this is potential, not scheduled revenue.',
  };

  return {
    pauses,
    pipeline,
    // Deliberate seam: once the Finance_Snapshot series covers ~a year, a seasonal
    // expectation from buildFinanceTrend (finance-trend.mjs) slots in here.
    seasonal: null,
    summary: {
      horizonWeeks: weeks,
      baseMarginMonthly: pauses.summary.baseMarginMonthly,
      troughMarginMonthly: pauses.summary.trough
        ? pauses.summary.trough.marginMonthly
        : pauses.summary.baseMarginMonthly,
      pipelinePotentialMonthly: potentialMonthly,
      waitingCount,
    },
  };
}
