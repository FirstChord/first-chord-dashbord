import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import buildManifest from '../../app/manifest.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('admin installs as one inbox-first web app', () => {
  const manifest = buildManifest();

  assert.equal(manifest.name, 'FC Messages');
  assert.equal(manifest.id, '/admin/incoming-messages');
  assert.equal(manifest.start_url, '/admin/incoming-messages');
  assert.equal(manifest.scope, '/admin');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.icons[0]?.src, '/fc-logo-square.png');

  const manifestFiles = [
    ...readdirSync(path.join(repoRoot, 'app'), { recursive: true })
      .filter((file) => /(^|\/)manifest\.(js|mjs|ts|json|webmanifest)$/u.test(file))
      .map((file) => `app/${file}`),
    ...readdirSync(path.join(repoRoot, 'public'), { recursive: true })
      .filter((file) => /(^|\/)manifest[^/]*\.(json|webmanifest)$/u.test(file))
      .map((file) => `public/${file}`),
  ].sort();
  assert.deepEqual(manifestFiles, ['app/manifest.js']);

  const routeManifestDeclarations = readdirSync(path.join(repoRoot, 'app'), {
    recursive: true,
  })
    .filter((file) => /(^|\/)layout\.(js|jsx|ts|tsx)$/u.test(file))
    .filter((file) => file !== 'layout.js')
    .filter((file) => /\bmanifest\s*:/u.test(
      readFileSync(path.join(repoRoot, 'app', file), 'utf8'),
    ));

  // A second manifest with the same /admin scope previously let iOS identify
  // this as the old Planning app and persist its start URL at installation.
  assert.deepEqual(routeManifestDeclarations, []);
});
