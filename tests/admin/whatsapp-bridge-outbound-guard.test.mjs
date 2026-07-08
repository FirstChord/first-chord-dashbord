import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// The guard is CommonJS and lives with the bridge (no Baileys dependency), so
// it imports cleanly here without pulling the bridge's socket stack.
const require = createRequire(import.meta.url);
const { guardOutbound, BLOCKED_SEND_METHODS } = require('../../tools/whatsapp-incoming-bridge/outbound-guard.js');

function fakeSocket() {
  return {
    sendMessage: () => 'sent',
    relayMessage: () => 'relayed',
    groupMetadata: () => ({ id: 'x@g.us' }), // a read method — must stay intact
    ev: { on() {} },
  };
}

test('guardOutbound blocks every send method so a parent can never be messaged', () => {
  const sock = guardOutbound(fakeSocket());
  for (const name of BLOCKED_SEND_METHODS) {
    assert.throws(() => sock[name](), /receive-only/, `${name} should be blocked`);
  }
});

test('sendMessage is one of the blocked methods (the public send API)', () => {
  assert.ok(BLOCKED_SEND_METHODS.includes('sendMessage'));
});

test('guardOutbound leaves read methods (group metadata, receiving) untouched', () => {
  const sock = guardOutbound(fakeSocket());
  assert.deepEqual(sock.groupMetadata(), { id: 'x@g.us' });
  assert.equal(typeof sock.ev.on, 'function');
});

test('guardOutbound tolerates a missing/partial socket', () => {
  assert.doesNotThrow(() => guardOutbound(null));
  assert.doesNotThrow(() => guardOutbound({})); // no send methods present
});
