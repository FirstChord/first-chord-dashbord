import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getOperationsGuidanceSection,
  OPERATIONS_GUIDANCE_MAX_QUERY_LENGTH,
  OPERATIONS_GUIDANCE_MAX_RESULTS,
  OPERATIONS_GUIDANCE_MAX_SNIPPET_LENGTH,
  OPERATIONS_GUIDANCE_SECTIONS,
  searchOperationsGuidance,
} from '../../lib/admin/operations-guidance-helpers.mjs';

test('operations guidance searches a fixed allowlist and returns citations', () => {
  const result = searchOperationsGuidance('Practice Chat Gmail delivery failed');
  assert.equal(result.status, 'found');
  assert.equal(result.results[0].citation.documentId, 'operations_runbook');
  assert.equal(result.results[0].citation.sectionId, 'practice_chat_delivery_recovery');
  assert.match(result.results[0].snippet, /Practice_Notes_Log/u);
  assert.ok(result.results[0].snippet.length <= OPERATIONS_GUIDANCE_MAX_SNIPPET_LENGTH);
});

test('operations guidance caps result count regardless of caller input', () => {
  const result = searchOperationsGuidance('payment pause sheet backup deploy secret payroll whatsapp', { limit: 999 });
  assert.equal(result.status, 'found');
  assert.ok(result.results.length <= OPERATIONS_GUIDANCE_MAX_RESULTS);
  assert.ok(result.results.every((entry) => entry.citation.documentId && entry.citation.sectionId));
});

test('operations guidance abstains for unknown and overlong queries', () => {
  assert.deepEqual(searchOperationsGuidance(''), { status: 'abstain', reason: 'empty_query', results: [] });
  assert.deepEqual(
    searchOperationsGuidance('xylophone varnish question'),
    { status: 'abstain', reason: 'no_allowlisted_guidance', results: [] },
  );
  assert.deepEqual(
    searchOperationsGuidance('x'.repeat(OPERATIONS_GUIDANCE_MAX_QUERY_LENGTH + 1)),
    { status: 'abstain', reason: 'query_too_long', results: [] },
  );
});

test('operations guidance section lookup accepts ids, never paths', () => {
  const section = getOperationsGuidanceSection('payments_rules', 'pause_expectation_reconciliation');
  assert.equal(section.citation.sourcePath, 'docs/policies/payments.md');
  assert.equal(getOperationsGuidanceSection('../../.env', 'anything'), null);
  assert.equal(getOperationsGuidanceSection('operations_runbook', '../../../secret'), null);
});

test('operations guidance catalog contains bounded fixed source metadata only', () => {
  const ids = new Set();
  for (const section of OPERATIONS_GUIDANCE_SECTIONS) {
    const id = `${section.documentId}:${section.sectionId}`;
    assert.ok(!ids.has(id), `duplicate guidance id ${id}`);
    ids.add(id);
    assert.match(
      section.sourcePath,
      /^docs\/(?:architecture\/data|operations(?:\/integrations)?|policies|workflows\/finance)\/[a-z0-9-]+\.md$/u,
    );
    assert.ok(section.snippet.length <= OPERATIONS_GUIDANCE_MAX_SNIPPET_LENGTH);
    assert.ok(Array.isArray(section.keywords) && section.keywords.length > 0);
  }
});
