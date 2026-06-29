// Pure, framework-free helpers for the admin parent-understanding surface — extracted
// from AdminParentUnderstandingPageClient.js so they can be unit-tested and the
// component stays a view. Record scoring, workflow-activity/assessment detection, risk
// signals, status patches, queue search, and next-action derivation. No React, no hooks.
// (The four config-coupled helpers — hasCompleteUnderstandingAssessment,
// effectiveWorkflowStatus, workflowStatusLabel, buildTemplates — stay in the component
// because they depend on its UNDERSTANDING_AREAS / message-content consts.)

import {
  calculateUnderstandingScore,
  deriveParentUnderstandingRiskSignals,
} from './parent-understanding-helpers.mjs';

export function cardClasses(extra = '') {
  return `rounded-[1.2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] ${extra}`;
}

export function firstName(name = '') {
  return `${name || ''}`.trim().split(/\s+/)[0] || 'there';
}

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || value || 'Not set';
}

export function statusAfterEdit(status = '') {
  if (['completed', 'needs_follow_up', 'escalate_to_admin'].includes(status)) {
    return status;
  }
  return 'in_progress';
}

export function buildStatusPatch(nextStatus = 'in_progress') {
  if (nextStatus === 'completed') {
    return {
      workflowStatus: 'completed',
      loopStatus: 'closed',
    };
  }

  if (nextStatus === 'needs_follow_up') {
    return {
      workflowStatus: 'needs_follow_up',
      loopStatus: 'open_admin_follow_up_needed',
    };
  }

  return {
    workflowStatus: 'in_progress',
    loopStatus: 'partially_closed',
  };
}

export function buildEmptyDetails(details = {}) {
  return {
    understanding: {
      cancellations: { understands: '' },
      dashboardSoundslice: { understands: '' },
      practiceNotes: { understands: '' },
      showcases: { understands: '' },
      ...(details.understanding || {}),
    },
    feedback: {
      lessonFeedback: '',
      tutorFit: '',
      studentEnjoyment: '',
      practiceAtHome: 'unknown',
      practiceBarriers: '',
      equipmentIssues: '',
      motivationIssues: '',
      parentSuggestions: '',
      generalNotes: '',
      tutorRelevance: 'none',
      ...(details.feedback || {}),
    },
    communication: {
      whatsappUnderstanding: '',
      bestContactTime: '',
      communityGroupStatus: 'unknown',
      ...(details.communication || {}),
    },
    actions: {
      ...(details.actions || {}),
    },
    adminFollowUpNote: details.adminFollowUpNote || '',
  };
}

export function getRecordScore(record) {
  return calculateUnderstandingScore({ ...record.state.details, adminFollowUpNote: record.state.details.adminFollowUpNote });
}

export function hasSavedWorkflowState(record) {
  return Boolean(record?.state?.updatedAt || record?.state?.recordId);
}

export function hasUnderstandingAssessment(record) {
  const understanding = record?.state?.details?.understanding || {};
  return Object.values(understanding).some((area) => `${area?.understands || ''}`.trim());
}

export function hasWorkflowActivity(record) {
  const details = record?.state?.details || {};
  const feedback = details.feedback || {};
  const communication = details.communication || {};
  const hasFeedback = Object.values(feedback).some((value) => {
    const text = Array.isArray(value) ? value.join(' ') : `${value || ''}`;
    return text.trim() && text !== 'unknown' && text !== 'none';
  });
  const hasCommunication = Object.values(communication).some((value) => {
    const text = `${value || ''}`.trim();
    return text && text !== 'unknown';
  });

  return Boolean(
    hasSavedWorkflowState(record)
    || record?.state?.workflowStatus !== 'not_started'
    || hasUnderstandingAssessment(record)
    || hasFeedback
    || hasCommunication
    || `${details.adminFollowUpNote || ''}`.trim(),
  );
}

export function getRecordRiskSignals(record) {
  if (!hasUnderstandingAssessment(record)) {
    return hasWorkflowActivity(record) ? ['Understanding checklist not assessed'] : [];
  }
  if (!hasWorkflowActivity(record)) {
    return [];
  }
  return deriveParentUnderstandingRiskSignals({ ...record.state.details, adminFollowUpNote: record.state.details.adminFollowUpNote });
}

export function matchesQueueSearch(record, query) {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return true;
  }

  const searchableText = [
    record.student.studentName,
    record.student.parentName,
    record.student.tutor,
    record.student.mmsId,
  ].join(' ').toLowerCase();

  return searchableText.includes(trimmedQuery);
}

export function deriveNextActions(record) {
  const details = record.state.details || {};
  const understanding = details.understanding || {};
  const communication = details.communication || {};
  const actions = details.actions || {};
  const nextActions = [];

  if (understanding.cancellations?.understands && understanding.cancellations.understands !== 'yes' && !actions.policyInfoSent) {
    nextActions.push('Send the cancellation/holiday policy recap.');
  }
  if (understanding.dashboardSoundslice?.understands && understanding.dashboardSoundslice.understands !== 'yes' && !actions.dashboardLinkSent) {
    nextActions.push('Send the student dashboard link and check whether access help is needed.');
  }
  if (understanding.practiceNotes?.understands && understanding.practiceNotes.understands !== 'yes' && !actions.practiceNotesIssueFlagged) {
    nextActions.push('Confirm the parent email used in MMS and flag any practice-note delivery issue for Fenella to fix.');
  }
  if (understanding.showcases?.understands && understanding.showcases.understands !== 'yes' && !actions.showcaseInfoSent) {
    nextActions.push('Send the showcase recap.');
  }
  if (communication.whatsappUnderstanding && communication.whatsappUnderstanding !== 'yes') {
    nextActions.push('Explain the small tutor WhatsApp group and the wider community announcement group.');
  }
  if (communication.communityGroupStatus === 'not_in_group') {
    nextActions.push('Send the First Chord community group invite and mark follow-up needed until joined or declined.');
  }
  if (`${details.adminFollowUpNote || ''}`.trim()) {
    nextActions.push('Resolve the admin follow-up note before closing this loop.');
  }

  if (!nextActions.length) {
    nextActions.push('No obvious follow-up from the current answers.');
  }

  return nextActions;
}
