# Workflow: Testing Guide

**Purpose**: Comprehensive testing procedures for all changes

**Last Updated**: October 3, 2025

---

## Testing Philosophy

**Test Locally First** - Always test before deploying
**Test All Affected Areas** - Don't assume anything works
**Test Like a User** - Click everything, try edge cases
**Document Issues** - Track what you find

---

## Quick Test Checklist

For rapid testing after small changes:

```
[ ] npm run build passes
[ ] npm run dev works
[ ] Changed feature works locally
[ ] No console errors
[ ] Deploy
```

---

## Comprehensive Testing

### Phase 1: Build and Startup Tests

#### Build Test
```bash
npm run build
```

**Verify:**
- [ ] Build completes successfully
- [ ] No errors
- [ ] No critical warnings
- [ ] Build time reasonable (<60 seconds)
- [ ] All routes compiled

**Expected Output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

#### Development Server Test
```bash
npm run dev
```

**Verify:**
- [ ] Server starts without errors
- [ ] Running on http://localhost:3000
- [ ] Turbopack ready
- [ ] No startup errors

**Expected Output:**
```
✓ Ready in [time]ms
```

---

### Phase 2: Dashboard Testing

#### Test URL
```
http://localhost:3000/dashboard
```

#### Basic Functionality

**Page Load:**
- [ ] Page loads within 3 seconds
- [ ] No blank screens
- [ ] No JavaScript errors (F12 → Console)
- [ ] Header displays correctly
- [ ] Tutor dropdown appears

**Tutor Dropdown:**
- [ ] All tutors appear in list
- [ ] "All Teachers" option present
- [ ] Alphabetical or logical order
- [ ] No duplicate entries
- [ ] Can click each tutor

**Student Loading:**

Select each tutor and verify:
- [ ] Students load within 3 seconds
- [ ] Student count accurate
- [ ] Student cards display completely
- [ ] No missing data

**Student Cards:**

For each student card, check:
- [ ] Student name displays
- [ ] Instrument shows correctly
- [ ] Soundslice link present (if configured)
- [ ] "View Notes" button works
- [ ] No placeholder data (e.g., "Unknown")

**"All Teachers" View:**
- [ ] Select "All Teachers"
- [ ] All students from all tutors appear
- [ ] No duplicates
- [ ] Reasonable load time (<10 seconds)
- [ ] Can filter/search (if implemented)

#### Interaction Testing

**Notes Modal/View:**
- [ ] Click "View Notes" on any student
- [ ] Notes display correctly
- [ ] Most recent lesson shown
- [ ] Tutor name appears
- [ ] Lesson date formatted correctly
- [ ] Can close modal

**Soundslice Links:**
- [ ] Click Soundslice link
- [ ] Opens in new tab
- [ ] Correct course loads
- [ ] URL format valid

**Search/Filter (if implemented):**
- [ ] Search finds students
- [ ] Filter by instrument works
- [ ] Clear filters works

#### Responsive Design

**Desktop (>1024px):**
- [ ] Grid layout 4 columns
- [ ] Cards properly sized
- [ ] No overflow issues
- [ ] Dropdown fully visible

**Tablet (768px-1023px):**
- [ ] Grid adjusts to 3 columns
- [ ] Cards readable
- [ ] No horizontal scroll
- [ ] Touch targets adequate

**Mobile (<768px):**
- [ ] Grid adjusts to 2 columns
- [ ] Cards stack properly
- [ ] Text readable without zoom
- [ ] Buttons easily clickable
- [ ] Dropdown works on mobile

**Test by resizing browser** or using DevTools device emulation.

---

### Phase 3: Student Portal Testing

#### Test Each New/Modified Student

For student named "ritisha":
```
http://localhost:3000/ritisha
```

#### Page Load

- [ ] Portal loads within 2 seconds
- [ ] No 404 error
- [ ] No blank page
- [ ] No JavaScript errors

#### Header Section

