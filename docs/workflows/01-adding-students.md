# Workflow: Adding New Students

**Purpose**: Add a new student to both the main tutor dashboard and create their individual student portal

**Time Required**: ~2 minutes with Registry System
**Last Updated**: January 14, 2026
**System Version**: 2.0 (Registry-based)

> **⚠️ CRITICAL**: This workflow uses the **Student Registry System** - edit 1 file instead of 5!
> **DO NOT manually edit the generated config files - they will be overwritten during deployment!**

---

## Quick Start (For AI Agents)

```bash
# 1. Add student to registry
# Edit: lib/config/students-registry.js

# 2. Generate configs
npm run generate-configs

# 3. Validate
npm run validate

# 4. Test
npm run dev

# 5. Deploy
git add lib/config/students-registry.js lib/student-url-mappings.js lib/student-helpers.js lib/soundslice-mappings.js lib/config/theta-credentials.js lib/config/instruments.js
git commit -m "feat: add student [Name] for tutor [Tutor]"
git push
```

---

## Prerequisites Checklist

Before starting, gather this information:

- [ ] **Student's full name** (First and Last)
- [ ] **MMS Student ID** (format: `sdt_XXXXXX`)
- [ ] **Tutor name** (e.g., "Dean", "David", "Finn")
- [ ] **Instrument** (Guitar, Piano, Bass, etc.) - optional
- [ ] **Soundslice course URL** - optional
- [ ] **Theta Music username** (format: `[firstname]fc`) - optional

**Where to get MMS Student ID:**
- Log into MyMusicStaff
- Navigate to Students section
- Find student and copy their ID from the URL

---

## What Gets Updated

### 1. Tutor Dashboard (Automatic)
Students automatically appear on the tutor's dashboard when their MMS ID exists in MyMusicStaff. **No code changes needed** - the dashboard fetches live data from the MMS API.

### 2. Student Portal (Registry System)
To create a student portal at `/[firstname]`, use the Registry System:

**ONE FILE TO EDIT**:
```
lib/config/students-registry.js     → Add student entry here
```

**GENERATED FILES** (do not edit manually):
```
lib/student-url-mappings.js         → Friendly URL mapping
lib/student-helpers.js              → Security whitelist
lib/soundslice-mappings.js          → Soundslice course links
lib/config/theta-credentials.js     → Theta Music logins
lib/config/instruments.js           → Instrument overrides
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
- Example: `olivia` exists, so Olivia Wong → `olivia-w`
- Example: `charlie` exists, so Charlie Mcdougall → `charlie-m`

---

### Step 2: Add to Registry

**File**: `lib/config/students-registry.js`

Find the tutor's section and add the student:

```javascript
export const STUDENTS_REGISTRY = {
  // ... existing students ...

  // Dean's students (or whichever tutor)
  'sdt_BDHqJv': {
    firstName: 'Alice',
    lastName: 'Drew',
    friendlyUrl: 'alice',
    tutor: 'Dean',
    instrument: 'Guitar',                                      // Optional
    soundsliceUrl: 'https://www.soundslice.com/courses/18590/', // Optional
    thetaUsername: 'alicefc',                                   // Optional
  }, // Alice Drew

  // ... more students ...
};
```

**Required Fields:**
- `firstName`
- `friendlyUrl`
- `tutor`

**Optional Fields:**
- `lastName`
- `instrument` (only if overriding MMS data)
- `soundsliceUrl`
- `thetaUsername`

---

### Step 3: Generate Config Files

```bash
npm run generate-configs
```

**Expected output:**
```
🔨 Generating config files from student registry...
✓ Loaded 173 students
✓ Found 14 tutors
✓ Generated: lib/student-url-mappings.js
✓ Generated: lib/student-helpers.js
✓ Generated: lib/soundslice-mappings.js
✓ Generated: lib/config/theta-credentials.js
✓ Generated: lib/config/instruments.js
✅ Config generation complete!
```

---

### Step 4: Validate

```bash
npm run validate
```

**Must have 0 errors** (warnings are acceptable):

```
Total checks run: 13
Errors found: 0        ← Must be 0!
Warnings found: 3      ← These are OK
```

**If errors exist**, fix them in the registry and re-generate.

---

### Step 5: Test Locally

```bash
npm run dev
```

Visit: `http://localhost:3000/[friendlyurl]`

