# Workflow: Adding New Students

**Purpose**: Add a new student to both the main tutor dashboard and create their individual student portal

**Time Required**: 5-10 minutes
**Last Updated**: October 3, 2025

---

## Prerequisites Checklist

Before starting, gather this information:

- [ ] **Student's full name** (First and Last)
- [ ] **MMS Student ID** (format: `sdt_XXXXXX`)
- [ ] **Tutor name** (e.g., "Jungyoun", "Kenny", "Finn")
- [ ] **Instrument** (Piano, Guitar, Voice, Bass, etc.)
- [ ] **Soundslice course URL** (e.g., `https://www.soundslice.com/courses/17489/`)
- [ ] **Theta Music username** (format: `[firstname]fc` - all lowercase)

**Where to get MMS Student ID:**
- Log into MyMusicStaff
- Navigate to Students section
- Find student and copy their ID from the URL or student details

---

## What Gets Updated

Adding a student updates **TWO SYSTEMS**:

### 1. Main Tutor Dashboard
Students automatically appear on the tutor's dashboard when their MMS ID exists in MyMusicStaff. No code changes needed - the dashboard fetches live data from the MMS API.

### 2. Individual Student Portal (Requires Configuration)
To create a student portal at `/[firstname]`, you need to update **5 configuration files**:

```
lib/student-url-mappings.js     → Friendly URL mapping
lib/student-helpers.js          → Security whitelist
lib/soundslice-mappings.js      → Soundslice course link
lib/config/theta-credentials.js → Theta Music login
lib/config/instruments.js       → Instrument override
```

---

## Step-by-Step Instructions

### Step 1: Check for URL Conflicts

**Important**: Check if the friendly URL is already taken.

```bash
# Search for existing student with same first name
grep -i "'[firstname]'" lib/student-url-mappings.js
```

**If conflict exists**, use pattern: `firstname-lastinitial`
- Example: `olivia` (Olivia Mcintosh) exists, so new Olivia Wong → `olivia-w`
- Example: `charlie` exists, so Charlie Mcdougall → `charlie-m`

### Step 2: Update URL Mappings

**File**: `lib/student-url-mappings.js`

Add entry in **alphabetical order** within the appropriate tutor section:

```javascript
// Find the tutor's section (e.g., "Jungyoun's students")
// Add in alphabetical order:
'ritisha': 'sdt_635GJ0',            // Ritisha Paryani
```

**Pattern**:
```javascript
'[friendly-url]': '[mms-student-id]',  // [Full Name]
```

### Step 3: Add to Security Whitelist

**File**: `lib/student-helpers.js`

Find the compact array section and add the student ID:

```javascript
// Find line around line 41 (end of main array before Kenny's students comment)
'sdt_Fq8ZJ1', 'sdt_QP01Jp', 'sdt_NxMZJz', 'sdt_NSmyJ3', 'sdt_y0SPJJ', 'sdt_638hJ9', 'sdt_D9ftJB', 'sdt_635GJ0',
                                                                                                    // ↑ Add here
```

### Step 4: Add Soundslice Course

**File**: `lib/soundslice-mappings.js`

Find the tutor's section and add the mapping:

```javascript
// Jungyoun's students
'sdt_c794J5': 'https://www.soundslice.com/courses/16908/', // Mateo Alonso
// ... other students ...
'sdt_635GJ0': 'https://www.soundslice.com/courses/17489/', // Ritisha Paryani
```

**Pattern**:
```javascript
'[mms-id]': '[soundslice-url]', // [Full Name]
```

### Step 5: Add Theta Music Credentials

**File**: `lib/config/theta-credentials.js`

Find the tutor's section and add credentials:

```javascript
// Jungyoun's students with Theta Music credentials
'sdt_c794J5': 'mateofc',      // Mateo Alonso
// ... other students ...
'sdt_635GJ0': 'ritishafc',    // Ritisha Paryani
```

**Pattern**:
```javascript
'[mms-id]': '[firstname]fc',    // [Full Name]
```

**Note**: Username and password are the same (e.g., `ritishafc`)

### Step 6: Add Instrument Override

**File**: `lib/config/instruments.js`

Find the tutor's section and add instrument:

```javascript
// Jungyoun's students with correct instruments (all Piano)
'sdt_c794J5': 'Piano',        // Mateo Alonso
// ... other students ...
'sdt_635GJ0': 'Piano',        // Ritisha Paryani
```

**Common instruments**: `Piano`, `Guitar`, `Voice`, `Bass`, `Piano / Guitar`, `Piano / Voice`

---

## Testing

### Local Testing

1. **Start dev server** (if not already running):
```bash
npm run dev
```

