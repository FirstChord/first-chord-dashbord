#!/usr/bin/env node
// Evaluates classifyIncomingMessage and deterministic date extraction against
// the synthetic privacy-reviewed fixture and prints every miss.
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
import { extractDatesFromMessage } from '../lib/admin/incoming-date-helpers.mjs';
import { classifyIncomingMessage } from '../lib/admin/incoming-message-helpers.mjs';
import { scoreIncomingClassifier, scoreIncomingDateExtraction } from '../lib/admin/incoming-eval-helpers.mjs';

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../tests/admin/fixtures/incoming-eval-set.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const { messages } = fixture;

const report = scoreIncomingClassifier(messages, classifyIncomingMessage);
const dateReport = scoreIncomingDateExtraction(messages, extractDatesFromMessage);

console.log(`Fixture: schema ${fixture.schemaVersion} · ${fixture.dataOrigin}`);
console.log(`Messages: ${report.total}`);
console.log(`Exact accuracy:  ${(report.exactAccuracy * 100).toFixed(1)}% (${report.exactCorrect}/${report.total})`);
console.log(`Family accuracy: ${(report.familyAccuracy * 100).toFixed(1)}% (${report.familyCorrect}/${report.total})`);
console.log(`Actionable vs noise: ${(report.actionableAccuracy * 100).toFixed(1)}% (${report.actionableCorrect}/${report.total})`);
console.log(`Harmful auto-archives: ${report.harmfulAutoArchives}/${report.expectedActionable}`);
console.log(`Date extraction: ${(dateReport.exactAccuracy * 100).toFixed(1)}% (${dateReport.exactCorrect}/${dateReport.total})`);

console.log('\nPer-label (exact):');
for (const [label, stats] of Object.entries(report.perLabel)) {
  console.log(`  ${label.padEnd(17)} ${stats.correct}/${stats.total}`);
}

if (dateReport.misses.length) {
  console.log('\nDate misses:');
  for (const miss of dateReport.misses) {
    console.log(`  ${miss.id} expected ${JSON.stringify(miss.expected)}, got ${JSON.stringify(miss.actual)}`);
  }
}

if (report.misses.length) {
  console.log('\nMisses:');
  for (const miss of report.misses) {
    console.log(`  #${miss.id} expected ${miss.expected}, got ${miss.predicted}${miss.sameFamily ? ' (same family)' : ''}`);
    console.log(`     ${miss.text.slice(0, 110).replace(/\n/gu, ' ')}`);
  }
}
