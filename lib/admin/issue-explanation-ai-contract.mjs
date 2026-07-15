export const ISSUE_AI_BRIEFING_SCHEMA_VERSION = 1;
export const ISSUE_AI_BRIEFING_PROMPT_VERSION = 'issue-briefing-v1';
export const ISSUE_AI_BRIEFING_LIMITS = Object.freeze({
  headline: 90,
  explanation: 360,
  whatToCheck: 240,
  caveat: 220,
  evidenceRefs: 6,
});

const OUTPUT_KEYS = Object.freeze([
  'headline',
  'explanation',
  'whatToCheck',
  'caveat',
  'evidenceRefs',
]);

const DIRECT_IDENTIFIER_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /\b(?:cus|sub|sdt|pi|in|evt|ch|pm)_[A-Za-z0-9_-]+\b/u,
  /https?:\/\/\S+/iu,
  /(?:\+\d[\d\s()-]{7,}\d|\b0\d[\d\s()-]{7,}\d\b)/u,
];
const COMPLETED_ACTION_PATTERN = /\b(?:i|we)(?:'ve| have| already)?\s+(?:paused|refunded|cancelled|changed|moved|sent|emailed|updated|resolved|archived|completed|fixed)\b/iu;
const PROMISED_ACTION_PATTERN = /\b(?:i|we)(?:'ll| will| are going to)\s+(?:pause|refund|cancel|change|move|send|email|update|resolve|archive|complete|fix)\b/iu;

export const ISSUE_AI_BRIEFING_JSON_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [...OUTPUT_KEYS],
  properties: {
    headline: { type: 'string' },
    explanation: { type: 'string' },
    whatToCheck: { type: 'string' },
    caveat: { type: 'string' },
    evidenceRefs: {
      type: 'array',
      items: { type: 'string' },
    },
  },
});

export class IssueAiBriefingError extends Error {
  constructor(code, message = 'AI briefing failed', details = []) {
    super(message);
    this.name = 'IssueAiBriefingError';
    this.code = code;
    this.details = Array.isArray(details) ? [...details] : [];
  }
}

function containsDirectIdentifier(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return DIRECT_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(text));
}

function clean(value, maxLength) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (text.length <= maxLength) return text;

  const available = Math.max(1, maxLength - 1);
  const candidate = text.slice(0, available);
  const lastSpace = candidate.lastIndexOf(' ');
  const end = lastSpace >= Math.floor(available * 0.6) ? lastSpace : available;
  return `${candidate.slice(0, end).trimEnd()}…`;
}

export function buildIssueAiBriefingInput(explanation = {}) {
  if (explanation?.kind !== 'issue_explanation') {
    throw new IssueAiBriefingError('invalid_input', 'A deterministic issue explanation is required');
  }
  if (containsDirectIdentifier(explanation)) {
    throw new IssueAiBriefingError('unsafe_input', 'The explanation contains a direct identifier');
  }

  const evidence = (Array.isArray(explanation.evidence) ? explanation.evidence : [])
    .slice(0, 12)
    .map((item, index) => ({
      id: `evidence_${index + 1}`,
      label: `${item?.label || ''}`.trim().slice(0, 120),
      value: `${item?.value || ''}`.trim().slice(0, 240),
      sourceRole: `${item?.sourceRole || ''}`.trim().slice(0, 160),
    }));
  const ambiguity = (Array.isArray(explanation.ambiguity) ? explanation.ambiguity : [])
    .slice(0, 12)
    .map((item) => ({
      code: `${item?.code || ''}`.trim().slice(0, 120),
      explanation: `${item?.explanation || ''}`.trim().slice(0, 240),
    }));
  const notChecked = (Array.isArray(explanation.notChecked) ? explanation.notChecked : [])
    .slice(0, 12)
    .map((item) => `${item || ''}`.trim().slice(0, 300))
    .filter(Boolean);

  const context = {
    kind: 'issue_briefing_input',
    schemaVersion: ISSUE_AI_BRIEFING_SCHEMA_VERSION,
    status: {
      label: `${explanation.status?.label || ''}`.trim().slice(0, 120),
      detail: `${explanation.status?.detail || ''}`.trim().slice(0, 300),
    },
    rule: {
      name: `${explanation.rule?.name || ''}`.trim().slice(0, 120),
      statement: `${explanation.rule?.statement || ''}`.trim().slice(0, 360),
      result: `${explanation.rule?.result || ''}`.trim().slice(0, 360),
    },
    source: {
      label: `${explanation.source?.label || ''}`.trim().slice(0, 180),
      detectorRechecked: Boolean(explanation.source?.detectorRechecked),
    },
    queue: { label: `${explanation.queue?.label || ''}`.trim().slice(0, 120) },
    evidence,
    ambiguity,
    notChecked,
    deterministicNextStep: `${explanation.nextStep?.label || ''}`.trim().slice(0, 300),
  };

  if (containsDirectIdentifier(context)) {
    throw new IssueAiBriefingError('unsafe_input', 'The projected context contains a direct identifier');
  }

  return {
    context,
    allowedEvidenceRefs: evidence.map((item) => item.id),
    requiredCaveat: ambiguity.length > 0 || notChecked.length > 0,
  };
}

