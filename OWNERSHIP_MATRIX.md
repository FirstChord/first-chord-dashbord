# FirstChord Admin Ownership Matrix

This document defines which layer currently owns each major action and field in the admin system.

Use it to reduce drift when implementing new features, resolving issues, or handing work between agents.

## Core Rule

- Many read surfaces, one admin write path.
- Google Sheets owns core operational student data.
- `students-registry.js` owns portal-specific configuration.
- MMS owns student status, billing profiles, and calendar lesson state.
- `first-chord-brain` owns FC identity generation, reconciliation logic, and `Review_Flags` generation.
- Generated outputs should not be manually edited.

## State Labels

- `authoritative`: the source of truth for the field or action in current operation
- `derived`: generated from another canonical source and not meant to be edited directly
- `transitional split ownership`: current V1 compromise where two systems hold related truth for different purposes and deliberate alignment is required

## Action Ownership

| Action | State | Canonical owner | Write method | Admin write surface | Downstream effect | Failure mode / conflict rule | Notes |
|---|---|---|---|---|---|---|---|
| Add student | transitional split ownership | `Students` sheet + MMS + registry | onboarding workflow + external APIs | `/admin/onboard` | Creates Sheets row, registry entry, MMS activation, billing profile, first lesson | If Sheets write succeeds but later MMS steps fail, onboarding completes with warning and needs manual follow-up; this action should be prioritised for step tracking, retry logic, idempotency, and recovery rules | Current V1 onboarding flow and highest-value hardening target |
| Update student contact details | authoritative | `Students` sheet | manual dashboard edit | `/admin/students/[mmsId]` | Updates admin views and future sync consumers | If Sheets update fails, no partial registry fallback is attempted | Includes name, parent, email, phone |
| Update tutor assignment | transitional split ownership | `Students` sheet for operational truth, registry for portal truth | manual dashboard edit | `/admin/students/[mmsId]` | Resolves tutor conflicts, updates portal/admin consistency | If Sheets and registry differ, retain review flag until both are deliberately aligned | Current V1 reality is a transitional dual-write action; both lanes may need intentional updates |
| Update lesson length | authoritative | `Students` sheet | manual dashboard edit or onboarding workflow | `/admin/students/[mmsId]`, `/admin/onboard` | Affects operational lesson configuration | If MMS lesson state later differs, dashboard does not auto-reconcile | |
| Update instrument | transitional split ownership | Registry for now in admin V1 | manual dashboard edit or onboarding workflow | `/admin/students/[mmsId]`, `/admin/onboard` | Affects admin display and portal behavior | Keep current V1 behavior until field ownership is formalised further | Worth formalising further later |
| Update Soundslice URL/code | authoritative | Registry | manual dashboard edit or onboarding workflow | `/admin/students/[mmsId]`, `/admin/onboard` | Affects student portal content | If registry write fails, do not silently fall back to Sheets | Not a Sheets field |
| Update Theta username | authoritative | Registry | manual dashboard edit or onboarding workflow | `/admin/students/[mmsId]`, `/admin/onboard` | Affects portal/login context | If registry write fails, do not silently fall back to Sheets | Not a Sheets field |
| Activate student in MMS | authoritative | MMS | external API via onboarding workflow | `/admin/onboard` | Moves student from waiting to active | If activation fails, keep onboarding warning visible; do not assume later MMS steps are safe | Done via API now |
| Create billing profile | authoritative | MMS | external API via onboarding workflow | `/admin/onboard` | Enables lesson creation and billing linkage | If billing profile creation fails, lesson creation may fail; surface warning and preserve prior successful writes | Done via API now |
| Create first lesson | authoritative | MMS | external API via onboarding workflow | `/admin/onboard` | Places lesson on calendar | Best-effort in V1; onboarding can still succeed without lesson creation | Done via API now |
| Resolve tutor conflict | transitional split ownership | Sheets + registry | manual dashboard edit | `/admin/students/[mmsId]` | Removes active issue from `/admin/flags` | Issue remains active until current live state matches across both sides | Dashboard now supports both tutor lanes |
| Delete orphaned portal entry | authoritative | Registry | manual dashboard edit | `/admin/flags` | Removes `REGISTRY ONLY` issue and registry entry | Only allowed for `REGISTRY ONLY`; do not delete MMS or Sheets records here | Safe delete only; does not touch MMS |
| Regenerate FC IDs and flags | derived | `first-chord-brain` | terminal/admin script | Manual terminal step | Updates FC exports and `Review_Flags` tab | Never treat generated flags or IDs as a place for manual correction | Not browser-triggered in V1 |
| Regenerate dashboard configs | derived | Dashboard repo generation scripts | terminal/admin script | Manual terminal step | Updates derived config files and portal deployment path | Do not hand-edit derived config output to compensate for upstream errors | Not browser-triggered in V1 |

