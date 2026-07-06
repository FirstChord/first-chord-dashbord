#!/usr/bin/env node
// Evaluates classifyIncomingMessage against the curated real-message fixture
// (tests/admin/fixtures/incoming-eval-set.json) and prints accuracy, a
// confusion summary, and every miss — the tuning loop for the keyword rules.
//
//   node scripts/eval-incoming-classifier.mjs
//
// "Family" scoring treats the absence categories (one_off_absence,
// extended_absence, summer_break, absence_pause) as interchangeable: they all
// land the message in front of the same reviewer with the same convert path,
// so a within-family miss is a wording nuance, not a workflow error.
// The test suite pins minimum floors (incoming-classifier-eval.test.mjs);
// this script is the human-readable view.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { classifyIncomingMessage } from '../lib/admin/incoming-message-helpers.mjs';
import { scoreIncomingClassifier } from '../lib/admin/incoming-eval-helpers.mjs';

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../tests/admin/fixtures/incoming-eval-set.json');
const { messages } = JSON.parse(readFileSync(fixturePath, 'utf8'));

const report = scoreIncomingClassifier(messages, classifyIncomingMessage);

console.log(`Messages: ${report.total}`);
console.log(`Exact accuracy:  ${(report.exactAccuracy * 100).toFixed(1)}% (${report.exactCorrect}/${report.total})`);
console.log(`Family accuracy: ${(report.familyAccuracy * 100).toFixed(1)}% (${report.familyCorrect}/${report.total})`);
console.log(`Actionable vs noise: ${(report.actionableAccuracy * 100).toFixed(1)}% (${report.actionableCorrect}/${report.total})`);

console.log('\nPer-label (exact):');
for (const [label, stats] of Object.entries(report.perLabel)) {
  console.log(`  ${label.padEnd(17)} ${stats.correct}/${stats.total}`);
}

if (report.misses.length) {
  console.log('\nMisses:');
  for (const miss of report.misses) {
    console.log(`  #${miss.id} expected ${miss.expected}, got ${miss.predicted}${miss.sameFamily ? ' (same family)' : ''}`);
    console.log(`     ${miss.text.slice(0, 110).replace(/\n/gu, ' ')}`);
  }
}
