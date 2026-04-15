# Student Data Validation Guide

**Purpose**: Automated validation of student configuration data integrity

**Last Updated**: October 3, 2025

---

## What is the Validation Script?

The validation script (`scripts/validate-students.js`) automatically checks your student configuration files for:
- Data consistency across all 5 config files
- Format errors (student IDs, URLs, credentials)
- Duplicate entries
- Missing data
- Orphaned entries

**It's 100% safe** - read-only, no modifications to your data.

---

## Quick Start

```bash
# Run validation
npm run validate
```

**When to run:**
- Before committing changes
- After manually editing config files
- Before deploying
- When troubleshooting student portal issues

---

## What It Checks

### 1. File Consistency (Critical)

**Cross-file validation:**
- ✓ All students in URL mappings are in security whitelist
- ✓ All whitelisted students have URL mappings
- ✓ No orphaned entries in secondary files

**Why it matters:** Student portals won't work if mappings and whitelist don't match.

### 2. Duplicate Detection (Critical)

**Checks for duplicates:**
- ✓ No duplicate friendly URLs
- ✓ No duplicate student IDs in mappings
- ✓ No duplicate Soundslice URLs

**Why it matters:** Duplicates cause routing conflicts and data overwrites.

### 3. Format Validation (Critical)

**Student IDs:**
- Format: `sdt_XXXXXX` (6 characters after underscore)
- Example: `sdt_635GJ0` ✓
- Invalid: `std_635GJ0` ✗ (typo: std instead of sdt)

**Friendly URLs:**
- Format: lowercase letters, optional hyphen with last initial
- Examples: `ritisha` ✓, `olivia-w` ✓
- Invalid: `Ritisha` ✗, `ritisha_p` ✗

**Soundslice URLs:**
- Format: `https://www.soundslice.com/courses/[ID]/`
- Must have trailing slash
- Must be HTTPS
- Example: `https://www.soundslice.com/courses/17489/` ✓

**Theta Credentials:**
- Format: `[name]fc` or `[name]firstchord`
- Examples: `ritishafc` ✓, `alexfirstchord` ✓
- Invalid: `Ritisha_fc` ✗, `ritisha` ✗

**Instruments:**
- Valid: `Piano`, `Guitar`, `Voice`, `Bass`, `Piano / Guitar`, `Piano / Voice`
- Invalid: `piano` ✗ (lowercase), `Violin` ✗ (not in standard list)

### 4. Coverage Checks (Warnings)

**Optional features:**
- Students without Soundslice courses
- Students without Theta credentials
- Students without instrument overrides

**Why warnings:** These are optional features, may be intentionally missing.

---

## Understanding the Output

### Success (All Green)

```bash
🎉 All validation checks passed!
Your configuration is clean and ready to deploy.
```

**Meaning**: No errors found, safe to commit and deploy.

### Warnings (Yellow)

```bash
⚠️  3 Warning(s) - Review Recommended:
1. 7 students missing Soundslice courses
2. 3 students missing Theta credentials
3. 60 students missing instrument overrides
```

**Meaning**:
- Won't block deployment
- Usually intentional (not all students have all features)
- Review to ensure it's expected

**Action**:
- Check if intentional
- Add missing data if needed
- Or ignore if expected

### Errors (Red)

```bash
❌ 2 Error(s) Found - Must Fix Before Deploying:
1. Duplicate friendly URLs found: 'olivia'
2. 3 invalid Soundslice URL formats
```

**Meaning**: Critical issues that will cause problems.

**Action**: **Must fix before deploying**
- Script exits with code 1 (will fail CI/CD if integrated)
- Follow error messages to identify issues
- Fix and re-run validation

---

## Common Errors and Fixes

### Error: Duplicate Friendly URLs

```
✗ Duplicate URL: 'olivia' - must be unique
```

**Cause**: Two students mapped to same friendly URL

**Fix**: Use firstname-lastinitial pattern
```javascript
// lib/student-url-mappings.js
'olivia': 'sdt_cGPBJ3',      // Olivia Mcintosh
'olivia-w': 'sdt_LTf0Jx',    // Olivia Wong
```

---

### Error: Student Not in Whitelist

```
✗ Students not in whitelist (1):
  - sdt_635GJ0 (ritisha)
```

**Cause**: Added to URL mappings but forgot security whitelist

**Fix**: Add to `lib/student-helpers.js`
```javascript
const VALID_STUDENT_IDS = [
  // ... other IDs ...
  'sdt_635GJ0',  // Add this
];
```

---

### Error: Invalid Student ID Format

```
✗ Invalid student ID format:
  - std_635GJ0
```

**Cause**: Typo in student ID (common: `std_` instead of `sdt_`)

**Fix**: Correct the ID format
```javascript
// Wrong
'ritisha': 'std_635GJ0',

// Right
'ritisha': 'sdt_635GJ0',
```

