---
status: canonical
audience: [human, agent]
last_verified: 2026-08-04
---
# Admin current status

This is a snapshot of active direction, recent delivery, and open choices. It is
not a changelog or a second policy manual. Use Git history for chronology, the
Obsidian Learning Log for rationale, and the focused linked document for durable
implementation rules.

## Active direction

V3 established the operating loop:

```text
Detected -> Guided -> Actioned -> Logged -> Resolved / Kept Active
```

V4 adds small, explainable context layers that reduce the cognitive cost of
running the school. The private `/admin` dashboard is the active operating
surface. The overview is a meeting start, not a complete status board: a card
earns attention only when it represents work for today, near-term action, or a
deliberate school-improvement prompt.

## Recently shipped

- **Evidence-first message intake and Practice Note song links (2026-08-04):**
  incoming classification now separates topic, intent and actionability, so a
  social mention of summer, a music-book payment, or an already-settled slot no
  longer becomes work merely because it contains a trigger word. New rows keep
  the machine proposal, confidence and evidence beside the human-final decision;
  Signals counts only explicit accepts/corrections as reviewed topic evidence.
  Converting to Planning leaves the message open until the idempotent linked plan
  has actually saved, and linked plan status is visible back on the card. A later
  school message is weak engagement evidence for only the nearest preceding open
  row, never proof of reply or blanket closure. Every readable open card keeps a
  visible Planning path. **Plan** always opens a compact preview before anything
  is written, with the proposed student and type plus editable extracted dates;
  the confirmed dates—not a hidden parser guess—feed the structured pause card.
  Bare
  role-marked ordinals such as “on the 12th … back on the 19th” resolve against
  the message date, and an explicit singular missed lesson stays one-off rather
  than becoming an extended absence merely because a return date was mentioned.
  Mobile cards now lead with student, sender and original message rather than
  classifier badges. The action row now says what happens: **Plan** and
  **Reply**, followed by compact Later, Done and More controls. Reply is now the
  one-message-at-a-time consent boundary for the bounded AI drafting pilot; it
  falls back to the editable standard template whenever drafting is disabled,
  unavailable or rejected by deterministic validation. General drafts may
  acknowledge the actual message but cannot promise operational outcomes;
  ambiguous policy evidence never reaches the model. There is no bulk or
  background drafting, and proposal evidence no longer duplicates the parent
  message. **Copy & open WhatsApp** puts the final text on the clipboard and
  opens WhatsApp's chat chooser with it prefilled. The
  human still chooses the conversation and taps Send, and the copy remains a
  Communication Log record rather than proof of sending. No-action, evidence,
  classifier detail, correction and test deletion sit behind one More
  disclosure. Later is a wake-up time on the still-open message, with separate
  Open/Later/Done views, and never masquerades as resolution. Correction
  controls and their large student list are mounted only when opened. Practice
  Notes can now carry up to
  twelve tutor-confirmed catalogue `song_id` links plus title snapshots and six
  explicitly unlisted raw titles. Both note routes reject unknown catalogue
  IDs; student history shows catalogue and unlisted evidence separately, and
  Signals aggregates linked notes plus an unlisted-repertoire review list
  without inferring sentiment. The separate Firebase PWA selector is live:
  exact note-title suggestions prioritise the
  current shelf but remain unchecked until the tutor selects them; catalogue
  search and an unlisted-title escape hatch cover everything else. The selector
  remains optional, so ignoring it preserves the previous Practice Chat flow.
  The occasional done/parked `Song_Outcomes`
  prompt remains supplementary evidence—the high-volume Practice Note stream is
  intended to become the main song-learning memory.
- **One inbox-first admin web app (2026-08-04):** the competing Planning and
  Messages manifests have been collapsed into the single **FC Messages** app,
  preserving its `/admin/incoming-messages` identity and launch target. A fresh
  home-screen install retains Inbox, Planning, and Overview in the standalone
  bottom bar. This avoids iOS choosing the old Planning start URL from two
  manifests with the same scope; icons made before this correction must be
  removed and installed again because iOS stores launch metadata at install
  time.
