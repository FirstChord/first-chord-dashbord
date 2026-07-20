---
status: canonical
audience: [human, agent]
last_verified: 2026-07-20
---
# Disaster Recovery

## Recovery Scope

First Chord depends on several independent stores. A Railway redeploy restores
code, not the state held in Sheets or PostgreSQL.

| Loss | Impact | Recovery evidence |
| --- | --- | --- |
| Google Sheet | Students, workflow state, logs, payroll review, assignments | Restore the latest complete local backup to a scratch Sheet, verify, then promote |
| Railway app | Dashboard, portals, APIs, crons | Redeploy a known-good GitHub commit and restore the canonical service variables |
| Railway PostgreSQL | Practice Note delivery claims and cross-instance duplicate-send protection | Restore provider backup/snapshot; reconcile claims against Sheets, Gmail, and MMS before enabling delivery |
| Local Mac | WhatsApp capture, scheduled local backups, local tokens/tools | Rebuild from GitHub, password manager/provider consoles, and launchd templates |
| Provider credential | Affected integration reads/writes | Reissue with the minimum documented scope and replace it in Railway/local secret storage |

MMS and Stripe retain their own provider truth. Sheets owns First Chord
operational records. PostgreSQL owns the narrow Practice Note execution claim.
Neither a UI state nor `Issue_Queue` substitutes for those owners.

## Proven And Unproven Recovery

The Sheets restore drill was run on 2026-07-19: 30 tabs and 10,809 rows restored
to a scratch spreadsheet with headers and row counts verified. Re-run
`npm run restore:drill` once a term.

The following remain unproven and must not be described as guaranteed:

- a clean-machine cold start
- Railway PostgreSQL point-in-time restore and claim reconciliation
- off-machine survival of the local Sheets backup directory
- recovery of WhatsApp traffic missed while the bridge was offline

## Restore The Google Sheet

1. Run `npm run restore:drill`; it selects only a complete backup set and writes
   to a scratch spreadsheet.
2. Verify the drill passes and inspect critical tabs/headers.
3. Promote the scratch spreadsheet by changing `GOOGLE_SPREADSHEET_ID`, or
   restore selected tabs into a repaired original using the runbook.
4. Run `npm run ensure:state-tabs`, re-share access, and reapply the protected
   `Students` header row.
5. Refresh provider-derived caches from MMS/Stripe rather than restoring them as
   truth.

Never restore a set whose `manifest.json` reports failed tabs. Take a current
backup before overwriting any surviving live tab.

The local backup excludes rebuildable cache/status lanes such as
`Stripe_Amounts_Cache`, `Schedule_Context`, and `Bridge_Status`. The backup
directory is on this Mac; copy it periodically to an access-controlled
off-machine location without extending its retention window.

## Restore Practice Note Claims

A fresh database can be bootstrapped with:

```bash
npm run ensure:practice-delivery-claims
```

That creates schema, not historical claims. With claims unavailable, Practice
Note execution must remain disabled/fail 503 before MMS or Gmail. Before
re-enabling after a database loss:

1. restore the provider snapshot if available
2. compare terminal `Practice_Notes_Log` rows with Gmail IDs and MMS attendance
3. recreate/reconcile only from authoritative evidence using a reviewed recovery
   procedure
4. retain ambiguous deliveries for manual follow-up

Never delete a terminal claim or resend an ambiguous email merely to make the
stores agree. Record any recovery action.

## Cold Start A Replacement Mac

1. Install Node 20+, Git, Python 3, and `rg`; sign into the password manager and
   provider accounts.
2. Clone the repositories into the normal workspace and run `npm install`.
3. Recreate `.env.local` from Railway/password-manager values; re-mint local
   Google OAuth tokens rather than copying unknown files.
4. Verify read-only access, then run focused tests, full admin tests, hygiene,
   lint, and build.
5. Reinstall the Sheets backup, song-request, and WhatsApp bridge launchd agents
   from their repository instructions. QR re-link the business WhatsApp account.
6. Take a new Sheets backup and run the restore drill.

Production should keep running during a Mac rebuild. Use dashboard Quick capture
while WhatsApp automation is unavailable.

## Maintenance

When a managed Sheets tab is added, add it to the backup contract in the same
change. Keep the contract test green. Review this document after any new
authoritative store, provider write, backup mechanism, or recovery drill.
