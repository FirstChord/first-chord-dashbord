import test from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_NAV_ITEMS, getCurrentAdminNavHref } from '../../lib/admin/admin-navigation.mjs';

test('admin navigation follows the normal-work-first order', () => {
  assert.deepEqual(
    ADMIN_NAV_ITEMS.map((item) => item.label),
    ['Overview', 'Planning', 'Workflows', 'Issues'],
  );
});

test('admin navigation identifies its four primary destinations', () => {
  assert.equal(getCurrentAdminNavHref('/admin'), '/admin');
  assert.equal(getCurrentAdminNavHref('/admin/planning'), '/admin/planning');
  assert.equal(getCurrentAdminNavHref('/admin/planning/example'), '/admin/planning');
  assert.equal(getCurrentAdminNavHref('/admin/workflows'), '/admin/workflows');
  assert.equal(getCurrentAdminNavHref('/admin/flags'), '/admin/flags');
});

test('workflow child routes keep the Workflows location cue', () => {
  for (const pathname of [
    '/admin/waiting',
    '/admin/onboard/student',
    '/admin/workflows/tutor-absence',
    '/admin/incoming-messages',
    '/admin/finance/payroll',
  ]) {
    assert.equal(getCurrentAdminNavHref(pathname), '/admin/workflows');
  }
});

test('unrelated admin routes do not claim a primary navigation location', () => {
  assert.equal(getCurrentAdminNavHref('/admin/students'), '');
  assert.equal(getCurrentAdminNavHref('/admin-inside'), '');
  assert.equal(getCurrentAdminNavHref(''), '');
});