- [ ] Student name displays correctly
- [ ] Name capitalized properly
- [ ] Instrument shows correctly
- [ ] No "undefined" or placeholder text

#### Lesson Notes Section

**Recent Notes Card:**
- [ ] "Recent Lesson Notes" heading appears
- [ ] Most recent lesson date shows
- [ ] Tutor name displays
- [ ] Notes content appears
- [ ] Formatted properly (line breaks, etc.)
- [ ] Attendance status shows (if available)

**Edge Cases:**
- [ ] No notes → Shows appropriate message
- [ ] Very long notes → Scrolls or truncates properly
- [ ] Special characters render correctly

#### Soundslice Section

**If Configured:**
- [ ] "Soundslice Course" button appears
- [ ] Button styled correctly
- [ ] Click opens new tab
- [ ] Correct course loads
- [ ] URL format: `https://www.soundslice.com/courses/[ID]/`

**If Not Configured:**
- [ ] Section hidden or shows "Not available"
- [ ] No broken links
- [ ] No console errors

#### Theta Music Section

**If Configured:**
- [ ] "Theta Music" section appears
- [ ] Username displays: `[firstname]fc`
- [ ] Password displays: `[firstname]fc`
- [ ] Theta Music logo appears (if implemented)
- [ ] Link to Theta Music site works

**If Not Configured:**
- [ ] Section hidden or shows "Not available"
- [ ] No broken elements

#### Responsive Design

**Desktop:**
- [ ] All sections visible
- [ ] Proper spacing
- [ ] Cards properly sized

**Tablet:**
- [ ] Layout adjusts appropriately
- [ ] All content readable
- [ ] No overflow

**Mobile:**
- [ ] Single column layout
- [ ] Cards stack vertically
- [ ] Text readable
- [ ] Buttons easily clickable

---

### Phase 4: URL and Routing Tests

#### Valid URLs

Test these URLs work:
- [ ] `/` (Homepage)
- [ ] `/dashboard`
- [ ] `/[any-valid-student-name]`

#### Invalid URLs (Should 404)

Test these show 404:
- [ ] `/nonexistent-student`
- [ ] `/dashboard/invalid`
- [ ] `/student/invalid`
- [ ] Random strings

#### Case Sensitivity

- [ ] `/ritisha` works (lowercase)
- [ ] `/Ritisha` redirects or works (check implementation)
- [ ] `/RITISHA` redirects or works

#### Special Characters

If any students have hyphens:
- [ ] `/olivia-w` works
- [ ] `/charlie-m` works

---

### Phase 5: API Testing

#### Test API Endpoints Directly

**Notes API:**
```bash
# Test with valid student ID
curl http://localhost:3000/api/notes/sdt_635GJ0

# Test with invalid student ID
curl http://localhost:3000/api/notes/sdt_INVALID
```

**Verify:**
- [ ] Valid ID returns notes JSON
- [ ] Invalid ID returns error (404 or appropriate)
- [ ] Response time reasonable (<2 seconds)
- [ ] JSON properly formatted

**Students API:**
```bash
# Test with valid tutor
curl "http://localhost:3000/api/students?tutor=Finn"

# Test with invalid tutor
curl "http://localhost:3000/api/students?tutor=Invalid"

# Test without tutor parameter
curl "http://localhost:3000/api/students"
```

**Verify:**
- [ ] Valid tutor returns student list
- [ ] Invalid tutor returns empty or error
- [ ] Missing parameter handled gracefully
- [ ] Response time reasonable (<3 seconds)

#### API Error Handling

**Test error scenarios:**
- [ ] MMS API down (mock if possible)
- [ ] Invalid student ID
- [ ] Invalid teacher ID
- [ ] Network timeout
- [ ] Malformed requests

**Verify:**
- [ ] Graceful error messages
- [ ] No crashes
- [ ] User-friendly errors
- [ ] Console logs helpful (for debugging)

---

### Phase 6: Data Validation Tests

#### Configuration Consistency

**Run these checks:**

