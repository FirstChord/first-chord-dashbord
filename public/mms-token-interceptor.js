// MMS Token Interceptor - Run this script on app.mymusicstaff.com
// This captures tokens and stores them for cross-tab sharing with the dashboard

console.log('🚀 MMS Token Interceptor loaded!');

// Intercept fetch calls on MMS website
if (!window.mmsTokenInterceptorInstalled) {
  const originalFetch = window.fetch;
  
  window.fetch = function(...args) {
    // Check if this is an MMS API call
    if (args[0] && typeof args[0] === 'string' && args[0].includes('api.mymusicstaff.com')) {
      const options = args[1] || {};
      const authHeader = options.headers?.['Authorization'] || options.headers?.['authorization'];
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        
        // Store in localStorage for cross-tab sharing
        localStorage.setItem('mms_token', token);
        sessionStorage.setItem('mms_token', token);
        
        console.log('🎯 MMS Token captured and stored for dashboard!', token.substring(0, 50) + '...');
        
        // Optional: Show visual confirmation
        showTokenCapturedNotification();
      }
    }
    
    return originalFetch.apply(this, args);
  };
  
  window.mmsTokenInterceptorInstalled = true;
  console.log('✅ MMS Token Interceptor installed on MMS website');
}

// Show a brief visual notification when token is captured
function showTokenCapturedNotification() {
  // Only show notification once per page load
  if (window.tokenNotificationShown) return;
  window.tokenNotificationShown = true;
  
  const notification = document.createElement('div');
  notification.innerHTML = '🎯 Token captured for Dashboard!';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Also capture any existing token from the page if available
try {
  // Try to find token in existing requests or page data
  const performanceEntries = performance.getEntriesByType('navigation');
  console.log('🔍 Checking for existing tokens...');
} catch (e) {
  console.log('Token check skipped');
}