- **Blind Stripe foundation test (2026-08-03):** finance now locks one
  first-write-wins monthly forecast from dashboard-owned roster, price,
  expectation, schedule weekday and structured pause evidence before the Stripe
  cache job is allowed to make any provider request. A failed forecast write
  blocks the reveal rather than quietly turning it into a retrospective
  estimate. The later collection cache preserves a compact per-student invoice
  breakdown, preferring subscription identity and leaving ambiguous customer-
  only money unmatched. `/admin/finance` therefore shows both the headline net
  gap and gross student-level error: two opposite student mistakes can no longer
  cancel into a reassuring total. Existing aggregate calibration remains
  labelled legacy context; the first scored blind result appears after the
  first locked month closes. This is forecast/reconciliation only—Stripe remains
  provider truth and no payment action was added. A Playwright follow-up made
  that proof the Finance front door: Overview now contains only the Stripe
  prediction and the three real finance work links. Run-rate, break-even,
  forecasts, warnings and history remain under **Evidence**; the seasonal
  scenario planner is no longer advertised until real monthly results show that
  it is decision-useful rather than merely plausible. The Overview server path
  now reads only the forecast and collection lanes; it no longer fetches the
  roster, schedules, planning, expenses and snapshot model merely to hide them.
  The next forecast method is date-aware: a student paused when the month is
  locked stays at zero only until the end of their structured pause window, then
  their later scheduled lessons count as billable again. Missing return dates
  remain conservatively zero and stopped students never revive. The original
  August V1 row remains immutable evidence rather than being rewritten after
  this correction. Stripe collection breakdowns now retain compact paid
  day-of-month evidence so school-holiday effects can be measured later;
  council holidays are context, not an automatic revenue deduction.
- **Executable finance cron contracts (2026-08-03):** the finance snapshot and
  Stripe cache HTTP boundaries now live in framework-free handler factories
  exercised with fake providers. Tests prove missing/bad secrets cause no work,
  monthly requests reach the idempotent skip, weekly requests append, Stripe
  refreshes both caches against one fixed capture time, and provider errors
  return failure without being mistaken for success. Next route files now only
  wire those tested boundaries to the real Sheets and Stripe adapters.
- **Zero-warning maintenance feedback (2026-08-03):** all 38 accumulated lint
  warnings are resolved, including six Hook dependency warnings that could hold
  stale tutor, schedule, or inbox closures. Lint now rejects the next warning
  instead of letting background noise regrow. The unconsumed, authentication-
  free Google Sheets fallback prototype and its credential-printing test script
  are removed, Next.js production tracing is pinned to this repository, and
  grouped weekly dependency updates cover both the root app and the separately
  installed WhatsApp bridge.
- **Abandoned Practice Chat claim recovery (2026-08-03):** a request that
  crashed after claiming a delivery could leave the PostgreSQL row `claimed`
  forever. The matching tutor retry now leaves fresh claims alone, but after a
  conservative 15-minute window atomically parks the old claim as
  `tracking_failed`, records a manual-follow-up audit/issue in Sheets, and
  returns an explicit unknown-status conflict without calling MMS or Gmail.
  Recovery therefore makes the stuck work visible without turning uncertainty
  into a duplicate attendance update or parent email.
- **Concurrent write collision reduction (2026-08-03):** `Students` mutations
  now bypass the Sheets read cache before resolving an MMS ID. Normal student
  edits send only the specifically changed cells instead of rewriting every
  field in the row, payment-expectation batches locate their targets from a
  fresh read, and archive/delete re-locates the student after the archive append
  before deleting a row. Sheets is still last-write-wins rather than
  transactional, but unrelated manual/admin edits no longer get copied back
  from a stale full-row snapshot. Production registry writes now handle a
  GitHub SHA conflict by fetching the latest file and reapplying the requested
  student mutation; the previous retry paired the new SHA with stale contents
  and could silently erase the concurrent commit.
- **Production dependency and provider-liveness hardening (2026-08-03):** the
  production npm audit moved from 14 advisories (one critical, seven high) to
  zero without changing framework/auth majors. Two unused production packages
  were removed, Next 15 and NextAuth 4 moved to patched releases, compatible
  transitive fixes are pinned and build-tested, and the separately installed
  WhatsApp bridge tree is also clear. Stripe and GitHub requests now share a
  bounded 30-second abort path, so provider stalls fail explicitly instead of
  holding an admin render, registry update, or scheduled refresh indefinitely.
