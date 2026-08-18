/** @fileoverview Assembles the admin health summary from GitHub workflow runs, finance snapshots, lesson mirror parity, and MMS checks. */
import { buildFinanceAutomationHealth, buildFlagsFreshnessSummary, buildWorkflowRunHealth } from './health-helpers.mjs';
import { buildLessonMirrorHealth } from './lesson-mirror-parity.mjs';
import { getLessonMirrorStatus } from './lesson-mirror-store.mjs';
import { fetchWithProviderTimeout, resolveProviderTimeoutMs } from './provider-fetch.mjs';
import { BRAIN_REPO, getDashboardRepo } from './github-repos.mjs';
import { getFinanceSnapshotRows, getReviewFlagsRows, getStripeCollectedMonthlyRows, getStripeForecastMonthlyRows } from './sheets';
import { checkMmsHealth } from './mms';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_REQUEST_TIMEOUT_MS = resolveProviderTimeoutMs(process.env.GITHUB_REQUEST_TIMEOUT_MS);

function getGithubHeaders() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured');
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };
}

async function getLatestWorkflowRun({ repo, workflowFile }) {
  const response = await fetchWithProviderTimeout(`${GITHUB_API_BASE}/repos/${repo}/actions/workflows/${workflowFile}/runs?per_page=1`, {
    headers: getGithubHeaders(),
    cache: 'no-store',
  }, {
    provider: 'GitHub',
    timeoutMs: GITHUB_REQUEST_TIMEOUT_MS,
  });

  if (!response.ok) {
    throw new Error(`GitHub workflow status failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload.workflow_runs?.[0] || null;
}

// Health is "is the pipeline OK" status, not second-by-second data, and each call
// makes bounded uncached checks (MMS, PostgreSQL + GitHub Actions APIs). Cache
// it briefly so repeat Overview visits skip those calls entirely.
const HEALTH_SUMMARY_TTL_MS = 60_000;
let healthSummaryCache = null;

export async function getAdminHealthSummary({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && healthSummaryCache && healthSummaryCache.expiresAtMs > now) {
    return healthSummaryCache.value;
  }
  const value = await computeAdminHealthSummary();
  healthSummaryCache = { value, expiresAtMs: now + HEALTH_SUMMARY_TTL_MS };
  return value;
}

async function computeAdminHealthSummary() {
  const [flagRowsResult, snapshotRowsResult, forecastRowsResult, collectedRowsResult, lessonMirrorResult] = await Promise.allSettled([
    getReviewFlagsRows(),
    getFinanceSnapshotRows(),
    getStripeForecastMonthlyRows(),
    getStripeCollectedMonthlyRows(),
    getLessonMirrorStatus(),
  ]);
  const flagsFreshness = flagRowsResult.status === 'fulfilled'
    ? buildFlagsFreshnessSummary(flagRowsResult.value)
    : {
        latestGeneratedAt: null,
        distinctGeneratedDates: [],
        status: 'Unknown',
        statusDetail: flagRowsResult.reason?.message || 'Review flag freshness is unavailable.',
        ageDays: null,
      };
  const financeAutomation = snapshotRowsResult.status === 'fulfilled' && forecastRowsResult.status === 'fulfilled' && collectedRowsResult.status === 'fulfilled'
    ? buildFinanceAutomationHealth({ snapshotRows: snapshotRowsResult.value, forecastRows: forecastRowsResult.value, collectedRows: collectedRowsResult.value })
    : {
        status: 'Unknown',
        detail: snapshotRowsResult.reason?.message || forecastRowsResult.reason?.message || collectedRowsResult.reason?.message || 'Finance automation data is unavailable.',
        updatedAt: null,
      };
  const lessonMirror = lessonMirrorResult.status === 'fulfilled'
    ? buildLessonMirrorHealth(lessonMirrorResult.value)
    : {
        status: 'Unknown',
        detail: 'Lesson-mirror status is unavailable.',
        updatedAt: null,
        assessment: { state: 'unknown', ageMinutes: null },
      };

  const [mmsResult, configWorkflowResult, fcWorkflowResult, financeWorkflowResult, stripeWorkflowResult, scheduleWorkflowResult, lessonMirrorWorkflowResult] = await Promise.allSettled([
    checkMmsHealth(),
    getLatestWorkflowRun({
      repo: getDashboardRepo(),
      workflowFile: 'generate-configs.yml',
    }),
    getLatestWorkflowRun({
      repo: BRAIN_REPO,
      workflowFile: 'regenerate-fc-ids.yml',
    }),
    getLatestWorkflowRun({
      repo: getDashboardRepo(),
      workflowFile: 'finance-snapshot.yml',
    }),
    getLatestWorkflowRun({
      repo: getDashboardRepo(),
      workflowFile: 'stripe-amounts.yml',
    }),
    getLatestWorkflowRun({
      repo: getDashboardRepo(),
      workflowFile: 'refresh-schedules.yml',
    }),
    getLatestWorkflowRun({
      repo: getDashboardRepo(),
      workflowFile: 'lesson-mirror.yml',
    }),
  ]);

  const mms =
    mmsResult.status === 'fulfilled'
      ? mmsResult.value
      : {
          status: 'Failing',
          detail: mmsResult.reason?.message || 'MMS health check failed.',
          checkedAt: null,
        };

  const configWorkflow =
    configWorkflowResult.status === 'fulfilled'
      ? buildWorkflowRunHealth(configWorkflowResult.value, { label: 'Generate configs' })
      : {
          label: 'Generate configs',
          status: 'Unknown',
          detail: configWorkflowResult.reason?.message || 'Could not load workflow status.',
          updatedAt: null,
          conclusion: '',
          htmlUrl: '',
        };

  const fcWorkflow =
    fcWorkflowResult.status === 'fulfilled'
      ? buildWorkflowRunHealth(fcWorkflowResult.value, { label: 'Regenerate FC IDs' })
      : {
          label: 'Regenerate FC IDs',
          status: 'Unknown',
          detail: fcWorkflowResult.reason?.message || 'Could not load workflow status.',
          updatedAt: null,
          conclusion: '',
          htmlUrl: '',
        };

  const workflowHealth = (result, label, maxAgeHours) => result.status === 'fulfilled'
    ? buildWorkflowRunHealth(result.value, { label, maxAgeHours })
    : {
        label,
        status: 'Unknown',
        detail: result.reason?.message || 'Could not load workflow status.',
        updatedAt: null,
        conclusion: '',
        htmlUrl: '',
      };

  return {
    flagsFreshness,
    mms,
    configWorkflow,
    fcWorkflow,
    financeWorkflow: workflowHealth(financeWorkflowResult, 'Finance snapshots', 8 * 24),
    stripeWorkflow: workflowHealth(stripeWorkflowResult, 'Stripe amounts', 8 * 24),
    scheduleWorkflow: workflowHealth(scheduleWorkflowResult, 'Schedule refresh', 17 * 24),
    lessonMirrorWorkflow: workflowHealth(lessonMirrorWorkflowResult, 'Lesson mirror daily', 36),
    lessonMirror,
    financeAutomation,
  };
}
