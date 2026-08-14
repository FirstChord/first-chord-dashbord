---
status: canonical
audience: [human, agent]
last_verified: 2026-08-13
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

- **Onboarding now clears the chosen MMS Free series with the provider's real
  contract — READY LOCALLY 2026-08-14:** MMS requires an explicit delete body;
  the dashboard now sends `DeletionType: Future` with notifications disabled,
  after revalidating the exact event and confirming the lesson. A missing event
  on an idempotent cleanup counts as already cleared. Waiting closeout and the
  genuine first-lesson/privacy follow-ups now depend on canonical plus core MMS
  lesson readiness, so an ancillary cleanup warning cannot suppress them. Eve
  Smith's partial onboarding was recovered without recreating her verified
  lesson: Waiting is Onboarded, her 26 August check-in card exists, and her notes
  privacy workflow is queued.
- **Planning's three ordinary shapes now have distinct jobs — READY LOCALLY
  2026-08-14:** An active Action has a **Do on** date; an unscheduled Action stays
  in Inbox. Notes / ideas, including the two legacy school-note types, share the
  one **Let's work on the school** view and can be converted in place. A Project
  is only a multi-action outcome: done-when context, an optional review reminder,
  and any number of linked dated Actions. Their open/done states show progress,
  so the first heavier version's manual Project reports, duplicate completion
  log and exactly-one-child restriction were removed. Stored types, Friday
  reflections and structured pauses remain backward-compatible.
- **Waiting records remain recoverable and welcome copy is current — DEPLOYED
  2026-08-13 (`e792934`, `6e24841`):** No response, Closed and Onboarded rows
  remain visible in a collapsed inactive shelf while staying outside active
  capacity and finance totals. No response and Closed can return to Contacted.
  The copied welcome-group message now uses the parent name and chooses direct
  `you/your` wording for adult contacts or the student's name plus `their/them`
  for parent contacts. No live waiting status was changed by the deployment.
- **Hamish tutor identity registered — DEPLOYED 2026-08-13 (`8e2990e`,
  `bc9da08`):**
  MMS teacher `tch_zLnnJw` is Hamish Roberts and its teacher profile records
  Guitar even though its roster and calendar are still empty. Brain's durable
  identity data contains the same identity, the live FC identity tabs contain
  18 tutors including `fc_tut_ec272a25`, and the generated dashboard roster is
  live. A missing `Tutor_Lifecycle` row deliberately means active, so no
  activation row was invented. CI passed in 1m50s, all three Railway contexts
  succeeded, both public `/dashboard` services render Hamish, and his production
  roster endpoint returns 200 with zero students. No student assignment, lesson,
  attendance, payment or payroll record changed.
- **Holiday workflow rolled forward with three low-noise reminders (2026-08-12):**
  the Holiday selector now keeps the upcoming Christmas workflow at 2026 while
  moving Easter and Summer to their 2027 workflow instances. Easter parent copy
  no longer says lessons continue "throughout April" because Good Friday falls
  on 26 March in 2027; the wording now covers Easter and the spring school
  holidays without making a false month claim. The Christmas announcement now
  records the confirmed closure from Monday 21 December 2026 through Monday 4
  January 2027, returning Tuesday 5 January. Rather than making every bank
  holiday another announcement, three explicitly non-pause `Planning_Items`
  cards prompt the seasonal parent communication on meeting days: 23 November
  2026, 8 March 2027 and 17 May 2027. This keeps the one-week cancellation
  reminder fair and visible without training families to ignore repeated policy
  messages.
- **Navigation follows the work, not the alarm state (2026-08-12):**
  the four equal white pills made persistent navigation look like competing
  actions and gave no visible current location. The header now reads
  **Overview → Planning → Workflows → Issues**: orient first, move through normal
  planned work and specialised processes, then handle exceptions. Inactive
  destinations are quiet text links; the current section has a green underline
  and `aria-current="page"`. Deeper operational routes such as Waiting, Payroll
  and Finance retain the Workflows location cue. The targets remain at least
  44px high and scroll rather than wrap on a narrow viewport. The Workflows page
  applies the same rule internally: its 12 equal cards and incomparable taxonomy
  badges became four stable directory groups — **Families & enquiries, Tutors &
  cover, Regular school routines, School checks** — with compact full-row links.
  Overview owns changing urgency; this directory stays a predictable map. Three
  labels now describe the actual job in plain English: Parent Check-ins, Tutor
  Changes and Lesson Data Checks.
