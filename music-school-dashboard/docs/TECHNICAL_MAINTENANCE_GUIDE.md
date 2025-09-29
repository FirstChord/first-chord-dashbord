# Technical Maintenance Guide

## Overview
This guide covers ongoing maintenance, monitoring, and technical updates for the student portal system. Follow these procedures to ensure optimal performance and reliability.

## Daily Maintenance (5 minutes)

### System Health Check
```bash
# 1. Check Railway app status
# Visit: https://efficient-sparkle-production.up.railway.app
# Verify: Main dashboard loads correctly

# 2. Test random student portals
# Test 2-3 URLs like: firstchord.co.uk/mathilde
# Verify: Redirects work and portals load

# 3. Check for deployment issues
# Visit: Railway dashboard → deployments
# Look for: Any failed deployments or errors
```

### Performance Monitoring
```bash
# Check cache performance indicators
# Look for: Cache hit rates in application logs
# Expected: 90%+ cache hit rate for student portals
# Alert if: Cache hit rate drops below 80%
```

## Weekly Maintenance (15 minutes)

### 1. WordPress Redirect Monitoring
```bash
# Access WordPress admin
# Go to: Tools → Redirection → Logs
# Review: Past week's redirect activity
# Look for: Failed redirects or unusual patterns
# Action: Investigate any 404s or redirect failures
```

### 2. Student Portal Usage Analysis
```bash
# Check Railway application logs for:
# - Most accessed student portals
# - Any 404 errors for student URLs
# - API response times and errors
# - Cache performance metrics
```

### 3. Security Review
```bash
# Monitor for:
# - Unusual access patterns
# - Automated attacks on student URLs
# - Failed authentication attempts
# - Suspicious IP addresses

# Check logs for:
# - Multiple 404s from same IP
# - Attempts to access non-existent students
# - Brute force patterns
```

## Monthly Maintenance (30 minutes)

### 1. Database Cleanup
```bash
# WordPress Redirection Logs
# Go to: Tools → Redirection → Options
# Clear: Logs older than 30 days
# Export: Current redirect rules for backup

# Railway Application Logs
# Review: Monthly log summaries
# Archive: Important error patterns
```

### 2. Performance Optimization Review
```bash
# Analyze cache performance:
# - Average response times
# - Cache hit/miss ratios
# - Memory usage patterns
# - Database query performance

# MMS API Performance:
# - API response times
# - Error rates
# - Rate limiting issues
# - Data freshness
```

### 3. Backup Verification
```bash
# Verify backups exist for:
# - WordPress redirect configuration
# - Railway application code
# - Student mapping files
# - Configuration files

# Test backup restoration process quarterly
```

## Quarterly Maintenance (1 hour)

### 1. System Updates
```bash
# Update Dependencies
npm audit                    # Check for security vulnerabilities
npm update                   # Update packages (test first!)
npm run build               # Verify build still works

# WordPress Updates
# Update WordPress core
# Update Redirection plugin
# Test redirect functionality after updates
```

### 2. Student Data Audit
```bash
# Review student mappings for:
# - Inactive students (remove from system)
# - New students (add to system)
# - Changed names or conflicts
# - Updated tutor assignments

# Files to review:
# - lib/student-url-mappings.js
# - lib/student-helpers.js
# - lib/soundslice-mappings.js
# - lib/config/theta-credentials.js
```

### 3. Performance Baseline Testing
```bash
# Test load times for:
# - 10 random student portals
# - Peak usage times
# - Different geographic locations
# - Mobile vs desktop performance

# Document baseline metrics
# Compare to previous quarter
# Identify performance trends
```

## Critical System Updates

### Adding Multiple Students (Bulk Update)
```bash
# 1. Prepare data in spreadsheet format
# Name | MMS_ID | Tutor | Soundslice_URL | Theta_Needed

# 2. Update mapping files in order:
# - student-url-mappings.js (add all names)
# - student-helpers.js (add all IDs to whitelist)
# - soundslice-mappings.js (add courses)
# - theta-credentials.js (add credentials)

# 3. Test batch of 5 students locally
# 4. Deploy and test 5 students live
# 5. Roll out remaining students

# 6. Verify all students work correctly
```

### Railway App Updates
```bash
# 1. Test changes locally first
npm run dev
# Test critical student portals

# 2. Deploy during low-usage time
# Usually early morning or late evening

# 3. Monitor deployment logs
# Watch for errors during deployment

# 4. Test immediately after deployment
# Verify 5-10 random student portals work

# 5. Monitor for 30 minutes after deployment
# Check for increased error rates
```

### WordPress Major Updates
```bash
# 1. Create full WordPress backup
# 2. Test update on staging site first
# 3. Update during maintenance window
# 4. Test redirect functionality immediately
# 5. Monitor redirect logs for issues
# 6. Rollback plan ready if needed
```

