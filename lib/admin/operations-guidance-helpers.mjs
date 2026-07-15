// Pure allowlisted operations guidance retrieval. The snippets are deliberately
// small and fixed in code: callers cannot supply a path, read a repository file,
// or ask a model to discover its own sources.

export const OPERATIONS_GUIDANCE_MAX_RESULTS = 3;
export const OPERATIONS_GUIDANCE_MAX_QUERY_LENGTH = 240;
export const OPERATIONS_GUIDANCE_MAX_SNIPPET_LENGTH = 700;

export const OPERATIONS_GUIDANCE_SECTIONS = Object.freeze([
  {
    documentId: 'operations_runbook',
    sectionId: 'deploy_rollback',
    title: 'Deploy rollback and recovery',
    sourcePath: 'docs/admin/OPERATIONS_RUNBOOK.md',
    keywords: ['deploy', 'deployment', 'rollback', 'revert', 'production', 'release', 'failed build'],
    snippet: 'Revert the code or deploy first. Do not reverse append-only logs or guess at provider state. Reconcile any external or Sheets state from authoritative evidence and record the recovery action.',
  },
  {
    documentId: 'operations_runbook',
    sectionId: 'practice_chat_delivery_recovery',
    title: 'Practice Chat delivery recovery',
    sourcePath: 'docs/admin/OPERATIONS_RUNBOOK.md',
    keywords: ['practice chat', 'practice note', 'gmail', 'lesson note', 'email failed', 'delivery', 'duplicate email'],
    snippet: 'Check the Practice_Notes_Log delivery row before retrying. If MMS saved but Gmail failed, retry only the email step when the row proves no email was sent. Never infer parent delivery merely from a copied draft or an attempted send.',
  },
  {
    documentId: 'payments_rules',
    sectionId: 'pause_expectation_reconciliation',
    title: 'Pause expectation reconciliation',
    sourcePath: 'docs/admin/PAYMENTS_RULES.md',
    keywords: ['pause', 'paused', 'payment expectation', 'billing mismatch', 'stripe pause', 'reconcile pause'],
    snippet: 'Pause History and lesson coverage are evidence for an explicit preview-and-confirm reconciliation. Ordinary issue reads must not change Students.payment_expectation, and this workflow never mutates Stripe.',
  },
  {
    documentId: 'ownership_matrix',
    sectionId: 'onboarding_partial_failure',
    title: 'Onboarding partial failure',
    sourcePath: 'docs/admin/OWNERSHIP_MATRIX.md',
    keywords: ['onboard', 'onboarding', 'add student', 'first lesson', 'billing profile', 'partial failure', 'mms activation'],
    snippet: 'Onboarding writes across Sheets, the registry and MMS and can partially succeed. Preserve the result of each completed step, surface the warning and recover only the failed step from authoritative evidence rather than repeating the whole workflow.',
  },
  {
    documentId: 'whatsapp_bridge',
    sectionId: 'capture_recovery',
    title: 'Incoming WhatsApp capture recovery',
    sourcePath: 'docs/admin/WHATSAPP_INCOMING_BRIDGE.md',
    keywords: ['whatsapp', 'bridge', 'capture', 'incoming message', 'heartbeat', 'placeholder', 'starred message'],
    snippet: 'The bridge is receive-only and captures only confirmed lesson groups. If message text is missing, use the paste-to-classify recovery path. Matching and classification remain reviewable proposals and never authorise a pause, payment or message action.',
  },
  {
    documentId: 'hygiene_and_secrets',
    sectionId: 'credential_handling',
    title: 'Credential and secret handling',
    sourcePath: 'docs/admin/HYGIENE_AND_SECRETS.md',
    keywords: ['secret', 'credential', 'token', 'api key', 'environment', 'env', 'rotate key', 'leaked key'],
    snippet: 'Keep credentials in the approved environment or ignored local files, never committed configuration or logs. If exposure is suspected, identify every dependent service, rotate at an operationally safe time and update each approved environment deliberately.',
  },
  {
    documentId: 'state_tabs_schema',
    sectionId: 'sheets_backup_and_recovery',
    title: 'Sheets backup and recovery',
    sourcePath: 'docs/admin/STATE_TABS_SCHEMA.md',
    keywords: ['sheet', 'sheets', 'backup', 'restore', 'tab', 'row', 'google sheets', 'data recovery'],
    snippet: 'Use the managed Sheets backup before risky state work. Current-state tabs are generally last-write-wins, while Event_Log and progress logs are append-only. Restore or reconcile from a verified backup and authoritative provider evidence; do not edit history to make it look clean.',
  },
  {
    documentId: 'payroll_workflow',
    sectionId: 'review_and_payment_boundary',
    title: 'Payroll review and payment boundary',
    sourcePath: 'docs/workflows/06-paying-tutors.md',
    keywords: ['payroll', 'tutor pay', 'wise', 'invoice', 'attendance', 'pay tutor', 'statement'],
    snippet: 'The dashboard prepares and reviews payroll evidence; it does not execute payment. Unknown attendance stays needs-review, only reviewed positive rows enter the Wise CSV, and a human uploads and approves the payment in Wise.',
  },
]);

function normaliseQuery(value = '') {
  return `${value || ''}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function scoreSection(query, section) {
  const words = new Set(query.split(' ').filter((word) => word.length >= 3));
  let score = 0;
  for (const keyword of section.keywords) {
    const normalisedKeyword = normaliseQuery(keyword);
    if (query.includes(normalisedKeyword)) {
      score += normalisedKeyword.includes(' ') ? 6 : 3;
      continue;
    }
    const keywordWords = normalisedKeyword.split(' ');
    score += keywordWords.filter((word) => words.has(word)).length;
  }
  return score;
}

function toGuidanceResult(section) {
  return {
    title: section.title,
    snippet: section.snippet.slice(0, OPERATIONS_GUIDANCE_MAX_SNIPPET_LENGTH),
    citation: {
      documentId: section.documentId,
      sectionId: section.sectionId,
      sourcePath: section.sourcePath,
      heading: section.title,
    },
  };
}

export function getOperationsGuidanceSection(documentId = '', sectionId = '') {
  const section = OPERATIONS_GUIDANCE_SECTIONS.find((entry) => (
    entry.documentId === documentId && entry.sectionId === sectionId
  ));
  return section ? toGuidanceResult(section) : null;
}

export function searchOperationsGuidance(query = '', { limit = OPERATIONS_GUIDANCE_MAX_RESULTS } = {}) {
  const rawQuery = `${query || ''}`.trim();
  if (!rawQuery) {
    return { status: 'abstain', reason: 'empty_query', results: [] };
  }
  if (rawQuery.length > OPERATIONS_GUIDANCE_MAX_QUERY_LENGTH) {
    return { status: 'abstain', reason: 'query_too_long', results: [] };
  }

  const normalisedQuery = normaliseQuery(rawQuery);
  const boundedLimit = Math.max(1, Math.min(OPERATIONS_GUIDANCE_MAX_RESULTS, Number(limit) || 1));
  const ranked = OPERATIONS_GUIDANCE_SECTIONS
    .map((section, index) => ({ section, index, score: scoreSection(normalisedQuery, section) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, boundedLimit)
    .map(({ section }) => toGuidanceResult(section));

  if (!ranked.length) {
    return { status: 'abstain', reason: 'no_allowlisted_guidance', results: [] };
  }
  return { status: 'found', reason: '', results: ranked };
}
