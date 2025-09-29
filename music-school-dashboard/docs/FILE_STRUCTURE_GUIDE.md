# Student Portal File Structure Guide

## Core System Files

### 1. Dynamic Route Handler
**File**: `app/[studentName]/page.js`
```javascript
// Purpose: Handles root-level friendly URLs like /alex, /mathilde
// Key Functions:
// - Validates friendly name format
// - Maps friendly name to student ID
// - Fetches student data
// - Renders dashboard or 404 page

export default async function RootStudentPage({ params }) {
  const resolvedParams = await params;
  const friendlyName = resolvedParams.studentName;
  
  // Validation and data fetching logic
}
```

**When to modify**: When changing URL validation rules or adding new routing logic.

### 2. URL Mapping System
**File**: `lib/student-url-mappings.js`
```javascript
// Purpose: Maps friendly names to MMS student IDs
// Contains: 160+ student mappings with conflict resolution

export const STUDENT_URL_MAPPINGS = {
  'mathilde': 'sdt_H6CvJv',     // Single name
  'stella-c': 'sdt_x48LJT',     // Conflict resolution
  'stella-f': 'sdt_Nt4LJ3',     // Different Stella
  // ... 160 total students
};

// Helper functions for URL resolution
export function getStudentIdFromUrl(friendlyName) { ... }
export function isValidFriendlyName(friendlyName) { ... }
```

**When to modify**: When adding new students or resolving name conflicts.

### 3. Security & Data Layer
**File**: `lib/student-helpers.js`
```javascript
// Purpose: Security validation and student data fetching
// Key Components:
// - VALID_STUDENT_IDS array (160 students)
// - Security validation functions
// - MMS API integration with caching

const VALID_STUDENT_IDS = [
  'sdt_H6CvJv', // Mathilde
  'sdt_gwyQJr', // Alex
  // ... all 160 students
];

export function isValidStudentId(studentId) { ... }
export async function getStudentData(studentId) { ... }
```

**When to modify**: When adding new students (must update whitelist) or changing data fetching logic.

### 4. Soundslice Integration
**File**: `lib/soundslice-mappings.js`
```javascript
// Purpose: Maps student IDs to Soundslice practice courses
// Organized by tutor for easy maintenance

const SOUNDSLICE_MAPPINGS = {
  // Finn's students
  'sdt_H6CvJv': 'https://www.soundslice.com/courses/9009/', // Mathilde
  'sdt_gwyQJr': 'https://www.soundslice.com/courses/4370/', // Alex
  
  // Dean's students
  'sdt_BMt3JD': 'https://www.soundslice.com/courses/7751/', // Adam
  // ... organized by tutor
};
```

**When to modify**: When students get new Soundslice courses or change tutors.

### 5. Theta Music Credentials
**File**: `lib/config/theta-credentials.js`
```javascript
// Purpose: Stores Theta Music login credentials for students
// Pattern: '[firstname]fc' for both username and password

export const thetaCredentials = {
  'sdt_H6CvJv': 'mathildefc',   // Mathilde
  'sdt_gwyQJr': 'alexfirstchord', // Alex (special case)
  // ... credentials for all Theta students
};
```

**When to modify**: When students join/leave Theta Music or credentials change.

## UI Components

### 1. Main Dashboard Component
**File**: `components/student-portal/StudentDashboard.js`
```javascript
// Purpose: Main layout for student portal
// Features:
// - Responsive design (mobile-optimized)
// - Background styling with clouds
// - Header with student name
// - Grid layout for notes and links
// - First Chord logo positioning

export default function StudentDashboard({ student }) {
  // Handles both error states and normal display
  // Mobile-responsive with Tailwind CSS
}
```

**Key styling features**:
- Gradient background: `bg-gradient-to-t from-green-100 to-blue-100`
- Mobile-responsive text: `text-lg sm:text-2xl`
- Logo positioning: `fixed bottom-2 right-2 sm:bottom-4 sm:right-4`

### 2. Student Notes Component
**File**: `components/student-portal/StudentNotes.js`
```javascript
// Purpose: Displays lesson notes from MMS API
// Features:
// - Caching integration
// - Error handling
// - Mobile-responsive layout

export default function StudentNotes({ notes, notesSuccess }) {
  // Handles different states:
  // - Loading
  // - Success with notes
  // - No notes available
  // - Error state
}
```

### 3. Student Links Component
**File**: `components/student-portal/StudentLinks.js`
```javascript
// Purpose: Shows practice links and credentials
// Features:
// - Soundslice course links
// - Theta Music credentials (if applicable)
// - Mobile-responsive cards

export default function StudentLinks({ student }) {
  // Conditional rendering based on:
  // - student.soundsliceUrl
  // - student.thetaCredentials
  // - student.hasTheta / student.hasSoundslice
}
```

## Configuration Files

### 1. Layout Configuration
**File**: `app/layout.js`
```javascript
// Purpose: Global layout with mobile viewport
export const metadata = {
  title: 'Music School Dashboard',
  description: 'Streamlined lesson management for tutors',
  viewport: 'width=device-width, initial-scale=1', // Critical for mobile
}
```

### 2. Caching Integration
**File**: `lib/mms-client-cached.js`
```javascript
// Purpose: Optimized MMS API calls with caching
// Features:
// - 97% performance improvement
// - Student portal specific optimizations
// - Response caching for frequent requests
```

## File Modification Guidelines

### Adding a New Student
**Files to update** (in order):
1. `lib/student-url-mappings.js` - Add friendly name mapping
2. `lib/student-helpers.js` - Add to VALID_STUDENT_IDS array
3. `lib/soundslice-mappings.js` - Add Soundslice course (if applicable)
4. `lib/config/theta-credentials.js` - Add Theta credentials (if applicable)

### Modifying UI/Styling
**Primary files**:
- `components/student-portal/StudentDashboard.js` - Main layout
- `components/student-portal/StudentNotes.js` - Notes section
- `components/student-portal/StudentLinks.js` - Links section

### Security Changes
**Primary file**:
- `lib/student-helpers.js` - Update VALID_STUDENT_IDS array

### URL Structure Changes
**Primary files**:
- `app/[studentName]/page.js` - Route handler logic
- `lib/student-url-mappings.js` - URL mappings

## Mobile Responsiveness Classes

### Common Tailwind Patterns Used
```css
/* Text sizing */
text-lg sm:text-2xl          /* Large on mobile, 2xl on desktop */
text-sm sm:text-base         /* Small on mobile, base on desktop */

/* Spacing */
p-4 sm:p-6                   /* 4 units mobile, 6 units desktop */
gap-4 sm:gap-6               /* Gap spacing responsive */

/* Layout */
flex flex-col sm:flex-row    /* Column mobile, row desktop */
lg:col-span-2                /* Grid spanning on large screens */

/* Logo sizing */
w-[150px] sm:w-[250px]       /* Smaller logo on mobile */
bottom-2 sm:bottom-4         /* Closer to edge on mobile */
```

## Error Handling Patterns

### 404 Handling
- Invalid friendly names → `notFound()` function
- Invalid student IDs → Return null, trigger error UI
- Missing student data → Graceful fallback display

### API Error Handling
- MMS API failures → Show notes unavailable message
- Soundslice missing → Hide Soundslice section
- Theta missing → Hide Theta credentials section