---

### Error: Invalid Soundslice URL

```
✗ Invalid Soundslice URLs:
  - sdt_635GJ0: http://www.soundslice.com/courses/17489
```

**Cause**: Missing HTTPS or trailing slash

**Fix**: Ensure correct format
```javascript
// Wrong
'sdt_635GJ0': 'http://www.soundslice.com/courses/17489',

// Right
'sdt_635GJ0': 'https://www.soundslice.com/courses/17489/',
```

---

### Error: Duplicate Student IDs

```
✗ Duplicate student ID: 'sdt_635GJ0' - maps to multiple URLs
```

**Cause**: Same student ID used for different students

**Fix**: Check MMS for correct IDs - each student needs unique ID

---

## Integration with Workflow

### Before Committing

```bash
# Standard workflow
npm run validate    # Check for errors
npm run build       # Test build
git add .
git commit -m "..."
git push
```

### Pre-Commit Hook (Optional)

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
npm run validate
if [ $? -ne 0 ]; then
  echo "❌ Validation failed - fix errors before committing"
  exit 1
fi
```

Makes validation automatic before every commit.

### CI/CD Integration (Future)

```yaml
# .github/workflows/validate.yml
- name: Validate student data
  run: npm run validate
```

---

## What Gets Checked

### File Checklist

| File | Checks |
|------|--------|
| `student-url-mappings.js` | Format, duplicates, all students present |
| `student-helpers.js` | All mapped students whitelisted |
| `soundslice-mappings.js` | URL format, no orphans |
| `theta-credentials.js` | Credential format, no orphans |
| `instruments.js` | Valid values, no orphans |

### Check Categories

| Category | Count | Type |
|----------|-------|------|
| Duplicate detection | 3 checks | Error |
| Format validation | 5 checks | Error |
| Cross-file consistency | 2 checks | Error |
| Coverage checks | 3 checks | Warning |
| Orphan detection | 1 check | Warning |

**Total**: 13 automated checks

---

## Troubleshooting the Validator

### Validation Script Fails to Run

**Error**: `Cannot find module`

**Fix**: Ensure you're in project root directory

---

### "Failed to load configuration files"

**Cause**: Script can't parse config files

**Fix**:
1. Check for syntax errors in config files
2. Run `node -c lib/student-url-mappings.js` to check syntax
3. Fix any syntax issues

---

### False Positives

If validation reports an error you believe is incorrect:

1. **Check the actual files** - validation is usually right
2. **Review the specific error message** - tells you exactly what's wrong
3. **Check recent changes** - did you modify the files?
4. **Report issue** - if truly a false positive, the validator needs updating

---

## Advanced Usage

### Viewing Detailed Output

Validation script provides detailed info:

```bash
npm run validate

# Shows:
# - Number of entries in each file
# - Which students are missing from where
# - Specific invalid values
# - Line-by-line error locations
```

### Exit Codes

```bash
npm run validate
echo $?

# Exit codes:
# 0 = Success (warnings OK)
# 1 = Errors found (must fix)
```

Useful for scripting:
```bash
npm run validate && npm run build && git push
```

---

## Maintenance

### Updating Validation Rules

If you add new instrument types or change formats:

1. Edit `scripts/validate-students.js`
2. Find the relevant validation function (e.g., `isValidInstrument`)
3. Update the rules
4. Test with `npm run validate`

### Adding New Checks

To add new validation checks:

1. Add check in `runValidations()` function
2. Increment `stats.checks++`
3. Add errors to `stats.errors` or warnings to `stats.warnings`
4. Test thoroughly

---

## Benefits Summary

### Time Savings

**Without validation:**
- Add student → Deploy → Portal 404 → Debug 10 mins → Fix → Redeploy
- **Total**: 15-20 minutes

**With validation:**
- Add student → `npm run validate` → See error → Fix → Deploy
- **Total**: 5 minutes

### Error Prevention

**Catches before deployment:**
- Typos in student IDs
- Missing whitelist entries
- Duplicate URLs
- Invalid formats
- Inconsistent data

### Confidence

```bash
npm run validate
✅ All checks passed!
```

**Know** your data is clean before deploying.

---

## Related Documentation

- See: `docs/workflows/01-adding-students.md` - Includes validation step
- See: `docs/workflows/04-deployment-checklist.md` - Pre-deployment validation
- See: `docs/workflows/03-troubleshooting-common-issues.md` - Fix validation errors

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run validate` | Run all validation checks |
| Exit code 0 | All passed (ready to deploy) |
| Exit code 1 | Errors found (must fix) |
| Green ✓ | Check passed |
| Yellow ⚠ | Warning (review) |
| Red ✗ | Error (must fix) |

**Remember**: Validation is your safety net. Run it before every deployment!
