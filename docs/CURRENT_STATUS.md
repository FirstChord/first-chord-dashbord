---
status: canonical
audience: [human, agent]
last_verified: 2026-08-06
---
# Admin current status

This is a snapshot of active direction, recent delivery, and open choices. It is
not a changelog or a second policy manual. Use Git history for chronology, the
Obsidian Learning Log for rationale, and the focused linked document for durable
implementation rules.

## Active direction

V3 established the operating loop:

```text
Detected -> Guided -> Actioned -> Logged -> Resolved / Kept Active
```

V4 adds small, explainable context layers that reduce the cognitive cost of
running the school. The private `/admin` dashboard is the active operating
surface. The overview is a meeting start, not a complete status board: a card
earns attention only when it represents work for today, near-term action, or a
deliberate school-improvement prompt.

## Recently shipped

- **Song teaching history, and a real "done" (2026-08-07):** an audit before
  briefing tutors on the song shelves found the write side healthy — every lane
  keys on `song_id`, every lane records the tutor, all fully populated — and the
  read side absent: `Song_Status_Log` and `Song_Outcomes` had **no consumers at
  all**, and the one cross-student song aggregation drops the tutor. A tutor who
  parked eight songs and wrote three careful outcome notes on 27 July got nothing
  back, and nobody has recorded an outcome since. `buildSongTeachingHistory`
  (`lib/songs/teaching-history.mjs`, `GET /api/song-history`) now gathers all
  three lanes into one answer per song — who has taught it, to how many students,
  what they said — on the Song Browser card at the moment of choosing. 33 songs
  carried history on day one from rows already sitting there. Two boundaries are
  structural, not stylistic: **no student identity leaves the builder** (the
  output has nowhere to put one), and it aggregates **per song, never per
  tutor** — `docs/policies/data-protection.md` forbids ranking tutors on
  outcomes, and doing so would poison the candour the notes depend on. Also:
  the school had recorded **zero** songs `done` in a month against 12 `parked`,
  because park was one tap and done was the fourth step of a chip cycle that
  wrapped back to `assigned`. Finishing and shelving are now separate one-tap
  acts and the chip walks progress only — read pre-August `parked` rows knowing
  some mean done. Next lever, not yet built: a note's song link is still a dead
  end (both linked notes name songs the student was never assigned), so the
  lower-friction capture Finn wants — evidence from note-taking — does not
  reach the shelf.
- **"On the go" names songs from the catalogue (2026-08-06):** the tutor card
  listed one piece several times — *Who Sold the World*, *Man Who Sold* and *Who
  Solved the World* were all The Man Who Sold the World, each with its own lesson
  count. Mined phrases are now matched against the song catalogue: a match
  decides both identity and displayed name, variants collapse into one entry
  counted by **distinct lessons** rather than summed tallies, and an unmatched
  phrase is still shown exactly as the tutor said it. Three rules keep it
  honest — a mishearing must share the first three letters of the word ("sitting"
  was matching "getting"), a phrase matching several *different* titles names
  none of them ("riff exercise" is three catalogue entries), and an ambiguous
  fragment may only resolve to a song the **same student's** other notes already
  name outright. Correctness for anything unmatched is a catalogue-coverage
  question, not an algorithm one: adding *I Don't Want to Miss a Thing* fixed two
  students at once. Live: 27 pieces named from the catalogue, 38 as written.
  **Confirmed song links now win, and the difference is recorded.** Every piece
  carries `songIdSource` — `confirmed` (a tutor selected it in Practice Chat, a
  real join), `inferred` (matched from note text, a proposal), or `''` (no
  match). A confirmed song appears even when no phrase named it: mining needs a
  phrase to recur across *two* lessons, so it cannot see a song taught once.
  Counts are the union of both kinds of evidence with `confirmedLessonCount`
  recording how much is confirmed — counting only confirmed lessons would drop a
  long-running piece to "1 lesson" the first time a tutor used the selector.
  **Nothing may aggregate an `inferred` id as a join** (cross-student counts,
  time-on-piece): tolerable per-card error compounds across students. Mining is
  explicitly a bridge and scales the wrong way — 18 of 299 catalogue titles are
  already contained inside another title, so a growing catalogue produces more
  ambiguous refusals, not fewer. The number that retires it is adoption: since
  the selector shipped, **1 of 14 notes carries a confirmed link**.
