// Pure proposal boundary for low-risk parent acknowledgements. It prepares no
// recipient, sends nothing and exposes no integration. A future model may fill
// the exact proposal shape, but deterministic validation and a real UI approval
// remain mandatory before placeholder substitution or copying.

export const COMMUNICATION_DRAFT_CONTEXT_SCHEMA_VERSION = 1;
export const COMMUNICATION_DRAFT_MAX_LENGTH = 900;
export const COMMUNICATION_DRAFT_ALLOWED_PURPOSES = Object.freeze([
  'absence_acknowledgement',
  'schedule_acknowledgement',
  'general_acknowledgement',
]);
export const COMMUNICATION_DRAFT_ALLOWED_FACT_IDS = Object.freeze([
  'category',
  'lesson_date',
  'return_date',
  'absence_scope',
  'schedule_request',
  'acknowledgement_needed',
]);
export const COMMUNICATION_DRAFT_ALLOWED_PLACEHOLDERS = Object.freeze([
  '[PARENT_FIRST]',
  '[STUDENT_FIRST]',
]);
export const COMMUNICATION_DRAFT_PROPOSAL_KEYS = Object.freeze([
  'kind',
  'draft',
  'citedFactIds',
  'unresolvedPlaceholders',
  'ambiguityFlags',
  'requiresHumanApproval',
]);

const INSTRUCTION_PATTERN = /\b(?:ignore|disregard|override)\b.{0,40}\b(?:instruction|prompt|rule)s?\b|\bsystem prompt\b|\barchive every message\b/iu;
const COMPLETED_ACTION_PATTERN = /\b(?:i|we)(?:'ve| have| already)?\s+(?:paused|refunded|cancelled|changed|moved|sent|emailed|updated|completed|sorted)\b/iu;
const PROMISED_ACTION_PATTERN = /\b(?:i|we)(?:'ll| will| are going to)\s+(?:pause|refund|cancel|change|move|send|email|update|complete|sort)\b/iu;
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/iu;
const PHONE_PATTERN = /(?:\+?44\s?7|\b07)\d(?:[\s-]?\d){8}\b/u;
const NAME_REPLACEMENT_PATTERN = /^[\p{L}\p{M}' -]{1,80}$/u;

function clean(value = '', maxLength = COMMUNICATION_DRAFT_MAX_LENGTH) {
  return `${value ?? ''}`.trim().slice(0, maxLength);
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value, 120)).filter(Boolean))];
}

function placeholdersIn(value = '') {
  return uniqueStrings(`${value || ''}`.match(/\[[A-Z_]+\]/gu) || []);
}

export function buildCommunicationDraftContext({ purpose = '', facts = [], ambiguityFlags = [] } = {}) {
  const errors = [];
  const normalisedPurpose = clean(purpose, 80);
  if (!COMMUNICATION_DRAFT_ALLOWED_PURPOSES.includes(normalisedPurpose)) {
    errors.push('unsupported_purpose');
  }

  const allowedFactIds = new Set(COMMUNICATION_DRAFT_ALLOWED_FACT_IDS);
  const normalisedFacts = [];
  for (const fact of Array.isArray(facts) ? facts : []) {
    const id = clean(fact?.id, 80);
    const value = clean(fact?.value, 240);
    const source = clean(fact?.source, 80);
    if (!allowedFactIds.has(id)) {
      errors.push(`unsupported_fact:${id || 'missing'}`);
      continue;
    }
    if (fact?.confirmed !== true) {
      errors.push(`unconfirmed_fact:${id}`);
      continue;
    }
    if (!value || !source) {
      errors.push(`incomplete_fact:${id}`);
      continue;
    }
    if (INSTRUCTION_PATTERN.test(value)) {
      errors.push(`untrusted_instruction:${id}`);
      continue;
    }
    normalisedFacts.push({ id, value, source, confirmed: true });
  }

  const normalisedAmbiguityFlags = uniqueStrings(ambiguityFlags);
  return {
    schemaVersion: COMMUNICATION_DRAFT_CONTEXT_SCHEMA_VERSION,
    kind: 'communication_draft_context',
    purpose: normalisedPurpose,
    audience: 'parent_or_carer',
    facts: normalisedFacts,
    allowedPlaceholders: [...COMMUNICATION_DRAFT_ALLOWED_PLACEHOLDERS],
    ambiguityFlags: normalisedAmbiguityFlags,
    eligible: errors.length === 0 && normalisedAmbiguityFlags.length === 0,
    requiresHumanApproval: true,
    errors,
  };
}