## Monitoring and Alerting

### Key Metrics to Track
```bash
# Application Performance
- Average student portal load time: <2 seconds
- Cache hit rate: >90%
- API error rate: <1%
- 404 rate for student URLs: <5%

# WordPress Redirects
- Redirect success rate: >98%
- Average redirect time: <500ms
- Failed redirect rate: <2%

# System Health
- Uptime: >99.5%
- Memory usage: <80%
- CPU usage: <70%
- Disk space: <80%
```

### Alert Thresholds
```bash
# Immediate alerts (within 5 minutes):
- Application down/unreachable
- Cache hit rate drops below 70%
- Error rate exceeds 5%
- Mass redirect failures

# Warning alerts (within 1 hour):
- Slow response times (>5 seconds)
- Cache hit rate drops below 85%
- Increased 404 rates
- WordPress redirect issues
```

### Monitoring Tools Setup
```bash
# Railway Built-in Monitoring
# - Application metrics
# - Deployment status
# - Resource usage
# - Error logs

# External Monitoring (Optional)
# - UptimeRobot for uptime monitoring
# - Google Analytics for usage tracking
# - CloudFlare analytics if using CDN
```

## Emergency Procedures

### Student Portal Outage
```bash
# 1. Check Railway app status
# 2. Check WordPress redirect functionality
# 3. Identify scope of outage (single student vs all)
# 4. Implement temporary fix:
#    - Direct students to Railway URLs if WordPress issue
#    - Disable problematic redirect rules if needed
# 5. Fix root cause
# 6. Monitor for continued issues
```

### Mass Student Portal Failures
```bash
# Likely causes:
# - API authentication failure
# - Database connection issues
# - Cache system failure
# - Security whitelist corruption

# Quick diagnosis:
# 1. Test direct Railway URLs
# 2. Check application logs
# 3. Verify API credentials
# 4. Test database connectivity

# Emergency fixes:
# 1. Restart Railway application
# 2. Clear cache systems
# 3. Revert recent code changes
# 4. Switch to backup systems if available
```

### WordPress Redirect Failures
```bash
# 1. Test direct student portal URLs
# 2. Check WordPress admin access
# 3. Verify Redirection plugin status
# 4. Review recent redirect rule changes
# 5. Temporary workaround: Direct Railway URLs
# 6. Fix WordPress issues
# 7. Test redirect restoration
```

## Code Maintenance

### Version Control Best Practices
```bash
# Branch Strategy
main                    # Production branch (auto-deploys)
student-updates        # Branch for student additions
feature/new-feature    # Feature development branches

# Commit Message Format
"Add student portal for [Student Name] (/[friendlyurl])

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Code Review Checklist
```bash
# When adding new students:
□ Student in all required mapping files
□ No typos in student ID or friendly name
□ Friendly name follows naming conventions
□ No conflicts with existing names
□ Security whitelist updated
□ Tested locally before deployment

# When modifying system:
□ Backward compatibility maintained
□ Error handling preserved
□ Mobile responsiveness maintained
□ Performance impact assessed
□ Security implications reviewed
```

### Documentation Updates
```bash
# Keep documentation current:
# - Update student counts in overview docs
# - Document new features or changes
# - Update troubleshooting guides with new issues
# - Maintain file structure documentation
# - Update WordPress setup if procedures change
```

## Performance Optimization

### Caching Strategy
```bash
# Current caching layers:
# 1. MMS API response caching (97% hit rate)
# 2. Next.js automatic caching
# 3. Browser caching for static assets
# 4. WordPress page caching (if enabled)

# Optimization opportunities:
# - CDN for static assets
# - Database query optimization
# - Image optimization
# - Bundle size reduction
```

### Database Optimization
```bash
# WordPress Database
# - Clear old redirect logs monthly
# - Optimize database tables quarterly
# - Monitor database size growth
# - Index optimization for redirect queries

# Application Database (if added)
# - Monitor query performance
# - Optimize slow queries
# - Regular maintenance tasks
```

## Security Maintenance

### Regular Security Tasks
```bash
# Monthly:
# - Review access logs for suspicious activity
# - Update WordPress and plugins
# - Check for security vulnerabilities in dependencies
# - Verify SSL certificates are current

# Quarterly:
# - Security audit of student access patterns
# - Review API key security
# - Check for exposed credentials
# - Update security documentation
```

### Incident Response Plan
```bash
# Security Incident Procedure:
# 1. Identify scope and severity
# 2. Contain the incident (block IPs, disable features)
# 3. Assess impact on student data/access
# 4. Fix security vulnerability
# 5. Monitor for continued issues
# 6. Document incident and lessons learned
```

This comprehensive maintenance guide ensures the student portal system remains reliable, secure, and performant over time.