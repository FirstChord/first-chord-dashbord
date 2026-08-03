import {
  hasGithubRegistryWriteAccess,
  shouldRetryGithubRegistryUpdate,
} from './github-helpers.mjs';
import { fetchWithProviderTimeout, resolveProviderTimeoutMs } from './provider-fetch.mjs';

const GITHUB_API_BASE = 'https://api.github.com';
const REGISTRY_REPO = 'FirstChord/first-chord-dashbord';
const REGISTRY_PATH = 'lib/config/students-registry.js';
const GITHUB_REQUEST_TIMEOUT_MS = resolveProviderTimeoutMs(process.env.GITHUB_REQUEST_TIMEOUT_MS);

function getGithubHeaders() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured');
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

export async function assertGithubRegistryWriteAccess() {
  const response = await fetchWithProviderTimeout(
    `${GITHUB_API_BASE}/repos/${REGISTRY_REPO}`,
    {
      headers: getGithubHeaders(),
      cache: 'no-store',
    },
    {
      provider: 'GitHub',
      timeoutMs: GITHUB_REQUEST_TIMEOUT_MS,
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub registry access check failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!hasGithubRegistryWriteAccess(payload.permissions)) {
    throw new Error('GitHub registry token does not have repository write access');
  }

  return {
    repository: payload.full_name || REGISTRY_REPO,
    permissions: payload.permissions || {},
  };
}

export async function getRegistryFileFromGithub() {
  const response = await fetchWithProviderTimeout(
    `${GITHUB_API_BASE}/repos/${REGISTRY_REPO}/contents/${REGISTRY_PATH}`,
    {
      headers: getGithubHeaders(),
      cache: 'no-store',
    },
    {
      provider: 'GitHub',
      timeoutMs: GITHUB_REQUEST_TIMEOUT_MS,
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub registry fetch failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = Buffer.from(payload.content, 'base64').toString('utf8');

  return {
    sha: payload.sha,
    content,
  };
}

export async function updateRegistryFileOnGithub({ content, sha, message }) {
  let currentSha = sha;
  let attempts = 0;

  while (attempts < 2) {
    const response = await fetchWithProviderTimeout(
      `${GITHUB_API_BASE}/repos/${REGISTRY_REPO}/contents/${REGISTRY_PATH}`,
      {
        method: 'PUT',
        headers: getGithubHeaders(),
        body: JSON.stringify({
          message,
          content: Buffer.from(content, 'utf8').toString('base64'),
          sha: currentSha,
        }),
      },
      {
        provider: 'GitHub',
        timeoutMs: GITHUB_REQUEST_TIMEOUT_MS,
      },
    );

    if (response.ok) {
      return response.json();
    }

    const errorBody = await response.text();

    if (attempts === 0 && shouldRetryGithubRegistryUpdate({ status: response.status, errorBody })) {
      const latest = await getRegistryFileFromGithub();
      currentSha = latest.sha;
      attempts += 1;
      continue;
    }

    throw new Error(`GitHub registry update failed: ${response.status} ${errorBody}`);
  }
}
