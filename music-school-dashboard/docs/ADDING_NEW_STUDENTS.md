# Adding New Students to the Portal System

**Last Updated**: September 29, 2025  
**Verified Working**: Kenny's 6 students with URL simplification  
**Related Files**: [DEPLOYMENT_PROTOCOLS.md](../DEPLOYMENT_PROTOCOLS.md), [NOTES_EDGE_CASE_PROTOCOL.md](../NOTES_EDGE_CASE_PROTOCOL.md)

## 🚨 Quick Fixes
- **Student portal shows 404?** → Check friendly name in `student-url-mappings.js` and student ID in `VALID_STUDENT_IDS`
- **Student loads but shows error?** → Verify MMS ID format and student exists in MMS system
- **Missing Soundslice/Theta?** → Check mappings in respective files and confirm student assignments
- **Naming conflicts?** → Use conflict resolution pattern: `firstname-lastinitial`
- **Build fails after changes?** → Check syntax in all modified config files

## Overview
This guide walks through the complete process of adding new students to the friendly URL portal system. Follow these steps in order to ensure proper functionality.

## Prerequisites
- Student enrolled in MMS (MyMusicStaff)
- Student has an MMS ID (format: `sdt_XXXXXX`)
- Student information available (name, tutor, etc.)

## Step-by-Step Process

### Step 1: Determine Friendly URL Name
**Choose the student's friendly URL name:**

1. **Primary rule**: Use first name in lowercase
   ```
   Mathilde → mathilde
   Alex → alex
   Pablo → pablo
   ```

2. **Conflict resolution**: If name already exists, add last initial
   ```
   Stella Cook → stella-c
   Stella French → stella-f
   Charlie Gillespie → charlie-g
   Charlie Norton → charlie-n
   ```

3. **Name validation**: Only use lowercase letters and hyphens
   - ✅ Valid: `mathilde`, `alex`, `stella-c`
   - ❌ Invalid: `Mathilde`, `alex123`, `stella_c`

### Step 2: Add URL Mapping
**File**: `lib/student-url-mappings.js`

1. **Open the file and locate the appropriate section**
2. **Add the new mapping** to the `STUDENT_URL_MAPPINGS` object:
   ```javascript
   export const STUDENT_URL_MAPPINGS = {
     // Existing mappings...
     'newstudent': 'sdt_NEWID123',     // New Student Name
     // More mappings...
   };
   ```

3. **Add descriptive comment** with full name:
   ```javascript
   'alice': 'sdt_ABC123',              // Alice Johnson
   ```

4. **Check for naming conflicts** before adding
5. **Maintain alphabetical order** within tutor sections if organized by tutor

### Step 3: Add Security Whitelist
**File**: `lib/student-helpers.js`

1. **Locate the `VALID_STUDENT_IDS` array**
2. **Add the student's MMS ID** to the array:
   ```javascript
   const VALID_STUDENT_IDS = [
     // Existing IDs...
     'sdt_NEWID123', // New Student Name (/newstudent)
     // More IDs...
   ];
   ```

3. **Add descriptive comment** with name and friendly URL
4. **Maintain organization** by tutor or alphabetical order

### Step 4: Add Soundslice Course (Optional)
**File**: `lib/soundslice-mappings.js`

**Only if the student has a Soundslice course:**

1. **Get the Soundslice course URL** from the tutor
2. **Add mapping** to the `SOUNDSLICE_MAPPINGS` object:
   ```javascript
   const SOUNDSLICE_MAPPINGS = {
     // Existing mappings...
     'sdt_NEWID123': 'https://www.soundslice.com/courses/12345/', // New Student
     // More mappings...
   };
   ```

3. **Organize by tutor** for easier maintenance
4. **Add comment** with student name

### Step 5: Add Theta Music Credentials (Optional)
**File**: `lib/config/theta-credentials.js`

**Only if the student uses Theta Music:**

1. **Generate Theta credentials** (format: `[firstname]fc`)
2. **Add mapping** to the `thetaCredentials` object:
   ```javascript
   export const thetaCredentials = {
     // Existing credentials...
     'sdt_NEWID123': 'newfirstnamefc',  // New Student Name
     // More credentials...
   };
   ```

