import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  bodySearchTerms,
  buildBodySearchArgs,
  buildCodeIndex,
  buildImpactReport,
  CODE_MAP_SEARCH_SCOPE,
  formatBodySearchCommand,
  extractExports,
  extractImportSpecifiers,
  extractModuleOverview,
  findUnsupportedExportLines,
  renderCodeMap,
  searchCodeIndex,
  searchFileBodies,
  searchOutsideCodeIndex,
  validateAgentWorkflowMap,
  validateHelperPurity,
  validateModuleOverviewCoverage,
} from '../../scripts/code-map-core.mjs';

test('extractExports covers declarations, named re-exports, barrels, and defaults with lines', () => {
  const exports = extractExports(`export const ONE = 1;
export async function two() {}
export {
  three,
  original as renamed,
} from './three.mjs';
export * from './barrel.mjs';
export default class Example {}
`);
  assert.deepEqual(exports.map(({ name, kind, line, source }) => ({ name, kind, line, source })), [
    { name: 'ONE', kind: 'const', line: 1, source: '' },
    { name: 'two', kind: 'async function', line: 2, source: '' },
    { name: 'three', kind: 'named', line: 3, source: './three.mjs' },
    { name: 'renamed', kind: 'named', line: 3, source: './three.mjs' },
    { name: '*', kind: 'star', line: 7, source: './barrel.mjs' },
    { name: 'default:Example', kind: 'default', line: 8, source: '' },
  ]);
  assert.deepEqual(findUnsupportedExportLines('export type Example = string;\n'), [1]);
});

test('extractModuleOverview accepts only an explicit fileoverview', () => {
  const source = `const API = 'https://example.com';
// Implementation detail that is not the module overview.
/** @fileoverview Finds the current source without inventing a summary. More detail. */
export function find() {}
`;
  assert.deepEqual(extractModuleOverview(source), {
    text: 'Finds the current source without inventing a summary.',
    line: 3,
    explicit: true,
  });
  assert.deepEqual(extractModuleOverview(`// Cache TTL for the constant below.
const CACHE_TTL_MS = 60_000;
export const API_URL = 'https://example.com';
`), {
    text: '',
    line: null,
    explicit: false,
  });
  assert.deepEqual(extractModuleOverview(`// Future module summaries should use @fileoverview explicitly.
export const VALUE = true;
`), {
    text: '',
    line: null,
    explicit: false,
  });
  assert.deepEqual(extractModuleOverview(`/* Earlier block
 * spanning two lines.
 */
/** @fileoverview Later explicit overview wins. */
export const VALUE = true;
`), {
    text: 'Later explicit overview wins.',
    line: 4,
    explicit: true,
  });
});

test('extractImportSpecifiers recognises static, re-export, dynamic, and require imports', () => {
  const specifiers = extractImportSpecifiers(`
import thing from './thing.mjs';
import '@/side-effect.js';
export { other } from './other.mjs';
export * from './barrel.mjs';
const lazy = import('./lazy.mjs');
const old = require('./old.cjs');
`);
  assert.deepEqual(specifiers.sort(), [
    './barrel.mjs',
    './lazy.mjs',
    './old.cjs',
    './other.mjs',
    './thing.mjs',
    '@/side-effect.js',
  ]);
});

function makeFixtureRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'first-chord-code-map-'));
  const files = {
    'lib/admin/wise-helpers.mjs': `/** @fileoverview Builds a Wise payout batch. */\nexport function buildWiseBatch() {}\n`,
    'lib/admin/payroll.mjs': `import { buildWiseBatch } from './wise-helpers.mjs';\nexport function preparePayroll() { return buildWiseBatch(); }\n`,
    'lib/admin/misleading-cache.mjs': `// Frobnicator lifespan detail for the constant below.\nconst CACHE_TTL_MS = 60_000;\nexport function unrelatedWork() {}\n`,
    'app/api/admin/payroll/route.js': `import { preparePayroll } from '@/lib/admin/payroll.mjs';\nexport async function GET() { return preparePayroll(); }\n`,
    'app/api/cron/payroll/route.js': `import { preparePayroll } from '@/lib/admin/payroll.mjs';\nexport async function POST() { return preparePayroll(); }\n`,
    'app/public-export/route.js': `export async function GET() {}\n`,
    'components/admin/ui/ActionButton.js': `export function ActionButton() { return 'body-only rainbow phrase'; }\n`,
    'components/admin/UsesActionButton.js': `import { ActionButton } from './ui/ActionButton.js';\nexport function UsesActionButton() { return ActionButton(); }\n`,
    'tests/admin/wise-batch-contract.test.mjs': `import { buildWiseBatch } from '../../lib/admin/wise-helpers.mjs';\n`,
    'tests/admin/payroll-route.test.mjs': `import '../../app/api/admin/payroll/route.js';\n`,
    'AGENTS.md': `## Workflow Map\n\n| Area | Code | Tests |\n|---|---|---|\n| Payroll | \`lib/admin/wise-*.mjs\`, \`app/api/admin/payroll/\` | \`wise-batch-contract\` |\n\n## Next\n`,
  };
  for (const [name, source] of Object.entries(files)) {
    const target = path.join(repoRoot, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
  }
  return repoRoot;
}

