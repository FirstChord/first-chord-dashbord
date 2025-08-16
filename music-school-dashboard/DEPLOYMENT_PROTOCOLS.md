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
railway domain                 # Get live URL
railway logs                   # View deployment logs
railway open                   # Open Railway dashboard
```

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

# 4. Commit changes
git add .
git commit -m "Descriptive commit message"

# 5. Push to repository
git push

# 6. Deploy (follow Railway protocol above)
```

## 🎯 Student Management Protocols

### Adding New Students to Theta Music

When adding students for a new tutor:

1. **Get student information:**
   - Surname, First Name
   - Theta Music username/password
   - MMS ID (from MyMusicStaff)

2. **Update configuration:**
   ```javascript
   // In /lib/config.js, add to thetaCredentials object:
   'sdt_MMSID': 'thetausername',    // Student Name
   ```

3. **Test and deploy:**
   - Test locally with `npm run dev`
   - Follow deployment protocol above

### Student Data Format
```
Surname	First Name	Theta Username	MMS ID
Example	Student	    studentfc	    sdt_ABC123
```

## 🏗️ Project Structure

### Key Files
- `/lib/config.js` - Service configurations and student mappings
- `/components/QuickLinks.js` - Theta Music modal and credentials
- `/app/api/students/route.js` - Student data API
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

**Last Updated**: August 16, 2025  
**Maintainer**: FirstChord Music School  
**Version**: 1.0