- **Practice Chat notes carry formatting (2026-08-06):** tutors can bold,
  italicise and bullet in the note editor, and that formatting now reaches the
  parent email, the MMS `StudentNote` and the student portal. **The note itself
  stays plain text.** The PWA serialises its editor to three markers —
  `**bold**`, `_italic_`, `- ` for a bullet — and every renderer escapes first
  and converts markers second, so emphasis reaches a parent while a pasted
  `<script>` still arrives as visible text. Two rules make it safe and both are
  in [State tabs → Format Contracts](./architecture/data/state-tabs.md): a portal
  section heading is a line *entirely* wrapped in `**` (testing for `**`
  anywhere silently swallowed inline emphasis into a heading — a latent bug fixed
  here), and anything that *analyses* the note rather than displaying it reads
  stripped text, because song titles are matched exactly and `**Clocks**` would
  quietly stop matching. Underline was deliberately left out: it has no
  plain-text form and reads as a broken link in email. The copy action now puts
  both plain and HTML on the clipboard so the legacy paste-into-MMS flow gets
  real formatting rather than literal asterisks. The review screen's note box
  also grows with the content instead of scrolling inside 300px, which had been
  cutting a normal three-section note off mid-sentence.
- **Every household on a group lesson, and one shape for planning cards
  (2026-08-06):** an MMS event carrying several students was collapsed to its
  first student, so siblings and class members silently vanished from the
  workflow. The **Mark manual household check complete** control existed only to
  ask a human to compensate for that loss; events now expand to one lesson per
  student before any decision, and the block is gone. Pause cards are raised by
  payment mode — `stripe` gets one card per student, `manual` gets none because
  there is no subscription to pause, and unknown still gets one so missing data
  cannot drop a household from finance. All three are still reached for the
  parent message. A card for an already-paused student now says so, and the
  duplicate **Open tutor absence workflow** entry point was removed. The contract
  is [Tutor absence and pause](./workflows/tutors/absence-to-pause.md).
  Separately, the planning card's four differently-coloured "here is a message to
  send" blocks became one shape: colour now encodes severity only, never card
  type, since the heading already states the type. Pause completion reuses the
  issues queue's sorted-tick vocabulary rather than inventing a second success
  signal. **Safety copy stays beside the control it governs** — a
  correctly-scoped statement about the *Mark pause completed* button became false
  when compressed into a panel-level badge, because step one of that panel opens
  the Payment Pause PWA, which does write to Stripe.
- **Sheets read budget and graceful quota failure (2026-08-04):** intermittent
  "Application error" pages across `/admin` were a Google Sheets 429 — 60 reads
  per minute per *user*, shared by the whole app through one service account.
  `getSheetObjects` read straight past the cache, so every
  `loadStudentContextCollection` spent three requests regardless of how recently
  it had run; it now shares the read cache. Ordinary reads serve bounded-stale
  data rather than failing when Sheets rate-limits, while forced (pre-write)
  reads still fail loudly rather than act on an old copy. 429 gets a short retry
  ladder because a per-minute quota does not clear in seconds and each attempt
  spends more of it. A rolling read counter warns at 75% of the ceiling, and
  `/admin` finally has an error boundary instead of Next's bare exception page.
  The rule and its per-module tiers live in
  [Sheets read discipline](./architecture/data/sheets-reads.md).
