# 🚀 Music School Dashboard - Deployment Protocols

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

After making significant changes to configuration files (especially `/lib/config.js` or `/lib/mms-client.js`), restart the development server:

```bash
# Kill current server (Ctrl+C or kill command)
# Then restart:
npm run dev
```

**When to restart the server:**
- After adding new tutor credentials in `config.js`
- After modifying instrument overrides
- When experiencing internal server errors
- After significant configuration changes

### Git Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission warnings on macOS | Use `git add .` instead of `git add -A` |
| "could not open directory" warnings | These are harmless macOS permission messages, ignore them |
| Commit fails | Check `git status` first, then use `git add .` |

## 🎯 Student Management Protocols

### Adding New Tutors with Theta Music Integration

When adding students for a new tutor with Theta Music accounts:

**Step 1: Gather Required Information**
- Student surname and first name
- Student MMS ID (format: `sdt_XXXXX`)
- Theta Music username (typically `[firstname]fc`)
- Student instrument (Piano, Guitar, Voice, etc.)
- Soundslice course URLs (if applicable)

**Step 2: Update Configuration Files**

1. **Add Theta Music Credentials** in `/lib/config.js`:
   ```javascript
   // [TutorName]'s students with Theta Music credentials
   'sdt_ABC123': 'studentfc',    // Student Name
   'sdt_DEF456': 'anotherstudentfc',    // Another Student
   ```

2. **Add Instrument Overrides** in `/lib/config.js`:
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

### Adding New Students to Theta Music

When adding students for an existing tutor:

1. **Get student information:**
   - Surname, First Name
   - Theta Music username/password
   - MMS ID (from MyMusicStaff)
   - Instrument (if different from tutor default)
   - Soundslice course URL (if applicable)

2. **Update configuration files in order:**

   **a) Add Theta Music Credentials** in `/lib/config.js`:
   ```javascript
   // Find the tutor's section in thetaCredentials object:
   'sdt_MMSID': 'thetausername',    // Student Name
   ```

   **b) Add Instrument Override** in `/lib/config.js`:
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

**Total: 91 students across 5 tutors**

**Remaining Tutors (Placeholders Ready):**
- Eve, Arion, Eléna, Kim, Robbie, Stef, Tom

### Student Data Format

```text
Surname    First Name    Theta Username    MMS ID        Instrument
Example    Student       studentfc         sdt_ABC123    Piano
```

## 🏗️ Project Structure

### Key Files
- `/lib/config.js` - Theta Music credentials & instrument overrides
- `/lib/soundslice-mappings.js` - Soundslice course URL mappings
- `/lib/mms-client.js` - MyMusicStaff API client with teacher IDs
- `/components/QuickLinks.js` - Theta Music modal and credentials display
- `/components/StudentCard.js` - Student cards with instrument display
- `/app/api/students/route.js` - Student data API endpoint
- `/app/dashboard/page.js` - Main dashboard page

### External Services
- **MyMusicStaff API** - Student data source
- **Soundslice** - Sheet music platform
- **Theta Music** - Educational games platform
- **Railway** - Hosting platform

## 📝 Maintenance Notes

### Regular Tasks
- Monitor Railway deployment logs for errors
- Update student credentials as needed
- Test Theta Music integration periodically

### Emergency Protocols
- If site is down: Check Railway dashboard
- If students can't access Theta: Verify credentials in config.js
- If API errors: Check MMS API status and keys

## 🔗 Important URLs

- **Live Dashboard**: https://efficient-sparkle-production.up.railway.app
- **Railway Project**: efficient-sparkle
- **GitHub Repository**: first-chord-dashbord (working-local-sqlite branch)

---

**Last Updated**: August 30, 2025  
**Maintainer**: FirstChord Music School  
**Version**: 2.0
