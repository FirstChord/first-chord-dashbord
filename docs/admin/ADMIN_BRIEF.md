# First Chord Admin Dashboard — V1 Brief

**For:** Codex / any agent implementing the admin dashboard
**Read first:** `../../../first-chord-brain/CONTEXT.md`, `../../../first-chord-brain/DATA_DICTIONARY.md`, and `./OWNERSHIP_MATRIX.md`
**Stack:** Next.js (this repo), deployed on Railway. Admin is a new `/admin` route group added to this existing app.

---

## Current State Addendum (May 2026)

This brief started as a V1 implementation guide. Several important parts are now outdated unless overridden here.

- The admin dashboard is now live on Railway and in active internal use.
- `generate-configs` is automated through GitHub Actions and production onboarding already updates the tutor/student dashboard pipeline successfully.
- `generate_fc_ids.py` is now automated in the `first-chord-brain` repo via GitHub Actions, using env-based Sheets credentials and a cross-repo checkout of `first-chord-dashbord`.
- `/admin` now includes an operational health panel covering:
  - MMS API health
  - latest `generate-configs` workflow status
  - latest `regenerate-fc-ids` workflow status
  - review-flags freshness
- `/admin/flags` now shows review-flags freshness and includes the first Stripe-derived issue rules.
- `payment_mode` now exists in the admin student model and should be treated as canonical payment intent in the `Students` sheet.

For latest implementation detail, prefer:
- `ADMIN_IMPLEMENTATION_LOG.md`
- `V2_SPEC_DRAFT.md`
- `OWNERSHIP_MATRIX.md`

## Architectural Clarifications (Overrides anything contradictory below)

These answer specific implementation questions. Read before the rest of the brief.

**1. Review flags source on Railway**
Read from Google Sheets `Review_Flags` tab — not a filesystem path. `generate_fc_ids.py` now writes this tab automatically alongside the other FC tabs. Fields: `flag_type`, `mms_id`, `student_name`, `detail`, `generated_date`. No filesystem dependency anywhere in the admin dashboard.

**2. FC Student ID rule**
Do not generate FC IDs in the UI. Display whatever is stored in the `fcStudentId` field of `students-registry.js` or `FC Student ID` in Sheets. At onboarding time, generate using `sha256(forename:surname:email)[:8]` (pre-MMS seed). This ID may later change when `generate_fc_ids.py` runs and resolves it from the MMS ID — that is a known documented limitation, not a bug to fix.

**3. Tutor source-of-truth (three explicit rules)**
- **Display:** Sheets `Tutor` column is current truth for display
- **Edits write to:** Sheets only (the registry `tutor` short name is for portal routing, not admin edits)
- **When MMS disagrees with Sheets:** show a yellow info badge on the student card — do not auto-sync, do not block editing

**4. Server-side shell exec: none**
No shell exec in the dashboard app. Flag freshness and FC regeneration now come from the hosted GitHub Actions workflow in `first-chord-brain`, not from local browser-triggered shell commands.

**5. Onboarding completion model**
"Registry write now, hosted jobs complete the rest" is the current model.
- dashboard-side config regeneration is hosted via GitHub Actions
- FC regeneration is hosted via GitHub Actions in `first-chord-brain`
- the admin UI should surface status/freshness rather than rely on manual terminal reminders where possible

**6. Next.js route structure**
This app uses App Router. Use `app/api/admin/...` everywhere. The shorthand `api/admin/...` in the file structure section below is incorrect — treat `app/api/admin/...` as authoritative.

**7. Duplicated logic (tutor list, welcome message)**
Acceptable V1 stopgaps if placed in `lib/admin/` and each function carries a comment: `// TODO: replace with Brain API call when Brain is deployed`. Do not scatter logic into components.

**8. Review flags UX**
All flagged students are fully editable. No flag category restricts any action. Show a badge/warning — never a lock.

**9. Payment mode**
`payment_mode` in the `Students` sheet is now the canonical payment-intent field for the admin dashboard.
- allowed values:
  - `stripe`
  - `manual`
  - `unknown`
- only `stripe` students should receive Stripe setup/failure issues
- `manual` is for approved cash/bank-transfer exceptions and should suppress Stripe alarms

---

## What This Is

A private web dashboard for Finn and Tom to manage the school without needing terminal access. Replaces the `first-chord-brain` CLI for routine daily tasks.

Both users see everything. No role separation in V1.

---

## Architecture Principles (Read Before Writing Any Code)

1. **Two canonical stores — never cross-write between them:**
   - `Google Sheets Students tab` — identity, contact info, tutor, instrument, Stripe
   - `lib/config/students-registry.js` — portal config only (Soundslice URL, Theta username, friendlyUrl)

