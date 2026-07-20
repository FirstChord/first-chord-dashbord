---
status: canonical
audience: [human, agent]
last_verified: 2026-07-20
---
# Student paths and song assignments

This is the current architecture contract for catalogue songs, reusable paths,
tutor assignments, and the student-portal song view. Current repertoire counts,
known gaps, and ingestion work live in
[Song catalogue coverage](../../reference/song-catalogue-coverage.md).

## Live model

| Concept | Meaning | Owner |
|---|---|---|
| Song | Reusable, curated teaching item with an FC ID and one Soundslice slice reference | `lib/config/songs-catalogue.mjs` |
| Path template | Hand-curated ordered list of catalogue song IDs for an instrument/level | `lib/config/path-templates.mjs` |
| Assignment | One student's current relationship to one song | `Song_Assignments` |
| Status history | Best-effort evidence of assignment status changes | `Song_Status_Log` |
| Request | Tutor request for repertoire missing from the catalogue | `Song_Requests` |
| Outcome | Optional tutor reflection when a song is done or parked | `Song_Outcomes` |

A student's path is not a separate stored entity. It is the ordered set of that
student's assignment rows. Assigning a template copies its steps into assignments;
the tutor can then reorder, park, or add songs independently. Later edits to the
template never rewrite existing student assignments.

## Ownership and boundaries

| Data | Authority | Lane |
|---|---|---|
| Notation, recordings, slice availability | Soundslice | External truth |
| Catalogue metadata, teaching notes, tags, series, levels | Repository catalogue | Canonical, hand-curated |
| Reusable path order | Repository path templates | Canonical, hand-curated |
| Assignment status and order | Google Sheets | Workflow state, keyed upsert |
| Status/outcome history | Google Sheets | Append-only evidence |
| Student identity and live tutor assignment | MMS | External truth |
| Portal configuration and per-student Soundslice course URL | Student registry | Canonical portal config |

The catalogue is in Git because it changes at editorial pace and benefits from
reviewable diffs. Assignments are in Sheets because tutors change them live and
the volume is human-paced. Exact headers, writers, keys, and retention are in
[the state-tab contract](../data/state-tabs.md).

```text
Soundslice list export
  -> human curation
  -> repository catalogue and path templates
       -> tutor browses and assigns
       -> keyed Song_Assignments write
       -> student portal reads its own active assignments
       -> status/outcome evidence informs later curation
```

## Catalogue contract

`lib/config/songs-catalogue.mjs` is canonical and is not generated. Each entry:

- has a stable `fc_song_*` ID;
- uses declared instrument, series, level, and content-type vocabularies;
- stores only `soundslice.scorehash`, never a raw slice URL;
- derives the playable URL through `lib/songs/catalogue-helpers.mjs`;
- contains no student names or private notes because it ships in the client bundle;
- points to a slice whose secret link is enabled and verified;
- has a MusicXML backup made through the external Soundslice toolshed before merge.

`artist: 'RSL'` is an explicit needs-curation marker for syllabus originals or
unverified attribution. Never replace it by guessing.

Per-student Soundslice courses and the shared slice catalogue are separate
surfaces. Soundslice exposes no usable course API, so this system does not create
or populate student courses. Existing course links remain available alongside
assigned songs.

## Assignment and path behaviour

`assignment_id` is deterministic: `<mms_id>_<song_id>`. Reassigning a song
upserts the same row and preserves its original assignment time, status, and
order. Status is one of:

```text
assigned | working | ready | done | parked
```

Parked rows remain as workflow history but sit outside active ordering. Reordering
normalises a student's sequence and skips parked neighbours.

Path instantiation is idempotent. Existing songs are adopted without resetting
their status or order; new steps append in template order and receive `path_id`
and `step_label`. A template is a starting sequence, not a synchronised syllabus.

Status-log writes happen after assignment writes and are best-effort. A missing
log row must never invalidate a real assignment or be treated as proof that a
transition did not happen. Outcomes are curation evidence, not a tutor scorecard
or complete ledger.

## Tutor and portal trust boundary

The public tutor dashboard still trades stronger identity for low friction. Song
reads and writes use the per-student signed tutor-surface token. The server takes
`assigned_by` or `recorded_by` from the verified token payload, never the request
body, and validates student/song/path references before writing.

That token proves access to the selected tutor/student surface; it is not durable
per-tutor authentication. Do not extend this route into consequential school,
payment, attendance, or communication actions without tutor auth.

Student portal song reads are enrichment and fail safely. A Sheets failure or a
catalogue row removed after assignment returns no affected songs rather than
breaking the portal. Parked assignments are hidden; the student's existing
Soundslice course link remains.

## Requests and learning loop

A search miss can append a `Song_Requests` row. The dashboard does not resolve
requests: the catalogue-curation workflow adds or declines them and records the
result. Duplicate human requests are acceptable evidence of demand.

Optional outcomes (`cruised`, `about_right`, `battle`, and/or a short note) and
status durations can inform termly catalogue-note and path-order changes. Use the
[parked distillation plan](../../plans/parked/song-loop-distillation.md); do not
turn raw telemetry directly into canonical teaching guidance.

## Code map

| Responsibility | Files |
|---|---|
| Catalogue and path truth | `lib/config/songs-catalogue.mjs`, `lib/config/path-templates.mjs` |
| Catalogue validation/filtering/URL derivation | `lib/songs/catalogue-helpers.mjs` |
| Assignment and path rules | `lib/songs/assignment-helpers.mjs` |
| Portal join and fail-safe read | `lib/songs/portal-songs.mjs` |
| Requests and outcomes | `lib/songs/request-helpers.mjs`, `lib/songs/outcome-helpers.mjs` |
| Sheets adapter | `lib/admin/sheets/song-assignments.mjs` |
| APIs | `app/api/song-assignments/`, `app/api/song-requests/`, `app/api/song-outcomes/` |
| Tutor and student UI | `components/tutor-dashboard/SongBrowser.js`, `components/student-portal/StudentSongs.js` |
| Focused tests | `tests/admin/songs-catalogue.test.mjs`, `song-assignment-helpers`, `portal-songs`, `song-request-helpers`, `song-outcome-helpers`, `paths-signal` |

## Change checklist

Before changing this system:

1. Confirm whether the change belongs to Soundslice truth, repository curation,
   assignment workflow state, or evidence logs.
2. Preserve the catalogue privacy test and the single URL-derivation helper.
3. Keep assignment writes token-guarded, validated, and idempotent.
4. Update `docs/architecture/data/state-tabs.md` for any header, writer, key, or
   retention change.
5. Run the matching focused song/path tests, the full admin suite, and the build.

Recommendations, a per-lesson progress log, or automated path changes remain
future work only if real use justifies them. Deterministic suggestions should
precede AI, and event-heavy history should not be added to Sheets by default.
