---
status: supporting
audience: [human, agent]
last_verified: 2026-07-20
---
# Tutor and student surfaces

This describes the public `/dashboard` tutor surface and student portals reached
through friendly URLs or `/student/[studentId]`. They are production-critical
but deliberately lower-friction than `/admin`; read
[the security boundary](../security/tutor-student-surfaces.md) before adding data
or writes.

## Current capabilities

Tutor dashboard:

- self-select a tutor profile and load the current MMS roster;
- view a read-only daily MMS schedule and attendance context;
- search/open students, recent notes, Soundslice, Theta, and MMS;
- browse/assign catalogue songs and paths, reorder/status assignments, request a
  missing song, and optionally record an outcome;
- open Practice Chat with student and API handoff context.

Student portal:

- show the latest parent-visible First Chord practice note, with MMS fallback;
- show active assigned songs in tutor-defined order;
- open the student's Soundslice course and optional Theta access.

## Ownership

| Concern | Authority |
|---|---|
| Live tutor roster, lesson schedule, attendance | MMS |
| Tutor option/teacher-ID configuration | generated `ADMIN_TUTORS` data |
| Portal-friendly URL and course/Theta configuration | student registry and generated outputs |
| First Chord practice-note delivery/read state | `Practice_Notes_Log` and PostgreSQL delivery claim; MMS is historical-note fallback |
| Catalogue/path teaching content | repository song catalogue and path templates |
| Student song order/status | `Song_Assignments` |

The registry's tutor field groups portal configuration; it does not override the
MMS roster. Generated files are outputs—change the registry and regenerate.

## Main flows

```text
tutor selection
  -> /api/sync or /api/students
  -> cached MMS active-student search
  -> portal/song-link enrichment
```

```text
tutor + date
  -> /api/tutor-schedule
  -> bounded MMS calendar read
  -> read-only lesson/attendance summary
```

```text
student note read
  -> Practice_Notes_Log latest sent/completed note
  -> MMS fallback when no owned note exists
```

```text
student songs
  -> token-guarded Song_Assignments
  -> join to repository catalogue
  -> hide parked/missing entries; fail safely to no song panel
```

## Trust and write boundary

Tutor selection is self-attested and remembered locally; it is not durable
identity. Per-student signed tokens guard notes/song routes and bind the selected
student/tutor context, but they do not equal authenticated tutor accounts.

Allowed public-surface writes remain narrow:

- song/path assignment workflow state and optional learning evidence;
- Practice Chat's recipient-confirmed note/attendance/email flow under its
  dedicated delivery contract.

Do not add payment, archive, broad contact, student-state, messaging, or arbitrary
MMS writes before tutor authentication. Do not treat copied/generated notes as
proof of email delivery; check delivery state and claim records.

## Code map

| Area | Main files |
|---|---|
| Tutor shell/roster | `app/dashboard/page-client.js`, `lib/tutor-dashboard-helpers.mjs`, `app/api/sync/route.js` |
| Schedule | `components/tutor-dashboard/TutorSchedulePanel.js`, `app/api/tutor-schedule/route.js` |
| Notes and Practice Chat | `app/api/notes/[studentId]/route.js`, `components/navigation/QuickLinks.js` |
| Song/path workflow | `components/tutor-dashboard/SongBrowser.js`, `app/api/song-assignments/route.js` |
| Student portal | `components/student-portal/StudentDashboard.js`, `components/student-portal/StudentSongs.js` |

Detailed contracts:

- [Practice Chat delivery](../../workflows/practice-chat/delivery.md)
- [Student paths](./student-paths.md)
- [Registry](../../reference/student-registry.md)
- [State tabs](../data/state-tabs.md)
