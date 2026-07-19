# AI Runtime Integration

Last verified against code and production behaviour: 2026-07-19

This is the canonical engineering reference for the dashboard's model runtime.
Read it before adding or changing any dashboard AI feature. The issue briefing
is the reference integration described in detail below. It is a deliberately
thin, tool-free layer over deterministic context; it is not an agent framework.

A second integration built on the same pattern exists as of 2026-07-19: the
proposals-inbox reply lane (`lib/admin/incoming-reply-ai-{contract,provider}.mjs`,
flag `ADMIN_AI_REPLY_DRAFT_ENABLED`, off pending sign-off). Its contract, its
free-text redaction decision and its deterministic cancellation-policy
validator are documented in `AI_TOOL_CONTRACTS.md` under
`incoming_reply_draft.propose`; everything below about key scope, provider data
handling, cost controls and rollback applies to it unchanged.

The durable rule is:

```text
User explicitly requests help
-> server retrieves narrow deterministic context
-> server projects and redacts it
-> model produces typed wording or a proposal
-> server validates the complete model output
-> UI labels it as generated and keeps evidence visible
-> a human uses an existing deterministic workflow for any action
-> consequential outcomes are logged by that workflow
```

The model never owns truth, calculations, permissions, workflow state,
validation or consequential actions.

## Live Architecture

```text
Issues card in the admin browser
  |
  | GET deterministic explanation (no model)
  v
/api/admin/issues/[mmsId]/explanation
  |
  +-> assistantContextService.getIssueContext(...)
  +-> buildIssueExplanation(...)
  +-> redacted rule/evidence/ambiguity/next-step view model
  |
  | Admin clicks "Explain this simply"
  v
/api/admin/issues/[mmsId]/ai-explanation
  |
  +-> authenticates admin and rate-limits
  +-> rebuilds the context server-side
  +-> builds the same deterministic explanation
  +-> buildIssueAiBriefingInput(...) projects it again
  +-> POST https://api.openai.com/v1/responses
  +-> parse structured JSON
  +-> validateIssueAiBriefing(...)
  |
  v
Generated wording shown above, never instead of, deterministic evidence
```

The browser supplies the selected issue `source` and `issueType`; it does not
supply the evidence or prompt. The server derives those again from the exact
student/source/type context. This prevents a browser from smuggling arbitrary
text into the model call.

## File Map And Ownership

| Responsibility | File | Change risk |
| --- | --- | --- |
| AI panel, explicit click, fallback and feedback UI | `components/admin/issues/IssueExplanationPanel.js` | Keep generated copy visibly separate from evidence and actions |
| Deterministic explanation API | `app/api/admin/issues/[mmsId]/explanation/route.js` | Must remain useful with AI disabled |
| Authenticated AI orchestration, rate limit, safe HTTP errors and metadata logs | `app/api/admin/issues/[mmsId]/ai-explanation/route.js` | Must never accept raw context or gain mutation imports |
| Enum-only pilot feedback | `app/api/admin/ai/feedback/route.js` | Evaluation telemetry only; not an issue correction |
| OpenAI HTTP call, timeout and response parsing | `lib/admin/issue-explanation-ai-provider.mjs` | Only server code may import this module |
| Model input projection, JSON schema and local output validation | `lib/admin/issue-explanation-ai-contract.mjs` | Core privacy and grounding boundary |
| Narrow student/issue retrieval | `lib/admin/assistant-context-service.mjs` and projections/helpers beside it | Must remain strict, bounded and non-mutating |
| Fixed deterministic explanation | `lib/admin/issue-explanation-helpers.mjs` | Evidence and rule truth; model wording cannot override it |
| Contract/provider tests | `tests/admin/issue-explanation-ai-contract.test.mjs` | Run for every prompt, model or schema change |
| Route/UI boundary tests | `tests/admin/issue-explanation-ai-route-boundary.test.mjs` | Guards admin auth, explicit invocation and absence of mutations |

`docs/admin/AI_TOOL_CONTRACTS.md` remains the allowlist and policy boundary.
This document describes how the one allowed runtime is wired and operated.

## Dashboard API Contracts

### Deterministic explanation

```http
GET /api/admin/issues/:mmsId/explanation?source=:source&issueType=:issueType
```

- Requires `session.user.isAdmin`.
- Returns the deterministic `explanation` and `aiBriefingAvailable`.
- `aiBriefingAvailable` is true only when both the enable flag and dedicated
  key exist. It is an availability hint, not a provider-health check.
