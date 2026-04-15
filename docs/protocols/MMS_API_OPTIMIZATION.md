# MMS API Optimization Protocol

**Last Updated**: January 19, 2026

## Overview

This document describes the optimization strategy for fetching student data from the MyMusicStaff (MMS) API, which dramatically improves dashboard loading performance.

## Problem

Initial implementation was fetching **all students** from MMS (536 students, 117KB payload), then filtering client-side. This caused:
- Slow dashboard loading times (~13 seconds)
- Unnecessary data transfer
- Higher server costs
- Students with names alphabetically after position 500 were not appearing (pagination issue)

## Solution

### Three-Phase Optimization

#### Phase 1: Increase API Limit (Fixed Pagination Bug)
**Change**: Increased student fetch limit from 500 → 1000
```javascript
limit: '1000'  // Was: '500'
```

**Result**:
- Fixed missing students issue (e.g., Yarah Love now appears)
- Supports up to 1000 students
- Students with multiple teachers now correctly appear on all dashboards

#### Phase 2: Filter by Active Status (63% Reduction)
**Change**: Filter only active students server-side using MMS API format
```javascript
body: {
  IDs: [],
  SearchText: "",
  FirstName: null,
  LastName: null,
  Statuses: ["Active"],  // Server-side filter
  TeacherIDs: null,
  FamilyIDs: [],
  StudentGroupIDs: []
}
```

**Result**:
- Payload: 117KB → 43KB
- Students: 536 → 185
- 63% reduction in data transfer

#### Phase 3: Filter by Teacher (93% Total Reduction)
**Change**: Filter by specific teacher ID
```javascript
body: {
  IDs: [],
  SearchText: "",
  FirstName: null,
  LastName: null,
  Statuses: ["Active"],
  TeacherIDs: [teacherId],  // e.g., ["tch_C2bJ9"] for Fennella
  FamilyIDs: [],
  StudentGroupIDs: []
}
```

**Result**:
- Payload: 117KB → ~8-15KB
- Students: 536 → ~35 per teacher
- 93% total reduction in data transfer
- **~2-3 second load times** (down from 13 seconds)

## Implementation Location

**File**: `/lib/mms-client.js`
**Function**: `getStudentsForTeacher(tutorName)`
**Lines**: ~474-484

## Shared Students Support

The optimization correctly handles students with multiple teachers:
- Students with BillingProfiles for multiple teachers appear on all their teachers' dashboards
- Example: Yarah Love (sdt_QP01Jp) has lessons with both Fennella and Patrick
- The TeacherIDs filter returns students if they have an active BillingProfile with the specified teacher

## MMS API Request Format

The MMS `/search/students` endpoint requires this specific POST body structure:

```javascript
{
  IDs: [],                    // Filter by specific student IDs
  SearchText: "",             // Text search across student names
  FirstName: null,            // Filter by first name
  LastName: null,             // Filter by last name
  Statuses: ["Active"],       // Filter by status (Active/Inactive)
  TeacherIDs: [teacherId],    // Filter by teacher assignments
  FamilyIDs: [],              // Filter by family
  StudentGroupIDs: []         // Filter by student groups
}
```

## Performance Metrics

| Phase | Payload Size | Students Returned | Load Time | Improvement |
|-------|--------------|-------------------|-----------|-------------|
| Original | 117KB | 536 | ~13s | Baseline |
| Phase 1 (Limit) | 117KB | 536 | ~13s | Bug fix only |
| Phase 2 (Active) | 43KB | 185 | ~8s | 63% faster |
| Phase 3 (Teacher) | ~8-15KB | ~35 | ~2-3s | 93% faster |

## Monitoring

Check these logs to verify optimization is working:

```
Making request to: .../search/students?...limit=1000...
body: '{"IDs":[],...,"Statuses":["Active"],"TeacherIDs":["tch_XXX"],...}'
Response: content-length: ~8000-15000 (should be under 20KB)
Found XX active students from MMS, filtering for teacher...
```

## Edge Cases

1. **Students with no teacher assignment**: Won't appear (expected behavior)
2. **Students with multiple teachers**: Appear correctly on all dashboards
3. **Inactive students**: Excluded from all dashboards (expected behavior)
4. **More than 1000 students**: Would need pagination implementation

## Future Optimizations

If student count exceeds 1000:
- Implement pagination with offset/limit
- Cache results with 15-minute TTL
- Consider GraphQL for more precise field selection

## Related Files

- `/lib/mms-client.js` - API client with optimization
- `/app/api/sync/route.js` - Sync endpoint that calls the client
- `/docs/protocols/DEPLOYMENT_PROTOCOLS.md` - Deployment procedures
