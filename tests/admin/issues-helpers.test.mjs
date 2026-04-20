import test from 'node:test';
import assert from 'node:assert/strict';

import { buildIssueRecord, classifyIssue, isIssueActive } from '../../lib/admin/issues-helpers.mjs';

test('classifyIssue maps current review flag types into actionable admin metadata', () => {
  assert.deepEqual(classifyIssue('TUTOR CONFLICT').severity, 'Needs action');
  assert.deepEqual(classifyIssue('SHEETS ONLY').systemsAffected, ['Sheets']);
  assert.deepEqual(classifyIssue('REGISTRY ONLY').systemsAffected, ['Registry']);
});

test('buildIssueRecord enriches live review flag rows with linked-system state', () => {
  const issue = buildIssueRecord({
    flag: {
      flag_type: 'TUTOR CONFLICT',
      mms_id: 'sdt_test',
      student_name: 'Test Studenty',
      detail: 'registry=Arion vs sheets=Fennella McCallum',
      generated_date: '2026-04-16',
    },
    sheetStudent: {
      mmsId: 'sdt_test',
      tutor: 'Fennella McCallum',
    },
    registryEntry: {
      mmsId: 'sdt_test',
      tutor: 'Arion',
    },
  });

  assert.equal(issue.severity, 'Needs action');
  assert.equal(issue.hasSheetRow, true);
  assert.equal(issue.hasRegistryEntry, true);
  assert.equal(issue.sheetTutor, 'Fennella McCallum');
  assert.equal(issue.registryTutor, 'Arion');
  assert.equal(issue.adminStudentPath, '/admin/students/sdt_test');
});

test('isIssueActive returns false once a tutor conflict is resolved', () => {
  const active = isIssueActive({
    flagType: 'TUTOR CONFLICT',
    sheetStudent: { tutor: 'Arion Xenos' },
    registryEntry: { tutor: 'Arion' },
  });

  assert.equal(active, false);
});

test('isIssueActive returns false once a sheets-only issue gains a registry entry', () => {
  const active = isIssueActive({
    flagType: 'SHEETS ONLY',
    sheetStudent: { tutor: 'Arion Xenos' },
    registryEntry: { tutor: 'Arion' },
  });

  assert.equal(active, false);
});
