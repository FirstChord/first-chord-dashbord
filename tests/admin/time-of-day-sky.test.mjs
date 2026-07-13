import assert from 'node:assert/strict';
import test from 'node:test';

import { getTimeOfDaySky } from '../../lib/time-of-day-sky.mjs';

test('uses the exact palette colours at a named time stop', () => {
  assert.deepEqual(getTimeOfDaySky(19 * 60 + 30), {
    name: 'sunset',
    top: '#879dc7',
    horizon: '#c7adc7',
    low: '#c4cbc2',
    base: '#96b3b4',
    glow: '#e4aa9d',
    header: '#d9dfed',
    glowOpacity: 0.15,
  });
});

test('smoothly interpolates between palette stops', () => {
  assert.deepEqual(getTimeOfDaySky(19 * 60), {
    name: 'sunset',
    top: '#98aed3',
    horizon: '#cdb9d2',
    low: '#ccd2c8',
    base: '#a6c2c0',
    glow: '#e9b4a1',
    header: '#dbe3f0',
    glowOpacity: 0.125,
  });
});

test('holds a blue-green early evening palette through 6pm', () => {
  assert.deepEqual(getTimeOfDaySky(18 * 60), {
    name: 'early-evening',
    top: '#afcce7',
    horizon: '#cdddec',
    low: '#d9eddf',
    base: '#c3ddd4',
    glow: '#e8c9aa',
    header: '#dbeafe',
    glowOpacity: 0.06,
  });
});

test('wraps times outside the current day', () => {
  assert.deepEqual(getTimeOfDaySky(24 * 60), getTimeOfDaySky(0));
  assert.deepEqual(getTimeOfDaySky(-60), getTimeOfDaySky(23 * 60));
});
