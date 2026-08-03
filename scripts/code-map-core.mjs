import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CODE_MAP_RELATIVE_PATH = 'docs/reference/code-map.md';

const CODE_EXTENSIONS = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];
const MAPPED_ROOTS = ['lib/admin', 'lib/songs'];
const GRAPH_ROOTS = ['app', 'components', 'lib', 'scripts', 'tests'];
const MAX_SOURCE_NOTE_LENGTH = 220;
const IGNORED_DIRECTORIES = new Set(['.git', '.next', 'backups', 'coverage', 'node_modules']);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function relative(repoRoot, filePath) {
  return toPosix(path.relative(repoRoot, filePath));
}

function walk(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return IGNORED_DIRECTORIES.has(entry.name) ? [] : walk(target, predicate);
      return entry.isFile() && predicate(target) ? [target] : [];
    });
}

function isCodeFile(filePath) {
  return CODE_EXTENSIONS.includes(path.extname(filePath));
}

export function collectMappedSourcePaths(repoRoot) {
  const files = MAPPED_ROOTS.flatMap((root) => walk(
    path.join(repoRoot, root),
    isCodeFile,
  ));
  const routeFiles = walk(
    path.join(repoRoot, 'app'),
    (filePath) => /^route\.(?:js|mjs|ts)$/u.test(path.basename(filePath)),
  );
  return [...new Set([...files, ...routeFiles].map((filePath) => relative(repoRoot, filePath)))]
    .sort();
}

export function collectGraphSourcePaths(repoRoot) {
  const files = GRAPH_ROOTS.flatMap((root) => walk(path.join(repoRoot, root), isCodeFile));
  for (const name of ['middleware.js', 'middleware.ts']) {
    const target = path.join(repoRoot, name);
    if (fs.existsSync(target)) files.push(target);
  }
  return [...new Set(files.map((filePath) => relative(repoRoot, filePath)))].sort();
}

function lineNumberAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function cleanCommentText(raw) {
  return raw
    .replace(/^\s*\/\*\*?/u, '')
    .replace(/\*\/\s*$/u, '')
    .split(/\r?\n/u)
    .map((line) => line
      .replace(/^\s*\/\/\s?/u, '')
      .replace(/^\s*\*\s?/u, '')
      .replace(/^-{2,}\s*/u, '')
      .replace(/\s*-{2,}$/u, '')
      .trim())
    .filter((line) => line && !/^@(?:param|returns?|throws?|type)\b/u.test(line))
    .join(' ')
    .replace(/^@fileoverview\s+/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function firstSentence(value) {
  if (!value) return '';
  const sentence = value.match(/^(.+?[.!?])(?:\s|$)/u)?.[1] || value;
  if (sentence.length <= MAX_SOURCE_NOTE_LENGTH) return sentence;
  const shortened = sentence.slice(0, MAX_SOURCE_NOTE_LENGTH - 1);
  const wordBoundary = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, Math.max(wordBoundary, 80)).trim()}…`;
}

function commentCandidates(sourceBeforeFirstExport) {
  const candidates = [];
  const lines = sourceBeforeFirstExport.split(/\r?\n/u);
  const offsets = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) {
      const startOffset = offsets[index] + line.indexOf('//');
      const block = [];
      while (index < lines.length && lines[index].trim().startsWith('//')) {
        block.push(lines[index]);
        index += 1;
      }
      index -= 1;
      candidates.push({ raw: block.join('\n'), offset: startOffset });
      continue;
    }

    if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
      const marker = trimmed.startsWith('/**') ? '/**' : '/*';
      const startOffset = offsets[index] + line.indexOf(marker);
      const block = [line];
      while (!block.at(-1).includes('*/') && index + 1 < lines.length) {
        index += 1;
        block.push(lines[index]);
      }
      candidates.push({ raw: block.join('\n'), offset: startOffset });
    }
  }
  return candidates;
}

export function extractSourceNote(source) {
  const firstExport = source.search(/^[ \t]*export\b/mu);
  const before = firstExport === -1 ? source : source.slice(0, firstExport);
  const candidates = commentCandidates(before);
  const explicit = candidates.find(({ raw }) => /@fileoverview\b/u.test(raw));
  const selected = explicit || candidates.find(({ raw }) => {
    const value = cleanCommentText(raw);
    return value && !/^(?:eslint|istanbul|prettier)\b/iu.test(value) && !/^-+$/u.test(value);
  });
  if (!selected) return { text: '', line: null, explicit: false };
  return {
    text: firstSentence(cleanCommentText(selected.raw)),
    line: lineNumberAt(source, selected.offset),
    explicit: Boolean(explicit),
  };
}

function addExport(results, seen, source, match, name, kind, sourcePath = '') {
  const key = `${match.index}:${name}:${sourcePath}`;
  if (seen.has(key)) return;
  seen.add(key);
  results.push({
    name,
    kind,
    line: lineNumberAt(source, match.index),
    source: sourcePath,
  });
}

export function extractExports(source) {
  const results = [];
  const seen = new Set();

  const declarations = /^[ \t]*export[ \t]+(?:(async)[ \t]+)?(function|class|const|let|var)[ \t]+([A-Za-z_$][\w$]*)/gmu;
  for (const match of source.matchAll(declarations)) {
    addExport(results, seen, source, match, match[3], match[1] ? `async ${match[2]}` : match[2]);
  }

  const defaults = /^[ \t]*export[ \t]+default(?:[ \t]+(?:async[ \t]+)?(?:function|class)[ \t]*([A-Za-z_$][\w$]*)?)?/gmu;
  for (const match of source.matchAll(defaults)) {
    addExport(results, seen, source, match, match[1] ? `default:${match[1]}` : 'default', 'default');
  }

  const namedBlocks = /^[ \t]*export[ \t]*\{([\s\S]*?)\}[ \t]*(?:from[ \t]*['"]([^'"]+)['"])?[ \t]*;?/gmu;
  for (const match of source.matchAll(namedBlocks)) {
    const block = match[1]
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '');
    for (const part of block.split(',')) {
      const cleaned = part.trim().replace(/^type\s+/u, '');
      if (!cleaned) continue;
      const pieces = cleaned.split(/\s+as\s+/u);
      const name = pieces.at(-1)?.trim();
      if (name) addExport(results, seen, source, match, name, 'named', match[2] || '');
    }
  }

  const stars = /^[ \t]*export[ \t]+\*(?:[ \t]+as[ \t]+([A-Za-z_$][\w$]*))?[ \t]+from[ \t]*['"]([^'"]+)['"]/gmu;
  for (const match of source.matchAll(stars)) {
    addExport(results, seen, source, match, match[1] || '*', 'star', match[2]);
  }

  return results.sort((left, right) => left.line - right.line);
}

export function findUnsupportedExportLines(source, exports = extractExports(source)) {
  const parsedLines = new Set(exports.map((entry) => entry.line));
  return [...source.matchAll(/^[ \t]*export\b/gmu)]
    .map((match) => lineNumberAt(source, match.index))
    .filter((line) => !parsedLines.has(line));
}

export function extractImportSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /^[ \t]*import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gmu,
    /^[ \t]*import[ \t]*['"]([^'"]+)['"]/gmu,
    /^[ \t]*export\s+(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/gmu,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/gu,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function resolveImport(repoRoot, importer, specifier, knownPaths) {
  const cleanSpecifier = specifier.split(/[?#]/u, 1)[0];
  let base;
  if (cleanSpecifier.startsWith('@/')) {
    base = path.join(repoRoot, cleanSpecifier.slice(2));
  } else if (cleanSpecifier.startsWith('.')) {
    base = path.resolve(repoRoot, path.dirname(importer), cleanSpecifier);
  } else {
    return '';
  }

  const candidates = [base];
  if (!path.extname(base)) {
    for (const extension of CODE_EXTENSIONS) candidates.push(`${base}${extension}`);
    for (const extension of CODE_EXTENSIONS) candidates.push(path.join(base, `index${extension}`));
  }
  return candidates
    .map((candidate) => relative(repoRoot, candidate))
    .find((candidate) => knownPaths.has(candidate)) || '';
}

export function buildImportGraph({ repoRoot, sourcePaths = collectGraphSourcePaths(repoRoot) }) {
  const knownPaths = new Set(sourcePaths);
  const importsByFile = new Map();
  const consumersByFile = new Map(sourcePaths.map((sourcePath) => [sourcePath, new Set()]));

  for (const sourcePath of sourcePaths) {
    const source = fs.readFileSync(path.join(repoRoot, sourcePath), 'utf8');
    const resolved = new Set(extractImportSpecifiers(source)
      .map((specifier) => resolveImport(repoRoot, sourcePath, specifier, knownPaths))
      .filter(Boolean));
    importsByFile.set(sourcePath, resolved);
    for (const dependency of resolved) {
      if (!consumersByFile.has(dependency)) consumersByFile.set(dependency, new Set());
      consumersByFile.get(dependency).add(sourcePath);
    }
  }

  return { sourcePaths, importsByFile, consumersByFile };
}

function isTestPath(sourcePath) {
  return /^tests\//u.test(sourcePath);
}

function fingerprintFor(records) {
  const facts = records.map((record) => ({
    path: record.path,
    sourceNote: record.sourceNote,
    exports: record.exports,
    directTests: record.directTests,
  }));
  return crypto.createHash('sha256').update(JSON.stringify(facts)).digest('hex').slice(0, 16);
}

export function buildCodeIndex({ repoRoot }) {
  const mappedPaths = collectMappedSourcePaths(repoRoot);
  const graph = buildImportGraph({ repoRoot });
  const records = mappedPaths.map((sourcePath) => {
    const source = fs.readFileSync(path.join(repoRoot, sourcePath), 'utf8');
    const exports = extractExports(source);
    const consumers = [...(graph.consumersByFile.get(sourcePath) || [])].sort();
    return {
      path: sourcePath,
      sourceNote: extractSourceNote(source),
      exports,
      unsupportedExportLines: findUnsupportedExportLines(source, exports),
      directTests: consumers.filter(isTestPath),
      directConsumers: consumers.filter((consumer) => !isTestPath(consumer)),
    };
  });
  return {
    repoRoot,
    records,
    recordsByPath: new Map(records.map((record) => [record.path, record])),
    graph,
    fingerprint: fingerprintFor(records),
  };
}

function escapeTableText(value) {
  return `${value || ''}`
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll('`', '\\`')
    .replace(/\s+/gu, ' ')
    .trim();
}

function codeLink(sourcePath, label = sourcePath) {
  return `[${escapeTableText(label)}](../../${sourcePath})`;
}

function renderExports(exports) {
  if (!exports.length) return '—';
  return exports.map((entry) => `\`${entry.name}\` L${entry.line}`).join(', ');
}

