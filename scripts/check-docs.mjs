import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(repositoryRoot, 'docs');
const errors = [];
const allowedStatuses = new Set([
  'canonical',
  'supporting',
  'active-plan',
  'parked',
  'historical',
]);

function walk(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['.git', '.next', 'node_modules'].includes(entry.name)) return [];
      return walk(target, predicate);
    }
    return entry.isFile() && predicate(target) ? [target] : [];
  });
}

function relative(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join('/');
}

function frontmatter(source) {
  if (!source.startsWith('---\n')) return null;
  const end = source.indexOf('\n---\n', 4);
  if (end === -1) return null;
  const values = new Map();
  for (const line of source.slice(4, end).split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return values;
}

function expectedStatus(file) {
  const name = relative(file);
  if (name.startsWith('docs/history/')) return 'historical';
  if (name.startsWith('docs/plans/active/')) return 'active-plan';
  if (name.startsWith('docs/plans/parked/')) return 'parked';
  return null;
}

const markdownFiles = walk(docsRoot, (file) => file.endsWith('.md'));
for (const file of markdownFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const metadata = frontmatter(source);
  if (!metadata) {
    errors.push(`${relative(file)}: missing YAML frontmatter`);
    continue;
  }

  const status = metadata.get('status');
  if (!allowedStatuses.has(status)) {
    errors.push(`${relative(file)}: invalid or missing status`);
  }
  if (!metadata.get('audience')) {
    errors.push(`${relative(file)}: missing audience`);
  }
  if (!metadata.has('last_verified')) {
    errors.push(`${relative(file)}: missing last_verified (use null when not reviewed)`);
  }

  const requiredStatus = expectedStatus(file);
  if (requiredStatus && status !== requiredStatus) {
    errors.push(`${relative(file)}: expected status ${requiredStatus}, found ${status}`);
  }
}

const retiredIndexes = [
  'docs/INDEX.md',
  'docs/admin/INDEX.md',
  'docs/admin/DOCUMENTATION_MAP.md',
];
for (const name of retiredIndexes) {
  if (fs.existsSync(path.join(repositoryRoot, name))) {
    errors.push(`${name}: retired navigation file must not be restored`);
  }
}

for (const directory of ['docs/admin', 'docs/archives', 'docs/guides', 'docs/protocols']) {
  const remaining = walk(path.join(repositoryRoot, directory), (file) => file.endsWith('.md'));
  for (const file of remaining) {
    errors.push(`${relative(file)}: Markdown belongs in the intent-led docs tree`);
  }
}

const markdownSources = [
  path.join(repositoryRoot, 'AGENTS.md'),
  path.join(repositoryRoot, 'README.md'),
  ...walk(path.join(repositoryRoot, '.claude'), (file) => file.endsWith('.md')),
  ...markdownFiles,
  ...walk(path.join(repositoryRoot, 'tools'), (file) => file.endsWith('.md')),
].filter((file, index, files) => fs.existsSync(file) && files.indexOf(file) === index);

for (const file of markdownSources) {
  const source = fs.readFileSync(file, 'utf8');
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    target = target.split('#', 1)[0].split('?', 1)[0];
    if (!target || /^(?:https?:|mailto:|tel:|data:)/i.test(target) || target.startsWith('/')) continue;
    try {
      target = decodeURIComponent(target);
    } catch {
      errors.push(`${relative(file)}: malformed link ${match[1]}`);
      continue;
    }
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) {
      errors.push(`${relative(file)}: broken link ${match[1]}`);
    }
  }
}

const exactPathSources = [
  ...markdownSources,
  ...walk(path.join(repositoryRoot, 'app'), (file) => /\.(?:js|jsx|mjs|ts|tsx)$/.test(file)),
  ...walk(path.join(repositoryRoot, 'components'), (file) => /\.(?:js|jsx|mjs|ts|tsx)$/.test(file)),
  ...walk(path.join(repositoryRoot, 'lib'), (file) => /\.(?:js|jsx|mjs|ts|tsx)$/.test(file)),
  ...walk(path.join(repositoryRoot, 'scripts'), (file) => /\.(?:js|mjs)$/.test(file)),
  ...walk(path.join(repositoryRoot, 'tests'), (file) => /\.(?:js|mjs)$/.test(file)),
].filter((file, index, files) =>
  files.indexOf(file) === index && relative(file) !== 'scripts/check-docs.mjs'
);

for (const file of exactPathSources) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/docs\/[A-Za-z0-9_./-]+\.md/g)) {
    if (!fs.existsSync(path.join(repositoryRoot, match[0]))) {
      errors.push(`${relative(file)}: missing referenced path ${match[0]}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Documentation check failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  for (const error of [...new Set(errors)].sort()) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Documentation check passed (${markdownFiles.length} docs, ${markdownSources.length} Markdown sources).`);
