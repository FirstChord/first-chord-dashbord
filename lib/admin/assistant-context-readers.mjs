import {
  getSheetObjects,
  getSheetValues,
  ISSUE_QUEUE_HEADERS,
  ISSUE_QUEUE_SHEET,
  mapRowsToObjectsWithRowNumbers,
  SCHEDULE_CONTEXT_HEADERS,
  SCHEDULE_CONTEXT_SHEET,
  WAITING_LIST_STATE_HEADERS,
  WAITING_LIST_STATE_SHEET,
} from './sheets/core.mjs';

function readExistingSheetObjects(sheetName) {
  return getSheetObjects(sheetName);
}

export function getAssistantStudentsSheetRows() {
  return readExistingSheetObjects('Students');
}

export function getAssistantReviewFlagRows() {
  return readExistingSheetObjects('Review_Flags');
}

export function getAssistantPauseHistoryRows() {
  return readExistingSheetObjects("'Pause History'");
}

export function parseStrictManagedRows(values = [], requiredHeaders = [], mapRow = (row) => row) {
  const headers = values[0] || [];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (!headers.length || missingHeaders.length) {
    return {
      available: false,
      reason: headers.length ? 'schema_mismatch' : 'missing_or_empty',
      missingHeaders,
      rows: [],
    };
  }

  return {
    available: true,
    reason: '',
    missingHeaders: [],
    rows: mapRowsToObjectsWithRowNumbers(values).map(mapRow),
  };
}

async function readExistingManagedRows({ sheetName, requiredHeaders, mapRow }) {
  try {
    const values = await getSheetValues(sheetName);
    return parseStrictManagedRows(values, requiredHeaders, mapRow);
  } catch {
    return {
      available: false,
      reason: 'read_failed',
      missingHeaders: [],
      rows: [],
    };
  }
}

export function getAssistantWaitingStateRows() {
  return readExistingManagedRows({
    sheetName: WAITING_LIST_STATE_SHEET,
    requiredHeaders: WAITING_LIST_STATE_HEADERS,
    mapRow: (row) => ({
      rowNumber: row.__rowNumber,
      mmsId: row.mms_id || '',
      status: row.status || '',
      updatedAt: row.updated_at || '',
    }),
  });
}

export function getAssistantScheduleContextRows() {
  return readExistingManagedRows({
    sheetName: SCHEDULE_CONTEXT_SHEET,
    requiredHeaders: SCHEDULE_CONTEXT_HEADERS,
    mapRow: (row) => ({
      rowNumber: row.__rowNumber,
      mmsId: row.mms_id || '',
      studentName: row.student_name || '',
      status: row.status || '',
      nextLessonAt: row.next_lesson_at || '',
      usualWeekday: row.usual_weekday || '',
      usualTime: row.usual_time || '',
      durationMinutes: row.duration_minutes || '',
      teacherId: row.teacher_id || '',
      teacherName: row.teacher_name || '',
      eventCategory: row.event_category || '',
      seriesId: row.series_id || '',
      source: row.source || '',
      confidence: row.confidence || '',
      warnings: row.warnings
        ? row.warnings.split(' | ').map((warning) => warning.trim()).filter(Boolean)
        : [],
      checkedAt: row.checked_at || '',
    }),
  });
}

export function getAssistantIssueQueueRows() {
  return readExistingManagedRows({
    sheetName: ISSUE_QUEUE_SHEET,
    requiredHeaders: ISSUE_QUEUE_HEADERS,
    mapRow: (row) => ({
      rowNumber: row.__rowNumber,
      source: row.source || '',
      issueType: row.issue_type || '',
      mmsId: row.mms_id || '',
      severity: row.severity || '',
      status: row.status || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
      lastSeenAt: row.last_seen_at || '',
      sourcePresent: `${row.source_present || ''}`.trim().toLowerCase() === 'true',
    }),
  });
}