export function validateCommunicationDraftProposal(proposal = {}, context = {}) {
  const errors = [];
  const proposalKeys = Object.keys(proposal).sort();
  const expectedKeys = [...COMMUNICATION_DRAFT_PROPOSAL_KEYS].sort();
  if (proposalKeys.length !== expectedKeys.length || proposalKeys.some((key, index) => key !== expectedKeys[index])) {
    errors.push('proposal_shape_invalid');
  }
  if (proposal.kind !== 'proposal') errors.push('kind_must_be_proposal');
  if (proposal.requiresHumanApproval !== true) errors.push('human_approval_must_be_required');
  if (context.eligible !== true || context.requiresHumanApproval !== true) errors.push('context_not_eligible');

  const draft = clean(proposal.draft);
  if (!draft) errors.push('draft_required');
  if (`${proposal.draft ?? ''}`.length > COMMUNICATION_DRAFT_MAX_LENGTH) errors.push('draft_too_long');
  if (INSTRUCTION_PATTERN.test(draft)) errors.push('untrusted_instruction_in_draft');
  if (COMPLETED_ACTION_PATTERN.test(draft)) errors.push('unsupported_completed_action_claim');
  if (PROMISED_ACTION_PATTERN.test(draft)) errors.push('unsupported_action_promise');
  if (EMAIL_PATTERN.test(draft)) errors.push('recipient_email_not_allowed');
  if (PHONE_PATTERN.test(draft)) errors.push('recipient_phone_not_allowed');

  const allowedPlaceholders = new Set(context.allowedPlaceholders || []);
  const usedPlaceholders = placeholdersIn(draft);
  for (const placeholder of usedPlaceholders) {
    if (!allowedPlaceholders.has(placeholder)) errors.push(`unknown_placeholder:${placeholder}`);
  }

  const unresolvedPlaceholders = uniqueStrings(proposal.unresolvedPlaceholders);
  if (
    unresolvedPlaceholders.length !== usedPlaceholders.length
    || unresolvedPlaceholders.some((placeholder) => !usedPlaceholders.includes(placeholder))
  ) {
    errors.push('unresolved_placeholders_must_match_draft');
  }

  const confirmedFactIds = new Set((context.facts || []).filter((fact) => fact.confirmed === true).map((fact) => fact.id));
  const citedFactIds = uniqueStrings(proposal.citedFactIds);
  if (!citedFactIds.length) errors.push('confirmed_fact_citation_required');
  for (const factId of citedFactIds) {
    if (!confirmedFactIds.has(factId)) errors.push(`invented_fact:${factId}`);
  }

  const proposalAmbiguityFlags = uniqueStrings(proposal.ambiguityFlags);
  const contextAmbiguityFlags = uniqueStrings(context.ambiguityFlags);
  for (const flag of contextAmbiguityFlags) {
    if (!proposalAmbiguityFlags.includes(flag)) errors.push(`missing_ambiguity_flag:${flag}`);
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
  };
}

export function materialiseApprovedCommunicationDraft(proposal = {}, context = {}, replacements = {}, {
  approvedByHuman = false,
} = {}) {
  if (approvedByHuman !== true) {
    return { materialised: false, reason: 'human_approval_required', body: '' };
  }
  const validation = validateCommunicationDraftProposal(proposal, context);
  if (!validation.valid) {
    return { materialised: false, reason: 'proposal_invalid', errors: validation.errors, body: '' };
  }

  let body = clean(proposal.draft);
  for (const placeholder of proposal.unresolvedPlaceholders) {
    const replacement = clean(replacements?.[placeholder], 120);
    if (!replacement) {
      return { materialised: false, reason: `missing_replacement:${placeholder}`, body: '' };
    }
    if (
      !NAME_REPLACEMENT_PATTERN.test(replacement)
      || INSTRUCTION_PATTERN.test(replacement)
      || COMPLETED_ACTION_PATTERN.test(replacement)
      || PROMISED_ACTION_PATTERN.test(replacement)
      || EMAIL_PATTERN.test(replacement)
      || PHONE_PATTERN.test(replacement)
    ) {
      return { materialised: false, reason: `invalid_replacement:${placeholder}`, body: '' };
    }
    body = body.split(placeholder).join(replacement);
  }

  return { materialised: true, reason: '', body };
}
