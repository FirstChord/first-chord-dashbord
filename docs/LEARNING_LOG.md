# Learning Log

## Rule

For meaningful architectural changes, suggest a short entry for this file.

Each entry should include:

- Date
- Feature/change
- Why it exists
- Source-of-truth impact
- Files/functions involved
- What to watch out for

Do not append for tiny styling changes.

Use this alongside `docs/admin/ADMIN_IMPLEMENTATION_LOG.md`: the implementation log records what changed chronologically; this learning log captures reusable design lessons and architectural decisions.

## Entries

### 2026-06-03 — Payment Setup Pending As Work Queue

**Feature/change:** Moved ordinary `setup_pending` students out of `/admin/flags` issue generation and into the `/admin/students?paymentExpectation=setup_pending` work queue. Blank Stripe-managed rows with no Stripe customer/subscription IDs now derive as `setup_pending`. Added a narrower `SETUP PENDING STRIPE LINKED` issue for students still marked setup pending even though both Stripe linkage IDs are recorded.

**Why it exists:** `setup_pending` is usually unfinished onboarding/setup work, not a broken payment problem. Treating every setup-pending student as an issue made `/admin/flags` noisier and blurred the difference between queue work and contradictions.

**Source-of-truth impact:** The `Students` sheet remains the source of truth for `payment_mode`, `payment_expectation`, `stripe_customer_id`, and `stripe_subscription_id`. Stripe remains the source of truth for live billing. `Issue_Queue` remains workflow state, not payment truth.

**Files/functions involved:**

- `buildPaymentIssues()` in `lib/admin/issues.js`
- `classifyIssue()` and `buildPaymentIssueRecord()` in `lib/admin/issues-helpers.mjs`
- `components/admin/AdminIssuesPageClient.js`
- `app/admin/students/page.js`
- `app/admin/page.js`
- `tests/admin/issues-helpers.test.mjs`

**What to watch out for:** `SETUP PENDING STRIPE LINKED` proves the sheet has Stripe IDs, not that Stripe is actively billing. Use a live Stripe check before assuming the subscription is healthy. Old `PAYMENT SETUP PENDING` queue rows may remain visible until `/admin/flags` refreshes and marks them system-cleared.

### 2026-06-03 — Stripe Void Invoice Review

**Feature/change:** Live Stripe scans now treat a void latest invoice with a remaining balance as a payment problem when the subscription is `past_due` or `unpaid`, even if the student is currently marked `stripe_paused_expected`.

**Why it exists:** Stripe pause collection can intentionally void invoices, so void alone is not always a failure. But a `past_due` subscription with a void subscription-cycle invoice and a remaining balance is operationally risky and should not be silently suppressed by pause expectation.

**Source-of-truth impact:** Stripe remains the source of truth for live subscription and invoice state. The dashboard derives a `PAYMENT_FAILED` issue from the live Stripe snapshot; it does not write Stripe state.

**Files/functions involved:**

- `deriveStripeInvoiceSummary()` in `lib/admin/stripe-snapshot-helpers.mjs`
- `buildLiveStripeIssues()` in `lib/admin/stripe-snapshot-helpers.mjs`
- `buildLiveStripeDetail()` in `lib/admin/issues.js`
- `tests/admin/stripe-snapshot-helpers.test.mjs`

**What to watch out for:** Do not flag every void invoice during an intentional pause. The rule is deliberately narrower: void invoice with balance plus a past-due/unpaid subscription. Event IDs may not be readable with the restricted Stripe key; the dashboard should rely on subscription/latest invoice reads.

### 2026-06-03 — Reopen Resolved Issues Still Detected

**Feature/change:** Issue queue merging now reopens a `resolved` source-managed issue if the latest source scan still detects it. Source presence is also normalised from Sheets-style `TRUE/FALSE` values into lowercase internal state.

**Why it exists:** A payment issue could be detected once, marked resolved, and then disappear from the working view even though Stripe still reported the same problem. Resolved should mean fixed; if the source still sees the issue, it needs to return to open work.

**Source-of-truth impact:** `Issue_Queue` remains workflow state. Source systems such as Stripe, Sheets, MMS, and registry remain the evidence. Reopening is derived from comparing current source evidence with queue state.

**Files/functions involved:**

