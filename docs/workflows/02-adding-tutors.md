# Workflow: Adding New Tutors

**Purpose**: Add a new tutor to the dashboard and set up their first students

**Time Required**: 15-20 minutes
**Last Updated**: October 3, 2025

---

## Prerequisites Checklist

Before starting, gather this information:

- [ ] **Tutor's full name**
- [ ] **MMS Teacher ID** (format: `tch_XXXXXX`)
- [ ] **List of their students** with all student info (see Prerequisites in `01-adding-students.md`)

---

## Overview

Adding a tutor involves **TWO MAIN STEPS**:

1. **Add tutor to the dashboard** (code changes)
2. **Add their students** (follow `01-adding-students.md` for each)

---

## Finding the Teacher ID

The teacher ID is needed to fetch their students from MyMusicStaff API.

### Method 1: MMS Payroll Network Console (Recommended)

1. **Log into MyMusicStaff** admin account
2. **Open browser DevTools** (F12 or Right-click → Inspect)
3. **Go to Network tab** in DevTools
4. **Navigate to**: Reports → Payroll Report
5. **Select the tutor** from the dropdown
6. **Find the API request** in Network tab:
   - Look for request to: `api/v3/teachers/[teacher_id]/...`
   - Or: `payroll?teacher_id=[teacher_id]`
7. **Copy the teacher ID** (format: `tch_XXXXXX`)

### Method 2: MMS API Explorer Script

If you have API access:

```bash
# Run the MMS API explorer
node mms-api-explorer.js

# Select option to list all teachers
# Find the tutor's name and copy their ID
```

### Method 3: Check Existing Tutors

Look at existing teacher IDs in the codebase:

```bash
grep "tch_" lib/mms-client.js
```

Pattern is usually consistent (e.g., sequential IDs).

---

## Step-by-Step Instructions

### Step 1: Add Tutor to Dashboard Dropdown

**File**: `app/dashboard/page-client.js`

Find the `TEACHERS` array (around line 15-35) and add the new tutor:

```javascript
const TEACHERS = [
  { name: 'All Teachers', value: 'all' },
  { name: 'Finn', value: 'Finn' },
  { name: 'Dean', value: 'Dean' },
  // ... other teachers ...
  { name: 'Kenny', value: 'Kenny' },
  { name: 'NewTutor', value: 'NewTutor' },  // ← Add here
];
```

**Important**:
- Add in a logical order (alphabetical or by start date)
- The `value` field must match exactly what's in the teacher ID mapping (next step)

### Step 2: Add Teacher ID Mapping

**File**: `lib/mms-client.js`

Find the `TEACHER_ID_MAP` object (around line 15-30) and add the mapping:

```javascript
const TEACHER_ID_MAP = {
  'Finn': 'tch_T1234',
  'Dean': 'tch_ABC123',
  // ... other teachers ...
  'Kenny': 'tch_zsyfJr',
  'NewTutor': 'tch_XXXXXX',  // ← Add here with actual ID
};
```

**Pattern**:
```javascript
'[TutorName]': 'tch_XXXXXX',
```

**Critical**: The name must match the `value` field from Step 1.

### Step 3: Adjust Dashboard Grid Layout (If Needed)

The dashboard uses a grid layout. Currently configured for 15 tutors (4×4 grid).

**File**: `app/dashboard/page-client.js`

Find the grid CSS class (around line 100-150):

```javascript
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
  {/* Teacher buttons */}
</div>
```

**Current grid sizes**:
- Mobile: 2 columns
- Tablet: 3 columns
- Desktop: 4 columns

**If you're adding the 16th+ tutor**, consider:
- Keep 4×4 grid (16 tutors)
- Adjust to 5×4 grid for 17-20 tutors: `lg:grid-cols-5`
- Or keep adding to 4-column grid (scrolls)

**Note**: Grid layout is flexible and will wrap automatically.

### Step 4: Add Their Students

For **each student** the tutor teaches:

1. **Follow**: `docs/workflows/01-adding-students.md`
2. **Update all 5 config files** per student
3. **Group by tutor** in each file for organization

**Example** - Adding Kenny's students:
```javascript
// In each config file, add a comment section:

// Kenny's students
'sdt_L9nZJs': 'craigfc',          // Craig Mcaulay
'sdt_LTf0Jx': 'oliviafc',         // Olivia Wong
// ... etc
```

---

## Testing

### Local Testing

1. **Start dev server**:
```bash
npm run dev
```

2. **Test dashboard dropdown**:
```
Visit: http://localhost:3000/dashboard
```
- [ ] New tutor appears in dropdown
- [ ] Selecting tutor shows their students
- [ ] Student cards display correctly
- [ ] All student data loads (notes, instruments, etc.)

3. **Test each student portal**:
```
Visit: http://localhost:3000/[student-name]
```
- [ ] Portal loads for each student
- [ ] All sections work (notes, Soundslice, Theta)

4. **Test "All Teachers" view**:
```
Visit: http://localhost:3000/dashboard
Select: "All Teachers"
```
- [ ] New tutor's students appear in combined view
- [ ] No duplicate students
- [ ] Sorting/filtering works

