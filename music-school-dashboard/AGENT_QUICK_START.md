# 🤖 Agent Quick Start Guide

**For AI Agents Working on Music School Dashboard**

Last Updated: October 3, 2025

---

## ⚡ Quick Context

**Project**: FirstChord Music School Dashboard (Next.js)
**Live Site**: https://efficient-sparkle-production.up.railway.app
**Deployment**: Railway auto-deploys from `git push` to main branch

**Purpose**:
- Main tutor dashboard - teachers view all their students
- Individual student portals - students access notes, Soundslice, Theta Music

---

## 📁 Essential Files (Read First)

### 1. **CLAUDE.md** (START HERE)
Complete project context, architecture decisions, recent changes

### 2. **Student Configuration** (5 files to update when adding students)
```
lib/student-url-mappings.js     → Friendly URLs (/ritisha → sdt_635GJ0)
lib/student-helpers.js          → Security whitelist (VALID_STUDENT_IDS)
lib/soundslice-mappings.js      → Soundslice course URLs
lib/config/theta-credentials.js → Theta Music login credentials
lib/config/instruments.js       → Instrument overrides (Piano, Guitar, etc.)
```

### 3. **Dashboard Configuration**
```
app/dashboard/page-client.js    → Tutor dropdown list
lib/mms-client.js              → Teacher ID mappings (tch_XXXXXX)
```

### 4. **Protocol Documentation**
```
DEPLOYMENT_PROTOCOLS.md           → Complete deployment guide
docs/ADDING_NEW_STUDENTS.md      → Step-by-step student setup
NOTES_EDGE_CASE_PROTOCOL.md      → Troubleshooting notes issues
STUDENT_PORTAL_PROTOCOL.md       → Student portal configuration
```

### 5. **Workflow Documentation**
```
docs/workflows/01-adding-students.md              → Add student workflow
docs/workflows/02-adding-tutors.md                → Add tutor workflow
docs/workflows/03-troubleshooting-common-issues.md → Common problems & fixes
docs/workflows/04-deployment-checklist.md         → Pre-deploy checklist
docs/workflows/05-testing-guide.md                → Testing procedures
```

---

## 🎯 Common Tasks

### Task 1: Add New Student

**Files to Update:** 5 config files

**Process:**
1. Get: Student name, MMS ID (sdt_XXXXXX), tutor, instrument, Soundslice URL
2. Check for URL conflicts: `grep -i "'firstname'" lib/student-url-mappings.js`
3. Update all 5 config files (see `docs/workflows/01-adding-students.md`)
4. Test locally: `npm run dev` → Visit `/localhost:3000/[name]`
5. Build test: `npm run build`
6. Deploy: `git add . && git commit && git push`

**Reference**: `docs/workflows/01-adding-students.md`

### Task 2: Add New Tutor

**Files to Update:** 2 for tutor + 5 per student

**Process:**
1. Get: Tutor name, Teacher ID (tch_XXXXXX), list of students
2. Add to dashboard dropdown: `app/dashboard/page-client.js`
3. Add teacher ID mapping: `lib/mms-client.js`
4. Add each student (follow Task 1 for each)
5. Test locally
6. Deploy

**Reference**: `docs/workflows/02-adding-tutors.md`

### Task 3: Fix Student Portal 404

**Common Causes:**
- Not in student-url-mappings.js
- Not in security whitelist (student-helpers.js)

**Quick Fix:**
```javascript
// lib/student-url-mappings.js
'studentname': 'sdt_XXXXXX',

// lib/student-helpers.js - add to VALID_STUDENT_IDS array
'sdt_XXXXXX',
```

**Reference**: `docs/workflows/03-troubleshooting-common-issues.md`

### Task 4: Fix Notes Not Loading

**See**: `NOTES_EDGE_CASE_PROTOCOL.md` for comprehensive guide

**Quick Checks:**
1. Student has lessons in MyMusicStaff?
2. MMS Student ID correct format (sdt_XXXXXX)?
3. Future lesson blocking recent notes?

### Task 5: Deploy Changes

**Process:**
```bash
npm run build          # Always test build first
git add .
git commit -m "feat: descriptive message"
git push               # Auto-deploys to Railway
```

**Wait 2-3 minutes, then verify:**
- https://efficient-sparkle-production.up.railway.app

**Reference**: `docs/workflows/04-deployment-checklist.md`

---

## 🚨 Critical Rules

### ALWAYS