- **Agent readiness and finance measurement resilience (2026-08-03):** current
  source now produces one deterministic module/export/test index instead of
  freezing repository facts into model weights or a hand-maintained guide.
  Module descriptions now enter that index only through an explicit
  `@fileoverview`; ordinary comments on constants and implementation details are
  blank and cannot affect query ranking. The generated grid reports overview
  coverage so gaps can be improved deliberately without presenting heuristic
  guesses as facts. Find now states its primary scope and file-body limitation,
  and exact path/export matches elsewhere in the wider source graph appear as a
  labelled fallback with consumers/tests. Zero primary matches therefore cannot
  silently imply that a component or helper does not exist.
  Narrow search and conservative impact queries cover every Next route handler,
  and the matching route-security census exposed three obsolete scaffold routes
  that have now been removed. CI blocks map drift and unsupported export syntax;
  static evidence narrows inspection but does not prove runtime reachability.
  The same health pass traced July's missing monthly Stripe comparison to a
  workflow failure that was fixed but never retried. Monthly finance baselines
  now retry idempotently on days 1–7, Stripe collections refresh on the first as
  well as Mondays, and the overview distinguishes workflow cadence from actual
  data completeness. A genuinely missed baseline is never invented: comparison
  falls back visibly to the month's earliest weekly snapshot, then to a labelled
  current estimate.
- **Matthew tutor handover (2026-07-30):** Matthew Leung
  (`tch_zLY8Jn`, piano inferred from the confirmed student/lesson set) is now in
  the canonical Brain tutor lists, the dashboard tutor identity, and the derived
  `FC_Tutors`/`FC_Students` lanes. The five explicitly selected student records
  were aligned in one five-cell `Students.Tutor` batch plus the registry, with a
  pre-change Sheets backups and attempted/completed `Event_Log` evidence. The
  selected calendar handover is now clean on 15, 22, and 29 August: Matthew has
  exactly four intended slots covering all five students and neither outgoing
  tutor has those lessons. Matthew's `Tutor_Pay` row is explicit at £24/hour,
  weekly, active, normal route; `Tutor_Phones` holds his verified number; Wise
  remains intentionally unconfigured. The shared payroll rule now adds £2 once
  to every group slot, including his 60-minute Sophia/Athena lesson, and the
  finance assumption version records that basis change. No attendance, Stripe,
  Wise, payment-execution, or MMS write was made by the dashboard work.
  Patrick and Eléna remain **leaving**, with Matthew recorded as their
  replacement; do not retire them yet. A full outgoing-tutor audit found six
  other Patrick lessons and one Eléna/Pablo Cunningham lesson on each checked
  Saturday, plus Ezra still has an active Patrick billing profile. Those live
  MMS assignments must be ended or reassigned and re-audited before either
  tutor is hidden. The durable sequence and safe future preview contract are in
  [Tutor arrival and handover](./workflows/tutors/arrival-and-handover.md).
