import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const DOC_EXTENSIONS = new Set(['.md']);
const CODE_ROOTS = ['app', 'components', 'lib', 'scripts', 'tests'];
const DOC_ROOTS = ['docs'];
const LARGE_CODE_LINE_THRESHOLD = 1200;
const LARGE_HELPER_LINE_THRESHOLD = 900;
const LARGE_DOC_LINE_THRESHOLD = 260;

const IGNORED_PARTS = new Set([
  '.git',
  '.next',
  'node_modules',
  'backups',
  'coverage',
]);

const GENERATED_PATH_PREFIXES = [
  'lib/config/',
  'lib/student-url-mappings.js',
  'lib/student-helpers.js',
  'lib/soundslice-mappings.js',
];

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}

function isIgnored(relative) {
  const parts = relative.split('/');
  return parts.some((part) => IGNORED_PARTS.has(part))
    || GENERATED_PATH_PREFIXES.some((prefix) => relative.startsWith(prefix));
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    const relative = relativePath(filePath);
    if (isIgnored(relative)) continue;

    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      walk(filePath, files);
    } else {
      files.push(filePath);
    }
  }

  return files;
}

function lineCount(filePath) {
  return readFileSync(filePath, 'utf8').split(/\r?\n/u).length;
}

function changedFiles() {
  const output = runGit(['diff', '--name-only', 'HEAD']);
  return output ? output.split('\n').map((file) => file.trim()).filter(Boolean) : [];
}

function changedDiff() {
  return runGit(['diff', '--', '.']);
}

function changedDiffByFile() {
  const output = runGit(['diff', '--unified=0', '--', '.']);
  const files = new Map();
  let currentFile = '';

  for (const line of output.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice('+++ b/'.length);
      if (!files.has(currentFile)) files.set(currentFile, []);
      continue;
    }

    if (!currentFile || !line.startsWith('+') || line.startsWith('+++')) {
      continue;
    }

    files.get(currentFile).push(line.slice(1));
  }

  return files;
}

function formatRows(rows) {
  return rows.map((row) => `  - ${row.path}: ${row.lines} lines`).join('\n');
}

function collectLargeCodeFiles() {
  const files = CODE_ROOTS.flatMap((root) => walk(path.join(repoRoot, root)));
  return files
    .map((filePath) => ({
      path: relativePath(filePath),
      extension: path.extname(filePath),
      lines: CODE_EXTENSIONS.has(path.extname(filePath)) ? lineCount(filePath) : 0,
    }))
    .filter((entry) => CODE_EXTENSIONS.has(entry.extension))
    .filter((entry) => {
      const threshold = entry.path.includes('/helpers') || entry.path.endsWith('-helpers.mjs')
        ? LARGE_HELPER_LINE_THRESHOLD
        : LARGE_CODE_LINE_THRESHOLD;
      return entry.lines >= threshold;
    })
    .sort((a, b) => b.lines - a.lines);
}

function collectLargeDocs() {
  const files = DOC_ROOTS.flatMap((root) => walk(path.join(repoRoot, root)));
  return files
    .map((filePath) => ({
      path: relativePath(filePath),
      extension: path.extname(filePath),
      lines: DOC_EXTENSIONS.has(path.extname(filePath)) ? lineCount(filePath) : 0,
    }))
    .filter((entry) => DOC_EXTENSIONS.has(entry.extension))
    .filter((entry) => entry.lines >= LARGE_DOC_LINE_THRESHOLD)
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 12);
}

function hasMeaningfulCodeChange(files) {
  return files.some((file) => {
    const extension = path.extname(file);
    return CODE_EXTENSIONS.has(extension) && !isIgnored(file);
  });
}

function hasRepoDocChange(files) {
  return files.some((file) => file.startsWith('docs/') && DOC_EXTENSIONS.has(path.extname(file)));
}

function hasStateTabTouch(diffText) {
  return /(?:_SHEET|HEADERS|buildManagedStateSheetDefinitions|ensureManagedSheet|upsertManagedSheetRow)/u.test(diffText);
}

function hasRouteOrWorkflowTouch(files) {
  return files.some((file) => (
    /^app\/admin\/.+\/page\.(js|jsx|ts|tsx)$/u.test(file)
    || /^app\/api\/.+\/route\.(js|ts)$/u.test(file)
    || /^components\/admin\//u.test(file)
    || /^lib\/admin\/.+workflow/u.test(file)
  ));
}

