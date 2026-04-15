# 🚀 Music School Dashboard - Deployment Protocols

**Last Updated**: September 29, 2025  
**Verified Working**: Kenny student setup and URL simplification  
**Related Files**: [ADDING_NEW_STUDENTS.md](./docs/ADDING_NEW_STUDENTS.md), [NOTES_EDGE_CASE_PROTOCOL.md](./NOTES_EDGE_CASE_PROTOCOL.md)

## 🚨 Quick Fixes
- **Build fails?** → Check syntax in config files, run `npm run build` locally first
- **Students not loading?** → Verify teacher ID in `/lib/mms-client.js` 
- **Railway deployment stuck?** → Railway auto-deploys from git push - just commit and push
- **URLs not working?** → Check student-url-mappings.js and student-helpers.js for conflicts
- **Internal server errors?** → Restart dev server after config changes: `npm run dev`

## Overview
This document contains all deployment and maintenance protocols for the Music School Dashboard project.

## 📋 Railway Deployment Protocol

### Pre-Deployment Checklist
Before deploying, always run through this checklist:

```bash
# 1. Check git status (ensure all changes are committed)
git status

# 2. Test build locally
npm run build

# 3. Verify Railway connection
railway status
```

### Expected Outputs:
- **Git Status**: Should show "nothing to commit, working tree clean"
- **Build**: Should complete with "✓ Compiled successfully"
- **Railway Status**: Should show project and service names (not "Service: None")

### Deployment Steps

```bash
# Step 1: Verify Railway connection
railway status

# Step 2: If "Service: None" appears, re-link the project
railway link
# Select: efficient-sparkle project & efficient-sparkle service

# Step 3: Deploy
railway up

# Step 4: Monitor deployment
# Build logs URL will be provided in terminal output
# Live site: https://efficient-sparkle-production.up.railway.app
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Select template to deploy" appears | Run `railway link` first |
| "Service: None" in status | Run `railway link` and select correct project/service |
| Deploy command hangs | Use Railway web dashboard or ctrl+c and retry |
| Build fails | Check build logs URL provided in output |

### Quick Commands Reference

```bash
# Essential Railway commands
railway login --browserless    # Login to Railway
railway status                 # Check project connection
railway link                   # Link to project/service
railway up                     # Deploy application
railway up --verbose           # Deploy with verbose output
railway domain                 # Get live URL
railway logs                   # View deployment logs (may timeout - normal)
railway open                   # Open Railway dashboard
```

**Note**: Railway deployments show progress via build logs URL in terminal. The `railway logs` command may timeout but deployment continues running. Look for:
- "Starting Container"  
- "✓ Ready in XXXms"
- Container running on port 8080

## 🔧 Development Protocols

### Local Development Setup
```bash
npm install                     # Install dependencies
npm run dev                     # Start development server
```

### Code Changes Protocol
```bash
# 1. Make changes to code
# 2. Test locally
npm run dev

# 3. Build test
npm run build

# 🚨 CRITICAL RULE: ALWAYS TEST MANUALLY BEFORE COMMITS/DEPLOYS
# - Test all functionality that was changed
# - Verify no regressions in existing features
# - Get user approval before proceeding

# 4. Commit changes (use git add . to avoid macOS permission issues)
git add .
git commit -m "Descriptive commit message"

# 5. Push to repository
git push

