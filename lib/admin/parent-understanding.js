import { randomUUID } from 'node:crypto';
import { getAdminStudents } from './students.js';
import {
  appendEventLogRow,
  getParentUnderstandingStateRows,
  getScheduleContextRows,
  upsertParentUnderstandingStateRow,
} from './sheets.js';
import { enrichScheduleContextsWithSharedSlots } from './schedule-context-helpers.mjs';
import {
  buildParentUnderstandingSummary,
  calculateUnderstandingScore,
  deriveParentUnderstandingRiskSignals,
  normaliseParentUnderstandingLoopStatus,
  normaliseParentUnderstandingStatus,
  parseParentUnderstandingDetails,
  serialiseParentUnderstandingDetails,
} from './parent-understanding-helpers.mjs';

function parentNameForStudent(student = {}) {
  return [student.parentFirstName, student.parentLastName].filter(Boolean).join(' ').trim();
}

function buildDashboardUrl(student = {}) {
  const friendlyUrl = `${student.registry?.friendlyUrl || ''}`.trim();
  if (friendlyUrl) {
    return `/${friendlyUrl}`;
  }
  return student.mmsId ? `/admin/students/${student.mmsId}` : '';
}

function formatLessonSlot(schedule = null) {
  if (!schedule || schedule.status !== 'found') {
    return '';
  }

  return [
    schedule.usualWeekday,
    schedule.usualTime,
    schedule.durationMinutes ? `${schedule.durationMinutes} mins` : '',
  ].filter(Boolean).join(' · ');
}

function hydrateState(row = {}, student = {}) {
  const details = parseParentUnderstandingDetails(row.detailsJson);

  return {
    recordId: row.recordId || '',
    studentMmsId: row.studentMmsId || student.mmsId || '',
    workflowStatus: normaliseParentUnderstandingStatus(row.workflowStatus),
    loopStatus: normaliseParentUnderstandingLoopStatus(row.loopStatus),
    callAttemptCount: Number(row.callAttemptCount || 0),
    lastContactedAt: row.lastContactedAt || '',
    understandingScore: Number(row.understandingScore || 0),
    understandingLabel: row.understandingLabel || '',
    riskSignals: row.riskSignals || [],
    whatsappUnderstanding: row.whatsappUnderstanding || '',
    bestContactTime: row.bestContactTime || '',
    communityGroupStatus: row.communityGroupStatus || '',
    feedbackSummary: row.feedbackSummary || '',
    tutorRelevance: row.tutorRelevance || '',
    adminFollowUpNote: row.adminFollowUpNote || '',
    summary: row.summary || '',
    updatedAt: row.updatedAt || '',
    updatedBy: row.updatedBy || '',
    details,
  };
}

function buildDefaultState(student = {}) {
  return {
    recordId: '',
    studentMmsId: student.mmsId || '',
    workflowStatus: 'not_started',
    loopStatus: 'open_admin_follow_up_needed',
    callAttemptCount: 0,
    lastContactedAt: '',
    understandingScore: 0,
    understandingLabel: 'Not assessed',
    riskSignals: [],
    whatsappUnderstanding: '',
    bestContactTime: '',
    communityGroupStatus: '',
    feedbackSummary: '',
    tutorRelevance: '',
    adminFollowUpNote: '',
    summary: '',
    updatedAt: '',
    updatedBy: '',
    details: {
      understanding: {
        cancellations: { understands: '' },
        dashboardSoundslice: { understands: '' },
        practiceNotes: { understands: '' },
        showcases: { understands: '' },
      },
      feedback: {},
      communication: {},
      actions: {},
    },
  };
}

