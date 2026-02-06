# Add Student Skill

Quick reference for adding a new student to the dashboard.

## Required Information

Before starting, gather:
- **Student's full name** (First and Last)
- **MMS Student ID** (format: `sdt_XXXXXX` - get from MyMusicStaff URL)
- **Tutor name** (e.g., Dean, David, Finn, etc.)
- **Instrument** (optional - Guitar, Piano, Bass, etc.)
- **Soundslice course URL** (optional)
- **Theta Music username** (optional - format: `[firstname]fc` lowercase)

## Process

1. **Choose Friendly URL**
   - Use first name in lowercase (e.g., `alice`)
   - If name conflict exists, add last initial (e.g., `stella-c`, `charlie-g`)
   - Check for conflicts: `grep -i "'[firstname]'" lib/student-url-mappings.js`

2. **Update Registry JavaScript File**
   - Open `lib/config/students-registry.js`
   - Find the tutor's section (students grouped by tutor)
   - Add new student entry:
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

3. **Generate Configs**
   ```bash
   npm run generate-configs
   ```
   This auto-generates 5 config files - never edit these manually!

4. **Validate**
   ```bash
   npm run validate
   ```
   Must show 0 errors (warnings OK)

5. **Test Locally**
   ```bash
   npm run dev
   ```
   - Navigate to `http://localhost:3000/[friendlyurl]`
   - Verify student name, Soundslice button, Theta button (if added)
   - Check for console errors

6. **Deploy**
   ```bash
   # Stage registry + auto-generated files
   git add lib/config/students-registry.js lib/student-url-mappings.js lib/student-helpers.js lib/soundslice-mappings.js lib/config/theta-credentials.js lib/config/instruments.js

   git commit -m "feat: add student [Name] for tutor [Tutor]"
   git push
   ```
   Railway auto-deploys in 1-2 minutes

## Common Issues

- **Portal shows 404**: Check friendlyUrl in registry, verify you ran generate-configs
- **Student loads but errors**: Verify MMS ID format (`sdt_` + 6-7 chars)
- **Missing buttons**: Check URLs/usernames in registry entry
- **Build fails**: Check syntax (missing commas/quotes), run validate

## Files Modified
- `lib/config/students-registry.js` (ONLY file you manually edit)
- Auto-generated: `lib/student-url-mappings.js`, `lib/student-helpers.js`, `lib/soundslice-mappings.js`, `lib/config/theta-credentials.js`, `lib/config/instruments.js`

## Full Documentation
See `docs/ADDING_NEW_STUDENTS.md` for comprehensive details