- **Payroll save latency (2026-07-29):** "Review and generate statement" was
  intermittently hanging on its spinner — sometimes ~1s, sometimes ~7s, with the
  work already saved by the time the browser was refreshed. The spinner was
  timing the wrong thing: a server action's `revalidatePath` rebuilds the whole
  page inside the same POST, so every button on the payroll page paid for the
  page's slowest fetch. Cold MMS attendance measured 4.7s (951 rows, 35 days, 16
  tutors) against 1.2s for the five Sheets reads beside it, and the attendance
  cache's 30-minute hard ceiling meant a normal stop-start review session
  crossed it and blocked. The payroll page now passes `allowExpired` and never
  waits on MMS: it renders whatever is cached at any age, refreshes behind the
  request, and — only when what it served is past the old ceiling — says so in
  the header summary. `↻ Refresh MMS & recalculate` remains the deliberate wait
  and is unchanged. The page also streams: the shell renders from the URL alone
  and the tutor workspace arrives behind a `Suspense` boundary (TTFB 0.15s
  against a 1.9–2.8s full render). No change to what is calculated, saved or
  paid. Contract: [state tabs → payroll attendance cache](./architecture/data/state-tabs.md).
  Shipped alongside it: **outbound request timeouts**. Neither `fetch` nor the
  Sheets client had one, so a stalled connection hung a render forever with no
  error and nothing in the logs — that, not slowness, was the true "stuck until
  I refresh" case. MMS calls now route through `mmsFetch` (readable message on
  abort, since these strings reach the admin UI verbatim) and Sheets sets
  `timeout` once on the client. Both 30s, both deliberately generous against a
  4.7s real worst case; `MMS_REQUEST_TIMEOUT_MS` tunes the MMS one without a
  deploy.
  The last two findings from that audit closed on **2026-08-01**. The statement
  now uses the same `buildPayrollAttendanceQuery` shape as the payroll page, so
  opening one off the back of that page is a cache hit — safe because
  `buildPayrollPreview` filters by teacher and period itself, verified across all
  37 real reviewed/paid runs with zero difference in lesson count, minutes or
  amount, with `attendanceQueryCoversPeriod` falling back to the narrow window if
  a hand-set period sits outside the page's. And recording attendance now folds
  the new status into the cached rows (`patchScopeStale`) rather than dropping
  them, so Present/Absent/Cancelled no longer pays a 4.7s refetch to learn a
  field the dashboard just set; patched entries are left **stale, not fresh**, so
  MMS still gets the last word on the next read, and an unpatchable row falls
  back to invalidating. Nothing about what is calculated, saved or paid changed.
  Then on **2026-08-01** the 951-rows-against-a-1000-page-size loose end closed,
  by removing the boundary rather than moving it. `fetchAllPages` decided it was
  done when a page came back short — a rule that assumes MMS honours the `limit`
  we send, so raising the page size for headroom could have made every page look
  final and truncated in silence. Probing found MMS already returns
  `TotalItemCount` on every `/search` response, so completeness is now verified
  against it and the walk throws if it holds any other number; the short-page
  rule survives only as a fallback. That makes page size a latency decision
  rather than a correctness one, so it moved to 2000
  (`PAYROLL_ATTENDANCE_PAGE_SIZE`, one home — it is part of the cache key).
  Measured: the window is 951 rows in one request; a 3,229-row window pages
  correctly in two with nothing duplicated or lost.
- **Student lifecycle and retention (2026-07-28):** the school can now answer how
  long a student has been with it, and how long the ones who left actually
  stayed. `npm run lifecycle:refresh` reads MMS attendance — which reaches back
  to 2019 and had never been read — and writes `Student_Lifecycle` (per student,
  full replace) plus one appended `Lifecycle_Snapshot` row. Dry run by default.
  It is a termly ritual that prints a report, not a dashboard surface: nothing
  reads these tabs on page load and nothing acts on them automatically.
  Two definitions carry the weight and are pinned by tests. **Departed** requires
  inactive *and* nothing booked, because inactive-with-future-lessons is a pause.
  **Cohort survival is measured at a fixed horizon**, excluding students whose
  cohort has not yet had that long — the obvious alternative, average lifetime by
  cohort, falls every year regardless of retention because recent starters cannot
  have lasted a year, and it reads as a collapse that is not happening.
  First findings: median tenure 1.52y with 62 students past three years, and
  median lifetime of leavers 0.48y.
  **Do not compare cohorts across the record-keeping change.** Calendar marking
  completeness (below) went 22% (2021) → 31% (2023) → 50% (2024) → 87% (2025):
  a step change, not a drift. Where lessons stayed on the calendar after a
  student stopped, their
  last lesson is too late and their **lifetime is overstated**, so older cohorts
  look like they survived longer than they did. That inflation is strongest in
  the years that appear best. An apparent fall in twelve-month survival from 72%
  (2022) to 43% (2025) was reported here and is **withdrawn**: the confound
  produces the trend. The rise in nought-or-one-lesson departures (~5% → ~20%)
  is compromised the same way, since inflated old lifetimes push those students
  out of the under-three-months bucket.
  Safe to use: start dates (independently confirmed by MMS `DateStarted`),
  current-roster tenure, and anything measured from 2026-07-28 forward under
  consistent record-keeping. Pre-2024 history is a decent record of when people
  started and a poor one of when they stopped. This is the argument for the
  snapshot lane: the comparable series begins with its first row, not with 2019.
  The refresh now also reports **calendar marking completeness** — the share of
  past lessons carrying a definite status, where a marked absence counts as a
  success because the goal is engagement with the calendar, not attendance
  rate. 73% (2019) → 22% (2021) → 31% (2023) → 50% (2024) → 87% (2025) → 90%
  (2026), currently 89% of 8,974 lessons over the trailing twelve months. The
  step change follows MMS attendance becoming the basis for tutor pay in 2024:
  the register got kept because money depended on it. This is the dial that
  validates the retention figures beside it, so it is stored in the same
  snapshot row — if it falls, those numbers degrade with no other signal.
  Also fixed here: students with only future lessons booked were getting a
  negative tenure and dragging the median down.
  A successful `--apply` run **books its own next review** as the single
  `planning_student_lifecycle_review` row in `Planning_Items`, reusing the
  self-renewing pattern proven by the Sheets backup, with the headline figures
  written to `Planning_Progress_Log` so the next person sees whether anything
  moved without opening the tab. Deliberately not a cron or scheduled Action:
  the value is in a human reading the report, an unattended job would fill the
  snapshot lane with noise instead of a few measurements that meant something,
  and it would need the MMS token as a CI secret for no gain. It works only
  because tenure ages a day per day, so a termly figure is never meaningfully
  stale. Retry backoff also gained jitter — five workers retrying in lockstep
  were re-triggering the same HTTP 429 and left up to 14 students unread on a
  run; now one.
