// Safe cached wrapper for MMS client
// Preserves all existing functionality with optional caching layer

import mmsClient from './mms-client.js';
import { apiCache } from './api-cache.js';

class CachedMMSClient {
  constructor() {
    // Delegate all properties to original client
    this.originalClient = mmsClient;
    
    // Cache control - can be disabled via env var
    this.cacheEnabled = process.env.DISABLE_MMS_CACHE !== 'true';
    
    if (!this.cacheEnabled) {
      console.warn('🚨 MMS Cache DISABLED via environment variable');
    }
    
    // Expose original methods directly for backward compatibility
    this.baseUrl = this.originalClient.baseUrl;
    this.schoolId = this.originalClient.schoolId;
    this.token = this.originalClient.token;
    this.teacherIds = this.originalClient.teacherIds;
  }

  // Delegate non-cached methods directly to original client
  setToken(token) {
    return this.originalClient.setToken(token);
  }

  fetchFromMMS(endpoint, method = 'GET', body = null, options = {}) {
    return this.originalClient.fetchFromMMS(endpoint, method, body, options);
  }

  extractNotesFromAttendance(attendanceRecords, options = {}) {
    return this.originalClient.extractNotesFromAttendance(attendanceRecords, options);
  }

  stripHtml(html) {
    return this.originalClient.stripHtml(html);
  }

  formatStructuredNotes(text) {
    return this.originalClient.formatStructuredNotes(text);
  }

  // CACHED: Student notes (30 second cache)
  async getStudentNotes(studentId, options = {}) {
    if (!this.cacheEnabled || options.bypassCache) {
      return this.originalClient.getStudentNotes(studentId, options);
    }

    try {
      const cacheKey = 'student-notes';
      const cacheParams = { studentId, options: JSON.stringify(options) };
      
      // Try cache first
      const cached = apiCache.get(cacheKey, cacheParams, 'notes');
      if (cached) {
        return cached;
      }
      
      // Cache miss - fetch from API
      const result = await this.originalClient.getStudentNotes(studentId, options);
      
      // Cache successful results only
      if (result && result.success) {
        apiCache.set(cacheKey, cacheParams, result, 'notes');
      }
      
      return result;
    } catch (error) {
      console.error('Cached getStudentNotes error:', error);
      // Fallback to original client
      return this.originalClient.getStudentNotes(studentId, options);
    }
  }

  // CACHED: Student lesson history
  async getStudentLessonHistory(studentId, limit = 25) {
    if (!this.cacheEnabled) {
      return this.originalClient.getStudentLessonHistory(studentId, limit);
    }

    try {
      const cacheKey = 'student-lesson-history';
      const cacheParams = { studentId, limit };
      
      const cached = apiCache.get(cacheKey, cacheParams, 'notes');
      if (cached) {
        return cached;
      }
      
      const result = await this.originalClient.getStudentLessonHistory(studentId, limit);
      
      if (result && result.success) {
        apiCache.set(cacheKey, cacheParams, result, 'notes');
      }
      
      return result;
    } catch (error) {
      console.error('Cached getStudentLessonHistory error:', error);
      return this.originalClient.getStudentLessonHistory(studentId, limit);
    }
  }

  // CACHED: Students for teacher (3 minute cache)
  async getStudentsForTeacher(tutorName = null) {
    if (!this.cacheEnabled) {
      return this.originalClient.getStudentsForTeacher(tutorName);
    }

    try {
      const cacheKey = 'students-for-teacher';
      const cacheParams = { tutorName };
      
      const cached = apiCache.get(cacheKey, cacheParams, 'students');
      if (cached) {
        return cached;
      }
      
      const result = await this.originalClient.getStudentsForTeacher(tutorName);
      
      if (result && result.success && result.students) {
        apiCache.set(cacheKey, cacheParams, result, 'students');
      }
      
      return result;
    } catch (error) {
      console.error('Cached getStudentsForTeacher error:', error);
      return this.originalClient.getStudentsForTeacher(tutorName);
    }
  }

  // NON-CACHED: General student list (changes frequently)
  async getStudents(tutorName = null) {
    return this.originalClient.getStudents(tutorName);
  }

  // Cache management methods
  clearCache(pattern) {
    if (!this.cacheEnabled) return 0;
    return apiCache.clear(pattern);
  }

  clearAllCache() {
    if (!this.cacheEnabled) return 0;
    return apiCache.clearAll();
  }

  getCacheStats() {
    if (!this.cacheEnabled) {
      return { enabled: false, message: 'Caching disabled' };
    }
    return apiCache.getStats();
  }

  // Emergency cache bypass for specific calls
  async getStudentNotesUncached(studentId, options = {}) {
    return this.originalClient.getStudentNotes(studentId, { ...options, bypassCache: true });
  }

  async getStudentsForTeacherUncached(tutorName = null) {
    const originalEnabled = this.cacheEnabled;
    this.cacheEnabled = false;
    const result = await this.getStudentsForTeacher(tutorName);
    this.cacheEnabled = originalEnabled;
    return result;
  }
}

// Export cached client instance
export default new CachedMMSClient();