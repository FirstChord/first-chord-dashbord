// Ultra-safe server-side API response caching
// Multiple safety controls and emergency bypasses

const API_CACHE = new Map();
const CACHE_DURATION = {
  students: 3 * 60 * 1000,     // 3 minutes for student lists
  notes: 30 * 1000,            // 30 seconds for notes (fresher data)
  default: 2 * 60 * 1000       // 2 minutes default
};

// Emergency bypass - set to true to disable all caching
const EMERGENCY_BYPASS = process.env.DISABLE_API_CACHE === 'true';

export class APICache {
  constructor() {
    this.enabled = !EMERGENCY_BYPASS;
    this.hitCount = 0;
    this.missCount = 0;
    
    if (!this.enabled) {
      console.warn('🚨 API Cache DISABLED via EMERGENCY_BYPASS');
    }
  }

  // Generate cache key from endpoint and params
  generateKey(endpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    return `${endpoint}?${sortedParams}`;
  }

  // Get cached response with safety checks
  get(endpoint, params = {}, cacheType = 'default') {
    if (!this.enabled) return null;
    
    try {
      const key = this.generateKey(endpoint, params);
      const cached = API_CACHE.get(key);
      
      if (!cached) {
        this.missCount++;
        return null;
      }
      
      const now = Date.now();
      const maxAge = CACHE_DURATION[cacheType] || CACHE_DURATION.default;
      
      if (now - cached.timestamp > maxAge) {
        // Expired cache
        API_CACHE.delete(key);
        this.missCount++;
        return null;
      }
      
      this.hitCount++;
      console.log(`🎯 Cache HIT: ${endpoint} (${Math.round((now - cached.timestamp) / 1000)}s old)`);
      return cached.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null; // Fail safe - return null to trigger fresh API call
    }
  }

  // Store response with safety checks
  set(endpoint, params = {}, data, cacheType = 'default') {
    if (!this.enabled) return false;
    
    try {
      const key = this.generateKey(endpoint, params);
      
      // Safety check - don't cache error responses
      if (!data || data.success === false) {
        console.log(`❌ Not caching failed response for: ${endpoint}`);
        return false;
      }
      
      // Safety check - don't cache responses that are too large (> 1MB)
      const dataSize = JSON.stringify(data).length;
      if (dataSize > 1024 * 1024) {
        console.warn(`📦 Response too large to cache: ${endpoint} (${Math.round(dataSize/1024)}KB)`);
        return false;
      }
      
      API_CACHE.set(key, {
        data: structuredClone(data), // Deep copy to prevent mutations
        timestamp: Date.now(),
        size: dataSize
      });
      
      console.log(`📦 Cached response: ${endpoint} (${Math.round(dataSize/1024)}KB)`);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Clear cache for specific endpoint pattern
  clear(pattern) {
    let cleared = 0;
    for (const key of API_CACHE.keys()) {
      if (key.includes(pattern)) {
        API_CACHE.delete(key);
        cleared++;
      }
    }
    console.log(`🗑️ Cleared ${cleared} cached entries matching: ${pattern}`);
    return cleared;
  }

  // Emergency clear all
  clearAll() {
    const size = API_CACHE.size;
    API_CACHE.clear();
    this.hitCount = 0;
    this.missCount = 0;
    console.log(`🚨 EMERGENCY: Cleared all ${size} cached entries`);
    return size;
  }

  // Get cache statistics
  getStats() {
    const entries = Array.from(API_CACHE.entries()).map(([key, value]) => ({
      key,
      age: Math.round((Date.now() - value.timestamp) / 1000),
      size: Math.round(value.size / 1024)
    }));

    return {
      enabled: this.enabled,
      totalEntries: API_CACHE.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount + this.missCount > 0 ? 
        Math.round((this.hitCount / (this.hitCount + this.missCount)) * 100) : 0,
      entries,
      totalMemory: entries.reduce((sum, entry) => sum + entry.size, 0)
    };
  }

  // Health check - remove expired entries
  cleanup() {
    let removed = 0;
    const now = Date.now();
    
    for (const [key, value] of API_CACHE.entries()) {
      // Remove entries older than maximum cache duration
      if (now - value.timestamp > Math.max(...Object.values(CACHE_DURATION))) {
        API_CACHE.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} expired cache entries`);
    }
    return removed;
  }
}

// Export singleton instance
export const apiCache = new APICache();

// Auto-cleanup every 5 minutes
setInterval(() => {
  apiCache.cleanup();
}, 5 * 60 * 1000);

// Emergency cache controls for debugging
if (typeof global !== 'undefined') {
  global.apiCache = apiCache;
}