## Field Ownership

| Field | State | Canonical owner | Write method | Edited where | Derived / synced to | Failure mode / conflict rule | Notes |
|---|---|---|---|---|---|---|---|
| Student first/last name | authoritative | `Students` sheet + MMS | manual dashboard edit + onboarding workflow + external API | Student detail, onboarding | Admin views, future sync logic | If systems diverge, treat it as a sync problem to fix deliberately rather than auto-overwriting | Keep aligned across systems |
| Parent/contact name | authoritative | `Students` sheet | manual dashboard edit + onboarding workflow | Student detail, onboarding | Admin use | If missing in MMS, do not infer from unrelated fields | |
| Email | authoritative | `Students` sheet + MMS | manual dashboard edit + onboarding workflow + external API | Student detail, onboarding | Admin use, future messaging | If different across systems, prefer deliberate correction over silent sync | |
| Phone number | authoritative | `Students` sheet + MMS | manual dashboard edit + onboarding workflow + external API | Student detail, onboarding | Admin use, future WhatsApp | Messaging workflows should not assume the number is valid without explicit confidence | |
| Tutor (operational) | authoritative | `Students` sheet | manual dashboard edit + onboarding workflow | Student detail, onboarding | Admin workflows | Dashboard display should continue to prefer Sheets tutor | Current display truth |
| Tutor (portal) | transitional split ownership | Registry | manual dashboard edit | Student detail | Student portal | Keep review flag active until Sheets and registry intentionally match | Can differ temporarily until resolved |
| Lesson length | authoritative | `Students` sheet | manual dashboard edit or onboarding workflow | Student detail, onboarding | Operational workflows | If later MMS billing/lesson state differs, treat as follow-up, not auto-rewrite | |
| Instrument | transitional split ownership | Registry in current V1 admin flow | manual dashboard edit or onboarding workflow | Student detail, onboarding | Portal/admin display | Current V1 compromise; formalise later | Should be formalised explicitly later |
| `fcStudentId` | authoritative, generated | `first-chord-brain` generation logic | generated + onboarding workflow seed | Not manually editable in dashboard | Registry, FC exports, FC tabs | Never recompute in UI for existing records; always read persisted value | UI reads persisted value only |
| `friendlyUrl` | authoritative | Registry | onboarding workflow, future manual dashboard edit if allowed | Onboarding, future admin editing if allowed | Student portal route | Must remain unique; collisions should be resolved intentionally | Portal-specific |
| `soundsliceUrl` | authoritative | Registry | manual dashboard edit or onboarding workflow | Student detail, onboarding | Student portal | If absent, portal can still exist but follow-up may be needed | |
| `thetaUsername` | authoritative | Registry | manual dashboard edit or onboarding workflow | Student detail, onboarding | Student portal | If absent or changed, do not infer from unrelated values after first save | |
| MMS status | authoritative | MMS | external API | Onboarding, future admin action | Waiting vs active workflows | If activation fails, keep student in follow-up state rather than pretending they are live | |
| Billing profile | authoritative | MMS | external API | Onboarding, future billing actions | Lesson creation | If billing profile is missing, lesson creation may fail and should surface clearly | |
| First lesson event | authoritative | MMS | external API | Onboarding | Calendar | Best-effort in V1; absence should surface as follow-up, not silent success | |
| Stripe customer/subscription IDs | authoritative | `Students` sheet currently | external system + trusted workflow only | Not exposed for editing in admin V1 | Payment workflows | Do not edit directly in V1 dashboard; any future repair path should be an explicit narrow admin tool | Keep tightly controlled |
| Review flags | derived | `first-chord-brain` generated into Sheets `Review_Flags` | generated by terminal/admin script | Not manually edited | `/admin/flags` | Resolve the underlying live mismatch; do not edit the generated flag row | Dashboard filters resolved issues live |

## Current V1 Boundaries

- Do not edit generated dashboard config files manually.
- Do not generate or recompute FC IDs in the UI except through the existing onboarding flow where already implemented.
- Do not delete MMS records from the flags page.
- `REGISTRY ONLY` deletes are currently the only destructive issue action exposed in the dashboard.
- Post-onboarding terminal steps remain manual in V1:
  - `python3 generate_fc_ids.py` in `first-chord-brain`
  - `npm run generate-configs && git push` in this repo

## Future Direction

- Keep the admin dashboard as the main human write surface.
- Move more business rules behind `first-chord-brain` over time.
- Keep specialist tools like Payment Pause and future messaging flows on top of the same shared ownership model.
- Expand this matrix when adding:
  - payments issue detection
  - WhatsApp-triggered workflows
  - agent-assisted triage or recommendations
