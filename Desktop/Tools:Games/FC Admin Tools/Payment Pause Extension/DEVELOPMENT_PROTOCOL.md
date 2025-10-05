# Development Protocol for Future Developers & AI Agents

## Core Principles

### 1. Internal Tool First
This extension is designed for **2 internal users** at First Chord Music School. Design decisions prioritize:
- **Convenience** over enterprise security
- **Speed of development** over perfect architecture
- **Simplicity** over scalability
- **Working code** over elegant code

**Implication**: Hardcoded API keys, minimal abstraction, direct implementations are acceptable and preferred.

### 2. User Trust & Safety
Despite being internal, this tool modifies:
- Student calendar blocks (MyMusicStaff)
- Payment subscriptions (Stripe - real money)
- Parent communications (WhatsApp messages)

**Rules**:
- Always show preview before execution
- Require explicit user confirmation for destructive actions
- Log all API calls with full context
- Never auto-execute on page load or timer
- Validate all date inputs (no past dates for new pauses unless explicitly intended)

### 3. Fail Loudly, Recover Gracefully
**Never fail silently**. If something breaks:
- Show clear error message to user
- Log detailed error to console with context
- Don't continue execution if critical step fails
- Provide retry option when appropriate

**Example**:
```javascript
// Good
try {
  const result = await createCalendarBlock(student, date);
  console.log('✅ Calendar block created:', result.id);
  return result;
} catch (error) {
  console.error('❌ Calendar block failed:', { student, date, error });
  showError('Could not create calendar block. Please try again or contact support.');
  throw error; // Don't continue if this is critical
}

// Bad
try {
  await createCalendarBlock(student, date);
} catch (error) {
  // Silent failure - user has no idea it didn't work!
}
```

## Code Modification Rules

### When to Edit Each File

**adminpanel.js** - Edit for:
- UI logic changes (search, preview, button states)
- Adding new input fields
- Changing WhatsApp message templates
- Modifying cache behavior
- New student selection features

**content-script.js** - Edit for:
- API endpoint changes (MyMusicStaff, Stripe)
- Authentication token updates
- New API integrations
- Retry logic modifications
- Calendar block logic changes

**adminpanel.html** - Edit for:
- UI layout changes
- New input fields (dates, dropdowns, etc.)
- Styling updates
- New buttons or panels

**manifest.json** - Edit for:
- Permission changes (new APIs)
- Version updates
- New content script injection rules

**UPDATED_GOOGLE_APPS_SCRIPT.js** - Edit for:
- Student data schema changes
- New columns in Google Sheets
- Performance optimizations for data fetching

### Never Change Without Good Reason
- Cache TTL (24 hours) - carefully tuned
- Search debounce delay (300ms) - good balance
- Retry backoff strategy (3 attempts, 1s/2s/4s) - proven reliable
- Hardcoded API keys - intentional for internal use

## Feature Development Protocol

### Before Adding New Feature

1. **Define Use Case**
   - Who needs this? (admin, business partner, both)
   - How often will it be used? (daily, weekly, rare)
   - What's the manual process today?
   - What's the time savings?

2. **Check Constraints**
   - Can Chrome extensions do this? (no background timers for future actions)
   - Does API support this? (check Stripe/MMS docs)
   - Is data available? (in Google Sheets or via API)

3. **Plan Rollback**
   - Commit current working state first
   - Tag commit: `git tag v1.0-before-feature-name`
   - Document how to revert if needed

### During Feature Development

1. **Incremental Implementation**
   - Work in small, testable chunks
   - Commit after each working step
   - Don't refactor while adding features (separate commits)

2. **Logging Requirements**
   - Every API call must log: endpoint, payload, response status
   - Every error must log: context (student, dates, action)
   - Use emoji prefixes (see CONTRIBUTING.md)

3. **Testing Requirements**
   - Test with non-production student first (if possible)
   - Test error scenarios (network failure, missing data, wrong dates)
   - Test on both admin machines (different Chrome versions, OS)

