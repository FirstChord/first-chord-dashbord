import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { extractDatesFromMessage } from '../../lib/admin/incoming-date-helpers.mjs';
import { classifyIncomingMessage } from '../../lib/admin/incoming-message-helpers.mjs';
import {
  scoreIncomingClassifier,
  scoreIncomingDateExtraction,
  scoreIncomingProposalAbstention,
} from '../../lib/admin/incoming-eval-helpers.mjs';

// Accuracy floors against independent synthetic operational cases. If a rule
// change drops below these, run
// `node scripts/eval-incoming-classifier.mjs` to see exactly which messages
// broke. The one accepted exact miss is an extended/summer wording nuance;
// it stays inside the absence family and must never become auto-archived noise.

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/incoming-eval-set.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const { messages, proposalCases } = fixture;

test('incoming classifier holds its accuracy floors on the synthetic eval set', () => {
  const report = scoreIncomingClassifier(messages, classifyIncomingMessage);

  assert.equal(fixture.schemaVersion, 2);
  assert.equal(fixture.dataOrigin, 'synthetic_independent_cases');
  assert.ok(report.total >= 45, `eval fixture shrank to ${report.total} messages`);
  assert.ok(
    report.exactAccuracy >= 0.95,
    `exact accuracy ${(report.exactAccuracy * 100).toFixed(1)}% fell below 95% — misses: ${report.misses.map((m) => `#${m.id}`).join(', ')}`,
  );
  assert.ok(
    report.familyAccuracy >= 0.98,
    `family accuracy ${(report.familyAccuracy * 100).toFixed(1)}% fell below 98%`,
  );
  assert.ok(
    report.actionableAccuracy >= 0.98,
    `actionable-vs-noise accuracy ${(report.actionableAccuracy * 100).toFixed(1)}% fell below 98%`,
  );
  assert.equal(report.harmfulAutoArchives, 0, 'an actionable synthetic message would be auto-archived as noise');
});

test('incoming date extraction stays exact on the synthetic dated cases', () => {
  const report = scoreIncomingDateExtraction(messages, extractDatesFromMessage);
  assert.ok(report.total >= 20, `dated eval fixture shrank to ${report.total} messages`);
  assert.equal(report.exactAccuracy, 1, `date misses: ${report.misses.map((entry) => entry.id).join(', ')}`);
});

test('proposal abstention scoring counts missing safety flags as misses', () => {
  const perfect = scoreIncomingProposalAbstention(proposalCases, (testCase) => testCase.expected);
  assert.equal(perfect.abstentionAccuracy, 1);
  assert.equal(perfect.ambiguityFlagsAccuracy, 1);

  const unsafe = scoreIncomingProposalAbstention(proposalCases, () => ({ mustAbstain: false, ambiguityFlags: [] }));
  assert.ok(unsafe.abstentionAccuracy < 1);
  assert.ok(unsafe.ambiguityFlagsAccuracy < 1);
});

test('classifier never crashes on odd input', () => {
  assert.equal(classifyIncomingMessage('').category, 'general');
  assert.equal(classifyIncomingMessage(null).category, 'general');
  assert.equal(classifyIncomingMessage('🎸🎹🎤').category, 'general');
});
