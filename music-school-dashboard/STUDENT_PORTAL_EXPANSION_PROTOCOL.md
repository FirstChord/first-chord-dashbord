# Student Portal Expansion Protocol

## Overview
This document outlines the step-by-step process for adding new students to the individual student portal system while maintaining security, consistency, and the established design preferences.

## Current Implementation Status
- **✅ Implemented**: Mathilde Thallon (`sdt_H6CvJv`)
- **📍 Access URL**: `http://localhost:3000/student/sdt_H6CvJv`
- **🎨 Design**: Matches tutor dashboard exactly (grass-to-sky gradient, cloud, First Chord logo)
- **📱 Layout**: 2/3 notes (left), 1/3 links (right)

## Design Requirements & Preferences

### Visual Design Standards
- **Background**: `bg-gradient-to-t from-green-100 to-blue-100` (grass-to-sky gradient)
- **Cloud Element**: Top-right positioned with `transform -rotate-12` and `opacity-90`
- **First Chord Logo**: Bottom-right corner, hover effects enabled
- **Header**: Blue header (`bg-blue-100`) with Cooper Hewitt font
- **Layout Ratio**: Notes panel 67% width, Links panel 33% width
- **Container**: `max-w-7xl` for optimal reading width

### Functionality Requirements
- **Live MMS Notes**: Real-time lesson notes from MyMusicStaff API
- **Complete Note Formatting**: 
  - Bold headers for questions (`**text**`)
  - Bold names for speakers (`***Name:***`)
  - Full conversational content without truncation
  - Proper line breaks and spacing
- **Enhanced Theta Integration**: 
  - Professional popup modal with copy/clipboard functionality
  - Smart logout/login sequence to prevent authentication conflicts
- **Soundslice Integration**: Direct links to assigned courses
- **Security**: Whitelist-based access control

## Adding New Students

### Step 1: Identify Student Information
Gather the following required data:
- **MMS Student ID**: Format `sdt_XXXXXX` (e.g., `sdt_H6CvJv`)
- **Student Name**: Full name for header display
- **Theta Credentials**: Username (if applicable)
- **Soundslice Course**: Assigned course URL (if applicable)
- **Tutor**: Confirm which tutor manages this student

### Step 2: Add to Security Whitelist
Edit `lib/student-helpers.js`:

```javascript
// Valid student IDs (security)
const VALID_STUDENT_IDS = [
  'sdt_H6CvJv', // Mathilde Thallon
  'sdt_XXXXXX', // [New Student Name]
  // Add more students as the portal expands
];
```

**Security Note**: Only students in this array can access the portal. This prevents unauthorized access.

### Step 3: Verify Data Sources
Ensure the student exists in the following systems:

#### MyMusicStaff (MMS)
- Student must exist in MMS with correct `sdt_XXXXXX` ID
- Verify tutor assignment and recent lesson notes
- Test API response: `/api/notes/sdt_XXXXXX`

#### Theta Music Credentials (if applicable)
Check `lib/config/theta-credentials.js`:
```javascript
export const thetaCredentials = {
  'sdt_XXXXXX': 'studentnamefc',
  // Should exist if student has Theta access
};
```

#### Soundslice Mappings (if applicable)
Check `lib/soundslice-mappings.js`:
```javascript
const SOUNDSLICE_MAPPINGS = {
  'sdt_XXXXXX': 'https://www.soundslice.com/courses/XXXXX/',
  // Should exist if student has assigned course
};
```

### Step 4: Test Access
1. **Start Development Server**: `npm run dev`
2. **Test Student URL**: `http://localhost:3000/student/sdt_XXXXXX`
3. **Verify Components**:
   - ✅ Header shows student name correctly
   - ✅ Notes display live MMS data with proper formatting
   - ✅ Soundslice link works (if applicable)
   - ✅ Theta popup functions correctly (if applicable)
   - ✅ Visual design matches requirements

