# Tutor And Student Dashboard System

Last updated: 2026-06-30

## Purpose

This document covers the public tutor dashboard at `/dashboard` and the student portal pages reached through friendly URLs such as `firstchord.co.uk/alex`.

The tutor/student surface is production-critical but older than the admin dashboard. Keep changes small, preserve the teaching workflow, and reuse admin-dashboard source-of-truth patterns before adding new features.

## Current Surfaces

### Tutor dashboard

Route:

- `app/dashboard/page.js`
- `app/dashboard/page-client.js`

The tutor dashboard lets a tutor:

- choose their tutor profile
- view their current MMS roster
- view a read-only daily lesson schedule from the MMS calendar
- search students
- open recent lesson notes
- open Soundslice, Theta Music, and MMS links
- open Practice Chat in a right-side panel, with a full-page fallback

### Student portal

Routes:

- `app/[studentName]/page.js`
- `app/student/[studentId]/page.js`

The student portal lets a student/family:

- see the latest parent-visible practice note
- open Soundslice and Theta Music links
- use a friendly URL generated from the registry

## Source Of Truth Lanes

| Lane | Source | Notes |
| --- | --- | --- |
| Tutor roster | MMS | `/api/sync` and `/api/students` read live active MMS students for a tutor. |
| Tutor identity | `ADMIN_TUTORS` | `lib/admin/tutors-data.js` is generated and now feeds tutor dashboard options and MMS teacher-ID lookup. |
| Tutor daily schedule | MMS calendar | `/api/tutor-schedule` reads one tutor/date and returns read-only lesson context. |
| Portal registry | `lib/config/students-registry.js` | Human-edited registry truth; generated student URL and helper files come from it. |
| Lesson notes shown to students | `Practice_Notes_Log`, then MMS fallback | Sent/completed First Chord notes are preferred. MMS remains fallback for historical notes. |
| Soundslice links | Registry/generated mappings | Used by both tutor dashboard and student portal links. |
| Theta credentials | generated untracked config | Generated locally/build-time from registry; do not edit directly. |

## Current Data Flow

### Tutor roster

```text
tutor selects profile
  -> /api/sync
  -> mms-client-cached.getStudentsForTeacher()
  -> MMS /search/students
  -> enhanceStudentsWithSoundslice()
  -> client-side short cache
```

MMS remains the source of truth for which active students belong to a tutor. The dashboard should not try to infer current tutor rosters from the registry alone.

### Student notes

```text
student portal or tutor dashboard selects student
  -> /api/notes/[studentId]
  -> Practice_Notes_Log via getPracticeNoteLogRows()
  -> latest portal-visible sent/completed note
  -> fallback to MMS notes if no owned note exists
```

This means Practice Chat notes can become parent-visible without needing MMS as the primary read source, while older MMS notes still work.

### Tutor daily schedule

```text
tutor + date
  -> /api/tutor-schedule
  -> getMmsTutorCalendarEventsForDate()
  -> buildTutorDaySchedule()
  -> read-only list of lessons
```

The schedule panel is intentionally lightweight. It does not create, edit, cancel, or mark attendance on MMS events. It shows the tutor what is on the calendar for that day and lets them open a student already present in their roster.

The schedule rows also translate MMS attendance status into tutor-facing context:

- `Unrecorded` / blank = expected lesson
- `AbsentNotice` = absent, notice given
- `AbsentNoMakeup` = absent, no notice recorded
- `Present` / `Attended` / `Completed` = already marked present

This is read-only interpretation of MMS state, not a new attendance source. Do not infer practice-video obligations here until that workflow is designed separately.

## Important Files

| File | Purpose |
| --- | --- |
| `lib/tutor-dashboard-helpers.mjs` | Shared tutor option, teacher-ID lookup, and tutor-dashboard search helpers. |
| `lib/mms-client.js` | MMS API client; roster lookup now resolves teacher IDs from shared tutor helpers. |
| `lib/mms-client-cached.js` | Server-side short cache around MMS reads. |
| `lib/cache.js` | Client-side short cache for tutor roster results. |
| `app/api/sync/route.js` | Primary tutor roster refresh endpoint. |
| `app/api/students/route.js` | Fallback tutor roster endpoint. |
| `app/api/tutor-schedule/route.js` | Read-only tutor daily schedule endpoint. |
| `app/api/notes/[studentId]/route.js` | Notes API with First Chord log first, MMS fallback. |
| `components/navigation/QuickLinks.js` | Soundslice, Practice Chat, Theta, and MMS links. |
| `components/tutor-dashboard/TutorSchedulePanel.js` | Tutor-facing daily schedule panel. |
| `components/student-portal/StudentDashboard.js` | Student-facing portal layout. |

## Guardrails

- Do not add new live MMS reads on page load unless the value is clear and bounded.
- Prefer explicit refresh or short cache for MMS calendar/schedule reads.
- Do not write attendance, notes, or emails from the tutor dashboard without the Practice Chat pilot guardrails.
- Practice Chat may be embedded as a side panel for tutor ergonomics, but the Practice Chat app/API remains the owner of note capture and delivery.
- Do not treat copied Practice Chat notes as proof that a parent received an email.
- Do not edit generated files directly; edit the registry/source file and run `npm run generate-configs`.
- Keep `ADMIN_TUTORS` as the shared tutor identity source unless there is a clear reason to change the source model.

## Next Good Slice

Before adding larger features, keep the tutor dashboard aligned with the admin dashboard patterns:

1. Keep behaviour-preserving helper extraction small.
2. Use schedule rows to open Practice Chat with the correct student and lesson context.
3. Consider making Practice Chat a side-panel once lesson targeting is clear.
4. Keep Practice Chat Level 2 restricted until caller identity, per-tutor authorisation, and duplicate-send concurrency are hardened.

## Daily Schedule Direction

The likely schedule flow should be:

```text
tutor + date
  -> read MMS calendar events
  -> normalise to time/student/duration/status/event IDs
  -> cache briefly or refresh explicitly
  -> display as "Today's lessons"
  -> link each lesson to Practice Chat
```

MMS calendar remains the source of truth. The dashboard display is context, not a scheduling system.