2. **Never edit generated files directly.** Only `students-registry.js` is manually edited. All other config files in `lib/config/` and `lib/` are derived via `npm run generate-configs`.

3. **Brain-as-API is Phase 2.** For V1, the admin dashboard calls Google Sheets and MMS directly from Next.js API routes. Structure all data-fetching as clean service functions (`lib/admin/sheets.ts`, `lib/admin/mms.ts`) so they can be swapped for Brain API calls later without touching the UI.

4. **No git push / generate-configs from the browser in V1.** After a browser onboarding writes to `students-registry.js` via GitHub API, Finn runs `npm run generate-configs && git push` once from terminal to deploy. This is explicitly acceptable for V1.

5. **Known data quality issues exist.** There are 28 known review flags (6 tutor conflicts, 12 registry-only, 10 Sheets-only). These are tracked, not broken. Surface them clearly; do not try to auto-fix them.

---

## Auth

**Method:** NextAuth.js with Google OAuth provider
**Restriction:** Allowlist of permitted Google email addresses via env var
**Env var:** `ADMIN_ALLOWED_EMAILS=finn@example.com,tom@example.com` (comma-separated)
**Middleware:** All `/admin/*` routes and `/api/admin/*` routes require an active session matching the allowlist. Redirect unauthenticated requests to `/admin/login`.

```
# New env vars needed (add to Railway + .env.local):
NEXTAUTH_SECRET=<random string>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
ADMIN_ALLOWED_EMAILS=finn@...,tom@...
```

The existing `~/token_musiclessons.json` OAuth flow is for server-side Sheets writes only and is separate from user auth.

---

## Data Sources

### Google Sheets (server-side only)
Use the same auth pattern as `first-chord-brain/src/sheets_client.py` — refresh token from `~/token_musiclessons.json`. In Next.js this means reading the token from the filesystem or an env var at server startup.

Recommended: copy the token fields into env vars (`SHEETS_REFRESH_TOKEN`, `SHEETS_CLIENT_ID`, `SHEETS_CLIENT_SECRET`) rather than reading from a file path, so it works in Railway without filesystem access.

**Spreadsheet ID:** `GOOGLE_SPREADSHEET_ID` (already in env)
**Tab to read:** `Students`

### MMS API
**Base URL:** `https://api.mymusicstaff.com/v1`
**Auth:** `Authorization: Bearer {MMS_BEARER_TOKEN}` + `x-schoolbox-version: main` headers
**Env var:** `MMS_BEARER_TOKEN` (already in `.env`)
**Key endpoints:**
- `POST /search/students` with `{ Statuses: ["Waiting"] }` + `params: { fields: "Family" }` — waiting list
- `GET /students/{mmsId}?fields=Family` — full student record including parent telephone

### students-registry.js
Import directly — it's in the same repo at `lib/config/students-registry.js`. For reads, just import `STUDENTS_REGISTRY`. For writes (onboarding), use the GitHub Contents API (see Onboarding section).

---

## V1 Pages

### `/admin` — Home
Quick stats only. No data entry.
- Total active students (count from Sheets)
- Students on waiting list (count from MMS)
- Open review flags (count from flags file)
- Links to the four main sections

### `/admin/students` — Student List
- Table of all students from Sheets `Students` tab
- Columns: Name, Tutor, Instrument, Email, Contact Number, MMS ID
- Search by name (client-side filter)
- Filter by tutor (dropdown)
- Each row links to `/admin/students/[mmsId]`
- Show a badge on any student who has a review flag

### `/admin/students/[mmsId]` — Student Detail + Edit
Two-pane view:
- **Left:** merged record — Sheets fields (identity/contact lane) + registry fields (portal lane) side by side
- **Right:** edit form

**Edit form rules (follow DATA_DICTIONARY.md field lanes strictly):**
- Sheets lane (writes to Sheets `Students` tab): Student name, Tutor, Instrument, Lesson length, Parent name, Parent email, Contact Number
- Portal lane (writes to `students-registry.js` via GitHub API): Soundslice URL, Theta username
- Never write a Sheets-lane field to registry or vice versa
- Stripe fields (`stripe_customer_id`, `stripe_subscription_id`) are **read-only display only** — Payment Pause owns these
- FC Student ID is **read-only display only** — never editable

### `/admin/waiting` — Waiting List
- Fetch from MMS `POST /search/students` with `Statuses: ["Waiting"]`
- Table: Student name, Date added (colour-coded: yellow = 60+ days, red = 90+ days), Parent name, Parent email
- "Onboard" button on each row → navigates to `/admin/onboard?mmsId=sdt_XXX` with data pre-filled

