/** @fileoverview Reads the students registry from disk and commits appends, updates, and deletes through GitHub. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertGithubRegistryWriteAccess,
  getRegistryFileFromGithub,
  updateRegistryFileOnGithub,
} from '@/lib/admin/github';
import {
  escapeRegistryValue,
  parseRegistry,
  readRegistrySource,
  updateEntryBlock,
} from './registry-helpers.mjs';

const REGISTRY_PATH = path.join(process.cwd(), 'lib/config/students-registry.js');

async function readRegistryFile({ allowBundledFallback = true } = {}) {
  return readRegistrySource({
    nodeEnv: process.env.NODE_ENV,
    githubToken: process.env.GITHUB_TOKEN,
    readGithub: getRegistryFileFromGithub,
    readBundled: () => readFile(REGISTRY_PATH, 'utf8'),
    allowBundledFallback,
    onGithubReadFailure: (error) => {
      const detail = error instanceof Error ? error.message : 'unknown error';
      console.warn(`GitHub registry read failed; using bundled registry snapshot: ${detail}`);
    },
  });
}

export async function getRegistryEntries() {
  const source = await readRegistryFile();
  return parseRegistry(source);
}

export async function getRegistryEntryByMmsId(mmsId) {
  const entries = await getRegistryEntries();
  return entries.find((entry) => entry.mmsId === mmsId) || null;
}

export async function assertRegistryWriteAvailable() {
  if (process.env.NODE_ENV === 'production') {
    await assertGithubRegistryWriteAccess();
  }

  await readRegistryFile({ allowBundledFallback: false });
  return { available: true };
}

async function mutateRegistryFile(buildContent) {
  if (process.env.GITHUB_TOKEN && process.env.NODE_ENV === 'production') {
    const committed = await updateRegistryFileOnGithub({
      buildContent,
      message: 'chore: update student registry via admin dashboard',
    });
    return committed.content;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Registry write path is only available for local development until GitHub API support is added');
  }

  const source = await readRegistryFile({ allowBundledFallback: false });
  const contents = await buildContent(source);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(REGISTRY_PATH, contents, 'utf8');
  return contents;
}

export async function updateRegistryEntry(mmsId, updates) {
  const nextSource = await mutateRegistryFile((source) => {
    const blockPattern = new RegExp(`('${mmsId}':\\s*\\{[\\s\\S]*?\\n\\s*\\},)`);
    const match = source.match(blockPattern);

    if (!match) {
      throw new Error(`Student ${mmsId} was not found in students-registry.js`);
    }

    const updatedBlock = updateEntryBlock(match[1], updates);
    return source.replace(blockPattern, updatedBlock);
  });
  const nextEntries = parseRegistry(nextSource);
  return nextEntries.find((entry) => entry.mmsId === mmsId) || null;
}

export async function appendRegistryEntry(entry) {
  const entryBlock = `
  '${entry.mmsId}': {
    firstName: '${escapeRegistryValue(entry.firstName)}',
    lastName: '${escapeRegistryValue(entry.lastName)}',
    friendlyUrl: '${escapeRegistryValue(entry.friendlyUrl)}',
    tutor: '${escapeRegistryValue(entry.tutor)}',
    instrument: '${escapeRegistryValue(entry.instrument)}',
    soundsliceUrl: '${escapeRegistryValue(entry.soundsliceUrl)}',
    thetaUsername: '${escapeRegistryValue(entry.thetaUsername)}',
    fcStudentId: '${escapeRegistryValue(entry.fcStudentId)}',
  }, // ${escapeRegistryValue(`${entry.firstName} ${entry.lastName}`)}
`;
  const nextSource = await mutateRegistryFile((source) => {
    const entries = parseRegistry(source);
    if (entries.some((item) => item.mmsId === entry.mmsId)) {
      throw new Error(`Student ${entry.mmsId} already exists in students-registry.js`);
    }

    const updated = source.replace(/\n};\s*$/, `${entryBlock}\n};\n`);
    if (updated === source) {
      throw new Error('Could not find the students-registry.js insertion boundary');
    }
    return updated;
  });
  const nextEntries = parseRegistry(nextSource);
  return nextEntries.find((item) => item.mmsId === entry.mmsId) || null;
}

export async function deleteRegistryEntry(mmsId) {
  await mutateRegistryFile((source) => {
    const blockPattern = new RegExp(`\\n\\s*'${mmsId}':\\s*\\{[\\s\\S]*?\\n\\s*\\},\\s*(?:\\/\\/.*)?\\n?`, 'm');

    if (!blockPattern.test(source)) {
      throw new Error(`Student ${mmsId} was not found in students-registry.js`);
    }

    return source.replace(blockPattern, '\n');
  });

  return { deleted: true, mmsId };
}
