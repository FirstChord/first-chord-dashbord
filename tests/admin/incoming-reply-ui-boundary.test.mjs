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

test('Reply + Plan copies one reviewed draft, persists it, then opens the linked plan', async () => {
  const source = await readFile(inboxClientUrl, 'utf8');
  const copyIndex = source.indexOf('await navigator.clipboard.writeText(reply)');
  const convertIndex = source.indexOf("await onConvert(entry, correctionPayload('converted'))");

  assert.match(source, /Reply \+ Plan/u);
  assert.match(source, /replyTemplate: replyDraft\.trim\(\)/u);
  assert.ok(copyIndex >= 0 && convertIndex > copyIndex);
  assert.match(source, /window\.location\.assign\(`\/admin\/planning\?focus=/u);
});
