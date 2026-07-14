import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const issuesSource = await readFile(new URL('../../lib/admin/issues.js', import.meta.url), 'utf8');
const studentsSource = await readFile(new URL('../../lib/admin/students.js', import.meta.url), 'utf8');
const routeSource = await readFile(
  new URL('../../app/api/admin/issues/pause-expectations/reconcile/route.js', import.meta.url),
  'utf8',
);
const workflowSource = await readFile(
  new URL('../../lib/admin/pause-expectation-workflow.js', import.meta.url),
  'utf8',
);

function sourceBetween(startMarker, endMarker = '') {
  const start = issuesSource.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  const end = endMarker ? issuesSource.indexOf(endMarker, start + startMarker.length) : issuesSource.length;
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return issuesSource.slice(start, end);
}

test('generic issue orchestration has no Students writer or reconciliation dependency', () => {
  assert.doesNotMatch(issuesSource, /updateStudentSheetRow|applyPauseExpectationReconciliation|reconcilePauseExpectations/);
  assert.match(issuesSource, /loadStudentContextCollection/);
});

test('Students and Issues use the same student-context loader', () => {
  assert.match(studentsSource, /loadStudentContextCollection/);
  assert.match(issuesSource, /loadStudentContextCollection/);
  assert.doesNotMatch(studentsSource, /function normaliseStudentRow/);
  assert.doesNotMatch(issuesSource, /function normaliseSheetStudent/);
});

test('live Stripe scans do not reconcile student payment expectations', () => {
  const source = sourceBetween('export async function scanLiveStripeIssues()', 'export async function getAdminIssues()');
  assert.doesNotMatch(source, /applyPauseExpectationReconciliation|reconcilePauseExpectations|updateStudentSheetRow/);
});

test('student payment-expectation reconciliation is isolated behind a confirmed admin route', () => {
  assert.match(routeSource, /session\?\.user\?\.isAdmin/);
  assert.match(routeSource, /executePauseExpectationReconciliation/);
  assert.match(routeSource, /pause-expectation-workflow/);
  assert.match(routeSource, /reconcilePauseExpectations/);
  assert.match(workflowSource, /updateStudentSheetRow/);
  assert.match(workflowSource, /applyPauseExpectationReconciliation/);
});
