# WordPress Redirect Setup Guide

## Overview
This guide covers setting up WordPress redirects to enable friendly URLs like `firstchord.co.uk/mathilde` that redirect to the Railway app at `efficient-sparkle-production.up.railway.app/mathilde`.

## Prerequisites
- WordPress website with admin access
- Railway app deployed and functional
- Basic understanding of WordPress admin panel

## Plugin Installation

### Step 1: Install Redirection Plugin
1. **Access WordPress Admin**
   - Go to `firstchord.co.uk/wp-admin`
   - Login with admin credentials

2. **Navigate to Plugins**
   - Click "Plugins" → "Add New"
   - Search for "Redirection"
   - Look for plugin by John Godley

3. **Install and Activate**
   - Click "Install Now"
   - Click "Activate"

### Step 2: Initial Plugin Setup
1. **Go to Redirection Settings**
   - Navigate to "Tools" → "Redirection"
   - Click "Start Setup" if first time

2. **Choose Setup Type**
   - Select "Manual Setup" (recommended)
   - This gives more control over configuration

3. **Database Setup**
   - Plugin will create necessary database tables
   - Wait for setup to complete

## Redirect Rule Configuration

### Step 3: Create the Student Portal Redirect Rule

1. **Navigate to Redirects**
   - Go to "Tools" → "Redirection"
   - Click "Redirects" tab
   - Click "Add new redirection"

2. **Configure the Redirect Rule**
   ```
   Source URL: ^/([a-z-]+)/?$
   Query Parameters: Leave blank
   Target URL: https://efficient-sparkle-production.up.railway.app/$1
   Group: Redirections (default)
   ```

3. **Enable Regex Option**
   - ✅ Check "Regex" checkbox
   - This is CRITICAL for the pattern to work

4. **Set HTTP Code**
   - Select "301 - Moved Permanently"
   - This is best for SEO

5. **Save the Rule**
   - Click "Add Redirect"

### Step 4: Understanding the Regex Pattern

#### Pattern Breakdown: `^/([a-z-]+)/?$`
```
^          - Start of string
/          - Literal forward slash
(          - Start capture group
[a-z-]     - Match lowercase letters and hyphens
+          - One or more of the above characters
)          - End capture group
/?         - Optional trailing slash
$          - End of string
```

#### What This Pattern Matches:
- ✅ `/mathilde` → Captures `mathilde`
- ✅ `/stella-c` → Captures `stella-c` 
- ✅ `/alex/` → Captures `alex` (trailing slash OK)
- ❌ `/Mathilde` → Doesn't match (uppercase)
- ❌ `/123` → Doesn't match (numbers)
- ❌ `/existing-page` → May conflict with WordPress pages

#### Target URL Explanation: `https://efficient-sparkle-production.up.railway.app/$1`
- `$1` represents the captured group from the source pattern
- `/mathilde` becomes `https://...railway.app/mathilde`

## Preventing Conflicts with Existing Pages

### Current WordPress Pages to Protect
```
/handbook    - Existing WordPress page
/about       - Existing WordPress page  
/contact     - Existing WordPress page
/lessons     - Existing WordPress page
```

### Method 1: Exclude Specific Pages (Recommended)
Update the regex pattern to exclude known pages:
```
^/(?!handbook|about|contact|lessons)([a-z-]+)/?$
```

This pattern means: "Match any lowercase/hyphen string EXCEPT handbook, about, contact, or lessons"

### Method 2: Use More Specific Pattern
Only match student-specific patterns:
```
^/(student-[a-z-]+|[a-z]+-[a-z]|[a-z]{3,})/?$
```

This matches:
- Students with hyphens: `stella-c`, `charlie-g`
- Long names (3+ chars): `mathilde`, `leonardo`
- Prefixed students: `student-alex`

### Method 3: Prefix All Student URLs
Change all student URLs to use prefix:
```
Source: ^/student/([a-z-]+)/?$
Target: https://efficient-sparkle-production.up.railway.app/$1
```

Students would access: `firstchord.co.uk/student/mathilde`

## Testing the Redirect Setup

### Step 5: Test Redirect Functionality

1. **Test in Incognito Mode**
   - Open browser incognito window
   - Visit `firstchord.co.uk/mathilde`
   - Should redirect to Railway app
   - Check URL changes to Railway domain

