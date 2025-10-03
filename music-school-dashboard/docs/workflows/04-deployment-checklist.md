# Workflow: Deployment Checklist

**Purpose**: Ensure safe, successful deployments to production

**Last Updated**: October 3, 2025

---

## Pre-Deployment Checklist

Complete **ALL** items before pushing to production:

### 1. Code Quality

- [ ] **No commented-out code** (clean up debug code)
- [ ] **No console.logs** for debugging (or mark as intentional)
- [ ] **No TODO comments** without tracking
- [ ] **Consistent formatting** across files

### 2. Configuration Files

- [ ] **All 5 student config files updated** (if adding students)
  - [ ] `lib/student-url-mappings.js`
  - [ ] `lib/student-helpers.js`
  - [ ] `lib/soundslice-mappings.js`
  - [ ] `lib/config/theta-credentials.js`
  - [ ] `lib/config/instruments.js`

- [ ] **No duplicate entries** in configs
  - [ ] No duplicate friendly URLs
  - [ ] No duplicate student IDs
  - [ ] No duplicate MMS IDs

- [ ] **Consistent naming** across all files
  - [ ] Student IDs match exactly
  - [ ] Tutor names consistent
  - [ ] Comments accurate

### 3. Syntax Validation

```bash
# Check for syntax errors in config files
node -c lib/student-url-mappings.js
node -c lib/student-helpers.js
node -c lib/soundslice-mappings.js
node -c lib/config/theta-credentials.js
node -c lib/config/instruments.js
```

- [ ] **All syntax checks pass**

### 4. Local Build Test

```bash
npm run build
```

- [ ] **Build completes successfully**
- [ ] **No warnings** (or warnings documented)
- [ ] **No errors**
- [ ] **Build time reasonable** (<60 seconds)

### 5. Local Testing

```bash
npm run dev
```

**Test Dashboard:**
- [ ] Visit `http://localhost:3000/dashboard`
- [ ] All tutors appear in dropdown
- [ ] Select each affected tutor
- [ ] Students load correctly
- [ ] Student cards show complete info
- [ ] Soundslice links work
- [ ] No console errors (F12 → Console)

**Test Student Portals (for new/updated students):**
- [ ] Visit `http://localhost:3000/[student-name]`
- [ ] Portal loads without errors
- [ ] Student name displays correctly
- [ ] Instrument shows correctly
- [ ] Lesson notes appear
- [ ] Soundslice button works
- [ ] Theta credentials display
- [ ] No console errors

**Test Edge Cases:**
- [ ] Try non-existent student URL (should 404)
- [ ] Test "All Teachers" view
- [ ] Test mobile responsive view (resize browser)
- [ ] Test with network throttling (slow connection)

### 6. Git Status Check

```bash
git status
```

- [ ] **Only intended files modified**
- [ ] **No untracked files** that should be committed
- [ ] **No .env files** staged (should be in .gitignore)
- [ ] **No credentials** in code

### 7. Documentation

- [ ] **Commit message prepared** (descriptive, follows convention)
- [ ] **CLAUDE.md updated** (if major changes)
- [ ] **Protocol files updated** (if process changed)
- [ ] **Workflow docs updated** (if new pattern established)

---

## Deployment Process

### Step 1: Final Review

```bash
# Review all changes
git diff

# Review staged changes
git diff --cached
```

**Verify:**
- [ ] Changes are intentional
- [ ] No debug code included
- [ ] No sensitive data

### Step 2: Stage Changes

```bash
# Stage all changes (recommended for this project)
git add .

# Or stage specific files
git add lib/student-url-mappings.js
git add lib/student-helpers.js
# ... etc
```

**Note**: This project uses `git add .` to avoid macOS permission warnings.

### Step 3: Commit

```bash
git commit -m "$(cat <<'EOF'
[type]: [brief description]

[Detailed description of changes]
- Bullet point 1
- Bullet point 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Commit Types:**
- `feat:` - New feature (new student, new tutor)
- `fix:` - Bug fix
- `docs:` - Documentation only
- `refactor:` - Code restructure (no functionality change)
- `chore:` - Maintenance (dependency updates, etc.)

**Examples:**

```bash
# Adding student
git commit -m "feat: add Ritisha Paryani to Jungyoun's students"

