# Workflow: Troubleshooting Common Issues

**Purpose**: Quick fixes for common problems in the Music School Dashboard

**Last Updated**: October 3, 2025

---

## Table of Contents

1. [Student Portal Issues](#student-portal-issues)
2. [Notes Not Loading](#notes-not-loading)
3. [Dashboard Issues](#dashboard-issues)
4. [Build and Deployment](#build-and-deployment)
5. [Data Display Issues](#data-display-issues)
6. [API and Performance](#api-and-performance)

---

## Student Portal Issues

### Student Portal Shows 404 Error

**Symptoms**: Visiting `/studentname` shows "404 - Page Not Found"

**Common Causes**:

1. **Friendly URL not mapped**
   ```bash
   # Check if URL exists
   grep -i "'studentname'" lib/student-url-mappings.js
   ```
   **Fix**: Add to `lib/student-url-mappings.js`

2. **Student ID not in security whitelist**
   ```bash
   # Check if student ID is whitelisted
   grep "sdt_XXXXXX" lib/student-helpers.js
   ```
   **Fix**: Add student ID to `VALID_STUDENT_IDS` array in `lib/student-helpers.js`

3. **Typo in URL**
   - URLs are case-sensitive (lowercase)
   - Check exact spelling
   - Try: `http://localhost:3000/[name]` to test locally

**Quick Fix**:
```javascript
// lib/student-url-mappings.js
'studentname': 'sdt_XXXXXX',  // Add this

// lib/student-helpers.js
'sdt_XXXXXX',  // Add to VALID_STUDENT_IDS array
```

---

### Portal Loads But Shows "No Data Available"

**Symptoms**: Portal page loads but shows placeholder or no data

**Common Causes**:

1. **Student has no lessons in MMS**
   - Check MyMusicStaff - student needs at least one lesson with notes

2. **Incorrect MMS Student ID**
   - Verify ID format: `sdt_XXXXXX` (not `std_` or other variations)
   - Check ID exists in MyMusicStaff

3. **API timeout or error**
   - Check browser console for errors (F12 → Console tab)
   - Check Network tab for failed API requests

**Quick Fix**:
```bash
# Verify student ID in MMS
# Log into MyMusicStaff → Find student → Check URL for correct ID

# Test API locally
curl http://localhost:3000/api/notes/sdt_XXXXXX
```

---

## Notes Not Loading

### Recent Lesson Notes Don't Appear

**See**: `NOTES_EDGE_CASE_PROTOCOL.md` for comprehensive troubleshooting

**Quick Checks**:

1. **Future lesson blocking recent notes**
   ```
   Issue: Student has a future scheduled lesson
   Effect: System shows future lesson instead of most recent completed lesson
   ```
   **Fix**: See `NOTES_EDGE_CASE_PROTOCOL.md` Section 2

2. **Notes not saved in MMS**
   - Verify notes were saved in MyMusicStaff
   - Check lesson date is in the past

3. **Caching issue**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Clear browser cache
   - Restart dev server

**Quick Test**:
```bash
# Test notes API directly
curl http://localhost:3000/api/notes/sdt_XXXXXX | json_pp

# Check for "notes" field in response
```

---

### Notes Show Wrong Student

**Symptoms**: Portal shows another student's notes

**Common Causes**:

1. **Student ID typo in mappings**
   - Check all 5 config files have consistent student ID

2. **Duplicate student IDs**
   ```bash
   # Find duplicates
   grep -r "sdt_XXXXXX" lib/
   ```

**Fix**: Verify correct ID in all config files

---

## Dashboard Issues

### Tutor Doesn't Appear in Dropdown

**Symptoms**: New tutor not showing in teacher selection dropdown

**Common Causes**:

1. **Not added to TEACHERS array**
   **Fix**: Add to `app/dashboard/page-client.js`
   ```javascript
   const TEACHERS = [
     // ...
     { name: 'NewTutor', value: 'NewTutor' },
   ];
   ```

2. **Cache issue**
   - Hard refresh browser
   - Restart dev server
   - Clear `.next` cache: `rm -rf .next && npm run dev`

---

### Tutor Shows No Students

**Symptoms**: Selecting tutor shows empty list or "No students found"

**Common Causes**:

1. **Teacher ID incorrect**
   ```javascript
   // Check lib/mms-client.js
   const TEACHER_ID_MAP = {
     'TutorName': 'tch_XXXXXX',  // Verify this ID
   };
   ```

2. **Teacher ID not found in MMS**
   - Verify teacher exists in MyMusicStaff
   - Use Network tab method to find correct ID (see `02-adding-tutors.md`)

3. **No students assigned to teacher in MMS**
   - Check MyMusicStaff student assignments
   - Ensure teacher is marked as primary teacher

**Quick Test**:
```bash
# Test teacher API endpoint
curl "http://localhost:3000/api/students?tutor=TutorName"
```

---

### Student Shows on Dashboard But Not in Portal

**Symptoms**: Student appears in dashboard but `/studentname` gives 404

**Cause**: Student exists in MMS but not configured for portal access

**Fix**: Follow `01-adding-students.md` to add portal configuration:
- Add to student-url-mappings.js
- Add to student-helpers.js (security whitelist)
- Add to other 3 config files (Soundslice, Theta, instruments)

---

### Grid Layout Looks Wrong

**Symptoms**: Teacher buttons misaligned or overflow

**Common Causes**:

1. **Too many teachers for current grid**
   - Current: 15 teachers in 4×4 grid
   - Adjust: `app/dashboard/page-client.js` grid classes

**Fix**:
```javascript
// For 16-20 teachers, change to:
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
```

---

## Build and Deployment

### Build Fails with Syntax Error

**Symptoms**: `npm run build` shows error

**Common Causes**:

1. **Missing comma in config files**
   ```javascript
   // WRONG
   'student1': 'sdt_111'
   'student2': 'sdt_222'

   // RIGHT
   'student1': 'sdt_111',  // ← comma here
   'student2': 'sdt_222',
   ```

2. **Trailing comma in last item**
   ```javascript
   // Some contexts don't allow trailing comma
   {
     'key': 'value',  // ← remove this comma if it's the last item
   }
   ```

3. **Unclosed brackets/braces**

**Quick Fix**:
```bash
# Check syntax of specific file
node -c lib/student-url-mappings.js

# Or run build to see error location
npm run build
```

---

### Build Succeeds But Deployment Fails

**Symptoms**: Local build works but Railway deployment fails

**Common Causes**:

1. **Environment variables missing**
   - Check Railway dashboard for required env vars
   - See: `DEPLOYMENT_PROTOCOLS.md`

2. **Railway timeout**
   - Large builds can timeout
   - Check Railway logs for details

3. **Dependencies issue**
   ```bash
   # Ensure package-lock.json is committed
   git add package-lock.json
   git commit -m "chore: update package-lock"
   ```

**Fix**: Check Railway deployment logs:
- Visit: https://railway.app
- Click on project
- View deployment logs

---

### Changes Don't Appear After Deployment

**Symptoms**: Pushed changes but live site unchanged

**Common Causes**:

1. **Railway still building**
   - Wait 2-3 minutes
   - Check Railway dashboard for build status

2. **Browser cache**
   - Hard refresh: Ctrl+Shift+R or Cmd+Shift+R
   - Try incognito mode
   - Clear browser cache

3. **Wrong branch deployed**
   - Verify you pushed to `main` branch
   ```bash
   git branch  # Check current branch
   git log --oneline -5  # Verify recent commits
   ```

4. **Build failed silently**
   - Check Railway logs
   - Look for errors in deployment

**Quick Check**:
```bash
# Verify latest commit is on remote
git log origin/main --oneline -5

# Check if push was successful
git status
```

---

## Data Display Issues

### Wrong Instrument Shows

**Symptoms**: Student shows "Guitar" but plays "Piano"

**Cause**: MMS has incorrect data or no instrument override set

**Fix**: Add override in `lib/config/instruments.js`
```javascript
'sdt_XXXXXX': 'Piano',  // Overrides MMS data
```

---

### Soundslice Link Missing

**Symptoms**: Student card or portal doesn't show Soundslice button

**Cause**: Not configured in soundslice-mappings.js

**Fix**: Add to `lib/soundslice-mappings.js`
```javascript
'sdt_XXXXXX': 'https://www.soundslice.com/courses/XXXXX/',
```

---

### Theta Music Credentials Don't Show

**Symptoms**: Student portal missing Theta Music section

**Cause**: Not configured in theta-credentials.js

**Fix**: Add to `lib/config/theta-credentials.js`
```javascript
'sdt_XXXXXX': 'studentnamefc',
```

---

### Student Name Shows as "Student"

**Symptoms**: Generic name instead of actual student name

**Cause**: Theta credentials missing or incorrect format

**Fix**: The system extracts name from Theta credentials
```javascript
// lib/config/theta-credentials.js
'sdt_XXXXXX': 'actualnamefc',  // Name extracted from this
```

---

## API and Performance

### API Calls Timing Out

**Symptoms**: Long loading times or timeout errors

**Common Causes**:

1. **MMS API slow**
   - MyMusicStaff servers may be slow
   - Try again later

2. **Too many concurrent requests**
   - Limit number of students loaded at once
   - Use pagination or filtering

3. **Network issues**
   - Check internet connection
   - Try different network

**Quick Test**:
```bash
# Test API response time
time curl http://localhost:3000/api/notes/sdt_XXXXXX
```

---

### Dashboard Loads Slowly

**Symptoms**: Takes >5 seconds to load student list

**Common Causes**:

1. **Loading all teachers at once**
   - Use teacher filter
   - Don't select "All Teachers" for large datasets

2. **MMS API slow**
   - Response time depends on MMS servers

3. **Too many students**
   - Consider pagination (future enhancement)

**Temporary Fix**: Filter by specific teacher instead of "All Teachers"

---

## Quick Diagnostic Commands

### Check Configuration Consistency

```bash
# Count students in each file (should match)
grep -c "sdt_" lib/student-url-mappings.js
grep -c "sdt_" lib/student-helpers.js
grep -c "sdt_" lib/soundslice-mappings.js
grep -c "sdt_" lib/config/theta-credentials.js
grep -c "sdt_" lib/config/instruments.js

# Find student by ID across all files
grep -r "sdt_XXXXXX" lib/
```

### Check for Duplicates

```bash
# Find duplicate student IDs
grep -oP "sdt_\w+" lib/student-url-mappings.js | sort | uniq -d

# Find duplicate friendly URLs
grep -oP "'\w+':" lib/student-url-mappings.js | sort | uniq -d
```

### Test API Endpoints

```bash
# Test notes API
curl http://localhost:3000/api/notes/sdt_XXXXXX

# Test students API
curl "http://localhost:3000/api/students?tutor=TutorName"

# Test with pretty printing (requires jq)
curl http://localhost:3000/api/notes/sdt_XXXXXX | jq
```

### Clear All Caches

```bash
# Clear Next.js cache
rm -rf .next

# Clear node modules (if needed)
rm -rf node_modules
npm install

# Restart dev server
npm run dev
```

---

## Emergency Rollback

If something breaks in production:

```bash
# Revert last commit
git revert HEAD

# Or revert to specific commit
git revert [commit-hash]

# Push to trigger new deployment
git push

# Monitor Railway deployment
# Site will revert to previous working state in 2-3 minutes
```

---

## Getting More Help

### Check Existing Documentation

1. **NOTES_EDGE_CASE_PROTOCOL.md** - Notes loading issues
2. **DEPLOYMENT_PROTOCOLS.md** - Deployment problems
3. **STUDENT_PORTAL_PROTOCOL.md** - Portal configuration
4. **01-adding-students.md** - Student setup guide
5. **02-adding-tutors.md** - Tutor setup guide

### Debug Mode

Enable more detailed logging:

```bash
# Set debug environment variable
export DEBUG=true

# Run dev server
npm run dev

# Check browser console and terminal for detailed logs
```

### Check Recent Changes

```bash
# See what changed recently
git log --oneline -10

# See specific file changes
git log -p lib/student-url-mappings.js

# Compare with last working version
git diff HEAD~1 lib/student-url-mappings.js
```

---

## Common Error Messages and Fixes

| Error Message | Likely Cause | Fix |
|---------------|--------------|-----|
| "404 - Page Not Found" | URL not mapped or not whitelisted | Add to mappings and security whitelist |
| "Failed to fetch notes" | MMS API error or invalid student ID | Verify student ID, check MMS |
| "No students found" | Teacher ID incorrect | Verify teacher ID in TEACHER_ID_MAP |
| "Build failed: Unexpected token" | Syntax error in config file | Check for missing commas, brackets |
| "Cannot find module" | Missing dependency or import | Run `npm install` |
| "API timeout" | MMS servers slow | Wait and retry, check network |
| "Invalid student ID" | ID not in whitelist | Add to VALID_STUDENT_IDS |

---

## Related Workflows

- See: `01-adding-students.md` - Correct student setup
- See: `02-adding-tutors.md` - Correct tutor setup
- See: `04-deployment-checklist.md` - Pre-deployment checks
- See: `05-testing-guide.md` - Testing procedures
