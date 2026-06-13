import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authenticatePracticeChatRequest,
  corsHeaders,
} from '../../lib/admin/practice-chat-auth.mjs';

function requestWithHeaders(headers = {}) {
  return new Request('http://localhost:3000/api/practice-notes', { headers });
}

test('authenticatePracticeChatRequest allows known browser origins without a configured secret', () => {
  const result = authenticatePracticeChatRequest(requestWithHeaders({
    origin: 'http://localhost:8000',
  }), {});

  assert.equal(result.ok, true);
});

test('authenticatePracticeChatRequest blocks missing Origin without a valid secret', () => {
  const result = authenticatePracticeChatRequest(requestWithHeaders(), {
    PRACTICE_CHAT_API_SECRET: 'shared-secret',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test('authenticatePracticeChatRequest accepts no-Origin server requests with the shared secret', () => {
  const result = authenticatePracticeChatRequest(requestWithHeaders({
    'x-firstchord-practicechat-secret': 'shared-secret',
  }), {
    PRACTICE_CHAT_API_SECRET: 'shared-secret',
  });

  assert.equal(result.ok, true);
});

test('authenticatePracticeChatRequest requires the shared secret when configured', () => {
  const result = authenticatePracticeChatRequest(requestWithHeaders({
    origin: 'http://localhost:8000',
  }), {
    PRACTICE_CHAT_API_SECRET: 'shared-secret',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('corsHeaders allows the Practice Chat secret header', () => {
  const headers = corsHeaders('http://localhost:8000');

  assert.equal(headers['Access-Control-Allow-Origin'], 'http://localhost:8000');
  assert.match(headers['Access-Control-Allow-Headers'], /X-FirstChord-PracticeChat-Secret/u);
});

