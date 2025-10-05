# First Chord Payment Pause Extension - Architecture

## Overview

Chrome extension that automates student payment pauses across MyMusicStaff and Stripe for First Chord music school. Built for internal use by 2 administrators.

## System Components

### 1. Extension Popup (`adminpanel.html` + `adminpanel.js`)
**Purpose**: User interface for selecting students and managing pauses

**Key Features**:
- Student search with autocomplete (300ms debounce)
- Date range selection for pause periods
- Preview mode before execution
- Two execution modes:
  - MyMusicStaff Only (calendar blocks)
  - Full Automation (MMS + Stripe subscription pause)

**Data Flow**:
```
User Input → Search Database (cached) → Select Student → Choose Dates → Preview → Execute
```

### 2. Content Script (`content-script.js`)
**Purpose**: Runs on MyMusicStaff pages, handles API calls with proper authentication

**Why Needed**: Chrome extensions can't make authenticated API calls directly due to CORS. Content scripts run in the page context and can use the school's authentication.

**Key Responsibilities**:
- MyMusicStaff API calls (student search, calendar updates)
- Stripe API calls (subscription pause/resume)
- Retry logic with exponential backoff (3 attempts, 1s → 2s → 4s)
- Message passing with popup

**API Endpoints Used**:
- MyMusicStaff: `https://api.mymusicstaff.com/api/v1/`
  - `/students` - Search/fetch student data
  - `/calendar/blocks` - Create calendar blocks for pauses
- Stripe: `https://api.stripe.com/v1/`
  - `/subscriptions/{id}/pause` - Pause subscription
  - `/subscriptions/{id}/resume` - Resume subscription

### 3. Student Database (Google Sheets + Apps Script)
**Purpose**: Central source of truth for student data

**Endpoint**: `https://script.google.com/macros/s/AKfycbyVicLCz07cnJ0iTF60-2KlBJ4UaCXUvih6wLwVKzRvHRAf_BXeQLX-vWjR030tMp0RIA/exec`

**Spreadsheet ID**: `1Rn6fJEkT3-vTFfOTyanp1AJDzfxPpx9REWGQ-WK8Q2o`

**Schema**:
```
Column A: Student Surname
Column B: Student Forename
Column C: Tutor
Column D: Parent Surname
Column E: Parent Forename
Column F: Email
Column G: MMS ID (e.g., sdt_gwyQJr)
```

**Google Apps Script** (`UPDATED_GOOGLE_APPS_SCRIPT.js`):
- Serves student data as JSON
- Filters out empty rows
- Includes mms_id field when available
- Returns 176 active students (as of Jan 2025)

## Performance Optimizations

### 1. 24-Hour Caching System
**Problem**: Loading 176 students from Google Sheets every popup open (2-5s)

**Solution**:
```javascript
const CACHE_KEY = 'student_database_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
```

**Impact**:
- Load time: 2-5s → 0.1-0.5s (10x faster)
- API calls reduced by ~95%
- Cache invalidation: Manual via `chrome.storage.local.remove(['student_database_cache'])`

### 2. Search Debouncing
**Problem**: Search query on every keystroke causes lag

**Solution**:
```javascript
let searchTimeout;
function handleSearchInput(query) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => performSearch(query), 300);
}
```

**Impact**: Reduced operations by ~70% when typing

### 3. MMS ID Direct Lookup
**Problem**: Searching 489 students by name in MyMusicStaff (2-3s, error-prone)

**Solution**: Store MMS student IDs in Google Sheets, use direct lookup when available

**Implementation**:
```javascript
if (student.mms_id) {
  // Direct lookup - instant
  studentId = student.mms_id;
} else {
  // Fallback: Name search - slow
  studentId = await findMyMusicStaffStudentId(student);
}
```

**Impact**:
- Student lookup: 2-3s → 0.5s
- Eliminates name matching errors (multiple students with same name)
- Fallback ensures system works even without MMS IDs

### 4. Intelligent Search Sorting
**Algorithm**: Prioritize matches by relevance
1. First name starts with query
2. Last name starts with query
3. Full name starts with query
4. Alphabetical

**Example**: Searching "al" shows "Alex Chang" before "Stephen MacDonald"

## Authentication

### MyMusicStaff API Token
**Source**: Dashboard API key (never expires)

**Token**: `eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9...`

**Usage**: Hardcoded in `content-script.js` (line 9-10)

**Note**: Internal tool for 2 users, hardcoded keys acceptable for convenience

### Stripe API Key
**Type**: Restricted live key

**Key**: `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`

**Permissions**: Subscriptions read/write only

**Usage**: Hardcoded in `content-script.js` (line 13-14)

## Data Flow Diagrams

