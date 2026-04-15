# Student Portal Troubleshooting Guide

## Common Issues and Solutions

### 1. Student Gets 404 Error

#### Symptoms
- Visiting `firstchord.co.uk/studentname` shows "Page Not Found"
- Or visiting `railway-app.com/studentname` shows Next.js 404

#### Possible Causes & Solutions

**A. Student not in URL mappings**
```javascript
// Check: lib/student-url-mappings.js
// Look for: 'studentname': 'sdt_XXXXXX'
// Solution: Add student to mappings
'newstudent': 'sdt_ABC123',
```

**B. Student not in security whitelist**
```javascript
// Check: lib/student-helpers.js
// Look for: 'sdt_XXXXXX' in VALID_STUDENT_IDS array
// Solution: Add student ID to whitelist
const VALID_STUDENT_IDS = [
  'sdt_ABC123', // New student
  // ...
];
```

**C. WordPress redirect not working**
- Visit `firstchord.co.uk/studentname` directly
- If redirects to wrong URL, check WordPress Redirection plugin
- Ensure regex pattern is: `^/([a-z-]+)/?$`

**D. Typo in friendly name**
- Check exact spelling in URL mappings
- Friendly names are case-sensitive (should be lowercase)
- No spaces allowed (use hyphens for multi-part names)

#### Diagnostic Steps
1. **Test direct Railway URL**: `railway-app.com/studentname`
2. **Check browser console** for JavaScript errors
3. **Verify student exists** in MMS system
4. **Check all mapping files** for typos

### 2. Student Portal Loads But Shows "Oops!" Message

#### Symptoms
- URL resolves correctly
- Shows music note emoji and "Oops!" message
- "We couldn't find your music dashboard"

#### Possible Causes & Solutions

**A. Invalid student ID in MMS**
```javascript
// Problem: Student ID doesn't exist in MMS
// Check: MMS system for correct student ID
// Solution: Update student-url-mappings.js with correct ID
```

**B. Student not active in MMS**
- Contact MMS admin to verify student enrollment
- Student may have been deactivated or archived

**C. API connection issues**
```javascript
// Check: lib/mms-client-cached.js
// Look for: Network errors or API timeouts
// Solution: Check Railway logs for API errors
```

#### Diagnostic Steps
1. **Check Railway application logs**
2. **Test MMS API** manually with student ID
3. **Verify student status** in MMS admin panel
4. **Check for API rate limiting**

### 3. Notes Section Shows "No recent notes available"

#### Symptoms
- Portal loads correctly
- Student info displays
- Notes section shows placeholder message

#### Possible Causes & Solutions

**A. Student genuinely has no notes**
- Check MMS lesson history
- Verify lessons have been conducted and notes added

**B. API caching issues**
```bash
# Clear cache and restart
rm -rf .next
npm run dev
```

**C. MMS API permissions**
- Verify API credentials in environment variables
- Check MMS API access permissions

**D. Student ID mismatch**
- Ensure student ID in mappings matches MMS exactly
- Check for extra spaces or incorrect characters

### 4. Soundslice Links Missing or Broken

#### Symptoms
- Portal loads correctly
- Soundslice section doesn't appear
- Or shows "No practice materials assigned"

#### Possible Causes & Solutions

**A. Student not in Soundslice mappings**
```javascript
// Check: lib/soundslice-mappings.js
// Add mapping if missing:
'sdt_ABC123': 'https://www.soundslice.com/courses/12345/',
```

**B. Incorrect Soundslice URL**
- Verify URL format: `https://www.soundslice.com/courses/[ID]/`
- Test URL manually in browser
- Contact tutor for correct course URL

**C. Student not enrolled in Soundslice course**
- Check Soundslice admin for student enrollment
- Verify student has access to assigned course

### 5. Theta Music Credentials Missing

#### Symptoms
- Portal loads correctly
- Theta Music section doesn't appear
- Student should have Theta access

#### Possible Causes & Solutions

**A. Student not in Theta credentials**
```javascript
// Check: lib/config/theta-credentials.js
// Add credentials if missing:
'sdt_ABC123': 'studentnamefc',
```

**B. Incorrect credential format**
- Standard format: `[firstname]fc`
- Special cases: `[firstname]firstchord`
- Check existing patterns for consistency

**C. Student not enrolled in Theta Music**
- Verify student has Theta account
- Contact Theta admin for enrollment status

### 6. Mobile Display Issues

#### Symptoms
- Portal looks wrong on mobile devices
- Text too small or too large
- Layout broken on small screens

