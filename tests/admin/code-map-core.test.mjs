import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildCodeIndex,
  buildImpactReport,
  extractExports,
  extractImportSpecifiers,
  extractModuleOverview,
  findUnsupportedExportLines,
  renderCodeMap,
  searchCodeIndex,
  validateAgentWorkflowMap,
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

  assert.ok(index.recordsByPath.has('app/api/cron/payroll/route.js'));
  assert.ok(index.recordsByPath.has('app/public-export/route.js'));
  assert.deepEqual(wise.directTests, ['tests/admin/wise-batch-contract.test.mjs']);
  assert.deepEqual(wise.directConsumers, ['lib/admin/payroll.mjs']);
  assert.deepEqual(misleading.moduleOverview, { text: '', line: null, explicit: false });
  assert.equal(searchCodeIndex(index, 'Wise payout')[0].record.path, 'lib/admin/wise-helpers.mjs');
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
