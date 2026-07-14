# Song Catalogue — Coverage and Gaps

Last updated: 2026-07-14 · **310 entries**

The single home for *what repertoire exists, what is missing, and why*. Coverage numbers
here are a snapshot; the catalogue itself (`lib/config/songs-catalogue.mjs`) is the truth.
The *why* behind decisions lives in the Obsidian Learning Log; this file records **state
and gaps**, so the next session can pick up without re-deriving any of it.

---

## The one rule that is easy to get wrong

**`artist: 'RSL'` means two different things**, and you cannot tell them apart by looking:

1. **A needs-curation marker** — we could not find a trustworthy artist.
2. **The true artist** — the piece is a *Rockschool Original*, written for the syllabus.
   It has no other artist. Nothing is missing.

The official RSL Awards syllabus pages (`rslawards.com/products/<instrument>-<grade>/`) are
the settling source: **they group cover tracks separately from Rockschool Originals.** That
is the strongest evidence channel we have found — better than the slice name, the Soundslice
`artist` field, or recording provenance. Use it first.

**Known-verified originals** (artist `'RSL'` is correct, these are NOT gaps):

| Instrument | Pieces |
|---|---|
| Bass | Noisy Neighbour, Do Balanco, Slam Dunk Funk |
| Electric Guitar | Route 66, Cashville, Helicopter, Headline Act, Just Don't Know, Overrated |

⚠️ **Piano is unverified on this point.** Piano was ingested *before* the distinction was
made explicit, so its ~26 `artist: 'RSL'` songs (Step By Step, Cinnamon Roll, Skedaddle,
Camden Square, …) are an unresolved mix of true originals and needs-curation markers. Most
are probably genuine Rock School originals, but **nobody has checked.** That is the single
biggest piece of catalogue debt. Guitar (acoustic) has zero `RSL` markers — it was fully
curated.

Technical exercises legitimately use `artist: 'RSL'` everywhere. That is never a gap.

---

## Coverage

The RSL series runs **Debut → Grade 6**. Levels are only comparable *inside* a series.

### Guitar (acoustic) — 54 entries · 114 students
| Level | Songs | Exercises |
|---|---|---|
| Debut | 9 | 2 |
| Grade 1 | 6 | 2 |
| Grade 2 | 6 | 2 |
| Grade 3 | 8 | 2 |
| Grade 4 | 5 | — |
| Grade 5 | 5 | 2 |
| Grade 6 | 5 | — |

Fully curated: **no `RSL` markers**, every artist verified.

### Electric Guitar — 60 entries · 4 students
| Level | Songs | Exercises |
|---|---|---|
| Debut | 11 | — |
| Grade 1 | 13 | 4 |
| Grade 2 | 12 | 2 |
| Grade 3 | 6 | 2 |
| Grade 4 | 4 | — |
| Grade 5 | 4 | — |
| Grade 6 | 2 | — |

### Bass — 41 entries · 6 students
| Level | Songs | Exercises |
|---|---|---|
| Debut | 1 | — |
| Grade 1 | 6 | 2 |
| Grade 2 | 6 | 1 |
| Grade 3 | 5 | 4 |
| Grade 4 | 5 | 4 |
| Grade 5 | 5 | — |
| Grade 6 | 2 | — |

### Piano — 101 RSL entries + 54 John Thompson · 58 students
| RSL Level | Songs | Exercises |
|---|---|---|
| Debut | 11 | 12 |
| Grade 1 | 20 | 17 |
| Grade 2 | 12 | 0 |
| Grade 3 | 12 | 17 |

**John Thompson** (own series, own level vocabulary): Book 1 — 23 songs · Book 2 — 30 songs + 1 exercise.

---

## Gaps

### A. Repertoire that does not exist in Soundslice (Finn must create the slice)

| Instrument | Level | Missing |
|---|---|---|
| Guitar | Grade 5 | **Songbird** |
| Guitar | Grade 6 | **More Than Words** |
| Piano | Grade 2 | **all technical exercises** — no uploads exist for this grade |

### B. Repertoire that exists but is NOT catalogued (a decision is needed first)

| What | Where | Why not ingested |
|---|---|---|
| Bass **Advanced (Grade 6–8)** | list `R1bQ7`, 9 songs (Muse, Dua Lipa, Corto Alto…) | Overlaps Grade 6 and does not split cleanly into 7 and 8 |
| Electric **Grade 7** | list `K1bQ7`, 4 songs | Above the RSL series' top level |
| Electric **Old Grade 8** | list `n1bQ7`, 1 song | Above the RSL series' top level |
| Piano **Grade 4+** | not investigated | RSL piano stops at Grade 3 in the catalogue |
| **Trinity** exam board | `NCbQ7` + sublists (electric G4, G6) | Different exam board — needs its own series, like John Thompson |
| RSL **Classical Piano Debut** | a cluster in Soundslice | Deliberately left out |

**The gate for the first three:** the RSL series stops at `Grade 6`. Adding `Grade 7` /
`Grade 8` to `SONG_SERIES` in `songs-catalogue.mjs` is a few lines and unblocks all of them.
Nobody currently on the roster obviously needs those grades, which is why it has waited.

### C. Structural gaps in Soundslice itself

