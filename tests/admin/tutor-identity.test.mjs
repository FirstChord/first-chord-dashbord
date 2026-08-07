import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTutorName } from '../../lib/admin/tutor-identity.mjs';
import { ADMIN_TUTORS } from '../../lib/admin/tutors-data.js';

const roster = {
  Calum: { fullName: 'Calum Steel' },
  Dean: { fullName: 'Dean Louden' },
  Tom: { fullName: 'Tom Walters' },
};

test('a full name resolves to the canonical short name', () => {
  assert.equal(resolveTutorName('Calum Steel', roster), 'Calum');
  assert.equal(resolveTutorName('Tom Walters', roster), 'Tom');
});

test('a short name is already canonical', () => {
  assert.equal(resolveTutorName('Dean', roster), 'Dean');
});

test('matching ignores case and surrounding space', () => {
  assert.equal(resolveTutorName('  calum steel ', roster), 'Calum');
  assert.equal(resolveTutorName('TOM', roster), 'Tom');
});

test('an unknown name is returned unchanged, never approximated', () => {
  // A wrong tutor attributed to a teaching note is worse than two spellings.
  assert.equal(resolveTutorName('Someone Else', roster), 'Someone Else');
  assert.equal(resolveTutorName('Cal', roster), 'Cal');
});

test('a name two tutors answer to resolves to neither', () => {
  const clashing = {
    Calum: { fullName: 'Calum Steel' },
    CalumB: { fullName: 'Calum' },
  };
  // "Calum" is both a short key and another tutor's full name, so it stops
  // resolving rather than silently picking one of two real people.
  assert.equal(resolveTutorName('Calum', clashing), 'Calum');
  assert.equal(resolveTutorName('Calum Steel', clashing), 'Calum');
});

test('empty input stays empty', () => {
  assert.equal(resolveTutorName('', roster), '');
  assert.equal(resolveTutorName(null, roster), '');
});

test('the real roster collapses the name forms actually in the data', () => {
  // Both forms appear across Song_Assignments and Practice_Notes_Log, which is
  // what made one tutor show up twice on a song card.
  for (const [shortName, tutor] of Object.entries(ADMIN_TUTORS)) {
    assert.equal(resolveTutorName(shortName), shortName, `${shortName} should be canonical`);
    if (tutor.fullName && tutor.fullName !== shortName) {
      assert.equal(
        resolveTutorName(tutor.fullName),
        shortName,
        `${tutor.fullName} should resolve to ${shortName}`,
      );
    }
  }
});
