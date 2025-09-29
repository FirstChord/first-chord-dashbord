# 🔍 Notes Edge Case Protocol

## Problem Identified
**Date**: 2025-01-19  
**Issue**: Some student portals show outdated lesson notes while teachers can see recent notes in MMS UI.

## Root Cause Analysis

### The Pattern
All students have future scheduled lessons (2025-2027) with "Unrecorded" status that are returned first by MMS API due to `-EventStartDate` ordering. However:

- **Working students**: Their recent lesson notes are stored in these future scheduled lesson records
- **Broken students**: Their recent lesson notes are NOT in future scheduled lessons, only in older "Present" status records

### Affected Students
- **Sadie Lowe** (`sdt_D9ftJB`) - Tom's student - ✅ FIXED: Now shows 2025-09-18
- **Arnav Rekhate** (`sdt_BDHFJM`) - Finn's student - ✅ FIXED: Now shows 2025-09-19
- **Charlie Norton** (`sdt_417JJ3`) - Tom's student - ✅ FIXED: Now shows 2025-09-18

### Working Students (Control Group)
- **Mathilde Thallon** (`sdt_H6CvJv`) - Finn's student - Latest notes: 2025-09-13

## Technical Details

### Current Algorithm Issue
```javascript
// Current logic in mms-client.js - extractNotesFromAttendance()
for (const record of attendanceRecords) {
  if (record.StudentNote && record.StudentNote.trim() !== '') {
    return record; // Returns FIRST record with notes
  }
}
```

**Problem**: This finds the first record with any notes, which could be:
1. Future scheduled lessons (works for some students)
2. Old completed lessons (fails for affected students)

### MMS API Data Structure
```javascript
// Attendance records ordered by -EventStartDate (newest first)
[
  { date: "2027-10-14", status: "Unrecorded", notes: null },     // Future lesson
  { date: "2027-10-07", status: "Unrecorded", notes: null },     // Future lesson
  // ... many future lessons ...
  { date: "2025-09-13", status: "Present", notes: "Recent!" },   // Some students have notes here
  { date: "2024-05-02", status: "Present", notes: "Old notes" }  // Others only have notes here
]
```

## Solution Protocol

### Step 1: Enhanced Note Detection Algorithm
Implement a two-phase search:

1. **Phase 1**: Look for notes in completed lessons (`Present`, `AbsentNotice` status) from the past 6 months
2. **Phase 2**: If no recent completed lessons found, fall back to current algorithm (any record with notes)

### Step 2: Implementation
```javascript
extractNotesFromAttendance(attendanceRecords, options = {}) {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
  
  // Phase 1: Look for recent completed lessons
  const completedStatuses = ['Present', 'AbsentNotice', 'AbsentNoMakeup'];
  const recentCompletedLessons = attendanceRecords.filter(record => {
    const recordDate = new Date(record.EventStartDate);
    return completedStatuses.includes(record.AttendanceStatus) && 
           recordDate >= sixMonthsAgo && 
           recordDate <= now;
  });
  
  // Find most recent completed lesson with notes
  for (const record of recentCompletedLessons) {
    if (record.StudentNote && record.StudentNote.trim() !== '') {
      return this.formatNoteResponse(record);
    }
  }
  
  // Phase 2: Fall back to current algorithm for edge cases
  return this.currentAlgorithm(attendanceRecords);
}
```

### Step 3: Testing Protocol
1. Test with affected students (Sadie, Arnav)
2. Verify working students still work (Mathilde)
3. Test edge cases (students with no recent lessons)

### Step 4: Deployment
1. Implement changes in `mms-client.js`
2. Test locally with all student types
3. Deploy and monitor

## Protocol Usage Results

### Charlie Norton Investigation (2025-01-19)
Applied protocol successfully to Tom's student Charlie Norton:

**Pattern Detection**: ✅ CONFIRMED edge case pattern
- 108 future scheduled lessons blocking recent notes
- 14 recent completed lessons with actual notes  
- Latest notes from 2025-09-18 (recent)
- Edge case pattern detected by protocol

**Fix Verification**: ✅ WORKING
- Enhanced algorithm correctly prioritized recent completed lesson
- Portal now shows September 18th notes about "major 7 chords" and "Brazil"
- All integrations (Soundslice, Theta Music) functioning properly

**Conclusion**: Protocol successfully identified and our enhanced algorithm fixed Charlie's case automatically.

## Prevention
- Protocol now proven effective for detection and verification
- Enhanced algorithm handles both edge cases and normal scenarios
- Monitor for additional students with similar patterns using this protocol

## Teacher ID Discovery Protocol

### How to Find MMS Teacher IDs
**Method**: Use MMS Payroll Network Console Inspection

**Steps**:
1. Log into MMS admin panel
2. Navigate to the teacher's profile
3. Click on their "Payroll" section
4. Open browser Network Console (F12 → Network tab)
5. Check the "Payload" tab in the network requests
6. The teacher ID will appear in the network requests (format: `tch_XXXXXX`)

**Example**: Kenny Bates → Payroll → Network Console → `tch_zsyfJr`

**Implementation**: Update teacher ID mappings in `/lib/mms-client.js`:
```javascript
// Replace placeholder with real ID
'Kenny': 'tch_placeholder_kenny', // OLD
'Kenny': 'tch_zsyfJr',            // NEW
```

## Notes
- MMS system has inconsistent note storage patterns between students
- Enhanced algorithm is backward compatible and maintains performance
- Protocol can be applied systematically to investigate any reported issues
- Teacher ID discovery via payroll network console is reliable and consistent