---
status: supporting
audience: [human, agent]
last_verified: 2026-07-26
---
# Known Failure Signatures

Use this for recurring production signatures whose diagnosis is not obvious.
Git history owns the incident chronology.

## GitHub Registry 401 Breaks Admin And Incoming Inbox

**Signature:** the dashboard or incoming-message PWA raises
`GitHub registry fetch failed: 401`; the Railway server exception may surface as
a generic application-error digest. A First Chord Brain config-regeneration
workflow can independently fail during checkout with `Bad credentials`.

Treat these as separate credential lanes:

- Railway `GITHUB_TOKEN` serves dashboard registry reads/writes and workflow
  health.
- GitHub Actions should use its repository-provided `GITHUB_TOKEN`; do not pass
  a long-lived custom dashboard token to checkout.

For Railway recovery, rotate the dedicated fine-grained token using the
repository/permission boundary in
[the runbook](../runbook.md#if-github-registry-auth-is-failing), deploy the
staged variable change, then verify registry reads, workflow health, and one
normal registry edit through its existing human approval boundary.

Dashboard registry reads fall back to the snapshot bundled into the deployed
commit when GitHub is unavailable. The fallback is deliberately read-only:
registry writes require a fresh authenticated read and fail closed. Do not
enable stale writes or use an end-of-life Node override to mask an authentication
failure.

## Active MMS Student Missing From Tutor Roster

**Signature:** a student is active in MMS/registry/Sheets but absent from the
tutor's `/dashboard` roster.

The roster is derived live by `getStudentsForTeacher()` in
`lib/mms-client.js`. MMS can express the teacher relationship through either
`StudentGroups` or `BillingProfiles`; an empty object in `StudentGroups` is not
proof that the student belongs to no tutor.

Diagnosis:

1. verify the MMS student is Active and the tutor ID/date are correct
2. inspect both `StudentGroups` and `BillingProfiles`
3. confirm either lane links the expected teacher

The filter must retain a student linked through either lane. Do not edit the
registry or Sheet to compensate when they are already correct. Add a focused
fixture if MMS introduces a new relationship shape.

## Railway Domain Returns 502

**Signature:** Railway edge responds but one dashboard domain returns 502 while
another service/domain may be healthy.

First establish ownership before redeploying:

```bash
railway status
railway domain
curl -I https://<affected-domain>/dashboard
```

Then:

1. confirm the correct project/environment/service from
   [repository environment](../../reference/repository-environment.md)
2. clear any Railway Limited Access or paused-deploy state
3. run the local production build
4. redeploy the last known-good commit to the service that owns the domain
5. verify the affected URL and the canonical admin URL separately

A successful GitHub push or a healthy sibling Railway service does not prove the
domain-owning service deployed. Avoid changing application code until service,
domain, deployment, and environment mapping have been checked.

## Wrong Runtime For Practice Chat Writes

The full admin/API service owns Practice Chat writeback, Gmail, Sheets, Stripe,
and admin auth. The legacy public tutor/student service does not carry that full
environment. Production Practice Chat API calls must target the canonical admin
base URL from [repository environment](../../reference/repository-environment.md),
not whichever public dashboard domain generated a link.

When adding a durable signature, keep only symptom, distinguishing evidence,
safe recovery, and the invariant that prevents recurrence.