#### Possible Causes & Solutions

**A. Viewport meta tag missing**
```javascript
// Check: app/layout.js
// Ensure this is present:
viewport: 'width=device-width, initial-scale=1'
```

**B. CSS responsive classes incorrect**
```javascript
// Check components for proper Tailwind classes:
// Good: text-lg sm:text-2xl
// Bad: text-2xl (not responsive)
```

**C. Logo positioning issues**
```javascript
// Check: StudentDashboard.js
// Ensure mobile-responsive positioning:
className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4"
```

### 7. Performance Issues / Slow Loading

#### Symptoms
- Portal takes long time to load
- API requests timing out
- Cached data not working

#### Possible Causes & Solutions

**A. Cache not working**
```javascript
// Check: lib/mms-client-cached.js
// Verify caching is enabled for student portals
// Look for: studentPortal: true flag
```

**B. API rate limiting**
- Check Railway logs for rate limit errors
- Verify MMS API usage limits
- Consider implementing request queuing

**C. Network issues**
- Test from different networks
- Check Railway status page
- Verify DNS resolution

### 8. WordPress Redirect Issues

#### Symptoms
- `firstchord.co.uk/studentname` doesn't redirect
- Redirects to wrong URL
- Conflicts with existing WordPress pages

#### Possible Causes & Solutions

**A. Regex pattern too broad**
```
// Current pattern: ^/([a-z-]+)/?$
// Problem: Catches existing pages like /handbook
// Solution: More specific pattern or exclusions
```

**B. Redirect plugin not active**
- Check WordPress Redirection plugin status
- Verify redirect rule is enabled
- Test rule with simple URL

**C. Caching conflicts**
- Clear WordPress cache
- Clear CDN cache if using one
- Test in incognito mode

### 9. Environment Variable Issues

#### Symptoms
- API calls failing
- Authentication errors
- Missing configuration

#### Possible Causes & Solutions

**A. Missing environment variables**
```bash
# Check Railway environment variables:
# - MMS_API_KEY
# - NEXTAUTH_URL
# - Other required variables
```

**B. Incorrect variable values**
- Verify API keys are current
- Check URL formats
- Test variables in development

## Diagnostic Tools

### 1. Browser Developer Tools
```javascript
// Open browser console and check for:
// - JavaScript errors
// - Network request failures
// - 404 responses
```

### 2. Railway Logs
```bash
# Access Railway dashboard
# View application logs for:
# - API errors
# - Server errors
# - Performance issues
```

### 3. Local Testing
```bash
# Run locally to isolate issues:
npm run dev
# Test at: http://localhost:3000/studentname
```

### 4. Direct API Testing
```javascript
// Test MMS API directly:
// Check if student ID returns data
// Verify API credentials work
```

## Quick Diagnostic Checklist

### For 404 Errors:
```
□ Student in student-url-mappings.js?
□ Student in VALID_STUDENT_IDS?
□ Friendly name spelled correctly?
□ WordPress redirect working?
□ No typos in student ID?
```

### For Loading Issues:
```
□ Student exists in MMS?
□ Student ID format correct (sdt_XXXXXX)?
□ API credentials valid?
□ Network connectivity OK?
□ Cache cleared?
```

### For Missing Content:
```
□ Soundslice mapping exists?
□ Theta credentials added?
□ URLs/credentials correct?
□ Student enrolled in services?
```

### For Display Issues:
```
□ Mobile viewport meta tag?
□ Responsive CSS classes?
□ Logo positioning correct?
□ Browser cache cleared?
```

## Emergency Fixes

### Quick Student Addition
```bash
# If student needs immediate access:
# 1. Add to mappings and whitelist
# 2. Push to git
# 3. Railway auto-deploys
# Total time: 2-3 minutes
```

### WordPress Redirect Emergency
```
# If WordPress redirects break:
# 1. Disable Redirection plugin temporarily
# 2. Students can use direct Railway URLs
# 3. Fix redirect pattern
# 4. Re-enable plugin
```

### Cache Issues Emergency
```bash
# If caching causes problems:
# 1. Clear .next directory
# 2. Restart development server
# 3. Clear browser cache
# 4. Test again
```

## Contact Information

### For API Issues:
- Check MMS system status
- Contact MMS support if needed
- Review API documentation

### For WordPress Issues:
- Access WordPress admin panel
- Check Redirection plugin logs
- Contact hosting provider if needed

### For Railway Issues:
- Check Railway status page
- Review deployment logs
- Contact Railway support if needed