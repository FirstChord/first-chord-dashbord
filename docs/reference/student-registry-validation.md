---
status: supporting
audience: [human, agent]
last_verified: 2026-07-20
---
# Student registry validation

`scripts/validate-students.js` checks the five generated portal configuration
files for consistency, duplicates, formats, and orphaned entries. It is
read-only when called directly.

## Commands

```bash
# Regenerate from the registry, then validate the generated outputs
npm run validate

# Inspect the current generated outputs without regenerating them
node scripts/validate-students.js
```

The npm command runs `scripts/generate-configs.js --no-backup` first through its
`prevalidate` hook. Inspect the generated diff afterwards. Validation does not
authorise editing a generated file; fix the canonical registry entry and
regenerate.

## What it checks

| Area | Behaviour |
|---|---|
| URL/ID uniqueness | No duplicate friendly URLs or student IDs in mappings |
| Mapping coverage | Mapped students exist in the generated allowlist; allowlist-only entries are warnings |
| MMS ID shape | `sdt_` followed by six alphanumeric characters |
| Friendly URL convention | Non-standard slugs are warnings, not errors |
| Soundslice | Course URL shape, coverage, and orphaned mappings |
| Theta | Credential shape, coverage, and orphaned mappings |
| Instruments | Known values, coverage, and orphaned mappings |

The script validates generated-file consistency, not the whole onboarding
transaction. It does not prove that a student exists in MMS or Sheets, that a
parent record is correct, or that the portal URL is suitably private.

## Interpreting results

- Exit `0`: no blocking validation errors; warnings may remain.
- Exit `1`: blocking errors or required generated files could not be read.
- Missing optional Soundslice, Theta, or instrument data is commonly a warning.
- A clean validation is necessary for portal configuration changes but is not a
  deployment or onboarding success signal by itself.

Common repairs:

| Result | Repair |
|---|---|
| Duplicate friendly URL | Choose a unique slug in `students-registry.js` |
| Wrong/missing generated allowlist entry | Fix the registry, then regenerate; do not edit `student-helpers.js` |
| Invalid MMS ID | Confirm the student ID in MMS before changing the registry key |
| Invalid Soundslice URL | Confirm the student's course and store its canonical HTTPS course URL in the registry |
| Parse/load failure | Check registry/generator syntax, regenerate, and inspect the first reported file |

## Change and verification boundary

For a registry repair:

```bash
npm run generate-configs
npm run validate
npm run build
git diff --check
git status --short
```

Use [the registry contract](./student-registry.md) for ownership and editing
rules. Use the onboarding workflow and its focused tests for a new student; do
not turn this validator into a second onboarding path.
