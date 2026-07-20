# Music School Dashboard

Next.js app for the First Chord student portal, tutor dashboard, and internal admin operating dashboard.

Coding agents should start with [`AGENTS.md`](./AGENTS.md). For current active
admin-dashboard work, continue with:

```text
docs/CURRENT_STATUS.md
docs/architecture/system/admin-loop.md
```

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

## 📚 Documentation

**All documentation has been organized in the `/docs` directory.**

👉 **[Start here: Documentation Index](./docs/README.md)**

### Quick Links
- [Coding Agent Guide](./AGENTS.md)
- [Documentation Router](./docs/README.md)
- [Current System Status](./docs/CURRENT_STATUS.md)
- [Operations and Recovery Runbook](./docs/operations/runbook.md)

## 🛠️ Key Features

- **Student Portal Management** - Individual student portals with custom resources
- **Teacher Dashboard** - Class management and student tracking
- **Admin Operating Dashboard** - Waiting list, onboarding, issue loops, payment checks, pause checks, and recurring workflows
- **MMS Integration** - My Music Staff API integration
- **Google Sheets Sync** - Automated data synchronization
- **Student Registry** - CSV-based student configuration system

## 📦 Tech Stack

- **Framework**: Next.js 15.4
- **Runtime**: Node.js 20+
- **UI**: React 19, Tailwind CSS 4
- **APIs**: MMS API, Google Sheets API
- **Deployment**: Railway

## 🔧 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test:admin` - Generate configs and run the deterministic admin suite
- `npm run docs:check` - Validate documentation structure, lifecycle metadata, and links
- `npm run lint` - Lint the Next application surface
- `npm run hygiene:check` - Report repository maintenance signals
- `npm run validate` - Validate student registry
- `npm run generate-configs` - Generate config files from registry

## 📂 Project Structure

```
/app          - Next.js app router pages
/components   - React components
/lib          - Utilities and API clients
/docs         - All documentation
/scripts      - Maintenance and migration scripts
/tests        - Deterministic admin and portal tests
/tools        - Optional local integration tools
```

## 🆘 Need Help?

See the [Operations Runbook](./docs/operations/runbook.md),
[Incident Notes](./docs/operations/incidents/bug-fixes.md), or
[Documentation Router](./docs/README.md).

---

**Last Updated**: July 2026
