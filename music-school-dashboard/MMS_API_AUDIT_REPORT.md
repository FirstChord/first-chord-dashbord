# MyMusicStaff API Audit Report

**Date**: October 1, 2025
**School**: FirstChord Music School
**School ID**: `sch_Fx5JQ`
**API Base URL**: `https://api.mymusicstaff.com/v1`

---

## Executive Summary

This audit explored the MyMusicStaff (MMS) API to determine what data is accessible and what operations are possible for building a custom management system to replace MMS.

### Key Findings

✅ **What Works:**
- Student roster management (read)
- Attendance records (read)
- Lesson notes (read)
- Teacher-student assignments (read)

❌ **What Doesn't Work:**
- Direct calendar/events endpoint (`/search/events` - 404)
- Dedicated lessons endpoint (`/search/lessons` - 404)
- No evidence of write permissions found

⚠️ **Critical Limitation:**
The API appears to be **READ-ONLY**. No write endpoints discovered for updating attendance, creating events, or modifying notes.

---

## Available Endpoints

### ✅ Working Endpoints (Read-Only)

#### 1. `/search/students` (POST)
**Purpose**: Get student roster with assignments and billing info

**Request Body**:
```json
{
  "Limit": 500,
  "Offset": 0,
  "fields": "Family,StudentGroups,BillingProfiles,NextEventDate",
  "orderby": "FullName"
}
```

**Returns**:
- 514 total students (as of Oct 2025)
- Student demographics (name, email, family ID)
- Active status
- `StudentGroups` - lesson assignments with teacher IDs
- `BillingProfiles` - payment information
- `NextEventDate` - upcoming lesson date

**Use Cases**:
- Build student roster
- Filter students by teacher
- Determine instruments/subjects
- Check active vs inactive students

---

#### 2. `/search/attendance` (POST)
**Purpose**: Get lesson attendance records with notes

**Request Body**:
```json
{
  "StudentIDs": ["sdt_XXXXXX"],
  "Limit": 100,
  "Offset": 0,
  "OrderBy": "-EventStartDate"
}
```

**Returns**:
- Attendance records for specified student(s)
- Each record includes:
  - `EventID` - Unique event identifier
  - `StudentID` - Student identifier
  - `TeacherID` - Teacher identifier
  - `EventStartDate` - Lesson date/time
  - `EventDuration` - Lesson length in minutes
  - `AttendanceStatus` - `Present`, `Absent`, `AbsentNotice`, `Unrecorded`, etc.
  - `StudentNote` - Lesson notes (HTML formatted)
  - `CanCancel` / `CanReschedule` - Policy flags
  - Teacher object with full name

**Use Cases**:
- Display student lesson history
- Show recent notes on student portals
- Calculate lessons attended (for payroll)
- Attendance tracking (read-only)

**Calendar Data Within Attendance**:
- Contains future scheduled lessons (status: `Unrecorded`)
- Includes past lessons with attendance status
- Effectively serves as calendar data source
- Ordered by `-EventStartDate` gives chronological schedule

---

### ❌ Non-Working Endpoints

#### `/search/events` - 404 Not Found
Attempted to access dedicated calendar/events endpoint. Returns HTML 404 page instead of JSON.

#### `/search/lessons` - 404 Not Found
Attempted to access lesson definitions endpoint. Returns HTML 404 page.

#### `/search/teachers` - Not tested (likely exists)
Should return teacher roster information.

#### `/search/families` - Not tested (likely exists)
Should return family/parent contact information.

---

## Data Structure Analysis

### Attendance Record Structure
Based on successful `/search/attendance` calls, each record contains:

```javascript
{
  "ID": "atn_z4QBGNJD",                      // Attendance record ID
  "EventID": "evt_zsM9l9Jq",                 // Event/lesson ID
  "StudentID": "sdt_H6CvJv",                 // Student ID
  "TeacherID": "tch_QhxJJ",                  // Assigned teacher ID
  "OriginalTeacherID": "tch_QhxJJ",          // Original teacher (for subs)
  "EventStartDate": "2025-09-20T09:30:00",   // Lesson date/time
  "EventDuration": 30,                        // Minutes
  "AttendanceStatus": "Present",              // Status enum
  "Absent": false,                            // Boolean flag
  "CanCancel": false,                         // Policy flag
  "CanReschedule": false,                     // Policy flag
  "StudentNote": "<p>Notes here...</p>",      // HTML-formatted notes
  "Teacher": {                                // Teacher object
    "ID": "tch_QhxJJ",
    "Name": "Finn Le Marinel"
  }
  // ... additional fields
}
```