- **Test-suite confidence pass (2026-07-27):** four gaps from the test-architecture
  audit are closed, and the standing policy that came out of it is below under
  *Testing policy*. The tutor-dashboard guard's decision logic moved to
  `lib/tutor-auth-contract.mjs` with the session and admin lookups injected;
  `lib/tutor-auth.js` is now a thin adapter, and behaviour is unchanged. That
  makes the guard runnable under `node --test` for the first time — previously
  the only coverage was a regex looking for its name in route source, which
  passed with the guard moved below the data fetch it was meant to gate.
  `tutor-auth-route-boundary.test.mjs` is replaced by
  `api-route-guard-census.test.mjs`, which discovers every `app/api/**/route.js`
  from disk rather than a hardcoded list, so a new unguarded route fails until
  it is classified or declared public with a reason. Also added: signature
  forgery coverage for the two token verifiers that had none, a fake Google
  Sheets client exercising the write path's row targeting and column
  arithmetic, and one composed pause-path test that runs Pause_History rows
  through all five pause modules with only the write adapters stubbed. The
  census also found `/api/token` and `app/proxy/token.js` to be unreferenced
  copies of `app/api/auth/mms/route.js`, dead since the standalone-repo split;
  both are removed and `auth/mms` remains canonical. `clientKeyFromRequest` now
  has coverage, which surfaced the unlock rate-limit question — reviewed and
  accepted as proportionate, recorded under *Deliberately not next*.
  974 tests, build green.
- **Pause-expectation Sheets quota fix (2026-07-27):** the explicit
  preview-and-confirm action on `/admin/flags` still changes only
  `Students.payment_expectation` and never Stripe, but its confirmed write path
  now batches all attempt audits, Students cells, and completion audits into
  three Sheets requests for the whole run instead of three requests per
  student. Duplicate tutor rows for one MMS ID are collapsed to one decision
  and all matching expectation cells are aligned. The Issues page now explains
  the boundary beside the button in plain English.
- **Half-onboarding prevention and recovery (2026-07-27):** onboarding now
  verifies that the production GitHub token can write the registry and can read
  its live source before any Sheets or MMS write. A `Students` row without a
  registry entry is identified as a partial canonical record and directed to
  the narrow `SHEETS ONLY` repair rather than a duplicate full onboarding run.
  If a provider fails after a write, the result records the successful and
  failed lanes accurately, renders as partially complete, and keeps Waiting and
  post-onboarding follow-ups open until the canonical record, MMS activation,
  billing profile, and first lesson are all confirmed.
- **Tutor-absence dated payment handoff (2026-07-27; classification corrected
  2026-08-03):** a new guided
  cancellation no longer treats the undated
  `Students.payment_expectation = stripe_paused_expected` flag as proof that
  the affected lesson dates were handled. The follow-up Planning card is a
  structured pause card with the payment tool first; message-only final cards
  are reserved for an explicit per-lesson “payment not needed” decision.
  Existing active message-only cards created by the old logic were parked
  without rewriting terminal history or touching Stripe, MMS, student payment
  fields, or parent messages. The original date capture remains an explicitly
  non-pause parent tracker while those student-linked cards are open; wording
  such as “linked pause cards” cannot make it display payment controls or enter
  pause forecasting. Existing unset capture rows are recognised by their tutor,
  date and no-student shape, so the correction needs no workflow-state repair.
  Two-week initial-notice cards now expose their message, copy action and
  evidence-gated completion directly in the due view; parking is named
  explicitly and never claims the notice was sent.
  The point-in-time repair evidence and repeatable regression check are in the
  [tutor-absence contract](./workflows/tutors/absence-to-pause.md).