- **Summer finance state reconciled before the next snapshot (2026-08-12):**
  the scheduled jobs were healthy and the weekly series clearly showed the
  summer contraction, but the 10 August run-rate was faithfully preserving
  stale inputs: 98 students still said `stripe_paused_expected` after Pause
  History no longer showed an active pause. The existing guarded preview split
  them rather than bulk-reactivating blindly: 55 had high-confidence
  subscription-ID and next-lesson evidence to return to active now, 27 correctly
  remain paused until their next billable lesson, and 16 remain review cases.
  After a complete Sheets backup and Finn's explicit approval, the standard
  three-write reconciliation changed exactly those 55 rows and appended 55
  attempt plus 55 completion events. A second preview returns zero changes.
  Current run-rate now reads 94 active / 55 paused, £10,006.45 monthly gross and
  approximately -£1,990.93 margin, instead of 39 / 55, £3,803.42 and
  -£5,448.96. No Stripe/provider state changed and no off-schedule snapshot was
  fabricated; Monday's normal job will capture the corrected state.
- **Practice Chat recipient data audited and repaired (2026-08-12):** Paul
  Maher's contact address existed in the dashboard-owned `Students` sheet but
  was blank in MMS, including the adult-contact profile Practice Chat is required
  to use. After explicit approval, the existing address was reconciled into that
  linked MMS profile without changing delivery code or weakening the
  server-derived recipient boundary. The same read-only comparison across all
  198 dashboard students found four more sheet-to-MMS gaps; their exact matched
  contacts were repaired after approval and verified with non-email fields
  preserved. **196 of 198 now pass the real recipient rule.** Anji Goddard and
  Katrina Caldwell remain because neither source has an address to reconcile.
  No email or attendance mutation was used to test any repair.
- **Practice note emails read as three sections (2026-08-12):** the parent email
  put each heading *inside* its body paragraph, separated only by a `<br>`, with
  the raw `[What we did]` brackets showing — Gmail had no block boundary to space
  around, so the note arrived as one wall of text. The portal had always
  normalised those brackets and styled the headings; the email never called that
  step, so the two renderers disagreed despite the contract that a note reads the
  same in both. The normaliser is exported and used once for both MIME
  alternatives, which also drops the brackets from the text/plain half. Heading
  rendering in `noteMarkupToHtml` is opt-in via `renderHeading`, so the **MMS
  payload is byte-identical** — MMS applies its own styling, Gmail renders what it
  is given. **Durable:** email styling must be inline; Gmail discards `<style>`
  blocks and `<head>` outright. **And the reason this shipped for months
  unnoticed:** every assertion on this path checked that content was *present* and
  escaped, never that it was *arranged* — a suite can be rigorous about injection
  and blind to layout at the same time.
  Reasoning: Obsidian `06 Learning Log/2026-08-12 - Present Is Not Arranged`.

- **Cover got its door back (2026-08-11):** the one-door rule for tutor-absence
  cards was right for Cancel and wrong for Cover. Cancel's follow-through really
  does live on the card, but Cover's — cover tutor, briefing, calendar, parent
  message — only exists on `/admin/workflows/tutor-absence`, so removing the link
  left the card instructing you to open a screen it had just taken away, with the
  grey `Workflow:` metadata pill as the only remaining route. Cover-decided cards
  now show **Finish cover checklist →**, deep-linked to that tutor and date;
  Cancel keeps its single door. The workflow is also listed on `/admin/workflows`
  again, for the case where there is no card in hand. The rule that survives:
  a second door is duplication only when the first door can actually finish the
  work.

