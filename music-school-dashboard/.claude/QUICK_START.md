# Quick Start for Claude Agents

Welcome! This dashboard has been optimized for efficient collaboration.

## 📍 Start Here

1. **Documentation Hub**: [docs/INDEX.md](../docs/INDEX.md)
2. **Quick Skills**: [.claude/skills/README.md](skills/README.md)
3. **Project Overview**: [README.md](../README.md)

## 🎯 Common Tasks

### Adding a Student
See: [.claude/skills/add-student.md](skills/add-student.md)

Quick steps:
1. Update `students-registry.csv`
2. Run `npm run generate-configs`
3. Run `npm run validate`

### Deploying Changes
See: [.claude/skills/deploy.md](skills/deploy.md)

Quick steps:
1. Run `npm run validate`
2. Run `npm run build`
3. `git push origin main` (auto-deploys)

### Troubleshooting
See: [.claude/skills/troubleshoot.md](skills/troubleshoot.md)

First step: `npm run validate`

## 📂 Project Structure

```
/app          - Next.js pages and API routes
/components   - React components
/lib          - Utilities and API clients
  /config     - Student and service configs (auto-generated)
/data         - Student data
/docs         - All documentation (organized by type)
  /guides     - How-to guides
  /protocols  - Standard procedures
  /workflows  - Step-by-step workflows
  /archives   - Historical documentation
/scripts      - Maintenance scripts
  /testing    - Test utilities
  /utilities  - One-off tools
/.claude      - Claude-specific documentation
  /skills     - Quick reference guides
```

## 🔑 Key Files

- `students-registry.csv` - Master student list (source of truth)
- `lib/config/students-registry.js` - Auto-generated from CSV
- `lib/student-url-mappings.js` - Student portal URL mappings
- `lib/mms-client.js` - MMS API client
- `docs/INDEX.md` - Complete documentation index

## 🚀 Development Workflow

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Validate student data
npm run validate

# Generate configs from registry
npm run generate-configs

# Build for production
npm run build

# Analyze bundle size
npm run analyze
```

## 🎨 Code Style

- **Clean & Minimal** - Organizational changes only
- **Well-Documented** - Comprehensive docs in `/docs`
- **Safe Caching** - Multi-layer cache system in `/lib`
- **Type-Safe** - TypeScript throughout

## 🔧 Environment Variables

Required in `.env.local`:
- `MMS_API_KEY` - My Music Staff API key
- `GOOGLE_SHEETS_CREDENTIALS` - For Sheets sync (optional)

## 📝 Recent Optimizations (Jan 2026)

✅ Documentation consolidated and organized
✅ Claude skills created for recurring tasks
✅ Test and utility files properly organized
✅ Clean root directory structure
✅ No breaking changes - all functionality preserved

See: [CLEANUP_SUMMARY.md](../CLEANUP_SUMMARY.md)

---

**Need Help?** Check [docs/TROUBLESHOOTING_GUIDE.md](../docs/TROUBLESHOOTING_GUIDE.md)
