import { shouldRetryGithubRegistryUpdate } from './github-helpers.mjs';

const GITHUB_API_BASE = 'https://api.github.com';
const REGISTRY_REPO = 'FirstChord/first-chord-dashbord';
const REGISTRY_PATH = 'lib/config/students-registry.js';

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

export async function getRegistryFileFromGithub() {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${REGISTRY_REPO}/contents/${REGISTRY_PATH}`,
    {
      headers: getGithubHeaders(),
      cache: 'no-store',
    }
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
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${REGISTRY_REPO}/contents/${REGISTRY_PATH}`,
      {
        method: 'PUT',
        headers: getGithubHeaders(),
        body: JSON.stringify({
          message,
          content: Buffer.from(content, 'utf8').toString('base64'),
          sha: currentSha,
        }),
      }
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