function renderTests(tests) {
  if (!tests.length) return '—';
  return tests.map((testPath) => codeLink(testPath, path.basename(testPath))).join(', ');
}

export function renderCodeMap(index) {
  const groups = new Map();
  for (const record of index.records) {
    let directory = path.posix.dirname(record.path);
    if (record.path.startsWith('app/api/admin/')) directory = 'app/api/admin routes';
    else if (record.path.startsWith('app/api/cron/')) directory = 'app/api/cron routes';
    else if (record.path.startsWith('app/api/')) directory = 'app/api routes';
    else if (record.path.startsWith('app/')) directory = 'app routes outside app/api';
    if (!groups.has(directory)) groups.set(directory, []);
    groups.get(directory).push(record);
  }

  const output = [
    '---',
    'status: supporting',
    'audience: [human, agent]',
    'last_verified: null',
    '---',
    '# Generated code map',
    '',
    '> Generated by `npm run generate-code-map` — do not edit this file directly.',
    '',
    `Source fingerprint: \`${index.fingerprint}\``,
    '',
    'This is a deterministic lookup layer over current source. For a narrow answer,',
    'prefer `npm run code-map:find -- "term"`; for change radius, use',
    '`npm run code-map:impact -- path/to/file`. Do not load this entire document',
    'into an agent context when a targeted search will do.',
    '',
    'The visible grid covers `lib/admin`, `lib/songs`, and every Next route.',
    'Find and impact queries also use a wider static import graph across `app`,',
    '`components`, `lib`, `scripts`, and `tests`.',
    '',
    'A **source note** is an excerpt from the first standalone pre-export comment',
    '(or an explicit `@fileoverview`); it is not an invented summary. **Direct test',
    'references** mean a test statically imports or re-exports that exact module.',
    'A blank association does not prove that the module is untested, and static import',
    'analysis cannot prove that dynamic/runtime consumers do not exist.',
    '',
    `Indexed: ${index.records.length} modules, ${index.records.reduce((sum, record) => sum + record.exports.length, 0)} export entries.`,
  ];

  for (const [directory, records] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    output.push('', `## ${directory}`, '', '| Path | Source note | Exports | Direct test references |', '|---|---|---|---|');
    for (const record of records.sort((left, right) => left.path.localeCompare(right.path))) {
      let label = path.posix.basename(record.path);
      if (directory === 'app/api/admin routes') label = record.path.slice('app/api/admin/'.length);
      else if (directory === 'app/api/cron routes') label = record.path.slice('app/api/cron/'.length);
      else if (directory === 'app/api routes') label = record.path.slice('app/api/'.length);
      else if (directory === 'app routes outside app/api') label = record.path.slice('app/'.length);
      output.push(`| ${codeLink(record.path, label)} | ${escapeTableText(record.sourceNote.text) || '—'} | ${renderExports(record.exports)} | ${renderTests(record.directTests)} |`);
    }
  }
  return `${output.join('\n')}\n`;
}

function normaliseSearch(value) {
  return `${value || ''}`.toLowerCase().replace(/[^a-z0-9_$*-]+/gu, ' ').trim();
}

