# Data Protection Map

*Created 2026-07-19. The single home for: what personal data First Chord holds, where,
why (lawful basis), how long, and what happens when a family leaves. First Chord is the
data controller; UK GDPR applies, and most data subjects are children — which raises the
transparency bar, not the paperwork bar. Amend this file when a store or purpose
changes; `npm run retention:report` measures reality against the policies here.*

**Status: PROPOSED.** The inventory and findings are verified against the code; the
retention periods and the decisions list need Finn's sign-off. Nothing here deletes
anything today.

---

## Where personal data lives

| Store | Personal data | Whose | Lawful basis | Proposed retention |
|---|---|---|---|---|
| **Google Sheet · `Students`** | Child + parent names, emails, phones, lesson details, Stripe IDs | Families | Contract (tuition) | While enrolled → archive path below |
| **Sheet · `Practice_Notes_Log`** | Child progress notes, parent email, Gmail message ids | Children/parents | Contract (the lesson-note service) | **2 years after the student leaves**, then prune |
| **Sheet · `Incoming_Message_Inbox` + `WhatsApp_Group_Map`** | Parent/child WhatsApp message content, phone numbers, group names | Families | Legitimate interests (lesson admin) — **needs the transparency fix below** | **12 months rolling** for `handled`/`ignored` rows; open rows exempt |
| **Sheet · `Communication_Log`** | Message bodies sent to parents | Families | Contract / legitimate interests | 2 years rolling |
| **Sheet · `Parent_Understanding_State`** | Call notes and staff impressions of families | Parents | Legitimate interests | Review yearly; prune stale opinion rows — impressions age badly and are the most sensitive text we hold |
| **Sheet · `Event_Log`, `Issue_Queue`, `Planning_*`** | Student names in operational/audit rows | Families | Legitimate interests (running the school) | `Event_Log` 2 years rolling; others live with their workflow |
| **Sheet · `Students_Archive`** | Full student row snapshot at removal | Leavers | Legitimate interests (billing disputes, re-enrolment) | **2 years after `date_left`**, then prune |
| **Sheet · `Song_*` tabs** | mms_id-keyed learning telemetry, tutor names, free-text outcome notes | Children (pseudonymous), tutors | Legitimate interests (repertoire improvement) | Keep (low sensitivity, high value); never join to a tutor scoreboard (playbook rule) |
| **Sheet · `Tutor_Pay`, `Tutor_Wise`, `Tutor_Phones`, `Payroll_Runs`, `Cover_Bank_State`** | Tutor salaries, Wise recipient ids, phones, availability | Tutors | Contract (engagement) + legal obligation (tax) | **Financial rows 6 years (HMRC)**; phones/availability while engaged |
| **Railway Postgres (delivery claims)** | `delivery_key` (student id + attendance + note hash), acting tutor | Children (pseudonymous), tutors | Contract | Keep — it is the duplicate-send guard; content-free |
| **Gmail (musiclessons account)** | Every sent lesson-note email (content + parent addresses) in Sent | Families | Contract | Align with practice-notes policy; Sent folder pruning is a manual rhythm, not automated |
| **This Mac · `backups/sheets/`** | Full copy of every tab above, 8 sets ≈ 4 months rolling | Everyone | Same as sources (backup is a purpose, not a new basis) | Self-limiting (retention count 8). Off-machine copies must not outlive this window |
| **This Mac · WhatsApp bridge cache** | Recent group message cache | Families | Legitimate interests | Ephemeral by design (bridge cache); nothing to add |
| **Git · `students-registry.js`** | Child names, friendly URLs, theta usernames | Children | Contract | Lives while enrolled; removal on leave already part of the archive flow. Private repo — see decisions |
| **External processors** | MMS (lessons/contacts), Stripe (payments), Wise (tutor bank), Google (Sheets/Gmail), GitHub (code incl. registry), Railway (hosting/Postgres), Soundslice (scores; catalogue is name-guarded by test) | — | They process on our instruction | Their own DPAs; nothing school-side to prune |

**Deliberately NOT collected:** parent messages are never auto-replied; the catalogue
(public bundle) is test-enforced name-free; song telemetry carries ids, not names;
Wise `recipient_detail` bank numbers are optional and discouraged in favour of opaque ids.

## The two exposure findings (decisions, not yet changes)

1. **The tutor dashboard is open at `/dashboard`.** It shows student names and lesson
   notes, and it mints the per-student API tokens — the URL is effectively the
   credential. **Recommended fix (agreed in principle 2026-07-19): OAuth + a
   `TUTOR_ALLOWED_EMAILS` whitelist**, reusing the admin's NextAuth setup; ~90-day
   sessions so it's one login per term per lesson-room Mac profile. Per-tutor identity
   also upgrades Practice Chat's self-attested tutor to verified, and is the stated
   prerequisite for tutor-facing payroll Phase 3. Avoid a shared account: no per-person
   revocation, no identity.
2. **The student portal renders a child's lesson notes at a guessable URL**
   (`firstchord.co.uk/<firstname>`). This is a deliberate zero-friction design families
   rely on, so it's a decision, not a bug-fix: (a) accept and record the trade-off
   (notes are encouragement-toned, no contact details — verify that stays true), or
   (b) keep the page public but put the *notes panel* behind the same per-family signed
   token used elsewhere (link sent once to parents), or (c) full portal tokens. My
   recommendation is (b) — it removes the sensitive text from guessable URLs without
   breaking the bookmark habit.

## When a family leaves (the deletion path)

Today: "Mark student as left" archives the `Students` row (with `date_left`) and removes
the registry entry. **What never gets pruned today:** their practice notes, message
logs, communication log rows, and understanding-state rows. Proposed policy above gives
each a clock; `npm run retention:report` counts what is currently outside policy so the
gap is visible instead of theoretical. Actual deletion stays a human-run, per-tab
action (the report prints what and where — nothing auto-deletes).

If a parent exercises a right (access/erasure): this file is the checklist — walk the
store table top to bottom; `brain.py lookup` finds the ids; erasure exceptions are the
6-year financial rows (legal obligation) and minimal audit entries.

## Decisions Finn must make (the sign-off list)

1. Retention numbers in the table above — confirm or adjust each.
2. **Parent-facing privacy notice** — none exists. One page: what we store (including
   that lesson-group WhatsApp messages are kept for admin), why, how long, who to ask.
   This is the biggest genuine gap; everything else is housekeeping.
3. Tutor dashboard OAuth (finding 1) — when.
4. Portal notes exposure (finding 2) — pick (a)/(b)/(c).
5. Confirm both GitHub repos are private and audit who has access; the removed
   real-family fixture in git history stays per the existing no-rewrite decision.
6. Confirm FileVault is on for this Mac (backups + bridge cache live here).

---

*Maintenance: new store or new purpose → new row here, same session (same discipline as
`STATE_TABS_SCHEMA.md`). The retention report reads its policy from this table's
proposals — keep them in step.*
