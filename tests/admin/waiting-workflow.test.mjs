import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWelcomeGroupMessage, normaliseWaitingStatus } from '../../lib/admin/waiting-workflow.js';

test('normaliseWaitingStatus falls back to new for unknown values', () => {
  assert.equal(normaliseWaitingStatus('contacted'), 'contacted');
  assert.equal(normaliseWaitingStatus('bad-value'), 'new');
});

test('buildWelcomeGroupMessage injects the parent first name', () => {
  const message = buildWelcomeGroupMessage({
    parentFirstName: 'Jennifer',
  });

  assert.match(message, /^Hey Jennifer!/);
  assert.match(message, /firstchord\.co\.uk\/handbook/);
});
