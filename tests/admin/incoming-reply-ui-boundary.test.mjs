import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const inboxClientUrl = new URL('../../components/admin/AdminIncomingMessagesPageClient.js', import.meta.url);

test('AI reply drafting is invoked by one card Reply press and has a standard fallback', async () => {
  const source = await readFile(inboxClientUrl, 'utf8');

  assert.match(source, /async function openReply\(\)/u);
  assert.match(source, /const drafted = await onDraftReply\(entry\)/u);
  assert.match(source, /if \(drafted\) return/u);
  assert.match(source, /setIsReplyOpen\(true\)/u);
  assert.match(source, /onClick=\{openReply\}/u);
});

test('the inbox has no bulk or background reply-drafting control', async () => {
  const source = await readFile(inboxClientUrl, 'utf8');

  assert.doesNotMatch(source, /Draft all open|handleDraftAllOpen/u);
  assert.doesNotMatch(source, /useEffect\([^)]*onDraftReply|setInterval\([^)]*onDraftReply/u);
});