- **Evidence-first message intake and Practice Note song links (2026-08-04):**
  incoming classification now separates topic, intent and actionability, so a
  social mention of summer, a music-book payment, or an already-settled slot no
  longer becomes work merely because it contains a trigger word. New rows keep
  the machine proposal, confidence and evidence beside the human-final decision;
  Signals counts only explicit accepts/corrections as reviewed topic evidence.
  Converting to Planning leaves the message open until the idempotent linked plan
  has actually saved, and linked plan status is visible back on the card. A later
  school message is weak engagement evidence for only the nearest preceding open
  row, never proof of reply or blanket closure. Every readable open card keeps a
  visible Planning path. **Reply + Plan** always opens a compact preview before
  anything is written, with the proposed student and type, editable extracted
  dates, and an editable deterministic parent reply. **Copy reply & open plan**
  puts that reviewed wording on the clipboard, stores the same draft with the
  idempotent linked plan, and opens that plan. For pause cards the reviewed
  reply becomes the final WhatsApp handoff after the payment tool; the card
  still cannot close until a human confirms the message was sent. The confirmed
  dates—not a hidden parser guess—feed the structured pause card.
  Bare
  role-marked ordinals such as “on the 12th … back on the 19th” resolve against
  the message date, and an explicit singular missed lesson stays one-off rather
  than becoming an extended absence merely because a return date was mentioned.
  Mobile cards now lead with student, sender and original message rather than
  classifier badges. The action row now says what happens: **Reply + Plan** and
  **Reply**, followed by compact Later, Done and More controls. Reply is now the
  one-message-at-a-time consent boundary for the bounded AI drafting pilot; it
  falls back to the editable standard template whenever drafting is disabled,
  unavailable or rejected by deterministic validation. General drafts may
  acknowledge the actual message but cannot promise operational outcomes;
  ambiguous policy evidence never reaches the model. There is no bulk or
  background drafting, and proposal evidence no longer duplicates the parent
  message. **Copy & open WhatsApp** puts the final text on the clipboard and
  opens WhatsApp's chat chooser with it prefilled. The
  human still chooses the conversation and taps Send, and the copy remains a
  Communication Log record rather than proof of sending. No-action, evidence,
  classifier detail, correction and test deletion sit behind one More
  disclosure. Later is a wake-up time on the still-open message, with separate
  Open/Later/Done views, and never masquerades as resolution. Correction
  controls and their large student list are mounted only when opened. Practice
  Notes can now carry up to
  twelve tutor-confirmed catalogue `song_id` links plus title snapshots and six
  explicitly unlisted raw titles. Both note routes reject unknown catalogue
  IDs; student history shows catalogue and unlisted evidence separately, and
  Signals aggregates linked notes plus an unlisted-repertoire review list
  without inferring sentiment. The separate Firebase PWA selector is live:
  exact note-title suggestions prioritise the
  current shelf but remain unchecked until the tutor selects them; catalogue
  search and an unlisted-title escape hatch cover everything else. The selector
  remains optional, so ignoring it preserves the previous Practice Chat flow.
  The occasional done/parked `Song_Outcomes`
  prompt remains supplementary evidence—the high-volume Practice Note stream is
  intended to become the main song-learning memory.
- **One inbox-first admin web app (2026-08-04):** the competing Planning and
  Messages manifests have been collapsed into the single **FC Messages** app,
  preserving its `/admin/incoming-messages` identity and launch target. A fresh
  home-screen install retains Inbox, Planning, and Overview in the standalone
  bottom bar. This avoids iOS choosing the old Planning start URL from two
  manifests with the same scope; icons made before this correction must be
  removed and installed again because iOS stores launch metadata at install
  time.

## Current operating contracts