test('the shared index powers direct test references, search, impact, and deterministic Markdown', (t) => {
  const repoRoot = makeFixtureRepo();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const index = buildCodeIndex({ repoRoot });
  const wise = index.recordsByPath.get('lib/admin/wise-helpers.mjs');
  const misleading = index.recordsByPath.get('lib/admin/misleading-cache.mjs');
  const actionButton = index.graphRecordsByPath.get('components/admin/ui/ActionButton.js');

  assert.ok(index.recordsByPath.has('app/api/cron/payroll/route.js'));
  assert.ok(index.recordsByPath.has('app/public-export/route.js'));
  assert.deepEqual(wise.directTests, ['tests/admin/wise-batch-contract.test.mjs']);
  assert.deepEqual(wise.directConsumers, ['lib/admin/payroll.mjs']);
  assert.deepEqual(misleading.moduleOverview, { text: '', line: null, explicit: false });
  assert.equal(actionButton.indexed, false);
  assert.equal(index.recordsByPath.has(actionButton.path), false);
  assert.equal(searchCodeIndex(index, 'Wise payout')[0].record.path, 'lib/admin/wise-helpers.mjs');
  assert.deepEqual(searchCodeIndex(index, 'ActionButton'), []);
  assert.equal(searchOutsideCodeIndex(index, 'ActionButton')[0].record.path, actionButton.path);
  assert.deepEqual(searchOutsideCodeIndex(index, 'ActionButton')[0].reasons, [
    'exact export',
    'exact filename',
  ]);
  assert.deepEqual(actionButton.directConsumers, ['components/admin/UsesActionButton.js']);
  assert.deepEqual(searchOutsideCodeIndex(index, 'rainbow phrase'), []);
  assert.equal(CODE_MAP_SEARCH_SCOPE.searchesFileBodies, false);
  assert.equal(
    searchCodeIndex(index, 'frobnicator lifespan').some(({ record }) => record.path === misleading.path),
    false,
    'an ordinary implementation comment must not influence navigation search',
  );

  const [impact] = buildImpactReport(index, ['lib/admin/wise-helpers.mjs']);
  assert.deepEqual(impact.entrypoints, [
    { path: 'app/api/admin/payroll/route.js', distance: 2 },
    { path: 'app/api/cron/payroll/route.js', distance: 2 },
  ]);
  assert.deepEqual(impact.relatedTests, [
    { path: 'tests/admin/wise-batch-contract.test.mjs', distance: 1 },
    { path: 'tests/admin/payroll-route.test.mjs', distance: 3 },
  ]);

  const first = renderCodeMap(index);
  const second = renderCodeMap(buildCodeIndex({ repoRoot }));
  assert.equal(first, second);
  assert.match(first, /Source fingerprint: `[a-f0-9]{16}`/u);
  assert.match(first, /Module overview/u);
  assert.match(first, /Explicit module overviews: 1\/6/u);
  assert.doesNotMatch(first, /Frobnicator lifespan detail/u);
  assert.doesNotMatch(first, /ActionButton/u, 'outside-scope fallbacks must not expand the browsable grid');
  assert.match(first, /Direct test references/u);
  assert.match(first, /## app\/api\/cron routes/u);
  assert.match(first, /## app routes outside app\/api/u);

  fs.appendFileSync(path.join(repoRoot, 'lib/admin/wise-helpers.mjs'), 'export const ADDED_LATER = true;\n');
  const changed = renderCodeMap(buildCodeIndex({ repoRoot }));
  assert.notEqual(changed, first, 'an export change must make the generated artifact drift');
});

test('Workflow Map validation checks paths, globs, and focused test patterns', (t) => {
  const repoRoot = makeFixtureRepo();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const source = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
  assert.deepEqual(validateAgentWorkflowMap({ repoRoot, source }), []);
  assert.deepEqual(
    validateAgentWorkflowMap({ repoRoot, source: source.replace('wise-batch-contract', 'missing-test') }),
    ['AGENTS.md Workflow Map: unmatched test pattern missing-test'],
  );
});

test('body search terms drop filler that would match nearly every file', () => {
  assert.deepEqual(bodySearchTerms('how does the pause reconcile'), ['pause', 'reconcile']);
  assert.deepEqual(bodySearchTerms('WHY  is   payroll  stale?'), ['payroll', 'stale']);
  assert.deepEqual(
    bodySearchTerms('one two three four five six'),
    ['one', 'two', 'three', 'four'],
    'term count is capped so a long sentence cannot fan out into many scans',
  );
  assert.deepEqual(bodySearchTerms('how the why'), ['how', 'the', 'why'], 'an all-filler query still gets searched');
});

test('body search scans only code files under the graph roots', () => {
  const args = buildBodySearchArgs('payroll');
  assert.ok(args.includes('--count-matches'), 'match counts keep the report small');
  assert.ok(args.includes('--fixed-strings'), 'symbols must not be read as regex');
  assert.ok(args.includes('--glob') && args.includes('*.mjs'));
  assert.deepEqual(args.slice(-6), ['payroll', 'app', 'components', 'lib', 'scripts', 'tests']);
  assert.match(formatBodySearchCommand(['pause', 'reconcile']), /^rg -i .* -e 'pause\|reconcile' app components lib scripts tests$/u);
});

test('body search ranks by term coverage before raw match volume', () => {
  const responses = {
    pause: 'lib/admin/pause-helpers.mjs:3\nlib/noise.mjs:99\n',
    reconcile: 'lib/admin/pause-helpers.mjs:2\n',
  };
  const seen = [];
  const result = searchFileBodies({
    repoRoot: '/nowhere',
    query: 'pause reconcile',
    run: (repoRoot, args) => {
      seen.push(args.at(-6));
      return responses[args.at(-6)] || '';
    },
  });

  assert.deepEqual(seen, ['pause', 'reconcile']);
  assert.equal(result.available, true);
  assert.deepEqual(result.results, [
    { path: 'lib/admin/pause-helpers.mjs', matches: 5, termsMatched: 2 },
    { path: 'lib/noise.mjs', matches: 99, termsMatched: 1 },
  ], 'a file matching both terms outranks a file with far more hits on one');
});

test('body search caps the file list and reports what it withheld', () => {
  const lines = Array.from({ length: 40 }, (unused, position) => `lib/file-${position}.mjs:1`).join('\n');
  const result = searchFileBodies({ repoRoot: '/nowhere', query: 'payroll', limit: 5, run: () => lines });
  assert.equal(result.results.length, 5);
  assert.equal(result.truncated, 35);
});

test('a missing ripgrep degrades to an unavailable tier, not a crash', () => {
  const result = searchFileBodies({
    repoRoot: '/nowhere',
    query: 'payroll',
    run: () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }); },
  });
  assert.equal(result.available, false);
  assert.deepEqual(result.results, []);
  assert.match(result.command, /^rg -i /u, 'the caller can still hand the user a command to run');
});