### Student Search Flow
```
1. User types in search box
   ↓
2. Debounce (300ms wait)
   ↓
3. Check cache (chrome.storage.local)
   ↓
4. If cache valid (< 24h): Use cached data
   If cache invalid: Fetch from Google Sheets → Cache result
   ↓
5. Filter students by query
   ↓
6. Sort by relevance (first name → last name → full name)
   ↓
7. Display results (max 10)
```

### Payment Pause Execution Flow
```
1. User clicks "Full Automation"
   ↓
2. Validate inputs (student, dates)
   ↓
3. Send message to content script
   ↓
4. Content Script:
   a. Find student ID (MMS ID or search)
   b. Create calendar blocks in MyMusicStaff
   c. Find Stripe subscription ID
   d. Pause Stripe subscription
   ↓
5. Return success/error to popup
   ↓
6. Show confirmation + WhatsApp message template
```

## Error Handling

### Retry Logic with Exponential Backoff
```javascript
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry auth errors (401, 403, 400)
      if (error.message.includes('401') ||
          error.message.includes('403') ||
          error.message.includes('400')) {
        throw error;
      }

      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i); // 1s, 2s, 4s
      await sleep(delay);
    }
  }
}
```

**Retryable Errors**: Network timeouts, 5xx server errors

**Non-Retryable**: 401 (auth), 403 (permission), 400 (bad request)

### Common Errors & Solutions

**Error**: "Content script not loaded"
- **Cause**: MyMusicStaff page not open or needs refresh
- **Fix**: Open MyMusicStaff, log in, hard refresh (Ctrl+Shift+R), reload extension

**Error**: "401 Unauthorized"
- **Cause**: API token expired or invalid
- **Fix**: Update `MMS_API_TOKEN` in content-script.js with fresh token from dashboard

**Error**: "Cache expired" or stale data
- **Cause**: Student data changed in Google Sheets
- **Fix**: Clear cache: `chrome.storage.local.remove(['student_database_cache'])`

## Current Limitations

1. **No Future-Dated Pauses**: Can only pause subscriptions starting immediately
   - **Planned Fix**: Implement Stripe Subscription Schedules (3-phase system)

2. **Manual WhatsApp Messaging**: Extension generates message, admin copies and sends
   - **Future**: Could integrate WhatsApp Business API for automation

3. **Single School**: Hardcoded for First Chord (school_id: sch_Fx5JQ)
   - **Note**: By design, internal tool only

4. **No Conflict Detection**: Doesn't check if pause overlaps existing calendar blocks
   - **Low Priority**: Admins review preview before execution

## File Structure

```
Payment Pause Extension/
├── manifest.json                      # Extension config (Manifest V3)
├── adminpanel.html                    # Popup UI
├── adminpanel.js                      # Popup logic (2,157 lines)
├── content-script.js                  # API handler (1,234 lines)
├── debug-panel.js                     # Diagnostic tool
├── UPDATED_GOOGLE_APPS_SCRIPT.js      # Google Sheets API backend
├── ARCHITECTURE.md                    # This file
├── CONTRIBUTING.md                    # Development guidelines
├── DEVELOPMENT_PROTOCOL.md            # Rules for future work
└── README.md                          # User guide
```

## Future Enhancements (Planned)

### 1. Stripe Subscription Schedules for Future Pauses
**Use Case**: Pause a lesson 2 weeks in the future

**Implementation**: 3-phase schedule
- Phase 1: Active billing (now → pause start)
- Phase 2: Paused (pause start → pause end)
- Phase 3: Active billing (pause end → ongoing)

**UI Changes**:
- Detect if start date is future vs today
- Show appropriate confirmation messaging
- Handle both immediate and future pauses

**Stripe API**:
- `POST /v1/subscription_schedules` - Create schedule
- `GET /v1/subscription_schedules/{id}` - Check status
- `POST /v1/subscription_schedules/{id}/release` - Cancel schedule if needed

### 2. Bulk Operations
**Use Case**: Pause all students during school break

**UI**: Multi-select student list + date range

**Challenges**: Rate limiting, error handling for partial failures

## Testing Guidelines

### Manual Testing Checklist
1. **Student Search**:
   - [ ] Search by first name (e.g., "Alex")
   - [ ] Search by last name (e.g., "Chang")
   - [ ] Search with partial match (e.g., "al")
   - [ ] Verify sorting (matches starting with query appear first)

2. **Date Selection**:
   - [ ] Default dates populate (today + 1 week)
   - [ ] Can select past dates (should show warning)
   - [ ] Can select future dates

3. **Preview Mode**:
   - [ ] Shows student name, dates, tutor
   - [ ] Shows calendar blocks to be created
   - [ ] Shows Stripe subscription pause details