✅ **Test locally first** - `npm run dev` before deploying
✅ **Run build test** - `npm run build` before committing
✅ **Check for duplicates** - No duplicate URLs or student IDs
✅ **Update ALL 5 files** - When adding students
✅ **Review git diff** - Before committing
✅ **Use `git add .`** - Avoids macOS permission warnings
✅ **Follow naming conventions** - Lowercase friendly URLs, consistent formats

### NEVER

❌ **Deploy without testing** - Always test locally
❌ **Skip build test** - Could break production
❌ **Modify only some config files** - Update all 5 or portal won't work
❌ **Use `git add -A`** - Use `git add .` instead (project convention)
❌ **Commit .env files** - Keep credentials out of git
❌ **Force push** - Unless emergency and you know what you're doing
❌ **Deploy breaking changes** - Without testing thoroughly

---

## 🗂️ File Structure Overview

```
music-school-dashboard/
├── app/
│   ├── dashboard/
│   │   └── page-client.js          ← Tutor dropdown (15 tutors, 4×4 grid)
│   ├── [studentName]/              ← Student portal routes
│   └── api/
│       ├── notes/                  ← Notes API endpoint
│       └── students/               ← Students API endpoint
├── lib/
│   ├── student-url-mappings.js     ← Friendly URL mappings
│   ├── student-helpers.js          ← Security whitelist
│   ├── soundslice-mappings.js      ← Soundslice course URLs
│   ├── mms-client.js               ← Teacher ID mappings
│   └── config/
│       ├── theta-credentials.js    ← Theta Music logins
│       └── instruments.js          ← Instrument overrides
├── docs/
│   ├── workflows/                  ← Step-by-step guides
│   └── ADDING_NEW_STUDENTS.md      ← Student setup guide
├── CLAUDE.md                       ← Project context (READ FIRST)
├── DEPLOYMENT_PROTOCOLS.md         ← Deployment guide
└── NOTES_EDGE_CASE_PROTOCOL.md    ← Notes troubleshooting
```

---

## 💡 Quick Reference

### Student ID Format
```
MMS Student ID: sdt_XXXXXX  (e.g., sdt_635GJ0)
Teacher ID:     tch_XXXXXX  (e.g., tch_zsyfJr)
```

### Friendly URL Patterns
```
Simple:          'ritisha'     (single name, no conflicts)
With conflict:   'olivia-w'    (Olivia Wong, to avoid conflict with Olivia Mcintosh)
Pattern:         firstname or firstname-lastinitial
```

### Theta Credentials Format
```
Username: [firstname]fc
Password: [firstname]fc
Example:  ritishafc / ritishafc
```

### Common Instruments
```
Piano, Guitar, Voice, Bass, Piano / Guitar, Piano / Voice
```

---

## 🔧 Testing Commands

### Local Development
```bash
npm run dev                          # Start dev server (localhost:3000)
npm run build                        # Test production build
```

### API Testing
```bash
# Test student notes
curl http://localhost:3000/api/notes/sdt_XXXXXX

# Test tutor's students
curl "http://localhost:3000/api/students?tutor=Finn"
```

### Data Validation
```bash
# Count students in each config file (should match)
grep -c "sdt_" lib/student-url-mappings.js
grep -c "sdt_" lib/student-helpers.js

# Find duplicate student IDs
grep -oP "sdt_\w+" lib/student-url-mappings.js | sort | uniq -d

# Check for URL conflicts
grep -i "'studentname'" lib/student-url-mappings.js
```

### Git Operations
```bash
git status                           # Check current state
git diff                            # See changes
git add .                           # Stage all changes (project convention)
git commit -m "feat: message"       # Commit with conventional format
git push                            # Deploy to Railway
```

---

## 🎓 Project Knowledge

### Current Scale
- **177+ students** with individual portals
- **15 tutors** (4×4 grid layout)
- **Production-ready** system serving real students

### Technology Stack
- **Frontend**: Next.js 15 (React, Tailwind CSS)
- **Backend**: Next.js API routes
- **External APIs**: MyMusicStaff (MMS)
- **Deployment**: Railway (auto-deploy from git)
- **No Database**: Hardcoded mappings for performance

### Key Integrations
- **MyMusicStaff API**: Student data, notes, teacher info
- **Soundslice**: Music course platform links
- **Theta Music**: Practice game credentials

### URL Structure
```
/                           → Homepage
/dashboard                  → Main tutor dashboard
/[studentname]              → Student portal (e.g., /ritisha, /craig)
/api/students?tutor=X       → API: Get students for tutor
/api/notes/sdt_XXXXXX       → API: Get student notes
```

---