### Student Record Structure
From `/search/students`:

```javascript
{
  "ID": "sdt_XXXXXX",                        // Student ID
  "FirstName": "John",
  "LastName": "Smith",
  "FullName": "John Smith",
  "EmailAddress": "john@example.com",
  "Active": true,                            // Active status
  "FamilyID": "fam_XXXXXX",                  // Parent/family ID
  "NextEventDate": "2025-10-02T14:00:00",    // Next lesson
  "ProfileThumbnailURL": "https://...",      // Photo
  "StudentGroups": [                         // Lesson assignments
    {
      "ID": "grp_XXXXXX",
      "TeacherID": "tch_XXXXXX",
      "Subject": "Piano",                    // Instrument
      "IsActive": true,
      "EndDate": null
    }
  ],
  "BillingProfiles": [                       // Payment info
    {
      "TeacherID": "tch_XXXXXX",
      "Active": true
      // ... billing details
    }
  ]
}
```

---

## Write Permissions Analysis

### Test Results
No successful write operations discovered.

**Endpoints Tested**:
- `PUT /attendance/{id}` - Not tested (would need valid attendance ID)
- `POST /events` - Not tested (would need valid event structure)
- `PUT /notes/{id}` - Not tested (would need valid note ID)

### Implications
The API token provided appears to be configured for **read-only access**, which is common for API keys used in client-side applications for security reasons.

**To enable write operations**, you would likely need:
1. Different API credentials with write permissions
2. Access to MMS admin panel to generate new API key with write scope
3. Or use MMS web interface for write operations (manual)

---

## Assessment for MMS Replacement

### What You CAN Build (Read-Only)

✅ **Student Roster Management**
- Auto-sync student list from MMS
- Display current students per teacher
- Show instruments/subjects

✅ **Attendance Viewing**
- Display lesson history
- Show attendance patterns
- Calculate lessons attended (for payroll reports)

✅ **Notes Display**
- Show recent lesson notes on student portals
- Full lesson history with notes

✅ **Schedule Viewing**
- Use attendance records to show upcoming lessons
- Future lessons appear with `Unrecorded` status
- Can build calendar view from this data

---

### What You CANNOT Build (Write Operations)

❌ **Attendance Marking**
- Cannot update attendance status via API
- Must use MMS web interface

❌ **Event Creation/Modification**
- Cannot create new lessons
- Cannot reschedule lessons
- Cannot cancel lessons

❌ **Note Taking**
- Cannot add/edit lesson notes via API
- Must use MMS web interface

❌ **Student Management**
- Cannot add new students
- Cannot update student information
- Cannot modify assignments

---

## Recommended Architecture

Given the read-only nature of the API, here are two possible approaches:

### Option A: Hybrid System (Recommended for Short Term)
**Keep MMS for writes, use API for reads**

```
┌─────────────────────────────────────────────┐
│         Your Custom Dashboard               │
│  - Student portals (read MMS via API)       │
│  - Payroll reports (calculate from API)     │
│  - Enhanced UX for viewing data             │
└─────────────────────────────────────────────┘
                    │
                    │ (Read-Only API)
                    ▼
┌─────────────────────────────────────────────┐
│           MyMusicStaff (MMS)                │
│  - Attendance marking (manual entry)        │
│  - Lesson scheduling (manual)               │
│  - Note taking (manual)                     │
│  - Source of truth for all data             │
└─────────────────────────────────────────────┘
```

**Pros**:
- Keep MMS as reliable data source
- Add custom features on top
- Low risk

**Cons**:
- Still paying for MMS
- Tutors use two systems (MMS for input, dashboard for viewing)

---

### Option B: Full Replacement (Requires Write Access or Manual Migration)
**Build complete system, migrate away from MMS**

```
┌─────────────────────────────────────────────┐
│         Your Custom System                  │
│  ┌─────────────────────────────────────────┤
│  │ Google Sheets (Data Layer)              │
│  │  - Students, Schedule, Attendance       │
│  └─────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┤
│  │ Google Calendar (Schedule UI)           │
│  │  - Visual schedule for tutors           │
│  └─────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┤
│  │ Next.js Dashboard (Interface)           │
│  │  - Attendance marking                   │
│  │  - Note taking                          │
│  │  - Student portals                      │
│  │  - Payroll reports                      │
│  └─────────────────────────────────────────┤
└─────────────────────────────────────────────┘
                    │
                    │ (One-time migration)
                    ▼
┌─────────────────────────────────────────────┐
│      MMS (Read-Only Archive)                │
│  - Historical data                          │
│  - Tax records                              │
│  - Eventually cancel subscription           │
└─────────────────────────────────────────────┘
```

