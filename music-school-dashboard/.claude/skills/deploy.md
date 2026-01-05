# Deploy Skill

Quick reference for deploying updates to production.

## Pre-Deploy Checklist

1. **Validate Registry**
   ```bash
   npm run validate
   ```

2. **Test Build**
   ```bash
   npm run build
   ```

3. **Check for Errors**
   - No build errors
   - No validation errors
   - Test critical paths locally

## Deployment Commands

### Railway (Current Primary)
```bash
# Automatic on git push to main
git add .
git commit -m "feat: [description]"
git push origin main
```

### Vercel (Alternative)
```bash
vercel --prod
```

## Post-Deploy

1. **Verify Deployment**
   - Check deployment logs
   - Visit production URL
   - Test 2-3 student portals randomly

2. **Monitor**
   - Watch for error logs (first 5 minutes)
   - Check API quotas if using external services

## Rollback (if needed)

Railway:
- Go to Railway dashboard
- Select previous deployment
- Click "Redeploy"

## Environment Variables

Required:
- `MMS_API_KEY`
- `GOOGLE_SHEETS_CREDENTIALS` (if using Sheets sync)
- `NODE_ENV=production`

See `docs/protocols/DEPLOYMENT_PROTOCOLS.md` for full details.
