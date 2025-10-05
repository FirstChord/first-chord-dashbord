# Contributing to First Chord Payment Pause Extension

## Development Environment Setup

### Prerequisites
- Google Chrome (latest version)
- Text editor (VS Code recommended)
- Access to First Chord Google Workspace
- MyMusicStaff admin account
- Stripe dashboard access

### Initial Setup
1. Clone/download the extension folder
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked" → Select extension folder
5. Open MyMusicStaff and log in
6. Click extension icon to verify it loads

### Development Workflow
1. Make code changes in your editor
2. Go to `chrome://extensions/`
3. Click reload icon on "First Chord Payment Pause Manager"
4. If you modified content-script.js:
   - Go to MyMusicStaff tab
   - Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
5. Test changes via extension popup
6. Check console logs (F12) for errors

## File Organization

### Core Files (Edit These)
- **adminpanel.js** - Main logic, student search, UI interactions
- **content-script.js** - API calls to MyMusicStaff and Stripe
- **adminpanel.html** - Popup UI structure and styling

### Configuration Files (Rarely Change)
- **manifest.json** - Extension permissions and metadata
- **UPDATED_GOOGLE_APPS_SCRIPT.js** - Google Sheets backend (deploy separately)

### Documentation Files (Update When Making Changes)
- **ARCHITECTURE.md** - System design and technical details
- **CONTRIBUTING.md** - This file
- **DEVELOPMENT_PROTOCOL.md** - Rules and best practices
- **README.md** - User guide

## Code Style Guidelines

### JavaScript
- Use `async/await` for asynchronous operations (not `.then()`)
- Add emoji prefixes to console logs for easy scanning:
  - 🔄 Loading/processing
  - ✅ Success
  - ❌ Error
  - ⚠️ Warning
  - 📡 Network request
  - 🔑 Authentication
- Use descriptive variable names (e.g., `studentDatabase` not `db`)
- Add comments for non-obvious logic

**Example**:
```javascript
// Good
async function findStudent(studentId) {
  console.log('🔍 Finding student:', studentId);
  try {
    const response = await fetchStudentData(studentId);
    console.log('✅ Student found:', response.name);
    return response;
  } catch (error) {
    console.error('❌ Student search failed:', error);
    throw error;
  }
}

// Avoid
function findStudent(id) {
  return fetchStudentData(id).then(r => r).catch(e => console.log(e));
}
```

### HTML/CSS
- Use semantic HTML elements
- Keep styles in `<style>` block in adminpanel.html
- Use descriptive class names (e.g., `.student-search-results` not `.ssr`)
- Mobile-friendly not required (desktop-only tool)

### Error Messages
- User-facing: Clear, actionable, non-technical
  - Good: "Student not found. Please check the name and try again."
  - Bad: "HTTP 404: GET /api/v1/students returned null"
- Console logs: Detailed, technical, with context
  - Good: `console.error('❌ API call failed:', { endpoint, status, error })`

## Testing Checklist

### Before Committing Code

**1. Basic Functionality**
- [ ] Extension popup opens without errors
- [ ] Student search works (try "Alex", "Chang", "al")
- [ ] Date fields populate with defaults
- [ ] Preview button shows correct information
- [ ] Execute buttons are disabled until preview is run

**2. Search Functionality**
- [ ] Results appear within 300ms of typing
- [ ] Results are sorted correctly (matches starting with query first)
- [ ] Selecting a result populates the student field
- [ ] Clearing search clears results

**3. Date Validation**
- [ ] Start date defaults to today
- [ ] End date defaults to 1 week from today
- [ ] Can select past dates (warning shown)
- [ ] Can select future dates
- [ ] End date must be after start date

**4. Preview Mode**
- [ ] Shows student name, tutor, dates
- [ ] Shows calendar blocks to be created
- [ ] Shows Stripe subscription info (if applicable)
- [ ] Enables execute buttons after preview

