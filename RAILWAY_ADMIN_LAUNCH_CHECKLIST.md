# Railway Admin Launch Checklist

This checklist is for getting the private FirstChord admin dashboard onto Railway so Finn and Tom can use it as an internal tool.

This is a V1 internal launch checklist, not a final production-readiness checklist.

## 1. Confirm Current Scope

What should work after deploy:
- admin login
- admin overview
- students list + student detail edits
- waiting list
- onboarding
- flags/issues

What is still intentionally manual in V1:
- `generate_fc_ids.py`
- GitHub push/deploy of repo changes when working locally

## 2. Railway Service

Confirm this app is the service being deployed:
- repo: `music-school-dashboard`
- runtime: Next.js
- current Railway config: [railway.json](./railway.json)

Current start path:
- build via Nixpacks
- start with `npm start`

## 3. Required Railway Environment Variables

Set these in Railway before testing the admin surface:

### Admin auth
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_ALLOWED_EMAILS`

### Google Sheets
- `GOOGLE_SPREADSHEET_ID`
- `SHEETS_REFRESH_TOKEN`
- `SHEETS_CLIENT_ID`
- `SHEETS_CLIENT_SECRET`

### MMS
- `MMS_BASE_URL`
- `MMS_BEARER_TOKEN`
- `MMS_DEFAULT_BILLING_RATE`
- `MMS_BILLING_EVENT_CATEGORY_ID`
- `MMS_FIRST_LESSON_EVENT_CATEGORY_ID`

### Registry write path
- `GITHUB_TOKEN`

### Existing optional envs used by onboarding output
- `STRIPE_PAYMENT_LINK` or `PAYMENT_LINK`
- `HANDBOOK_URL`

### Existing tutor/student dashboard compatibility
These are still used by older non-admin routes in the same Next.js app:
- `MMS_DEFAULT_TOKEN`

### Notes
- `GITHUB_TOKEN` is required for production registry writes from the admin dashboard.
- `MMS_BILLING_EVENT_CATEGORY_ID` is strongly recommended even though the code has a fallback default.
- `NEXTAUTH_URL` should be the full Railway app URL.

## 4. Google OAuth Configuration

Update the Google OAuth app used for admin login.

Authorized redirect URIs should include:
- local:
  - `http://localhost:3000/api/auth/callback/google`
- Railway:
  - `https://<your-railway-domain>/api/auth/callback/google`

Also set:
- `NEXTAUTH_URL=https://<your-railway-domain>`

## 5. Pre-Deploy Sanity Check

Before pushing:
- `npm run test:admin`
- `npm run build`

Current expected status:
- tests pass
- build passes
- metadata viewport warnings are non-blocking

## 6. Deploy

1. Push the current branch to the repo connected to Railway
2. Let Railway build and deploy
3. Confirm the deployed app loads

## 7. Production Smoke Test

After deploy, test in this order:

### Auth
- visit `/admin/login`
- confirm Google sign-in works
- confirm only allowed emails can access

### Admin pages
- `/admin`
- `/admin/students`
- `/admin/students/[mmsId]`
- `/admin/waiting`
- `/admin/flags`

### Writes
- edit a Sheets-lane field on a student
- edit a registry-lane field on a student
- confirm both persist

### Onboarding
- test one real safe onboarding case
- confirm:
  - Sheets row created
  - registry entry created
  - MMS activation succeeds
  - billing profile succeeds
  - lesson creation succeeds
  - recurring series behaves as expected

## 8. Known V1 Caveats After Launch

These are still expected after Railway launch:
- post-onboarding FC regeneration is manual
- post-onboarding dashboard config regeneration is handled by GitHub Actions after registry changes are pushed
- issue state is not yet persistent
- onboarding recovery/resume is not yet implemented
- `Review_Flags` freshness is not yet surfaced clearly

## 9. Recommended Launch Mode

Treat the first Railway version as:
- internal only
- Finn + Tom only
- limited-scope operational use
- still being hardened

This is appropriate for current V1 maturity.

## 10. Next Best Steps After Launch

1. recurring lesson dedup live verification
2. registry write retry live verification
3. verify the `generate-configs` GitHub Action runs on registry changes
4. prepare `generate_fc_ids.py` for GitHub Actions
