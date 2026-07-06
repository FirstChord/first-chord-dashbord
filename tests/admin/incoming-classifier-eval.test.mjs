import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { classifyIncomingMessage } from '../../lib/admin/incoming-message-helpers.mjs';
import { scoreIncomingClassifier } from '../../lib/admin/incoming-eval-helpers.mjs';

// Accuracy floors against the curated real-message fixture. If a rule change
// drops below these, the change is a regression on real traffic — run
// `node scripts/eval-incoming-classifier.mjs` to see exactly which messages
// broke. Floors sit just under the measured 2026-07-06 baseline
// (87.3% exact / 94.4% family / 97.2% actionable) so honest fixture additions
// don't instantly fail the suite; raise them as the rules improve.

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/incoming-eval-set.json');
const { messages } = JSON.parse(readFileSync(fixturePath, 'utf8'));

test('incoming classifier holds its accuracy floors on the real-message eval set', () => {
  const report = scoreIncomingClassifier(messages, classifyIncomingMessage);

  assert.ok(report.total >= 71, `eval fixture shrank to ${report.total} messages`);
  assert.ok(
    report.exactAccuracy >= 0.85,
    `exact accuracy ${(report.exactAccuracy * 100).toFixed(1)}% fell below 85% — misses: ${report.misses.map((m) => `#${m.id}`).join(', ')}`,
  );
  assert.ok(
    report.familyAccuracy >= 0.92,
    `family accuracy ${(report.familyAccuracy * 100).toFixed(1)}% fell below 92%`,
  );
  assert.ok(
    report.actionableAccuracy >= 0.95,
    `actionable-vs-noise accuracy ${(report.actionableAccuracy * 100).toFixed(1)}% fell below 95%`,
  );
});

test('classifier never crashes on odd input', () => {
  assert.equal(classifyIncomingMessage('').category, 'general');
  assert.equal(classifyIncomingMessage(null).category, 'general');
  assert.equal(classifyIncomingMessage('🎸🎹🎤').category, 'general');
});