- **Practice Chat is being measured for six weeks (2026-08-11):** `Practice_Notes_Log`
  only gains a row when a tutor reaches the end, so abandonment, transcription
  failures, retries and pre-save edits were invisible by construction.
  `Practice_Chat_Sessions` now records one row per *attempt* — durations, counts
  and flags, with no audio, no transcript and no note text. Two tiers: the silent
  one runs school-wide and changes nothing anyone sees; the rating card is gated
  to `NEXT_PUBLIC_PRACTICE_CHAT_EVAL_TUTORS` (unset = nobody), asks at most once a
  day, and takes "stop asking me" permanently. Abandonment is derived from age
  rather than claimed by a client that may have been closed mid-lesson, and a
  session that might still be running counts on neither side of the completion
  rate. Per-tutor adoption lives in `npm run eval:practice-chat`, not on the page,
  because state-tabs.md forbids that surface becoming a tutor leaderboard.
  **Two things need Finn:** set the two Railway variables, and hand-time ~10
  manual notes into `lib/config/practice-chat-baseline.mjs` — that baseline cannot
  be collected once the ritual is habitual, and without it the ritual's duration
  is a fact about the tool rather than a saving. The lane is time-boxed: decide
  keep or purge at week six.
  [Evaluation workflow](workflows/practice-chat/evaluation.md).

- **Lesson mirror parity loop live (2026-08-10):** the additive Phase 1 schema is
  on production Neon PostgreSQL and its first whole-school MMS reconciliation
  succeeded for 1–28 August: calendar 772/772, attendance 767/767, producing 219
  stable series, 772 events and 767 student participations with no orphaned
  rows. Phase 2 adds an authenticated, read-only `/admin/lessons` parity surface
  and a daily 05:45 UTC sweep covering 14 London calendar days back and 42 days
  ahead. The Overview reports both data freshness and GitHub workflow health.
  The first scheduled-style run covered 27 July through 21 September in about
  four seconds: calendar 1,597/1,597 and attendance 1,579/1,579, with zero event
  or participation non-observations. It retained 221 series, caught two changed
  participation records in the overlap, and left all 111 completed Practice Chat
  claims unchanged.
  Failed attempts cannot replace the last verified snapshot, and absence from a
  sweep is labelled “not observed”, never cancelled. No operational reader, MMS
  write or authority cutover exists; MMS remains schedule and attendance truth.
- **Practice Chat is the register (2026-08-10):** attendance had two routes out
  of Quick Access — a MyMusicStaff link that opened the system of record for
  manual marking, and Practice Chat, labelled "For taking homework notes" while
  quietly writing MMS attendance through its delivery flow. Practice Chat is now
  the single signposted route (**Take Attendance + Practice Chat!**), and the
  MyMusicStaff and Theta rows are gone. **MMS is still the system of record** —
  what was removed is the parallel manual route, not the authority; if delivery
  fails the register still has to be opened there. Theta went because the tutor
  side wasn't using it; the student portal keeps its own Theta link, and both
  URL generators stay in `lib/config` for the portal and SetupWizard. Deleting
  that one row also retired a credentials modal, three `useState` hooks and a
  clipboard fallback that nothing else could reach — the component halved.
  **Durable:** the Practice Chat row used to be identified in the render loop by
  its visible label, so renaming the button would have silently sent it to a new
  tab instead of the in-dashboard panel; it carries a stable `id` now. Behaviour
  must never branch on user-facing copy.
