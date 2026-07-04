import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFinanceCoverageIssues,
  FINANCE_COVERAGE_ISSUE_SOURCE,
  FINANCE_COVERAGE_ISSUE_TYPE,
} from '../../lib/admin/finance-coverage-issues.mjs';
import { FLAG_LABELS } from '../../lib/admin/finance-coverage.mjs';

function coverageWith(flaggedRows) {
  return {
    activeCount: 10,
    pricedCount: 10 - flaggedRows.length,
    coveragePct: 90,
    flagCounts: {},
    flagged: flaggedRows,
    tutorsNotInPayTable: [],
    isClean: flaggedRows.length === 0,
  };
}

function flaggedStudent(overrides = {}) {
  const flags = overrides.flags || ['noRevenuePrice'];
  return {
    mmsId: 'sdt_ABC',
    name: 'Ada Lovelace',
    tutor: 'Kenny',
    lessonKind: 'one_to_one',
    confidence: 'low',
    flags,
    flagLabels: flags.map((flag) => FLAG_LABELS[flag] || flag),
    ...overrides,
  };
}

test('turns a noRevenuePrice gap into a finance_coverage issue', () => {
  const issues = buildFinanceCoverageIssues(coverageWith([flaggedStudent()]));
  assert.equal(issues.length, 1);
  const [issue] = issues;
  assert.equal(issue.source, FINANCE_COVERAGE_ISSUE_SOURCE);
  assert.equal(issue.type, FINANCE_COVERAGE_ISSUE_TYPE);
  assert.equal(issue.mmsId, 'sdt_ABC');
  assert.equal(issue.studentName, 'Ada Lovelace');
  assert.equal(issue.severity, 'Warning');
  assert.deepEqual(issue.systemsAffected, ['Finance']);
  assert.equal(issue.active, true);
  assert.match(issue.detail, /no revenue price/);
  assert.equal(issue.sheetTutor, 'Kenny');
  assert.equal(issue.adminStudentPath, '/admin/students/sdt_ABC');
});

test('turns a noTutor gap into an issue', () => {
  const issues = buildFinanceCoverageIssues(coverageWith([
    flaggedStudent({ tutor: '', flags: ['noTutor'] }),
  ]));
  assert.equal(issues.length, 1);
  assert.match(issues[0].detail, /no tutor/);
});

test('confidence-only gaps do not become issues', () => {
  const issues = buildFinanceCoverageIssues(coverageWith([
    flaggedStudent({ flags: ['lowConfidence', 'noDuration'] }),
    flaggedStudent({ mmsId: 'sdt_DEF', name: 'Grace Hopper', flags: ['noSchedule'] }),
  ]));
  assert.equal(issues.length, 0);
});

test('mixed gaps only surface the issue-worthy flags in the detail', () => {
  const issues = buildFinanceCoverageIssues(coverageWith([
    flaggedStudent({ flags: ['noRevenuePrice', 'lowConfidence', 'noDuration'] }),
  ]));
  assert.equal(issues.length, 1);
  assert.match(issues[0].detail, /no revenue price/);
  assert.doesNotMatch(issues[0].detail, /low confidence/);
  assert.doesNotMatch(issues[0].detail, /no duration/);
});

test('excludes test students and rows without an mmsId', () => {
  assert.equal(
    buildFinanceCoverageIssues(coverageWith([flaggedStudent()]), { testStudentIds: new Set(['sdt_ABC']) }).length,
    0,
  );
  assert.equal(buildFinanceCoverageIssues(coverageWith([flaggedStudent({ mmsId: '' })])).length, 0);
});

test('contextKey stays stable for the same student across differing flag mixes', () => {
  const [first] = buildFinanceCoverageIssues(coverageWith([flaggedStudent({ flags: ['noRevenuePrice'] })]));
  const [second] = buildFinanceCoverageIssues(coverageWith([
    flaggedStudent({ flags: ['noRevenuePrice', 'noTutor'] }),
  ]));
  assert.equal(first.contextKey, second.contextKey);
  assert.equal(first.issueId, second.issueId);
});