- **Bass has no Debut list.** Debut currently holds exactly one song — *Green Onions*, an
  orphan slice (in no list) that names its own level. A beginner bass student has almost
  nothing to start on. **Worth building a real Bass Debut list.**
- **Electric has no Grade 4 and no Grade 6 list.** Those grades were catalogued from two
  *unlabelled* lists (`m1bQ7`, `M1bQ7`) whose contents match the official Grade 4 and
  Grade 6 syllabus track listings. That is evidence, not certainty — **worth Finn confirming.**
- **Electric Grade 2 has no 2024 sublist**, unlike Debut and Grade 1. Its four 2024 slices
  (Go Your Own Way, Do I Wanna Know?, Headline Act, Flowers) sit in **no list at all** and
  were only found by a bulk scan.
- *"Funny Faces"* (John Thompson Book 1, #10) is in no list; included on numbering evidence.

### D. Source-data errors to fix in Soundslice

Corrected in the catalogue, still wrong at source:

| Slice | Soundslice says | Should be |
|---|---|---|
| `tlSlc` | "Fell on Black **Times**" | **Fell On Black Days** (Soundgarden) |
| `dGyMc` | artist "**Alleman** Brothers" | **The Allman Brothers Band** |
| `pvWMc` | artist "**Jimmy** Hendrix" | **Jimi Hendrix** |

### E. Instruments with no repertoire at all

| Instrument | Students | Note |
|---|---|---|
| Singing | 9 | No repertoire. Listed in `INSTRUMENTS_WITHOUT_REPERTOIRE`. |
| Ukulele Orchestra | 6 | Ditto. |
| Voice | 1 | A single holdout — `Voice` and `Singing` are the same thing under two labels. Worth collapsing. |

These are **acknowledged**, not accidental: a test (`songs-catalogue.test.mjs`) fails if a
student holds an instrument that is neither seeded nor on that list. That guard exists
because the empty-shelf bug shipped three times in one day (bass, the 38 blank instruments,
then electric).

Also: **Claire McGinniss** has no instrument in the registry *or* the Sheet.

---

## Paths

`lib/config/path-templates.mjs` — **only 2 templates exist, both acoustic guitar:**

| Path | Instrument | Level | Steps |
|---|---|---|---|
| `fc_path_guitar_debut` | Guitar | Debut | 6 |
| `fc_path_guitar_grade_1` | Guitar | Grade 1 | 6 |

**Nothing for bass, electric guitar, or piano.** Now that those shelves exist, they are the
obvious next templates. Two standing decisions to respect:

- **No path templates for John Thompson's books.** A 23-step path would dump 23 songs onto a
  child's practice page at once. The numbered shelf carries the sequence instead.
- Editing a template **never** rewrites already-instantiated assignments.

Fretboard / chord paths were discussed and deliberately deferred ("hold off at the moment").

---

## How to ingest more (the pipeline, and its traps)

Toolshed: `~/Desktop/Tools:Games/FC Admin Tools/Soundslice/`

1. **Discover lists.** There is no list-all endpoint (`GET /lists/` = 405) and no folders
   endpoint (404). Bulk `GET /slices/` returns everything but leaves `lists` **empty**; only
   a *single*-slice GET populates it. That is the only way to find a list ID.
2. **Draft** with `build_catalogue_draft.py LIST_ID --instrument --level`. Drafts are
   **reviewed by a human and never auto-merged.**
3. **Enable secret links** — `enable_secret_links.py -- <hashes>`. Slices default to
   `status=1` (private); students cannot open them until `status=3`.
4. **Verify** — `verify_catalogue_links.py` (slice exists, secret link on, anonymous GET 200).

**Traps, all of which have drawn blood:**

- **macOS is case-insensitive.** `G1bQ7` and `g1bQ7` are *different lists* but the *same
  filename*. A subagent ignored this warning and reported the bass Grade 4 list as electric.
  Encode case in any filename you save.
- **`Title - Artist` is a trap.** "The Bottle - Grade 5 bass" yields `artist: 'Grade 5 bass'`
  — not unknown, *wrong*.
- **The `artist` field lies too**: real artists, grade markers posing as artists
  ("Rockschool Grade 4 bass"), contaminated values ("Daft Punk (Grade 5 Bass)"), and blanks.
  Read *both* name and field; strip syllabus noise from each; if nothing trustworthy
  survives, emit `RSL` and say so.
- **Grades are sometimes spelled as WORDS** ("Grade One Electric Guitar"). A digit-based
  stripper misses them, and the garbage then *beats* the real artist sitting in the name.
- **Only the TITLE can carry a student's name.** The half after "by" is an artist —
  "Stay With Me by Sam Smith" is not a copy made for a student called Sam.
- **Split on the LAST " by "**, not the first: "Stand By Me by Ben E. King".
- **Student practice copies live INSIDE the grade lists**, not only in "Student Versions"
  sublists — and some belong to *former* students the registry cannot see. Names also get
  jammed onto titles ("MAthildeRunning away"), defeating word-boundary matching.
- **Dedupe must prefer the copy that NAMES its artist**, or bare "Green Onions" beats
  "Green Onions by Booker T and the MG's".
- **Never guess an artist.** "Unknown" is a correct answer; a plausible wrong artist ships to
  children and is worse than a blank.
