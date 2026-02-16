# 📖 Student Registry System Guide

**Last Updated**: October 4, 2025
**System Version**: 2.0 (Registry-based)

## 🎯 Overview

The **Student Registry System** is a centralized data management approach where all student information lives in a **single source of truth** file, and the 5 config files are **automatically generated** from it.

### Before vs After

**Before (Manual System)**:
- Update 5 separate files for each student change
- High risk of inconsistencies and missing data
- Hard to see complete student information
- Manual validation required

**After (Registry System)**:
- Update 1 file (`students-registry.js`)
- Run `npm run generate-configs` to auto-generate all 5 files
- Zero risk of inconsistencies
- Complete student data in one place
- Automatic validation included

## 📁 File Structure

### Single Source of Truth
```
lib/config/students-registry.js    # Edit this file ONLY
```

### Auto-Generated Files (DO NOT EDIT MANUALLY)
```
lib/student-url-mappings.js        # Generated from registry
lib/student-helpers.js             # Generated from registry
lib/soundslice-mappings.js         # Generated from registry
lib/config/theta-credentials.js    # Generated from registry
lib/config/instruments.js          # Generated from registry
```

## 🔧 How to Use the Registry System

### Adding a New Student

**Step 1**: Open the registry file
```bash
lib/config/students-registry.js
```

**Step 2**: Find the tutor's section (students are grouped by tutor)
```javascript
export const STUDENTS_REGISTRY = {
  // ... other students ...

  // Finn's students
  'sdt_H6CvJv': {
    firstName: 'Mathilde',
    lastName: 'thallon',
    friendlyUrl: 'mathilde',
    tutor: 'Finn',
    instrument: 'Piano',
    soundsliceUrl: 'https://www.soundslice.com/courses/17397/',
    thetaUsername: 'mathildefc',
  }, // Mathilde thallon

  // ADD NEW STUDENT HERE
```

**Step 3**: Add the new student entry
```javascript
  'sdt_XXXXXX': {
    firstName: 'StudentFirstName',
    lastName: 'StudentLastName',      // Optional - omit if no last name
    friendlyUrl: 'student-url',        // URL like /student-url
    tutor: 'TutorName',
    instrument: 'Piano',               // Optional - omit if using MMS data
    soundsliceUrl: 'https://...',      // Optional - omit if no course
    thetaUsername: 'studentfc',        // Optional - omit if no Theta access
  }, // StudentFirstName StudentLastName
```

**Step 4**: Generate config files
```bash
npm run generate-configs
```

**Step 5**: Validate
```bash
npm run validate
```

**Step 6**: Test locally
```bash
npm run dev
# Visit: http://localhost:3000/student-url
```

**Step 7**: Deploy
```bash
git add .
git commit -m "feat: add [Student Name] to [Tutor]'s students"
git push  # Railway auto-deploys
```

### Updating an Existing Student

**Step 1**: Find the student in `students-registry.js`
```bash
# Search by name or student ID
grep -i "mathilde" lib/config/students-registry.js
```

**Step 2**: Update the student's data
```javascript
'sdt_H6CvJv': {
  firstName: 'Mathilde',
  lastName: 'Thallon',              // Changed capitalization
  friendlyUrl: 'mathilde',
  tutor: 'Finn',
  instrument: 'Guitar',             // Changed instrument
  soundsliceUrl: 'https://www.soundslice.com/courses/NEW_COURSE/',
  thetaUsername: 'mathildefc',
}, // Mathilde Thallon
```

**Step 3**: Regenerate configs
```bash
npm run generate-configs
```

**Step 4**: Validate, test, and deploy
```bash
npm run validate
npm run build
git add . && git commit -m "update: Mathilde's instrument to Guitar" && git push
```

### Removing a Student

**Step 1**: Delete the student entry from `students-registry.js`

**Step 2**: Regenerate configs
```bash
npm run generate-configs
```

**Step 3**: Validate, test, and deploy

## 🎓 Registry Entry Format

### Required Fields
```javascript
'sdt_XXXXXX': {
  firstName: 'String',      // Required
  friendlyUrl: 'string',    // Required - no spaces, lowercase
  tutor: 'String',          // Required - must match tutor name exactly
}
```

### Optional Fields
```javascript
{
  lastName: 'String',                 // Last name (omit if single name)
  instrument: 'Piano|Guitar|Drums',   // Override MMS data (omit to use MMS)
  soundsliceUrl: 'https://...',       // Soundslice course URL
  thetaUsername: 'namefc',            // Theta Music login
}
```

### Complete Example
```javascript
'sdt_635GJ0': {
  firstName: 'Ritisha',
  lastName: 'Paryani',
  friendlyUrl: 'ritisha',
  tutor: 'Jungyoun',
  instrument: 'Piano',
  soundsliceUrl: 'https://www.soundslice.com/courses/17489/',
  thetaUsername: 'ritishafc',
}, // Ritisha Paryani
```

## ⚠️ Understanding the `tutor` Field

### What It Controls

The `tutor` field in `students-registry.js` is **for organizational purposes only**:

✅ **DOES**:
- Groups students into sections in generated config files
- Adds helpful comments like `// Finn's students`
- Makes maintenance easier (finding students by tutor)
- Helps organize the codebase

❌ **DOES NOT**:
- Control which tutor sees which students on the **live dashboard**
- Affect MMS API responses
- Automatically update when tutors change in MMS
- Determine actual tutor assignments

### The Two Data Sources

**1. Student Registry** (`students-registry.js`):
- **Purpose**: Portal configuration and code organization
- **Updates**: Manual edits by developers
- **Used For**: Student portal pages, Soundslice links, Theta credentials