- Uses `Cache-Control: no-store`.
- Does not call OpenAI, refresh Stripe, synchronise `Issue_Queue`, or mutate
  anything.

### AI briefing

```http
POST /api/admin/issues/:mmsId/ai-explanation
Content-Type: application/json

{
  "source": "stripe_live",
  "issueType": "SUBSCRIPTION_CANCELLED_UNEXPECTEDLY"
}
```

Only those two body keys are accepted. The route:

1. requires an admin session;
2. applies a process-local limit of 10 requests per 60 seconds per admin;
3. creates an opaque UUID request ID;
4. retrieves the narrow issue context and deterministic explanation;
5. invokes the provider once;
6. returns only `{ requestId, briefing }` after local validation.

The limiter runs before body parsing, so malformed attempts also count. There
is no automatic retry. A retry is another explicit admin click and another
chargeable provider request.

### Feedback

```http
POST /api/admin/ai/feedback
Content-Type: application/json

{
  "requestId": "UUID returned by the briefing route",
  "rating": "helpful | not_helpful",
  "reason": "fixed enum required only for not_helpful"
}
```

Allowed negative reasons are `incorrect_or_unsupported`,
`missed_uncertainty`, `confusing`, and `no_added_value`. The route accepts no
student ID, issue context, prompt, output or free-text comment. It writes a
structured runtime log only. It does not update `Issue_Queue` or another
operational record.

## Exact OpenAI Request

The provider uses native server-side `fetch`; there is no OpenAI SDK or agent
dependency. It makes one request to:

```http
POST https://api.openai.com/v1/responses
Authorization: Bearer ${ADMIN_AI_OPENAI_API_KEY}
Content-Type: application/json
X-Client-Request-Id: <opaque UUID>
```

The request body is equivalent to:

```json
{
  "model": "ADMIN_AI_OPENAI_MODEL or gpt-5.6-luna",
  "store": false,
  "reasoning": { "effort": "none" },
  "max_output_tokens": 500,
  "instructions": "Versioned instructions held in code",
  "input": "JSON string containing the redacted issue_briefing_input",
  "text": {
    "format": {
      "type": "json_schema",
      "name": "first_chord_issue_briefing",
      "strict": true,
      "schema": "ISSUE_AI_BRIEFING_JSON_SCHEMA"
    }
  }
}
```

Important absences are intentional:

- no `tools`, function calling, web search, file search or remote MCP;
- no file uploads, vector store, conversation or previous response;
- no Stripe, Sheets, MMS, Gmail or shell access;
- no background mode, streaming or provider-side retry;
- no raw page payload, student name, MMS ID, contact detail or provider ID.

The code prompt is identified by `ISSUE_AI_BRIEFING_PROMPT_VERSION`; the output
contract has its own `ISSUE_AI_BRIEFING_SCHEMA_VERSION`. Change either version
when behaviour or shape materially changes, and run representative evaluations
before changing the production model.

The Responses API is appropriate here because this is one direct text
generation request, while strict Structured Outputs constrain the JSON shape.
Local validation remains required: schema compliance does not prove that the
words are grounded or safe.

Official references:

- [OpenAI text generation and Responses API](https://developers.openai.com/api/docs/guides/text)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI API data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)
- [OpenAI restricted API-key permissions](https://help.openai.com/en/articles/8867743)
- [OpenAI API project keys, model limits and budgets](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)

## Input Projection And Privacy Boundary

`buildIssueAiBriefingInput()` accepts only a deterministic object whose kind is
`issue_explanation`. It constructs a new allowlisted object containing:

- status label/detail;
- rule name/statement/result;
- source label and whether the detector was rechecked;
- queue label, explicitly workflow state rather than source truth;
- at most 12 evidence entries, each assigned `evidence_1`, `evidence_2`, etc.;
- at most 12 ambiguity items and 12 `notChecked` statements;
- the deterministic next-step label.

All strings and lists are bounded. It omits timestamps, raw records and stable
student/provider identifiers. It rejects known email, phone, URL and common
provider-ID patterns before the provider call. This is defence in depth after
the assistant context projection; it is not permission to pass arbitrary raw
text into this function.

Names are not safely removable with a simple regex. Future features that use
messages, Practice Chat prose or other free text need their own explicit
redaction and retention decision. Do not assume this issue-specific projection
is adequate for a tutor summary or communication draft.

## Output Contract And Validation

The model must return exactly:

```json
{
  "headline": "maximum 90 characters",
  "explanation": "maximum 360 characters",
  "whatToCheck": "maximum 240 characters",
  "caveat": "maximum 220 characters; required when context is incomplete",
  "evidenceRefs": ["evidence_1"]
}
```

After parsing the structured response, the server checks:

- exact keys and string/array types;
- at least one allowed evidence reference when evidence exists;
- no duplicate, unknown or more than six evidence references;
- a caveat whenever ambiguity or `notChecked` exists;
- no direct identifier patterns;
- no first-person claim that a consequential action was completed or promised.

Safe overlong wording is shortened deterministically at a word boundary. The
complete, unshortened model text is checked for prohibited content first, so an
identifier or action claim cannot be hidden after the display limit.

Invalid output is never rendered. There is no "best effort" fallback to raw
model text; the UI keeps the deterministic explanation and reports that the AI
pilot is unavailable.

## Configuration, Key Scope And Cost Controls

Production variables belong only on the canonical admin Railway service:

| Variable | Required value/purpose |
| --- | --- |
| `ADMIN_AI_ISSUE_BRIEFING_ENABLED` | `true` enables the button; `false` is the immediate kill switch |
| `ADMIN_AI_OPENAI_API_KEY` | Dedicated server-side OpenAI project key |
| `ADMIN_AI_OPENAI_MODEL` | Optional; defaults to `gpt-5.6-luna` |

Use a separate OpenAI project for the admin AI pilot. The key should be
**Restricted**, with **Responses Write** and every other endpoint set to
**None**. Model availability and provider rate limits are configured separately
in the OpenAI project's Limits page. Never reuse the historically exposed
Practice Chat relay key, prefix this key with `NEXT_PUBLIC_`, put it in local
fixtures, or return it from a route.

Cost is usage-based. One click makes one request and consumes input/output
tokens; idle configuration has no model usage. Current code records returned
input, output and total token counts. Practical controls are:

- explicit-click invocation only;
- 500 output-token ceiling;
- five-second timeout and no retry;
- 10 requests/minute/admin application limit;
- dedicated project/key, prepaid credit and provider project limits;
- feature flag as an immediate stop.

The application rate limiter is process-local. It resets on deploy/restart and
is not shared across Railway replicas, so it is not a hard spending cap.
Provider project budgets may also be alerts rather than hard stops. Prepaid
credit with tightly controlled recharge is the stronger practical boundary.

## Provider Data Handling

`store: false` avoids using the Responses API's persisted application-state
path for later response retrieval. It does **not** mean that OpenAI retains
nothing. Under the default API data controls documented when this file was
verified:

- API data is not used to train models unless the organisation opts in;
- abuse-monitoring logs may contain prompt/response content and are retained
  for up to 30 days by default;
- Zero Data Retention or Modified Abuse Monitoring require separate provider
  approval/configuration and are not assumed for this project.

The app therefore sends only minimum, redacted operational evidence even with
`store: false`. A future feature must not increase the personal-data class on
the assumption that this flag provides zero retention. UK/EU data residency is
also not claimed by the current global `api.openai.com` endpoint; assess and
configure residency explicitly if a future use requires it.

## Logging And Evaluation Evidence

Successful calls write one JSON runtime event:

```text
event=admin_ai_issue_briefing
requestId, source, issueType, model, promptVersion, schemaVersion,
latencyMs, usage={inputTokens, outputTokens, totalTokens}, outcome=validated
```

Failures log the same event name with the opaque request ID, safe error code and
validation error enums. They do not log the upstream provider body, prompt,
model output, student ID or context. Feedback logs `requestId`, fixed rating and
reason enums, and timestamp.

These are Railway runtime logs, not a durable evaluation database. Railway log
retention and access are an operational setting, not defined by this repository.
The feedback UUID is not currently bound to the generating admin/request
server-side, so the signal is suitable for a small pilot but not a tamper-proof
product metric. Before a larger evaluation, define retention, access, sampling
and a de-identified export process rather than adding prompts or outputs to logs.

Pilot review should compare the generated briefing with the deterministic
evidence and separately score:

- clearer or no added value;
- incorrect or unsupported claims;
- lost uncertainty;
- confusing wording;
- privacy/safeguarding leakage;
- latency, failures and actual token cost.

## Failure Behaviour And Diagnosis

| HTTP result | Meaning | Operator response |
| --- | --- | --- |
| `400` | Invalid route/body/context input | Inspect the selected source/type contract; do not broaden accepted input |
| `401` | Not an authenticated admin | Fix admin session/auth, not the OpenAI key |
| `404` | Exact issue context not found | Treat as stale/missing issue context; refresh through the normal workflow |
| `429` | Local per-admin rate limit | Wait; do not add automatic retries |
| `500` | Unexpected application failure | Inspect safe server logs; deterministic explanation still works |
| `503` | Not configured, provider rejection/unavailability, invalid response or local validation failure | Inspect safe Railway error codes by request ID |
| `504` | Five-second provider timeout | Retry manually only if still useful |

The user-facing error is intentionally generic. Useful detail lives in safe
server metadata:

- `not_configured`: flag or key missing;
- `provider_unavailable`: network-level failure;
- `provider_error`: OpenAI returned a non-success response;
- `invalid_provider_response`: unusable provider JSON/output;
- `invalid_briefing`: local contract rejected the output, with safe validation
  enums in `validationErrors`;
- `timeout`: request exceeded five seconds.

Provider status bodies and request-log URLs are deliberately not logged because
they can contain sensitive details. A provider 403 therefore appears only as
`provider_error` in routine logs.

The first production smoke test exposed `invalid_briefing` from model wording
that did not fit the local contract. Commit `3930535` added explicit prompt
bounds and safe deterministic shortening while preserving full-text safety
checks. This is a useful example: the key and provider can be healthy while the
local output contract correctly fails closed.

## Verification And Rollback

Run after any route, provider, prompt, model, schema or validation change:

```bash
node --test tests/admin/issue-explanation-ai-contract.test.mjs
node --test tests/admin/issue-explanation-ai-route-boundary.test.mjs
node --test tests/admin/*.test.mjs
npm run hygiene:check
npm run lint
npm run build
```

The focused provider tests use a fake `fetch`; they do not spend API credit.
The route-boundary tests inspect source boundaries rather than executing the
Next.js route. There are not yet executable tests for every auth/status/rate
mapping, provider timeout/non-2xx path, or a durable production quality holdout.
Do not overstate that coverage when extending the runtime.

Manual production smoke test:

1. Open **Issues** and expand **Why does this issue exist?**.
2. Confirm the deterministic rule/evidence loads before using AI.
3. Click **Explain this simply** once.
4. Check the generated label, evidence agreement, caveat and next check.
5. Confirm no issue/workflow/provider state changed.
6. Record helpful/not-helpful feedback.
7. Check one success metadata event and token usage without inspecting/logging
   student context.
8. Test at least one recorded-only or ambiguous issue and ensure uncertainty is
   preserved.

Rollback is configuration-first: set
`ADMIN_AI_ISSUE_BRIEFING_ENABLED=false` and restart/redeploy the canonical admin
service. The deterministic explanation remains operational and no data repair
or provider reconciliation is needed. Rotate only the dedicated admin AI key if
key exposure is suspected.

## Pattern For Future AI Integrations

Do not turn this provider into a broad `askOpenAI(anything)` helper. Reuse the
pattern, not an untyped data pipe. Each new capability should have:

1. an entry and explicit approval in `AI_TOOL_CONTRACTS.md`;
2. a deterministic context service that cannot mutate state;
3. a feature-specific allowlisted projection and personal-data review;
4. a feature-specific typed output schema and local semantic validation;
5. a server-only provider call with a dedicated prompt/schema version;
6. explicit invocation, visible evidence and generated-output labelling;
7. no tools unless each narrow tool has its own contract and approval boundary;
8. deterministic validation before any proposal reaches an existing workflow;
9. human approval in the existing UI for any consequential action;
10. outcome logging by the deterministic workflow, separate from model
    telemetry;
11. representative fixtures, abstention cases and privacy tests;
12. a feature flag, bounded cost/latency and a tested fallback/rollback path.

Retrieval/RAG adds another untrusted-input boundary. Retrieved history and
documents must be allowlisted, scoped and labelled with source/freshness; their
text is data, never instructions. A future model tool should expose a narrow
approved function—not Sheets, Stripe, MMS, Gmail, shell, filesystem or arbitrary
HTTP access. The current issue pilot proves the model seam without granting any
of those capabilities.