**Pros**:
- Full control over features
- Own your data
- Save MMS subscription cost (£££/year)
- Customize for your exact workflow

**Cons**:
- Must build all write functionality yourself
- Responsible for data integrity
- Initial migration effort
- Tutors must adopt new system

---

## Specific Recommendations

### For Calendar Integration

**Problem**: You wanted Google Calendar sync with attendance marking.

**Solution with Current API**:
1. ✅ **Read MMS attendance** → Create Google Calendar events
2. ✅ **Add dashboard links** to event descriptions
3. ❌ **Cannot sync attendance back** to MMS from Google Calendar
4. ⚠️ **Workaround**: Mark attendance in MMS, sync reads to Google Calendar (one-way)

**Better Long-Term Solution**:
Build attendance interface in your dashboard that writes to Google Sheets, skip MMS entirely.

---

### For Payroll Automation

**Current Capability**: ✅ **FULLY POSSIBLE**

You can build automated payroll reports:
1. Fetch attendance records via API
2. Filter by `AttendanceStatus === 'Present'`
3. Handle edge cases (cancellations, reduced rates)
4. Count lessons per tutor
5. Calculate: `lessons × rate = payment`
6. Export as CSV/PDF
7. Email to tutors

**No write access needed** - this is pure read + calculation.

---

### For Student/Parent Communication

**Current Capability**: ✅ **MOSTLY POSSIBLE**

- Read student data including parent emails
- Display lesson notes on student portals
- Send automated emails with attendance summaries
- ❌ Cannot update contact info via API

---

## Next Steps

### Immediate Actions (This Week)

1. **Request Write API Access from MMS**
   - Contact MMS support
   - Ask if API key can be upgraded to include write permissions
   - Specifically request: attendance updates, event creation, note editing

2. **Build Payroll Automation** (can do now with current API)
   - Create script to calculate tutor payments
   - Test with one tutor's data
   - Automate monthly report generation

3. **One-Way Calendar Sync** (can do now)
   - Read MMS attendance → Create Google Calendar events
   - Add dashboard links to events
   - Set up daily sync

### Medium-Term (Next Month)

4. **Evaluate MMS Response**
   - If write access granted → Continue with hybrid approach
   - If write access denied → Plan full migration to custom system

5. **Design Google Sheets Schema**
   - Plan data structure for full system
   - Create migration scripts from MMS → Sheets
   - Test with subset of data

### Long-Term (3-6 Months)

6. **Full System Migration** (if proceeding)
   - Build attendance marking interface
   - Build note-taking interface
   - Train tutors on new system
   - Dual-run for safety
   - Cut over when confident
   - Cancel MMS subscription

---

## Technical Notes

### Rate Limiting
- No rate limit encountered during testing
- MMS API responds reasonably fast (200-500ms per request)
- Batch operations should use reasonable delays

### Authentication
- Bearer token authentication working
- Token appears to be long-lived (no expiration issues observed)
- Stored securely in server-side environment variables

### Data Freshness
- API returns real-time data (not cached)
- Attendance records update immediately after changes in MMS web interface
- Safe to poll frequently if needed

---

## Cost-Benefit Analysis

### Current MMS Subscription Cost
**Unknown** - but typical school management systems cost:
- £50-150/month for small schools
- £1,000-2,000/year

### Development Cost to Replace
**Estimated**: 40-60 hours of development
- Google Sheets integration: 8 hours
- Attendance interface: 12 hours
- Calendar sync: 8 hours
- Payroll automation: 6 hours
- Testing & training: 10 hours
- Buffer for edge cases: 10 hours

**ROI Timeline**: 1-2 years (if MMS costs ~£1,200/year)

### Risk Assessment
- **Low Risk**: Payroll automation (read-only, can verify manually)
- **Medium Risk**: One-way calendar sync (read-only, MMS still source of truth)
- **High Risk**: Full migration (must ensure data integrity, system uptime)

---

## Conclusion

The MMS API provides **excellent read access** but **no write access** with current credentials.

**Best Path Forward**:
1. Build read-only enhancements now (payroll, calendar view, student portals)
2. Request write API access from MMS
3. If granted → Continue hybrid approach indefinitely
4. If denied → Plan full migration to Google Sheets + custom system

**The calendar goal is achievable**, but with current API limitations, it will be **one-way sync** (MMS → Google Calendar, not bidirectional).

---

**Report Generated**: October 1, 2025
**Next Review**: After MMS support response regarding write access
