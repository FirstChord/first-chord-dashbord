// Model input/output boundary for the incoming-reply proposal lane. Unlike
// the issue-briefing pilot, the model input includes free parent message text,
// so this module owns an explicit redaction step: known names → placeholders,
// emails/phones/URLs stripped, bounded length. Names the roster does not know
// can survive redaction — that residual risk is recorded in
// AI_TOOL_CONTRACTS.md and accepted (or not) at Finn's sign-off.

import { validateIncomingReplyDraft } from './incoming-reply-policy.mjs';

export const INCOMING_REPLY_SCHEMA_VERSION = 1;
export const INCOMING_REPLY_PROMPT_VERSION = 'incoming-reply-v1';
export const INCOMING_REPLY_MESSAGE_MAX_LENGTH = 600;

export class IncomingReplyAiError extends Error {
  constructor(code, message = 'Reply drafting failed', details = []) {
    super(message);
    this.name = 'IncomingReplyAiError';
    this.code = code;
    this.details = Array.isArray(details) ? [...details] : [];
  }
}

export const INCOMING_REPLY_JSON_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['draft', 'usedFactIds'],
  properties: {
    draft: { type: 'string' },
    usedFactIds: {
      type: 'array',
      items: { type: 'string' },
    },
  },
});

const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/giu;
const URL_PATTERN = /https?:\/\/\S+/giu;
const PHONE_PATTERN = /(?:\+?\d[\d\s()-]{7,}\d)/gu;
const PROVIDER_ID_PATTERN = /\b(?:cus|sub|sdt|pi|in|evt|ch|pm)_[A-Za-z0-9_-]+\b/gu;

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function replaceNames(text, names = [], placeholder = '') {
  let result = text;
  for (const name of names) {
    const token = clean(name);
    if (token.length < 2) continue;
    result = result.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'giu'), placeholder);
  }
  return result;
}

// Redacts the parent message before it can reach the model. Known student
// names become [STUDENT_FIRST]; the stored parent name and the WhatsApp push
// name become [PARENT_FIRST]; emails/phones/URLs/provider ids are stripped
// outright. Whole-name-then-part ordering so "Anna Smith" doesn't leave a
// dangling "Smith".
export function redactIncomingMessageText(messageText = '', {
  studentNames = [],
  parentNames = [],
} = {}) {
  let text = clean(messageText).replace(/\s+/gu, ' ');

  const studentTokens = studentNames.flatMap((name) => [clean(name), ...clean(name).split(/\s+/u)]);
  const parentTokens = parentNames.flatMap((name) => [clean(name), ...clean(name).split(/\s+/u)]);
  const sortByLength = (a, b) => b.length - a.length;
  text = replaceNames(text, [...new Set(studentTokens)].sort(sortByLength), '[STUDENT_FIRST]');
  text = replaceNames(text, [...new Set(parentTokens)].sort(sortByLength), '[PARENT_FIRST]');

  text = text
    .replace(EMAIL_PATTERN, '[REDACTED]')
    .replace(URL_PATTERN, '[REDACTED]')
    .replace(PHONE_PATTERN, '[REDACTED]')
    .replace(PROVIDER_ID_PATTERN, '[REDACTED]')
    .replace(/\s+/gu, ' ')
    .trim();

  return text.slice(0, INCOMING_REPLY_MESSAGE_MAX_LENGTH);
}

// The exact object sent to the provider (and stored, verbatim, as the
// proposal's evidence_json). Deterministic policy context plus the redacted
// message — never raw rows, contact details or identifiers.
export function buildIncomingReplyAiInput(policyContext = {}, { redactedMessage = '' } = {}) {
  if (policyContext?.kind !== 'incoming_reply_policy_context') {
    throw new IncomingReplyAiError('invalid_input', 'A deterministic reply policy context is required');
  }
  if (policyContext.neutralFallback) {
    throw new IncomingReplyAiError('invalid_input', 'Ambiguous messages get the deterministic neutral draft, not a model call');
  }

  const message = clean(redactedMessage);
  if (!message) {
    throw new IncomingReplyAiError('invalid_input', 'A redacted message is required');
  }
  // Fresh non-global patterns: the shared ones carry the g flag, and a
  // stateful .test() would let every second identifier through.
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/iu.test(message)
    || /https?:\/\/\S+/iu.test(message)
    || /\b(?:cus|sub|sdt|pi|in|evt|ch|pm)_[A-Za-z0-9_-]+\b/u.test(message)) {
    throw new IncomingReplyAiError('unsafe_input', 'The redacted message still contains a direct identifier');
  }

  const context = {
    kind: 'incoming_reply_input',
    schemaVersion: INCOMING_REPLY_SCHEMA_VERSION,
    policyCase: `${policyContext.policyCase || ''}`.slice(0, 40),
    noticeWindow: `${policyContext.noticeWindow || ''}`.slice(0, 40),
    lessonDateIso: `${policyContext.lessonDateIso || ''}`.slice(0, 10),
    allowedFacts: (policyContext.allowedFacts || []).slice(0, 8).map((fact) => ({
      id: `${fact.id || ''}`.slice(0, 60),
      statement: `${fact.statement || ''}`.slice(0, 240),
    })),
    message,
  };

  return {
    context,
    allowedFactIds: context.allowedFacts.map((fact) => fact.id),
    policyContext,
  };
}

// Local semantic validation of the complete model output. Schema compliance
// upstream does not prove the words respect the cancellation policy — the
// deterministic policy validator is the authority.
export function validateIncomingReplyAiOutput(value = {}, { policyContext = {}, allowedFactIds = [] } = {}) {
  const errors = [];
  const keys = Object.keys(value || {}).sort();
  if (keys.length !== 2 || keys[0] !== 'draft' || keys[1] !== 'usedFactIds') {
    errors.push('output_shape_invalid');
  }

  const draft = clean(value?.draft);
  const draftValidation = validateIncomingReplyDraft(draft, policyContext);
  if (!draftValidation.valid) errors.push(...draftValidation.errors);

  const rawFactIds = Array.isArray(value?.usedFactIds) ? value.usedFactIds : [];
  const allowed = new Set(allowedFactIds);
  if (!Array.isArray(value?.usedFactIds) || !rawFactIds.every((id) => typeof id === 'string')) {
    errors.push('used_fact_ids_invalid');
  } else {
    for (const id of rawFactIds) {
      if (!allowed.has(id)) errors.push(`unknown_fact_id:${id}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    draft: errors.length === 0 ? draft : '',
  };
}
