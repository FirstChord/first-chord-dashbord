# Google Sheets Setup Guide - Testing Phase

**Status**: ✅ Sync layer built and tested
**Current Mode**: Fallback to config files (safe)
**Next Step**: Create Google Sheet and connect it

---

## What We've Built

### 1. Google Sheets Sync Layer (`lib/google-sheets-sync.js`)
✅ Reads from Google Sheets (when configured)
✅ Falls back to config files automatically
✅ Caches data for 5 minutes
✅ Zero risk - existing system works if Sheet fails

### 2. Test Script (`test-google-sheets-fallback.js`)
✅ Confirms fallback mechanism works
✅ Can test full integration once Sheet is created

---

## Current Status

**Google Sheets Integration**: ❌ Not configured
**Fallback to Config Files**: ✅ Working
**Dashboard Functionality**: ✅ Unchanged

**This means**: Everything works exactly as before. The sync layer exists but isn't active yet.

---

## Next Steps to Enable Google Sheets

### Step 1: Create the Google Sheet

1. Go to Google Sheets: https://sheets.google.com
2. Create new spreadsheet named "FirstChord Dashboard Data"
3. Create 4 sheets (tabs):
   - **Students**
   - **Tutors**
   - **Instruments**
   - **Config**

### Step 2: Add Headers

**Students Sheet (Row 1):**
```
StudentID | FirstName | LastName | FriendlyURL | TutorName | Instrument | SoundsliceURL | ThetaUsername | Active | Notes
```

**Tutors Sheet (Row 1):**
```
TutorName | ShortName | TeacherID | HourlyRate | DefaultInstrument | Active | Email
```

**Instruments Sheet (Row 1):**
```
StudentID | Instrument | Notes
```

**Config Sheet (Row 1):**
```
Key | Value | Description
```

### Step 3: Copy Sample Data

I can help you migrate existing student data to the Sheet. For now, you can manually add a few test students like:

**Students example (Row 2):**
```
sdt_H6CvJv | Mathilde | Thallon | mathilde | Finn | Piano | https://www.soundslice.com/courses/9009/ | mathildefc | TRUE | Test student
```

**Tutors example (Row 2):**
```
Finn Le Marinel | Finn | tch_QhxJJ | 24 | Piano | TRUE | finn@firstchord.co.uk
```

### Step 4: Get Sheet ID

From your Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
                                         ^^^^^^^^^^
                                     Copy this part
```

### Step 5: Configure Environment Variables

Add to `.env.local`:
```bash
GOOGLE_SHEET_ID=your_sheet_id_here
USE_GOOGLE_SHEETS=false  # Set to 'true' when ready to test
```

### Step 6: Set Up Authentication (Later)

For now, we'll keep it simple. When you're ready to actually connect:

1. Create Google Cloud Project
2. Enable Google Sheets API
3. Create Service Account
4. Download credentials JSON
5. Share Sheet with service account email

---

## Testing Plan

### Phase 1: Manual Testing (Current)
- ✅ Verify fallback works
- ✅ Confirm existing dashboard functions
- Create Google Sheet manually
- Add sample data

### Phase 2: Connection Testing
- Set up Google authentication
- Enable `USE_GOOGLE_SHEETS=true`
- Test data loads from Sheet
- Verify fallback still works if Sheet unavailable

### Phase 3: Full Migration
- Migrate all 177+ students to Sheet
- Migrate all 15 tutors to Sheet
- Test payroll reports with Sheet data
- Test student portals with Sheet data

### Phase 4: Partner Training
- Show partner how to edit Sheet
- Document common operations
- Set up Sheet permissions

---

## Safety Features

### What Happens If...

**❓ Google Sheets API is down?**
✅ Dashboard falls back to config files automatically

**❓ Sheet has bad data?**
✅ Validation can be added, fallback works

**❓ Someone deletes the Sheet?**
✅ Config files still exist as backup

**❓ Authentication fails?**
✅ Logs warning, uses fallback

---

## File Structure

```
music-school-dashboard/
├── lib/
│   ├── google-sheets-sync.js        # NEW - Sync layer
│   ├── student-url-mappings.js      # EXISTING - Fallback
│   ├── student-helpers.js           # EXISTING - Fallback
│   ├── soundslice-mappings.js       # EXISTING - Fallback
│   └── config/
│       ├── theta-credentials.js     # EXISTING - Fallback
│       └── instruments.js           # EXISTING - Fallback
├── test-google-sheets-fallback.js   # NEW - Test script
├── GOOGLE_SHEETS_SCHEMA.md          # NEW - Sheet design
└── GOOGLE_SHEETS_SETUP_GUIDE.md     # NEW - This file
```

---

## Benefits Once Connected

### For Your Partner
- ✅ Edit Google Sheet cells (like Excel)
- ✅ No code knowledge needed
- ✅ See all data in one place
- ✅ Add students via copy/paste rows
- ✅ Share with admin staff

### For You
- ✅ Edit Sheet OR config files (your choice)
- ✅ Bulk operations via Sheet formulas
- ✅ Export/import easily
- ✅ Version history in Google Sheets
- ✅ Keep git history for code

### For System
- ✅ No downtime (fallback exists)
- ✅ Easy backups (export Sheet)
- ✅ Multi-user collaboration
- ✅ Audit trail of changes

---

## Current Functionality Test

Want to verify everything still works? Run:

```bash
# Test sync layer
node test-google-sheets-fallback.js

# Test dashboard locally
npm run dev
# Visit: http://localhost:3000

# Test student portal
# Visit: http://localhost:3000/mathilde
```

All should work exactly as before!

---

## Summary

**What's Done:**
- ✅ Sync layer built
- ✅ Fallback mechanism tested
- ✅ Safe to deploy (no breaking changes)
- ✅ Schema designed
- ✅ Documentation written

**What's Next (Optional - When You're Ready):**
- Create Google Sheet
- Add sample data
- Set up authentication
- Enable Sheet integration
- Test with real data

**Can I still use config files?**
✅ Yes! Forever. The Sheet is an *option*, not a requirement.

**Will this break anything?**
❌ No. It's designed to be 100% backward compatible.

**When should I enable it?**
Whenever you're ready. No rush. The foundation is there when you need it.

---

Need help with any of these steps? Just ask!
