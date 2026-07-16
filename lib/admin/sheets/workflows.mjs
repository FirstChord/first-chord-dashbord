import { buildSheetRange, COVER_BANK_STATE_HEADERS, COVER_BANK_STATE_SHEET, ensureManagedSheet, getSheetValues, getSheetsClient, getSheetsEnv, HOLIDAY_WORKFLOW_STATE_HEADERS, HOLIDAY_WORKFLOW_STATE_SHEET, invalidateSheetReadCache, mapRowsToObjectsWithRowNumbers, PARENT_UNDERSTANDING_STATE_HEADERS, PARENT_UNDERSTANDING_STATE_SHEET, SCHEDULE_CONTEXT_HEADERS, SCHEDULE_CONTEXT_SHEET, SHOWCASE_TASK_STATE_HEADERS, SHOWCASE_TASK_STATE_SHEET, TUTOR_ABSENCE_STATE_HEADERS, TUTOR_ABSENCE_STATE_SHEET, upsertManagedSheetRow, WAITING_LIST_STATE_HEADERS, WAITING_LIST_STATE_SHEET } from './core.mjs';

export async function getShowcaseTaskStateRows(workflowKey = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: SHOWCASE_TASK_STATE_SHEET,
    requiredHeaders: SHOWCASE_TASK_STATE_HEADERS,
  });

  const values = await getSheetValues(SHOWCASE_TASK_STATE_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    workflowKey: row.workflow_key || '',
    season: row.season || '',
    year: row.year || '',
    groupId: row.group_id || '',
    taskId: row.task_id || '',
    taskLabel: row.task_label || '',
    completed: row.completed || '',
    completedAt: row.completed_at || '',
    updatedAt: row.updated_at || '',
  })).filter((row) => (!workflowKey || row.workflowKey === workflowKey));
}

function buildShowcaseTaskStateSheetRow(row) {
  return {
    workflow_key: row.workflowKey || '',
    season: row.season || '',
    year: row.year || '',
    group_id: row.groupId || '',
    task_id: row.taskId || '',
    task_label: row.taskLabel || '',
    completed: row.completed || '',
    completed_at: row.completedAt || '',
    updated_at: row.updatedAt || '',
  };
}

export async function upsertShowcaseTaskStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildShowcaseTaskStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: SHOWCASE_TASK_STATE_SHEET,
    requiredHeaders: SHOWCASE_TASK_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => (
      `${entry[headers.indexOf('workflow_key')] || ''}`.trim() === row.workflowKey
      && `${entry[headers.indexOf('task_id')] || ''}`.trim() === row.taskId
    ),
  });
}

export async function getWaitingListStateRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: WAITING_LIST_STATE_SHEET,
    requiredHeaders: WAITING_LIST_STATE_HEADERS,
  });

  const values = await getSheetValues(WAITING_LIST_STATE_SHEET);
  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    mmsId: row.mms_id || '',
    status: row.status || '',
    note: row.note || '',
    parentName: row.parent_name || '',
    parentEmail: row.parent_email || '',
    dateStarted: row.date_started || '',
    updatedAt: row.updated_at || '',
  }));
}

export async function getScheduleContextRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: SCHEDULE_CONTEXT_SHEET,
    requiredHeaders: SCHEDULE_CONTEXT_HEADERS,
  });

  const values = await getSheetValues(SCHEDULE_CONTEXT_SHEET);
  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
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
    warnings: row.warnings ? row.warnings.split(' | ').map((warning) => warning.trim()).filter(Boolean) : [],
    checkedAt: row.checked_at || '',
  }));
}

export async function getParentUnderstandingStateRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: PARENT_UNDERSTANDING_STATE_SHEET,
    requiredHeaders: PARENT_UNDERSTANDING_STATE_HEADERS,
  });

  const values = await getSheetValues(PARENT_UNDERSTANDING_STATE_SHEET);
  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    recordId: row.record_id || '',
    studentMmsId: row.student_mms_id || '',
    studentName: row.student_name || '',
    parentName: row.parent_name || '',
    workflowStatus: row.workflow_status || '',
    loopStatus: row.loop_status || '',
    callAttemptCount: row.call_attempt_count || '',
    lastContactedAt: row.last_contacted_at || '',
    understandingScore: row.understanding_score || '',
    understandingLabel: row.understanding_label || '',
    riskSignals: row.risk_signals ? row.risk_signals.split(' | ').map((signal) => signal.trim()).filter(Boolean) : [],
    whatsappUnderstanding: row.whatsapp_understanding || row.preferred_contact_method || '',
    bestContactTime: row.best_contact_time || '',
    communityGroupStatus: row.community_group_status || '',
    feedbackSummary: row.feedback_summary || '',
    tutorRelevance: row.tutor_relevance || '',
    adminFollowUpNote: row.admin_follow_up_note || '',
    summary: row.summary || '',
    detailsJson: row.details_json || '',
    updatedAt: row.updated_at || '',
    updatedBy: row.updated_by || '',
  }));
}