**2. MMS API** (Live data from My Music Staff):
- **Purpose**: Live tutor dashboard and billing
- **Updates**: Automatic via MMS system
- **Used For**: Tutor dashboards, student lists, lesson tracking

### When Tutors Change

If a student's tutor changes in MMS:

1. **Dashboard Updates Automatically** - No code changes needed
2. **Registry Needs Manual Update** - To keep code organized

**Example**: When Jungyoun left and students moved to Eléna:
- ✅ Dashboard showed new tutor immediately (via MMS API)
- ❌ Registry still showed old tutor until manually updated
- ⚠️ This caused confusion but didn't break functionality

### How to Detect Stale Tutor Assignments

Check for mismatches between registry and live MMS data:

1. Open the live dashboard at https://firstchord.co.uk/dashboard
2. Select a tutor and view their students
3. Compare with registry file groupings
4. Update registry `tutor` field if mismatched
5. Run `npm run generate-configs`

### Best Practice

**Update the registry when tutors change** to keep the codebase organized and prevent confusion for future developers/agents working on the code.

## 📊 Available Tutors

When adding students, use these exact tutor names:
- `Finn`
- `Dean`
- `Tom`
- `Fennella`
- `Patrick`
- `Eléna`
- `Kenny`
- `David`
- `Kim`
- `Robbie`
- `Stef`
- `Arion`
- `Maks`
- `Unknown` (for students without assigned tutor)

**Note**: Jungyoun has left (students moved to Eléna)

## 🔄 Generator Script Details

### What `npm run generate-configs` Does

1. **Reads** `lib/config/students-registry.js`
2. **Groups** students by tutor
3. **Generates** all 5 config files with:
   - Proper formatting and spacing
   - Tutor section comments
   - Helper functions included
   - Sorted by tutor name
4. **Backs up** old files to `backups/configs-TIMESTAMP/`
5. **Writes** new files to proper locations

### Output Example
```
🔨 Generating config files from student registry...

📂 Loading student registry...
✓ Loaded 168 students

👥 Grouping students by tutor...
✓ Found 14 tutors

📊 Students per tutor:
   Finn: 30 students
   Dean: 22 students
   Tom: 22 students
   ...

📦 Backed up existing files to: backups/configs-2025-10-04T11-31-42/

🔨 Generating config files...
✓ Generated: lib/student-url-mappings.js
✓ Generated: lib/student-helpers.js
✓ Generated: lib/soundslice-mappings.js
✓ Generated: lib/config/theta-credentials.js
✓ Generated: lib/config/instruments.js

✅ Config generation complete!
```

## ⚙️ Advanced Usage

### Batch Adding Multiple Students

**Option 1: Manual Entry**
1. Add all students to `students-registry.js` at once
2. Run generator once: `npm run generate-configs`
3. Validate: `npm run validate`
4. Test and deploy

**Option 2: Script-based** (for 10+ students)
1. Create a JSON file with student data
2. Write a script to append to registry
3. Run generator
4. Validate and deploy

### Migrating from Old System

If you have students in the old 5-file system:
```bash
# Migration already done, but for reference:
node scripts/migrate-to-registry.js          # Basic migration
node scripts/migrate-to-registry-with-tutors.js  # With tutor detection
```

### Restoring from Backup

If generation goes wrong:
```bash
# Find the backup
ls backups/

# Copy files back
cp backups/configs-TIMESTAMP/* lib/
cp backups/configs-TIMESTAMP/theta-credentials.js lib/config/
cp backups/configs-TIMESTAMP/instruments.js lib/config/
```

## 🚨 Common Issues

### Issue: "Unexpected identifier" Error

**Cause**: Syntax error in registry file (missing comma, quote, etc.)

**Fix**:
```bash
# Check for syntax errors
node -c lib/config/students-registry.js

# Common mistakes:
# - Missing comma after closing brace: }, // Name
# - Mismatched quotes: 'firstName: "Value'
# - Missing closing brace: }
```

### Issue: Student Not Appearing on Site

**Checklist**:
1. ✅ Added to registry file
2. ✅ Ran `npm run generate-configs`
3. ✅ Ran `npm run validate` (0 errors)
4. ✅ Restarted dev server or rebuilt app
5. ✅ Deployed to Railway

### Issue: Validation Warnings

**Warnings are OK!** They're informational:
- Missing Soundslice: Intentional if student doesn't have course yet
- Missing Theta: Intentional if student doesn't use Theta Music
- Missing instruments: Intentional - will use MMS data

**Errors must be fixed** before deployment.

## 📈 Benefits Summary

### Time Savings
- **Before**: 5-10 minutes per student × 5 files = ~30 min
- **After**: 2 minutes to edit registry + 10 seconds to generate = ~2 min
- **Savings**: ~93% faster per student

### Data Integrity
- **Before**: Manual sync across 5 files, prone to errors
- **After**: Single source of truth, impossible to have inconsistencies

### Maintenance
- **Before**: Search across 5 files to find student data
- **After**: Search 1 file, see complete student info at once

### Scalability
- **Current**: 168 students, 44KB registry file
- **Capacity**: Can easily handle 500+ students, possibly 1,000+
- **Performance**: Modern editors handle files up to 10-50MB

## 🎯 Next Steps

1. **Familiarize yourself** with the registry structure
2. **Practice** adding a test student
3. **Document** any issues or improvements needed
4. **Update** AGENT_QUICK_START.md with registry workflow
5. **Train** team members on new system

---

**For Questions or Issues**:
- Check `docs/workflows/` for detailed workflows
- Run `npm run validate` for data integrity checks
- Review `AGENT_QUICK_START.md` for quick reference
- Check git history for examples: `git log --grep="student"`
