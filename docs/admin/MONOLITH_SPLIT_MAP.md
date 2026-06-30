# Monolith Split — Live Map

**Read this before touching any of the big admin client components.** It maps where each file's logic now lives, what's been extracted, and what's *deliberately* still inline — so you don't have to re-read 3,000-line files to orient. Concept + rationale: Obsidian `03 Architecture/Monolith Split — Why and How`.

This is a **snapshot** — update the row when you extract more (and keep it honest about line counts).

## Status by file

| Component | Lines | Extracted to (tested) | Still inline (by design / pending) | Phase |
|---|---|---|---|---|
| `components/admin/AdminIssuesPageClient.js` | ~1,300 | `lib/admin/issues-client-helpers.mjs` — issue classification, view filtering, story/what-to-do copy, hints, labels, Stripe-snapshot summary | the component + the `Select` field + the default render | 1 ✓ |
| `components/admin/AdminPlanningPageClient.js` | **1,167** (was 3,732) | `lib/admin/planning-client-helpers.mjs` — date/format, pause-date parsing, pause prefill-URL + confirmation message, planning classification (`getPlanningStory`/`dueChipLabel`/`isPausePlanningItem`…), student search/inference, deep-link builders, school-note classifiers/builder, quick-capture trio · `components/admin/planning/fields.js` — the 7 shared form fields · `components/admin/planning/` — all 6 feature components (`PlanningCard`, `QuickBrainCapture`, `DueTodayCard`, `ItemForm`, `SchoolNoteCapture`, `MondayIntentionRow`) | — now a thin orchestrator: state, handlers, layout, composition | 1b ✓ helpers · 2 ✓ fields · 3 ✓ components — **complete** |
| `components/admin/AdminStudentDetailClient.js` | ~1,200 | `lib/admin/student-detail-helpers.mjs` — date/lifecycle/note-status formatters, payment-expectation label + option list | the component + field components (`Field`/`Input`/`Select`/`ReadOnlyField`) | 1 ✓ helpers |
| `components/admin/AdminParentUnderstandingPageClient.js` | ~950 | `lib/admin/parent-understanding-client-helpers.mjs` — record scoring, workflow-activity/assessment detection, risk signals, status patches, queue search, next-action derivation | `hasCompleteUnderstandingAssessment`/`effectiveWorkflowStatus`/`workflowStatusLabel` (need `UNDERSTANDING_AREAS`) + `buildTemplates` (message-content consts); field/feature components | 1 ✓ helpers |
| `lib/admin/sheets.js` | **8** (was ~2,470) | `lib/admin/sheets/core.mjs` — low-level Google Sheets client, shared caches, managed headers, tab/header constants, generic reads/upserts · domain accessors under `lib/admin/sheets/` (`students`, `issues`, `workflows`, `planning`, `practice-notes`, `finance`, `communication`) | `sheets.js` is now only a barrel re-export; existing call sites still import `@/lib/admin/sheets` unchanged | **Phase 4 ✓ complete** |

## Planning client — target structure (the guided path)

The planning client is the deepest split. Target layout under `components/admin/planning/`:

```
components/admin/
  AdminPlanningPageClient.js   ← thin orchestrator: state, server-action handlers, layout, composition
  planning/
    fields.js                  ✓ SelectField, TextField, DateField, StudentSearchField, TextAreaField, ExpandableText, LinkPill
    PlanningCard.js            ✓ the per-item card — the big one
    DueTodayCard.js            ✓ wraps PlanningCard in compact mode
    QuickBrainCapture.js       ✓ quick-capture box (capture trio now in planning-client-helpers.mjs)
    SchoolNoteCapture.js       ✓ learning/strategic note form
    ItemForm.js                ✓ the edit form
    MondayIntentionRow.js      ✓ the Friday→Monday intention row
lib/admin/
    planning-client-helpers.mjs  ✓ pure helpers (date/pause/classification/search/links/notes)
```
Feature components receive props (data + handlers) from the orchestrator — no behaviour change. Extract one at a time, build green between each. `☐` = pending.

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
Baseline at the start of the split: **382 tests**. As of the last extraction: **433**.

## Why (one line)
A 3,000-line file can't be held in context; you load the whole thing to change one card. Focused modules mean you load only what you touch — cheaper, safer edits — and the trapped pure logic (date parsing, classification, scoring) finally gets unit tests. Full rationale: the Obsidian note.
