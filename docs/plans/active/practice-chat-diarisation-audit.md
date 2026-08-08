---
status: active-plan
audience: [human, agent]
last_verified: 2026-07-24
---
# Practice Chat — Diarisation & Named Dialogue Audit

Investigated 2026-07-24 against the deployed `main` of all three repos (all
local clones verified in sync with `origin`).

> **Status update (2026-07-26):** Phase 1 (minus transcript capture) and Phase
> 4's groundwork are **shipped**. Raw transcript capture is built but
> **deliberately held** on branch `wip/practice-chat-all`, pending a retention
> number and a parent privacy-notice decision — it is the only piece that stores
> verbatim child speech. See "Progress" below. Sections 1–7 describe the system
> **as audited on 2026-07-24**: they are the record of why the work was done,
> and §1's description of the tidy-up rules and the discarded raw transcript is
> now history for the first half, still current for the second.

Findings are marked **[C]** confirmed by reading/running the code or by current
OpenAI documentation, or **[A]** assumption/inference to be tested.

---

## 1. Current architecture and transcription model

Practice Chat spans **three repos**; only the API side lives in this one.

```
Tutor dashboard (this repo)          →  builds the launch URL
  components/navigation/QuickLinks.js
        ↓  studentId, studentName, tutor, dashboardBaseUrl, practiceChatSecret
Practice Chat (repo `practicechatpwa`) →  Firebase, practice-chat-pwa.web.app
  app.js · asr-client.js · text-processor.js · practice-note-sync.js
        ↓  GET /api-key                    ↓  POST /api/practice-notes[/mms-test]
Relay (enhanced-music-lesson-notes)     Dashboard API (this repo)
  Railway, holds OPENAI_API_KEY           → MMS attendance + Gmail + Practice_Notes_Log
        ↓
  api.openai.com/v1/audio/transcriptions  (called FROM THE BROWSER)
```

**Flow, end to end** [C]:

1. Tutor clicks *Practice Chat!* on a student card. URL params carry the student
   MMS id, student name and the self-attested tutor name.
2. Three fixed questions, **one recording each** (`app.js:17-27`). MediaRecorder,
   `audio/webm;codecs=opus`, requested 16 kHz mono, `echoCancellation` and
   `noiseSuppression` on, 1 s timeslice (`asr-client.js:47-72`).
3. On stop, chunks are concatenated into one Blob and sent as a single batch call.
4. Transcript is passed straight through `enhancedCleanupSpeechText()` and the
   **cleaned** string is stored as that question's answer.
5. The three answers are assembled under `[What we did]` / `[Progress &
   Challenges]` / `[Practice Goals]` into a `contenteditable` box
   (`index.html:93`) — the tutor can edit before sending.
6. Dry-run preview picks the MMS lesson/attendance and derives the parent
   recipient server-side; tutor ticks the date and a recipient-specific
   confirmation; execute writes MMS attendance, sends the Gmail, and appends the
   `Practice_Notes_Log` row. Contract: `docs/workflows/practice-chat/delivery.md`.

**Transcription provider and model** [C]:

| | |
|---|---|
| Provider | OpenAI, called **directly from the browser** |
| Endpoint | `POST https://api.openai.com/v1/audio/transcriptions` |
| SDK | none — raw `fetch` + `FormData` (`asr-client.js:152-164`) |
| Model | **`whisper-1`** — a hard-coded string literal, `asr-client.js:154` |
| `response_format` | `json` |
| Response parsing | `result.text.trim()` — nothing else is read |
| Auth | key fetched at `GET {relay}/api-key` and used in the browser |

So: **legacy Whisper, not a newer transcription model.** The model is
**explicitly pinned** — `whisper-1` is a frozen snapshot alias that does not
auto-update, so nothing changes underneath us, but equally we get none of the
2025+ accuracy gains for free.

Two things worth stating plainly:

- **The raw transcript is not preserved anywhere** [C]. `app.js:330-347` cleans
  it, stores the cleaned string, then clears `currentTranscript`. The
  `raw_note_text` column in `Practice_Notes_Log` is the *assembled post-cleanup*
  note, not ASR output — the name is misleading. There is currently no artefact
  to audit a bad transcription against.