## Current operating contracts

| Area | Current boundary |
|---|---|
| Context | Student lifecycle, schedule, payment value, and capacity summaries are derived/read-only. They do not become provider truth or authorise actions. |
| Navigation | Overview starts work; Issues handles detected problems; Workflows holds recurring processes; Planning holds due work, reflection, notes, and initiatives. Student records are reached through search and workflow links. |
| Capacity | MMS `Free` events remain source truth. Waiting-list matches are hints filtered by instrument, never reservations or automatic assignment. |
| Planning | `Planning_Items` is human work state, not a project-management or workflow engine. Friday reflection and Monday scheduling are seeded planning prompts. |
| Pauses | Generic completion never changes payment state. The guarded pause-completion action requires human confirmation, writes through the existing student route, and logs to `Event_Log`. For new guided tutor-absence cancellations, an undated paused-expected flag cannot suppress the dated structured pause card or unlock its final message; only an explicit per-lesson payment-not-needed decision takes the message-only path. |
| Messaging | Parent communication remains approval-first. `Communication_Log` means copied to send, not proven sent; inbound classifications and reply drafts remain proposals. |
| Practice Chat | All registered tutors are enabled unless temporarily constrained. The tutor self-attests, the student must have one clear tutor assignment, the final screen names the server-derived recipient, and PostgreSQL claims the delivery key before MMS/Gmail work. Ambiguous Gmail outcomes require manual follow-up. |
| Student portal notes | Profile URLs and non-note resources stay public. Practice Chat notes load through a separate no-store API; families are moved individually to memorable-code protection through the claimed admin rollout queue. A missing rollout row remains legacy-public, while an access-state failure fails closed. The memorable code is a light privacy guard proportionate to what it protects — a child's practice notes — not a defence against a determined attacker, and it is not sized to become one. |
| Finance | Sheets holds operating estimates/review state; Stripe and Wise remain provider truth. Payroll preparation does not execute Wise payment. |
| Public tutor surfaces | Low-friction tutor identity is not durable authentication. Do not add broader sensitive reads or consequential writes before tutor auth. |
| Testing | A test that reads source text and asserts a name appears is a lint rule, not coverage — it cannot show the code ran, ran in the right order, or was correct. Guards, verifiers, and write paths get executed instead: inject the impure dependency and run the real function. Source-text checks are legitimate only for architectural absence (module X must not import writer Y) and for server components with no callable handler, and must discover their targets from disk rather than a hardcoded list. Before trusting a new security or money-path test, break the thing it guards and confirm it fails. |

Canonical details live in [state ownership](./architecture/data/ownership.md),
[state tabs](./architecture/data/state-tabs.md),
[workflow design](./policies/workflow-design.md), and the focused workflow docs.

## Next choices

- **Notes access lifecycle, not notes brute force.** The realistic way practice
  notes reach the wrong person is that the code lives in the WhatsApp group
  description, so anyone ever in that group keeps access until it is reset — a
  tutor who moves on, a family who leaves. Worth deciding whether code rotation
  should be part of tutor changeover and student exit. This is a rollout and
  lifecycle question, not a cryptographic one.
- **Parent message angle for the notes rollout:** the current WhatsApp template
  is safe placeholder copy, not the final campaign wording. Agree the parent
  framing with Finn before starting real-family rollout, then update the one
  template helper and its focused assertion listed in the
  [rollout handoff](./workflows/practice-chat/student-notes-access.md).
- **Practice Chat transcription security:** the current PWA can receive the raw
  OpenAI key from the relay. Complete the staged server-side transcription
  cutover, remove `/api-key`, and rotate the exposed key in a no-lessons window.
  See [the active hardening checklist](./plans/active/practice-chat-whisper-hardening.md).
- **Cover test cleanup:** before 22 July, check MMS event `evt_zsGLw6J0` at
  14:00 and restore Tom unless Dean is genuinely covering. This is a manual MMS
  check; automation remains parked in [the cover note](./plans/parked/cover-loop.md).