**Verify:**
- ✅ URL resolves (no 404)
- ✅ Student name appears in header
- ✅ Notes section loads
- ✅ Soundslice link appears (if added)
- ✅ Theta credentials appear (if added)
- ✅ Mobile responsive design works
- ✅ No console errors

---

### Step 6: Commit and Deploy

```bash
# Stage all modified files (registry + generated files)
git add lib/config/students-registry.js lib/student-url-mappings.js lib/student-helpers.js lib/soundslice-mappings.js lib/config/theta-credentials.js lib/config/instruments.js

# Commit with descriptive message
git commit -m "feat: add student [Student Name] for tutor [Tutor]

Added to students-registry.js:
- [Full Name] (/[url]) - [Tutor]'s student

Generated configs with npm run generate-configs
Validation: 0 errors

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to deploy (Railway auto-deploys)
git push
```

**Deployment:**
- Railway auto-deploys from git pushes
- Takes 1-2 minutes to go live
- Test at: `https://firstchord.co.uk/[friendlyurl]`

---

## Quick Reference Checklist

```
□ 1. Gather student info (name, MMS ID, tutor, etc.)
□ 2. Check for URL conflicts
□ 3. Add entry to lib/config/students-registry.js
□ 4. Run: npm run generate-configs
□ 5. Run: npm run validate (must have 0 errors)
□ 6. Run: npm run dev and test locally
□ 7. Stage registry + all generated files
□ 8. Commit and push
□ 9. Verify live (wait 1-2 minutes)
```

---

## Common Patterns

### Single Name Students
```javascript
'sdt_H6CvJv': {
  firstName: 'Mathilde',
  lastName: 'Thallon',
  friendlyUrl: 'mathilde',
  tutor: 'Finn',
  soundsliceUrl: 'https://www.soundslice.com/courses/17397/',
  thetaUsername: 'mathildefc',
}, // Mathilde Thallon
```

### Conflict Resolution
```javascript
'sdt_x48LJT': {
  firstName: 'Stella',
  lastName: 'Cook',
  friendlyUrl: 'stella-c',        // Added -c to avoid conflict
  tutor: 'Finn',
  soundsliceUrl: 'https://www.soundslice.com/courses/16915/',
  thetaUsername: 'stellafc',
}, // Stella Cook
```

### Without Optional Fields
```javascript
'sdt_638hJ9': {
  firstName: 'Vanessa',
  friendlyUrl: 'vanessa',
  tutor: 'David',
  soundsliceUrl: 'https://www.soundslice.com/courses/16881/',
  thetaUsername: 'vanessafc',
}, // Vanessa (no last name, instrument from MMS)
```

---

## Troubleshooting

### "0 errors" not showing in validation
- Check for syntax errors in registry (missing commas, quotes)
- Ensure MMS ID format is correct (`sdt_` + 6-7 characters)
- Re-run `npm run generate-configs`

### Changes don't appear on Railway
- Verify you committed ALL files (registry + 5 generated files)
- Check Railway build logs for errors
- Wait full 1-2 minutes for deployment

### Student portal 404
- Check friendly URL in registry
- Verify `npm run generate-configs` was run
- Check for typos in MMS ID

---

## Related Documentation

- [ADDING_NEW_STUDENTS.md](../ADDING_NEW_STUDENTS.md) - Detailed guide
- [STUDENT_REGISTRY_GUIDE.md](../STUDENT_REGISTRY_GUIDE.md) - Registry system docs
- [VALIDATION_GUIDE.md](../VALIDATION_GUIDE.md) - Validation details

---

**⚠️ Remember: ONLY edit the registry file. ALL other config files are auto-generated!**
