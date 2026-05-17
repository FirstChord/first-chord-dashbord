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