### After Feature Completion

1. **Documentation Updates**
   - Update ARCHITECTURE.md with design decisions
   - Update README.md with usage instructions
   - Update CONTRIBUTING.md if workflow changed
   - Add to TESTING_GUIDE.md if new test cases

2. **Code Review Checklist**
   - [ ] All console.logs have emoji prefixes
   - [ ] User-facing errors are clear and actionable
   - [ ] Preview mode shows all changes before execution
   - [ ] No hardcoded student data (except for testing)
   - [ ] Cache invalidation handled if data schema changed
   - [ ] Retry logic for network calls
   - [ ] Works with MyMusicStaff tab in any state (active, background, multiple tabs)

3. **Deployment**
   - Reload extension and test personally
   - Send updated extension folder to business partner
   - Monitor for issues for 1 week
   - Keep rollback commit easily accessible

## API Integration Rules

### MyMusicStaff API

**Authentication**: JWT token from dashboard (never expires, but could be revoked)

**Key Endpoints**:
- `/students?search={name}` - Search by name (slow, use only if no MMS ID)
- `/students/{mms_id}` - Direct lookup (fast, preferred)
- `/calendar/blocks` - Create calendar blocks for pauses

**Rules**:
- Always use MMS ID if available (student.mms_id field)
- Fallback to name search only if no MMS ID
- Add retry logic (network can be flaky)
- Log full request/response for debugging
- Check response status before parsing JSON

**Token Update Process**:
1. Get fresh token from First Chord Dashboard
2. Update `MMS_API_TOKEN` constant in content-script.js (line ~10)
3. Test with student search
4. Commit with message: `chore: update MMS API token`

### Stripe API

**Authentication**: Restricted live API key (read/write subscriptions only)

**Key Endpoints**:
- `/subscriptions?customer={id}` - Find customer subscriptions
- `/subscriptions/{id}` - Get subscription details
- `/subscriptions/{id}` - Update subscription (PATCH for pause/resume)
- `/subscription_schedules` - (Future) Schedule future pauses

**Rules**:
- NEVER test with live subscriptions (use Stripe test mode if possible)
- Always check subscription status before pausing (already paused?)
- Validate pause dates (start < end, no past dates)
- Log subscription ID with all operations
- Handle "already paused" gracefully (not an error)

**Billing Logic**:
- Pausing = prorated refund (Stripe handles automatically)
- Resuming = billing resumes on next cycle
- Future pauses = requires Subscription Schedules API (not yet implemented)

**Token Update Process**:
1. Log into Stripe dashboard → Developers → API keys
2. Create/revoke restricted key with "Subscriptions: Read & Write" only
3. Update `STRIPE_API_KEY` in content-script.js (line ~14)
4. Test with known subscription (Alex Chang)
5. Commit with message: `chore: update Stripe API key`

### Google Sheets API (Apps Script)

**Authentication**: None (public endpoint, but obfuscated URL)

**Endpoint**: `https://script.google.com/macros/s/AKfycbyVicLCz07cnJ0iTF60-2KlBJ4UaCXUvih6wLwVKzRvHRAf_BXeQLX-vWjR030tMp0RIA/exec`

**Data Contract**:
```json
{
  "success": true,
  "students": [
    {
      "studentSurname": "Chang",
      "studentForename": "Alex",
      "tutor": "Sarah",
      "parentSurname": "Chang",
      "parentForename": "Lisa",
      "email": "parent@example.com",
      "mms_id": "sdt_gwyQJr"
    }
  ],
  "count": 176,
  "lastUpdated": "2025-01-15T10:30:00.000Z"
}
```

**Rules**:
- Don't add authentication (complicates setup)
- Always return `success: true/false`
- Include `count` field (helps verify data loaded)
- Include `lastUpdated` timestamp (helps debug cache issues)
- Handle missing data gracefully (empty string, not null)