- **The browser-visible API key is a live exposure**, already triaged in
  `docs/plans/active/practice-chat-whisper-hardening.md` (status: awaiting a
  no-lessons deployment window). The relay's CORS allows no-Origin requests and
  any `chrome-extension://`, so `/api-key` is effectively public. The relay also
  still carries dead Realtime/WebSocket code the PWA never uses.

## 2. Relevant files and functions

**PWA** (`~/Desktop/Tools:Games/FC Admin Tools/practice-chat/`)

| File | What matters |
|---|---|
| `public/src/asr-client.js` | `WhisperASRClient.start/stop`, `transcribeAudio()` (:144 — the model call), `getAPIKey()` (:182) |
| `public/src/app.js` | `QUESTIONS`/`QUESTION_LABELS` (:17), `processCurrentAnswer()` (:322), `generateStructuredOutput()` (:394), `executeMmsTestWrite()` (:868) |
| `public/src/text-processor.js` | `MUSIC_TERMINOLOGY_FIXES` (:7), `FILLER_WORDS` (:57), `enhancedCleanupSpeechText()` (:67) — the entire music/formatting harness |
| `public/src/practice-note-sync.js` | `getPracticeChatContext()` (:20), `buildPracticeNoteSnapshot()` (:59), `savePracticeNoteSnapshot()`, `executePracticeNoteMmsTestWrite()` |

**Relay** (`.../HW Notes 3 (test1)  copy/relay-server/server.js`) — `GET /api-key`
(:46) is the only endpoint the PWA uses; everything else is legacy.

**Dashboard** (this repo)

| File | What matters |
|---|---|
| `components/navigation/QuickLinks.js:28` | `buildPracticeChatUrl()` — the only place lesson context crosses into the PWA |
| `app/api/practice-notes/route.js` | snapshot log endpoint |
| `app/api/practice-notes/mms-test/route.js` | the real Level 2 delivery (preview + execute) |
| `lib/admin/practice-notes-helpers.mjs` | `parsePracticeNoteSections()`, `normalisePracticeNotePayload()`, `buildPracticeNoteLogSheetRow()`, `buildPortalPracticeNoteText()` |
| `lib/admin/practice-chat-auth.mjs` | origin allow-list + shared-secret guard |
| `lib/admin/sheets/core.mjs` | `PRACTICE_NOTES_LOG_HEADERS` — 38 columns, including four reviewed song-link/observation fields |
| `lib/config/songs-catalogue.mjs` | 311 curated songs (title, artist, instruments, level, series) |
| `lib/songs/assignment-helpers.mjs` | `ASSIGNMENT_STATUSES` — live per-student repertoire |
| `lib/config/students-registry.js` | `instrument`, `fcStudentId` per student |

## 3. Diarisation feasibility

Current OpenAI documentation confirms `gpt-4o-transcribe-diarize` [C]:

- **Same endpoint, same multipart shape** — `POST /v1/audio/transcriptions`, swap
  the `model` field. `webm` is in the accepted format list, 25 MB cap. Our
  recordings are far under both.
- `response_format: "diarized_json"` returns
  `{ task, duration, text, segments: [{ id, start, end, text, speaker }], usage }`.
  `speaker` is `A`/`B`/… unless known-speaker names are supplied.
- **`chunking_strategy` is required for input longer than 30 seconds.** Send
  `"auto"`. Practice Chat answers routinely exceed 30 s, so omitting this would
  fail on most real recordings — this is the single easiest thing to get wrong.
- Up to **4** `known_speaker_names[]` + `known_speaker_references[]`; references
  are data URLs, 2–10 s each.
- **`prompt` is not supported on the diarize model.** `gpt-4o-transcribe` and
  `gpt-4o-mini-transcribe` support it; the diarize model does not.
- Model id is an **auto-updating alias** — the opposite of today's pinned
  `whisper-1`. Pin a dated snapshot if reproducibility matters, or accept drift
  knowingly.
- Streaming exists; irrelevant to our batch UX.
- Diarisation is not available in the Realtime API.

**Compatibility: high.** Architecturally this is a model string, a
`response_format`, a `chunking_strategy` and a richer parse. Keeping the three
questions as three separate recordings is unaffected — each is its own call.

**Cost.** whisper-1 is $0.006/min flat. The diarize model is token-priced
($2.50/M audio input, $10.00/M output) [C]; that works out roughly comparable,
plausibly slightly cheaper per minute [A]. At ~2–3 minutes of audio per lesson
this is pennies either way — **cost is not a decision input.**