2. **Test student portal**:
```
Visit: http://localhost:3000/[friendly-url]
Example: http://localhost:3000/ritisha
```

3. **Verify all sections load**:
- [ ] Student name displays correctly
- [ ] Instrument shows correctly
- [ ] Lesson notes appear (most recent lesson)
- [ ] Soundslice course link works
- [ ] Theta Music credentials display

4. **Test main dashboard**:
```
Visit: http://localhost:3000/dashboard
Select the tutor from dropdown
```
- [ ] Student appears in the list
- [ ] Correct instrument shows
- [ ] Soundslice link appears (if configured)
- [ ] Can click to view notes

### Build Test

**Always test build before committing:**

```bash
npm run build
```

If build fails, check error messages for:
- Syntax errors in config files
- Missing commas
- Duplicate keys

---

## Deployment

### Commit and Push

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: add [Student Name] to [Tutor]'s students

- Added student portal URL mapping: /[friendly-url] -> [mms-id]
- Added to security whitelist
- Configured Soundslice course: [url]
- Set up Theta Music credentials: [username]
- Set instrument override: [instrument]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
"

# Push to trigger Railway auto-deploy
git push
```

### Monitor Deployment

Railway auto-deploys when you push to main branch.

1. **Check Railway dashboard** (optional):
   - Visit: https://railway.app
   - Look for deployment status

2. **Wait 2-3 minutes** for build and deployment

3. **Test live site**:
```
https://efficient-sparkle-production.up.railway.app/[friendly-url]
https://efficient-sparkle-production.up.railway.app/dashboard
```

---

## Verification Checklist

After deployment completes:

### Student Portal
- [ ] Portal loads: `https://efficient-sparkle-production.up.railway.app/[name]`
- [ ] Notes section displays
- [ ] Soundslice button appears and links correctly
- [ ] Theta Music credentials show
- [ ] Correct instrument displays
- [ ] No console errors (check browser DevTools)

### Main Dashboard
- [ ] Visit: `https://efficient-sparkle-production.up.railway.app/dashboard`
- [ ] Select the tutor from dropdown
- [ ] Student appears in the list
- [ ] Student card shows correct information
- [ ] Soundslice link works (if configured)

---

## Common Issues & Solutions

### Issue: Student portal shows 404
**Cause**: Friendly URL not in mappings or security whitelist
**Fix**:
- Check `student-url-mappings.js` has correct entry
- Check `student-helpers.js` has student ID in VALID_STUDENT_IDS array

### Issue: Notes not loading
**Cause**: MMS student ID incorrect or student doesn't exist in MMS
**Fix**:
- Verify student ID in MyMusicStaff
- Check student has had at least one lesson
- See: `NOTES_EDGE_CASE_PROTOCOL.md`

### Issue: Soundslice link missing
**Cause**: Not added to soundslice-mappings.js
**Fix**: Add mapping in `lib/soundslice-mappings.js`

### Issue: Theta credentials not showing
**Cause**: Not added to theta-credentials.js
**Fix**: Add credentials in `lib/config/theta-credentials.js`

### Issue: Wrong instrument displays
**Cause**: MMS has incorrect instrument or no override set
**Fix**: Add correct instrument in `lib/config/instruments.js`

### Issue: Build fails
**Cause**: Syntax error in config files
**Fix**:
- Check for missing commas
- Check for duplicate keys
- Review error message for file and line number

---

## Rollback Procedure

If deployment causes issues:

```bash
# Revert the last commit
git revert HEAD

# Push to trigger new deployment
git push
```

Or manually fix issues and push again.

---

## Quick Reference

### File Updates Summary

| File | What to Add | Pattern |
|------|-------------|---------|
| `student-url-mappings.js` | Friendly URL | `'name': 'sdt_XXXXXX',` |
| `student-helpers.js` | Security whitelist | Add to VALID_STUDENT_IDS array |
| `soundslice-mappings.js` | Course URL | `'sdt_XXXXXX': 'https://...',` |
| `theta-credentials.js` | Login credentials | `'sdt_XXXXXX': 'namefc',` |
| `instruments.js` | Instrument | `'sdt_XXXXXX': 'Piano',` |

### Testing URLs

- **Local portal**: `http://localhost:3000/[name]`
- **Local dashboard**: `http://localhost:3000/dashboard`
- **Live portal**: `https://efficient-sparkle-production.up.railway.app/[name]`
- **Live dashboard**: `https://efficient-sparkle-production.up.railway.app/dashboard`

---

## Related Workflows

- See: `02-adding-tutors.md` - If adding a new tutor's first student
- See: `03-troubleshooting-common-issues.md` - For debugging help
- See: `05-testing-guide.md` - For comprehensive testing checklist
