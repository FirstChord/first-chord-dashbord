---
status: parked
audience: [human, agent]
last_verified: 2026-07-20
---
# Song-Loop Distillation Playbook

*Written 2026-07-19, extended 2026-08-08 to cover skills. This is an executable recipe
for a future session — any capable model plus Finn's approval can run it. Run it once per
term (first run: no earlier than ~December 2026, when a term of data exists). It turns
accumulated song-loop telemetry into three durable artifacts: better `tutorNote`s, better
path orderings, and a skills layer that is First Chord's rather than a draft.*

## Inputs (all already exist)

| Source | What it holds | Read with |
|---|---|---|
| `Song_Status_Log` | every assignment status transition, timestamped | sheet tab (append-only) |
| `Song_Outcomes` | tutor one-tap verdicts (`cruised`/`about_right`/`battle`) + free-text notes at done/parked | sheet tab (append-only) |
| `Song_Assignments` | current state (for cross-checking) | `getSongAssignmentRows()` |
| Practice notes | per-lesson prose that names pieces | `Practice_Notes_Log` |
| `SONG_SKILLS` / song `tags` | what each song is currently *claimed* to teach | `lib/config/song-skills.mjs`, `skillLabelsForSong` |

### Why skills are in scope now, and what their status is

The skills layer shipped 2026-08-07, three weeks after this playbook was written, so
the original version could not mention it. Its provenance matters to this run:
**every skill tag is a draft.** Tags were written by agents — Guitar and Piano inline at
seed time, Bass and Electric Guitar on 2026-08-08 by reading each song's `tutorNote`.
No tutor has confirmed a single one, and the notes they derive from are themselves
agent-written descriptions of the well-known recording, not of the RSL arrangement a
student actually plays (see `6db4f65`). Two real errors were caught by eye the day after
tagging — `Fingerpicking` claimed on five electric guitar songs, and a subdivision
claimed for Latch that its note never mentioned.

That is the point of this run rather than a caveat about it. Skills are the substrate
for every sequencing or difficulty idea downstream, and a curriculum path built on a
vocabulary nobody at First Chord chose is not First Chord's asset.

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
4. **Draft proposals, three kinds only:**
   - **`tutorNote` amendments** — append the recurring observation to the song's note
     in `songs-catalogue.mjs` (e.g. "Most students stall on the bridge barre — isolate
     it early."). Never delete the existing musical note; extend it.
   - **Path reorderings** — if a template step consistently stalls students earlier
     steps didn't, propose moving it later (or off the template). Templates live in
     `path-templates.mjs`; edits never touch already-instantiated student paths.
   - **Skill corrections and skill vocabulary** — see below.

### Step 4c: turning drafted skills into First Chord's skills

Two different things can be wrong, and they have different evidence and different fixes.

**The tags on a song** (does this song teach what we claim?). Evidence: a tutor's
free-text outcome or practice note naming a technique that the song's chips do not
carry, or contradicting one they do — *"spent the whole time on the string crossing"*
on a song tagged only `Strumming`. Fix: amend `tags` in `songs-catalogue.mjs`. Same
n < 4 rule; same requirement that it recurred across different tutors or students.

**The vocabulary itself** (does First Chord think in these skills at all?). This is the
larger prize and the easier one to miss, because a missing skill produces no wrong
chip — it produces silence. Evidence: **words tutors keep using that `SONG_SKILLS` has
no id for.** Collect the technique vocabulary out of a term of outcome notes and
practice notes, subtract the ~50 existing skill labels and their tag synonyms, and read
what is left. Recurring residue is First Chord telling you what it teaches.

Treat additions conservatively, in both directions:

- A word is not a skill because it appeared. It is a skill when **a tutor would work on
  it separately in a lesson** — the same test used when `palm muting` was folded into
  `muting` and `chord stabs` into `staccato` + `chord_changes` rather than each getting
  an id. A vocabulary that splits every instrument's dialect destroys the transfer
  between songs that justifies the layer.
- Renaming an existing skill to a tutor's word is usually better than adding a
  near-synonym beside it.
- Skills may also be **removed**. One that no note ever names and no song needs is
  vocabulary nobody uses.

**Do not build a prose-to-skill matcher before this run.** It was considered on
2026-08-08 and deliberately deferred: a matcher written with nothing to match against is
a confident wrong thing, and this run is the first point where enough text exists to
know whether closed-vocabulary matching (the pattern already proven for song titles in
`practice-note-sync.js` — exact match, ambiguity suppressed, refusal when unsure) would
find anything. Decide it here, with the corpus in front of you.
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
- **No skill is added to make a coverage number rise.** An untagged song is an honest
  gap; a guessed tag is a wrong fact that later sequencing work will trust. Nine songs
  are deliberately untagged because nobody here has read their score.
- **Coverage is judged per instrument, never as an average.** A healthy total is exactly
  how two blank shelves stayed invisible until August 2026.

## Why this design (for the future model's context)

The telemetry lanes were built 2026-07-18 on the principle **"free data before asked
data"** — transitions cost tutors nothing, outcomes cost one tap. This playbook is the
deliberate second half: capture was made cheap *because* distillation was planned to be
rare, human-approved, and aimed at the two files every future tutor inherits. See
Learning Log: [[2026-07-18 - Song Loop Telemetry (Free Data Before Asked Data)]].