function buildScheduleContextSheetRow(row) {
  return {
    mms_id: row.mmsId || '',
    student_name: row.studentName || '',
    status: row.status || '',
    next_lesson_at: row.nextLessonAt || '',
    usual_weekday: row.usualWeekday || '',
    usual_time: row.usualTime || '',
    duration_minutes: row.durationMinutes || '',
    teacher_id: row.teacherId || '',
    teacher_name: row.teacherName || '',
    event_category: row.eventCategory || '',
    series_id: row.seriesId || '',
    source: row.source || '',
    confidence: row.confidence || '',
    warnings: Array.isArray(row.warnings) ? row.warnings.join(' | ') : row.warnings || '',
    checked_at: row.checkedAt || '',
  };
}

export async function upsertScheduleContextRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildScheduleContextSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: SCHEDULE_CONTEXT_SHEET,
    requiredHeaders: SCHEDULE_CONTEXT_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('mms_id')] || ''}`.trim() === row.mmsId,
  });
}

function buildParentUnderstandingStateSheetRow(row) {
  return {
    record_id: row.recordId || '',
    student_mms_id: row.studentMmsId || '',
    student_name: row.studentName || '',
    parent_name: row.parentName || '',
    workflow_status: row.workflowStatus || '',
    loop_status: row.loopStatus || '',
    call_attempt_count: row.callAttemptCount || '',
    last_contacted_at: row.lastContactedAt || '',
    understanding_score: row.understandingScore || '',
    understanding_label: row.understandingLabel || '',
    risk_signals: Array.isArray(row.riskSignals) ? row.riskSignals.join(' | ') : row.riskSignals || '',
    whatsapp_understanding: row.whatsappUnderstanding || '',
    best_contact_time: row.bestContactTime || '',
    community_group_status: row.communityGroupStatus || '',
    feedback_summary: row.feedbackSummary || '',
    tutor_relevance: row.tutorRelevance || '',
    admin_follow_up_note: row.adminFollowUpNote || '',
    summary: row.summary || '',
    details_json: row.detailsJson || '',
    updated_at: row.updatedAt || '',
    updated_by: row.updatedBy || '',
  };
}

export async function upsertParentUnderstandingStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildParentUnderstandingStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: PARENT_UNDERSTANDING_STATE_SHEET,
    requiredHeaders: PARENT_UNDERSTANDING_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => (
      `${entry[headers.indexOf('student_mms_id')] || ''}`.trim() === row.studentMmsId
    ),
  });
}

export async function getCoverBankStateRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: COVER_BANK_STATE_SHEET,
    requiredHeaders: COVER_BANK_STATE_HEADERS,
  });

  const values = await getSheetValues(COVER_BANK_STATE_SHEET);
  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    recordId: row.record_id || '',
    tutorKey: row.tutor_key || '',
    tutorName: row.tutor_name || '',
    tutorType: row.tutor_type || '',
    phone: row.phone || '',
    instruments: row.instruments ? row.instruments.split(' | ').map((entry) => entry.trim()).filter(Boolean) : [],
    callStatus: row.call_status || '',
    willing: row.willing || '',
    notice: row.notice || '',
    availableDays: row.available_days ? row.available_days.split(' | ').map((entry) => entry.trim()).filter(Boolean) : [],
    notes: row.notes || '',
    lastContactedAt: row.last_contacted_at || '',
    updatedAt: row.updated_at || '',
    updatedBy: row.updated_by || '',
  }));
}

function buildCoverBankStateSheetRow(row) {
  return {
    record_id: row.recordId || '',
    tutor_key: row.tutorKey || '',
    tutor_name: row.tutorName || '',
    tutor_type: row.tutorType || '',
    phone: row.phone || '',
    instruments: Array.isArray(row.instruments) ? row.instruments.join(' | ') : row.instruments || '',
    call_status: row.callStatus || '',
    willing: row.willing || '',
    notice: row.notice || '',
    available_days: Array.isArray(row.availableDays) ? row.availableDays.join(' | ') : row.availableDays || '',
    notes: row.notes || '',
    last_contacted_at: row.lastContactedAt || '',
    updated_at: row.updatedAt || '',
    updated_by: row.updatedBy || '',
  };
}

export async function upsertCoverBankStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildCoverBankStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: COVER_BANK_STATE_SHEET,
    requiredHeaders: COVER_BANK_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('tutor_key')] || ''}`.trim() === row.tutorKey,
  });
}

