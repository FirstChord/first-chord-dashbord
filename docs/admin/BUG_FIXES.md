# Bug Fixes And Recovery Notes

Short notes for production issues we have already seen and how to recover them.

## Active student missing from a tutor's dashboard

**Date:** 18 Jun 2026

**Symptom**

- An active student is present in the registry, the Google Sheet, MMS, and Stripe, but does **not** appear on their tutor's `/dashboard` roster. First seen with Santi Freeth (Finn) — and it was simultaneously hiding 7 of Finn's 32 active students.

**Root cause**

- The roster comes live from MMS via `getStudentsForTeacher()` in `lib/mms-client.js`. Its post-fetch filter checked `StudentGroups` first and `return`ed on it, skipping the `BillingProfiles` fallback. Students whose MMS teacher link lives only in `BillingProfiles`, but who also carry an empty `StudentGroups` entry (`[{}]`, `length === 1`), matched nothing in `StudentGroups` and were dropped before `BillingProfiles` was ever checked.

**How to confirm**

```bash
# 1. Prove it's not a deletion — student should be active across systems:
python3 brain.py lookup "Student Name"     # from first-chord-brain/

# 2. Inspect their MMS record. The signature is a teacher link in BillingProfiles
#    with an empty StudentGroups. Query /search/students with
#    Statuses:["Active"], TeacherIDs:[<teacherId>] and read the student's
#    StudentGroups vs BillingProfiles (teacher IDs map is in lib/mms-client.js).
```

**Fix (applied 18 Jun 2026)**

- Keep the student if **either** `StudentGroups` **or** `BillingProfiles` links to the teacher (no early return). Do **not** edit the registry/Sheet to "add them back" — those are already correct; the bug is in the MMS-derived roster filter only.

## Railway 502 on tutor dashboard

**Date:** 20 May 2026

**Symptom**

- `https://efficient-sparkle-production.up.railway.app/dashboard` returned `502 Bad Gateway`.
- Railway edge responded, but the app service did not return a healthy response.
- Railway UI also showed `Limited Access` / deploys paused temporarily.

**What was checked**

```bash
curl -I https://efficient-sparkle-production.up.railway.app/dashboard
npm run build
railway whoami
railway status
railway logs
railway domain
```

**Findings**

- Local production build passed.
- Local production start path was healthy.
- The repo was not initially linked to Railway locally.
- Railway project `efficient-sparkle` had two relevant services:
  - `efficient-sparkle`
  - `first-chord-dashbord`
- The old public URL was attached to service `efficient-sparkle`:
  - `https://efficient-sparkle-production.up.railway.app`
- The other service had a separate healthy domain:
  - `https://first-chord-dashbord-production-d599.up.railway.app`
- `first-chord-dashbord` was serving `/dashboard` with `200`.
- `efficient-sparkle` stayed at `502` until Railway access/deploy state was cleared and the service was redeployed/uploaded again.

**Recovery steps**

1. Clear any Railway `Limited Access` / paused deploy state in the Railway web dashboard.
2. Link the local repo if needed:

```bash
cd ~/Desktop/FirstChord/music-school-dashboard
railway login
railway link
```

3. Select:
   - Project: `efficient-sparkle`
   - Environment: `production`
   - Service for old public URL: `efficient-sparkle`

4. Confirm the linked service and domain:

```bash
railway status
railway domain
```

5. If the app code builds locally:

```bash
npm run build
```

6. Try redeploying the latest deployment:

```bash
railway redeploy
```

7. If the old domain still returns `502`, upload the current repo:

```bash
railway up --detach
```

8. Verify:

```bash
curl -I https://efficient-sparkle-production.up.railway.app/dashboard
curl -I https://first-chord-dashbord-production-d599.up.railway.app/dashboard
```

Both should return `200`.

**Likely cause**

This was not a dashboard code bug. It looked like a Railway service/domain/deployment state issue: the old public domain was attached to a service that was not serving traffic, while another service in the same project was healthy.

**Watch out for**

- Do not assume a successful GitHub push has affected the Railway service that owns the public URL.
- Check which Railway service owns the domain before redeploying.
- If Railway says deploys are paused, clear that in the web UI before expecting CLI redeploys to work.
- Keep the current public URL and service mapping documented:
  - Public legacy URL: `efficient-sparkle-production.up.railway.app`
  - Owning service: `efficient-sparkle`
  - Secondary healthy service URL: `first-chord-dashbord-production-d599.up.railway.app`

## Railway project split

**Date:** 13 June 2026

**Finding**

The Railway account currently has three relevant projects:

- `pure-spontaneity`: full admin/API runtime, domain `https://first-chord-dashbord-production.up.railway.app`.
- `efficient-sparkle`: legacy/public tutor-student dashboard runtime, domains `https://efficient-sparkle-production.up.railway.app` and `https://first-chord-dashbord-production-d599.up.railway.app`.
- `awake-connection`: Practice Chat speech relay, domain `https://enhanced-music-lesson-notes-production.up.railway.app`.

`efficient-sparkle` serves `/dashboard`, but it does not have the full admin/Gmail/Sheets/Stripe env set. `/admin` on the old public domain can therefore fail with auth configuration errors. Practice Chat Level 2 writebacks should target `pure-spontaneity`, not whichever dashboard domain happened to generate the link.

**Fix**

Practice Chat quick links now use the canonical admin/API app for production writebacks:

```text
https://first-chord-dashbord-production.up.railway.app
```

Local links still use the local dashboard origin, so `localhost:3000` plus local Practice Chat remains testable.
