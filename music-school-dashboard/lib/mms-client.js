import { instrumentOverrides } from './config.js';

class MMSClient {
  constructor() {
    this.baseUrl = 'https://api.mymusicstaff.com/v1';
    this.schoolId = 'sch_Fx5JQ';
    // Hardcoded API token - always use this
    this.token = 'eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJJbXBlcnNvbmF0aW5nIjpmYWxzZSwiUHJvZmlsZU1vZGUiOiJBcGlLZXkiLCJTY2hvb2xJRCI6InNjaF9GeDVKUSIsIk5hbWUiOiJGaXJzdCBDaG9yZCBEYXNoYm9hcmQiLCJBdXRoVG9rZW4iOiJha193WUpmLldKTnNhclY4NjVUOGQ5Z1dVVGNUS1VDU1h1SzY5MGJZZVB2VkE0RURMQWM9IiwiaWF0IjoxNzU1MTU0NjM1fQ.jE6sNUVTtzRoT6LVSyf_4bVt3eCFSSFq93GvA0gkxZI';
    
    // Teacher ID mapping for automatic filtering
    this.teacherIds = {
      'Finn': 'tch_QhxJJ',
      'Finn Le Marinel': 'tch_QhxJJ',
      'Arion': 'tch_zplpJw',
      'Arion Xenos': 'tch_zplpJw',
      // Real teacher IDs from MMS
      'Dean': 'tch_zV9TJN',
      'Dean Louden': 'tch_zV9TJN',
      'Eléna': 'tch_zpy4J9',
      'Eléna Esposito': 'tch_zpy4J9',
      'Fennella': 'tch_C2bJ9',
      'Fennella McCallum': 'tch_C2bJ9',
      'Jungyoun': 'tch_z3lWJS',
      'Jungyoun Bae': 'tch_z3lWJS',
      'Kim': 'tch_zVg1Js',
      'Kim Grant': 'tch_zVg1Js',
      'Patrick': 'tch_zw9SJ3',
      'Patrick Shand': 'tch_zw9SJ3',
      'Robbie': 'tch_zV9hJ2',
      'Robbie Tranter': 'tch_zV9hJ2',
      'Stef': 'tch_z5YmJX',
      'Stef McGlinchey': 'tch_z5YmJX',
      'Tom': 'tch_mYJJR',
      'Tom Walters': 'tch_mYJJR',
      'David': 'tch_z2j2Jf',
      'David Husz': 'tch_z2j2Jf',
      // New tutors - placeholder IDs (to be updated with real MMS teacher IDs)
      'Kenny': 'tch_zsyfJr',
      'Scott': 'tch_zMWrJR',
      'Ines': 'tch_zHJlJx',
      // Lowercase aliases for easy access
      'finn': 'tch_QhxJJ',
      'arion': 'tch_zplpJw',
      'dean': 'tch_zV9TJN',
      'eléna': 'tch_zpy4J9',
      'elena': 'tch_zpy4J9',
      'fennella': 'tch_C2bJ9',
      'jungyoun': 'tch_z3lWJS',
      'kim': 'tch_zVg1Js',
      'patrick': 'tch_zw9SJ3',
      'robbie': 'tch_zV9hJ2',
      'stef': 'tch_z5YmJX',
      'tom': 'tch_mYJJR',
      'david': 'tch_z2j2Jf',
      'david husz': 'tch_z2j2Jf',
      'kenny': 'tch_zsyfJr',
      'scott': 'tch_zMWrJR',
      'ines': 'tch_zHJlJx'
    };
  }

  setToken(token) {
    // Always use the hardcoded token, ignore any passed token
    console.log('MMS Token set: Using hardcoded token');
  }