export function searchCodeIndex(index, query, { limit = 12 } = {}) {
  const normalisedQuery = normaliseSearch(query);
  const terms = normalisedQuery.split(/\s+/u).filter(Boolean);
  if (!terms.length) return [];

  return index.records.map((record) => {
    const pathText = normaliseSearch(record.path);
    const noteText = normaliseSearch(record.sourceNote.text);
    const exportText = normaliseSearch(record.exports.map((entry) => entry.name).join(' '));
    const testText = normaliseSearch(record.directTests.join(' '));
    const allText = `${pathText} ${noteText} ${exportText} ${testText}`;
    let score = 0;
    if (pathText.includes(normalisedQuery)) score += 90;
    if (exportText.includes(normalisedQuery)) score += 110;
    if (noteText.includes(normalisedQuery)) score += 70;
    for (const term of terms) {
      if (pathText.includes(term)) score += 24;
      if (exportText.includes(term)) score += 30;
      if (noteText.includes(term)) score += 18;
      if (testText.includes(term)) score += 8;
    }
    if (terms.every((term) => allText.includes(term))) score += 45;
    return { record, score };
  })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.record.path.localeCompare(right.record.path))
    .slice(0, limit);
}

function collectReverseClosure(graph, targetPath) {
  const distances = new Map([[targetPath, 0]]);
  const queue = [targetPath];
  while (queue.length) {
    const current = queue.shift();
    const distance = distances.get(current);
    for (const consumer of graph.consumersByFile.get(current) || []) {
      if (distances.has(consumer)) continue;
      distances.set(consumer, distance + 1);
      queue.push(consumer);
    }
  }
  distances.delete(targetPath);
  return distances;
}

function isEntrypoint(sourcePath) {
  return /^app\/.+\/(?:page|route|layout)\.(?:js|jsx|mjs|ts|tsx)$/u.test(sourcePath);
}

export function buildImpactReport(index, targetPaths) {
  return targetPaths.map((targetPath) => {
    const cleanPath = path.isAbsolute(targetPath)
      ? relative(index.repoRoot, targetPath)
      : toPosix(targetPath.replace(/^\.\//u, ''));
    const direct = [...(index.graph.consumersByFile.get(cleanPath) || [])].sort();
    const closure = collectReverseClosure(index.graph, cleanPath);
    const byDistance = ([leftPath, leftDistance], [rightPath, rightDistance]) => (
      leftDistance - rightDistance || leftPath.localeCompare(rightPath)
    );
    const reachable = [...closure.entries()].sort(byDistance);
    return {
      target: cleanPath,
      exists: fs.existsSync(path.join(index.repoRoot, cleanPath)),
      indexed: index.recordsByPath.has(cleanPath),
      source: index.recordsByPath.get(cleanPath) || null,
      directConsumers: direct.filter((consumer) => !isTestPath(consumer)),
      directTests: direct.filter(isTestPath),
      transitiveConsumers: reachable
        .filter(([consumer]) => !isTestPath(consumer))
        .map(([consumer, distance]) => ({ path: consumer, distance })),
      relatedTests: reachable
        .filter(([consumer]) => isTestPath(consumer))
        .map(([consumer, distance]) => ({ path: consumer, distance })),
      entrypoints: reachable
        .filter(([consumer]) => isEntrypoint(consumer))
        .map(([consumer, distance]) => ({ path: consumer, distance })),
      scripts: reachable
        .filter(([consumer]) => consumer.startsWith('scripts/'))
        .map(([consumer, distance]) => ({ path: consumer, distance })),
    };
  });
}

function globRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replaceAll('*', '.*');
  return new RegExp(`^${escaped}$`, 'u');
}

export function validateAgentWorkflowMap({ repoRoot, source }) {
  const section = source.match(/## Workflow Map\s*\n([\s\S]*?)(?=\n## )/u)?.[1] || '';
  if (!section) return ['AGENTS.md: missing Workflow Map section'];
  const allPaths = [
    ...walk(repoRoot, (filePath) => !filePath.includes(`${path.sep}.git${path.sep}`))
      .map((filePath) => relative(repoRoot, filePath)),
  ];
  const references = [...section.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
  const errors = [];

  for (const reference of references) {
    if (reference.endsWith('/')) {
      if (!fs.existsSync(path.join(repoRoot, reference))) errors.push(`AGENTS.md Workflow Map: missing directory ${reference}`);
      continue;
    }

    if (reference.includes('/')) {
      const matches = reference.includes('*')
        ? allPaths.some((candidate) => globRegex(reference).test(candidate))
        : fs.existsSync(path.join(repoRoot, reference));
      if (!matches) errors.push(`AGENTS.md Workflow Map: unmatched path ${reference}`);
      continue;
    }

    const testPattern = `tests/admin/${reference}.test.mjs`;
    if (!allPaths.some((candidate) => globRegex(testPattern).test(candidate))) {
      errors.push(`AGENTS.md Workflow Map: unmatched test pattern ${reference}`);
    }
  }

  return [...new Set(errors)].sort();
}
