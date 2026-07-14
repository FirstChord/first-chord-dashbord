# Student Paths & Song Objects — Architecture Plan

Last updated: 2026-07-12. **Slices 1–7 shipped.** Slice 1: 70-song catalogue
(15 guitar + 55 piano; all secret-link verified + MusicXML cold-backed-up; 26 piano
entries carry the `artist: 'RSL'` needs-curation marker) + read-only Song Browser.
Slice 2: Assign buttons → `Song_Assignments` Sheets tab, token-guarded.
Slice 3: portal "Your Songs" (fail-safe reads; course button coexists; zero change
for students with no assignments). All e2e-verified with the registry test student
(`sdt_fBg9JN`, portal `/test`). Slice 4: ordering + status transitions (Assigned panel, PATCH, portal chips). Slice 5: ingestion toolshed scripts (`build_catalogue_draft.py` draft-never-merge + `verify_catalogue_links.py` drift check). Slices 6–7: path templates (`path-templates.mjs`, assign-path via POST pathId, adopt-not-reset) + read-only "no active song, by tutor" signal on /admin/insights. Remaining: slice 8 (recommendations/progress log — only if justified). Specs in §10;
experiment log in §11.

> **Architecture and shipped-slice record, not the live catalogue inventory.**
> Song counts and remaining ingestion gaps in the opening snapshot have moved on.
> Use `SONG_CATALOGUE_COVERAGE.md` and `CURRENT_STATUS.md` for current coverage
> and priorities; use this file for the durable path/assignment design.

Purpose: turn Soundslice material into reusable **Song objects**, organise them into
progressive **Paths**, and connect them to the student portal, tutor dashboard, and
(only where genuinely useful) the admin dashboard.

---

## 1. Current-state findings

Established by inspection, not assumption.

### The dashboard (`music-school-dashboard`)

- Next.js 15 on Railway. **No database.** Two data planes:
  - **Repo config plane:** `lib/config/students-registry.js` is the one canonical
    hand-edited file; `npm run generate-configs` derives 5 files
    (`soundslice-mappings.js`, `student-helpers.js`, `student-url-mappings.js`,
    `theta-credentials.js`, `instruments.js`). Never edit derived files.
  - **Google Sheets state plane:** dashboard-owned tabs with explicit lanes
    (truth / cache / workflow-state / append-only-log / derived-context), documented in
    `STATE_TABS_SCHEMA.md`. Keyed-upsert helpers in `lib/admin/sheets*`. Standing rule:
    human-paced, human-correctable lanes go in Sheets; event-heavy machine lanes wait
    for a future DB.
- **MMS is external truth** for students, tutors, lessons, attendance. `mms_id`
  (`sdt_XXXX`) is the universal student join key; `fcStudentId` exists on every
  registry entry; tutors are keyed by short name (`ADMIN_TUTORS`).
- **Student portal** (`/{friendlyUrl}` → `app/student/[studentId]/page.js` →
  `StudentDashboard`): unauthenticated, obscurity + `VALID_STUDENT_IDS` allowlist.
  Shows practice notes (from `Practice_Notes_Log`, MMS fallback) and `StudentLinks` —
  a **single Soundslice button** pointing at the student's personal Soundslice
  **course** URL (e.g. `/courses/16914/`), plus Theta login.
- **Tutor dashboard** (`/dashboard`): unauthenticated; tutor picked from a list and
  remembered in localStorage. Students synced from MMS via `/api/students`, enhanced
  with the Soundslice course URL from `soundslice-mappings.js`. Per-student view =
  notes panel, schedule timeline, QuickLinks (Soundslice course / MMS / Theta).
  There is **no song-level content anywhere** — the dashboard knows one course URL
  per student and nothing about what's inside it.
- **Admin** (`/admin`, next-auth + email allowlist via `middleware.js`): loop-closing
  workflows (Issue_Queue, Planning_Items, pauses, payroll…). Rich student context
  (schedule, lifecycle, payments) exists here.