3. **Follow naming pattern**: `[firstname]fc`
4. **Special cases**: Some students use `[firstname]firstchord`
5. **Add comment** with full student name

### Step 6: Test the New Student Portal

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Test the friendly URL**:
   ```
   http://localhost:3000/newstudent
   ```

3. **Verify the following**:
   - ✅ URL resolves (no 404)
   - ✅ Student name appears in header
   - ✅ Notes section loads (may show "no notes" if none exist)
   - ✅ Soundslice link appears (if added)
   - ✅ Theta credentials appear (if added)
   - ✅ Mobile responsive design works

### Step 7: Commit and Deploy

> **See [DEPLOYMENT_PROTOCOLS.md](../DEPLOYMENT_PROTOCOLS.md) for complete deployment process**

1. **Add files to git**:
   ```bash
   git add lib/student-url-mappings.js
   git add lib/student-helpers.js
   git add lib/soundslice-mappings.js    # if modified
   git add lib/config/theta-credentials.js    # if modified
   ```

2. **Create commit** with descriptive message:
   ```bash
   git commit -m "Add student portal for [Student Name] (/[friendlyurl])
   
   🤖 Generated with Claude Code
   
   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

3. **Push to repository** (Railway auto-deploys from git pushes):
   ```bash
   git push
   ```

### Step 8: Update WordPress Redirect (If Needed)

**Usually not needed**, but if new character types are required:

1. **Access WordPress admin**
2. **Go to Redirection plugin**
3. **Update regex pattern** if needed:
   - Current: `^/([a-z-]+)/?$`
   - Supports: lowercase letters and hyphens only

## Quick Reference Checklist

```
□ 1. Choose friendly URL name (check for conflicts)
□ 2. Add to student-url-mappings.js
□ 3. Add to VALID_STUDENT_IDS in student-helpers.js
□ 4. Add Soundslice course (if applicable)
□ 5. Add Theta credentials (if applicable)
□ 6. Test locally at http://localhost:3000/[name]
□ 7. Commit and deploy
□ 8. Test live at firstchord.co.uk/[name]
```

## Common Naming Patterns

### Single Name Students
```javascript
'mathilde': 'sdt_H6CvJv',           // Mathilde thallon
'alex': 'sdt_gwyQJr',               // Alex Chang
'pablo': 'sdt_Kq3RJW',              // Pablo Cunningham
```

### Conflict Resolution Examples
```javascript
'stella-c': 'sdt_x48LJT',           // Stella Cook
'stella-f': 'sdt_Nt4LJ3',           // Stella French
'stella-h': 'sdt_sfbtJ5',           // Stella Hart
'charlie-g': 'sdt_H5yHJQ',          // Charlie Gillespie
'charlie-m': 'sdt_2s8CJk',          // Charlie Mcdougall
'charlie-n': 'sdt_417JJ3',          // Charlie Norton
```

### Special Cases
```javascript
'rosie-k': 'sdt_pFYFJT',            // Rosie & Johnny Kinniburgh (dual student)
'silverray': 'sdt_pGqXJ9',          // Silver-Ray Noramly (hyphenated first name)
```

## Error Prevention

### Before Adding a Student
1. **Verify MMS ID format** (should be `sdt_` followed by 6-7 characters)
2. **Check name conflicts** in existing mappings
3. **Confirm student is enrolled** and active in MMS
4. **Get correct Soundslice URL** from tutor if applicable

### Testing Requirements
- Test on both desktop and mobile
- Verify all sections render correctly
- Check console for any errors
- Test both locally and after deployment

## Troubleshooting New Student Issues

### Student Portal Shows 404
1. Check friendly name in `student-url-mappings.js`
2. Verify student ID in `VALID_STUDENT_IDS` array
3. Ensure no typos in MMS ID

### Student Portal Loads But Shows Error
1. Check MMS ID format and validity
2. Verify student exists in MMS system
3. Check console for API errors

### Missing Soundslice/Theta
1. Verify mappings in respective files
2. Check student has been assigned to course/system
3. Confirm URLs and credentials are correct