2. **Test Different Student Names**
   ```
   Test URLs:
   - firstchord.co.uk/alex
   - firstchord.co.uk/stella-c
   - firstchord.co.uk/pablo
   ```

3. **Test Edge Cases**
   ```
   Should work:
   - firstchord.co.uk/mathilde/
   - firstchord.co.uk/stella-c
   
   Should NOT redirect:
   - firstchord.co.uk/handbook
   - firstchord.co.uk/MATHILDE (uppercase)
   ```

4. **Check Redirect Headers**
   - Use browser dev tools Network tab
   - Verify 301 redirect response
   - Confirm target URL is correct

### Step 6: Monitor Redirect Logs

1. **Access Redirection Logs**
   - Go to "Tools" → "Redirection"
   - Click "Logs" tab
   - Monitor successful redirects

2. **Check for Issues**
   - Look for failed redirects
   - Monitor 404 errors
   - Check for unexpected matches

## Backup and Maintenance

### Backup Current Configuration
1. **Export Redirect Rules**
   - Go to "Tools" → "Redirection"
   - Click "Import/Export" tab
   - Click "Export" to download rules

2. **Save Configuration Details**
   ```
   Current Pattern: ^/([a-z-]+)/?$
   Target URL: https://efficient-sparkle-production.up.railway.app/$1
   Type: 301 Redirect
   Group: Redirections
   Regex: Enabled
   ```

### Regular Maintenance Tasks

1. **Monitor Logs Weekly**
   - Check for failed redirects
   - Look for unexpected patterns
   - Clear old log entries

2. **Test After WordPress Updates**
   - Plugin may need reactivation
   - Rules may need reconfiguration
   - Test sample student URLs

3. **Update Target URL if Railway Changes**
   - If Railway app URL changes
   - Update target URL in redirect rule
   - Test all student portals

## Advanced Configuration

### Custom Error Handling
If redirect fails, user sees WordPress 404 page. To customize:

1. **Create Custom 404 Page**
   - Design student-friendly error page
   - Include contact information
   - Add link to try Railway URL directly

2. **Log Failed Redirects**
   - Monitor which URLs fail
   - Identify missing students
   - Track usage patterns

### Performance Optimization

1. **Cache Considerations**
   - CDN may cache redirects
   - Clear cache after rule changes
   - Test from different locations

2. **Database Optimization**
   - Redirection plugin stores logs in database
   - Clear old logs regularly
   - Monitor database size

## Security Considerations

### Protecting Against Abuse
1. **Pattern Validation**
   - Current pattern only allows safe characters
   - Prevents injection attacks
   - Limits to expected format

2. **Monitoring Unusual Traffic**
   - Watch for suspicious redirect patterns
   - Monitor for automated attacks
   - Block malicious IPs if needed

### SSL/HTTPS Handling
1. **Ensure HTTPS Redirects**
   - Target URL uses HTTPS
   - WordPress site uses HTTPS
   - No mixed content warnings

## Troubleshooting Common Issues

### Redirect Not Working
1. **Check regex checkbox is enabled**
2. **Verify pattern syntax**
3. **Clear WordPress cache**
4. **Test in incognito mode**

### Conflicts with Existing Pages
1. **Use negative lookahead in pattern**
2. **Change student URL structure**
3. **Add page exclusions**

### Performance Issues
1. **Check redirect logs size**
2. **Clear old log entries**
3. **Monitor database performance**

### SSL Certificate Issues
1. **Verify Railway app has valid SSL**
2. **Check HTTPS enforcement**
3. **Test mixed content warnings**

## Integration with Student Portal System

### When Adding New Students
1. **No WordPress changes needed** (usually)
2. **Pattern automatically handles new names**
3. **Test new student URL after Railway deployment**

### When Changing URL Structure
1. **Update redirect pattern**
2. **Test all existing students**
3. **Update documentation**

### Emergency Procedures
1. **Disable plugin temporarily** if issues arise
2. **Students can use direct Railway URLs**
3. **Fix and re-enable quickly**

## Monitoring and Analytics

### Track Redirect Usage
1. **WordPress redirect logs**
2. **Google Analytics UTM parameters**
3. **Railway application logs**

### Key Metrics to Monitor
- Number of successful redirects per day
- Failed redirect attempts
- Most accessed student portals
- Geographic distribution of access

This completes the WordPress redirect setup for the student portal system.