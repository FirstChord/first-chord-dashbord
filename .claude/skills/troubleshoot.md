# Troubleshoot Skill

Quick diagnostics for common issues.

## Student Portal Not Loading

1. **Check Registry**
   ```bash
   grep -i "studentName" students-registry.csv
   ```

2. **Verify Config Generated**
   ```bash
   ls lib/config/students/
   ```

3. **Check Student URL Mappings**
   - Open `lib/student-url-mappings.js`
   - Search for student name

## API Issues

### MMS API Failing
```bash
# Test MMS endpoint
node scripts/testing/test-mms.js
```

Check:
- API key in `.env`
- API quota limits
- Network connectivity

### Google Sheets Sync Failing
```bash
# Test Sheets connection
node scripts/testing/test-google-sheets-fallback.js
```

Check:
- Credentials file exists
- Sheet ID is correct
- Service account has access

## Build Errors

1. **Clear Cache**
   ```bash
   rm -rf .next
   npm run build
   ```

2. **Check Dependencies**
   ```bash
   npm install
   ```

3. **Validate Student Data**
   ```bash
   npm run validate
   ```

## Performance Issues

1. **Check API Cache**
   - Review `lib/api-cache.js` settings
   - Default: 5 minutes cache

2. **Analyze Bundle**
   ```bash
   npm run analyze
   ```

## Quick Commands

```bash
# Full reset (careful!)
rm -rf .next node_modules
npm install
npm run build

# Validate everything
npm run validate

# Test locally
npm run dev
```

See `docs/TROUBLESHOOTING_GUIDE.md` for detailed diagnostics.