export async function getParentUnderstandingWorkflow() {
  const [students, stateRows, scheduleRows] = await Promise.all([
    getAdminStudents(),
    getParentUnderstandingStateRows(),
    getScheduleContextRows(),
  ]);

  const stateByMmsId = new Map(stateRows.map((row) => [row.studentMmsId, row]));
  const scheduleByMmsId = enrichScheduleContextsWithSharedSlots(scheduleRows);

  const seenMmsIds = new Set();
  const records = students
    .filter((student) => student.mmsId && student.lifecycleStatus !== 'stopped')
    .filter((student) => {
      if (seenMmsIds.has(student.mmsId)) {
        return false;
      }
      seenMmsIds.add(student.mmsId);
      return true;
    })
    .map((student) => {
      const scheduleContext = scheduleByMmsId.get(student.mmsId) || null;
      const state = stateByMmsId.has(student.mmsId)
        ? hydrateState(stateByMmsId.get(student.mmsId), student)
        : buildDefaultState(student);
      const parentName = parentNameForStudent(student);

      return {
        student: {
          mmsId: student.mmsId,
          studentName: student.fullName,
          parentName,
          parentEmail: student.email || '',
          parentPhone: student.contactNumber || '',
          tutor: student.tutor || student.registryTutor || '',
          instrument: student.instrument || '',
          lifecycleLabel: student.lifecycleLabel || '',
          dashboardUrl: buildDashboardUrl(student),
          lessonSlot: formatLessonSlot(scheduleContext),
          scheduleContext,
        },
        state,
      };
    });

  const completedCount = records.filter((record) => record.state.workflowStatus === 'completed').length;
  const followUpCount = records.filter((record) => (
    record.state.workflowStatus === 'needs_follow_up'
    || record.state.workflowStatus === 'escalate_to_admin'
    || `${record.state.loopStatus || ''}`.startsWith('open_')
  ) && record.state.workflowStatus !== 'not_started').length;

  return {
    records,
    progress: {
      total: records.length,
      completed: completedCount,
      followUp: followUpCount,
    },
  };
}

export async function saveParentUnderstandingRecord({
  studentMmsId,
  studentName = '',
  parentName = '',
  workflowStatus = '',
  loopStatus = '',
  callAttemptCount = 0,
  lastContactedAt = '',
  details = {},
  summary = '',
  updatedBy = '',
}) {
  const normalisedWorkflowStatus = normaliseParentUnderstandingStatus(workflowStatus);
  const normalisedLoopStatus = normaliseParentUnderstandingLoopStatus(loopStatus);
  const recordForDerivation = {
    ...details,
    adminFollowUpNote: details?.adminFollowUpNote || '',
  };
  const score = calculateUnderstandingScore(recordForDerivation);
  const riskSignals = deriveParentUnderstandingRiskSignals(recordForDerivation);
  const generatedSummary = buildParentUnderstandingSummary(recordForDerivation, {
    studentName,
    parentName,
  });
  const nextSummary = `${summary || ''}`.trim() || generatedSummary;
  const now = new Date().toISOString();
  const stateRow = {
    recordId: `parent_understanding:${studentMmsId}`,
    studentMmsId,
    studentName,
    parentName,
    workflowStatus: normalisedWorkflowStatus,
    loopStatus: normalisedLoopStatus,
    callAttemptCount: String(Number(callAttemptCount || 0)),
    lastContactedAt,
    understandingScore: String(score.total),
    understandingLabel: score.labelText,
    riskSignals,
    whatsappUnderstanding: details?.communication?.whatsappUnderstanding || '',
    bestContactTime: details?.communication?.bestContactTime || '',
    communityGroupStatus: details?.communication?.communityGroupStatus || '',
    feedbackSummary: details?.feedback?.lessonFeedback || '',
    tutorRelevance: details?.feedback?.tutorRelevance || '',
    adminFollowUpNote: details?.adminFollowUpNote || '',
    summary: nextSummary,
    detailsJson: serialiseParentUnderstandingDetails(details),
    updatedAt: now,
    updatedBy,
  };

  await upsertParentUnderstandingStateRow(stateRow);

  if (normalisedWorkflowStatus === 'completed' || normalisedWorkflowStatus === 'needs_follow_up' || normalisedWorkflowStatus === 'escalate_to_admin') {
    await appendEventLogRow({
      eventId: randomUUID(),
      occurredAt: now,
      actorEmail: updatedBy,
      entityType: 'parent_understanding',
      entityId: studentMmsId,
      eventType: 'parent_understanding_status_saved',
      mmsId: studentMmsId,
      studentName,
      issueId: '',
      payloadJson: JSON.stringify({
        workflow_status: normalisedWorkflowStatus,
        loop_status: normalisedLoopStatus,
        understanding_score: score.total,
        risk_signals: riskSignals,
      }),
    });
  }

  return {
    ...stateRow,
    details,
    understandingScore: score.total,
    understandingLabel: score.labelText,
  };
}
