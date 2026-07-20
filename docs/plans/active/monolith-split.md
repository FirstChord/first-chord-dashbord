---
status: active-plan
audience: [human, agent]
last_verified: 2026-07-20
---
# Admin Client Decomposition

## Purpose

Keep large client components as orchestration shells while moving reusable pure
rules and coherent UI features into focused modules. Use current code size and
coupling—not historical line counts—to choose the next extraction.

## Completed Structure

- Issues: rule/copy/filter helpers, issue card, fields, and slide-over extracted
- Planning: helpers, fields, feature cards/forms, and slide-over extracted
- Sheets: `lib/admin/sheets.js` is a compatibility barrel over domain adapters;
  SWR/cache policy is separately tested
- Student detail: reusable pure helpers and common fields extracted
- Parent understanding: scoring, filters, signals, and next-action helpers
  extracted

## Remaining Candidates

`AdminStudentDetailClient` and `AdminParentUnderstandingPageClient` still contain
substantial component-specific UI. Extract only when a change would otherwise
require loading or modifying an unrelated region. Keep one-use helpers that are
tightly coupled to local UI configuration inline.

## Extraction Contract

1. Move framework-free rules to `*-helpers.mjs` and add focused Node tests.
2. Move reusable client fields/shells only when there are real multiple consumers.
3. Move coherent feature components behind explicit data/handler props.
4. Keep hooks/JSX in `'use client'` `.js` modules and pure logic in `.mjs`.
5. Preserve the existing public imports; a barrel is acceptable during migration.
6. Extract one coherent concern per commit and build before continuing.

Do not extract merely to lower a line count. A thin orchestrator may still be
long if it honestly owns page state and composition.

## Verification

For each extraction, run the focused helper tests, full admin suite, lint, and a
production build. Search changed exports and remove unused imports. The build is
the contract check for missing/duplicate JSX symbols that Node helper tests
cannot cover.