export async function getHolidayWorkflowStateRows(workflowKey = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: HOLIDAY_WORKFLOW_STATE_SHEET,
    requiredHeaders: HOLIDAY_WORKFLOW_STATE_HEADERS,
  });

  const values = await getSheetValues(HOLIDAY_WORKFLOW_STATE_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    workflowKey: row.workflow_key || '',
    season: row.season || '',
    year: row.year || '',
    groupId: row.group_id || '',
    taskId: row.task_id || '',
    taskLabel: row.task_label || '',
    completed: row.completed || '',
    completedAt: row.completed_at || '',
    updatedAt: row.updated_at || '',
  })).filter((row) => (!workflowKey || row.workflowKey === workflowKey));
}

function buildHolidayWorkflowStateSheetRow(row) {
  return {
    workflow_key: row.workflowKey || '',
    season: row.season || '',
    year: row.year || '',
    group_id: row.groupId || '',
    task_id: row.taskId || '',
    task_label: row.taskLabel || '',
    completed: row.completed || '',
    completed_at: row.completedAt || '',
    updated_at: row.updatedAt || '',
  };
}

export async function upsertHolidayWorkflowStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildHolidayWorkflowStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: HOLIDAY_WORKFLOW_STATE_SHEET,
    requiredHeaders: HOLIDAY_WORKFLOW_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => (
      `${entry[headers.indexOf('workflow_key')] || ''}`.trim() === row.workflowKey
      && `${entry[headers.indexOf('task_id')] || ''}`.trim() === row.taskId
    ),
  });
}

export async function getTutorAbsenceStateRows(absenceId = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: TUTOR_ABSENCE_STATE_SHEET,
    requiredHeaders: TUTOR_ABSENCE_STATE_HEADERS,
  });

  const values = await getSheetValues(TUTOR_ABSENCE_STATE_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    absenceId: row.absence_id || '',
    tutorShortName: row.tutor_short_name || '',
    tutorName: row.tutor_name || '',
    absenceDate: row.absence_date || '',
    status: row.status || '',
    decision: row.decision || '',
    coverTutorShortName: row.cover_tutor_short_name || '',
    coverTutorName: row.cover_tutor_name || '',
    affectedLessonsJson: row.affected_lessons_json || '',
    messageStateJson: row.message_state_json || '',
    note: row.note || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    resolvedAt: row.resolved_at || '',
    updatedBy: row.updated_by || '',
  })).filter((row) => (!absenceId || row.absenceId === absenceId));
}

function buildTutorAbsenceStateSheetRow(row) {
  return {
    absence_id: row.absenceId || '',
    tutor_short_name: row.tutorShortName || '',
    tutor_name: row.tutorName || '',
    absence_date: row.absenceDate || '',
    status: row.status || '',
    decision: row.decision || '',
    cover_tutor_short_name: row.coverTutorShortName || '',
    cover_tutor_name: row.coverTutorName || '',
    affected_lessons_json: row.affectedLessonsJson || '',
    message_state_json: row.messageStateJson || '',
    note: row.note || '',
    created_at: row.createdAt || '',
    updated_at: row.updatedAt || '',
    resolved_at: row.resolvedAt || '',
    updated_by: row.updatedBy || '',
  };
}

export async function upsertTutorAbsenceStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildTutorAbsenceStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: TUTOR_ABSENCE_STATE_SHEET,
    requiredHeaders: TUTOR_ABSENCE_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('absence_id')] || ''}`.trim() === row.absenceId,
  });
}

export async function deleteTutorAbsenceStateRow(absenceId = '') {
  const targetAbsenceId = `${absenceId || ''}`.trim();
  if (!targetAbsenceId) {
    throw new Error('absenceId is required');
  }

  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: TUTOR_ABSENCE_STATE_SHEET,
    requiredHeaders: TUTOR_ABSENCE_STATE_HEADERS,
  });

  const rows = await getTutorAbsenceStateRows(targetAbsenceId);
  const rowNumber = rows[0]?.rowNumber;

  if (!rowNumber) {
    return { deleted: false, absenceId: targetAbsenceId };
  }

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [TUTOR_ABSENCE_STATE_SHEET],
    includeGridData: false,
  });
  const sheet = metadata.data.sheets?.find((entry) => entry.properties?.title === TUTOR_ABSENCE_STATE_SHEET);
  const sheetId = sheet?.properties?.sheetId;

  if (typeof sheetId !== 'number') {
    throw new Error('Could not resolve Tutor_Absence_State sheet metadata');
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });

  invalidateSheetReadCache(TUTOR_ABSENCE_STATE_SHEET);

  return { deleted: true, absenceId: targetAbsenceId, rowNumber };
}

function buildWaitingListStateSheetRow(row) {
  return {
    mms_id: row.mmsId || '',
    status: row.status || '',
    note: row.note || '',
    parent_name: row.parentName || '',
    parent_email: row.parentEmail || '',
    date_started: row.dateStarted || '',
    updated_at: row.updatedAt || '',
  };
}

export async function upsertWaitingListStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildWaitingListStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: WAITING_LIST_STATE_SHEET,
    requiredHeaders: WAITING_LIST_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('mms_id')] || ''}`.trim() === row.mmsId,
  });
}

