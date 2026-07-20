---
status: historical
audience: [human, agent]
last_verified: null
---
# Adding New Students to the Portal System

**Last Updated**: January 14, 2026
**System Version**: 2.0 (Registry-based)
**Status**: ✅ Current Method - ALWAYS USE THIS

---

## ⚠️ IMPORTANT: Use Registry System Only

**DO NOT manually edit these files:**
- ❌ `lib/student-url-mappings.js`
- ❌ `lib/student-helpers.js`
- ❌ `lib/soundslice-mappings.js`
- ❌ `lib/config/theta-credentials.js`
- ❌ `lib/config/instruments.js`

**These files are AUTO-GENERATED. Manual edits will be overwritten during deployment.**

---

## 📋 Prerequisites

Before starting, gather this information:

- [ ] **Student's full name** (First and Last)
- [ ] **MMS Student ID** (format: `sdt_XXXXXX`)
- [ ] **Tutor name** (e.g., "Dean", "David", "Finn")
- [ ] **Instrument** (Guitar, Piano, Bass, etc.) - optional
- [ ] **Soundslice course URL** (e.g., `https://www.soundslice.com/courses/18590/`) - optional
- [ ] **Theta Music username** (format: `[firstname]fc` - all lowercase) - optional

**Where to get MMS Student ID:**
- Log into MyMusicStaff
- Navigate to Students section
- Find student and copy their ID from the URL (format: `sdt_XXXXXX`)

---

## 🚀 Step-by-Step Process

### Step 1: Determine Friendly URL Name

**Choose the student's friendly URL name:**

1. **Primary rule**: Use first name in lowercase
   ```
   Alice → alice
   Sinead → sinead
   ```

2. **If name conflict exists**, add last initial:
   ```
   Stella Cook → stella-c
   Stella French → stella-f
   Charlie Gillespie → charlie-g
   ```

3. **Name validation**: Only use lowercase letters and hyphens
   - ✅ Valid: `alice`, `sinead`, `stella-c`
   - ❌ Invalid: `Alice`, `alice123`, `alice_drew`

**Check for conflicts:**
```bash
grep -i "'[firstname]'" lib/student-url-mappings.js
```

---

### Step 2: Add to Registry File

**File**: `lib/config/students-registry.js`

1. **Open the registry file**
2. **Find the tutor's section** (students are grouped by tutor)
3. **Add the new student entry:**

```javascript
'sdt_XXXXXX': {
  firstName: 'Alice',
  lastName: 'Drew',
  friendlyUrl: 'alice',
  tutor: 'Dean',
  instrument: 'Guitar',                                      // Optional
  soundsliceUrl: 'https://www.soundslice.com/courses/18590/', // Optional
  thetaUsername: 'alicefc',                                   // Optional
}, // Alice Drew
```

**Field Guidelines:**
- `firstName`: Required
- `lastName`: Optional (omit if not needed)
- `friendlyUrl`: Required - the URL path (e.g., `/alice`)
- `tutor`: Required - exact tutor name
- `instrument`: Optional - only if overriding MMS data
- `soundsliceUrl`: Optional - full Soundslice course URL
- `thetaUsername`: Optional - format: `[firstname]fc` (lowercase)

---

### Step 3: Generate Config Files

Run the generation script to create all config files:

```bash
npm run generate-configs
```

**What this does:**
- ✅ Backs up existing config files
- ✅ Generates 5 config files from the registry
- ✅ Maintains proper formatting and organization
- ✅ Groups students by tutor
- ✅ Adds proper comments

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

### Step 4: Validate Configuration

```bash
npm run validate
```

**Check for:**
- ✅ 0 errors (warnings are OK)
- ✅ No duplicate URLs or IDs
- ✅ All formats are valid

**Example output:**
```
Total checks run: 13
Errors found: 0
Warnings found: 3
```

---

### Step 5: Test Locally

```bash
npm run dev
```

**Test the student portal:**
```
http://localhost:3000/[friendlyurl]
```

**Verify:**
- ✅ URL resolves (no 404)
- ✅ Student name appears correctly
- ✅ Soundslice button works (if added)
- ✅ Theta Music button works (if added)
- ✅ No console errors

---

### Step 6: Commit and Deploy

```bash
# Stage the registry file (only file you manually edited)
git add lib/config/students-registry.js

# Also stage the auto-generated files
git add lib/student-url-mappings.js lib/student-helpers.js lib/soundslice-mappings.js lib/config/theta-credentials.js lib/config/instruments.js

# Commit with descriptive message
git commit -m "feat: add student [Name] for tutor [Tutor]

Added to students-registry.js:
- [Full Name] (/[url]) - [Tutor]'s student

Generated configs with npm run generate-configs
Validation: 0 errors

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to deploy
git push
```

**Railway will auto-deploy** (takes 1-2 minutes)

---

## ✅ Quick Reference Checklist

```
□ 1. Gather student information (name, MMS ID, tutor, etc.)
□ 2. Choose friendly URL (check for conflicts)
□ 3. Add entry to lib/config/students-registry.js
□ 4. Run: npm run generate-configs
□ 5. Run: npm run validate (must have 0 errors)
□ 6. Run: npm run dev and test at localhost:3000/[name]
□ 7. Commit and push to deploy
□ 8. Verify live at firstchord.co.uk/[name] (wait 1-2 min)
```

---

## 🔍 Where Students Appear

### 1. Tutor Dashboard (Automatic)
- Students appear automatically when they exist in MyMusicStaff
- No code changes needed
- Soundslice/Theta buttons use the config files we generate

### 2. Student Portal (Requires This Setup)
- Individual student portals at `/[friendlyurl]`
- This is what the registry system configures

---

## 🚨 Troubleshooting

### Student Portal Shows 404
1. Check friendly URL in the registry
2. Verify you ran `npm run generate-configs`
3. Check for typos in MMS ID
4. Ensure student is in `VALID_STUDENT_IDS` (auto-generated)

### Student Loads But Shows Error
1. Verify MMS ID format (`sdt_` + 6-7 characters)
2. Check student exists in MyMusicStaff system
3. Look at browser console for specific errors

### Missing Soundslice/Theta Buttons
1. Verify URLs/usernames in registry entry
2. Check they were included in generated config files
3. Clear browser cache and reload

### Build Fails After Changes
1. Check for syntax errors in registry entry (missing commas, quotes)
2. Run `npm run validate` to identify issues
3. Check the error message for specific file/line

### Changes Don't Appear on Railway
1. Verify you committed ALL generated files, not just the registry
2. Check Railway build logs for errors
3. Wait 1-2 minutes for deployment to complete

---

## 📚 Related Documentation

- [Student Registry Guide](../../reference/student-registry.md) - Complete registry system details
- [Validation Guide](../../reference/student-registry-validation.md) - Understanding validation output
- [Troubleshooting Guide](./student-portal-troubleshooting.md) - Common issues

---

**Remember: Always use the Registry System. Never manually edit the generated config files!**
