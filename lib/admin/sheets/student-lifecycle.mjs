import {
  ensureManagedSheet,
  getSheetValues,
  getSheetsClient,
  getSheetsEnv,
  invalidateSheetReadCache,
  LIFECYCLE_SNAPSHOT_HEADERS,
  LIFECYCLE_SNAPSHOT_SHEET,
  mapRowsToObjectsWithRowNumbers,
  STUDENT_LIFECYCLE_HEADERS,
  STUDENT_LIFECYCLE_SHEET,
} from './core.mjs';

function cell(value) {
  return value === null || value === undefined ? '' : String(value);
}

export function buildStudentLifecycleRow(row = {}) {
  return {
    mms_id: cell(row.mmsId),
    student_name: cell(row.studentName),
    status: cell(row.status),
    active: cell(row.active),
    departed: cell(row.departed),
    date_started: cell(row.dateStarted),
    first_lesson: cell(row.firstLesson),
    last_lesson: cell(row.lastLesson),
    next_lesson: cell(row.nextLesson),
    lessons_past: cell(row.lessonsPast),
    lessons_future: cell(row.lessonsFuture),
    attended: cell(row.attended),
    tenure_years: cell(row.tenureYears),
    lifetime_years: cell(row.lifetimeYears),
    refreshed_at: cell(row.refreshedAt),
  };
}

export function buildLifecycleSnapshotRow(summary = {}, notes = '') {
  return {
    snapshot_at: cell(summary.snapshotAt),
    students_with_history: cell(summary.studentsWithHistory),
    active_students: cell(summary.activeStudents),
    departed_students: cell(summary.departedStudents),
    median_tenure_years: cell(summary.medianTenureYears),
    longest_tenure_years: cell(summary.longestTenureYears),
    tenure_three_years_plus: cell(summary.tenureThreeYearsPlus),
    median_lifetime_years: cell(summary.medianLifetimeYears),
    longest_lifetime_years: cell(summary.longestLifetimeYears),
    median_lessons_before_leaving: cell(summary.medianLessonsBeforeLeaving),
    departures_within_three_months: cell(summary.departuresWithinThreeMonths),
    departures_never_started: cell(summary.departuresNeverStarted),
    marking_completeness_pct: cell(summary.markingCompletenessPct),
    marking_lessons_counted: cell(summary.markingLessonsCounted),
    notes: cell(notes),
  };
}

/**
 * Replace the whole per-student tab.
 *
 * A full replace rather than a per-row upsert because every row is recomputed
 * from the same MMS pull — a partial write would leave the tab describing two
 * different moments at once. Losing it costs nothing; it rebuilds on the next
 * refresh, which is why the append-only snapshot lane exists alongside it.
 */
export async function replaceStudentLifecycleRows(rows = []) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: STUDENT_LIFECYCLE_SHEET,
    requiredHeaders: STUDENT_LIFECYCLE_HEADERS,
  });

  const ordered = headers.length ? headers : STUDENT_LIFECYCLE_HEADERS;
  const values = rows.map((row) => {
    const built = buildStudentLifecycleRow(row);
    return ordered.map((header) => built[header] ?? '');
  });

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${STUDENT_LIFECYCLE_SHEET}'!A2:ZZ`,
  });

  if (values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${STUDENT_LIFECYCLE_SHEET}'!A2`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  }

  invalidateSheetReadCache(STUDENT_LIFECYCLE_SHEET);
  return { written: values.length };
}

/** Append one summary row. Never updates an existing row — each is a
 *  measurement of a moment that has passed and cannot be remeasured. */
export async function appendLifecycleSnapshotRow(summary = {}, notes = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: LIFECYCLE_SNAPSHOT_SHEET,
    requiredHeaders: LIFECYCLE_SNAPSHOT_HEADERS,
  });

  const ordered = headers.length ? headers : LIFECYCLE_SNAPSHOT_HEADERS;
  const built = buildLifecycleSnapshotRow(summary, notes);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${LIFECYCLE_SNAPSHOT_SHEET}'!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [ordered.map((header) => built[header] ?? '')] },
  });

  invalidateSheetReadCache(LIFECYCLE_SNAPSHOT_SHEET);
  return built;
}

/**
 * One student's lifecycle row, or null.
 *
 * Never throws: this decorates a student record with a single line of context,
 * so a missing tab, a stale refresh or absent credentials must degrade to
 * showing nothing rather than breaking the page. A student record failing to
 * load is a far worse outcome than a missing tenure line.
 */
export async function getStudentLifecycleRow(mmsId = '') {
  if (!mmsId) return null;

  try {
    const { spreadsheetId } = getSheetsEnv();
    const sheets = await getSheetsClient();
    if (!sheets || !spreadsheetId) return null;

    const values = await getSheetValues(STUDENT_LIFECYCLE_SHEET);
    if (!values?.length) return null;

    const found = mapRowsToObjectsWithRowNumbers(values).find((row) => row.mms_id === mmsId);
    if (!found) return null;

    return {
      firstLesson: found.first_lesson || '',
      lastLesson: found.last_lesson || '',
      departed: found.departed || '',
      tenureYears: found.tenure_years === '' ? null : Number(found.tenure_years),
      lifetimeYears: found.lifetime_years === '' ? null : Number(found.lifetime_years),
      refreshedAt: found.refreshed_at || '',
    };
  } catch {
    return null;
  }
}

export async function getLifecycleSnapshotRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: LIFECYCLE_SNAPSHOT_SHEET,
    requiredHeaders: LIFECYCLE_SNAPSHOT_HEADERS,
  });

  const values = await getSheetValues(LIFECYCLE_SNAPSHOT_SHEET);
  return mapRowsToObjectsWithRowNumbers(values);
}