**5. Execution (Test with Non-Production Student)**
- [ ] MyMusicStaff Only: Creates calendar blocks, doesn't touch Stripe
- [ ] Full Automation: Creates blocks + pauses Stripe + generates WhatsApp message
- [ ] Success message appears
- [ ] WhatsApp message is copyable

**6. Error Handling**
- [ ] No student selected → Clear error message
- [ ] No MyMusicStaff tab open → "Content script not loaded" message
- [ ] Invalid dates → Validation error
- [ ] Network failure → Retry logic kicks in (check console)

**7. Console Logs**
- [ ] No red errors in popup console (F12 on popup)
- [ ] No red errors in MyMusicStaff page console
- [ ] All logs have emoji prefixes for readability

### Test Students
**Production Testing** (use with caution):
- Alex Chang (mms_id: sdt_gwyQJr) - Known working student

**Creating Test Students**:
1. Add to Google Sheets with fake email
2. Use "MyMusicStaff Only" mode (won't touch Stripe)
3. Manually delete calendar blocks after testing

## Making Changes

### Small Changes (Bug Fixes, UI Tweaks)
1. Make changes directly in files
2. Test using checklist above
3. Commit with descriptive message
4. Inform business partner if user-facing changes

### Large Changes (New Features)
1. Create plan/proposal (discuss with team)
2. Update ARCHITECTURE.md with design decisions
3. Implement changes incrementally
4. Test each step before moving to next
5. Update documentation
6. Commit with detailed message
7. Create rollback plan (git tag/branch)

### Updating Google Apps Script
1. Make changes to `UPDATED_GOOGLE_APPS_SCRIPT.js` file
2. Open Google Sheets: [First Chord Students - TESTING](https://docs.google.com/spreadsheets/d/1Rn6fJEkT3-vTFfOTyanp1AJDzfxPpx9REWGQ-WK8Q2o)
3. Extensions → Apps Script
4. Replace `Code.gs` content with updated script
5. Deploy → Manage deployments → Edit (pencil icon) → Version: New version → Deploy
6. **Important**: URL stays the same, no extension changes needed
7. Test: Clear cache and reload extension to verify new data

### Updating API Keys

**MyMusicStaff Token**:
1. Get fresh token from First Chord Dashboard
2. Update `MMS_API_TOKEN` in content-script.js (line ~10)
3. Reload extension
4. Test with student search

**Stripe API Key**:
1. Get restricted key from Stripe dashboard
2. Ensure key has "Subscriptions: Read & Write" permission only
3. Update `STRIPE_API_KEY` in content-script.js (line ~14)
4. Reload extension
5. Test with subscription pause (use test mode first if possible)

## Common Development Tasks

### Adding New Student Data Field

**Example: Adding "instrument" field**

1. **Update Google Sheets**:
   - Add column H: "Instrument"
   - Fill in data for students

2. **Update Google Apps Script**:
   ```javascript
   const student = {
     studentSurname: row[0] || '',
     studentForename: row[1] || '',
     tutor: row[2] || '',
     parentSurname: row[3] || '',
     parentForename: row[4] || '',
     email: row[5] || '',
     instrument: row[7] || '' // New field (column H = row[7])
   };

   if (row[6]) {
     student.mms_id = row[6]; // Existing mms_id
   }
   ```

3. **Update Extension UI**:
   - Modify adminpanel.js to display instrument in search results
   - Update preview panel to show instrument

4. **Test**:
   - Clear cache: `chrome.storage.local.remove(['student_database_cache'])`
   - Reload extension
   - Search for student and verify instrument appears

### Modifying WhatsApp Message Template

**Location**: adminpanel.js, function `generateWhatsAppMessage()`

**Example**: Adding pause reason to message

```javascript
function generateWhatsAppMessage(student, startDate, endDate, reason) {
  const parentName = student.parentForename || 'Parent';
  const studentName = student.studentForename;

  return `Hi ${parentName},

Just a quick note that ${studentName}'s lessons will be paused from ${formatDate(startDate)} to ${formatDate(endDate)} due to ${reason}.

Their payment will be automatically paused during this period.

Best regards,
First Chord Team`;
}
```

**Update preview panel** to show new message format.

### Adding New Execute Mode

**Example**: "MyMusicStaff + Email Only" (no Stripe)

1. **Add button to adminpanel.html**:
   ```html
   <button class="btn btn-execute-email" id="execute-mms-email-btn" disabled>
     MMS + Email Parent
   </button>
   ```

2. **Add event listener in adminpanel.js**:
   ```javascript
   document.getElementById('execute-mms-email-btn').addEventListener('click', async () => {
     await executeMMSAndEmail();
   });
   ```

3. **Implement function**:
   ```javascript
   async function executeMMSAndEmail() {
     // 1. Create MyMusicStaff calendar blocks
     // 2. Generate email message
     // 3. Open email client with pre-filled message (mailto:)
   }
   ```

4. **Update preview** to mention email will be sent.

### Debugging API Calls

**Enable detailed logging**:
1. Open popup → Right-click → Inspect
2. Console tab → Check "Preserve log"
3. Perform action (search, preview, execute)
4. Look for 📡 Network request logs
5. Check for ❌ Error logs

**Test API calls directly**:

MyMusicStaff example (in browser console on MyMusicStaff page):
```javascript
const response = await fetch('https://api.mymusicstaff.com/api/v1/students?search=Alex', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
});
const data = await response.json();
console.log(data);
```

Stripe example (use Postman or curl):
```bash
curl https://api.stripe.com/v1/subscriptions/sub_XXXXX \
  -u rk_live_YOUR_KEY_HERE:
```

## Git Workflow

### Commit Messages
Use descriptive, imperative-mood messages:

**Good**:
- `feat: add MMS ID support for faster student lookup`
- `fix: resolve date field not populating on load`
- `docs: update ARCHITECTURE with caching strategy`
- `refactor: simplify token authentication logic`

**Bad**:
- `updates`
- `fixed bug`
- `changes to adminpanel.js`

### Commit Frequency
- Commit after each logical unit of work
- Don't commit broken code (all tests should pass)
- Commit before attempting risky changes (creates restore point)

### Branching Strategy
**Current**: Single `main` branch (2-person team)

**For large features**:
1. Create feature branch: `git checkout -b feature/subscription-schedules`
2. Develop incrementally with commits
3. Test thoroughly
4. Merge back to main when complete
5. Tag important milestones: `git tag v1.0-mms-ids`

### Rolling Back Changes
```bash
# See recent commits
git log --oneline -10

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Restore specific file from previous commit
git checkout HEAD~1 -- adminpanel.js
```

## Cache Management

### When to Clear Cache

**Always clear after**:
- Updating Google Sheets data
- Changing Google Apps Script
- Adding new students
- Modifying student schema (new fields)

**How to clear**:
```javascript
// In browser console (on popup or any page)
chrome.storage.local.remove(['student_database_cache'], () => {
  console.log('✅ Cache cleared');
});

// Or clear all storage
chrome.storage.local.clear(() => {
  console.log('✅ All storage cleared');
});
```

**Verify cache status**:
```javascript
chrome.storage.local.get(['student_database_cache'], (result) => {
  if (result.student_database_cache) {
    const age = Date.now() - result.student_database_cache.timestamp;
    console.log(`Cache age: ${Math.round(age / 1000 / 60)} minutes`);
    console.log(`Students: ${result.student_database_cache.data.length}`);
  } else {
    console.log('No cache found');
  }
});
```

## Performance Considerations

### Optimizing Student Search
- **Debounce delay**: 300ms (good balance, don't change unless needed)
- **Max results**: 10 (prevents UI clutter)
- **Sorting**: Client-side (fast for 176 students, server-side if > 1000)

### Optimizing API Calls
- **Use MMS IDs**: Always prefer direct lookup over search
- **Batch operations**: If adding bulk pause feature, batch API calls (10 at a time)
- **Retry logic**: 3 attempts with exponential backoff (1s, 2s, 4s)

### Cache Tuning
- **TTL**: 24 hours (change if student data updates more frequently)
- **Size**: ~50KB for 176 students (well within chrome.storage.local 10MB limit)

## Security Best Practices

### For Internal Tool
- Keep API keys hardcoded (convenience for 2-person team)
- Don't commit to public GitHub (keep private)
- Share updated extension via secure channel (Google Drive, not email)
- Rotate keys annually or if team member leaves

### If Making Public (Not Planned)
Would need:
- Configuration UI for API keys (no hardcoding)
- OAuth flow for MyMusicStaff
- Encrypted storage (`chrome.storage.local` is unencrypted)
- Content Security Policy (CSP) hardening
- Code obfuscation/minification

## Troubleshooting Development Issues

### Extension Won't Load
- Check `manifest.json` for syntax errors (use JSON validator)
- Ensure all files referenced in manifest exist
- Check Chrome console for errors (`chrome://extensions/` → Errors button)

### Content Script Not Injecting
- Verify MyMusicStaff tab is open and logged in
- Check URL matches pattern in manifest: `https://app.mymusicstaff.com/*`
- Hard refresh MyMusicStaff page (Ctrl+Shift+R)
- Check "all_frames": true in manifest (needed for iframes)

### API Calls Failing with CORS Error
- Content scripts bypass CORS (run in page context)
- If seeing CORS error, verify call is in content-script.js (not adminpanel.js)
- Background scripts can't make CORS calls (use content script)

### Changes Not Appearing
- **JavaScript changes**: Reload extension + hard refresh MMS page
- **HTML/CSS changes**: Reload extension (hard refresh not needed)
- **Manifest changes**: Reload extension + restart Chrome (sometimes required)
- **Clear cache**: Shift+F5 on popup

### console.log Not Showing
- **Popup logs**: Right-click popup → Inspect → Console tab
- **Content script logs**: F12 on MyMusicStaff page → Console tab
- **Background script logs** (if added): chrome://extensions/ → Background page

## Getting Help

### Documentation
1. Read ARCHITECTURE.md for system design
2. Read DEVELOPMENT_PROTOCOL.md for rules and best practices
3. Check this file (CONTRIBUTING.md) for how-to guides

### Debugging Tools
- **Debug Panel**: Open `debug-panel.html` in browser to test student loading and content script
- **Chrome DevTools**: F12 on popup and MyMusicStaff page
- **Network Tab**: See all API calls (F12 → Network)
- **Application Tab**: View chrome.storage data (F12 → Application → Storage)

### External Resources
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [MyMusicStaff API Docs](https://app.mymusicstaff.com/api-documentation) (requires login)
- [Stripe API Docs](https://stripe.com/docs/api)
- [Google Apps Script Reference](https://developers.google.com/apps-script/reference)

### Contact
- **Primary Developer**: Finn (extension creator)
- **Business Partner**: [Name] (user #2)

## Quick Reference Commands

```bash
# Reload extension after code changes
# Go to chrome://extensions/ and click reload icon

# Clear extension cache
chrome.storage.local.remove(['student_database_cache'])

# View cached data
chrome.storage.local.get(['student_database_cache'], console.log)

# Test Google Sheets endpoint
fetch('https://script.google.com/macros/s/AKfycbyVicLCz07cnJ0iTF60-2KlBJ4UaCXUvih6wLwVKzRvHRAf_BXeQLX-vWjR030tMp0RIA/exec')
  .then(r => r.json())
  .then(console.log)

# Check git status
git status

# See recent commits
git log --oneline -10

# Create feature branch
git checkout -b feature/new-feature-name

# Commit changes
git add .
git commit -m "feat: describe your changes"

# Tag important milestone
git tag v1.0-milestone-name
```

---

**Last Updated**: January 2025
**Maintainer**: Finn
**For**: First Chord Music School Internal Use
