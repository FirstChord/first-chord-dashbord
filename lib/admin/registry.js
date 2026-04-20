import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getRegistryFileFromGithub, updateRegistryFileOnGithub } from '@/lib/admin/github';
import { escapeRegistryValue, parseRegistry, updateEntryBlock } from './registry-helpers.mjs';

const REGISTRY_PATH = path.join(process.cwd(), 'lib/config/students-registry.js');

async function readRegistryFile() {
  if (process.env.GITHUB_TOKEN && process.env.NODE_ENV === 'production') {
    const remoteFile = await getRegistryFileFromGithub();
    return remoteFile.content;
  }

  return readFile(REGISTRY_PATH, 'utf8');
}

export async function getRegistryEntries() {
  const source = await readRegistryFile();
  return parseRegistry(source);
}

export async function getRegistryEntryByMmsId(mmsId) {
  const entries = await getRegistryEntries();
  return entries.find((entry) => entry.mmsId === mmsId) || null;
}

async function writeRegistryFile(contents) {
  if (process.env.GITHUB_TOKEN && process.env.NODE_ENV === 'production') {
    const remoteFile = await getRegistryFileFromGithub();
    await updateRegistryFileOnGithub({
      content: contents,
      sha: remoteFile.sha,
      message: 'chore: update student registry via admin dashboard',
    });
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Registry write path is only available for local development until GitHub API support is added');
  }

  const { writeFile } = await import('node:fs/promises');
  await writeFile(REGISTRY_PATH, contents, 'utf8');
}

export async function updateRegistryEntry(mmsId, updates) {
  const source = await readRegistryFile();
  const blockPattern = new RegExp(`('${mmsId}':\\s*\\{[\\s\\S]*?\\n\\s*\\},)`);
  const match = source.match(blockPattern);

  if (!match) {
    throw new Error(`Student ${mmsId} was not found in students-registry.js`);
  }

  const updatedBlock = updateEntryBlock(match[1], updates);
  const nextSource = source.replace(blockPattern, updatedBlock);

  await writeRegistryFile(nextSource);
  const nextEntries = parseRegistry(nextSource);
  return nextEntries.find((entry) => entry.mmsId === mmsId) || null;
}

export async function appendRegistryEntry(entry) {
  const source = await readRegistryFile();
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
  const nextSource = source.replace(/\n};\s*$/, `${entryBlock}\n};\n`);

  await writeRegistryFile(nextSource);
  const nextEntries = parseRegistry(nextSource);
  return nextEntries.find((item) => item.mmsId === entry.mmsId) || null;
}

export async function deleteRegistryEntry(mmsId) {
  const source = await readRegistryFile();
  const blockPattern = new RegExp(`\\n\\s*'${mmsId}':\\s*\\{[\\s\\S]*?\\n\\s*\\},\\s*(?:\\/\\/.*)?\\n?`, 'm');

  if (!blockPattern.test(source)) {
    throw new Error(`Student ${mmsId} was not found in students-registry.js`);
  }

  const nextSource = source.replace(blockPattern, '\n');
  await writeRegistryFile(nextSource);

  return { deleted: true, mmsId };
}
