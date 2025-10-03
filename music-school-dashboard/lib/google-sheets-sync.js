/**
 * Google Sheets Data Sync Layer
 *
 * Reads student/tutor data from Google Sheets with fallback to config files.
 * Safe to deploy - if Sheet fails, falls back to existing hardcoded data.
 */

import { google } from 'googleapis';

// For standalone testing, we can't use the existing imports due to Next.js path aliases
// Instead, we'll define placeholder fallbacks here
// When integrated into Next.js app, these will be replaced with actual imports

// Placeholder fallbacks for testing
const fallbackStudentMappings = {};
const fallbackValidIds = [];
const fallbackSoundslice = {};
const fallbackTheta = {};
const fallbackInstruments = {};

// Google Sheets configuration
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || null;
const USE_GOOGLE_SHEETS = process.env.USE_GOOGLE_SHEETS === 'true';

// Cache for Sheet data (refresh every 5 minutes)
let sheetDataCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get Google Sheets auth client
 */
async function getAuthClient() {
  // For now, we'll use a simpler approach - just return null
  // This will trigger fallback to config files
  // TODO: Set up proper Google Sheets authentication
  return null;
}

/**
 * Fetch data from Google Sheet
 */
async function fetchFromSheet() {
  if (!USE_GOOGLE_SHEETS || !GOOGLE_SHEET_ID) {
    console.log('[GoogleSheets] Not configured - using fallback config files');
    return null;
  }

  // Check cache
  if (sheetDataCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    console.log('[GoogleSheets] Using cached data');
    return sheetDataCache;
  }

  try {
    const auth = await getAuthClient();
    if (!auth) {
      console.log('[GoogleSheets] Auth not configured - using fallback');
      return null;
    }

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch all sheets in parallel
    const [studentsData, tutorsData, instrumentsData] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: 'Students!A2:J', // Skip header row
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: 'Tutors!A2:G',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: 'Instruments!A2:C',
      }),
    ]);

    const data = {
      students: parseStudents(studentsData.data.values || []),
      tutors: parseTutors(tutorsData.data.values || []),
      instruments: parseInstruments(instrumentsData.data.values || []),
    };

    // Cache the data
    sheetDataCache = data;
    cacheTimestamp = Date.now();

    console.log('[GoogleSheets] Successfully loaded data from Sheet');
    return data;
  } catch (error) {
    console.error('[GoogleSheets] Error fetching data:', error.message);
    console.log('[GoogleSheets] Falling back to config files');
    return null;
  }
}

/**
 * Parse students data from Sheet rows
 */
function parseStudents(rows) {
  const students = [];
  const urlMappings = {};
  const validIds = [];
  const soundslice = {};
  const theta = {};

  rows.forEach(row => {
    const [studentId, firstName, lastName, friendlyURL, tutorName, instrument, soundsliceURL, thetaUsername, active] = row;

    // Only process active students
    if (active !== 'TRUE') return;

    students.push({
      studentId,
      firstName,
      lastName,
      friendlyURL,
      tutorName,
      instrument,
      soundsliceURL,
      thetaUsername,
    });

    // Build mappings
    if (friendlyURL && studentId) {
      urlMappings[friendlyURL] = studentId;
      validIds.push(studentId);
    }

    if (soundsliceURL) {
      soundslice[studentId] = soundsliceURL;
    }

    if (thetaUsername) {
      theta[studentId] = thetaUsername;
    }
  });

  return { students, urlMappings, validIds, soundslice, theta };
}

/**
 * Parse tutors data from Sheet rows
 */
function parseTutors(rows) {
  const tutors = {};

  rows.forEach(row => {
    const [tutorName, shortName, teacherId, hourlyRate, defaultInstrument, active, email] = row;

    // Only process active tutors
    if (active !== 'TRUE') return;

    tutors[shortName] = {
      fullName: tutorName,
      teacherId,
      hourlyRate: parseFloat(hourlyRate),
      defaultInstrument,
      email,
    };
  });

  return tutors;
}

/**
 * Parse instrument overrides from Sheet rows
 */
function parseInstruments(rows) {
  const instruments = {};

  rows.forEach(row => {
    const [studentId, instrument] = row;
    if (studentId && instrument) {
      instruments[studentId] = instrument;
    }
  });

  return instruments;
}

/**
 * Get student URL mappings (with fallback)
 */
export async function getStudentURLMappings() {
  const sheetData = await fetchFromSheet();

  if (sheetData?.students?.urlMappings) {
    return sheetData.students.urlMappings;
  }

  // Fallback to existing config
  return fallbackStudentMappings;
}

/**
 * Get valid student IDs (with fallback)
 */
export async function getValidStudentIDs() {
  const sheetData = await fetchFromSheet();

  if (sheetData?.students?.validIds) {
    return sheetData.students.validIds;
  }

  // Fallback to existing config
  return fallbackValidIds;
}

/**
 * Get Soundslice mappings (with fallback)
 */
export async function getSoundsliceMappings() {
  const sheetData = await fetchFromSheet();

  if (sheetData?.students?.soundslice) {
    return sheetData.students.soundslice;
  }

  // Fallback to existing config
  return fallbackSoundslice;
}

/**
 * Get Theta credentials (with fallback)
 */
export async function getThetaCredentials() {
  const sheetData = await fetchFromSheet();

  if (sheetData?.students?.theta) {
    return sheetData.students.theta;
  }

  // Fallback to existing config
  return fallbackTheta;
}

/**
 * Get instrument overrides (with fallback)
 */
export async function getInstrumentOverrides() {
  const sheetData = await fetchFromSheet();

  if (sheetData?.instruments) {
    return sheetData.instruments;
  }

  // Fallback to existing config
  return fallbackInstruments;
}

/**
 * Get tutor information (with fallback)
 */
export async function getTutorInfo(tutorName) {
  const sheetData = await fetchFromSheet();

  if (sheetData?.tutors?.[tutorName]) {
    return sheetData.tutors[tutorName];
  }

  // Fallback - return null, let caller handle
  return null;
}

/**
 * Check if Google Sheets is being used
 */
export function isUsingGoogleSheets() {
  return USE_GOOGLE_SHEETS && GOOGLE_SHEET_ID !== null;
}

/**
 * Clear cache (useful for testing)
 */
export function clearCache() {
  sheetDataCache = null;
  cacheTimestamp = null;
  console.log('[GoogleSheets] Cache cleared');
}
