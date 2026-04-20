import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateFcStudentId,
  normaliseExperienceLevel,
  normaliseInstrument,
} from '../../lib/admin/fc-helpers.mjs';

test('normaliseInstrument maps common aliases into canonical labels', () => {
  assert.equal(normaliseInstrument('Keyboard lessons'), 'Piano');
  assert.equal(normaliseInstrument('Uke starter'), 'Ukulele');
  assert.equal(normaliseInstrument('Electric bass'), 'Bass');
  assert.equal(normaliseInstrument('Voice and performance'), 'Singing');
  assert.equal(normaliseInstrument('Acoustic Guitar'), 'Guitar');
});

test('normaliseExperienceLevel handles user-friendly onboarding language', () => {
  assert.equal(normaliseExperienceLevel('yes'), 'has some experience');
  assert.equal(normaliseExperienceLevel('3'), 'at an intermediate level');
  assert.equal(normaliseExperienceLevel('no'), 'a complete beginner');
  assert.equal(normaliseExperienceLevel('unexpected'), 'a complete beginner');
});

test('generateFcStudentId is deterministic for trimmed, case-insensitive inputs', () => {
  const a = generateFcStudentId(' Test ', 'Studenty', 'Finn@Example.com ');
  const b = generateFcStudentId('test', 'studenty', 'finn@example.com');

  assert.equal(a, b);
  assert.match(a, /^fc_std_[a-f0-9]{8}$/);
});