export function validateIssueAiBriefing(value = {}, {
  allowedEvidenceRefs = [],
  requiredCaveat = false,
} = {}) {
  const errors = [];
  const keys = Object.keys(value || {}).sort();
  const expectedKeys = [...OUTPUT_KEYS].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    errors.push('output_shape_invalid');
  }

  const headline = clean(value?.headline, ISSUE_AI_BRIEFING_LIMITS.headline);
  const explanation = clean(value?.explanation, ISSUE_AI_BRIEFING_LIMITS.explanation);
  const whatToCheck = clean(value?.whatToCheck, ISSUE_AI_BRIEFING_LIMITS.whatToCheck);
  const caveat = clean(value?.caveat, ISSUE_AI_BRIEFING_LIMITS.caveat);
  if (!headline) errors.push('headline_invalid');
  if (!explanation) errors.push('explanation_invalid');
  if (!whatToCheck) errors.push('what_to_check_invalid');
  if (requiredCaveat && !caveat) errors.push('caveat_required');

  const rawRefs = Array.isArray(value?.evidenceRefs) ? value.evidenceRefs : [];
  const refs = rawRefs.every((item) => typeof item === 'string')
    ? [...new Set(rawRefs.map((item) => item.trim()).filter(Boolean))]
    : [];
  if (!Array.isArray(value?.evidenceRefs) || !rawRefs.every((item) => typeof item === 'string') || refs.length !== rawRefs.length) {
    errors.push('evidence_refs_invalid');
  }
  if (refs.length > ISSUE_AI_BRIEFING_LIMITS.evidenceRefs) errors.push('too_many_evidence_refs');
  const allowed = new Set(allowedEvidenceRefs);
  for (const ref of refs) {
    if (!allowed.has(ref)) errors.push(`unknown_evidence_ref:${ref}`);
  }
  if (allowed.size > 0 && refs.length === 0) errors.push('evidence_ref_required');

  // Inspect the complete model text before applying display bounds so unsafe
  // content cannot be hidden merely by placing it after a length limit.
  const completeText = [value?.headline, value?.explanation, value?.whatToCheck, value?.caveat]
    .filter((item) => typeof item === 'string')
    .join(' ');
  if (containsDirectIdentifier(completeText)) errors.push('direct_identifier_not_allowed');
  if (COMPLETED_ACTION_PATTERN.test(completeText)) errors.push('completed_action_claim_not_allowed');
  if (PROMISED_ACTION_PATTERN.test(completeText)) errors.push('promised_action_not_allowed');

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    briefing: errors.length === 0
      ? { headline, explanation, whatToCheck, caveat, evidenceRefs: refs }
      : null,
  };
}