- **Acoustic guitar re-tagged (2026-08-08):** 41 of 56 songs gained a skill their
  own `tutorNote` already named; guitar is now **100% covered, 26 distinct skills
  (was 21)**, catalogue 72%. Nothing was removed and no note was reinterpreted —
  these were words sitting in plain text that the original pass did not tag.
  `Steady pulse` and `Evenness` were the big misses ("steady", "even", "without
  rushing", "lock with the backing track" appear constantly); River Man is in
  **5/4** and nothing recorded it. **Guitar's notes are shorter than bass and
  electric's** (median 68 chars vs 95 and 93), so its tags were never wrong,
  there was simply less written down — the shelf looked narrow because it was
  *described* briefly, not taught narrowly.
  **What the remaining blanks do and do not mean:** re-tagging can only surface
  what someone wrote down. Guitar still shows no `Legato`, `Staccato`, `Note
  reading` or `Sight reading`, and that is a documentation gap, not proof the
  repertoire lacks them. **Do not commission songs against blank cells in the
  skill × level matrix** — its trustworthy findings are the structural ones that
  hold regardless of tag quality: bass Debut is one song, Grade 6 is thin on
  every shelf, and no reading strand exists for guitar or electric.
  **Durable rule from the corrections that followed (`4127be2`, `47e617a`): a tag
  means different things in different contexts, so a mapping is only valid where
  it was written.** `picking pattern` → `fingerpicking` is right on acoustic and
  wrong on electric, where picking means a plectrum. `left hand` →
  `hand_position` was wrong everywhere: it says *which hand plays*, not where it
  sits, and it is itself ambiguous between "one hand alone" and "this hand
  carries the melody", so no single mapping could be right. `left hand`/`right
  hand` are filing tags now, and `hands_separately` ("One hand alone", sibling of
  the existing `hands_together`) marks the pieces whose notes really do say one
  hand only. That skill is the **one vocabulary addition made outside the
  December distillation**, justified as correcting a false claim rather than
  growing vocabulary — The Dancing Bear was asserting a skill its note never
  describes. Expect this class of error again on piano: largest tag vocabulary,
  155 songs.
  **Clearest evidence that a `tutorNote` describes the recording, not the
  arrangement:** *I Don't Want to Miss a Thing* is fingerpicked throughout and was
  tagged `strumming`. Its note mentions neither, so the tag was filled in when
  the song was added. Finn caught it by eye; nothing in the notes could have.
- **Bass and Electric Guitar have skills (2026-08-08):** both shelves went from
  **0% to 93% and 90%** — 92 songs tagged, overall coverage 41% → 71%.
  `INSTRUMENTS_WITHOUT_SKILLS` is now empty. Nothing was inferred by rule: each
  song's tags were read off **its own `tutorNote`**, which for these two shelves
  is unusually specific ("syncopated sixteenth-note funk with muting", "ghost
  notes, sit behind the beat"). The 9 songs left untagged are exactly the 9 with
  no tutor note — Rockschool Originals whose scores nobody here has read.
  Inventing what they teach is the same error as inventing an artist.
  18 skills were added for the two instruments; `palm muting` maps to the
  existing `muting` and `chord stabs` to `staccato` + `chord_changes`, because a
  skill earns its own id only when a tutor would work on it separately.
  **Why the gap existed, since it will recur:** the Soundslice ingestion
  pipeline emits `tags: []` and `tutorNote: ''` for every song — RSL supplies
  title, artist, level and scorehash, *never* teaching data. Guitar and Piano
  were seeded entry-by-entry with tags hand-written inline; Bass and Electric
  were bulk-seeded (41 and 48 entries) with no tags at all, and the later
  teaching-notes pass filled `tutorNote` without backfilling `tags`. Any future
  bulk-seeded shelf arrives untagged by default.
- **One tutor is one tutor (2026-08-07):** teaching history showed *"Calum,
  Calum Steel +1 · 2 students"* — the same person twice. Two causes, both fixed.
  The note-to-shelf sync wrote `acting_tutor` into `assigned_by`, but that is a
  **label** (`Self-attested: Calum`) built for the note log's audit column, not a
  name; `assigned_via` already carries the self-attested caveat, so the identity
  column takes the plain name (stripped at the call site and defensively in the
  sync). Underneath that sat a pre-existing, school-wide inconsistency: the
  tutor surface and `assigned_by` use short names while `tutor_name` on notes
  often carries the full name, **and both forms appear in the same column**.
  `resolveTutorName` (`lib/admin/tutor-identity.mjs`) resolves through the
  canonical `ADMIN_TUTORS` roster — a closed-vocabulary lookup that returns an
  unrecognised name unchanged and refuses a name two tutors answer to. It is
  **injected** into the history builder so the roster never reaches the client
  bundle. Live effect: nine tutor identities collapse to the seven real people.
  One mislabelled row was repaired in place. Contract recorded in
  [state tabs](./architecture/data/state-tabs.md) → Format Contracts.
- **Songs know what they teach, and Sheets reads got batched (2026-08-07):**
  the catalogue already held a skills vocabulary nobody had separated out — 68
  tags across 230 songs, roughly two thirds describing a *skill* rather than a
  category. `lib/config/song-skills.mjs` splits teaching vocabulary from filing
  vocabulary and maps the existing tags onto ~30 skills in five areas, so **no
  catalogue entry had to change**; an explicit `skills` list still wins where
  the tags are wrong. Skills show on the Song Browser card. **No automated
  inference** derives skills from prose: the only structural rule is
  `contentType: 'scale'` → scales, because a rule guessing from titles or notes
  would manufacture confident wrong data at catalogue scale. Curation is a
  different act and is allowed — see the tagging pass below.
  `node scripts/song-skills-report.mjs` lists the gaps with each tutor note
  alongside, so a human fills them fast. A test fails when a new tag is neither
  a skill nor declared filing. **Coverage must be judged per instrument, not as
  an average:** this shipped at 41% overall with **Bass and Electric Guitar at
  zero** (Guitar 91%, Piano 50%), and the total hid it because the first test
  measured the total. `INSTRUMENTS_WITHOUT_SKILLS` fails in both directions.
  This is the layer any later difficulty-rating or
  sequencing work needs — "this student keeps struggling with syncopation" is
  unanswerable while the unit of knowledge is the song.
  **Reads:** `prefetchSheetValues(ranges)` fetches several tabs in one
  `batchGet` and warms the cache every existing reader already uses, so call
  sites batch without any adapter changing. Measured live on song-history:
  **cold start 9 requests → 5, steady state 3 → 1.** Also fixed: parallel
  `ensureManagedSheet` calls each missed the metadata cache and spent a request
  each — four tabs cost four requests for one answer on every cold start; the
  in-flight request is now shared. Wired into the busiest path
  (`loadStudentContextCollection`), song-history and insights. Contract in
  [sheets-reads](./architecture/data/sheets-reads.md).
- **A practice note now puts songs on the shelf (2026-08-07):** the shelf fed
  the note (assigned songs are its picker *and* its transcription prompt) but
  nothing fed back, so a tutor saying "we worked on this" produced a link no
  shelf reflected — both linked notes so far name songs the student was never
  assigned. `syncNoteSongsToShelf` closes it, making note-taking able to *create*
  the fact rather than only reference one. **Hooked to the Level 2 delivery
  route, which is where real song links arrive** — both live examples came
  through it, so wiring only the snapshot route would have covered nothing.
  Three rules stop the lower-friction door degrading the stronger one:
  **create-only** (a `done` song named in a recap does not reopen; a tutor's own
  status always wins), **confirmed catalogue ids only** (`unlisted` titles are
  observations, never Song facts), and a new **`assigned_via`** column recording
  which door a row came through — `shelf` rows carry a token-verified
  `assigned_by`, `note` rows carry a self-attested one, because Practice Chat
  authenticates with a shared app secret rather than per-tutor identity. Never
  read `assigned_by` as proven authorship without checking `assigned_via`. New
  rows are born `working`, carry the same status-log entry a shelf assignment
  would, and the write is best-effort after the note is stored — it can never
  cost a tutor the note they spent a lesson making.
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
## Current operating contracts

| Area | Current boundary |
|---|---|
| Context | Student lifecycle, schedule, payment value, and capacity summaries are derived/read-only. They do not become provider truth or authorise actions. |
| Navigation | Overview orients; Planning holds due work, reflection, notes, and initiatives; Workflows holds specialised and recurring processes; Issues handles detected exceptions. Persistent navigation visibly identifies the current section. Student records are reached through search and workflow links. |
| Capacity | MMS `Free` events remain source truth. Waiting-list matches are hints filtered by instrument, never reservations or automatic assignment. |
| Planning | `Planning_Items` is human work state, not a project-management or workflow engine. Friday reflection and Monday scheduling are seeded planning prompts. |
| Pauses | Generic completion never changes payment state. The guarded pause-completion action requires human confirmation, writes through the existing student route, and logs to `Event_Log`. For new guided tutor-absence cancellations, an undated paused-expected flag cannot suppress the dated structured pause card or unlock its final message; only an explicit per-lesson payment-not-needed decision takes the message-only path. |
| Messaging | Parent communication remains approval-first. `Communication_Log` means copied to send, not proven sent; inbound classifications and reply drafts remain proposals. |
| Practice Chat | All registered tutors are enabled unless temporarily constrained. The tutor self-attests, the student must have one clear tutor assignment, the final screen names the server-derived recipient, and PostgreSQL claims the delivery key before MMS/Gmail work. Ambiguous Gmail outcomes require manual follow-up. |
| Lesson mirror | Neon PostgreSQL holds rebuildable MMS observations and stable First Chord series/event/participation IDs. A daily bounded read populates the mirror and `/admin/lessons` exposes parity evidence only. MMS remains schedule and attendance truth; no operational workflow consumes the mirror, and absence from a sweep never proves cancellation. |
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
  assigned. **Shipped 2026-08-07** — see "A practice note now puts songs on the
  shelf" above. The remaining half of the lever is unchanged: the flow exists,
  adoption does not.
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
- **Piano is the last untagged shelf, and the riskiest one to tag.** 77 of 155
  songs carry no skill (50% covered, the other three shelves are 90–100%). The
  gap splits cleanly: **42 have a `tutorNote` to tag from — a short curation pass
  — and 35 do not**, and those 35 need somebody at the score, not another pass
  over prose. `node scripts/song-skills-report.mjs --gaps` lists both.
  Two cautions specific to piano, both learned the hard way on the other shelves.
  First, it has the **largest tag vocabulary**, so expect the mapping-context
  error class described in "Acoustic guitar re-tagged" above — `left hand` →
  `hand_position` was exactly this and came from piano. Check what each existing
  mapping asserts before reusing it. Second, the coverage doc the `add-song`
  skill tells you to read "first, every time" moved to
  [song catalogue coverage](./reference/song-catalogue-coverage.md); the skill
  still pointed at the old `docs/admin/` path, so every run of it began by
  failing to find its own stated authority — plausibly how *I Don't Want to Miss
  a Thing* was given `strumming`. The skill was corrected 2026-08-11. **A
  user-level skill can rot silently against a repo that moved**: `docs:check`
  guards paths inside this repo and cannot see `~/.claude/skills/`.
- **The FC levelled path (guitar, bass, piano) targeted for 2027 — what the
  skills layer can and cannot contribute.** The skill × level matrix per
  instrument is buildable now and is **one input, not the syllabus**. Trust its
  structural findings (bass Debut is one song; Grade 6 is thin on every shelf; no
  reading strand exists for guitar or electric) and distrust its blank cells, for
  the reason recorded above. The intended sequence is **December distillation
  first, commissioning briefs second** — briefs written before then rest on tags
  no tutor has confirmed. Booked as `planning_song_loop_distillation` in
  `Planning_Items`, target **2026-12-07**, owner Finn, with a stop condition in
  its notes: under ~40 `Song_Outcomes` rows across more than one tutor, re-book
  rather than run. Recipe: `docs/plans/parked/song-loop-distillation.md`.
  **The test that decides whether the skills layer earned its place:** can you
  ask a question about a student that names a skill and get a true answer —
  *"has this student met syncopation before, and how did it go?"* If December's
  data supports that, the aggregate views (skill history per student, "what
  next" by skill overlap) become worth building. Until then they would be built
  on an unconfirmed draft, and a confidently wrong suggestion costs more trust
  than no suggestion.
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
