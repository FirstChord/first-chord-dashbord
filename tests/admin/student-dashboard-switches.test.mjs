import assert from 'node:assert/strict';
import test from 'node:test';

import { getStudentDashboardSwitch } from '../../lib/student-dashboard-switches.mjs';

test('links each Evan Gibson dashboard to his other instrument', () => {
  assert.deepEqual(getStudentDashboardSwitch('sdt_r5BkJ0'), {
    href: '/evan-g',
    label: 'Switch to Bass',
  });
  assert.deepEqual(getStudentDashboardSwitch('sdt_DP20Js'), {
    href: '/evan',
    label: 'Switch to Piano',
  });
});

test('links each Carol Turner dashboard to her other instrument', () => {
  assert.deepEqual(getStudentDashboardSwitch('sdt_BtxmJ4'), {
    href: '/carol-t',
    label: 'Switch to Bass',
  });
  assert.deepEqual(getStudentDashboardSwitch('sdt_rzL8Jx'), {
    href: '/carol',
    label: 'Switch to Singing',
  });
});

test('links each Tabitha Slocombe dashboard to her other instrument', () => {
  assert.deepEqual(getStudentDashboardSwitch('sdt_NS6bJW'), {
    href: '/tabitha-slocombe',
    label: 'Switch to Voice',
  });
  assert.deepEqual(getStudentDashboardSwitch('sdt_fFZdJb'), {
    href: '/tabitha',
    label: 'Switch to Guitar',
  });
});

test('does not offer an instrument switch to other students', () => {
  assert.equal(getStudentDashboardSwitch('sdt_cZsDJp'), null);
  assert.equal(getStudentDashboardSwitch('sdt_QP01Jp'), null);
  assert.equal(getStudentDashboardSwitch(''), null);
  assert.equal(getStudentDashboardSwitch(undefined), null);
});
