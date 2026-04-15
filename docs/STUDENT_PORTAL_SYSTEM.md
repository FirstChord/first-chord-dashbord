# Student Portal System Documentation

## Overview

The Student Portal System provides personalized dashboards for 160+ music students with friendly URL access. Students can access their portals using simple names like `firstchord.co.uk/mathilde` instead of complex Railway URLs.

## System Architecture

### Flow Diagram
```
WordPress Website (firstchord.co.uk)
     ↓ (WordPress Redirection Plugin)
Railway App (efficient-sparkle-production.up.railway.app)
     ↓ (Next.js App Router)
Dynamic Route Handler (/[studentName]/page.js)
     ↓ (URL Mapping System)
Student Dashboard Component
     ↓ (API Integration)
MMS API + Soundslice + Theta Music
```

### Core Components

1. **WordPress Redirection Layer**
   - Redirects `firstchord.co.uk/[name]` → `railway-app.com/[name]`
   - Uses regex pattern `^/([a-z-]+)/?$` for validation

2. **Next.js App Router**
   - Root-level dynamic route: `app/[studentName]/page.js`
   - Handles friendly URL resolution and 404s

3. **URL Mapping System**
   - Maps friendly names to MMS student IDs
   - Handles name conflicts with last initials (e.g., `stella-c`, `stella-f`)

4. **Security Layer**
   - Whitelist of valid student IDs in `student-helpers.js`
   - Prevents unauthorized access

5. **Data Integration**
   - MMS API for lesson notes (with caching)
   - Soundslice for practice materials
   - Theta Music for student credentials

## Key Files and Their Purposes

### Core System Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `app/[studentName]/page.js` | Root-level dynamic routing | Handles `/alex`, `/mathilde` URLs |
| `lib/student-url-mappings.js` | Friendly URL mappings | Maps names to student IDs |
| `lib/student-helpers.js` | Security & data fetching | Whitelist validation, MMS integration |
| `lib/soundslice-mappings.js` | Practice materials | Soundslice course assignments |
| `lib/config/theta-credentials.js` | Student credentials | Theta Music login details |

### UI Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `StudentDashboard.js` | Main portal layout | `components/student-portal/` |
| `StudentNotes.js` | Lesson notes display | `components/student-portal/` |
| `StudentLinks.js` | Practice links & credentials | `components/student-portal/` |

## URL Mapping System

### Friendly Name Format
- **Single names**: `mathilde`, `alex`, `pablo`
- **Conflict resolution**: `stella-c`, `stella-f`, `charlie-g`, `charlie-m`
- **Special characters**: Use hyphens for conflicts only

### Example Mappings
```javascript
'mathilde': 'sdt_H6CvJv',     // Mathilde thallon
'alex': 'sdt_gwyQJr',         // Alex Chang
'stella-c': 'sdt_x48LJT',     // Stella Cook
'stella-f': 'sdt_Nt4LJ3',     // Stella French
```

## Security Model

### Student ID Whitelist
- All 160 students must be in `VALID_STUDENT_IDS` array
- Security check in `isValidStudentId()` function
- Prevents access to non-enrolled students

### Access Flow
1. User visits friendly URL (e.g., `/mathilde`)
2. System validates friendly name exists
3. Maps to student ID and validates against whitelist
4. Fetches student data if authorized
5. Displays personalized dashboard

## Performance Features

### Caching System
- MMS API responses cached for student portals
- Cache hits reduce load times by 97% (26-33x faster)
- Optimized specifically for student portal requests

### Mobile Optimization
- Responsive design with Tailwind CSS
- Mobile-first approach for student accessibility
- Logo positioning and size adapted for mobile

## WordPress Integration

### Redirection Plugin Setup
1. Install WordPress Redirection plugin
2. Create regex redirect rule:
   - **Source**: `^/([a-z-]+)/?$`
   - **Target**: `https://efficient-sparkle-production.up.railway.app/$1`
   - **Type**: 301 redirect
3. Enable regex matching option

### URL Pattern Handling
- Supports lowercase letters and hyphens
- Prevents conflicts with existing WordPress pages
- Handles trailing slashes automatically

## Deployment Process

### Railway Deployment
1. Commit changes to git repository
2. Railway auto-deploys from main branch
3. New students immediately accessible

### WordPress Updates
- Update redirect pattern if new character types needed
- Test redirect functionality after changes

## Current Statistics
- **Total Students**: 160
- **Name Conflicts Resolved**: 15+ (using last initial system)
- **Performance Improvement**: 97% faster with caching
- **Mobile-Responsive**: Yes
- **Security**: Whitelist-based access control