| Area | Current boundary |
|---|---|
| Context | Student lifecycle, schedule, payment value, and capacity summaries are derived/read-only. They do not become provider truth or authorise actions. |
| Navigation | Overview starts work; Issues handles detected problems; Workflows holds recurring processes; Planning holds due work, reflection, notes, and initiatives. Student records are reached through search and workflow links. |
| Capacity | MMS `Free` events remain source truth. Waiting-list matches are hints filtered by instrument, never reservations or automatic assignment. |
| Planning | `Planning_Items` is human work state, not a project-management or workflow engine. Friday reflection and Monday scheduling are seeded planning prompts. |
| Pauses | Generic completion never changes payment state. The guarded pause-completion action requires human confirmation, writes through the existing student route, and logs to `Event_Log`. For new guided tutor-absence cancellations, an undated paused-expected flag cannot suppress the dated structured pause card or unlock its final message; only an explicit per-lesson payment-not-needed decision takes the message-only path. |
| Messaging | Parent communication remains approval-first. `Communication_Log` means copied to send, not proven sent; inbound classifications and reply drafts remain proposals. |
| Practice Chat | All registered tutors are enabled unless temporarily constrained. The tutor self-attests, the student must have one clear tutor assignment, the final screen names the server-derived recipient, and PostgreSQL claims the delivery key before MMS/Gmail work. Ambiguous Gmail outcomes require manual follow-up. |
| Student portal notes | Profile URLs and non-note resources stay public. Practice Chat notes load through a separate no-store API; families are moved individually to memorable-code protection through the claimed admin rollout queue. A missing rollout row remains legacy-public, while an access-state failure fails closed. The memorable code is a light privacy guard proportionate to what it protects — a child's practice notes — not a defence against a determined attacker, and it is not sized to become one. |
| Finance | Sheets holds operating estimates/review state; Stripe and Wise remain provider truth. Payroll preparation does not execute Wise payment. |
| Public tutor surfaces | Low-friction tutor identity is not durable authentication. Do not add broader sensitive reads or consequential writes before tutor auth. |
| Testing | A test that reads source text and asserts a name appears is a lint rule, not coverage — it cannot show the code ran, ran in the right order, or was correct. Guards, verifiers, and write paths get executed instead: inject the impure dependency and run the real function. Source-text checks are legitimate only for architectural absence (module X must not import writer Y) and for server components with no callable handler, and must discover their targets from disk rather than a hardcoded list. Before trusting a new security or money-path test, break the thing it guards and confirm it fails. |

Canonical details live in [state ownership](./architecture/data/ownership.md),
[state tabs](./architecture/data/state-tabs.md),
[workflow design](./policies/workflow-design.md), and the focused workflow docs.

## Next choices

