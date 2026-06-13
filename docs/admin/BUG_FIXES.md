# Bug Fixes And Recovery Notes

Short notes for production issues we have already seen and how to recover them.

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