### The Soundslice project (`~/Desktop/Tools:Games/FC Admin Tools/Soundslice`)

- `soundslice_api.py` — API wrapper. **Folder endpoints are dead** (Soundslice removed
  the folder API 2026-04-29); the **Lists API works**. Slice metadata writes
  (`name`/`artist`) are **unreliable** (200 but no persist) — treat those as
  read-only. However, slice **visibility writes DO persist** — see §10.
- **The API has no course endpoints at all** (verified against docs and live API,
  2026-07-12: `GET /api/v1/courses/` → 404). Per-student courses cannot be read,
  created, or populated programmatically. Anything course-side stays manual.
- **Slice secret-URL visibility is programmable** (verified live, §10):
  `POST /api/v1/slices/{scorehash}/` with `status=3` enables the public secret link
  (anonymous view flips 404 → 200); `status=1` disables it again. Your library
  slices currently all have `status=1` (not viewable logged-out).
- `export_soundslice_links.py` — working read-only exporter: walks a list tree and
  writes CSV (`position, list_id, list_path, name, artist, scorehash, soundslice_url,
  url_in_list, has_notation, recording_count, is_accessible, …`). Real export exists:
  `exports/rsl_acoustic_grades_links.csv` (169 rows, RSL Acoustic Grades, list `11bQ7`
  with per-grade sublists).
- `pathway-planning/` — a **pilot already in flight**: `grade-1-acoustic-pathway-review.csv`
  adds curation columns (`review_status` ∈ canonical / good_variant / student_version /
  duplicate / archive_candidate / needs_fix / unsure; `pathway_name`, `pathway_step`,
  `technique_focus`, `theory_focus`, `tutor_notes`, `student_facing_note`, `owner`).
  Roles agreed: Tom reviews acoustic; Fennella sense-checks piano/singing; Finn owns
  shape + dashboard conversion. Rule so far: **read-only against Soundslice**.
- `docs/SOUNDSLICE_AGENT_HANDOVER.md` — already sketches the right target model
  (slices + syllabus groups + pathways + steps + tags) and a staged write-safety
  workflow. This plan builds on it.
- `EDUCATIONAL_CONTENT_FILTERING.md` / `content_cleanup.py` — heuristics for telling
  songs from scales/exercises/theory content; useful at ingestion time.

### Two Soundslice usages that must not be conflated

1. **Per-student courses** (`/courses/NNNN/`) — the delivery surface each student
   already has; the registry's `soundsliceUrl`.
2. **School lists of slices** (`/lists/…`, slices by `scorehash`) — the raw repertoire
   library the catalogue should be built from.