- **The tutor notes card, measured 2026-08-06 and only half addressed.** The
  card is read at the start of a lesson as a 5–10 second reminder. Its
  typography is genuinely good and should be left alone: body text is 14.18:1 on
  the yellow (AAA), the measure is 57 characters (Bringhurst's 45–75, near Dyson
  & Haselgrove's ~55 optimum), line height is 1.62, and the section labels are
  what make layer-cake scanning possible. The **yellow is right on evidence** — a
  pastel tint avoids the veil-of-light that pure white creates behind black text.
  What does not work, across a 7-student sample: two of seven cards are **taller
  than the viewport** (1041px and 1303px against 900px), and the transcript
  dominates them — Guy Pilsworth has 290 characters of guidance against 1835 of
  dialogue. Ranked: (1) **collapse the Progress & Challenges transcript behind a
  disclosure** — it is a record, not guidance, and this alone makes every card
  fit the screen; (2) **make Lesson Focus glanceable** — it is unedited
  transcribed speech, up to 430 characters, so the bottom line is buried
  mid-paragraph; bullets in Practice Chat now flow through, so the structural fix
  is upstream; (3) minor: the lesson-date heading is 16px against 17px body, two
  heading vocabularies are live (older notes say `WHAT WOULD BE GOOD PRACTICE
  OVER THE WEEK? (AND HOW!)`), and `max-w-[68ch]` is **inert** — it computes to
  728px while the column is pinned at 488px at every width from 1280 to 2560.
- **Song-link adoption is the lever, not the matcher.** Since the Practice Chat
  song selector shipped (2026-08-04), **1 of 14 notes** carries a confirmed link,
  at a run rate of ~130 notes/month. The flow exists; adoption does not. Every
  confirmed link is exact, is a real object reference, and unlocks what inference
  never can — cross-student repertoire counts, time-on-piece per grade, direct
  Soundslice/level links. Improving capture in Practice Chat is worth more than
  any further work on the matcher, which should be retired once confirmed links
  cover most recent notes. **The next concrete move (2026-08-07): let a note's
  song link create or update the assignment.** Today it is a one-way street —
  the shelf feeds the note's picker and transcription prompt, but the note never
  writes back, and both linked notes so far name songs the student was never
  assigned. Closing it makes note-taking the low-friction capture path Finn
  wants, instead of shelf admin being the only way a song becomes a fact.
- **Catalogue titles need normalising, and the catalogue has no concept of a
  "work" (corrected 2026-08-07).** Dock of the Bay appears three times —
  `(Sittin' On) The Dock of the Bay` (Guitar, Grade 2), `(Sittin' On) The Dock Of
  The Bay` (Bass, Grade 1), `Sitting on the Dock of The Bay` (Electric Guitar,
  Grade 3). These are **not duplicates to delete**: they are three real
  arrangements of one song, and an earlier note here calling for deduplication
  was wrong. What breaks the matcher is that one work is spelled three ways, so
  it sees three names and correctly refuses to pick. The fix is title
  normalisation, not deletion. Across the catalogue, 13 titles repeat and almost
  all are this same legitimate pattern (Stand By Me guitar + electric, Come as
  You Are, Thinking Out Loud); the genuinely ambiguous ones are generic exercise
  labels — `Sight Reading` ×3, `Scales` ×2, `Chords` ×2, `Improvisation` ×2,
  `Riff Exercise` ×2 — which are not songs and should probably never have been
  matchable by title at all. The structural gap underneath: a song is currently
  an instrument-specific arrangement with no parent work, so teaching history
  for Dock of the Bay is split three ways and a First Chord path cannot say "this
  song, on whichever instrument". Worth settling before the FC curriculum paths
  are built on top of it.
- **Notes access lifecycle, not notes brute force.** The realistic way practice
  notes reach the wrong person is that the code lives in the WhatsApp group
  description, so anyone ever in that group keeps access until it is reset — a
  tutor who moves on, a family who leaves. Worth deciding whether code rotation
  should be part of tutor changeover and student exit. This is a rollout and
  lifecycle question, not a cryptographic one.
- **Parent message angle for the notes rollout:** the current WhatsApp template
  is safe placeholder copy, not the final campaign wording. Agree the parent
  framing with Finn before starting real-family rollout, then update the one
  template helper and its focused assertion listed in the
  [rollout handoff](./workflows/practice-chat/student-notes-access.md).
- **Practice Chat transcription security:** the current PWA can receive the raw
  OpenAI key from the relay. Complete the staged server-side transcription
  cutover, remove `/api-key`, and rotate the exposed key in a no-lessons window.
  See [the active hardening checklist](./plans/active/practice-chat-whisper-hardening.md).
- **Cover test cleanup:** before 22 July, check MMS event `evt_zsGLw6J0` at
  14:00 and restore Tom unless Dean is genuinely covering. This is a manual MMS
  check; automation remains parked in [the cover note](./plans/parked/cover-loop.md).
- **Song placements, before the RSL 2026 songs are added.** A level is a property
  of a (song, framework) pair, not of a song: today a song has one `level` and
  one `series`, so a piece that sits at Grade 3 in the 2019 syllabus and Grade 4
  in the 2026 one cannot be expressed without duplicating its ID and splitting
  its accumulated history. Deciding the schema before the new songs go in is a
  schema choice; after, it is a migration of live data. Phased plan, invariants
  and open decisions in [song placements](./plans/active/song-placements.md).
- **Student paths:** decide whether current use justifies RSL Grade 7–8 ingestion,
  recommendation/progress work, or fretboard/chord paths. Finn must still create
  the missing Soundslice slices listed in
  [song coverage](./reference/song-catalogue-coverage.md).
- **Tutor payroll Phase 3:** scheduled statement delivery and tutor-selected
  cadence remain gated by persistent tutor auth/contact email.
- **Pause clarity:** distinguish Pause History, sheet expectation, and live Stripe
  evidence more clearly without adding Stripe mutation to Issues.
- **Tutor dashboard auth pilot:** the canonical service now has a reversible
  Google-login pilot for the shared Finn/Tom `musiclessons` account, with full
  tutor selection. The legacy `efficient-sparkle` dashboard stays public during
  the pilot, so the security transition is not complete. After usability checks,
  pilot one exact-email scoped tutor and then close/redirect the legacy route.
  See the [active pilot plan](./plans/active/tutor-dashboard-auth-pilot.md).
- **Incoming-message follow-ups:** settle retention/lawful-basis wording, capture
  the lesson group during onboarding, add removal for sibling mappings if needed,
  prune the ineffective inactivity-timestamp path, and separately review/remove
  the pre-hardening `launchagent.out.log`/`launchagent.err.log` files that may
  contain message previews. Do not assume the new bounded logger removes those
  legacy files.
- **Practice Chat operational check:** use one approved real note to verify the
  recipient, MMS attendance, Gmail ID, Sheets audit, PostgreSQL claim, and
  duplicate response after relevant delivery changes.
- **Activate Practice Note song capture in the Firebase PWA:** the desktop
  side-panel review, exact-title suggestions, catalogue search, unlisted-title
  escape hatch and handoff are built/tested in its separate repository; review,
  commit and deploy that project independently. Keep suggestions unselected and
  deterministic: titles such as *Perfect*, *Yesterday* and *Creep* make fuzzy or
  context-free matching look precise while producing false history.
- **Monolith splits:** remaining candidates and extraction discipline live in
  [the active split map](./plans/active/monolith-split.md).

## Deliberately not next

- heavy assignment, ownership, CRM, or generic workflow systems;
- WhatsApp auto-send or general automated parent messaging;
- Stripe mutations from Issues or model output;
- a database rewrite before measured Sheets limits justify one;
- direct edits to generated portal configuration files;
- hardening student-notes unlock beyond the current per-IP limit. The unlock
  rate limit buckets on the caller-supplied leftmost `x-forwarded-for`, so a
  rotating header would defeat it. Reviewed 2026-07-27 and accepted: the
  existing limit already stops the realistic case (someone typing a few
  guesses), while the bypass needs a scripted attacker deliberately targeting a
  child's practice notes. A per-student cap would close it but lets one attacker
  lock a real family out of their own notes, and correcting the header hop
  depends on Railway's proxy topology — a wrong guess buckets every visitor
  together. Both costs exceed the risk. Behaviour is pinned in
  `tests/admin/student-notes-rate-limit.test.mjs`; revisit only if the data
  behind the code stops being practice notes.

## Fragile contracts

Do not change these without updating their parser/consumer and focused tests:

- MMS sign-up labels `Preferred days` and `Preferred times`;
- the Google Sheets `Students` header row;
- MMS attendance status strings used by payroll;
- Wise CSV column order and money rounding;
- exact pause-note date labels used by pause forecasting;
- scheduled GitHub workflows, which can stop after prolonged inactivity.

Before deployment, follow [AGENTS.md](../AGENTS.md) and the
[operations runbook](./operations/runbook.md). Keep this file short: when detail
becomes durable, move it to the focused canonical document and leave only the
current decision or status here.