# Adding tutor
git commit -m "feat: add Kenny to dashboard with 6 students"

# Bug fix
git commit -m "fix: resolve notes edge case for future lessons"

# Documentation
git commit -m "docs: add workflow documentation for common tasks"
```

### Step 4: Push to Deploy

```bash
git push origin main
```

**Railway Auto-Deploy:**
- Push to `main` branch triggers automatic deployment
- No manual intervention needed
- Deployment takes 2-3 minutes

### Step 5: Monitor Deployment

**Option A: Railway Dashboard (Recommended)**
1. Visit: https://railway.app
2. Log in and select project: "efficient-sparkle"
3. Watch deployment progress
4. Check for errors in logs

**Option B: Test Live Site**
1. Wait 2-3 minutes
2. Visit: https://efficient-sparkle-production.up.railway.app
3. Test changes (see Post-Deployment Verification below)

---

## Post-Deployment Verification

### Immediate Checks (0-3 minutes)

**1. Site Loads:**
- [ ] Visit: https://efficient-sparkle-production.up.railway.app
- [ ] Homepage loads without error
- [ ] No blank screens
- [ ] No 500 errors

**2. Dashboard Works:**
- [ ] Visit: https://efficient-sparkle-production.up.railway.app/dashboard
- [ ] Tutor dropdown appears
- [ ] Can select tutors
- [ ] Students load

**3. New/Updated Features Work:**
- [ ] New student portal loads
- [ ] New tutor appears in dropdown
- [ ] Changes visible as expected

### Detailed Checks (3-10 minutes)

**Test Each New Student Portal:**
```
https://efficient-sparkle-production.up.railway.app/[student-name]
```

- [ ] Portal loads
- [ ] All sections render
- [ ] Data is correct
- [ ] Links work
- [ ] No errors in console

**Test Dashboard Functionality:**
- [ ] Select each affected tutor
- [ ] Verify student lists
- [ ] Check student cards
- [ ] Test Soundslice links
- [ ] Verify instruments display

**Cross-Browser Test (if major changes):**
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile browser

**Performance Check:**
- [ ] Dashboard loads in <5 seconds
- [ ] Student portals load in <3 seconds
- [ ] No significant slowdown from changes

### Cache Clear (if needed)

If changes don't appear:
```
Hard Refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
Incognito/Private window
Clear browser cache
```

---

## Deployment Issues

### Build Fails on Railway

**Check Railway Logs:**
1. Railway dashboard → Select project
2. View deployment logs
3. Find error message

**Common Causes:**
- Syntax error in code
- Missing dependency
- Environment variable missing
- Build timeout

**Fix:**
- Fix error locally
- Test build: `npm run build`
- Commit fix
- Push again

### Deployment Succeeds But Site Broken

**Check Browser Console:**
- F12 → Console tab
- Look for JavaScript errors

**Check Network Tab:**
- F12 → Network tab
- Look for failed API requests
- Check 404s or 500s

**Quick Rollback:**
```bash
git revert HEAD
git push
```

### Partial Functionality

**Symptoms**: Some features work, others don't

**Check:**
- Specific student portals vs dashboard
- Specific tutors vs all tutors
- Browser console for errors

**Debug:**
```bash
# Test specific APIs
curl https://efficient-sparkle-production.up.railway.app/api/notes/sdt_XXXXXX

curl "https://efficient-sparkle-production.up.railway.app/api/students?tutor=TutorName"
```

---

## Rollback Procedures

### Option 1: Revert Last Commit

```bash
# Undo last commit, create new commit
git revert HEAD

# Push to deploy previous version
git push
```

**Effect**: Site reverts to previous working state in 2-3 minutes

### Option 2: Revert to Specific Commit

```bash
# Find commit to revert to
git log --oneline -10

# Revert to specific commit
git revert [commit-hash]

# Push
git push
```

### Option 3: Hard Reset (Use with Caution)

```bash
# Reset to previous commit (loses changes)
git reset --hard HEAD~1

# Force push (overwrites remote)
git push --force