The raw library is messy: student-named copies ("arnav Perfect", "Archie Redemption
Song"), duplicates, tutorial tests. **The export cannot become the catalogue
directly** — curation is a required step, and student names in slice titles must not
leak into a shared catalogue.

---

## 2. Proposed domain model

Five concepts. All deterministic; no AI anywhere in the core.

### Song (catalogue entry) — *canonical, curated*

```js
'fc_song_a1b2c3': {
  title: 'Seven Nation Army',
  artist: 'The White Stripes',
  instruments: ['Guitar'],          // registry instrument vocabulary
  level: 'Grade 1',                 // Beginner | Debut | Grade 1..Grade 4 (see §9 Q2:
                                    // RSL-shaped; 'Beginner' covers piano pre-grade
                                    // material; FC/free-choice tracks are PATHS, not levels)
  contentType: 'song',              // 'song' | 'exercise' | 'scale' | 'theory'
  tags: ['riff-based', 'power chords', 'theory: eighth notes'],
  tutorNote: 'Great first riff; watch the syncopation in the verse.',
  studentNote: 'A famous riff you can play in your first month.',
  soundslice: {                     // the ONLY Soundslice coupling, one nested ref
    scorehash: 'Yvmfc',             // stable Soundslice ID — never store raw URLs
    sourceListId: '7CbQ7',          // provenance only
  },
}
```

- `fc_song_*` is an FC-owned ID (same convention as `fc_std_*`), so a song survives
  re-uploading its Soundslice slice — only the nested ref changes.
- URLs are always **derived** from `scorehash` in one helper
  (`https://www.soundslice.com/slices/{scorehash}/`); nothing else in the system may
  build or store a Soundslice URL.

### Assignment — *workflow-state, runtime-writable*

One row: this student is working on this song. Key `assignment_id` =
`${mms_id}_${songId}` (deterministic, idempotent). Fields: `mms_id`, `song_id`,
`assigned_by` (tutor short name), `assigned_at`, `status`, `sort_order`, `path_id`
(optional), `step_label` (optional), `tutor_note_override`, `updated_at`.

### Progress — *a status on the assignment, not a new entity*

`status ∈ assigned | working | ready | done | parked`. V1 keeps it as a column with
keyed upsert (mirrors `Planning_Items` + `parked` convention). An append-only
progress log is a later addition **in the future DB, not Sheets**, if per-lesson
granularity ever proves needed.

### Path Template — *canonical, curated*

A reusable ordered sequence: `id`, `name`, `instrument`, `level`, `goal`,
`audience`, `steps: [{ order, label ('01 rhythm foundation'…), songIds: [..],
teachingFocus, theoryFocus }]`. A step can offer alternative songs; the tutor picks
one at assignment time.

### Student Path — *not a stored entity in v1*

A student's path **is** their ordered set of assignment rows (`path_id` +
`sort_order`). Instantiating a template copies steps into assignment rows; after
that the tutor reorders/replaces/removes rows freely with no link back to the
template. This is what makes per-student personalisation trivial — there is no
template-sync problem because there is no sync.

---

## 3. System boundaries and data flow