test('the declared search scope still disclaims body indexing while naming the fallback', () => {
  assert.equal(CODE_MAP_SEARCH_SCOPE.searchesFileBodies, false);
  assert.equal(CODE_MAP_SEARCH_SCOPE.bodyTextFallback.tool, 'ripgrep');
  assert.equal(CODE_MAP_SEARCH_SCOPE.bodyTextFallback.reportsMatchingLines, false);
});

test('overview coverage names every undescribed module and only counts the map scope', (t) => {
  const repoRoot = makeFixtureRepo();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));

  const errors = validateModuleOverviewCoverage(buildCodeIndex({ repoRoot }));
  assert.ok(errors.some((entry) => entry.startsWith('lib/admin/payroll.mjs:')));
  assert.ok(
    errors.some((entry) => entry.startsWith('lib/admin/misleading-cache.mjs:')),
    'a stray comment is not a module description and must not satisfy coverage',
  );
  assert.ok(
    !errors.some((entry) => entry.startsWith('lib/admin/wise-helpers.mjs:')),
    'a declared @fileoverview satisfies coverage',
  );
  assert.ok(
    !errors.some((entry) => entry.includes('components/admin/ui/ActionButton.js')),
    'files outside the primary map scope are not held to the coverage rule',
  );

  fs.writeFileSync(
    path.join(repoRoot, 'lib/admin/payroll.mjs'),
    `/** @fileoverview Prepares a payroll run. */\n${fs.readFileSync(path.join(repoRoot, 'lib/admin/payroll.mjs'), 'utf8')}`,
  );
  const after = validateModuleOverviewCoverage(buildCodeIndex({ repoRoot }));
  assert.ok(!after.some((entry) => entry.startsWith('lib/admin/payroll.mjs:')), 'adding the sentence clears the error');
});

test('helper purity is enforced through the import graph, not just direct imports', (t) => {
  const repoRoot = makeFixtureRepo();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));

  assert.deepEqual(validateHelperPurity(buildCodeIndex({ repoRoot })), [], 'the fixture starts clean');

  // sheets.mjs is the I/O boundary; payroll.mjs is one hop from it; the helper
  // imports payroll.mjs and so pays the same cost as importing sheets directly.
  fs.writeFileSync(
    path.join(repoRoot, 'lib/admin/sheets.mjs'),
    "/** @fileoverview Sheets client. */\nimport { google } from 'googleapis';\nexport function readRows() { return google; }\n",
  );
  fs.writeFileSync(
    path.join(repoRoot, 'lib/admin/payroll.mjs'),
    "/** @fileoverview Payroll orchestration. */\nimport { readRows } from './sheets.mjs';\nexport function preparePayroll() { return readRows(); }\n",
  );
  fs.writeFileSync(
    path.join(repoRoot, 'lib/admin/wise-helpers.mjs'),
    "/** @fileoverview Builds a Wise payout batch. */\nimport { preparePayroll } from './payroll.mjs';\nexport function buildWiseBatch() { return preparePayroll(); }\n",
  );

  const errors = validateHelperPurity(buildCodeIndex({ repoRoot }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^lib\/admin\/wise-helpers\.mjs: a \*-helpers\.mjs module must stay free of I\/O/u);
  assert.match(
    errors[0],
    /wise-helpers\.mjs -> lib\/admin\/payroll\.mjs -> lib\/admin\/sheets\.mjs/u,
    'the message names the whole chain so the fix is obvious',
  );
});

test('only the helper suffix carries the purity promise', (t) => {
  const repoRoot = makeFixtureRepo();
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));

  // A deliberate I/O boundary that is not named *-helpers.mjs must not be flagged.
  fs.writeFileSync(
    path.join(repoRoot, 'lib/admin/sheet-reader.mjs'),
    "/** @fileoverview Deliberate Sheets boundary. */\nimport { google } from 'googleapis';\nexport function readRows() { return google; }\n",
  );
  assert.deepEqual(validateHelperPurity(buildCodeIndex({ repoRoot })), []);
});
