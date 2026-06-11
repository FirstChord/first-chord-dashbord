import { readFile } from 'node:fs/promises';

export async function loadEnvFile(filePath) {
  let raw = '';
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] != null) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

export async function loadLocalEnv(repoRoot) {
  await loadEnvFile(`${repoRoot}/.env.local`);
  await loadEnvFile(`${repoRoot}/.env`);
}