| Data | Home | Lane |
| --- | --- | --- |
| Playable content, notation, recordings | Soundslice | external truth |
| Raw list exports | Soundslice project `exports/` | cache (regenerable) |
| Curation decisions (what's canonical, tags, levels) | `pathway-planning/` CSVs → catalogue file | canonical once converted |
| **Song catalogue** | repo file `lib/config/songs-catalogue.js` | canonical, hand/script-curated |
| **Path templates** | repo file `lib/config/path-templates.js` | canonical |
| **Assignments + status** | Google Sheets tab `Song_Assignments` | workflow-state, keyed upsert |
| Student identity, tutor assignment | MMS / students-registry | external truth / canonical |
| Per-student Soundslice course URL | students-registry | canonical (unchanged) |

Why the catalogue is a **repo file, not a Sheets tab**: it follows the proven
students-registry precedent (canonical file, versioned, reviewable in git, ships with
the deploy, zero runtime reads), it changes at editorial pace, and it keeps Sheets
for what tutors/admins mutate at runtime. Assignments go to Sheets because tutors
must write them live, volume is human-paced (~200 students × a few active songs), and
the in-sheet correction path is valuable. This respects the standing
"no new event-heavy machine lanes in Sheets" rule.

Flow:

```
Soundslice Lists API
   └─ export script (read-only) → exports/*.csv
        └─ curation review (Tom/Fennella/Finn, pathway-planning CSVs)
             └─ conversion script → songs-catalogue.js (+ path-templates.js)   [canonical]
                  ├─ tutor dashboard: browse catalogue, assign → Song_Assignments (Sheets)
                  ├─ student portal: read Song_Assignments → "Your songs" list
                  └─ admin (later): read-only signals over Song_Assignments
```

**The one Soundslice write the system needs (resolved 2026-07-12, §10):** a catalogue
song is only playable by a logged-out student if its slice has the secret URL enabled
(`status=3`). Since courses have no API, the delivery mechanism for paths is:
**enable the secret link on each slice as it enters the catalogue** (a small,
verified, reversible write at curation time — not at assignment time, so assignment
stays a pure dashboard operation). The ingestion script does it, reads the value
back, and records it; the catalogue validation can later re-verify. All other
Soundslice writes (creating lists, touching courses — which is impossible anyway)
stay out of the core model.

## 4. How the existing projects connect

- The **Soundslice folder stays the ingestion toolshed** (Python, read-only exports).
  Its output lands in the dashboard repo as a proposed catalogue diff; the repo file
  is canonical after curation. No dashboard runtime dependency on Python or the
  Soundslice API.
- The **dashboard owns everything user-facing**: catalogue rendering, assignment,
  progress, portal display — reusing existing conventions (registry-style config,
  Sheets upsert helpers, `tests/admin` unit tests, `npm run test:admin` + build).
- **first-chord-brain is untouched.** Songs are not identity data. If FC song IDs
  ever need to appear in the Sheet database, that's a later, deliberate step.
- Admin dashboard coupling is deliberately thin: the only genuinely useful admin
  knowledge early on is *"which students have no active song"* and *instrument/level
  context already in the registry*. Payments, pauses, schedules add nothing to paths
  and should stay out.

## 5. Recommended sequence of vertical slices

Finn's proposed order survives contact with the architecture, with two amendments:
(a) slices 1–2 merge — a catalogue nobody can see delivers no value; (b) "grouping
into a path" splits into ordering-first (5) then templates (7), because per-student
ordering is the 90% case and templates are premature until several tutors assign
regularly.

| # | Slice | Value | Writes? |
| --- | --- | --- | --- |
| 1 | **Curated mini-catalogue + read-only Song Browser in the tutor dashboard** | Tutor picks next piece without trawling Soundslice | none |
| 2 | **Assign a song to a student** (`Song_Assignments` tab + API + button) | Assignment is recorded, visible to the tutor | Sheets |
| 3 | **Student portal "Your songs"** (read assignments, play links) | Student sees their pieces, not just one course link | none |
| 4 | **Ordering + status** (reorder, `working/ready/done/parked`) | A visible, motivating sequence = path-lite | Sheets |
| 5 | **Ingestion workflow v1**: port/re-run exporter → catalogue-draft diff → curation → regenerate | Catalogue grows beyond the pilot without hand-typing | none (local) |
| 6 | **Path templates** (`path-templates.js`, "assign path" instantiates rows) | Reuse across students; tutor personalises after instantiation | Sheets |
| 7 | **Admin signal**: read-only "students with no active song" (insights-style, not an issue type at first) | Oversight without coupling | none |
| 8 | Only if justified later: recommendations (deterministic first: same level + instrument, not yet assigned), per-lesson progress log (future DB) | — | — |

Each slice is additive and independently shippable; none modifies existing surfaces
destructively (the portal's course button and the tutor QuickLinks stay).

**Migrations & rollback:** there is no existing data to migrate — everything is new.
Rollback for any slice = remove the new component/route; the Sheets tab keeps
history harmlessly. The only ordering-sensitive dependency is that slice 2 needs
slice 1's catalogue IDs to exist.

**Timing risk (seasonal):** it is mid-summer — pause/planning edge-case season.
Slices 1 and 3 are read-only and safe anytime; the first Sheets-writing slice (2)
is small but should not land in the same week as summer-pause firefighting.

## 6. The smallest valuable first slice — in full

### User story

As a tutor viewing one of my students on `/dashboard`, I can open a "Songs" panel
showing a small curated catalogue filtered to that student's instrument — title,
artist, level, focus tags, a tutor note, and an "Open in Soundslice" link — so I can
choose the next piece during the lesson without digging through Soundslice lists.

### Scope

- `lib/config/songs-catalogue.js` — canonical catalogue file, seeded with **10–15
  real songs** hand-picked from `exports/rsl_acoustic_grades_links.csv`
  (Debut + Grade 1 acoustic; canonical versions only, no student-named copies).
  Target coverage for the catalogue overall is **guitar, bass, piano, grades 1–4**
  (plus piano pre-grade 'Beginner'); this slice seeds guitar only.
- Enable the secret URL (`status=3`) on the seed slices via the existing Python
  wrapper — one small, verified, reversible Soundslice write per slice, logged to a
  file in the Soundslice project (the §10 experiment is the template).
- `lib/songs/catalogue-helpers.mjs` — `getSongsForInstrument()`,
  `soundsliceUrlFor(song)` (the single URL-derivation point), basic validation.
- `components/tutor-dashboard/SongBrowser.js` — collapsible panel in the selected-
  student view, matching the house design language (deep green `#2F6B3D`, ScopeBadge
  "Browse only" since nothing writes yet).
- Unit tests in `tests/admin/` (existing node test runner via `npm run test:admin`).

### Out of scope

Assigning, storing anything per-student, portal changes, path/step concepts,
ingestion automation, Soundslice API calls at runtime, piano/singing repertoire
(catalogue schema supports them; seeding waits for Fennella's review).

### Data model

The Song object from §2, as a plain exported object keyed by `fc_song_*` ID.
A validation test asserts: unique IDs, unique scorehashes, required fields present,
`instruments`/`level`/`contentType` drawn from fixed vocabularies, **no student
names in titles** (checked against registry first names as a guard).

### UI changes

One new panel in `app/dashboard` selected-student view (`page-client.js` mounts
`SongBrowser` under the notes panel). Filter chips: level, contentType. Each row:
title — artist, level chip, tags, tutor note on expand, "Open" → derived slice URL
in a new tab. Panel hidden entirely when the catalogue has no songs for the
student's instrument (no empty scaffolding — subtraction pass applies from day one).

### API / integration changes

None. The catalogue ships in the bundle and is imported directly (registry
precedent). No new routes, no Sheets, no Soundslice calls.

### Acceptance criteria

1. Selecting a guitar student shows the panel with only guitar songs; a drums
   student (nothing seeded) shows no panel.
2. Every "Open" link resolves to a playable Soundslice slice **in a logged-out
   browser** (secret URLs enabled and spot-checked once, recorded in the PR).
3. No student names appear anywhere in the catalogue.
4. `npm run test:admin` and `npm run build` pass; existing dashboard behaviour
   unchanged.

### Testing approach

Unit tests for helpers + catalogue validation (vocabulary, uniqueness, name-leak
guard). Manual end-to-end via the dev server: pick tutor → pick student → browse →
open a slice. Playwright screenshot check per the existing workaround (fresh page,
clipped shots; never build while the dev server runs).

### Implementation steps

1. Pick the 10–15 seed songs from the Grade 1/Debut export with Tom's
   `review_status` marks where available; mint `fc_song_*` IDs.
2. Enable secret URLs on those slices (scripted, read-back verified, logged);
   confirm each opens anonymously.
3. Write `songs-catalogue.js` + vocabularies; write validation test.
4. Write `catalogue-helpers.mjs` + tests (URL derivation, instrument filter).
5. Build `SongBrowser`, mount in the selected-student view.
6. Manual verify + spot-check links; run test suite + build; screenshot review.
7. Docs ritual: Learning Log entry, this file's status line, GLOSSARY one-liners
   (Song object, catalogue, scorehash).

## 7. Likely files and components affected (across all slices)

- New: `lib/config/songs-catalogue.js`, `lib/config/path-templates.js` (slice 6),
  `lib/songs/*`, `components/tutor-dashboard/SongBrowser.js`,
  `components/student-portal/StudentSongs.js` (slice 3),
  `app/api/song-assignments/route.js` (slice 2),
  `lib/admin/sheets/` upsert helpers + `Song_Assignments` schema entry (slice 2),
  Soundslice project: a `build_catalogue_draft.py` conversion script (slice 5).
- Touched: `app/dashboard/page-client.js`, `components/student-portal/StudentDashboard.js`
  (slice 3), `docs/admin/STATE_TABS_SCHEMA.md` (slice 2), `GLOSSARY.md`.
- Untouched: `students-registry.js` + generated configs, MMS client, all admin loops,
  first-chord-brain, payment surfaces.

## 8. Open decisions and risks

- **Student access to slices — RESOLVED (2026-07-12, §10).** Slices are not
  anonymously viewable by default (`status=1`), but the secret URL can be enabled
  programmatically per slice and it persists. Catalogue entry = secret link enabled.
  Residual consideration: a secret-linked slice is viewable by **anyone with the
  URL** — same trust model as the student portals themselves (obscure URLs, no
  auth), so acceptable; but it means catalogue slices are effectively
  semi-public, one more reason no student data may appear in them. Also note the
  secret-URL toggle is an **undocumented-for-update** endpoint (docs only describe
  `status` at creation); the ingestion script must read back and verify after every
  write, and the periodic verify script should re-check `status=3` so a silent
  Soundslice change is caught as a curation fix.
- **Write auth on the tutor dashboard.** `/dashboard` is unauthenticated; slice 2
  adds the first tutor-initiated write. Mitigations short of full tutor auth: reuse
  the signed-token pattern (`lib/tutor-surface-token.mjs` precedent), keyed-upsert
  idempotency, `assigned_by` stamping, and Sheets as a human-correctable store. A
  malicious writer could still spoof a tutor name — acceptable for assignment data,
  but state it and decide.
- **Catalogue drift vs Soundslice.** Slices get deleted/re-uploaded; scorehashes go
  stale. Mitigation: periodic read-only verify script (slice 5) diffing catalogue
  scorehashes against the API; a stale ref is a curation fix, not a runtime error.
- **Curation stalls.** The Grade 1 review CSV is mostly unfilled. The plan works
  anyway (slice 1 hand-picks), but scale beyond ~50 songs depends on the Tom/Fennella
  review loop actually running. Keep the catalogue small rather than importing
  uncurated rows.
- **Duplicate/variant slices.** Multiple scorehashes for the same song (levels,
  arrangements). Schema keeps them as separate Song objects with `tags` like
  `level-1-arrangement`; do not attempt a "same song" grouping entity until it hurts.
- **Sheets census.** `Song_Assignments` is human-paced today; if templates make it
  grow fast, the census (fortnightly) is the migration trigger — noted in
  STATE_TABS_SCHEMA when the tab is added.
- **Privacy:** catalogue is public-ish (ships in the client bundle) → no student
  data in it, enforced by test. Assignments live in the existing private Sheet with
  mms_id + song refs only — same sensitivity class as `Schedule_Context`. Student
  portal shows only that student's own assignments (existing allowlist model).
  No new PII lanes.

## 9. Decisions (questions answered by Finn, 2026-07-12)

1. **Access model — RESOLVED by experiment (§10).** Courses are outside the API
   entirely (no read, no add). Secret-URL visibility IS programmable and persists.
   Decision: catalogue slices get their secret link enabled at curation time;
   assignment is a pure dashboard operation; per-student courses stay a manual
   tutor space, untouched by this system.
2. **Level vocabulary:** start with **guitar, bass and piano, grades 1–4**
   (RSL-shaped: Debut + Grades 1–4), plus a **'Beginner' pre-grade tier** for the
   piano material that precedes grades. **FC options and free-choice repertoire come
   later as path templates / catalogue tags, not as extra levels** — "free choice"
   describes how a path is built, not how hard a song is.
3. **Portal end-state:** coexist indefinitely for now. Replacing the Soundslice
   course button is not a goal until the paths system demonstrably holds more value
   than the course folder — revisit only then.
4. **Curation:** yes — the Grade 1 pilot with Tom's `review_status` marks gates the
   first catalogue seed.
5. **Write auth:** token-guarded-but-unauthenticated writes (the
   `tutor-surface-token.mjs` pattern) are acceptable for assignments; real per-tutor
   auth is not a prerequisite.

## 10. Implementation specs for future agents

Everything an agent needs to build the next slices without re-deriving decisions.
Read the repository `AGENTS.md` first for canonical-vs-derived, validation,
approval, and deployment-routing rules.

### Standing conventions (apply to every slice)

- **The catalogue (`lib/config/songs-catalogue.mjs`) is canonical and hand-edited** —
  it is NOT one of the 5 generated config files. Never add it to `generate-configs`.
- New shared logic goes in `.mjs` files imported with explicit extensions (repo
  convention), so `node --test` can import them without the `@/` alias — tests use
  relative paths (see `tests/admin/songs-catalogue.test.mjs`).
- Soundslice URLs are derived ONLY in `lib/songs/catalogue-helpers.mjs`. Scorehashes
  may contain dashes (`-yg8c`, `DW-yc`) — patterns must allow `[\w-]+`.
- Any slice added to the catalogue must first have its secret URL enabled + verified
  (`enable_secret_links.py`) and its MusicXML backed up
  (`backup_catalogue_musicxml.py`), both in the Soundslice toolshed
  (`~/Desktop/Tools:Games/FC Admin Tools/Soundslice`).
- `artist: 'RSL'` is the deliberate needs-curation marker for syllabus originals and
  unverified attributions — never guess a real artist to fill it.
- Verification: `npm run test:admin`, then `npm run build` (stop any dev server
  first), then drive `/dashboard` with Playwright (full-viewport screenshots hang;
  use a fresh page + clipped screenshots with `animations: 'disabled'`).
- Repo docs after every meaningful slice: update `CURRENT_STATUS.md` (add +
  prune), this file's status line, and any changed ownership/contract document.
  Obsidian learning notes and workspace handovers are optional operating memory,
  not prerequisites for a safe repository change.

### Slice 2 spec — assign a song

- **Sheets tab `Song_Assignments`** (workflow-state lane, keyed upsert):
  `assignment_id` (deterministic: `${mms_id}_${song_id}`), `mms_id`, `song_id`,
  `song_title` (denormalised for sheet readability — display only, never read back
  as truth), `assigned_by` (tutor short name), `assigned_at` (ISO), `status`
  (`assigned` initially; vocabulary in slice 4), `sort_order` (int, default append),
  `path_id` (blank until slice 6), `step_label` (blank), `tutor_note_override`,
  `updated_at`. Build with the `add-sheet-field` skill pattern: header constant →
  `buildRow` → read mapping → register in `STATE_TABS_SCHEMA.md` (lane, key, write
  pattern, writers) → tests. Reads go through the existing Sheets read cache;
  writes call `invalidateSheetReadCache` for the tab.
- **API:** `POST /api/song-assignments` (create/re-activate) — body `{ mmsId,
  songId, tutor, token }`. Guard: reuse the per-student token the dashboard already
  passes for notes access (`noteAccessToken` — see `notesUrlForStudent` in
  `app/dashboard/page-client.js`); a new signed token per the
  `lib/tutor-surface-token.mjs` pattern is also acceptable. **Do not ship the route
  unguarded.** Validate `songId` exists in the catalogue and `mmsId` in the
  registry before writing. Idempotent: re-assigning an existing pair upserts, never
  duplicates.
- **UI:** an "Assign" button per row in `SongBrowser`, showing assigned state
  (tick) for songs already assigned to the selected student. Fetch that student's
  assignments when the panel opens (`GET /api/song-assignments?student=...`,
  token-guarded, own student only).
- **DoD:** assign → row appears in the tab with correct fields; re-click doesn't
  duplicate; tests for id/row building + API validation; suite + build pass.
- **Rollback:** remove route + button; tab rows are inert history.

### Slice 3 spec — student portal "Your songs"

- Read assignments for the student inside `getStudentData`
  (`lib/student-helpers.js` is GENERATED — put the logic in a new non-generated
  module, e.g. `lib/songs/assignment-helpers.mjs`, and update
  `scripts/generate-configs.js` template only if unavoidable). Join rows to the
  catalogue by `song_id`; drop rows whose song no longer exists.
- New `components/student-portal/StudentSongs.js` rendered by `StudentDashboard`
  above/below `StudentLinks`: song title, artist, level chip, student-facing note,
  play button (derived slice URL). **The existing Soundslice course button stays.**
  Section hidden entirely when the student has no assignments.
- **DoD:** assigned song visible on that student's portal only; no assignments → no
  section; portal for students with zero registry changes renders exactly as
  before.

### Slice 5 spec — ingestion workflow (SHIPPED 2026-07-13 — see Soundslice toolshed `build_catalogue_draft.py` + `verify_catalogue_links.py`; kept for context)

Port the manual seeding done on 2026-07-12 into one repeatable script in the
Soundslice toolshed: export list → propose catalogue entries as a reviewable diff
(new file, never auto-merge) → human approves/edits → enable secret links → backup
MusicXML → paste/merge into `songs-catalogue.mjs` → tests. The API quirk to know:
bulk `GET /slices/` returns empty `lists` fields; only single-slice GETs populate
them, and there is no list-all-lists endpoint — reconstruct trees from known list
IDs (recorded in the toolshed handover doc).

### Known Soundslice source lists (as of 2026-07-12)

| List | ID | State |
| --- | --- | --- |
| RSL Acoustic Grades (parent, guitar) | `11bQ7` | messy — needs curation (student copies, duplicates) |
| Rock School Piano 2025 Debut / G1 / G2 / G3 ("Pieces") | `4TbQ7` / `NTbQ7` / `bTbQ7` / `fTbQ7` | clean exam-book lists (11/11/12/12) — seeded 2026-07-12 |
| RSL Classical Piano Grade 1 | `3sMQ7` | clean (9) — seeded 2026-07-12 |
| Rock School Piano Grade 4 | — | not uploaded to Soundslice yet |
| Electric guitar / bass grades | — | not yet located; reconstruct via slice `lists` fields |

## 11. Experiment log

**2026-07-12 — Slice visibility + course API probe** (run from the Soundslice
project with existing `.env` credentials; all reversible, final state = untouched):

- `GET /api/v1/courses/` and `GET /api/v1/courses/16914/` → **404**: courses have no
  API surface. Confirmed against the published Data API docs (endpoints exist only
  for slices, recordings, lists, notation).
- `GET /api/v1/slices/{scorehash}/` on `Yvmfc`, `q1Jfc`, `LD3Tc` → all `status: 1`,
  `embed_status: 1`; anonymous `GET soundslice.com/slices/{scorehash}/` → **404**.
  Library slices are not student-viewable today.
- `OPTIONS /api/v1/slices/Yvmfc/` → `Allow: POST,DELETE,GET` — an update endpoint
  exists even though the docs only document `status` on creation.
- On the designated test slice `q1Jfc` (per `SOUNDSLICE_AGENT_HANDOVER.md`):
  `POST /api/v1/slices/q1Jfc/` with `status=3` → 200, read-back `status: 3`,
  anonymous view **200**. Reverted with `status=1` → read-back `status: 1`,
  anonymous view **404**. **Secret-link visibility is fully programmable and
  persists**, unlike `name`/`artist` writes (which remain unreliable — unchanged
  finding).
- `POST /api/v1/slices/{scorehash}/duplicate/` exists (405 on GET) — a possible
  future mechanism if per-student slice copies are ever wanted; not needed for
  this plan.
