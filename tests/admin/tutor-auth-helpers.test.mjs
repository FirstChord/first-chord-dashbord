import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canTutorDashboardAccessTutor,
  filterTutorOptionsForAccess,
  getTutorDashboardAccessForEmail,
  isTutorDashboardAuthEnforced,
  normaliseTutorDashboardAuthMode,
  parseTutorDashboardEmailMap,
} from '../../lib/tutor-auth-helpers.mjs';

test('tutor dashboard auth stays off unless pilot or required is explicit', () => {
  assert.equal(normaliseTutorDashboardAuthMode(''), 'off');
  assert.equal(normaliseTutorDashboardAuthMode('unknown'), 'off');
  assert.equal(isTutorDashboardAuthEnforced({}), false);
  assert.equal(isTutorDashboardAuthEnforced({ TUTOR_DASHBOARD_AUTH_MODE: 'pilot' }), true);
  assert.equal(isTutorDashboardAuthEnforced({ TUTOR_DASHBOARD_AUTH_MODE: 'required' }), true);
});

test('an authenticated admin receives full tutor-dashboard access', () => {
  const access = getTutorDashboardAccessForEmail('MusicLessons@FirstChord.co.uk', {
    isAdmin: true,
    env: {},
  });

  assert.equal(access.authorized, true);
  assert.equal(access.fullAccess, true);
  assert.equal(access.email, 'musiclessons@firstchord.co.uk');
  assert.equal(access.source, 'admin');
  assert.equal(canTutorDashboardAccessTutor(access, 'Tom'), true);
  assert.equal(canTutorDashboardAccessTutor(access, 'Finn'), true);
});

test('the full-access allowlist matches exact emails, never the whole Gmail domain', () => {
  const env = {
    TUTOR_DASHBOARD_FULL_ACCESS_EMAILS: 'musiclessons@firstchord.co.uk',
  };

  assert.equal(getTutorDashboardAccessForEmail('musiclessons@firstchord.co.uk', { env }).fullAccess, true);
  assert.equal(getTutorDashboardAccessForEmail('somebody@gmail.com', { env }).authorized, false);
});

test('the tutor email map supports JSON and compact email=tutor entries', () => {
  assert.deepEqual(parseTutorDashboardEmailMap(
    '{"tom@example.com":"Tom","cover@example.com":["Finn","Tom"]}',
  ), {
    'tom@example.com': ['Tom'],
    'cover@example.com': ['Finn', 'Tom'],
  });
  assert.deepEqual(parseTutorDashboardEmailMap(
    'tom@example.com=Tom,finn@example.com=Finn',
  ), {
    'tom@example.com': ['Tom'],
    'finn@example.com': ['Finn'],
  });
});

test('a scoped tutor can access only mapped tutor options', () => {
  const access = getTutorDashboardAccessForEmail('tom@example.com', {
    env: {
      TUTOR_DASHBOARD_EMAIL_MAP: '{"tom@example.com":"Tom"}',
    },
  });
  const options = [
    { shortName: 'Finn' },
    { shortName: 'Tom' },
  ];

  assert.equal(access.authorized, true);
  assert.equal(access.fullAccess, false);
  assert.equal(canTutorDashboardAccessTutor(access, 'Tom'), true);
  assert.equal(canTutorDashboardAccessTutor(access, 'Finn'), false);
  assert.deepEqual(filterTutorOptionsForAccess(options, access), [{ shortName: 'Tom' }]);
});

test('unknown and missing emails fail closed', () => {
  const env = {
    TUTOR_DASHBOARD_EMAIL_MAP: '{"tom@example.com":"Tom"}',
  };
  assert.equal(getTutorDashboardAccessForEmail('', { env }).authorized, false);
  assert.equal(getTutorDashboardAccessForEmail('unknown@example.com', { env }).authorized, false);
});