function hasAddedLine(fileDiffs, predicate) {
  return [...fileDiffs.entries()].filter(([file, lines]) => predicate(file, lines));
}

function isCodeFile(file) {
  return CODE_EXTENSIONS.has(path.extname(file));
}

function printSection(title, body) {
  console.log(`\n${title}`);
  console.log(body);
}

const files = changedFiles();
const diffText = changedDiff();
const fileDiffs = changedDiffByFile();
const warnings = [];

const largeCodeFiles = collectLargeCodeFiles();
if (largeCodeFiles.length) {
  warnings.push({
    title: 'Large code files to keep an eye on',
    body: `${formatRows(largeCodeFiles.slice(0, 12))}\n  Consider splitting only when future edits become context-heavy.`,
  });
}

const largeDocs = collectLargeDocs();
if (largeDocs.length) {
  warnings.push({
    title: 'Large docs to keep bounded',
    body: `${formatRows(largeDocs)}\n  Prefer pruning, pointing, or moving history to git/Obsidian rather than growing snapshots.`,
  });
}

if (hasMeaningfulCodeChange(files) && !hasRepoDocChange(files)) {
  warnings.push({
    title: 'Meaningful code changed without repo docs',
    body: 'If this changed behaviour, state lanes, safety, or a workflow boundary, update the canonical repo doc before committing.',
  });
}

if (hasStateTabTouch(diffText) && !files.includes('docs/admin/STATE_TABS_SCHEMA.md')) {
  warnings.push({
    title: 'Sheets/state-layer code changed',
    body: 'If a tab/header/write pattern changed, update docs/admin/STATE_TABS_SCHEMA.md. If this was only a refactor, no doc change may be needed.',
  });
}

if (hasRouteOrWorkflowTouch(files) && !files.includes('docs/admin/CURRENT_STATUS.md')) {
  warnings.push({
    title: 'Admin route/workflow changed',
    body: 'If this changed a live workflow or surfaced a new operating layer, update docs/admin/CURRENT_STATUS.md or the relevant workflow doc.',
  });
}

const addedReloads = hasAddedLine(fileDiffs, (file, lines) => (
  isCodeFile(file)
  && lines.some((line) => /window\.location\.reload\(/u.test(line))
));
if (addedReloads.length) {
  warnings.push({
    title: 'New full-page reload introduced',
    body: `${addedReloads.map(([file]) => `  - ${file}`).join('\n')}\n  Prefer local state updates or router.refresh() so users keep context and avoid a white flash.`,
  });
}

const addedAdminFetches = hasAddedLine(fileDiffs, (file, lines) => (
  /^components\/admin\//u.test(file)
  && lines.some((line) => /fetch\((['"])\/api\/admin\//u.test(line))
));
if (addedAdminFetches.length) {
  warnings.push({
    title: 'New direct admin fetch introduced',
    body: `${addedAdminFetches.map(([file]) => `  - ${file}`).join('\n')}\n  If this is async UI work, pair it with visible pending/error/success feedback. Prefer the shared async/action-button pattern when practical.`,
  });
}

const addedRawButtons = hasAddedLine(fileDiffs, (file, lines) => (
  /^components\/admin\//u.test(file)
  && !/^components\/admin\/ui\//u.test(file)
  && lines.some((line) => /<button(?:\s|>)/u.test(line))
));
if (addedRawButtons.length) {
  warnings.push({
    title: 'New raw admin buttons introduced',
    body: `${addedRawButtons.map(([file]) => `  - ${file}`).join('\n')}\n  For new async actions, use ActionButton/ConfirmButton or explain why a plain button is only local UI state.`,
  });
}

console.log('First Chord hygiene check');
console.log('Non-blocking: warnings are prompts for judgement, not failures.');
console.log(`Changed files: ${files.length}`);

if (!warnings.length) {
  console.log('\nNo hygiene warnings.');
  process.exit(0);
}

for (const warning of warnings) {
  printSection(warning.title, warning.body);
}

console.log('\nRecommended rhythm: run before meaningful commits, then use judgement.');