**Latency** [A]: expect somewhat slower than whisper-1 (diarisation plus VAD
chunking). The UI already covers this with the joke processing messages.

**Accuracy** [A, the real unknown]:

- *Likely better* on general lesson speech — it is a 2025-generation model
  against a 2022 one.
- *Likely worse* on song and repertoire names, because losing `prompt` removes
  the one lever that biases the decoder toward "Fell On Black Days" or
  "Mixolydian". **Diarisation and prompt-biasing are mutually exclusive in one
  call today.** This is the central trade-off of the whole change.
- Short answers ("Yeah", "C to G") are the weak spot for VAD-driven chunking —
  a 1-second reply may be absorbed into the neighbouring speaker's segment.
- One adult + one child, a guitar being played mid-answer, and room overlap are
  exactly the conditions diarisation is worst at.

The mitigation for the song-name regression is the harness in §5, which does the
work after transcription using our own catalogue — better than prompt-biasing
anyway, because it can be scored and reviewed instead of silently guessed.

**Verdict: feasible and worth doing, but only after the key exposure is closed,
and only behind a flag with a real side-by-side trial.** Adding a feature to a
browser-side call that leaks the API key would be building on sand.

## 4. Recommended named-speaker approach

**Recommendation: session-context mapping, not voice references.**

The problem is genuinely small: exactly two speakers, both already known by name
and id from the launch URL. `QuickLinks.js:28` already passes `studentId`
(MMS id), `studentName` and `tutor`; the server can add `fcStudentId` and
`instrument` from `students-registry.js` on the existing `/api/practice-notes`
call. Nothing needs to be discovered from the audio except *which of the two
voices is which*, and there are only two possible answers.

Design:

1. **Per recording**, map the returned `A`/`B` to Tutor/Student with a
   deterministic heuristic — the tutor is whoever speaks first and holds the
   larger share of total segment duration in that recording [A: this holds for
   the question-and-answer format, and is exactly what the Swap action is for
   when it doesn't].
2. **Session memory.** Speaker letters are *not* stable across the three
   separate API calls — recording 2's "A" is unrelated to recording 1's "A".
   Hold the resolved mapping in `sessionStorage`, re-derive the heuristic per
   recording, and let one **global "Swap speakers"** control flip all three at
   once. One control, one state, applied everywhere.
3. **Per-segment correction** — tap a line to reassign it. Overrides survive the
   global swap (a swapped segment is stored as an explicit override, not a
   recomputed guess).
4. **Roles bind to identities, not names in prose.** Store role → `{ role,
   displayName, mmsId | tutorName }`. Render as `Jamie:` / `Mia:` using the
   first names already in context. The dialogue view is a projection; the stored
   truth stays role-keyed so a name correction never requires rewriting text.
5. **Record provenance** — `speaker_identity_method` ∈
   `inferred` | `confirmed` | `reference_matched`, plus a per-segment
   `corrected` flag. Distinguishing "we guessed" from "the tutor confirmed" is
   what makes the dialogue trustworthy later.

**On known-speaker reference audio.** It solves one real problem — cross-recording
label stability — and it is the only reason to consider it. If it is ever
adopted, adopt it in one specific shape:

> **Tutor-only reference. Never the student.**

Supply a 3–5 s clip of the **tutor** as `known_speaker_references[0]` with
`known_speaker_names[0] = "Tutor"`; the student is then simply "the speaker who
isn't the tutor". This gets stable labelling with **zero handling of a child's
voice sample**. Hold the clip in memory for the session and never persist it.

Privacy assessment: a stored child voice sample is a biometric identifier of a
minor. It would be a new processing purpose requiring parent notice and a
lawful-basis decision, and the [data-protection policy](../../policies/data-protection.md) is still
status PROPOSED and unsigned. The benefit — stable letters across three short recordings — does not
come close to justifying that. **Do not collect student voice references.**
The tutor-only variant is defensible (an adult staff member, transient, in
service of their own workflow) but is still Phase 3+ and still needs Finn's
sign-off. Ship the heuristic + Swap first; it is one tap when it's wrong.

## 5. Gaps in the music and safety harness

The harness today is `text-processor.js` — 34 unanchored global regex
replacements, a filler-word stripper and a repeated-word collapse. It is exactly
the "fragile global find-and-replace" the brief warns about, and it is
**actively corrupting text right now**. Run against the live module [C]:

| Input | Output |
|---|---|
| `We worked on topics from the funk rhythm section` | `We worked on **topicks** from the funk rhythm section.` |
| `The plectrum was in the picture` | `The **picktrum** was in the picture.` |
| `He was off minus two frets` | `He was **ofF minor** two frets.` |
| `no no she she did well` | `**No** she did well.` |
| `kind of like the original` | `like the original` |

Causes: `Object.entries(...).replace(new RegExp(error, 'gi'), fix)` at
`text-processor.js:88-90` has **no word boundaries**, so `pics`→`picks` fires
inside "topics", `plec`→`pick` inside "plectrum", `f minus`→`F minor` across
"of minus" (also destroying the preceding word's case). `FILLER_WORDS` removes
content-bearing words ("actually", "basically", "kind of", "I mean") anywhere
they appear, and `/\b(\w+)\s+\1\b/` collapses meaningful repetition.

Mitigating factor [C]: the output box is `contenteditable` and the tutor
confirms a recipient-specific dialog before send, so a tutor *can* catch this.
It is not silent — but it is unprompted, and "topicks" in a parent email is the
kind of thing that gets noticed by the wrong person.

Missing entirely [C]: any song-name matching, any use of the student's
instrument or repertoire, any confidence scoring, any review queue, and **any
safety filter at all**. The "funk" class of risk — a mishearing producing an
obscenity in a parent email — has no defence in the current code. Note the
correct framing: the risk arrives from *ASR error*, so the check must run on the
**output**, on the way to the parent, not as an input rewrite rule.

What it should become, in order of leverage:

1. **Anchored, tested lexicon.** Every rule gets `\b…\b` (or an explicit
   context anchor), a fixture pair, and a confidence tier. Rules that cannot be
   made safe get deleted rather than tuned. This is a table + a golden-file
   test, not an architecture.
2. **Catalogue matching with context.** We already hold everything needed:
   `SONGS_CATALOGUE` (311 entries with title/artist/instrument/level), the
   student's `instrument` from the registry, and their live `Song_Assignments`
   rows (`assigned`/`working`/`ready` = current repertoire). Match spoken titles
   against **the student's own shelf first**, then their instrument's slice of
   the catalogue, then nothing. A student working on *Sweet Home Chicago* who
   says something that transcribes as "sweet home chicargo" is a near-certain
   match; the same string for a student who has never been assigned it is not.
3. **Autocorrect only above a high similarity threshold; flag everything else.**
   Uncertain candidates surface as an inline suggestion the tutor accepts or
   ignores — never an automatic rewrite. Confidence must come from the harness
   (match score, shelf proximity), because the diarize model exposes no
   logprobs [C].
4. **Output safety gate.** A denylist checked against the *cleaned* text before
   send. A hit **blocks and flags** — it never auto-substitutes, because
   guessing what the tutor meant is how you turn one error into two.

## 6. Target structure

Four layers, and the current system collapses all four into one string. Separate
them:

| Layer | Content | Where it should live |
|---|---|---|
| 1. Raw | Per-question ASR text + `diarized_json` segments verbatim | **New append-only tab** `Practice_Chat_Transcripts`, keyed by `note_id` |
| 2. Named dialogue | Role-keyed, editable segments + speaker provenance | Same tab, alongside its raw |
| 3. Cleaned parent-facing note | Today's `what_we_did` / `progress_challenges` / `practice_goals` / `raw_note_text`, plus optional exact song IDs selected by the tutor | `Practice_Notes_Log` — note body unchanged; song link fields are additive |
| 4. Structured lesson data | `songs[]`, `concepts[]`, `challenges[]`, `practice_actions[]` | New columns or its own tab; feeds the Lesson Focus box and the song loop |

A separate tab for layers 1–2 rather than more columns on `Practice_Notes_Log`,
for three reasons: that row is already 38 columns; transcripts are bulky and
would slow every read of the delivery audit; and verbatim child speech has a
different sensitivity and a different retention rule from a parent-facing note.
Keeping it separable means it can be purged on its own schedule
(`npm run retention:report` already exists to police that).

Layer 3 stays canonical for the parent email and the portal — nothing downstream
changes shape, which is what makes this incrementally shippable.

## 7. Risks and unknowns

**Risks**

- **Deploying into live lessons.** Any PWA change lands mid-teaching-week. The
  existing hardening plan is explicitly waiting for a no-lessons window; this
  work should ride the same window rather than open a second one.
- **Key exposure is a prerequisite, not a parallel track.** Adding diarisation to
  a browser-side call that ships the OpenAI key to every client compounds the
  problem — the audio and the key would both be client-visible.
- **Song-name accuracy could regress** on switching, because `prompt` is
  unavailable on the diarize model. If the harness (§5) isn't ready, the switch
  could be a net loss on the thing tutors most care about.
- **Storing verbatim child speech is a new processing purpose.** It needs a
  retention rule, a parent privacy notice line, and Finn's sign-off.
  the [data-protection policy](../../policies/data-protection.md) is still
  PROPOSED — this work depends on that being signed, and the dependency is
  real, not procedural.
- **Diarisation UI can eat the product.** Practice Chat's virtue is that it is
  three taps. Per-segment editing must stay a progressive disclosure, not the
  default screen. (`CLAUDE.md` → the subtraction pass; the UI-simplicity
  preference in memory says the same.)

**Unknowns — all resolvable by a spike**

- Real diarisation quality on 1 adult + 1 child with an instrument playing.
- Whether short answers survive VAD chunking as their own segments.
- `webm/opus` specifically against the diarize model (webm is in the documented
  format list, but not confirmed model-specifically).
- Actual added latency per recording.
- Whether "tutor speaks first and longest" holds across tutors [A].

## 8. Phased implementation plan

**Phase 0 — Close the key exposure.** Execute the existing hardening plan: relay
gains `POST /transcribe`, PWA stops fetching the key, `/api-key` removed, key
rotated. *Prerequisite for everything below — it is also the natural seam at
which the model becomes a one-line server-side change.*

**Phase 1 — Stop the bleeding, keep the evidence.** No model change.
(a) Rewrite `text-processor.js` as an anchored, fixture-tested lexicon; delete
unsalvageable rules. (b) Add the output safety gate. (c) Preserve the raw
transcript per question instead of discarding it, and rename the misleading
`raw_note_text` understanding in the docs. Ships independently, benefits today's
`whisper-1` flow, and Phase 2 needs the raw-transcript plumbing anyway.

**Phase 2 — Diarisation spike, flagged.** Server-side `/transcribe` gains a
`model` switch. Run `gpt-4o-transcribe-diarize` with
`response_format: "diarized_json"` and `chunking_strategy: "auto"` alongside
whisper-1 on ~10 real recordings. Compare word accuracy, song-name accuracy,
speaker correctness on short answers, and latency. **Decide on evidence.**

**Phase 3 — Named dialogue.** Heuristic role mapping, session-persisted, global
Swap, per-segment override, provenance recorded. Store layers 1–2 in
`Practice_Chat_Transcripts`. Voice references stay out of scope unless Phase 2
shows cross-recording instability is actually hurting.

**Phase 4 — Music harness with context.** Catalogue + instrument + live shelf
matching, high-confidence autocorrect only, everything else flagged inline.

**Phase 5 — Structured lesson data.** Extract songs/concepts/challenges/practice
actions into layer 4; wire into the Lesson Focus box and the song loop.

---

## Progress

### Shipped 2026-07-26

Two repos, two commits, two deploys — **dashboard first**, because the PWA calls
a route that must already exist (the call is best-effort, so a wrong order
degrades rather than breaks).

**PWA — `practicechatpwa`**

| File | Change |
|---|---|
| `public/src/text-processor.js` | Rules rebuilt as word-boundary-anchored RegExps; unsafe rules deleted; filler list narrowed to real disfluencies; stutter-collapse restricted to function words; new `checkNoteSafety()` |
| `tests/text-processor.test.mjs` | **New.** 17 fixtures, including the four live corruption cases |
| `public/src/app.js` | Safety gate at send + on the legacy copy path; model and prompt passed to the ASR client |
| `public/src/asr-client.js` | `resolveAsrModel()` (allow-listed; falls back and warns on anything unknown), constructor takes `{ model, prompt }`, sends `prompt` when present |
| `tests/module-integrity.test.mjs` | **New.** Structural guards — see "Guards" below |
| `tests/asr-model.test.mjs` | **New.** Allow-list behaviour |
| `.github/workflows/firebase-hosting-main.yml` | `npm test` now gates the Firebase deploy (it previously ran nothing) |
| `public/src/practice-note-sync.js` | `fetchPracticeChatMusicContext()` |
| `index.html`, `service-worker.js` | Cache-bust stamps → `20260724-safe-cleanup` / `practice-chat-v18-safe-cleanup` |

**Dashboard**

| File | Change |
|---|---|
| `lib/admin/practice-chat-music-context.mjs` | **New.** Live-shelf selection, instrument inference, prompt builder |
| `app/api/practice-notes/music-context/route.js` | **New.** Read-only instrument + song titles |
| `lib/admin/practice-chat-auth.mjs` | CORS now allows `GET` (music context is the only read) |
| `tests/admin/practice-chat-music-context.test.mjs` | **New.** 15 tests |
| `lib/config/practice-chat-asr.mjs` | **New.** School-wide model config, allow-listed |
| `components/navigation/QuickLinks.js` | Appends `asrModel` when the env var is set |
| `docs/workflows/practice-chat/delivery.md` | Transcription-model section + the build-time inlining warning |

### Running a model trial

Set `NEXT_PUBLIC_PRACTICE_CHAT_ASR_MODEL=gpt-4o-mini-transcribe-2025-12-15` on
Railway; delete it to revert. School-wide and invisible to tutors, because the
useful comparison is a week on one model against a week on another, not a
per-lesson choice. `NEXT_PUBLIC_` values are inlined at **build** time, so the
variable change must trigger a rebuild or it has no effect.

Chosen over `gpt-4o-transcribe`: same-or-better accuracy, **half the cost**, and
~70% fewer hallucinations — the relevant failure mode, since silence is its
documented trigger and a thinking student produces plenty. Pinned to the dated
snapshot so transcription cannot change mid-trial. Reasoning and sources:
Obsidian `06 Learning Log/2026-07-26 - Valid JavaScript Is Not Working Software`.

**Record the trial dates.** Per-transcript model capture is part of the held
slice, so those dates are the only record of which model produced which notes.

### Guards

`tests/module-integrity.test.mjs` exists because an edit during this work
deleted ~20 methods from `app.js` while leaving their call sites intact. It
passed `node --check` — still valid JavaScript — and no test covered `app.js`;
it would have failed only when a tutor pressed finish. Three static checks: every
`this.x(` resolves to something defined in the same module, every imported name
is actually exported by its target (a missing export kills the whole module
graph), and a hand-written golden list of the lesson-finishing methods. Verified
by reproducing the deletion and watching them fail while `node --check` passed.

### Built but deliberately held — `wip/practice-chat-all`

Raw per-question transcript capture: the `Practice_Chat_Transcripts` tab (14
headers, managed + backed up), `appendPracticeChatTranscriptRows`, the
`POST /api/practice-notes/transcripts` route, the PWA capture and best-effort
post, the contract-guard entry, a provisional 6-month retention policy, and 8
tests. Complete and green; not shipped.

**Why held:** it is the only piece that stores verbatim child speech. It needs a
retention number and a decision on whether the parent privacy notice must say
so. Nothing else in this plan depends on it, which is why the split was clean.

**To ship it later:** `git checkout wip/practice-chat-all -- <the transcript
files>`, re-run the contract guard (it will fail until the new tab is added to
the backup list — that is the guard working), then deploy dashboard before PWA.

**Still not done, by decision:** diarisation itself (Phases 2–3 — feasible,
specced, waiting on a better reason than "the newer model exists"); the key
exposure (Phase 0, its own plan); catalogue *matching* of spoken titles (Phase 4
proper — the prompt biases the model up front, which is the better half, but
nothing yet matches a transcribed title back to a canonical song record).

---

### The smallest valuable next change

**Anchor the replacement rules in `text-processor.js` and put a fixture test
behind them.**

Roughly an hour. Touches one file in one repo. No model change, no API change,
no new storage, no data-protection dependency. It fixes text that is reaching
parents today — `topicks`, `picktrum`, `ofF minor` — and it builds the fixture
harness that Phase 4's catalogue matching will extend rather than replace.

Immediate follow-up, same shape and nearly as small: stop discarding the raw
transcript.
