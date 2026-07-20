---
status: parked
audience: [human, agent]
last_verified: 2026-07-20
---
# Song-Loop Distillation Playbook

*Written 2026-07-19. This is an executable recipe for a future session — any capable
model plus Finn's approval can run it. Run it once per term (first run: no earlier than
~December 2026, when a term of data exists). It turns accumulated song-loop telemetry
into two durable artifacts: better `tutorNote`s and better path orderings.*

## Inputs (all already exist)

| Source | What it holds | Read with |
|---|---|---|
| `Song_Status_Log` | every assignment status transition, timestamped | sheet tab (append-only) |
| `Song_Outcomes` | tutor one-tap verdicts (`cruised`/`about_right`/`battle`) + free-text notes at done/parked | sheet tab (append-only) |
| `Song_Assignments` | current state (for cross-checking) | `getSongAssignmentRows()` |
| Practice notes | per-lesson prose that names pieces | `Practice_Notes_Log` |

## The run, step by step

1. **Pull and join.** For each `song_id`: count assignments started, reached `done`,
   parked, still in `working`; median days in `working` (from transition timestamps);
   outcome tallies; and every free-text outcome note.
2. **Flag, don't conclude.** A song is *interesting* when it deviates from its
   grade-mates: parked ≫ shelf average, `battle` ≥ half its outcomes, median working
   time ≫ shelf median, or assigned-often-but-never-done. Small n is the norm — treat
   **n < 4 assignments as anecdote, never evidence**, and say so in the output.
3. **Mine the free text.** Recurring phrases across *different tutors/students* about
   the same song ("the barre chord", "the bridge") are the gold. One mention is noise.
4. **Draft proposals, two kinds only:**
   - **`tutorNote` amendments** — append the recurring observation to the song's note
     in `songs-catalogue.mjs` (e.g. "Most students stall on the bridge barre — isolate
     it early."). Never delete the existing musical note; extend it.
   - **Path reorderings** — if a template step consistently stalls students earlier
     steps didn't, propose moving it later (or off the template). Templates live in
     `path-templates.mjs`; edits never touch already-instantiated student paths.
5. **Present for approval.** Every proposal shows its evidence (counts + quoted notes).
   Finn approves/rejects each. **Nothing is applied unapproved** — same rule as every
   other consequential change in this workspace.
6. **Apply, test, log.** Edit the two canonical files, `npm run test:admin` +
   `npm run build`, Learning Log entry (what the data said, what was changed, what was
   deliberately NOT changed), deploy on Finn's word.

## Boundaries (as important as the steps)

- **No dashboard surface.** The output is edits to the catalogue and templates — the
  places tutors already look — not a new analytics page.
- **No tutor scoreboard.** Never aggregate or present outcomes per tutor. The data
  exists to improve repertoire, and tutors will stop tapping honestly the day it
  measures them.
- **No automated application.** The judgement step (is this signal or small-n noise?)
  is the entire value; skipping approval converts the playbook from learning into risk.
- **Notes are extended, not churned.** A tutorNote that changes every term reads as
  noise. Only promote observations that recurred across a term.

## Why this design (for the future model's context)

The telemetry lanes were built 2026-07-18 on the principle **"free data before asked
data"** — transitions cost tutors nothing, outcomes cost one tap. This playbook is the
deliberate second half: capture was made cheap *because* distillation was planned to be
rare, human-approved, and aimed at the two files every future tutor inherits. See
Learning Log: [[2026-07-18 - Song Loop Telemetry (Free Data Before Asked Data)]].
