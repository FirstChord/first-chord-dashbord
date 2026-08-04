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
  assert.match(result.stdout, /file bodies are not searched; use rg/iu);
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

test('a genuine miss is explicit about both searched layers', () => {
  const result = runFind('definitely_absent_code_map_symbol_7c84');

  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /No primary-scope match\. This does not mean the code does not exist\./u);
  assert.match(result.stdout, /No path\/export match was found in the wider app, components, lib, scripts, or tests graph\./u);
});
