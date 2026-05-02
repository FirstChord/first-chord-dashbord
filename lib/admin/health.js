import { buildFlagsFreshnessSummary } from './health-helpers.mjs';
import { getReviewFlagsRows } from './sheets';
import { checkMmsHealth } from './mms';

const GITHUB_API_BASE = 'https://api.github.com';
const DASHBOARD_REPO = 'FirstChord/first-chord-dashbord';
const BRAIN_REPO = 'FirstChord/first-chord-brain';

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
  const response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/actions/workflows/${workflowFile}/runs?per_page=1`, {
    headers: getGithubHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`GitHub workflow status failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload.workflow_runs?.[0] || null;
}

function mapWorkflowRun(run, fallbackLabel) {
  if (!run) {
    return {
      label: fallbackLabel,
      status: 'Unknown',
      detail: 'No workflow runs found yet.',
      updatedAt: null,
      conclusion: '',
      htmlUrl: '',
    };
  }

  const updatedAt = run.updated_at || run.run_started_at || run.created_at || null;

  if (run.status !== 'completed') {
    return {
      label: fallbackLabel,
      status: 'Running',
      detail: `${run.name || fallbackLabel} is currently ${run.status}.`,
      updatedAt,
      conclusion: run.conclusion || '',
      htmlUrl: run.html_url || '',
    };
  }

  if (run.conclusion === 'success') {
    return {
      label: fallbackLabel,
      status: 'Healthy',
      detail: 'Latest workflow run succeeded.',
      updatedAt,
      conclusion: run.conclusion || '',
      htmlUrl: run.html_url || '',
    };
  }

  return {
    label: fallbackLabel,
    status: 'Failing',
    detail: `Latest workflow run concluded with ${run.conclusion || 'an unknown state'}.`,
    updatedAt,
    conclusion: run.conclusion || '',
    htmlUrl: run.html_url || '',
  };
}

export async function getAdminHealthSummary() {
  const flagRows = await getReviewFlagsRows();
  const flagsFreshness = buildFlagsFreshnessSummary(flagRows);

  const [mmsResult, configWorkflowResult, fcWorkflowResult] = await Promise.allSettled([
    checkMmsHealth(),
    getLatestWorkflowRun({
      repo: DASHBOARD_REPO,
      workflowFile: 'generate-configs.yml',
    }),
    getLatestWorkflowRun({
      repo: BRAIN_REPO,
      workflowFile: 'regenerate-fc-ids.yml',
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
      ? mapWorkflowRun(configWorkflowResult.value, 'Generate configs')
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
      ? mapWorkflowRun(fcWorkflowResult.value, 'Regenerate FC IDs')
      : {
          label: 'Regenerate FC IDs',
          status: 'Unknown',
          detail: fcWorkflowResult.reason?.message || 'Could not load workflow status.',
          updatedAt: null,
          conclusion: '',
          htmlUrl: '',
        };

  return {
    flagsFreshness,
    mms,
    configWorkflow,
    fcWorkflow,
  };
}
