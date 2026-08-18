/** @fileoverview GitHub API client reading and committing the students registry file with timeouts and sha-conflict retries. */
import {
  commitGithubRegistryMutation,
  hasGithubRegistryWriteAccess,
} from './github-helpers.mjs';
import { fetchWithProviderTimeout, resolveProviderTimeoutMs } from './provider-fetch.mjs';
import { getDashboardRepo } from './github-repos.mjs';

const GITHUB_API_BASE = 'https://api.github.com';
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
    `${GITHUB_API_BASE}/repos/${getDashboardRepo()}`,
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
    repository: payload.full_name || getDashboardRepo(),
    permissions: payload.permissions || {},
  };
}

export async function getRegistryFileFromGithub() {
  const response = await fetchWithProviderTimeout(
    `${GITHUB_API_BASE}/repos/${getDashboardRepo()}/contents/${REGISTRY_PATH}`,
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

export async function updateRegistryFileOnGithub({ buildContent, message }) {
  return commitGithubRegistryMutation({
    readCurrent: getRegistryFileFromGithub,
    buildContent,
    writeCurrent: async ({ content, sha }) => {
      const response = await fetchWithProviderTimeout(
        `${GITHUB_API_BASE}/repos/${getDashboardRepo()}/contents/${REGISTRY_PATH}`,
        {
          method: 'PUT',
          headers: getGithubHeaders(),
          body: JSON.stringify({
            message,
            content: Buffer.from(content, 'utf8').toString('base64'),
            sha,
          }),
        },
        {
          provider: 'GitHub',
          timeoutMs: GITHUB_REQUEST_TIMEOUT_MS,
        },
      );

      if (response.ok) {
        return {
          ok: true,
          result: await response.json(),
        };
      }

      const errorBody = await response.text();
      return {
        ok: false,
        status: response.status,
        errorBody,
      };
    },
  });
}