### Step 5: Share Access URL
Generate the student's unique URL:
- **Format**: `http://localhost:3000/student/sdt_XXXXXX`
- **Production**: Update domain when deployed
- **Security**: URL is not discoverable - must be shared directly

## Quality Assurance Checklist

### Before Adding Any Student
- [ ] Student exists in MMS with valid lesson notes
- [ ] Student ID follows correct `sdt_XXXXXX` format
- [ ] Tutor has confirmed student should have portal access

### After Adding Student
- [ ] Student URL returns HTTP 200 (not 404 or 500)
- [ ] Header displays student name correctly
- [ ] Live notes display with proper formatting
- [ ] Date shows correctly (not "Invalid Date")
- [ ] Soundslice link opens correct course (if applicable)
- [ ] Theta popup shows correct credentials (if applicable)
- [ ] Visual design matches Mathilde's portal exactly
- [ ] No console errors in browser developer tools

## Troubleshooting Common Issues

### "Invalid Date" Error
- **Cause**: API returning incorrect date format
- **Fix**: Check MMS API response format in logs
- **Test**: Verify `notes.lesson_date` exists and is valid ISO string

### Generic "Great lesson today!" Message
- **Cause**: Notes not loading from MMS
- **Fix**: Check API endpoint `/api/notes/sdt_XXXXXX` returns real data
- **Debug**: Look for MMS API call logs in development server

### 404 Student Not Found
- **Cause**: Student ID not in `VALID_STUDENT_IDS` array
- **Fix**: Add student ID to whitelist in `lib/student-helpers.js`

### Missing Theta/Soundslice Links
- **Cause**: Student not in respective mapping files
- **Expected**: Normal - not all students have all services
- **Action**: Verify with tutor if student should have access

## Security Considerations

### Access Control
- **Whitelist Only**: Students must be explicitly added to access list
- **No Discovery**: Portal URLs are not linked from main dashboard
- **Validation**: All student data requests are validated against whitelist

### Data Privacy
- **Live Data**: Notes are fetched live from MMS (not cached long-term)
- **No Sharing**: Each student only sees their own data
- **Secure URLs**: Use HTTPS in production

## Maintenance

### Regular Tasks
- **Monitor Logs**: Check for API errors or access attempts
- **Update Credentials**: Sync Theta credentials when they change
- **Verify Links**: Ensure Soundslice courses remain active

### When Students Leave
- **Remove from Whitelist**: Delete from `VALID_STUDENT_IDS`
- **Clean Up Data**: Remove from Theta/Soundslice mappings if needed
- **Test**: Verify their URL now returns "not found" error

## Example Implementation

Here's the complete process for adding a new student "Alex Chang":

```javascript
// 1. Add to lib/student-helpers.js
const VALID_STUDENT_IDS = [
  'sdt_H6CvJv', // Mathilde Thallon  
  'sdt_gwyQJr', // Alex Chang
];

// 2. Verify in lib/config/theta-credentials.js
export const thetaCredentials = {
  'sdt_gwyQJr': 'alexfc',
};

// 3. Verify in lib/soundslice-mappings.js
const SOUNDSLICE_MAPPINGS = {
  'sdt_gwyQJr': 'https://www.soundslice.com/courses/4370/',
};

// 4. Test URL: http://localhost:3000/student/sdt_gwyQJr
```

## Future Enhancements

### Potential Additions
- **Bulk Student Import**: Script to add multiple students at once
- **Admin Panel**: Interface for tutors to manage student access
- **Progress Tracking**: Show practice progress over time
- **Parent Access**: Separate parent view with student progress

### Technical Improvements
- **Caching Strategy**: Optimize API calls for better performance
- **Error Handling**: More detailed error messages for troubleshooting
- **Analytics**: Track usage patterns and engagement

---

**Document Version**: 1.0  
**Last Updated**: September 13, 2025  
**Created For**: First Chord Music School Dashboard  
**Maintained By**: Development Team