**Schema Changes**:
1. Add column to Google Sheets
2. Update `UPDATED_GOOGLE_APPS_SCRIPT.js` to include new field
3. Deploy new version via Apps Script editor
4. Update TypeScript interface (if using types)
5. Clear extension cache: `chrome.storage.local.remove(['student_database_cache'])`
6. Test data loads correctly
7. Update documentation

## Error Handling Standards

### User-Facing Error Messages

**Template**: `[What went wrong] [What to do about it]`

**Examples**:
- ❌ "Student not found. Please check the spelling and try again."
- ❌ "MyMusicStaff is not open. Please log in to MyMusicStaff and reload this extension."
- ❌ "End date must be after start date. Please adjust your dates."
- ⚠️ "Student has no active Stripe subscription. Only MyMusicStaff calendar will be updated."

**Don't**:
- Show HTTP status codes to user
- Show JSON error responses
- Use technical jargon ("CORS error", "401 Unauthorized")
- Blame the user ("You entered invalid data")

### Console Error Logging

**Template**: `❌ [Action that failed]: [Context object with details]`

**Examples**:
```javascript
console.error('❌ Student search failed:', {
  query: searchQuery,
  endpoint: '/students',
  status: response.status,
  error: error.message
});

console.error('❌ Stripe pause failed:', {
  studentName: student.studentForename,
  subscriptionId: subscriptionId,
  pauseDates: { start: startDate, end: endDate },
  stripeError: error
});
```

**Include**:
- Student identifier (name or ID, never email)
- API endpoint
- Request payload (sanitized, no API keys)
- Response status and error message
- Timestamp (console adds automatically)

### Retry vs Fail Fast

**Retry (3 attempts with backoff)**:
- Network timeouts
- 500/502/503 server errors
- "Service temporarily unavailable"

