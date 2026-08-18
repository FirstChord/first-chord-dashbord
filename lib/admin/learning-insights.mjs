/** @fileoverview Builds the rolling-window learning insight summary from parent-understanding scores and risk signals. */
import {
  calculateUnderstandingScore,
  deriveParentUnderstandingRiskSignals,
} from './parent-understanding-helpers.mjs';

const WINDOW_DAYS = 30;

function parseDate(value = '') {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function isInWindow(value, nowMs, windowMs) {
  const time = parseDate(value);
  return time !== null && time <= nowMs && time >= nowMs - windowMs;
}

function countBy(rows = [], keyOf) {
  return rows.reduce((counts, row) => {
    const key = keyOf(row);
    if (!key) return counts;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function sortCounts(counts = {}) {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function practiceTimestamp(note = {}) {
  return note.createdAt || note.emailSentAt || note.completedAt || note.lessonDate || '';
}

function buildPracticeInsights(notes = [], { nowMs, windowMs }) {
  const recent = notes.filter((note) => isInWindow(practiceTimestamp(note), nowMs, windowMs));
  const songCounts = new Map();
  const unlistedCounts = new Map();
  for (const note of recent) {
    const songIds = Array.isArray(note.songIds) ? note.songIds : [];
    const songTitles = Array.isArray(note.songTitles) ? note.songTitles : [];
    songIds.forEach((songId, index) => {
      const current = songCounts.get(songId) || {
        label: songTitles[index] || songId,
        count: 0,
        studentIds: new Set(),
        withChallenges: 0,
        withGoals: 0,
      };
      current.count += 1;
      if (note.studentMmsId) current.studentIds.add(note.studentMmsId);
      if (`${note.progressChallenges || ''}`.trim()) current.withChallenges += 1;
      if (`${note.practiceGoals || ''}`.trim()) current.withGoals += 1;
      songCounts.set(songId, current);
    });
    const unlistedSongTitles = Array.isArray(note.unlistedSongTitles) ? note.unlistedSongTitles : [];
    unlistedSongTitles.forEach((title) => {
      const cleaned = `${title || ''}`.trim();
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      const current = unlistedCounts.get(key) || {
        label: cleaned,
        count: 0,
        studentIds: new Set(),
      };
      current.count += 1;
      if (note.studentMmsId) current.studentIds.add(note.studentMmsId);
      unlistedCounts.set(key, current);
    });
  }
  const lateCreated = recent.filter((note) => {
    const lesson = parseDate(note.lessonDate);
    const created = parseDate(note.createdAt);
    return lesson !== null && created !== null && created - lesson > 24 * 60 * 60 * 1000;
  }).length;

  return {
    total: recent.length,
    sent: recent.filter((note) => note.emailSendStatus === 'sent' || Boolean(note.gmailMessageId)).length,
    failed: recent.filter((note) => note.emailSendStatus === 'failed').length,
    attendanceOnly: recent.filter((note) => note.emailSendStatus === 'not_sent_absent').length,
    deliveryUntracked: recent.filter((note) => !note.emailSendStatus && !note.gmailMessageId).length,
    withGoals: recent.filter((note) => `${note.practiceGoals || ''}`.trim()).length,
    withChallenges: recent.filter((note) => `${note.progressChallenges || ''}`.trim()).length,
    songLinked: recent.filter((note) => Array.isArray(note.songIds) && note.songIds.length > 0).length,
    unlistedSongNotes: recent.filter((note) => Array.isArray(note.unlistedSongTitles) && note.unlistedSongTitles.length > 0).length,
    songObserved: recent.filter((note) => (
      (Array.isArray(note.songIds) && note.songIds.length > 0)
      || (Array.isArray(note.unlistedSongTitles) && note.unlistedSongTitles.length > 0)
    )).length,
    songUnlinked: recent.filter((note) => (
      (!Array.isArray(note.songIds) || note.songIds.length === 0)
      && (!Array.isArray(note.unlistedSongTitles) || note.unlistedSongTitles.length === 0)
    )).length,
    songs: [...songCounts.entries()]
      .map(([songId, entry]) => ({
        songId,
        label: entry.label,
        count: entry.count,
        students: entry.studentIds.size,
        withChallenges: entry.withChallenges,
        withGoals: entry.withGoals,
        detail: `${entry.studentIds.size} student${entry.studentIds.size === 1 ? '' : 's'} · ${entry.withChallenges} linked note${entry.withChallenges === 1 ? '' : 's'} with challenges · ${entry.withGoals} with goals`,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 8),
    unlistedSongs: [...unlistedCounts.values()]
      .map((entry) => ({
        label: entry.label,
        count: entry.count,
        students: entry.studentIds.size,
        detail: `${entry.studentIds.size} student${entry.studentIds.size === 1 ? '' : 's'} · awaiting catalogue review`,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 8),
    lateCreated,
  };
}

function buildParentInsights(records = []) {
  const assessments = records.map((record) => {
    const details = record?.state?.details || {};
    return {
      workflowStatus: record?.state?.workflowStatus || 'not_started',
      score: calculateUnderstandingScore(details),
      signals: deriveParentUnderstandingRiskSignals(details),
      practiceAtHome: details?.feedback?.practiceAtHome || 'unknown',
    };
  });
  const complete = assessments.filter((entry) => entry.score.isComplete);
  const signalCounts = countBy(complete.flatMap((entry) => entry.signals), (signal) => signal);
  const practiceAtHome = countBy(
    assessments.filter((entry) => entry.practiceAtHome && entry.practiceAtHome !== 'unknown'),
    (entry) => entry.practiceAtHome,
  );

  return {
    total: assessments.length,
    completedWorkflow: assessments.filter((entry) => entry.workflowStatus === 'completed').length,
    fullyAssessed: complete.length,
    partiallyAssessed: assessments.filter((entry) => entry.score.assessedAreas > 0 && !entry.score.isComplete).length,
    unassessed: assessments.filter((entry) => entry.score.assessedAreas === 0).length,
    clearOrMostlyClear: complete.filter((entry) => ['clear', 'mostly_clear'].includes(entry.score.label)).length,
    topSignals: sortCounts(signalCounts).slice(0, 4),
    practiceAtHome: sortCounts(practiceAtHome),
  };
}

function buildInboxInsights(entries = [], { nowMs, windowMs }) {
  const recent = entries.filter((entry) => isInWindow(entry.capturedAt || entry.messageAt, nowMs, windowMs));
  const humanLabelled = recent.filter((entry) => ['accepted', 'corrected'].includes(entry.classificationDecision));
  const linkedPlans = recent.filter((entry) => entry.resolutionType === 'planning_task');
  const reviewedDurations = recent
    .map((entry) => {
      const captured = parseDate(entry.capturedAt || entry.messageAt);
      const reviewed = parseDate(entry.reviewedAt);
      return captured !== null && reviewed !== null && reviewed >= captured ? (reviewed - captured) / (60 * 60 * 1000) : null;
    })
    .filter((value) => value !== null);

  return {
    total: recent.length,
    open: recent.filter((entry) => ['inbox', 'needs_review'].includes(entry.status)).length,
    planned: recent.filter((entry) => entry.resolutionType === 'planning_task').length,
    handledNoPlan: recent.filter((entry) => entry.resolutionType === 'handled_no_plan').length,
    noActionNeeded: recent.filter((entry) => entry.resolutionType === 'ignored_no_action').length,
    autoNoAction: recent.filter((entry) => entry.source === 'whatsapp_group_auto'
      && entry.status === 'ignored'
      && !entry.reviewedBy).length,
    classificationsReviewed: humanLabelled.length,
    classificationsAccepted: humanLabelled.filter((entry) => entry.classificationDecision === 'accepted').length,
    classificationsCorrected: humanLabelled.filter((entry) => entry.classificationDecision === 'corrected').length,
    linkedPlansDone: linkedPlans.filter((entry) => entry.linkedPlanningStatus === 'done').length,
    linkedPlansParked: linkedPlans.filter((entry) => entry.linkedPlanningStatus === 'parked').length,
    linkedPlansActive: linkedPlans.filter((entry) => !['done', 'parked'].includes(entry.linkedPlanningStatus)).length,
    averageReviewHours: reviewedDurations.length
      ? Math.round((reviewedDurations.reduce((sum, value) => sum + value, 0) / reviewedDurations.length) * 10) / 10
      : null,
    categories: sortCounts(countBy(humanLabelled, (entry) => entry.suspectedCategory)).slice(0, 4),
    actionability: sortCounts(countBy(humanLabelled, (entry) => entry.classificationActionability)),
  };
}

function buildCommunicationInsights(entries = [], { nowMs, windowMs }) {
  const recent = entries.filter((entry) => isInWindow(entry.loggedAt, nowMs, windowMs));
  return {
    copied: recent.length,
    categories: sortCounts(countBy(recent, (entry) => entry.category)),
  };
}

// A deliberately read-only, rolling view over existing workflow data. It tells
// the school where to look next; it does not infer causality or claim delivery
// where the underlying record does not prove it.
export function buildLearningInsights({
  practiceNotes = [],
  parentRecords = [],
  incomingMessages = [],
  communications = [],
  now = new Date(),
  windowDays = WINDOW_DAYS,
} = {}) {
  const nowMs = now.getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  return {
    windowDays,
    practice: buildPracticeInsights(practiceNotes, { nowMs, windowMs }),
    parents: buildParentInsights(parentRecords),
    inbox: buildInboxInsights(incomingMessages, { nowMs, windowMs }),
    communications: buildCommunicationInsights(communications, { nowMs, windowMs }),
  };
}
