class MMSClient {
  constructor() {
    this.baseUrl = 'https://api.mymusicstaff.com/v1';
    this.schoolId = 'sch_Fx5JQ';
    this.token = null;
  }

  setToken(token) {
    this.token = token;
    console.log('MMS Token set:', token ? 'Yes' : 'No');
  }

  async fetchFromMMS(endpoint, method = 'GET', body = null) {
    const token = this.token || 
                  (typeof window !== 'undefined' ? sessionStorage.getItem('mms_token') : null) ||
                  process.env.MMS_API_KEY;
    
    if (!token) {
      console.error('No MMS token available');
      return { success: false, error: 'No authentication token' };
    }

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'x-schoolbox-version': 'main'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      console.log(`Making request to: ${this.baseUrl}${endpoint}`);
      console.log('Request options:', { ...options, headers: { ...options.headers, Authorization: 'Bearer [HIDDEN]' } });
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Raw response:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
      
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

  async getStudentNotes(studentId) {
    console.log(`Fetching notes for student: ${studentId}`);
    
    // Get attendance records which contain the lesson notes
    const endpoint = '/search/attendance';
    const body = {
      StudentIDs: [studentId],
      Limit: 10,
      Offset: 0,
      OrderBy: '-EventStartDate' // Most recent first
    };

    const result = await this.fetchFromMMS(endpoint, 'POST', body);
    
    if (result.success && result.data && result.data.ItemSubset) {
      return this.extractNotesFromAttendance(result.data.ItemSubset);
    }

    return { 
      success: false, 
      message: 'Could not fetch notes',
      fallbackUrl: `https://app.mymusicstaff.com/Teacher/v2/en/students/details?id=${studentId}`
    };
  }

  extractNotesFromAttendance(attendanceRecords) {
    // Filter for records with notes and attended status
    const recordsWithNotes = attendanceRecords.filter(record => 
      record.StudentNote && 
      (record.AttendanceStatus === 'Present' || record.AttendanceStatus === 'Unrecorded')
    );

    if (recordsWithNotes.length > 0) {
      const mostRecent = recordsWithNotes[0]; // Already sorted by date
      
      // Strip HTML tags from notes for preview (keep full HTML for display if needed)
      const cleanNotes = this.stripHtml(mostRecent.StudentNote);
      
      return {
        success: true,
        notes: cleanNotes,
        notesHtml: mostRecent.StudentNote,
        date: mostRecent.EventStartDate,
        tutor: mostRecent.Teacher.Name,
        attendanceStatus: mostRecent.AttendanceStatus,
        duration: mostRecent.EventDuration
      };
    }

    // Check if there are any absent records
    const absentRecords = attendanceRecords.filter(r => 
      r.AttendanceStatus === 'AbsentNotice' || r.AttendanceStatus === 'Absent'
    );
    
    if (absentRecords.length > 0) {
      return {
        success: true,
        notes: 'Student was absent from the last lesson',
        date: absentRecords[0].EventStartDate,
        tutor: absentRecords[0].Teacher.Name,
        attendanceStatus: 'Absent'
      };
    }

    return { success: false, message: 'No recent lesson notes found' };
  }

  stripHtml(html) {
    // Server-side HTML stripping using regex
    if (!html) return '';
    
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .trim(); // Remove leading/trailing whitespace
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

  async getStudentsForTeacher(teacherId = 'tch_QhxJJ') {
    console.log(`Fetching students for teacher ID: ${teacherId}`);
    
    // First get all students
    const allStudentsResult = await this.getStudents();
    if (!allStudentsResult.success) {
      return allStudentsResult;
    }

    // Then filter by checking lesson assignments or use a different endpoint
    // For now, we'll return all students and let the UI handle filtering
    // In a real implementation, we'd need to check each student's lesson assignments
    
    return {
      success: true,
      students: allStudentsResult.students,
      total: allStudentsResult.students.length,
      teacherId: teacherId
    };
  }
}

export default new MMSClient();