**Fail Fast (no retry)**:
- 401/403 authentication errors (token is wrong, retry won't help)
- 400 bad request (payload is wrong, retry won't help)
- 404 not found (resource doesn't exist)
- Validation errors (dates, student selection)

**Implementation**:
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      // Check if error is non-retryable
      if (error.message.includes('401') ||
          error.message.includes('403') ||
          error.message.includes('400')) {
        console.error('❌ Non-retryable error:', error);
        throw error; // Fail fast
      }

      // Last attempt, give up
      if (i === maxRetries - 1) {
        console.error('❌ All retry attempts failed:', error);
        throw error;
      }

      // Retry with exponential backoff
      const delay = 1000 * Math.pow(2, i); // 1s, 2s, 4s
      console.log(`⏳ Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await sleep(delay);
    }
  }
}
```

## Data Management Rules

### Student Data (Google Sheets)

**Source of Truth**: Google Sheets spreadsheet (ID: `1Rn6fJEkT3-vTFfOTyanp1AJDzfxPpx9REWGQ-WK8Q2o`)

**Update Frequency**: As needed (new students, tutor changes, etc.)

**Cache Invalidation**: Manual via developer console or automatic after 24 hours

**Rules**:
- Never modify Google Sheets from extension (read-only)
- Don't store student data in extension (use cache only for performance)
- Treat Google Sheets as authoritative (if conflict, Sheets wins)

**Adding New Students**:
1. Add row to Google Sheets with all required fields
2. Get MMS ID from MyMusicStaff (if student exists there)
3. Clear extension cache
4. Reload extension to verify student appears

**Updating Student Data**:
1. Edit Google Sheets
2. Clear extension cache: `chrome.storage.local.remove(['student_database_cache'])`
3. Reload extension
4. Search for student to verify changes

### Cache Management

**What's Cached**: Student database (176 students, ~50KB)

**TTL**: 24 hours

**Storage**: chrome.storage.local (unencrypted, 10MB limit)

**When to Clear Cache**:
- After updating Google Sheets
- After deploying new Google Apps Script
- If student data looks stale/wrong
- After adding new data fields

**How to Clear**:
```javascript
// In browser console (F12 on popup or any page)
chrome.storage.local.remove(['student_database_cache'], () => {
  console.log('✅ Cache cleared');
});
```

**Cache Key**: `'student_database_cache'`

**Cache Structure**:
```javascript
{
  timestamp: 1705319400000, // Date.now() when cached
  data: [...176 students...],
  count: 176
}
```

**Rules**:
- Never cache API tokens (always hardcoded)
- Never cache sensitive data (payment info, full addresses)
- Always check cache age before using
- Provide manual cache clear option (don't hide this from users)

## Security & Privacy Rules

### For Internal Use (Current)

**Acceptable**:
- Hardcoded API keys in source code
- Unencrypted student data in cache
- Logging student names to console
- Sharing extension folder via Google Drive

**Not Acceptable**:
- Committing to public GitHub repository
- Emailing extension with API keys to non-First Chord staff
- Logging full student emails or payment info
- Storing credit card numbers (never needed anyway)

### If Making Public (Not Planned, But Just In Case)

**Would Need**:
- Configuration UI for API keys (no hardcoding)
- OAuth flow for MyMusicStaff (not API key)
- Encrypted chrome.storage for sensitive data
- Stripe Connect (not direct API key)
- Data retention policies (GDPR compliance)
- User roles/permissions (admin vs read-only)
- Audit logging (who did what when)

**Don't Do This Without Legal/Security Review**

### API Key Rotation

**Frequency**: Annually or when:
- Team member leaves
- Key accidentally exposed (email, screenshot, etc.)
- Suspicious API activity detected
- Stripe security alert

**Process**:
1. Generate new key in respective platform
2. Update hardcoded key in content-script.js
3. Test thoroughly
4. Deploy to both admin machines
5. Revoke old key
6. Document in git commit message

## Testing Philosophy

### Manual Testing is Primary
This is a 2-person tool. Automated tests are overkill. Instead:
- Test every change manually before committing
- Use real data (with caution on production)
- Keep a test student in Google Sheets
- Document test cases in TESTING_GUIDE.md

### Test Checklist (Minimum)
Before committing any code change:
- [ ] Extension loads without errors
- [ ] Student search returns results
- [ ] Preview shows correct information
- [ ] Execute (with test student) completes successfully
- [ ] No red errors in console

### Regression Testing
After any change, test these critical paths:
1. Search for student → Select → Preview → Execute
2. MyMusicStaff Only mode
3. Full Automation mode
4. WhatsApp message generation

### Production Testing Protocol
When testing with real students:
1. Use "MyMusicStaff Only" mode first (doesn't touch Stripe)
2. Manually verify calendar blocks created correctly
3. Delete test calendar blocks before creating real pause
4. If testing Stripe, use very short pause period (1 day)
5. Verify pause in Stripe dashboard before confirming to parent

## Communication Standards

### Git Commit Messages
Format: `<type>: <description>`

**Types**:
- `feat:` New feature (e.g., `feat: add MMS ID support`)
- `fix:` Bug fix (e.g., `fix: resolve date field not populating`)
- `docs:` Documentation only (e.g., `docs: update ARCHITECTURE`)
- `refactor:` Code restructuring without behavior change
- `chore:` Maintenance (e.g., `chore: update API token`)
- `test:` Testing changes

**Examples**:
```
feat: implement Stripe Subscription Schedules for future pauses
fix: handle students with no Stripe subscription gracefully
docs: add troubleshooting guide for 401 errors
refactor: extract WhatsApp message generation to separate function
chore: update MMS API token (expires Jan 2026)
```

### Code Comments
Comment **why**, not **what** (code should be self-documenting for "what")

**Good**:
```javascript
// Cache for 24 hours because student data changes infrequently (weekly at most)
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Use MMS ID if available (10x faster than name search which queries 489 students)
if (student.mms_id) {
  return await fetchStudentById(student.mms_id);
}
```

**Bad**:
```javascript
// Set cache TTL to 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Check if student has MMS ID
if (student.mms_id) {
  return await fetchStudentById(student.mms_id);
}
```

### Documentation Updates
When changing functionality, update docs **in same commit**:
- README.md: User-facing features
- ARCHITECTURE.md: Technical design decisions
- CONTRIBUTING.md: Development workflow changes
- DEVELOPMENT_PROTOCOL.md: New rules or protocols

**Don't**: Create separate "update docs" commits later (you'll forget)

## Future-Proofing Guidelines

### Anticipate Common Changes

**Likely to Change Soon**:
- Student data schema (new columns in Google Sheets)
- WhatsApp message templates (parent communication style)
- Pause reasons (currently: holiday, tutor away, school break, other)
- Date validation rules (currently no past dates)

**Make These Easy to Modify**:
- Extract as constants at top of file
- Add comments explaining business logic
- Document in CONTRIBUTING.md

**Unlikely to Change**:
- Chrome extension architecture (Manifest V3 is stable)
- MyMusicStaff API endpoints (v1 has been stable for years)
- Stripe API fundamentals (versioned, backwards compatible)

### Avoid Premature Optimization

**Don't Optimize**:
- Database queries (Google Sheets is fine for 200 students)
- Search algorithm (client-side filtering is instant for this size)
- Caching beyond 24 hours (unnecessary complexity)

**Do Optimize**:
- User experience (debouncing, preview mode, clear errors)
- API call count (cache, use MMS IDs)
- Loading speed (current load time is 0.1-0.5s, good enough)

### Prepare for Handoff

Assume next developer knows:
- JavaScript basics (async/await, promises, DOM)
- Chrome extension concepts (popup, content scripts, messaging)
- REST APIs (fetch, headers, JSON)

Assume next developer **doesn't** know:
- First Chord business logic (pause workflow, parent communication)
- MyMusicStaff internals (MMS IDs, calendar blocks)
- Stripe subscription mechanics (prorated refunds, schedules)

**Therefore**:
- Document business logic thoroughly (this file, ARCHITECTURE.md)
- Link to external API docs in code comments
- Provide examples for common tasks (CONTRIBUTING.md)

## AI Agent Instructions

If an AI agent (like Claude) is working on this codebase:

### Context You Should Know
- This is an internal tool for 2 people (convenience > enterprise patterns)
- Hardcoded API keys are intentional (don't suggest configuration UI)
- No automated tests exist (manual testing is the process)
- Simple, working code > elegant, complex code

### When Making Changes
1. Read ARCHITECTURE.md first (understand system design)
2. Check CONTRIBUTING.md for how-to guides
3. Follow this protocol document for rules
4. Test changes manually before committing
5. Update documentation in same commit

### What to Prioritize
1. **User safety**: Never execute without preview and confirmation
2. **Clear errors**: User should always know what went wrong and what to do
3. **Logging**: Every API call and error must be logged with context
4. **Documentation**: Keep docs in sync with code

### What to Avoid
1. Over-engineering (no frameworks, no build systems, no TypeScript)
2. Premature optimization (it's fast enough)
3. Breaking changes without rollback plan (commit before risky changes)
4. Silent failures (always fail loudly)

### Common Pitfalls
- **Don't** suggest moving API keys to environment variables (adds setup complexity)
- **Don't** suggest adding unit tests (manual testing works for this scale)
- **Don't** suggest migrating to React/Vue (vanilla JS is simpler)
- **Don't** suggest backend server (Google Sheets + Apps Script is fine)

### Helpful Suggestions
- **Do** suggest better error messages (this helps users)
- **Do** suggest logging improvements (helps debugging)
- **Do** suggest validation checks (prevents bad data)
- **Do** suggest documentation updates (keeps knowledge current)

---

**Last Updated**: January 2025
**Next Review**: Before implementing Stripe Subscription Schedules
**Maintainer**: Finn
**For**: First Chord Music School