### `/admin/onboard` — Onboarding Form
Browser replacement for `python3 brain.py onboard`. Executes the same WGCS steps.

**Form fields (all pre-filled from MMS if arriving from waiting list):**
- Student first name, last name
- Is adult? (auto-detect: age ≥ 19)
- Parent/contact name, email, contact number (from MMS `Family.Parents[0]`)
- Instrument (normalised: Guitar, Piano, Bass, Ukulele, Singing)
- Lesson length (default: 30)
- Lesson day, time, first lesson date
- Tutor (dropdown filtered by instrument, from tutor list in `mms_client.py`)
- Experience level (1 = beginner, 2 = some experience, 3 = intermediate)
- Interests / genres
- Soundslice URL
- Theta username (auto-generated: `firstname + lastname + "fc"`, lowercase, no spaces)

**On submit, execute in order:**
1. **G — Sheets write:** POST to `/api/admin/onboard` which writes to Sheets `Students` tab. Insert in correct tutor section (after last row matching tutor full name). Fields per DATA_DICTIONARY.
2. **C — MMS calendar:** POST to MMS `POST /events` to create first lesson. See `mms_client.py → create_lesson()` for payload shape.
3. **W / S / S / 🏘️ — Manual steps:** After automated steps complete, show a checklist panel with copy-paste messages for: WhatsApp group notification, welcome message (personalised), Soundslice follow-up message, community WhatsApp invite. These are not automated — just display the generated text for Finn/Tom to send manually.
4. **Registry write:** Use GitHub Contents API to append the new student entry to `students-registry.js`. See Registry Write section below.
5. **FC layer:** Show a note: "Run `python3 generate_fc_ids.py` in first-chord-brain to update identity layer."

**Welcome message template** lives in `first-chord-brain/src/templates.py` → `generate_welcome_message()`. Port the logic to TypeScript or call it via a Python subprocess. For V1, porting the template to TS is cleaner.

### `/admin/flags` — Review Queue
- Read `first-chord-brain/exports/fc_identity_layer/review_flags.txt`
- Parse into three groups: `TUTOR CONFLICT`, `REGISTRY ONLY`, `SHEETS ONLY`
- Display each group as a collapsible table with MMS ID, student name, detail
- "Dismiss" action (marks as acknowledged in a local JSON file — does not fix the underlying data)
- "Regenerate flags" button — triggers `python3 generate_fc_ids.py` via a server-side shell exec (this one exec call is acceptable in V1 since it's read-only from the UI's perspective)
- Note at top: "28 known flags as of April 2026. These are tracked defects, not system failures."

---

## Registry Write via GitHub API

When onboarding completes, append the new student to `students-registry.js` using the GitHub Contents API. No shell exec required.

```
GET  https://api.github.com/repos/FirstChord/first-chord-dashbord/contents/lib/config/students-registry.js
→ get current content (base64) + sha

PATCH with:
  - content: base64(updated file content)
  - sha: from GET
  - message: "feat: add {Name} ({mmsId}) to {tutor}'s students"
```

**Entry format** (match exactly what `_update_dashboard_registry` in `onboarding.py` generates):
```js
  'sdt_XXXXXXX': {
    firstName: 'Firstname',
    lastName: 'Lastname',
    friendlyUrl: 'firstname',          // or firstname-x if collision
    tutor: 'Short',                    // short name e.g. 'Arion'
    instrument: 'Guitar',
    soundsliceUrl: 'https://www.soundslice.com/courses/XXXXX/',
    thetaUsername: 'firstnamelastnamefc',
    fcStudentId: 'fc_std_XXXXXXXX',
  }, // Firstname Lastname
```

Insert before the closing `};` of the `STUDENTS_REGISTRY` object.

**Env var needed:** `GITHUB_TOKEN` with `contents:write` permission on the `first-chord-dashbord` repo.

After this commit, Railway auto-deploys but `generate-configs` has not run yet. The student will be in the registry but derived config files will be stale. Finn runs `npm run generate-configs && git push` once from terminal to complete. This is a known V1 limitation.

---

## FC Student ID Generation

Use the same deterministic algorithm as `first-chord-brain/src/onboarding.py`:

```ts
import { createHash } from 'crypto'

function generateFcStudentId(forename: string, surname: string, email: string): string {
  const seed = `${forename.trim().toLowerCase()}:${surname.trim().toLowerCase()}:${email.trim().toLowerCase()}`
  return `fc_std_${createHash('sha256').update(seed).digest('hex').slice(0, 8)}`
}
```

---

## Tutor List

The canonical tutor list lives in `first-chord-brain/src/mms_client.py`. For the admin dashboard, duplicate the list as a TypeScript constant in `lib/admin/tutors.ts`. When tutors change, update both files. (Unifying them is a Phase 2 task when Brain becomes an API.)