- `mergeIssuesWithQueueState()` in `lib/admin/issue-queue.js`
- `tests/admin/issue-queue.test.mjs`

**What to watch out for:** `ignored` issues should remain intentionally quiet. This reopen behaviour is for `resolved` issues where the source still detects the problem.

### 2026-05-18 — Explicit Waiting Capacity Refresh

**Feature/change:** Added a manual `Refresh free slots` button on `/admin/waiting` that force-refreshes MMS `Free` calendar slots and recalculates waiting-list capacity matches.

**Why it exists:** MMS free-slot data is cached to avoid repeated vendor calls, but placement work sometimes needs an immediate refresh after creating a new Free slot in MMS. The button keeps normal page loads cheap while giving admins an explicit “check now” action.

**Source-of-truth impact:** MMS remains the source of truth for real free slots. The dashboard does not reserve, assign, or write capacity records. It only refreshes cached read context and recalculates hints.

**Files/functions involved:**

- `app/admin/waiting/page.js`
- `app/api/admin/waiting/capacity/route.js`
- `components/admin/AdminWaitingPageClient.js`
- `lib/admin/waiting-capacity.js`
- `getMmsFreeCalendarSlotContext()`

**What to watch out for:** Keep this as an explicit refresh, not an automatic poll. Capacity matches are still hints only; do not turn this into slot reservation or tutor assignment without designing a proper placement workflow.

### 2026-05-17 — Learning Log Convention

**Feature/change:** Added `docs/LEARNING_LOG.md` as a lightweight place to capture architectural lessons as the dashboard evolves.

**Why it exists:** The admin dashboard is now producing reusable patterns: loop-closing, source-of-truth lanes, context layers, cached vendor reads, and action-led navigation. These lessons are useful for future FirstChord work, blog writing, and guiding other businesses through similar builds.

**Source-of-truth impact:** None. This is documentation only. It does not change operational truth, workflow state, vendor data, or generated outputs.

**Files/functions involved:**

- `docs/LEARNING_LOG.md`
- `docs/README.md`
- `docs/INDEX.md`

**What to watch out for:** Keep entries short and selective. If every UI tweak gets logged, the file will stop being useful. Add entries when a change affects architecture, source ownership, workflow shape, caching strategy, automation boundaries, or future build patterns.

### 2026-05-17 — Action-Led Admin Navigation

**Feature/change:** Top-level admin navigation was narrowed to `Overview`, `Issues`, `Workflows`, and `Planning`, with student lookup treated as a header utility rather than a primary nav mode.

**Why it exists:** V4 will add more surfaces over time. A long top menu would turn into a sitemap instead of an operating model. The new structure keeps navigation based on modes of work rather than pages.

**Source-of-truth impact:** None directly. This changes how users reach existing workflows and context views, not which system owns any data.

**Files/functions involved:**

- `app/admin/layout.js`
- `app/admin/workflows/page.js`
- `app/admin/planning/page.js`
- `app/admin/students/page.js`

**What to watch out for:** Do not add new top-level nav items casually. New tools should usually live inside `Workflows` or `Planning` unless they become a true operating mode. Student detail remains important context, but most users should arrive there through search, issue cards, or workflow cards.

### 2026-05-17 — Waiting List As Placement Decision Surface

**Feature/change:** Waiting cards now show MMS sign-up context, parsed note facts, parent/contact phone when available, full MMS note detail, and possible free-slot matches.

**Why it exists:** Waiting and onboarding were starting to blur. The cleaner boundary is: `/admin/waiting` helps decide contact and placement; `/admin/onboard` executes the multi-system onboarding once ready.

**Source-of-truth impact:** MMS remains the source of truth for waiting-list students and sign-up notes. `Waiting_List_State` remains the dashboard-owned state for waiting status and notes. No new write source was introduced.

**Files/functions involved:**

- `lib/admin/mms.js`
- `components/admin/AdminWaitingPageClient.js`
- `lib/admin/waiting-workflow.js`
- `lib/admin/capacity-helpers.mjs`

**What to watch out for:** Do not make Waiting reserve slots or assign tutors until a placement workflow is explicitly designed. Capacity matches are hints only. Keep Onboarding responsible for creating Sheets, registry, MMS lesson, billing profile, and portal setup records.
