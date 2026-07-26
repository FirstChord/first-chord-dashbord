import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const {
  RotatingLogStream,
  buildSafeDashboardResponseLog,
  buildSafePayloadLog,
} = require('../../tools/whatsapp-incoming-bridge/logging');

test('bridge source does not log payloads, response previews, or group samples', () => {
  const source = readFileSync(
    path.resolve('tools/whatsapp-incoming-bridge/bridge.js'),
    'utf8',
  );

  assert.doesNotMatch(source, /latestText|responsePreview|sample:\s*groups|\{\s*payload\s*\}/u);
});

test('bridge delivery logs exclude message, chat, sender, and response content', () => {
  const payloadLog = buildSafePayloadLog({
    source: 'whatsapp_group_auto',
    external_message_id: 'private-message-id',
    chat_id: 'private-chat-id',
    sender_name: 'Parent Name',
    sender_phone: '+447700900123',
    message_text: 'Private parent message',
    raw_json: JSON.stringify({
      messageId: 'private-message-id',
      messageType: 'text',
      fromMe: false,
    }),
  });
  const responseLog = buildSafeDashboardResponseLog({
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      success: true,
      inbox: [{ messageText: 'Another private message' }],
      groupMap: [{ chatName: 'Private lesson group' }],
    },
  });
  const serialised = JSON.stringify({ payloadLog, responseLog });

  assert.deepEqual(payloadLog, {
    source: 'whatsapp_group_auto',
    messageType: 'text',
    textLength: 22,
    fromMe: false,
  });
  assert.deepEqual(responseLog, {
    status: 200,
    contentType: 'application/json',
    success: true,
    responseKeys: ['groupMap', 'inbox', 'success'],
  });
  assert.doesNotMatch(serialised, /private|parent|447700|message-id|chat-id/iu);
});

test('bounded bridge log rotates by size and keeps the configured file count', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fc-bridge-log-'));
  const filePath = path.join(directory, 'bridge.log');
  const stream = new RotatingLogStream({
    filePath,
    maxBytes: 1024,
    maxFiles: 2,
    maxAgeDays: 14,
  });
  const line = `${'x'.repeat(700)}\n`;

  stream.write(line);
  stream.write(line);
  stream.write(line);
  stream.end();
  await once(stream, 'finish');

  assert.equal(readFileSync(filePath, 'utf8'), line);
  assert.equal(readFileSync(`${filePath}.1`, 'utf8'), line);
  assert.equal(readFileSync(`${filePath}.2`, 'utf8'), line);
  assert.ok(statSync(filePath).size <= 1024);
});

test('bounded bridge log removes expired rotations without deleting the active log', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fc-bridge-log-age-'));
  const filePath = path.join(directory, 'bridge.log');
  const oldRotation = `${filePath}.1`;
  const nowMs = Date.parse('2026-07-26T12:00:00Z');
  const oldDate = new Date(nowMs - 15 * 24 * 60 * 60 * 1000);
  writeFileSync(filePath, 'active\n');
  writeFileSync(oldRotation, 'expired\n');
  utimesSync(oldRotation, oldDate, oldDate);

  const stream = new RotatingLogStream({
    filePath,
    maxBytes: 1024,
    maxFiles: 2,
    maxAgeDays: 14,
    now: () => nowMs,
  });
  stream.end();

  assert.equal(readFileSync(filePath, 'utf8'), 'active\n');
  assert.throws(() => readFileSync(oldRotation, 'utf8'), /ENOENT/u);
});
