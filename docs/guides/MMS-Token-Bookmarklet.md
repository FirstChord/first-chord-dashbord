# MMS Token Interceptor Bookmarklet

Copy this bookmarklet and save it as a bookmark in your browser. Then click it when you're on the MMS website to activate token capture:

```javascript
javascript:(function(){if(!window.mmsTokenInterceptorInstalled){const originalFetch=window.fetch;window.fetch=function(...args){if(args[0]&&typeof args[0]==='string'&&args[0].includes('api.mymusicstaff.com')){const options=args[1]||{};const authHeader=options.headers?.['Authorization']||options.headers?.['authorization'];if(authHeader&&authHeader.startsWith('Bearer ')){const token=authHeader.replace('Bearer ','');localStorage.setItem('mms_token',token);sessionStorage.setItem('mms_token',token);console.log('🎯 MMS Token captured!',token.substring(0,50)+'...');}}return originalFetch.apply(this,args);};window.mmsTokenInterceptorInstalled=true;console.log('✅ MMS Token Interceptor installed');alert('🎯 Token interceptor activated! Navigate MMS to capture tokens.');}else{alert('Token interceptor already active!');}})();
```

## How to use:
1. Copy the javascript code above (the whole line starting with `javascript:`)
2. Create a new bookmark in your browser
3. Paste the code as the URL
4. Name it "MMS Token Capture"
5. Go to app.mymusicstaff.com
6. Click the bookmark
7. Navigate around MMS (students, calendar, etc.)
8. Tokens will be captured and shared with the dashboard!