```bash
# Count students in each config file (should match)
echo "URL Mappings:" && grep -c "sdt_" lib/student-url-mappings.js
echo "Security Whitelist:" && grep -c "sdt_" lib/student-helpers.js
echo "Soundslice:" && grep -c "sdt_" lib/soundslice-mappings.js
echo "Theta:" && grep -c "sdt_" lib/config/theta-credentials.js
echo "Instruments:" && grep -c "sdt_" lib/config/instruments.js
```

**Verify:**
- [ ] All counts match (or close if some students don't have all features)
- [ ] No huge discrepancies

**Check for Duplicates:**

```bash
# Find duplicate student IDs
grep -oP "sdt_\w+" lib/student-url-mappings.js | sort | uniq -d

# Find duplicate friendly URLs
grep -oP "'\w+':" lib/student-url-mappings.js | sort | uniq -d
```

**Verify:**
- [ ] No duplicates found
- [ ] If duplicates, they're intentional (check comments)

#### Data Format Validation

**Student IDs:**
- [ ] All follow format: `sdt_XXXXXX`
- [ ] No typos (e.g., `std_` instead of `sdt_`)

**Friendly URLs:**
- [ ] All lowercase
- [ ] No spaces
- [ ] Only letters, hyphens
- [ ] Consistent naming (firstname or firstname-lastinitial)

**Soundslice URLs:**
- [ ] All follow format: `https://www.soundslice.com/courses/[ID]/`
- [ ] All have trailing slash
- [ ] All HTTPS (not HTTP)

**Theta Credentials:**
- [ ] All follow format: `[firstname]fc`
- [ ] All lowercase
- [ ] No special characters

**Instruments:**
- [ ] Valid values: Piano, Guitar, Voice, Bass, combinations
- [ ] Consistent capitalization

---

### Phase 7: Browser Compatibility

#### Test in Multiple Browsers

**Chrome/Edge (Chromium-based):**
- [ ] All features work
- [ ] No console errors
- [ ] Styling correct

**Firefox:**
- [ ] All features work
- [ ] No console errors
- [ ] Styling correct

**Safari (if available):**
- [ ] All features work
- [ ] No console errors
- [ ] Styling correct

#### Test Browser Features

**JavaScript:**
- [ ] All interactive features work
- [ ] API calls succeed
- [ ] Error handling works

**CSS:**
- [ ] Flexbox/Grid layouts work
- [ ] Responsive breakpoints work
- [ ] Colors/fonts render correctly

**Storage:**
- [ ] LocalStorage works (if used)
- [ ] Cookies work (if used)

---

### Phase 8: Performance Testing

#### Load Time Testing

**Dashboard:**
```bash
# Measure load time
time curl -s http://localhost:3000/dashboard > /dev/null
```

**Targets:**
- [ ] Homepage: <1 second
- [ ] Dashboard: <3 seconds
- [ ] Student portal: <2 seconds
- [ ] API calls: <2 seconds

#### Network Throttling

**Test with slow connection:**
1. Open DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Test all pages

**Verify:**
- [ ] Pages still load (just slower)
- [ ] No timeout errors
- [ ] Loading states show (if implemented)
- [ ] No broken images

#### Large Dataset Testing

**Test with "All Teachers":**
- [ ] Load time acceptable
- [ ] No browser freezing
- [ ] Scrolling smooth
- [ ] Memory usage reasonable

---

### Phase 9: Security Testing

#### Authentication/Authorization (if implemented)

- [ ] Unauthenticated users redirected
- [ ] Only authorized users see data
- [ ] Session timeout works

#### Data Exposure

**Check for:**
- [ ] No API keys in client code
- [ ] No passwords visible (except Theta, which is intentional)
- [ ] No sensitive student data exposed

#### URL Manipulation

**Test:**
- [ ] Can't access other students by guessing URLs (if not intended)
- [ ] Invalid student IDs rejected
- [ ] SQL injection attempts fail (use parameterized queries)

---

### Phase 10: User Experience Testing

#### Navigation Flow

**User Journey:**
1. [ ] Land on homepage
2. [ ] Click to dashboard
3. [ ] Select tutor
4. [ ] View student
5. [ ] Check notes
6. [ ] Open Soundslice
7. [ ] Back to dashboard
8. [ ] Select different tutor

**Verify:**
- [ ] Each step works smoothly
- [ ] Back button works
- [ ] No broken links
- [ ] Intuitive flow

#### Error Messages

**Test scenarios:**
- [ ] Invalid URL → Clear 404 message
- [ ] Network error → User-friendly message
- [ ] No data → "No notes available" (not blank)
- [ ] API error → Helpful error message

**Verify:**
- [ ] Messages are user-friendly
- [ ] Not technical jargon
- [ ] Suggest next steps (if possible)

#### Accessibility

**Basic checks:**
- [ ] Text readable (sufficient contrast)
- [ ] Font size adequate
- [ ] Buttons large enough to click
- [ ] Links clearly identifiable
- [ ] Alt text on images (if any)

---

## Production Testing (Post-Deployment)

After deploying, test the live site:

```
https://efficient-sparkle-production.up.railway.app
```

### Quick Smoke Test (5 minutes)

- [ ] Homepage loads
- [ ] Dashboard loads
- [ ] Can select tutor
- [ ] Students appear
- [ ] New student portal works
- [ ] No console errors

### Full Regression Test (15-30 minutes)

- [ ] Repeat all Phase 2-6 tests on production
- [ ] Test from different devices
- [ ] Test from different networks
- [ ] Verify all data current

---

## Testing Tools

### Browser DevTools

**Console (F12 → Console):**
- See JavaScript errors
- See API responses
- Debug issues

**Network Tab (F12 → Network):**
- See all requests
- Check load times
- See failed requests
- Monitor API calls

**Elements Tab (F12 → Elements):**
- Inspect HTML/CSS
- Test responsive design
- Check computed styles

### Command Line Tools

**cURL - Test APIs:**
```bash
curl http://localhost:3000/api/notes/sdt_XXXXXX
```

**jq - Pretty Print JSON:**
```bash
curl http://localhost:3000/api/notes/sdt_XXXXXX | jq
```

**time - Measure Performance:**
```bash
time curl -s http://localhost:3000/dashboard > /dev/null
```

### Device Testing

**Desktop:**
- Chrome DevTools device emulation
- Actual desktop browsers

**Tablet:**
- iPad (if available)
- Android tablet
- Responsive design mode

**Mobile:**
- iPhone (if available)
- Android phone
- Browser mobile view

---

## Test Documentation

### Record Issues Found

Create a simple log:

```markdown
## Testing Session: [Date]
**Changes Tested**: Adding Ritisha student portal

### Issues Found:
1. **Minor**: Instrument shows "Guitar" instead of "Piano"
   - File: lib/config/instruments.js
   - Fix: Add instrument override
   - Status: Fixed

2. **Critical**: Portal 404 error
   - File: lib/student-helpers.js
   - Fix: Add to security whitelist
   - Status: Fixed

### Test Results:
- Dashboard: ✅ Pass
- Student Portal: ✅ Pass (after fixes)
- API: ✅ Pass
- Responsive: ✅ Pass
```

---

## Common Testing Mistakes

**Don't:**
- ❌ Skip build test
- ❌ Only test happy path
- ❌ Test in only one browser
- ❌ Ignore console errors
- ❌ Deploy untested code
- ❌ Assume it works in production

**Do:**
- ✅ Test locally first
- ✅ Test edge cases
- ✅ Test multiple browsers
- ✅ Check console
- ✅ Test before deploying
- ✅ Verify production after deploy

---

## Related Workflows

- See: `01-adding-students.md` - What to test when adding students
- See: `02-adding-tutors.md` - What to test when adding tutors
- See: `03-troubleshooting-common-issues.md` - Fix issues found during testing
- See: `04-deployment-checklist.md` - Pre-deployment testing checklist
