---
status: canonical
audience: [human, agent]
last_verified: null
---
# Admin UI Conventions

This is the lightweight UI rulebook for First Chord admin surfaces. It exists so future agents copy the calm, reliable interaction patterns instead of inventing a new button style each time.

## Principle

Admin UI should reduce cognitive load:

- show the next safe action clearly
- keep the user on the same page after actions
- make pending, success, and error states visible
- avoid dramatic language, noisy colours, and surprise navigation

## Async Actions

Any new button that triggers async work should give feedback:

- pending: disable the action and show a spinner or saving label
- success: show a short confirmation, such as `Saved` or `Done`
- error: show a visible message near the action

Use the shared primitives when practical:

- `components/admin/ui/ActionButton.js`
- `components/admin/ui/ConfirmButton.js`
- `components/admin/ui/StatusBanner.js`
- `components/admin/ui/useAsyncAction.js`

Plain raw buttons are still fine for local UI state, such as toggles, tabs, expanding sections, or selecting a filter.

## Destructive Actions

Destructive actions should use an explicit confirmation step and should not be visually louder than necessary.

Use `ConfirmButton` for new destructive admin actions unless the page already has a clearer local confirmation pattern.

## Page Refresh

Avoid `window.location.reload()` in admin and tutor-facing workflows. Prefer:

- local state updates when the API returns enough data
- `router.refresh()` when server-derived state needs re-reading
- a targeted refetch when only one panel needs updating

Full reloads lose scroll position, flash the page, and re-fetch unrelated data.

## Copy

Action labels should describe the work in plain English:

- Good: `Save progress`, `Mark parents messaged`, `Resolve absence`
- Avoid vague labels like `Submit`, `Process`, or `Execute` unless the surrounding context is obvious.

**Button language rules live in `COPY_AND_TONE.md` → Buttons** (label predicts outcome without internal state names; one completion verb per family; disabled buttons say why; pending `…` → success `✓`). This file owns the interaction mechanics; that file owns the words.

Keep helper copy short. If a line does not help Finn, Tom, or Fenella decide what to do next, it probably does not belong on the daily surface.

## Hygiene Prompt

`npm run hygiene:check` warns when new changed lines introduce:

- full-page reloads
- raw admin buttons
- direct admin API fetches

These warnings are judgement prompts, not build failures.