# 6. Deploy (follow Railway protocol above)
```

### Development Server Management

After making significant changes to configuration files (especially `/lib/config/` files or `/lib/mms-client.js`), restart the development server:

```bash
# Kill current server (Ctrl+C or kill command)
# Then restart:
npm run dev
```

**When to restart the server:**
- After adding new tutor credentials in `lib/config/theta-credentials.js`
- After modifying instrument overrides in `lib/config/instruments.js`
- After updating service configurations in `lib/config/services.js`
- When experiencing internal server errors
- After significant configuration changes

### Git Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission warnings on macOS | Use `git add .` instead of `git add -A` |
| "could not open directory" warnings | These are harmless macOS permission messages, ignore them |
| Commit fails | Check `git status` first, then use `git add .` |

## 🎯 Student Management Protocols

> **For detailed student portal setup, see [ADDING_NEW_STUDENTS.md](./docs/ADDING_NEW_STUDENTS.md)**

### Adding New Tutors with Theta Music Integration

When adding students for a new tutor with Theta Music accounts:

**Step 1: Gather Required Information**
- Student surname and first name
- Student MMS ID (format: `sdt_XXXXX`)
- Theta Music username (typically `[firstname]fc`)
- Student instrument (Piano, Guitar, Voice, etc.)
- Soundslice course URLs (if applicable)

**Step 2: Update Configuration Files**

1. **Add Theta Music Credentials** in `/lib/config/theta-credentials.js`:
   ```javascript
   // [TutorName]'s students with Theta Music credentials
   'sdt_ABC123': 'studentfc',    // Student Name
   'sdt_DEF456': 'anotherstudentfc',    // Another Student
   ```

2. **Add Instrument Overrides** in `/lib/config/instruments.js`:
   ```javascript
   // [TutorName]'s students with correct instruments
   'sdt_ABC123': 'Piano',        // Student Name
   'sdt_DEF456': 'Guitar',       // Another Student
   'sdt_GHI789': 'Voice',        // Voice Student
   'sdt_JKL012': 'Piano / Voice', // Multi-instrument
   ```

3. **Add Soundslice Course URLs** in `/lib/soundslice-mappings.js`:
   ```javascript
   // [TutorName]'s students
   'sdt_ABC123': 'https://www.soundslice.com/courses/12345/', // Student Name
   'sdt_DEF456': 'https://www.soundslice.com/courses/67890/', // Another Student
   ```

**Step 3: Test and Deploy**
- Restart development server: `npm run dev`
- Test locally at http://localhost:3000/dashboard
- Select the tutor from dropdown
- Verify students show with correct instruments
- Test Theta Music buttons for credential display
- Run `npm run build` to test build
- Follow deployment protocols

### Adding Completely New Tutors

When adding a brand new tutor to the system:

**Step 1: Gather Required Information**
- Tutor's full name (e.g., "David Husz")
- MMS Teacher ID (e.g., `tch_z2j2Jf`) - or use placeholder initially
- Student information (names, MMS IDs, instruments, Theta credentials, Soundslice URLs)

**Step 2: Update All Required Files**

1. **Add to mms-client.js teacher ID mapping:**
   ```javascript
   'NewTutor': 'tch_MMSID',
   'NewTutor FullName': 'tch_MMSID',
   'newtutor': 'tch_MMSID'
   ```

2. **Add students' Theta credentials to config/theta-credentials.js**
3. **Add students' instrument overrides to config/instruments.js** 
4. **Add students' Soundslice URLs to soundslice-mappings.js**
5. **🚨 CRITICAL: Add tutor to dashboard dropdown in `/app/dashboard/page-client.js`:**
   ```javascript
   {['Arion', 'David', 'Dean', ...].map(tutorName => (
   ```

**Step 3: Test and Deploy**
- Follow standard deployment protocol
- **Verify tutor appears in dropdown**
- **Test student loading and Theta Music buttons**

### Updating Teacher IDs from Placeholder to Real

When you get a real MMS Teacher ID for a tutor:

1. **Update mms-client.js** - Replace placeholder with real ID
2. **Test locally** - Verify students load from MMS API
3. **Deploy following standard protocol**

### Adding New Students to Theta Music

When adding students for an existing tutor:

1. **Get student information:**
   - Surname, First Name
   - Theta Music username/password
   - MMS ID (from MyMusicStaff)
   - Instrument (if different from tutor default)
   - Soundslice course URL (if applicable)

2. **Update configuration files in order:**

   **a) Add Theta Music Credentials** in `/lib/config/theta-credentials.js`:
   ```javascript
   // Find the tutor's section in thetaCredentials object:
   'sdt_MMSID': 'thetausername',    // Student Name
   ```

   **b) Add Instrument Override** in `/lib/config/instruments.js`:
   ```javascript
   // Find the instrumentOverrides object:
   'sdt_MMSID': 'Guitar',          // Student Name - use Piano, Guitar, Voice, etc.
   ```

   **c) Add Soundslice Course URL** in `/lib/soundslice-mappings.js`:
   ```javascript
   // Find the tutor's section:
   'sdt_MMSID': 'https://www.soundslice.com/courses/12345/', // Student Name
   ```

3. **Test and deploy:**
   - Restart development server: `npm run dev`
   - Test locally at http://localhost:3000/dashboard
   - Select the tutor and verify new student appears with correct instrument

## 🧹 Project Cleanup Protocol

### Regular Maintenance (Monthly or When Noticed)

Keep the codebase clean by removing temporary files and unused scripts:

**Step 1: Identify Files to Remove**
```bash
# Find empty files that serve no purpose
find . -name "*.js" -size 0 -not -path "./node_modules/*"
find . -name "*.txt" -size 0 -not -path "./node_modules/*"
find . -name "*.log" -size 0 -not -path "./node_modules/*"
```

**Step 2: Remove Temporary/Migration Files**
```bash
# Common patterns to remove:
rm -f update_*.js          # Old migration scripts
rm -f *_temp.js           # Temporary files
rm -f debug_*.js          # Debug scripts
rm -f test_*.js           # Ad-hoc test files (not official tests)
rm -f *.log               # Log files
rm -f api-test.js         # Test scripts
rm -f sync-*.js           # One-time sync scripts
```

**Step 3: Clean Development Artifacts**
```bash
# Remove common development leftovers
rm -f .env.backup*        # Backup environment files
rm -f *.tmp               # Temporary files
rm -f *copy*              # Copy files
```

**Step 4: Commit Cleanup**
```bash
# Stage deletions
git add -A

# Commit with descriptive message
git commit -m "chore: Clean up temporary and empty files

- Remove empty migration scripts (update_*.js)
- Remove debug and test artifacts  
- Clean up temporary log files
- Improve project structure and maintainability

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Files to NEVER Remove
- `package.json` / `package-lock.json`
- `next.config.ts` / `tsconfig.json`
- `tailwind.config.js` / `postcss.config.mjs`
- `.env.example` (template for others)
- `README.md` / `DEPLOYMENT_PROTOCOLS.md`
- Any files in `/app`, `/components`, `/lib` (unless verified unused)
- `railway.json` / `vercel.json` / `nixpacks.toml`

### Best Practices
1. **Use temporary files sparingly** - prefer direct edits to config files
2. **Delete migration scripts after use** - don't let them accumulate  
3. **Name temporary files clearly** - use `temp_`, `debug_`, `test_` prefixes
4. **Clean up weekly** - don't let clutter accumulate
5. **Check functionality** - always test after cleanup before deploying
   - Test Theta Music button for credentials
   - Test Soundslice link
   - Run `npm run build` to test build
   - Follow full deployment protocol

### Important Notes & Troubleshooting

**Common Issues:**
- **Duplicate MMS IDs**: If multiple students have the same MMS ID, only the first will work. Comment out duplicates and note they need unique IDs.
- **Internal Server Errors**: Always restart dev server after config changes using `npm run dev`
- **Missing Instruments**: Students without instrument overrides will default to "Guitar"
- **Case Sensitivity**: Theta Music usernames are case-sensitive

**Supported Instruments:**
- `Piano`, `Guitar`, `Voice`, `Bass`, `Drums`, `Piano / Voice`, etc.

**Current Tutors with Theta Music Integration:**
- **Finn**: 28 students (Piano, Guitar, Bass, Voice)
- **Dean**: 18 students (Piano, Guitar, Voice)  
- **Fennella**: 27 students (Piano, Voice)
- **Patrick**: 9 students (Piano, Guitar)
- **Jungyoun**: 9 students (Piano)
- **Eléna**: 8 students (Piano)
- **David**: 3 students (Piano, Piano/Guitar)  
- **Tom**: 24 students (Guitar)

**Total: 126 students across 8 tutors**

**Remaining Tutors (Placeholders Ready):**
- Eve, Arion, Kim, Robbie, Stef

### Student Data Format

```text
Surname    First Name    Theta Username    MMS ID        Instrument
Example    Student       studentfc         sdt_ABC123    Piano
```

## 🏗️ Project Structure

### Key Files

**Configuration Files:**
- `/lib/config.js` - Main config entry point (re-exports from modular files)
- `/lib/config/theta-credentials.js` - Theta Music student credentials
- `/lib/config/instruments.js` - Student instrument overrides
- `/lib/config/services.js` - External service configurations & authentication
- `/lib/config/url-generators.js` - URL generation logic for external services
- `/lib/soundslice-mappings.js` - Soundslice course URL mappings
- `/lib/mms-client.js` - MyMusicStaff API client with teacher IDs

**Component Files:**
- `/components/layout/Dashboard.js` - Main dashboard container component
- `/components/navigation/QuickLinks.js` - Theta Music modal and credentials display
- `/components/student/StudentCard.js` - Student cards with instrument display
- `/components/student/NotesPanel.js` - Student lesson notes display
- `/components/auth/AuthStatus.js` - Authentication status components
- `/components/setup/SetupWizard.js` - Initial setup wizard components

**API Routes:**
- `/app/api/students/route.js` - Student data API endpoint
- `/app/dashboard/page.js` - Main dashboard page

### External Services
- **MyMusicStaff API** - Student data source
- **Soundslice** - Sheet music platform
- **Theta Music** - Educational games platform
- **Railway** - Hosting platform

## ✅ Post-Deployment Verification Checklist

After every deployment, verify these items work:

**Live Site Verification (https://efficient-sparkle-production.up.railway.app):**
- [ ] Site loads without errors
- [ ] All tutors appear in dropdown (13 total: Arion, David, Dean, Eléna, Eve, Fennella, Finn, Jungyoun, Kim, Patrick, Robbie, Stef, Tom)
- [ ] Select each integrated tutor and verify students load
- [ ] Test Theta Music button functionality for 2-3 students
- [ ] Check "Sync MMS" button shows "Live Data" status
- [ ] Verify instruments display correctly (not all defaulting to "Guitar")

**If Any Verification Fails:**
- Check Railway build logs for errors
- Test locally first to isolate issue
- Review recent git commits for potential issues

## 🔧 Troubleshooting Guide

### Student Loading Issues

| Issue | Likely Cause | Solution |
|-------|-------------|----------|
| No students appear for tutor | Wrong/missing teacher ID | Check mms-client.js teacher ID mapping |
| Students show but no instruments | Missing instrument overrides | Add to config.js instrumentOverrides |
| "Service: None" in Railway status | Railway not linked | Run `railway link` |
| Theta Music buttons don't work | Missing credentials | Check config.js thetaCredentials |
| Build fails during deployment | Syntax error in code | Check build logs, fix syntax |

### Common Error Messages

**"No teacher ID configured for [Tutor]"**
- Add tutor to `/lib/mms-client.js` teacherIds mapping
- Use placeholder initially: `'Tutor': 'tch_placeholder_tutorname'`

**"Internal Server Error"**  
- Restart development server: Kill current process, run `npm run dev`
- Check for syntax errors in config files

**Students load but instruments all show "Guitar"**
- Add instrument overrides in `/lib/config/instruments.js` instrumentOverrides section

### MMS Teacher ID Management

**Finding Real MMS Teacher IDs:**
- Pattern: `tch_` + 6-7 alphanumeric characters (e.g., `tch_z2j2Jf`)
- Always verify ID is unique across all tutors
- Test locally before deploying

**Updating from Placeholder to Real:**
1. Update both capitalized and lowercase entries in `/lib/mms-client.js`
2. Test locally - students should load from live MMS API
3. Deploy following standard protocol

## 📝 Maintenance Notes

### Regular Tasks
- Monitor Railway deployment logs for errors  
- Update student credentials in `/lib/config/theta-credentials.js` as needed
- Update instrument overrides in `/lib/config/instruments.js` as needed
- Test Theta Music integration periodically
- Verify MMS API connectivity monthly
- Update student counts in protocols after major additions

### Emergency Protocols
- If site is down: Check Railway dashboard and build logs
- If students can't access Theta: Verify credentials in `/lib/config/theta-credentials.js`
- If API errors: Check MMS API status and authentication tokens in `/lib/config/services.js`
- If mass student data corruption: Check git history for restore points

### Backup/Recovery
- All configuration is stored in git repository
- Railway auto-deploys from git pushes  
- To rollback: `git revert [commit-hash]` then `railway up`
- Critical files to backup: `/lib/config/` directory, `/lib/soundslice-mappings.js`, `/lib/mms-client.js`

## 🔗 Important URLs

- **Live Dashboard**: https://efficient-sparkle-production.up.railway.app
- **Railway Project**: efficient-sparkle
- **GitHub Repository**: first-chord-dashbord (working-local-sqlite branch)

---

## 📁 Project Structure Overview

The project follows a modular, scalable architecture:

```
music-school-dashboard/
├── app/                     # Next.js app router pages & API routes
│   ├── api/                 # API endpoints (students, notes, sync, etc.)
│   └── dashboard/           # Dashboard pages
├── components/              # React components organized by category
│   ├── auth/                # Authentication & login status
│   ├── layout/              # Main container components  
│   ├── navigation/          # External links & quick actions
│   ├── setup/               # Configuration wizards
│   └── student/             # Student data display components
├── lib/                     # Core utilities & configurations
│   ├── config/              # Modular configuration files
│   │   ├── services.js      # External service configs & auth
│   │   ├── theta-credentials.js # Student Theta Music credentials
│   │   ├── instruments.js   # Student instrument overrides
│   │   └── url-generators.js # URL generation logic
│   ├── config.js            # Main config entry point
│   ├── mms-client.js        # MyMusicStaff API client
│   └── soundslice-mappings.js # Soundslice course URLs
└── data/                    # Static data files
```

**Key Principles:**
- **Modular Configuration**: Config split by concern for easier maintenance
- **Component Categories**: Organized by functional purpose for scalability
- **Clear Separation**: Data, logic, and presentation layers are distinct
- **Backward Compatibility**: Main config.js maintains existing imports

---

**Last Updated**: September 13, 2025  
**Maintainer**: FirstChord Music School  
**Version**: 3.0 (Post-Refactoring)
