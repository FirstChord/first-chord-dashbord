import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function runFind(...args) {
  return spawnSync(process.execPath, ['scripts/code-map.mjs', 'find', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('find labels an exact component export outside the primary map scope', () => {
  const result = runFind('ActionButton');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Primary code map matches for "ActionButton" \(0\)/u);
  assert.match(result.stdout, /No primary-scope match\. This does not mean the code does not exist\./u);
  assert.match(result.stdout, /Outside primary map scope — path\/export matches \(1\)/u);
  assert.match(result.stdout, /components\/admin\/ui\/ActionButton\.js \[exact export, exact filename\]/u);
  assert.match(result.stdout, /file bodies are not indexed/iu);
});

test('find JSON carries the same scope boundary and fallback evidence', () => {
  const result = runFind('ActionButton', '--json');

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.scope.searchesFileBodies, false);
  assert.deepEqual(payload.results, []);
  assert.equal(payload.outsideScopeMatches[0].path, 'components/admin/ui/ActionButton.js');
  assert.deepEqual(payload.outsideScopeMatches[0].reasons, ['exact export', 'exact filename']);
});

// Built by join so the symbol never appears as a literal that the body scan could find.
const ABSENT_SYMBOL = ['definitely', 'absent', 'code', 'map', 'symbol', '7c84'].join('_');

test('a genuine miss is explicit about all three searched layers', () => {
  const result = runFind(ABSENT_SYMBOL);

  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /No primary-scope match\. This does not mean the code does not exist\./u);
  assert.match(result.stdout, /No path\/export match was found in the wider app, components, lib, scripts, or tests graph\./u);
  assert.match(result.stdout, /no file body in app, components, lib, scripts, or tests contains these terms\./u);
});

test('a metadata miss falls back to a body-text scan instead of dead-ending', () => {
  const result = runFind('exponential backoff');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Body-text fallback \(ripgrep\) — \d+ files?/u);
  assert.match(result.stdout, /Text occurrences only — a hit is not evidence that the file owns the behavior\./u);
  assert.match(result.stdout, /Reproduce or widen: rg -i /u);
  assert.match(result.stdout, /\(\d+ matches?, \d+\/2 terms\)/u);
});

test('the body scan stays off when metadata answers, and --body forces it on', () => {
  const quiet = runFind('buildPayrollPreview');
  assert.equal(quiet.status, 0, quiet.stderr);
  assert.doesNotMatch(quiet.stdout, /Body-text/u);

  const forced = runFind('buildPayrollPreview', '--body');
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, /Body-text matches \(ripgrep, forced by --body\)/u);
});

test('find JSON exposes the body tier and its declared contract', () => {
  const miss = JSON.parse(runFind('exponential backoff', '--json').stdout);
  assert.equal(miss.scope.bodyTextFallback.reportsMatchingLines, false);
  assert.equal(miss.bodySearch.available, true);
  assert.deepEqual(miss.bodySearch.terms, ['exponential', 'backoff']);
  assert.ok(miss.bodySearch.results.length > 0);
  assert.ok(miss.bodySearch.results.every((entry) => typeof entry.matches === 'number'));

  const hit = JSON.parse(runFind('buildPayrollPreview', '--json').stdout);
  assert.equal(hit.bodySearch, null);
});
