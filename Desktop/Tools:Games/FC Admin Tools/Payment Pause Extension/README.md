# First Chord Payment Pause Manager

Chrome extension to automate student payment pauses across MyMusicStaff and Stripe for First Chord Music School.

## Quick Start

### Installation
1. Download the extension folder
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" → Select the extension folder
5. Pin extension to toolbar for easy access

### First Use
1. Open [MyMusicStaff](https://app.mymusicstaff.com) and log in
2. Click the extension icon in Chrome toolbar
3. Extension popup will appear - you're ready to go!

## How to Use

### Pausing a Student's Lessons

1. **Find Student**
   - Type student's first or last name in the search box
   - Results appear as you type
   - Click on the correct student from the dropdown

2. **Set Dates**
   - Start Date: First day of the pause
   - End Date: Last day of the pause
   - Choose a reason (optional): Holiday, Tutor Away, School Break, Other

3. **Preview Changes**
   - Click "Preview Changes" button
   - Review what will happen:
     - MyMusicStaff calendar blocks
     - Stripe subscription pause (if using Full Automation)
     - Student and tutor details

4. **Execute**
   - **MyMusicStaff Only**: Creates calendar blocks, doesn't touch Stripe
   - **Full Automation**: Creates calendar blocks + pauses Stripe subscription

5. **Notify Parent**
   - Extension generates WhatsApp message
   - Click "Copy Message" button
   - Paste into WhatsApp chat with parent

### Example Workflow

**Scenario**: Alex Chang is going on holiday from Jan 15-22

1. Search: "Alex"
2. Select: "Alex Chang (Sarah)"
3. Dates: Jan 15 to Jan 22
4. Reason: Student Holiday
5. Click "Preview Changes"
6. Verify: 1 week pause, tutor Sarah, subscription will pause
7. Click "Full Automation (MMS + Stripe)"
8. Copy WhatsApp message and send to parent

**Result**:
- MyMusicStaff shows blocked calendar for Jan 15-22
- Stripe subscription paused (prorated refund issued)
- Parent receives notification via WhatsApp

## Features

### 🔍 Smart Student Search
- Autocomplete as you type
- Searches first names, last names, and tutors
- Prioritizes exact matches (e.g., "Alex" shows Alex before Alexander)
- Cached for speed (loads in < 0.5s)

### 📅 Flexible Date Selection
- Default: Today + 1 week (convenient for quick entries)
- Supports any date range
- Validates end date is after start date

### 👀 Preview Mode
- See all changes before execution
- Shows student details, dates, calendar blocks
- Enables execute buttons only after preview

### 🤖 Two Automation Modes

**MyMusicStaff Only**:
- Creates calendar blocks for tutors
- Doesn't modify Stripe subscriptions
- Use when: Parent will handle payment pause themselves

**Full Automation (MMS + Stripe)**:
- Creates calendar blocks
- Pauses Stripe subscription
- Generates parent notification message
- Use when: Standard payment pause

### 💬 WhatsApp Message Generator
- Automatically creates professional parent notification
- Includes student name, dates, and payment info
- One-click copy to clipboard
- Paste into WhatsApp Business

## Troubleshooting

### "Content script not loaded" Error
**Cause**: MyMusicStaff page is not open or extension needs refresh

**Fix**:
1. Open MyMusicStaff in a tab and log in
2. Hard refresh the page (Ctrl+Shift+R / Cmd+Shift+R)
3. Go to `chrome://extensions/` and click reload icon on this extension
4. Try again

### Student Not Found
**Cause**: Student might not be in the database or name is misspelled

**Fix**:
1. Check spelling (try first name only, then last name only)
2. Verify student exists in Google Sheets database
3. If recently added, clear cache:
   - F12 → Console → Run: `chrome.storage.local.remove(['student_database_cache'])`
   - Reload extension

### "401 Unauthorized" Error
**Cause**: API token has expired or is invalid

**Fix**:
1. Contact admin to update API token in code
2. Reload extension after token is updated

### Dates Not Appearing
**Cause**: JavaScript error or cache issue

**Fix**:
1. Reload extension (`chrome://extensions/` → reload icon)
2. Hard refresh MyMusicStaff page
3. Check console for errors (F12 → Console)

### Subscription Pause Fails
**Cause**: Student might not have active Stripe subscription

**Fix**:
1. Check Stripe dashboard for active subscription
2. Use "MyMusicStaff Only" mode if no Stripe subscription
3. Verify student email matches Stripe customer email

### Search Results Are Slow
**Cause**: Cache might have expired

**Fix**:
- First search after cache expiry takes 2-3 seconds (loading from Google Sheets)
- Subsequent searches are instant (< 0.5s)
- Cache lasts 24 hours, then auto-refreshes

## For Developers

### File Structure
```
Payment Pause Extension/
├── manifest.json                 # Extension configuration
├── adminpanel.html               # Popup UI
├── adminpanel.js                 # Main logic
├── content-script.js             # API integrations
├── debug-panel.js                # Diagnostic tool
├── UPDATED_GOOGLE_APPS_SCRIPT.js # Google Sheets backend
├── README.md                     # This file
├── ARCHITECTURE.md               # Technical documentation
├── CONTRIBUTING.md               # Development guide
└── DEVELOPMENT_PROTOCOL.md       # Rules and best practices
```

### Quick Development Guide

**Make Changes**:
1. Edit files in your code editor
2. Go to `chrome://extensions/`
3. Click reload icon on extension
4. If you modified content-script.js, also hard refresh MyMusicStaff page

**Test Changes**:
1. Click extension icon
2. Search for test student (e.g., "Alex Chang")
3. Preview and execute
4. Check console logs (F12 on popup)

**Commit Changes**:
```bash
git add .
git commit -m "feat: describe your changes"
```

### Key Technical Details

**Student Database**:
- Google Sheets (176 students)
- Cached for 24 hours
- Auto-refreshes when cache expires

**Authentication**:
- MyMusicStaff: JWT token from dashboard
- Stripe: Restricted API key (subscriptions only)
- Hardcoded in content-script.js (internal use only)

**Performance**:
- Student search: < 0.5s (cached)
- MyMusicStaff API: ~1s per student lookup
- Stripe API: ~1s to pause subscription
- Total execution: 2-3 seconds for full automation

**For detailed technical documentation, see:**
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design and data flow
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines
- [DEVELOPMENT_PROTOCOL.md](DEVELOPMENT_PROTOCOL.md) - Rules for future work

## Current Limitations

### No Future-Dated Pauses
**Limitation**: Can only pause subscriptions starting immediately (today)

**Example**: Can't schedule "pause starting in 2 weeks" today

**Workaround**:
1. Create calendar blocks now (MyMusicStaff Only mode)
2. Set reminder to pause Stripe subscription on start date
3. Come back and run Full Automation on that date

**Planned Fix**: Implementing Stripe Subscription Schedules (coming soon)

### Manual WhatsApp Messaging
**Limitation**: Must manually copy/paste message to WhatsApp

**Workaround**:
1. Click "Copy Message" button
2. Open WhatsApp web or mobile
3. Find parent chat
4. Paste message (Ctrl+V / Cmd+V)

**Future Enhancement**: WhatsApp Business API integration (not planned yet)

### Single School Only
**Limitation**: Hardcoded for First Chord Music School only

**Note**: By design - this is an internal tool, not a product

## FAQ

### Who can use this extension?
First Chord admin staff only (currently 2 people). Not for parents or tutors.

### Does this work on other music schools?
No, it's hardcoded for First Chord's MyMusicStaff account and Stripe account.

### Can I pause multiple students at once?
Not yet. Currently one student at a time. Bulk operations may be added in future.

### What happens to payment when I pause?
Stripe automatically issues a prorated refund for the unused days. When subscription resumes, billing continues as normal.

### Can I undo a pause?
Yes, but you'll need to:
1. Manually delete calendar blocks in MyMusicStaff
2. Manually resume subscription in Stripe dashboard
3. Future: May add "Unpause" button to extension

### How do I update student information?
Update the Google Sheets database. Extension will automatically pick up changes (within 24 hours, or clear cache for immediate update).

### Is student data secure?
Data is cached locally on your computer (chrome.storage.local). Only accessible to you. API keys are hardcoded (internal tool only - not for public distribution).

### Can I use this on Firefox or Safari?
No, it's Chrome-only (uses Chrome extension APIs). Could be ported to Firefox with some modifications, but Safari would be difficult.

## Changelog

### Version 1.0 (January 2025)
**MMS ID Implementation Complete**

**Features**:
- Student search with autocomplete
- Date selection with validation
- Preview mode before execution
- MyMusicStaff calendar block creation
- Stripe subscription pause/resume
- WhatsApp message generation
- 24-hour caching for performance
- Search debouncing (300ms)
- Retry logic for API calls (exponential backoff)
- MMS ID direct lookup (10x faster than name search)

**Performance**:
- Load time: 0.1-0.5s (cached)
- Search: < 300ms
- Execution: 2-3s (full automation)

**Supported**:
- 176 students
- 2 admin users
- MyMusicStaff API v1
- Stripe API 2023-10-16

**Known Issues**:
- No future-dated pauses (requires Subscription Schedules)
- No bulk operations
- No undo button (manual revert required)

### Coming Soon (Version 1.1)
**Planned Features**:
- Stripe Subscription Schedules (future-dated pauses)
- Smart date detection (auto-choose immediate vs scheduled pause)
- Improved error messages
- Undo/resume functionality

## Support

### For Users (Admin Staff)
**Issues**: Contact Finn (extension creator)

**Common Issues**:
- Search not working → Clear cache and reload
- Content script error → Refresh MyMusicStaff page
- Subscription pause fails → Check Stripe dashboard

### For Developers
**Documentation**:
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical design
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development workflow
- [DEVELOPMENT_PROTOCOL.md](DEVELOPMENT_PROTOCOL.md) - Rules and standards

**External Resources**:
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [MyMusicStaff API](https://app.mymusicstaff.com/api-documentation) (login required)
- [Stripe API Docs](https://stripe.com/docs/api)

## License

Internal use only - First Chord Music School.
Not licensed for distribution or use outside organization.

---

**Version**: 1.0
**Last Updated**: January 2025
**Maintainer**: Finn
**For**: First Chord Music School Internal Use