# ⚠️ Only use if you're sure and no one else is working on the branch
```

### Emergency Rollback

If something is severely broken:

1. **Identify last working commit:**
   ```bash
   git log --oneline -10
   ```

2. **Revert to it:**
   ```bash
   git revert [commit-hash]
   ```

3. **Push immediately:**
   ```bash
   git push
   ```

4. **Notify team** (if applicable)

5. **Debug locally** before redeploying

---

## Best Practices

### Before Every Deployment

1. **Test locally first** - Always run `npm run dev` and test
2. **Run build test** - Always run `npm run build`
3. **Review changes** - Check `git diff` before committing
4. **Small commits** - Deploy small, incremental changes
5. **Descriptive messages** - Write clear commit messages

### During Deployment

1. **Monitor Railway** - Watch deployment logs
2. **Don't push multiple times** - Wait for each deployment to complete
3. **One change at a time** - Don't deploy unrelated changes together
4. **Document in commit** - Explain what and why in commit message

### After Deployment

1. **Verify immediately** - Check live site within 5 minutes
2. **Test thoroughly** - Don't assume it works
3. **Monitor for issues** - Check for errors over next hour
4. **Update documentation** - Update CLAUDE.md if needed

---

## Deployment Timing

**Best Times to Deploy:**
- **Outside school hours** - Early morning or evening
- **Not before weekend** - Deploy Mon-Thu if possible
- **When you can monitor** - Don't deploy and leave

**Avoid Deploying:**
- During active lessons
- Right before you leave for the day
- Friday afternoon (if issues arise, harder to fix)
- When tired (more mistakes)

---

## Deployment Frequency

**Current Practice:**
- Deploy after adding each student: ✅ OK
- Deploy after adding tutor + students: ✅ OK
- Deploy bug fixes immediately: ✅ OK
- Deploy documentation: ✅ OK

**Not Recommended:**
- Multiple deployments per hour
- Deploying untested code
- Deploying breaking changes without warning

---

## Checklist Templates

### Quick Student Addition Checklist

```
Pre-Deploy:
[ ] Updated 5 config files
[ ] Checked for duplicates
[ ] npm run build passes
[ ] Tested locally at localhost:3000/[name]
[ ] Reviewed git diff

Deploy:
[ ] git add .
[ ] git commit -m "feat: add [Name]"
[ ] git push

Post-Deploy:
[ ] Wait 3 minutes
[ ] Test live portal
[ ] Test dashboard
[ ] No errors in console
```

### Quick Tutor Addition Checklist

```
Pre-Deploy:
[ ] Added to dashboard dropdown
[ ] Added teacher ID mapping
[ ] Configured all student portals
[ ] npm run build passes
[ ] Tested dashboard locally
[ ] Tested student portals locally
[ ] Reviewed git diff

Deploy:
[ ] git add .
[ ] git commit -m "feat: add [Tutor] with [X] students"
[ ] git push

Post-Deploy:
[ ] Wait 3 minutes
[ ] Test live dashboard
[ ] Test each student portal
[ ] Verify tutor dropdown
[ ] No errors
```

---

## Environment Variables

**Required in Railway:**
- `MMS_API_KEY` - MyMusicStaff API key
- `NEXTAUTH_URL` - Production URL
- `NODE_ENV` - Set to "production"

**To Update:**
1. Railway dashboard → Project settings
2. Variables tab
3. Add/update as needed
4. Redeploy if changed

---

## Monitoring and Logs

**Railway Logs:**
- Real-time deployment logs
- Application logs
- Error tracking

**Browser Console:**
- Client-side errors
- API failures
- Network issues

**API Testing:**
```bash
# Test production APIs
curl https://efficient-sparkle-production.up.railway.app/api/students?tutor=Finn

curl https://efficient-sparkle-production.up.railway.app/api/notes/sdt_XXXXXX
```

---

## Related Workflows

- See: `01-adding-students.md` - Student setup process
- See: `02-adding-tutors.md` - Tutor setup process
- See: `03-troubleshooting-common-issues.md` - Fix deployment issues
- See: `05-testing-guide.md` - Comprehensive testing
- See: `DEPLOYMENT_PROTOCOLS.md` - Detailed deployment guide
