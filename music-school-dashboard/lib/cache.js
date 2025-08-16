// Simple client-side cache for student data
// Reduces API calls while maintaining data freshness

const CACHE_PREFIX = 'music_dashboard_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export const cache = {
  // Get cached student data for a tutor
  getStudents: (tutor) => {
    try {
      const key = `${CACHE_PREFIX}students_${tutor}`;
      const cached = localStorage.getItem(key);
      
      if (!cached) {
        console.log(`📦 No cache found for tutor: ${tutor}`);
        return null;
      }
      
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is still valid (within 5 minutes)
      if (now - timestamp > CACHE_DURATION) {
        console.log(`⏰ Cache expired for tutor: ${tutor} (${Math.round((now - timestamp) / 1000)}s old)`);
        localStorage.removeItem(key);
        return null;
      }
      
      console.log(`📦 Cache hit for tutor: ${tutor} (${data.length} students, ${Math.round((now - timestamp) / 1000)}s old)`);
      return data;
    } catch (error) {
      console.warn('Cache read error:', error);
      return null;
    }
  },

  // Store student data for a tutor
  setStudents: (tutor, students) => {
    try {
      const key = `${CACHE_PREFIX}students_${tutor}`;
      const cacheData = {
        data: students,
        timestamp: Date.now()
      };
      
      localStorage.setItem(key, JSON.stringify(cacheData));
      console.log(`📦 Cached ${students.length} students for tutor: ${tutor}`);
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  },

  // Clear cache for a specific tutor
  clearStudents: (tutor) => {
    try {
      const key = `${CACHE_PREFIX}students_${tutor}`;
      localStorage.removeItem(key);
      console.log(`🗑️ Cleared cache for tutor: ${tutor}`);
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  },

  // Clear all student caches
  clearAll: () => {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
      keys.forEach(key => localStorage.removeItem(key));
      console.log(`🗑️ Cleared all caches (${keys.length} entries)`);
    } catch (error) {
      console.warn('Cache clear all error:', error);
    }
  },

  // Get cache info for debugging
  getInfo: () => {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
      const info = keys.map(key => {
        const cached = JSON.parse(localStorage.getItem(key));
        const age = Math.round((Date.now() - cached.timestamp) / 1000);
        const tutor = key.replace(`${CACHE_PREFIX}students_`, '');
        return {
          tutor,
          count: cached.data.length,
          ageSeconds: age,
          valid: age < CACHE_DURATION / 1000
        };
      });
      return info;
    } catch (error) {
      console.warn('Cache info error:', error);
      return [];
    }
  }
};