4. **Execution (MyMusicStaff Only)**:
   - [ ] Creates calendar blocks
   - [ ] Doesn't touch Stripe subscription
   - [ ] Shows success message

5. **Execution (Full Automation)**:
   - [ ] Creates calendar blocks in MMS
   - [ ] Pauses Stripe subscription
   - [ ] Generates WhatsApp message
   - [ ] Shows copy button for message

6. **Error Scenarios**:
   - [ ] No student selected → Shows error
   - [ ] No dates selected → Shows error
   - [ ] MyMusicStaff not open → Shows "content script not loaded"
   - [ ] Student not found → Shows "student not found in MyMusicStaff"

### Test Students
- **Alex Chang** (mms_id: sdt_gwyQJr) - Known working student with Stripe subscription
- **Test Student** - Use for non-production testing

## Deployment

### Installation (For Business Partner)
1. Download extension folder (zip file)
2. Open Chrome → Extensions → Enable Developer Mode
3. Click "Load unpacked" → Select extracted folder
4. Pin extension to toolbar
5. Open MyMusicStaff and log in
6. Click extension icon to use

**No Additional Setup Required**: All API keys are hardcoded for convenience

### Updating After Code Changes
1. Make changes to files
2. Go to Chrome Extensions page
3. Click reload icon on "First Chord Payment Pause Manager"
4. Hard refresh MyMusicStaff page (Ctrl+Shift+R)
5. Test changes

### Updating Google Sheets Data
1. Add/edit students in spreadsheet: `1Rn6fJEkT3-vTFfOTyanp1AJDzfxPpx9REWGQ-WK8Q2o`
2. Clear extension cache: `chrome.storage.local.remove(['student_database_cache'])`
3. Reopen extension popup to fetch fresh data

**Google Apps Script Changes**:
1. Open spreadsheet → Extensions → Apps Script
2. Update `Code.gs` with new code
3. Deploy → New deployment → Update existing deployment
4. No changes needed in extension (URL stays the same)

## Security Considerations

### For Internal Use Only
- 2 users (admin + business partner)
- Hardcoded API keys acceptable
- No public distribution
- No sensitive data exposure (student data already accessible to admins)

### What's Hardcoded
- MyMusicStaff API token (content-script.js:9-10)
- Stripe API key (content-script.js:13-14)
- Google Sheets API endpoint (adminpanel.js:28)
- School ID (content-script.js:489)

### If Publishing Publicly (Not Planned)
Would need:
- Configuration UI for API keys
- OAuth flow for MyMusicStaff
- Encrypted storage for credentials
- Multi-school support
- User permissions/roles

## Key Design Decisions

### Why Chrome Extension?
- Needs access to MyMusicStaff authenticated session
- Popup UI is convenient for quick operations
- Can run in background (future: scheduled pauses)

### Why Google Sheets as Database?
- Non-technical staff can update student data
- No backend infrastructure needed
- Free, reliable, familiar interface
- Apps Script provides simple API

### Why Hardcoded API Keys?
- Internal tool (2 users)
- Faster setup for business partner
- No configuration UI needed
- Keys already shared via secure channels

### Why 24-Hour Cache?
- Student data changes infrequently (weekly at most)
- Balance between performance and freshness
- Manual cache clear available for urgent updates

### Why Content Script vs Background Script?
- Content scripts have access to page context (auth tokens)
- Can intercept/modify network requests if needed
- Background scripts can't make authenticated API calls

## Support & Troubleshooting

### Debug Panel
Open `debug-panel.html` to:
- View student database (first 10)
- Test content script connection
- Check token validity
- See detailed console logs

### Console Logging
All operations are logged with emoji prefixes:
- 🔄 Loading/processing
- ✅ Success
- ❌ Error
- ⚠️ Warning
- 📡 Network request
- 🔑 Authentication

**Enable verbose logging**: Open DevTools → Console → Check "Preserve log"

### Common Issues

**Students not appearing in search**:
1. Check console for "Loaded X students from cache"
2. If count is 0, clear cache and retry
3. Test Google Sheets endpoint directly in browser
4. Verify Apps Script is deployed

**Stripe pause not working**:
1. Check student has active Stripe subscription
2. Verify Stripe API key has subscription permissions
3. Check console for Stripe error messages
4. Test Stripe API key via curl/Postman

**Calendar blocks not created**:
1. Verify MyMusicStaff tab is open and logged in
2. Check MMS API token is valid
3. Ensure student exists in MyMusicStaff
4. Check console for "Creating calendar block" messages

---

**Last Updated**: January 2025
**Version**: 1.0 (MMS ID Implementation Complete)
**Next Milestone**: Stripe Subscription Schedules for Future Pauses
