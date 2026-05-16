# FirstChord Dashboard Documentation

## Overview

This repository now contains three connected surfaces:

- **Student portal**: individual student pages, friendly URLs, portal registry, Soundslice and Theta links.
- **Tutor dashboard**: teacher-facing student views and teaching resources.
- **Admin operating dashboard**: internal `/admin` system for closing operational loops and adding V4 context layers.

For current admin-dashboard work, always start with:

- [admin/CURRENT_STATUS.md](./admin/CURRENT_STATUS.md)
- [admin/INDEX.md](./admin/INDEX.md)
- [admin/ADMIN_IMPLEMENTATION_LOG.md](./admin/ADMIN_IMPLEMENTATION_LOG.md)

Older portal docs are still useful, but they are not the authority for the current V4 admin direction.

## Current Admin Model

V3 established the loop-closing pattern:

```text
Detected -> Guided -> Actioned -> Logged -> Resolved / Kept Active
```

V4 is adding lightweight context layers:

- lifecycle status
- schedule context
- payment value context
- capacity context
- waiting-list placement context
- scalable navigation

The admin top nav is intentionally short:

```text
Overview | Issues | Workflows | Planning
```

Student records remain important, but they are reached through header search, issue links, workflow links, or `/admin/students` rather than being a primary top-nav mode.

## Documentation Index

### Current Admin Work

- [Admin Current Status](./admin/CURRENT_STATUS.md)
- [Admin Docs Index](./admin/INDEX.md)
- [Admin Implementation Log](./admin/ADMIN_IMPLEMENTATION_LOG.md)
- [V3 Loop Architecture](./admin/V3_LOOP_ARCHITECTURE.md)
- [Ownership Matrix](./admin/OWNERSHIP_MATRIX.md)
- [Payments Rules](./admin/PAYMENTS_RULES.md)

### Student Portal And Registry

- [Student Portal System](./STUDENT_PORTAL_SYSTEM.md)
- [Student Registry Guide](./STUDENT_REGISTRY_GUIDE.md)
- [Adding New Students](./workflows/01-adding-students.md)
- [Managing Portals](./workflows/02-managing-portals.md)
- [Validation Guide](./VALIDATION_GUIDE.md)
- [WordPress Redirect Setup](./WORDPRESS_REDIRECT_SETUP.md)

### Operations And Setup

- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)
- [Deployment Checklist](./workflows/04-deployment-checklist.md)
- [Google Sheets Setup](./guides/GOOGLE_SHEETS_SETUP_GUIDE.md)
- [Google Sheets Schema](./guides/GOOGLE_SHEETS_SCHEMA.md)
- [API Usage Guide](./guides/EFFICIENT_API_USAGE_GUIDE.md)
- [MMS Token Bookmarklet](./guides/MMS-Token-Bookmarklet.md)

## Source Of Truth Summary

- Google Sheets `Students` = operational school truth
- `lib/config/students-registry.js` = portal/dashboard registry truth
- MMS = lesson, waiting-list, billing-profile, and calendar operational truth
- MMS calendar category `Free` = real current free-slot truth
- Stripe = payment-provider truth
- `Issue_Queue` = persistent issue workflow state
- `Event_Log` = append-only issue/action history
- `Schedule_Context` = dashboard cache of selected MMS lesson context
- `Pause History` = intentional pause-window truth

## Maintenance Notes

- Keep `admin/CURRENT_STATUS.md` current after each meaningful admin slice.
- Use `admin/ADMIN_IMPLEMENTATION_LOG.md` for chronological implementation detail.
- Treat old V1/V2 admin docs and older student-portal docs as background unless current docs explicitly point to them.
- Before deployment, run:

```bash
npm run test:admin
npm run build
```

**Last Updated**: May 2026