The 16 active tutors and their short names, full names, MMS teacher IDs, and instruments are documented in `first-chord-brain/CONTEXT.md` → Tutor Roster.

---

## Instrument Normalisation

Always normalise instrument input to one of: `Guitar`, `Piano`, `Bass`, `Ukulele`, `Singing`. Map using this priority order (bass before guitar to handle "Bass Guitar"):

```ts
function normaliseInstrument(raw: string): string {
  const r = raw.toLowerCase()
  if (r.includes('piano') || r.includes('keyboard')) return 'Piano'
  if (r.includes('ukulele') || r.includes('uke')) return 'Ukulele'
  if (r.includes('singing') || r.includes('voice') || r.includes('vocal')) return 'Singing'
  if (r.includes('bass')) return 'Bass'
  if (r.includes('guitar')) return 'Guitar'
  return raw.split('&')[0].trim()
}
```

---

## File Structure

Add under the existing Next.js app:

```
lib/
  admin/
    sheets.ts       ← Sheets read/write functions
    mms.ts          ← MMS API functions
    tutors.ts       ← Tutor list (ported from mms_client.py)
    fc.ts           ← FC ID generation, instrument normalisation
    github.ts       ← GitHub Contents API for registry writes
app/
  admin/
    layout.tsx      ← Auth guard (redirect if not in allowlist)
    page.tsx        ← Home / stats
    students/
      page.tsx      ← Student list
      [mmsId]/
        page.tsx    ← Student detail + edit
    waiting/
      page.tsx      ← Waiting list
    onboard/
      page.tsx      ← Onboarding form
    flags/
      page.tsx      ← Review queue
    login/
      page.tsx      ← Google OAuth sign-in page
api/
  admin/
    students/
      route.ts            ← GET (list),
      [mmsId]/route.ts    ← GET (detail), PATCH (edit)
    waiting/route.ts      ← GET
    onboard/route.ts      ← POST
    flags/route.ts        ← GET, POST (dismiss)
  auth/
    [...nextauth]/route.ts ← NextAuth handler
```

---

## V1 Explicitly Out of Scope

- Triggering `npm run generate-configs` from the browser (Phase 2)
- Triggering Railway deploy from the browser (Phase 2)
- Brain-as-API (Phase 2)
- Payment pause / Stripe management (stays in payment-pause-pwa)
- Deleting students
- Adding/editing tutors
- Any MMS data writes other than creating a first lesson at onboarding
- WhatsApp / SMS sending (future — phone numbers are now captured for this)
- Bulk operations

---

## Known Data Quality Context

Do not treat these as bugs to fix — surface them clearly and let Finn/Tom decide:

- **6 TUTOR CONFLICT flags** — registry and Sheets disagree on which tutor a student has. Real mismatches, not format noise (the comparison already normalises full vs short name).
- **12 REGISTRY ONLY** — student has a dashboard page but no Sheets row
- **10 SHEETS ONLY** — student is in Sheets but has no dashboard page (no registry entry)

Source of flags: `first-chord-brain/exports/fc_identity_layer/review_flags.txt`
Regenerate with: `python3 generate_fc_ids.py` (from `first-chord-brain/`)

---

## Credentials Summary

| What | Where | How to use in Next.js |
|---|---|---|
| Google Sheets token | `~/token_musiclessons.json` | Copy fields to env vars: `SHEETS_REFRESH_TOKEN`, `SHEETS_CLIENT_ID`, `SHEETS_CLIENT_SECRET` |
| Sheets spreadsheet ID | `.env` → `GOOGLE_SPREADSHEET_ID` | Already available |
| MMS Bearer token | `.env` → `MMS_BEARER_TOKEN` | Already available |
| GitHub token | Add new → `GITHUB_TOKEN` | `contents:write` on `FirstChord/first-chord-dashbord` |
| NextAuth secret | Add new → `NEXTAUTH_SECRET` | Any random string |
| Google OAuth app | Create in Google Cloud Console | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Admin email allowlist | Add new → `ADMIN_ALLOWED_EMAILS` | Comma-separated Google emails |

---

## Suggested Build Order

1. Auth (NextAuth + allowlist middleware) — no useful admin page without this
2. `/admin/students` list (read-only, just Sheets) — proves the data layer works
3. `/admin/students/[mmsId]` detail view (read-only first, then add edit)
4. `/admin/waiting` list (MMS call)
5. `/admin/onboard` form (hardest — most moving parts)
6. `/admin/flags` queue (read-only first pass)
7. Home stats page (last — easy once data layer exists)
