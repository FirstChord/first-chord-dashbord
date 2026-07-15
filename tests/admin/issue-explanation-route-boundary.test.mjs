import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const routeUrl = new URL('../../app/api/admin/issues/[mmsId]/explanation/route.js', import.meta.url);

test('issue explanation route is admin-authenticated, read-only, and uses the narrow context service', async () => {
  const source = await readFile(routeUrl, 'utf8');

  assert.match(source, /getServerSession\(authOptions\)/u);
  assert.match(source, /session\?\.user\?\.isAdmin/u);
  assert.match(source, /assistantContextService\.getIssueContext/u);
  assert.match(source, /buildIssueExplanation/u);
  assert.match(source, /export async function GET/u);
  assert.doesNotMatch(source, /export async function (?:POST|PATCH|PUT|DELETE)|getAdminIssues|upsert|append|update|delete|send|scanLiveStripe|getLiveStripe/u);
});
