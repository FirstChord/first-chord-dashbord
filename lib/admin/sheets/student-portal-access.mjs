import {
  ensureManagedSheet,
  getSheetValues,
  getSheetsClient,
  getSheetsEnv,
  mapRowsToObjectsWithRowNumbers,
  STUDENT_PORTAL_ACCESS_HEADERS,
  STUDENT_PORTAL_ACCESS_SHEET,
  upsertManagedSheetRow,
} from './core.mjs';

function truthy(value) {
  return `${value || ''}`.trim().toUpperCase() === 'TRUE';
}

export function buildStudentPortalAccessSheetRow(row = {}) {
  return {
    student_mms_id: row.studentMmsId || '',
    student_name: row.studentName || '',
    friendly_url: row.friendlyUrl || '',
    tutor_name: row.tutorName || '',
    workflow_status: row.workflowStatus || 'not_started',
    protection_enabled: row.protectionEnabled ? 'TRUE' : 'FALSE',
    claimed_by: row.claimedBy || '',
    claimed_at: row.claimedAt || '',
    follow_up_note: row.followUpNote || '',
    active_code_ciphertext: row.activeCodeCiphertext || '',
    active_code_salt: row.activeCodeSalt || '',
    active_code_verifier: row.activeCodeVerifier || '',
    credential_version: String(row.credentialVersion || ''),
    pending_credential_id: row.pendingCredentialId || '',
    pending_code_ciphertext: row.pendingCodeCiphertext || '',
    pending_code_salt: row.pendingCodeSalt || '',
    pending_code_verifier: row.pendingCodeVerifier || '',
    pending_credential_version: String(row.pendingCredentialVersion || ''),
    description_confirmed_at: row.descriptionConfirmedAt || '',
    description_confirmed_by: row.descriptionConfirmedBy || '',
    message_sent_at: row.messageSentAt || '',
    message_sent_by: row.messageSentBy || '',
    activated_at: row.activatedAt || '',
    activated_by: row.activatedBy || '',
    updated_at: row.updatedAt || '',
    updated_by: row.updatedBy || '',
  };
}

function fromSheetRow(row = {}) {
  return {
    rowNumber: row.__rowNumber,
    studentMmsId: row.student_mms_id || '',
    studentName: row.student_name || '',
    friendlyUrl: row.friendly_url || '',
    tutorName: row.tutor_name || '',
    workflowStatus: row.workflow_status || 'not_started',
    protectionEnabled: truthy(row.protection_enabled),
    claimedBy: row.claimed_by || '',
    claimedAt: row.claimed_at || '',
    followUpNote: row.follow_up_note || '',
    activeCodeCiphertext: row.active_code_ciphertext || '',
    activeCodeSalt: row.active_code_salt || '',
    activeCodeVerifier: row.active_code_verifier || '',
    credentialVersion: Number(row.credential_version || 0),
    pendingCredentialId: row.pending_credential_id || '',
    pendingCodeCiphertext: row.pending_code_ciphertext || '',
    pendingCodeSalt: row.pending_code_salt || '',
    pendingCodeVerifier: row.pending_code_verifier || '',
    pendingCredentialVersion: Number(row.pending_credential_version || 0),
    descriptionConfirmedAt: row.description_confirmed_at || '',
    descriptionConfirmedBy: row.description_confirmed_by || '',
    messageSentAt: row.message_sent_at || '',
    messageSentBy: row.message_sent_by || '',
    activatedAt: row.activated_at || '',
    activatedBy: row.activated_by || '',
    updatedAt: row.updated_at || '',
    updatedBy: row.updated_by || '',
  };
}

export async function getStudentPortalAccessRows({ requireConfigured = false, forceRefresh = false } = {}) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    if (requireConfigured) {
      throw new Error('Google Sheets portal access state is not configured');
    }
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: STUDENT_PORTAL_ACCESS_SHEET,
    requiredHeaders: STUDENT_PORTAL_ACCESS_HEADERS,
  });

  const values = await getSheetValues(STUDENT_PORTAL_ACCESS_SHEET, { force: forceRefresh });
  return mapRowsToObjectsWithRowNumbers(values)
    .map(fromSheetRow)
    .filter((row) => row.studentMmsId);
}

export async function getStudentPortalAccessRow(studentMmsId, options = {}) {
  const target = `${studentMmsId || ''}`.trim();
  if (!target) return null;
  const rows = await getStudentPortalAccessRows(options);
  return rows.find((row) => row.studentMmsId === target) || null;
}

export async function upsertStudentPortalAccessRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: STUDENT_PORTAL_ACCESS_SHEET,
    requiredHeaders: STUDENT_PORTAL_ACCESS_HEADERS,
    valuesByHeader: buildStudentPortalAccessSheetRow(row),
    matchesRow: (entry, headers) => (
      `${entry[headers.indexOf('student_mms_id')] || ''}`.trim() === row.studentMmsId
    ),
  });

  return row;
}