  async fetchFromMMS(endpoint, method = 'GET', body = null, options = {}) {
    // Always use the hardcoded token - never rely on external sources
    const token = this.token;
    const quiet = options.quiet || false; // Add quiet mode for student portals
    
    if (!token) {
      console.error('No MMS token available');
      return { success: false, error: 'No authentication token' };
    }

    const fetchOptions = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'x-schoolbox-version': 'main'
      }
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      if (!quiet) {
        console.log(`Making request to: ${this.baseUrl}${endpoint}`);
        console.log('Request options:', { ...fetchOptions, headers: { ...fetchOptions.headers, Authorization: 'Bearer [HIDDEN]' } });
      }
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);
      
      if (!quiet) {
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      }
      
      const responseText = await response.text();
      
      if (!quiet) {
        console.log('Raw response:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
      }
      
      if (!responseText) {
        return { success: false, error: 'Empty response from API' };
      }
      
      const data = JSON.parse(responseText);
      return { success: response.ok, data };
    } catch (error) {
      console.error('MMS API Error:', error);
      return { success: false, error: error.message };
    }
  }

  async getStudentNotes(studentId, options = {}) {
    const studentPortal = options.studentPortal || false;
    
    if (!studentPortal) {
      console.log(`Fetching notes for student: ${studentId}`);
    }
    
    // Get attendance records which contain the lesson notes
    const endpoint = '/search/attendance';
    const body = {
      StudentIDs: [studentId],
      Limit: 3,  // API returns all records regardless, but keep small for efficiency
      Offset: 0,
      OrderBy: '-EventStartDate' // Most recent first
    };

    const result = await this.fetchFromMMS(endpoint, 'POST', body, { quiet: studentPortal });
    
    if (result.success && result.data && result.data.ItemSubset) {
      // Process all retrieved records to find notes (no artificial CPU limitation)
      return this.extractNotesFromAttendance(result.data.ItemSubset, { studentPortal });
    }

    return { 
      success: false, 
      message: 'Could not fetch notes',
      fallbackUrl: `https://app.mymusicstaff.com/Teacher/v2/en/students/details?id=${studentId}`
    };
  }

  extractNotesFromAttendance(attendanceRecords, options = {}) {
    const studentPortal = options.studentPortal || false;
    
    if (!studentPortal) {
      console.log(`Processing ${attendanceRecords.length} attendance records for notes...`);
    }
    
    // Enhanced algorithm to handle edge cases where recent notes are in completed lessons
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
    
    // Phase 1: Look for notes in recent completed lessons (Present, AbsentNotice, etc.)
    // This fixes the issue where future scheduled lessons block real completed lessons
    const completedStatuses = ['Present', 'AbsentNotice', 'AbsentNoMakeup', 'TeacherAbsentMakeup'];
    const recentCompletedLessons = attendanceRecords.filter(record => {
      const recordDate = new Date(record.EventStartDate);
      return completedStatuses.includes(record.AttendanceStatus) && 
             recordDate >= sixMonthsAgo && 
             recordDate <= now;
    });
    
    // Sort recent completed lessons by date (most recent first)
    recentCompletedLessons.sort((a, b) => new Date(b.EventStartDate) - new Date(a.EventStartDate));
    
    if (!studentPortal) {
      console.log(`Found ${recentCompletedLessons.length} recent completed lessons in the last 6 months`);
    }
    
    // Find most recent completed lesson with notes
    for (const record of recentCompletedLessons) {
      if (record.StudentNote && record.StudentNote.trim() !== '') {
        if (!studentPortal) {
          console.log(`Found recent notes in completed lesson from ${record.EventStartDate} with status: ${record.AttendanceStatus}`);
        }
        
        const cleanNotes = this.stripHtml(record.StudentNote);
        
        return {
          success: true,
          notes: cleanNotes,
          notesHtml: record.StudentNote,
          date: record.EventStartDate,
          tutor: record.Teacher?.Name || 'Unknown',
          attendanceStatus: record.AttendanceStatus,
          duration: record.EventDuration
        };
      }
    }
    
    // Phase 2: Fall back to original algorithm (any record with notes)
    // This ensures we don't break existing working students
    if (!studentPortal) {
      console.log(`No recent completed lessons with notes found, falling back to original algorithm...`);
    }
    
    for (const record of attendanceRecords) {
      if (record.StudentNote && record.StudentNote.trim() !== '') {
        if (!studentPortal) {
          console.log(`Using fallback note from ${record.EventStartDate} with status: ${record.AttendanceStatus}`);
        }
        
        const cleanNotes = this.stripHtml(record.StudentNote);
        
        return {
          success: true,
          notes: cleanNotes,
          notesHtml: record.StudentNote,
          date: record.EventStartDate,
          tutor: record.Teacher?.Name || 'Unknown',
          attendanceStatus: record.AttendanceStatus,
          duration: record.EventDuration
        };
      }
    }

    // If no notes found, check for any recent records (fallback logic unchanged)
    if (attendanceRecords.length > 0) {
      const mostRecentRecord = attendanceRecords[0];
      return {
        success: true,
        notes: `No notes available for most recent lesson (${mostRecentRecord.AttendanceStatus})`,
        date: mostRecentRecord.EventStartDate,
        tutor: mostRecentRecord.Teacher?.Name || 'Unknown',
        attendanceStatus: mostRecentRecord.AttendanceStatus
      };
    }

    return { success: false, message: 'No recent lesson records found' };
  }

  // Legacy code preserved for reference (the old approach)
  extractNotesFromAttendanceLegacy(attendanceRecords) {
    // First, let's log all records with notes to debug
    const recordsWithNotes = attendanceRecords.filter(record => 
      record.StudentNote && record.StudentNote.trim() !== ''
    );
    
    console.log(`Found ${recordsWithNotes.length} records with notes`);
    if (recordsWithNotes.length > 0) {
      console.log('All records with notes:', recordsWithNotes.map(r => ({
        date: r.EventStartDate,
        status: r.AttendanceStatus,
        notePreview: r.StudentNote.substring(0, 100) + '...'
      })));
    }

    // Sort records by date (most recent first) - the API might not be sorting correctly
    const sortedRecordsWithNotes = recordsWithNotes.sort((a, b) => 
      new Date(b.EventStartDate) - new Date(a.EventStartDate)
    );
    
    console.log('Records after sorting:', sortedRecordsWithNotes.map(r => ({
      date: r.EventStartDate,
      status: r.AttendanceStatus
    })));

    // Get the most recent record with notes, regardless of attendance status
    if (sortedRecordsWithNotes.length > 0) {
      const mostRecent = sortedRecordsWithNotes[0]; // Most recent after sorting
      
      console.log(`Using most recent note from ${mostRecent.EventStartDate} with status: ${mostRecent.AttendanceStatus}`);
      
      // Strip HTML tags from notes for preview (keep full HTML for display if needed)
      const cleanNotes = this.stripHtml(mostRecent.StudentNote);
      
      return {
        success: true,
        notes: cleanNotes,
        notesHtml: mostRecent.StudentNote,
        date: mostRecent.EventStartDate,
        tutor: mostRecent.Teacher?.Name || 'Unknown',
        attendanceStatus: mostRecent.AttendanceStatus,
        duration: mostRecent.EventDuration
      };
    }

    // If no notes found, check for any recent records
    if (attendanceRecords.length > 0) {
      const mostRecentRecord = attendanceRecords[0];
      return {
        success: true,
        notes: `No notes available for most recent lesson (${mostRecentRecord.AttendanceStatus})`,
        date: mostRecentRecord.EventStartDate,
        tutor: mostRecentRecord.Teacher?.Name || 'Unknown',
        attendanceStatus: mostRecentRecord.AttendanceStatus
      };
    }

    return { success: false, message: 'No recent lesson records found' };
  }

  stripHtml(html) {
    // Server-side HTML stripping using regex
    if (!html) return '';
    
    let cleaned = html
      // First, convert HTML line breaks to actual line breaks BEFORE removing tags
      .replace(/<br\s*\/?>/gi, '\n') // Replace <br> and <br/> with line breaks
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n') // Replace </p><p> with double line breaks
      .replace(/<p[^>]*>/gi, '\n') // Replace opening <p> with line break
      .replace(/<\/p>/gi, '\n') // Replace closing </p> with line break
      .replace(/<div[^>]*>/gi, '\n') // Replace opening <div> with line break
      .replace(/<\/div>/gi, '\n') // Replace closing </div> with line break
      .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .replace(/&rsquo;/g, "'") // Replace &rsquo; with '
      .replace(/&lsquo;/g, "'") // Replace &lsquo; with '
      .replace(/&rdquo;/g, '"') // Replace &rdquo; with "
      .replace(/&ldquo;/g, '"') // Replace &ldquo; with "
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up excessive line breaks
      .trim(); // Remove leading/trailing whitespace
    
    // Format square bracket questions as structured headers
    return this.formatStructuredNotes(cleaned);
  }

  formatStructuredNotes(text) {
    if (!text) return '';
    
    // Clean up line breaks
    let formatted = text
      .replace(/\r\n/g, '\n') // Normalize Windows line endings
      .replace(/\r/g, '\n')   // Normalize Mac line endings
      .replace(/\n\s*\n\s*\n/g, '\n\n'); // Clean up excessive line breaks
    
    // Format square bracket questions as headers
    formatted = formatted.replace(/\[([^\]]+)\]/g, (_, question) => {
      return `\n\n**${question.trim()}**\n`;
    });
    
    // Format names/labels followed by colons at the start of lines
    // This catches: Teacher:, Alize:, Recap:, Student:, etc.
    formatted = formatted.replace(/^([A-Z][a-zA-Z]*(?:'[a-z]+)?(?:\s[A-Z][a-zA-Z]*)*?):\s*/gm, (_, name) => {
      return `***${name}:*** `;
    });
    
    return formatted
      .replace(/^\n+/, '') // Remove leading newlines
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
      .trim();
  }

  // Get all recent lessons for a student
  async getStudentLessonHistory(studentId, limit = 25) {
    const endpoint = '/search/attendance';
    const body = {
      StudentIDs: [studentId],
      Limit: limit,
      Offset: 0,
      OrderBy: '-EventStartDate'
    };

    const result = await this.fetchFromMMS(endpoint, 'POST', body);
    
    if (result.success && result.data && result.data.ItemSubset) {
      return {
        success: true,
        lessons: result.data.ItemSubset.map(lesson => ({
          date: lesson.EventStartDate,
          status: lesson.AttendanceStatus,
          notes: this.stripHtml(lesson.StudentNote || ''),
          tutor: lesson.Teacher?.Name,
          duration: lesson.EventDuration
        }))
      };
    }

    return { success: false, lessons: [] };
  }

  async getStudents(tutorName = null) {
    console.log(`Fetching students${tutorName ? ` for tutor: ${tutorName}` : ''}`);
    
    // Use the real MMS endpoint with proper parameters
    const endpoint = '/search/students';
    const queryParams = new URLSearchParams({
      offset: '0',
      limit: '500', // Get all students
      fields: 'Family,StudentGroups,BillingProfiles,NextEventDate',
      orderby: 'FullName'
    });

    const result = await this.fetchFromMMS(`${endpoint}?${queryParams}`, 'POST');
    
    if (result.success && result.data && result.data.ItemSubset) {
      let students = result.data.ItemSubset.map(student => ({
        name: student.FullName || `${student.FirstName} ${student.LastName}`.trim(),
        mms_id: student.ID,
        first_name: student.FirstName,
        last_name: student.LastName,
        email: student.EmailAddress || '',
        current_tutor: 'Unknown', // Will be determined by lesson assignments
        soundslice_course: '', // Will be populated separately
        soundslice_username: '',
        theta_id: '',
        parent_email: '',
        instrument: 'Unknown', // Will be determined by lesson assignments
        status: student.IsActive ? 'Active' : 'Inactive',
        family_id: student.FamilyID,
        next_event_date: student.NextEventDate,
        profile_picture_url: student.ProfileThumbnailURL
      }));

      // Now we need to get lesson assignments to determine tutor and instrument
      // For now, if tutorName is "Finn" or "Finn Le Marinel", we'll need to filter
      // by checking lesson assignments for each student
      if (tutorName) {
        // For now, return all students - we'll filter by checking lessons separately
        console.log(`Found ${students.length} total students, filtering will be done via lesson assignments`);
      }

      return {
        success: true,
        students: students,
        total: students.length
      };
    }

    return { 
      success: false, 
      students: [],
      message: 'Could not fetch students from MMS'
    };
  }

  async getStudentsForTeacher(tutorName = null) {
    const teacherId = this.teacherIds[tutorName];
    console.log(`Fetching students for tutor: ${tutorName}, teacher ID: ${teacherId}`);
    
    if (!teacherId) {
      console.log(`No teacher ID found for: ${tutorName}`);
      return { 
        success: false, 
        students: [],
        message: `No teacher ID configured for ${tutorName}`
      };
    }

    // Don't proceed with placeholder IDs
    if (teacherId.includes('placeholder')) {
      console.log(`Placeholder ID detected for ${tutorName} - skipping API call`);
      return { 
        success: false, 
        students: [],
        message: `Teacher ID not yet configured for ${tutorName}. Please add their real MMS teacher ID.`
      };
    }
    
    // Get all active students with teacher assignments
    const endpoint = '/search/students';
    const queryParams = new URLSearchParams({
      offset: '0',
      limit: '1000', // Increased from 500 to get all students
      fields: 'Family,StudentGroups,BillingProfiles,NextEventDate,AccessStatus',
      orderby: 'FullName'
    });

    // Filter for only active students assigned to this teacher using the correct MMS API format
    const body = {
      IDs: [],
      SearchText: "",
      FirstName: null,
      LastName: null,
      Statuses: ["Active"],      // Filter only active students
      TeacherIDs: [teacherId],   // Filter by specific teacher (massive optimization!)
      FamilyIDs: [],
      StudentGroupIDs: []
    };

    const result = await this.fetchFromMMS(`${endpoint}?${queryParams}`, 'POST', body);
    
    if (result.success && result.data && result.data.ItemSubset) {
      console.log(`Found ${result.data.ItemSubset.length} active students from MMS, filtering for teacher ${teacherId}...`);

      // Debug: log first student to see structure
      if (result.data.ItemSubset.length > 0) {
        console.log('Sample student object:', JSON.stringify(result.data.ItemSubset[0], null, 2));
        
        // Find students with StudentGroups
        const studentsWithGroups = result.data.ItemSubset.filter(s => s.StudentGroups && s.StudentGroups.length > 0);
        console.log(`Found ${studentsWithGroups.length} students with StudentGroups`);
        
        // Find students with BillingProfiles
        const studentsWithBilling = result.data.ItemSubset.filter(s => s.BillingProfiles && s.BillingProfiles.length > 0);
        console.log(`Found ${studentsWithBilling.length} students with BillingProfiles`);
        
        // Find students with our teacher ID in their groups
        const studentsWithTeacher = result.data.ItemSubset.filter(s => 
          s.StudentGroups && s.StudentGroups.some(group => group.TeacherID === teacherId)
        );
        console.log(`Found ${studentsWithTeacher.length} students with teacher ID ${teacherId} in StudentGroups`);
        
        // Find students with our teacher ID in their billing profiles
        const studentsWithTeacherBilling = result.data.ItemSubset.filter(s => 
          s.BillingProfiles && s.BillingProfiles.some(profile => profile.TeacherID === teacherId)
        );
        console.log(`Found ${studentsWithTeacherBilling.length} students with teacher ID ${teacherId} in BillingProfiles`);
        
        if (studentsWithTeacher.length > 0) {
          console.log('Sample student with teacher in StudentGroups:', JSON.stringify(studentsWithTeacher[0], null, 2));
        } else if (studentsWithTeacherBilling.length > 0) {
          console.log('Sample student with teacher in BillingProfiles:', JSON.stringify(studentsWithTeacherBilling[0], null, 2));
        }
      }
      
      // DEBUG: Check specifically for Yarah Love
      const yarah = result.data.ItemSubset.find(s => s.FirstName === 'Yarah' && s.LastName === 'Love');
      if (yarah) {
        console.log('🔍 Found Yarah Love in raw data:', {
          id: yarah.ID,
          active: yarah.Active,
          status: yarah.Status,
          hasStudentGroups: yarah.StudentGroups?.length > 0,
          studentGroupsCount: yarah.StudentGroups?.length,
          hasBillingProfiles: yarah.BillingProfiles?.length > 0,
          billingProfilesCount: yarah.BillingProfiles?.length,
          billingTeachers: yarah.BillingProfiles?.map(p => ({ teacherId: p.TeacherID, active: p.Active }))
        });
      } else {
        console.log('❌ Yarah Love NOT found in raw MMS data');
      }

      // Filter students that have active assignments with this specific teacher
      const teacherStudents = result.data.ItemSubset.filter(student => {
        const isYarah = student.FirstName === 'Yarah' && student.LastName === 'Love';

        // Check if student is active (try multiple possible property names)
        const isActive = student.Active === true ||
                        student.IsActive === true ||
                        student.Status === "Active" ||
                        student.Status === "active";

        if (!isActive) {
          if (isYarah) console.log('❌ Yarah rejected: not active');
          return false;
        }

        // Check StudentGroups first (if available)
        if (student.StudentGroups && student.StudentGroups.length > 0) {
          const result = student.StudentGroups.some(group => {
            const isTeacherMatch = group.TeacherID === teacherId;
            const isActive = group.IsActive;
            const notEnded = !group.EndDate || new Date(group.EndDate) > new Date();

            return isTeacherMatch && isActive && notEnded;
          });
          if (isYarah) console.log(`🔍 Yarah StudentGroups check for ${tutorName}: ${result}`);
          return result;
        }

        // Fallback: Check BillingProfiles for teacher assignment
        if (student.BillingProfiles && student.BillingProfiles.length > 0) {
          const matchingProfile = student.BillingProfiles.find(profile => profile.TeacherID === teacherId);
          if (isYarah) {
            console.log(`🔍 Yarah BillingProfiles check for ${tutorName} (${teacherId}):`, {
              hasBillingProfiles: true,
              profileCount: student.BillingProfiles.length,
              teacherIds: student.BillingProfiles.map(p => p.TeacherID),
              matchingProfile: matchingProfile ? {
                teacherId: matchingProfile.TeacherID,
                active: matchingProfile.Active,
                activeCheck: matchingProfile.Active !== false
              } : null
            });
          }

          const result = student.BillingProfiles.some(profile => {
            const isTeacherMatch = profile.TeacherID === teacherId;
            const isActive = profile.Active !== false; // Some might not have this field

            return isTeacherMatch && isActive;
          });
          if (isYarah) console.log(`✅ Yarah BillingProfiles result for ${tutorName}: ${result}`);
          return result;
        }

        if (isYarah) console.log('❌ Yarah rejected: no StudentGroups or BillingProfiles');
        return false;
      }).map(student => {
        // Find the teacher's group to get instrument/subject
        let teacherGroup = null;
        let instrument = 'Guitar'; // Default
        
        // Check for instrument override first
        if (instrumentOverrides[student.ID]) {
          instrument = instrumentOverrides[student.ID];
        } else {
          // Try to get from StudentGroups first
          if (student.StudentGroups && student.StudentGroups.length > 0) {
            teacherGroup = student.StudentGroups.find(group => 
              group.TeacherID === teacherId && group.IsActive
            );
            instrument = teacherGroup?.Subject || 'Guitar';
          } else if (student.BillingProfiles && student.BillingProfiles.length > 0) {
            // Fallback to BillingProfiles
            const teacherProfile = student.BillingProfiles.find(profile => 
              profile.TeacherID === teacherId
            );
            instrument = teacherProfile?.Subject || 'Guitar'; // BillingProfiles might not have Subject
          }
        }
        
        return {
          name: student.Name || student.FullName || `${student.FirstName} ${student.LastName}`.trim(),
          mms_id: student.ID,
          first_name: student.FirstName,
          last_name: student.LastName,
          email: student.EmailAddress || '',
          current_tutor: tutorName,
          soundslice_course: null, // Changed from '' to null - preserves existing assignments
          soundslice_username: '',
          theta_id: '',
          parent_email: '',
          instrument: instrument,
          status: 'Active',
          family_id: student.FamilyID,
          next_event_date: student.NextEventDate,
          profile_picture_url: student.ProfileThumbnailURL,
          lesson_group_id: teacherGroup?.ID,
          is_active: true
        };
      });

      console.log(`Found ${teacherStudents.length} students assigned to ${tutorName}`);

      return {
        success: true,
        students: teacherStudents,
        total: teacherStudents.length,
        teacherId: teacherId,
        tutorName: tutorName,
        filtered: true
      };
    }

    return { 
      success: false, 
      students: [],
      message: 'Could not fetch students from MMS'
    };
  }
}

export default new MMSClient();
