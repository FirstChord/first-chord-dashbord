import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PRACTICE_CHAT_ASR_MODEL,
  resolvePracticeChatAsrModel,
  SUPPORTED_PRACTICE_CHAT_ASR_MODELS,
} from '../../lib/config/practice-chat-asr.mjs';

test('unset means send no parameter at all', () => {
  assert.equal(resolvePracticeChatAsrModel(''), '');
  assert.equal(resolvePracticeChatAsrModel(undefined), '');
  assert.equal(resolvePracticeChatAsrModel('   '), '');
  assert.equal(DEFAULT_PRACTICE_CHAT_ASR_MODEL, '');
});

test('accepts every supported model', () => {
  for (const model of SUPPORTED_PRACTICE_CHAT_ASR_MODELS) {
    assert.equal(resolvePracticeChatAsrModel(model), model);
  }
});

test('the December mini snapshot is available — it is the one the trial uses', () => {
  assert.ok(SUPPORTED_PRACTICE_CHAT_ASR_MODELS.includes('gpt-4o-mini-transcribe-2025-12-15'));
  assert.equal(
    resolvePracticeChatAsrModel('gpt-4o-mini-transcribe-2025-12-15'),
    'gpt-4o-mini-transcribe-2025-12-15'
  );
});

test('a typo falls back rather than sending a broken model name', () => {
  const original = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);

  try {
    // The realistic failure: someone fat-fingers the Railway variable and the
    // trial silently never happens.
    assert.equal(resolvePracticeChatAsrModel('gpt-4o-mini-transcrbe-2025-12-15'), '');
    assert.equal(resolvePracticeChatAsrModel('whisper-2'), '');
  } finally {
    console.warn = original;
  }

  assert.equal(warnings.length, 2, 'a typo must be noisy, not silent');
  assert.match(warnings[0], /not a supported/);
  assert.match(warnings[0], /gpt-4o-mini-transcribe-2025-12-15/, 'the warning lists valid options');
});

test('does not accept the diarize model', () => {
  const original = console.warn;
  console.warn = () => {};
  try {
    // It needs diarized_json and a chunking_strategy and takes no prompt — the
    // PWA cannot build or parse that request.
    assert.equal(resolvePracticeChatAsrModel('gpt-4o-transcribe-diarize'), '');
  } finally {
    console.warn = original;
  }
});

test('trims surrounding whitespace, which is easy to paste into a config value', () => {
  assert.equal(resolvePracticeChatAsrModel('  gpt-4o-transcribe  '), 'gpt-4o-transcribe');
});
