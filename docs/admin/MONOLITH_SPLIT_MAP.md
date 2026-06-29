# Monolith Split — Live Map

**Read this before touching any of the big admin client components.** It maps where each file's logic now lives, what's been extracted, and what's *deliberately* still inline — so you don't have to re-read 3,000-line files to orient. Concept + rationale: Obsidian `03 Architecture/Monolith Split — Why and How`.

This is a **snapshot** — update the row when you extract more (and keep it honest about line counts).

## Status by file

| Component | Lines | Extracted to (tested) | Still inline (by design / pending) | Phase |
|---|---|---|---|---|
| `components/admin/AdminIssuesPageClient.js` | ~1,300 | `lib/admin/issues-client-helpers.mjs` — issue classification, view filtering, story/what-to-do copy, hints, labels, Stripe-snapshot summary | the component + the `Select` field + the default render | 1 ✓ |
| `components/admin/AdminPlanningPageClient.js` | ~3,195 | `lib/admin/planning-client-helpers.mjs` — date/format, pause-date parsing, pause prefill-URL + confirmation message, planning classification (`getPlanningStory`/`dueChipLabel`/`isPausePlanningItem`…), student search/inference, deep-link builders, school-note classifiers/builder | **quick-capture trio** (`inferQuickCapture`/`isTutorAbsenceCaptureText`/`buildQuickCaptureItem`) — coupled to form-state consts (`EMPTY_FORM`, `QUICK_CAPTURE_DEFAULTS`, `CLIENT_TUTOR_OPTIONS`). Field components + feature components (`PlanningCard`, `QuickBrainCapture`, `DueTodayCard`, `ItemForm`…) — **Phase 2/3 pending** | 1b ✓ helpers |
| `components/admin/AdminStudentDetailClient.js` | ~1,200 | `lib/admin/student-detail-helpers.mjs` — date/lifecycle/note-status formatters, payment-expectation label + option list | the component + field components (`Field`/`Input`/`Select`/`ReadOnlyField`) | 1 ✓ helpers |
| `components/admin/AdminParentUnderstandingPageClient.js` | ~950 | `lib/admin/parent-understanding-client-helpers.mjs` — record scoring, workflow-activity/assessment detection, risk signals, status patches, queue search, next-action derivation | `hasCompleteUnderstandingAssessment`/`effectiveWorkflowStatus`/`workflowStatusLabel` (need `UNDERSTANDING_AREAS`) + `buildTemplates` (message-content consts); field/feature components | 1 ✓ helpers |
| `lib/admin/sheets.js` | ~2,470 | *(untouched)* | one low-level client + ~50 domain accessors | **Phase 4 pending** — split into `lib/admin/sheets/{students,finance,planning,issues,…}.mjs` behind a barrel re-export so all ~29 call sites stay unchanged |

## The extraction pattern (apply per file)

1. **Pure helpers → `*-client-helpers.mjs` (or `*-helpers.mjs`) + a co-located test.** Framework-free functions only.
2. **Generic field components → a shared `fields.js`** (Phase 2).
3. **Big feature components → their own files**, receiving props (Phase 3) — this is what turns the page client into a thin orchestrator.
4. `'use client'` boundary: anything with hooks/JSX → `.js` client file; pure functions → `.mjs` (importable by server *and* tests).

### Discipline that keeps it clean
- **Module-internal helpers stay unexported**; the component imports only what it *uses directly*. Run `npx next lint --file <component>` after each move — it flags imports the component doesn't use (those were module-internal); trim them. (Lint won't catch a *missing* import — only the build does, so build every step.)
- **Deliberate stopping lines:** helpers tightly coupled to component-state/UI-config consts (form defaults, UI option lists, message content) **stay in the component**. Extracting them would drag UI config into a "helpers" module — the wrong abstraction. Better a smaller, honest module than a leaky one.
- **One extraction per commit, green between each.** Never let two unverified extractions ride on one state.

### Verify every step
```bash
npm run test:admin   # pure-helper extractions should RAISE the count (that's the point)
npm run build        # the real check for missing/duplicate symbols — stop the dev server first
npx next lint --file <changed files>
```
Baseline at the start of the split: **382 tests**. As of the last extraction: **428**.

## Why (one line)
A 3,000-line file can't be held in context; you load the whole thing to change one card. Focused modules mean you load only what you touch — cheaper, safer edits — and the trapped pure logic (date parsing, classification, scoring) finally gets unit tests. Full rationale: the Obsidian note.