- **Song placements, before the RSL 2026 songs are added.** A level is a property
  of a (song, framework) pair, not of a song: today a song has one `level` and
  one `series`, so a piece that sits at Grade 3 in the 2019 syllabus and Grade 4
  in the 2026 one cannot be expressed without duplicating its ID and splitting
  its accumulated history. Deciding the schema before the new songs go in is a
  schema choice; after, it is a migration of live data. Phased plan, invariants
  and open decisions in [song placements](./plans/active/song-placements.md).
- **Student paths:** decide whether current use justifies RSL Grade 7–8 ingestion,
  recommendation/progress work, or fretboard/chord paths. Finn must still create
  the missing Soundslice slices listed in
  [song coverage](./reference/song-catalogue-coverage.md).
- **Tutor payroll Phase 3:** scheduled statement delivery and tutor-selected
  cadence remain gated by persistent tutor auth/contact email.
- **Pause clarity:** distinguish Pause History, sheet expectation, and live Stripe
  evidence more clearly without adding Stripe mutation to Issues.
- **Tutor dashboard auth pilot:** the canonical service now has a reversible
  Google-login pilot for the shared Finn/Tom `musiclessons` account, with full
  tutor selection. The legacy `efficient-sparkle` dashboard stays public during
  the pilot, so the security transition is not complete. After usability checks,
  pilot one exact-email scoped tutor and then close/redirect the legacy route.
  See the [active pilot plan](./plans/active/tutor-dashboard-auth-pilot.md).
- **Incoming-message follow-ups:** settle retention/lawful-basis wording, capture
  the lesson group during onboarding, add removal for sibling mappings if needed,
  prune the ineffective inactivity-timestamp path, and separately review/remove
  the pre-hardening `launchagent.out.log`/`launchagent.err.log` files that may
  contain message previews. Do not assume the new bounded logger removes those
  legacy files.
- **Practice Chat operational check:** use one approved real note to verify the
  recipient, MMS attendance, Gmail ID, Sheets audit, PostgreSQL claim, and
  duplicate response after relevant delivery changes.
- **Activate Practice Note song capture in the Firebase PWA:** the desktop
  side-panel review, exact-title suggestions, catalogue search, unlisted-title
  escape hatch and handoff are built/tested in its separate repository; review,
  commit and deploy that project independently. Keep suggestions unselected and
  deterministic: titles such as *Perfect*, *Yesterday* and *Creep* make fuzzy or
  context-free matching look precise while producing false history.
- **Monolith splits:** remaining candidates and extraction discipline live in
  [the active split map](./plans/active/monolith-split.md).

## Deliberately not next

- heavy assignment, ownership, CRM, or generic workflow systems;
- WhatsApp auto-send or general automated parent messaging;
- Stripe mutations from Issues or model output;
- a database rewrite before measured Sheets limits justify one;
- direct edits to generated portal configuration files;
- hardening student-notes unlock beyond the current per-IP limit. The unlock
  rate limit buckets on the caller-supplied leftmost `x-forwarded-for`, so a
  rotating header would defeat it. Reviewed 2026-07-27 and accepted: the
  existing limit already stops the realistic case (someone typing a few
  guesses), while the bypass needs a scripted attacker deliberately targeting a
  child's practice notes. A per-student cap would close it but lets one attacker
  lock a real family out of their own notes, and correcting the header hop
  depends on Railway's proxy topology — a wrong guess buckets every visitor
  together. Both costs exceed the risk. Behaviour is pinned in
  `tests/admin/student-notes-rate-limit.test.mjs`; revisit only if the data
  behind the code stops being practice notes.

## Fragile contracts

Do not change these without updating their parser/consumer and focused tests:

- MMS sign-up labels `Preferred days` and `Preferred times`;
- the Google Sheets `Students` header row;
- MMS attendance status strings used by payroll;
- Wise CSV column order and money rounding;
- exact pause-note date labels used by pause forecasting;
- scheduled GitHub workflows, which can stop after prolonged inactivity.

Before deployment, follow [AGENTS.md](../AGENTS.md) and the
[operations runbook](./operations/runbook.md). Keep this file short: when detail
becomes durable, move it to the focused canonical document and leave only the
current decision or status here.