### Build Test

```bash
npm run build
```

Check for errors related to:
- Teacher mapping syntax
- Student config syntax
- Import/export issues

---

## Deployment

### Commit and Push

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: add [Tutor Name] to dashboard with [X] students

- Added tutor to dashboard dropdown
- Added teacher ID mapping: tch_XXXXXX
- Configured [X] student portals:
  - [Student 1 Name]
  - [Student 2 Name]
  - [Student 3 Name]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
"

# Push to Railway
git push
```

### Monitor Deployment

1. **Wait 2-3 minutes** for Railway deployment
2. **Test live dashboard**:
```
https://efficient-sparkle-production.up.railway.app/dashboard
```
3. **Test live student portals**:
```
https://efficient-sparkle-production.up.railway.app/[student-name]
```

---

## Verification Checklist

### Dashboard
- [ ] Tutor appears in dropdown list
- [ ] Selecting tutor loads their students
- [ ] Student count is correct
- [ ] Student cards show complete info
- [ ] No console errors

### Student Portals
- [ ] Each student portal loads
- [ ] Notes display correctly
- [ ] Soundslice links work
- [ ] Theta credentials show
- [ ] Correct instruments display

### All Teachers View
- [ ] New students appear in combined view
- [ ] No missing students
- [ ] No duplicate entries

---

## Common Issues & Solutions

### Issue: Tutor appears in dropdown but shows no students
**Cause**: Teacher ID incorrect or not in MyMusicStaff
**Fix**:
- Verify teacher ID using Method 1 (Network tab)
- Check teacher ID format: `tch_XXXXXX`
- Ensure teacher has students assigned in MMS

### Issue: Tutor doesn't appear in dropdown
**Cause**: Not added to TEACHERS array
**Fix**: Add to `app/dashboard/page-client.js` TEACHERS array

### Issue: API error when selecting tutor
**Cause**: Teacher ID mapping incorrect or missing
**Fix**:
- Check `lib/mms-client.js` has correct mapping
- Verify name matches exactly between files

### Issue: Grid layout looks wrong
**Cause**: Too many tutors for current grid size
**Fix**: Adjust `grid-cols-X` classes in page-client.js

### Issue: Some students missing from dashboard
**Cause**: Students not assigned to teacher in MMS, or MMS sync issue
**Fix**:
- Check student assignments in MyMusicStaff
- Verify teacher is marked as primary teacher for those students

### Issue: Student appears on dashboard but portal 404s
**Cause**: Student added to MMS but not to portal config files
**Fix**: Follow `01-adding-students.md` to add portal configuration

---

## Grid Layout Reference

Current tutor counts and grid layouts:

| Tutors | Grid Layout | CSS Class |
|--------|-------------|-----------|
| 1-4 | 2×2 | `grid-cols-2 md:grid-cols-2 lg:grid-cols-2` |
| 5-9 | 3×3 | `grid-cols-2 md:grid-cols-3 lg:grid-cols-3` |
| 10-16 | 4×4 | `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` ← Current |
| 17-20 | 5×4 | `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` |
| 20+ | 6×4 | `grid-cols-2 md:grid-cols-4 lg:grid-cols-6` |

---

## Quick Reference - Files to Update

### Dashboard Setup (Tutor)
| File | What to Add | Example |
|------|-------------|---------|
| `app/dashboard/page-client.js` | TEACHERS array | `{ name: 'Kenny', value: 'Kenny' }` |
| `lib/mms-client.js` | TEACHER_ID_MAP | `'Kenny': 'tch_zsyfJr'` |

### Student Configuration (For Each Student)
| File | What to Add | Pattern |
|------|-------------|---------|
| `student-url-mappings.js` | Friendly URL | `'craig': 'sdt_L9nZJs',` |
| `student-helpers.js` | Security whitelist | Add to VALID_STUDENT_IDS |
| `soundslice-mappings.js` | Course URL | `'sdt_L9nZJs': 'https://...',` |
| `theta-credentials.js` | Credentials | `'sdt_L9nZJs': 'craigfc',` |
| `instruments.js` | Instrument | `'sdt_L9nZJs': 'Guitar',` |

---

## Example: Complete Kenny Setup

Here's how Kenny (the 15th tutor) was added:

### Dashboard Files:
```javascript
// app/dashboard/page-client.js
{ name: 'Kenny', value: 'Kenny' }

// lib/mms-client.js
'Kenny': 'tch_zsyfJr'
```

### Student Files (6 students):
```javascript
// lib/student-url-mappings.js
// Kenny's students
'craig': 'sdt_L9nZJs',
'olivia-w': 'sdt_LTf0Jx',
'katie': 'sdt_cZsDJp',
'nina': 'sdt_cZsMJD',
'joe': 'sdt_LxdXJC',
'iain': 'sdt_60tqJf',

// Repeated in other 4 config files with appropriate values...
```

---

## Related Workflows

- See: `01-adding-students.md` - How to add each student
- See: `03-troubleshooting-common-issues.md` - For debugging
- See: `05-testing-guide.md` - Comprehensive testing
