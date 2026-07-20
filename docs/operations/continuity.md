---
status: supporting
audience: [human, agent]
last_verified: null
---
# Operations Continuity — the school without Finn

*Created 2026-07-19. The machine-side twin is [`DISASTER_RECOVERY.md`](./disaster-recovery.md)
(the school survives the Mac dying); this file is the people side: **the school runs for
a fortnight with Finn unreachable.** Deputies: **Tom** (money, decisions), **Fenella**
(phones, families, admin workflows — currently via the shared admin identity).
Everything here links to the doc that owns the detail; this page is the map, not the
manual.*

**Origin story:** this audit's first find was that the Friday and Monday planning
prompts had been silently dead for two weeks — parking a recurring prompt killed it
permanently (fixed 2026-07-19; parked now means "skip this occurrence"). Rhythms fail
quietly. This file exists so a person notices.

---

## If Finn is unreachable, start here

1. **Don't panic-fix anything.** Production runs itself: Railway, portals, Stripe
   billing, practice-note emails, and the crons all operate with no laptop and no Finn.
2. **Log into `/admin`** (Tom's email must be in the allow-list — see decisions).
   The Overview is the meeting-start surface: work top to bottom.
3. **Daily:** triage **Issues** (each card explains itself — the "why does this issue
   exist?" panel is written for exactly this moment) and **Workflows → Incoming
   messages** (mark handled; convert anything with dates to a planning card).
4. **Weekly:** the seeded planning prompts (Monday scheduling, Friday reflection) say
   what day it is. Follow **[`06-paying-tutors.md`](../workflows/finance/paying-tutors.md)**
   on Wednesday — it is current, complete, and safe to follow literally.
5. **When something breaks:** `DISASTER_RECOVERY.md` for data/machine incidents;
   `docs/operations/runbook.md` for per-credential "what breaks if" and recovery.
6. **When in doubt, choose the action that can wait.** Every irreversible action in
   the dashboard (payment, pause completion, batch paid) is deliberately behind an
   explicit button with a warning — nothing irreversible happens by omission.

## The fortnight, rhythm by rhythm

| Rhythm | Who | Where | Without Finn |
|---|---|---|---|
| Issues triage (daily-ish) | Fenella/Tom | `/admin` → Issues | Runs fine; resolve/ignore with the explanation panel |
| Incoming WhatsApp triage | Fenella | Workflows → Incoming | Runs fine; bridge captures automatically (if the Mac is up) |
| Pause requests | Fenella/Tom | Planning card → pause flow | Fine — the guarded **Mark pause completed** does the state writes; message copy is generated, sending stays manual |
| Monday scheduling prompt | Fenella | Planning (seeded card) | Fine |
| **Wednesday payroll** | **Tom** | Finance → Payroll + doc 06 | Review + statements: fine. **Wise upload/approval is the hard gate — see decision 1** |
| Friday reflection prompt | anyone / skip | Planning (seeded card) | Safe to park — parking now skips one week, never kills the prompt |
| Tutor absence / cover | Fenella | Planning quick-capture → per-day page | Fine — cover bank ranks candidates, "Copy ask" builds the message; MMS reassignment is a documented manual step |
| Waiting list / capacity | Fenella | Workflows → Waiting | View + notes fine; **onboarding itself pauses** (see below) |
| Fortnightly backup + census | automatic | launchd (this Mac) | Runs if the Mac is awake; a missed fortnight is acceptable |
| Monday song-request ping | automatic | launchd → notification | Safe to ignore for weeks |
| Month-end expenses | Tom | Planning card + Finance | Fine; reconciliation can also slip a month |
| Stripe amounts refresh | automatic | Monday cron (Railway) | No action |

## Only Finn can do these (today)

The honest list, with what happens in a fortnight of absence:

| Capability | Waits safely? | Notes / break-glass |
|---|---|---|
| **Approve Wise payments** | **NO — tutors must be paid** | The one genuine blocker. Decision 1 below |
| Deploys / any code change | Yes | Nothing needs deploying in a normal fortnight; the site keeps running |
| All credential rotation (Railway, Google, MMS, Stripe, GitHub) | Yes | Nothing expires on a fortnight timescale except bad luck — runbook has per-credential recovery |
| This Mac (bridge, launchd agents, backups, local tokens) | Yes | If the bridge dies, WhatsApp capture stops but nothing corrupts; catch-up is manual paste later |
| Soundslice curation / slice creation / `add-song` | Yes | Song requests queue harmlessly in `Song_Requests` |
| Onboarding new students (brain scripts + MMS + Stripe link) | Mostly | Families can be told "first lesson after the {date}"; two weeks of waiting-list delay is survivable — but see decision 4 |
| WhatsApp business number ownership | Yes | Receive-only bridge; parents' groups keep working peer-to-peer |

**What deliberately pauses rather than being attempted:** deploys, credential work,
catalogue/Soundslice curation, brain-side onboarding, bridge surgery, anything in
`AGENTS.md`'s approval-gated list. Pausing these costs days; a wrong attempt costs more.

## Decisions Finn must make (the sign-off list)

1. **Wise: a second approver or a break-glass arrangement.** Everything else in
   payroll is deputy-ready; the actual money movement is single-keyed to Finn. Wise
   business accounts support additional users/approvers — set Tom up, or document the
   agreed fallback (e.g. tutors paid one cycle late with an explanation — say which).
2. **Confirm Tom's email is in `ADMIN_ALLOWED_EMAILS`** (and decide whether Fenella
   keeps working through the shared identity until tutor/admin auth work happens —
   already flagged in `DATA_PROTECTION_MAP.md`).
3. **Fill the runbook's `FINN TO FILL IN` blanks** — each one (token sources, console
   locations, rotation procedures) is knowledge that currently exists only in your
   head; they are literally labelled continuity gaps. One session with the runbook
   open settles all of them.
4. **Onboarding cover:** decide whether Tom should be able to run `brain.py onboard`
   (needs this Mac or his own set-up per the cold-start runbook) or whether two weeks
   of waiting-list delay is the accepted answer.
5. **Password-manager emergency access** (Finn-side): most password managers support a
   trusted-contact / emergency-access arrangement; the three secret files and the
   manager itself are the real keys to everything.

---

*Maintenance: when a rhythm is added or an "only Finn" item is delegated, update the
matching row here in the same session. Termly, alongside `npm run restore:drill`: read
the "start here" list as if you were Tom, and fix what's drifted.*
