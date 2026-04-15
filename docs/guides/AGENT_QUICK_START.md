# Agent Quick Start — Music School Dashboard

**For AI agents working on the FirstChord student portal.**

Last updated: April 2026

---

## Orientation

**Project**: FirstChord Music School Dashboard (Next.js)
**Live site**: https://efficient-sparkle-production.up.railway.app
**Deployment**: Railway auto-deploys on `git push` to main

This is one of three FirstChord projects. Read the root `FirstChord/CLAUDE.md` first — it explains what lives where and what you must never touch.

---

## The Single Most Important Rule

**Edit `students-registry.js`, then run `generate-configs`. Never edit the other config files directly.**

```
lib/config/students-registry.js   ← THE ONE FILE YOU EDIT
```

All other config files are generated from it:

```
lib/student-url-mappings.js       ← GENERATED
lib/student-helpers.js            ← GENERATED
lib/soundslice-mappings.js        ← GENERATED
lib/config/theta-credentials.js   ← GENERATED
lib/config/instruments.js         ← GENERATED
```

Every generated file has a `// GENERATED — do not edit directly` header at line 1.

---

## Most Common Task: Add a Student

**Use the built-in skill:**

```
/add-student
```

The skill will prompt you for all required fields and handle the registry edit + config regeneration automatically.

**Manual process (if needed):**

1. Add the student block to `lib/config/students-registry.js` following existing patterns
2. Run `npm run generate-configs` to regenerate all 5 derived files
3. Run `npm run validate` to check for errors
4. Test: `npm run dev` → visit `localhost:3000/[name]`
5. Deploy: `git add . && git commit -m "feat: add [name]" && git push`

---

## Students Registry Format

```js
// lib/config/students-registry.js
'sdt_XXXXXX': {
  name: 'First Last',
  tutor: 'TutorFirstName',
  url: 'firstname',               // friendly URL slug (lowercase)
  soundslice: 'https://...',      // Soundslice course URL (or null)
  theta: 'firstnamefc',           // Theta Music username/password
  instrument: 'Guitar',           // Piano | Guitar | Voice | Bass | Piano / Guitar | etc.
},
```

**URL conflict resolution**: if `firstname` is taken, use `firstname-lastinitial` (e.g. `olivia-w`).

---

## Add a Tutor

1. Add tutor to the dropdown in `app/dashboard/page-client.js`
2. Add teacher ID mapping in `lib/mms-client.js`
3. Add their students to `students-registry.js` + run `generate-configs`
4. Deploy

---

## Upstream: first-chord-brain

The dashboard is the *consumer* of student data. The *source* is:

- **Google Sheet "First Chord Database"** — Students tab
- **`first-chord-brain/`** — identity layer, onboarding CLI

If a student is missing an MMS ID, Stripe data, or lesson length, fix it upstream in first-chord-brain, not here.

---

## Deploy

```bash
npm run build          # always test first
git add .
git commit -m "feat: ..."
git push               # Railway auto-deploys (2-3 min)
```

Verify: https://efficient-sparkle-production.up.railway.app

---

## Forbidden

- Do not edit generated config files directly
- Do not touch the Google Apps Script (shared with Payment Pause)
- Do not write to Stripe columns anywhere in this project
- Do not commit `.env` files
- Do not `git push --force` to main

---

## Quick Reference

| Thing | Where |
|---|---|
| Add/edit student | `lib/config/students-registry.js` |
| Regenerate configs | `npm run generate-configs` |
| Validate data | `npm run validate` |
| Tutor dropdown | `app/dashboard/page-client.js` |
| Teacher ID mappings | `lib/mms-client.js` |
| Student count | 199 active (April 2026) |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Student portal 404 | Check `students-registry.js` entry exists and `generate-configs` was run |
| Notes not loading | Verify MMS ID format (`sdt_XXXXXX`) and that student exists in MMS |
| Wrong instrument shown | Update `instrument` field in registry, re-run generate-configs |
| Soundslice missing | Add `soundslice` URL to registry entry, re-run generate-configs |
| Theta missing | Add `theta` credential to registry entry, re-run generate-configs |
| Tutor shows no students | Verify teacher ID in `lib/mms-client.js` |
| Build fails | Check for syntax errors (missing commas/brackets) in registry |

---

## Context Recovery

```bash
git log --oneline -10
git status
cat lib/config/students-registry.js | grep -c "sdt_"   # student count
npm run build
```