## 🐛 Common Issues → Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Student portal 404 | Add to student-url-mappings.js + student-helpers.js |
| Notes not loading | Check NOTES_EDGE_CASE_PROTOCOL.md |
| Tutor shows no students | Verify teacher ID in mms-client.js |
| Wrong instrument | Add override in instruments.js |
| Soundslice missing | Add URL in soundslice-mappings.js |
| Theta missing | Add credentials in theta-credentials.js |
| Build fails | Check for syntax errors (missing commas, brackets) |
| Changes don't deploy | Wait 3 mins, clear cache, check Railway logs |

---

## 📊 Dashboard vs Portal

### Main Dashboard (Tutor View)
- **URL**: `/dashboard`
- **Data**: Fetched live from MMS API
- **No config needed**: Students auto-appear when in MMS
- **Purpose**: Teachers manage all students

### Student Portals (Student View)
- **URL**: `/[studentname]`
- **Data**: Fetched from MMS + local config
- **Config required**: Must add to 5 config files
- **Purpose**: Students access their own notes/courses

**Key Insight**: Adding a student to MMS makes them appear on dashboard. Adding portal config creates their individual portal page.

---

## 🚀 Deployment Flow

```
1. Make changes locally
2. Test: npm run dev
3. Test: npm run build
4. Commit: git add . && git commit -m "message"
5. Deploy: git push
6. Railway auto-builds and deploys (2-3 minutes)
7. Verify: https://efficient-sparkle-production.up.railway.app
```

**No manual Railway commands needed** - git push triggers everything.

---

## 📝 Commit Message Format

```bash
[type]: [brief description]

[Detailed changes]
- Bullet point 1
- Bullet point 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**
- `feat:` - New feature (student, tutor)
- `fix:` - Bug fix
- `docs:` - Documentation only
- `refactor:` - Code restructure
- `chore:` - Maintenance

---

## 🔗 Important URLs

- **Live Site**: https://efficient-sparkle-production.up.railway.app
- **Dashboard**: https://efficient-sparkle-production.up.railway.app/dashboard
- **Example Portal**: https://efficient-sparkle-production.up.railway.app/ritisha
- **Railway Dashboard**: https://railway.app (for deployment monitoring)
- **GitHub Repo**: first-chord-dashbord (main branch)

---

## 📞 Context Recovery

If you lose context mid-task:

```bash
# Check recent activity
git log --oneline -10
git status
git diff

# See project overview
cat CLAUDE.md | head -100

# Check workflow docs
ls docs/workflows/

# Verify current state
npm run build
grep -c "sdt_" lib/student-url-mappings.js
```

---

## 🎯 Success Criteria

Before marking a task complete:

- [ ] Local testing passed
- [ ] Build test passed (`npm run build`)
- [ ] All config files updated (if adding student)
- [ ] Changes committed with clear message
- [ ] Deployed to production
- [ ] Live site verified
- [ ] No console errors
- [ ] User experience tested

---

## 🆘 When Stuck

1. **Check workflow docs** - `docs/workflows/`
2. **Check protocol files** - `*PROTOCOL*.md`
3. **Check CLAUDE.md** - Project context
4. **Search codebase** - `grep -r "search-term" lib/`
5. **Check git history** - `git log --grep="keyword"`
6. **Test in isolation** - Create minimal test case
7. **Ask user** - Request clarification if unclear

---

## 💭 Development Philosophy

- **Documentation-driven** - Every process has a guide
- **Manual testing required** - Always verify before deploy
- **Small, incremental changes** - Deploy often, deploy small
- **User experience first** - Real students use this
- **Performance over complexity** - Hardcoded > database for speed
- **Explicit over implicit** - Security whitelist, clear mappings

---

## ✨ Best Practices

1. **Always read CLAUDE.md first** - Essential context
2. **Follow existing patterns** - Don't reinvent what works
3. **Test locally every time** - Never deploy blind
4. **Keep commits focused** - One logical change per commit
5. **Document as you go** - Update protocols if process changes
6. **Think like a user** - Test edge cases
7. **Monitor after deploy** - Verify production works

---

## 📚 Further Reading

**Start here:**
- `CLAUDE.md` - Complete project overview

**For specific tasks:**
- `docs/workflows/01-adding-students.md`
- `docs/workflows/02-adding-tutors.md`

**For debugging:**
- `docs/workflows/03-troubleshooting-common-issues.md`
- `NOTES_EDGE_CASE_PROTOCOL.md`

**For deployment:**
- `docs/workflows/04-deployment-checklist.md`
- `DEPLOYMENT_PROTOCOLS.md`

---

**Remember**: This is a **production system** serving real music students. Always test thoroughly before deploying!
