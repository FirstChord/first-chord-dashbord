'use client';

import Link from 'next/link';
import { Check, Loader2, Pencil, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PLANNING_AREAS,
  PLANNING_ITEM_TYPES,
  PLANNING_OWNERS,
  PLANNING_STATUSES,
  SCHOOL_FORWARD_PLANNING_ID,
  MONDAY_SCHEDULE_PLANNING_ID,
  buildReflectionIntentionDismissalNote,
  buildSchoolForwardReflections,
  calculateFridayReviewDate,
  calculateNextMeetingDate,
  extractDismissedReflectionIntentions,
  extractReflectionIntentions,
  getLatestSchoolForwardReflectionNote,
  buildPauseLessonDateSuggestions,
  buildStructuredPausePlanningDraft,
  detectTutorAbsenceCapture,
  inferPlanningTargetDateFromText,
  isMeetingPlanningItem,
  labelPlanningArea,
  labelPlanningMomentum,
  labelPlanningStatus,
  labelPlanningType,
  normaliseReflectionIntentionKey,
  parseLinkedStudentIds,
} from '@/lib/admin/planning-helpers.mjs';
import { ADMIN_TUTORS } from '@/lib/admin/tutors-data.js';
import { logCommunicationCopy } from '@/lib/admin/log-communication-copy.js';

const CLIENT_TUTOR_OPTIONS = Object.entries(ADMIN_TUTORS).map(([shortName, tutor]) => ({
  shortName,
  fullName: tutor.fullName,
}));

const STATUS_GROUPS = [
  { key: 'inbox', title: 'Inbox', hint: 'Fresh thoughts to review later.' },
  { key: 'active', title: 'Active', hint: 'Chosen work with a current next action.' },
  { key: 'waiting', title: 'Waiting', hint: 'Blocked by a reply, decision, or real-world test.' },
  { key: 'parked', title: 'Parked', hint: 'Worth keeping, but not current.' },
  { key: 'done', title: 'Done', hint: 'Completed or absorbed into normal workflow.' },
];

const MOMENTUM_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'school_notes', label: 'School Notes' },
  { value: 'learning_note', label: 'Learning Notes' },
  { value: 'strategic_note', label: 'Strategic Notes' },
  { value: 'due_now', label: 'Due Now' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'no_next_action', label: 'No Next Action' },
  { value: 'waiting_status', label: 'Waiting' },
  { value: 'linked', label: 'Linked' },
  { value: 'stalled', label: 'Stalled' },
  { value: 'moving', label: 'Moving' },
  { value: 'initiative', label: 'Initiatives' },
  { value: 'idea', label: 'Ideas' },
  { value: 'action', label: 'Actions' },
  { value: 'done', label: 'Done' },
];

const EMPTY_FORM = {
  title: '',
  notes: '',
  itemType: 'idea',
  owner: 'Unassigned',
  status: 'inbox',
  area: 'other',
  linkedWorkflowId: '',
  linkedStudentId: '',
  linkedStudentIds: [],
  linkedTutorId: '',
  parentPlanningId: '',
  outcome: '',
  nextAction: '',
  targetDate: '',
  progressNote: '',
};

const QUICK_CAPTURE_DEFAULTS = {
  owner: 'Unassigned',
  area: 'other',
  itemType: 'action',
  status: 'inbox',
  linkedWorkflowId: '',
};

const EMPTY_SCHOOL_NOTE_FORM = {
  noteKind: 'learning_note',
  title: '',
  owner: 'Unassigned',
  status: 'active',
  area: 'learning',
  mainNote: '',
  keyIdeas: '',
  applications: '',
  nextAction: '',
};

const SCHOOL_NOTE_TYPES = new Set(['learning_note', 'strategic_note']);

const PAYMENT_PAUSE_PWA_URL = process.env.NEXT_PUBLIC_PAYMENT_PAUSE_PWA_URL || 'https://payment-pause-pwa.web.app/';
const PAUSE_PAYMENT_CONFIRMATION_NOTE = 'Payment pause confirmation message sent.';
const PAUSE_EXPECTATION_SET_NOTE = 'Set Stripe paused expected from linked pause planning item.';
const PAUSE_COMPLETED_NOTE = 'Pause completed from Planning: pause tool run, parent confirmation sent, and payment expectation aligned.';

const SHORT_MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function cardClasses(extra = '') {
  return `rounded-[1.2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] ${extra}`;
}

function formatDateTime(value) {
  if (!value) {
    return 'Not yet';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortPreview(value = '', max = 150) {
  const text = `${value || ''}`.trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}...`;
}

function formatTargetDate(value = '') {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatFriendlyPauseDate(value = '') {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function firstName(value = '') {
  return `${value || ''}`.trim().split(/\s+/u).filter(Boolean)[0] || '';
}

// Adult students are usually recorded as their own contact — the parent fields echo
// the student's own name (e.g. parent "Sian Malyin" for student "Sian Malyin").
// Treat "no parent" OR "parent name == student name" as the student being their own
// contact, so messages address them directly ("your lesson") not third-person.
function isStudentOwnContact(student = {}) {
  const norm = (value) => `${value || ''}`.trim().toLowerCase().replace(/\s+/gu, ' ');
  const parentFirst = firstName(student.parentFirstName) || firstName(student.parentLastName);
  if (!parentFirst) return true;

  const studentFull = norm(student.fullName);
  const parentFull = norm([student.parentFirstName, student.parentLastName].filter(Boolean).join(' '));
  if (parentFull && parentFull === studentFull) return true;

  const studentWords = `${student.fullName || ''}`.trim().split(/\s+/u).filter(Boolean);
  const studentLast = norm(studentWords.length > 1 ? studentWords[studentWords.length - 1] : '');
  const pFirst = norm(parentFirst);
  const sFirst = norm(firstName(student.fullName));
  const pLast = norm(student.parentLastName);
  if (sFirst && pFirst === sFirst && (!pLast || pLast === studentLast)) return true;

  return false;
}

function formatDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDaysToDateInput(value = '', days = 0) {
  const match = `${value || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return value;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  parsed.setDate(parsed.getDate() + days);
  return formatDateInput(parsed);
}

function parseReadablePlanningDate(value = '') {
  const match = `${value || ''}`.trim().match(/(?:mon|tue|wed|thu|fri|sat|sun),?\s*(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})/iu);
  if (!match) return '';
  const month = SHORT_MONTH_INDEX[match[2].toLowerCase()];
  if (typeof month !== 'number') return '';
  const parsed = new Date(Number(match[3]), month, Number(match[1]));
  return Number.isNaN(parsed.getTime()) ? '' : formatDateInput(parsed);
}

function matchIsoPlanningDate(text = '', labels = []) {
  for (const label of labels) {
    const pattern = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*(\\d{4}-\\d{2}-\\d{2})`, 'iu');
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function extractPauseDatesFromPlanningItem(item = {}) {
  const text = [item.title, item.notes, item.nextAction].filter(Boolean).join('\n');
  const startDate = matchIsoPlanningDate(text, [
    'Lesson date',
    'First lesson to pause date',
    'First pause date',
    'Start date',
  ]);
  const endDate = matchIsoPlanningDate(text, [
    'Returning from date',
    'Return date',
    'End date',
  ]);

  if (startDate) {
    return {
      startDate,
      endDate: endDate || startDate,
    };
  }

  const singleMatch = text.match(/\blesson on\s+([A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2,4}\s+\d{4})/u)
    || text.match(/\bLesson to pause:\s*([A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2,4}\s+\d{4})/u);
  if (singleMatch?.[1]) {
    const parsed = parseReadablePlanningDate(singleMatch[1]);
    return parsed ? { startDate: parsed, endDate: parsed } : { startDate: '', endDate: '' };
  }

  const rangeMatch = text.match(/\bfrom\s+([A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2,4}\s+\d{4});\s*returning\s+([A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2,4}\s+\d{4})/u);
  if (rangeMatch?.[1] && rangeMatch?.[2]) {
    return {
      startDate: parseReadablePlanningDate(rangeMatch[1]),
      endDate: parseReadablePlanningDate(rangeMatch[2]),
    };
  }

  return { startDate: '', endDate: '' };
}

function buildPaymentPausePrefillUrl({ item = {}, student = null } = {}) {
  if (!student?.mmsId) return '';
  const { startDate, endDate } = extractPauseDatesFromPlanningItem(item);
  if (!startDate || !endDate) return '';

  // Single-lesson pause: one clean window that comfortably covers the missed lesson —
  //   start  = the planning due date (the day you action it), not the lesson day
  //   resume = a few days after the paused lesson
  // Away-period pause:
  //   start  = the day we're actually doing the pause (action day), so billing pauses from now
  //   resume = a couple of days before the return lesson, so billing is active again by then
  const isSingleLesson = endDate === startDate;
  const dueDate = `${item.targetDate || ''}`.match(/^\d{4}-\d{2}-\d{2}$/u) ? item.targetDate : '';
  const today = formatDateInput(new Date());
  const pauseToolStartDate = isSingleLesson
    ? (dueDate && dueDate <= startDate ? dueDate : startDate)
    : (dueDate || today);
  const pauseToolEndDate = isSingleLesson
    ? addDaysToDateInput(startDate, 3)
    : addDaysToDateInput(endDate, -2);

  const parentName = [
    student.parentFirstName || '',
    student.parentLastName || '',
  ].filter(Boolean).join(' ').trim();
  const url = new URL(PAYMENT_PAUSE_PWA_URL);
  const params = {
    source: 'dashboard-planning',
    planningId: item.planningId || '',
    studentName: student.fullName || '',
    email: student.email || '',
    startDate: pauseToolStartDate,
    endDate: pauseToolEndDate,
    reason: item.notes?.toLowerCase().includes('teacher') ? 'Teacher Holiday' : 'Student Holiday',
    mmsId: student.mmsId || '',
    customerId: student.stripeCustomerId || '',
    subscriptionId: student.stripeSubscriptionId || '',
    tutor: student.tutor || '',
    parentName,
  };

  Object.entries(params).forEach(([key, value]) => {
    if (`${value || ''}`.trim()) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function buildPauseConfirmationMessage({ item = {}, student = null } = {}) {
  if (!student) return '';
  const { startDate, endDate } = extractPauseDatesFromPlanningItem(item);
  if (!startDate || !endDate) return '';

  const studentFirst = firstName(student.fullName) || student.fullName || '';
  const studentName = studentFirst || 'the lesson';
  const tutorFirst = firstName(student.tutor);
  const startLabel = formatFriendlyPauseDate(startDate);
  const endLabel = formatFriendlyPauseDate(endDate);

  // Adult learners are their own contact (no parent, or parent fields echo the
  // student's own name) — address them directly ("you") not third-person ("they").
  const parentFirst = firstName(student.parentFirstName) || firstName(student.parentLastName);
  if (isStudentOwnContact(student)) {
    const greetingName = studentFirst || 'there';
    if (startDate === endDate) {
      return `Hi ${greetingName}, just confirming we have paused payment for your lesson on ${startLabel}. Thanks!`;
    }
    const adultReturn = tutorFirst
      ? `${tutorFirst} will next see you on ${endLabel} and payment will continue as normal from then.`
      : `You're back on ${endLabel} and payment will continue as normal from then.`;
    return `Hi ${greetingName}, just confirming we have paused your payment from ${startLabel}. ${adultReturn} Thanks!`;
  }

  const parentName = parentFirst;
  if (startDate === endDate) {
    return `Hi ${parentName}, just confirming we have paused payment for ${studentName}'s lesson on ${startLabel}. Thanks!`;
  }

  const parentReturn = tutorFirst
    ? `${tutorFirst} will next see ${studentName} on ${endLabel} and payment will continue as normal from then.`
    : `${studentName} is back on ${endLabel} and payment will continue as normal from then.`;
  return `Hi ${parentName}, just confirming we have paused payment for ${studentName} from ${startLabel}. ${parentReturn} Thanks!`;
}

function normaliseSearchText(value = '') {
  return `${value || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Everyday words that should never auto-attach a student to a captured note.
// Without this, "the" prefix-matched "Theodore" and "and" matched "Andrew".
const STUDENT_MATCH_STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'were', 'this', 'that', 'with', 'has', 'have',
  'will', 'but', 'not', 'all', 'any', 'who', 'why', 'how', 'when', 'what', 'where',
  'you', 'your', 'our', 'her', 'his', 'him', 'she', 'they', 'them', 'their',
  'from', 'into', 'onto', 'out', 'over', 'about', 'after', 'before', 'then',
  'today', 'tomorrow', 'week', 'next', 'now', 'soon', 'add', 'new', 'get', 'got',
]);

// A token only counts toward auto-inferring a student if it's substantial enough
// to be a name and isn't a common word. Manual search (StudentSearchField) is
// unaffected — this guards only the automatic note→student detection.
function isMeaningfulNameTerm(term = '') {
  return term.length >= 3 && !STUDENT_MATCH_STOP_WORDS.has(term);
}

function isDueNowPlanningItem(item = {}, now = new Date()) {
  const targetDate = `${item.targetDate || ''}`.trim();
  return !['done', 'parked'].includes(item.status)
    && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
    && targetDate <= formatDateInput(now);
}

function isOpenPlanningItem(item = {}) {
  return !['done', 'parked'].includes(item.status);
}

// Plain-language headline for the calm "due today" cards. Auto-generated pause
// cards get a calmer framing; user-written items already read as human, so we
// use their title. (Mirrors getIssueStory in AdminIssuesPageClient.)
function getPlanningStory(item = {}, studentOptions = []) {
  if (isPausePlanningItem(item)) {
    const name = findStudentById(studentOptions, item.linkedStudentId)?.fullName || 'a student';
    const { startDate, endDate } = extractPauseDatesFromPlanningItem(item);
    if (startDate && endDate && startDate !== endDate) {
      return `Pause ${name} from ${formatTargetDate(startDate)} until ${formatTargetDate(endDate)}.`;
    }
    if (startDate) {
      return `Pause ${name}'s lesson on ${formatTargetDate(startDate)}.`;
    }
    return `Sort out ${name}'s pause.`;
  }
  return `${item.title || ''}`.trim() || 'This needs a look today.';
}

// The calm "what to do" line beneath the headline.
function getPlanningWhatToDo(item = {}) {
  const next = `${item.nextAction || ''}`.trim();
  if (next) {
    return next;
  }
  if (isPausePlanningItem(item)) {
    return 'Open the pause steps: pause the payment, then send the confirmation message.';
  }
  if (item.linkedWorkflowId === 'tutor-absence') {
    return 'Open the tutor-absence workflow to arrange cover.';
  }
  return 'Take the next step, then mark it done.';
}

// A small due chip: "Today" or "Overdue N days".
function dueChipLabel(targetDate = '', now = new Date()) {
  const date = `${targetDate || ''}`.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'No date';
  }
  const today = formatDateInput(now);
  if (date === today) {
    return 'Today';
  }
  if (date < today) {
    const days = Math.round((new Date(`${today}T00:00:00`) - new Date(`${date}T00:00:00`)) / 86_400_000);
    return days === 1 ? 'Overdue 1 day' : `Overdue ${days} days`;
  }
  return formatTargetDate(date);
}

function hasPlanningLink(item = {}) {
  return Boolean(
    `${item.linkedWorkflowId || ''}`.trim()
    || `${item.linkedStudentId || ''}`.trim()
    || `${item.linkedTutorId || ''}`.trim()
    || `${item.parentPlanningId || ''}`.trim(),
  );
}

function studentLabel(student = {}) {
  return [
    student.fullName || student.mmsId,
    student.tutor ? `Tutor: ${student.tutor}` : '',
    student.instrument || '',
  ].filter(Boolean).join(' · ');
}

function findStudentById(studentOptions = [], mmsId = '') {
  return studentOptions.find((student) => student.mmsId === mmsId) || null;
}

function findStudentSuggestions(studentOptions = [], query = '', limit = 6) {
  const search = normaliseSearchText(query);
  if (!search) {
    return [];
  }
  const terms = search.split(/\s+/).filter(Boolean);

  return studentOptions
    .map((student) => {
      const haystack = normaliseSearchText([
        student.fullName,
        student.mmsId,
        student.tutor,
        student.instrument,
      ].filter(Boolean).join(' '));
      const score = terms.reduce((sum, term) => (
        haystack.includes(term) ? sum + (haystack.startsWith(term) ? 2 : 1) : sum
      ), 0);
      return { student, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.student.fullName.localeCompare(b.student.fullName))
    .slice(0, limit)
    .map((entry) => entry.student);
}

function inferStudentFromText(studentOptions = [], rawText = '') {
  const text = normaliseSearchText(rawText);
  if (!text) {
    return null;
  }

  const exactMatches = studentOptions
    .map((student) => {
      const name = normaliseSearchText(student.fullName);
      if (!name || !text.includes(name)) {
        return null;
      }
      return { student, score: name.length };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (exactMatches.length) {
    return exactMatches[0].student;
  }

  const studentQuery = text
    .replace(/\b(please|can|could|you|we|need|to|for|from|until|pause|paused|pausing|lesson|lessons|away|off|holiday|holidays)\b/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  // Drop common words and ultra-short tokens so everyday language can't latch
  // onto a name. If nothing substantial is left, don't guess a student.
  const queryTerms = studentQuery.split(/\s+/).filter(isMeaningfulNameTerm);
  if (!queryTerms.length) {
    return null;
  }

  const exactFirstNameMatches = studentOptions.filter((student) => {
    const firstName = normaliseSearchText(student.fullName).split(/\s+/)[0] || '';
    return queryTerms.includes(firstName);
  });
  if (exactFirstNameMatches.length === 1) {
    return exactFirstNameMatches[0];
  }

  const cleanQuery = queryTerms.join(' ');
  const suggestions = findStudentSuggestions(studentOptions, cleanQuery, 3);
  if (suggestions.length > 1) {
    const firstNameMatches = suggestions.filter((student) => {
      const firstName = normaliseSearchText(student.fullName).split(/\s+/)[0] || '';
      // Only a length-4+ token may prefix-match (so "theo" finds Theodore but
      // "the" never does); shorter tokens must match the first name exactly.
      return queryTerms.some((term) => firstName === term || (term.length >= 4 && firstName.startsWith(term)));
    });
    if (firstNameMatches.length === 1) {
      return firstNameMatches[0];
    }
  }
  return suggestions.length === 1 ? suggestions[0] : null;
}

function firstLine(value = '') {
  return `${value || ''}`
    .split(/\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function truncateTitle(value = '', max = 90) {
  const text = firstLine(value).replace(/^[-•⁠\s]+/u, '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function inferQuickCapture(raw = '') {
  const text = `${raw || ''}`.toLowerCase();
  const defaults = { ...QUICK_CAPTURE_DEFAULTS };

  if (/\b(pause|holiday|away|off|cancel lesson|no lesson)\b/u.test(text)) {
    defaults.area = 'admin';
    defaults.itemType = 'action';
  }
  if (isTutorAbsenceCaptureText(raw)) {
    defaults.area = 'tutor';
    defaults.linkedWorkflowId = 'tutor-absence';
  }
  if (/\b(onboard|new student|starting|sign.?up)\b/u.test(text)) {
    defaults.area = 'admin';
    defaults.linkedWorkflowId = 'onboarding';
  }
  if (/\b(stripe|payment|billing|refund|charge|subscription|vat|payroll)\b/u.test(text)) {
    defaults.area = 'finance';
  }
  if (/\b(show|showcase|poster|venue|perform)\b/u.test(text)) {
    defaults.area = 'showcase';
    defaults.linkedWorkflowId = 'showcase';
  }
  if (/\b(dashboard|tool|website|mms|soundslice|link|bug)\b/u.test(text)) {
    defaults.area = 'tech';
  }
  if (/\b(maybe|idea|revisit|could|should|future|plan)\b/u.test(text)) {
    defaults.itemType = 'idea';
  }

  return defaults;
}

function isPauseCaptureText(raw = '') {
  return /\bpaus(?:e|ed|ing)\b/iu.test(`${raw || ''}`);
}

function isTutorAbsenceCaptureText(raw = '') {
  return detectTutorAbsenceCapture(raw, CLIENT_TUTOR_OPTIONS).isTutorAbsence;
}

function buildQuickCaptureItem(rawNote = '', overrides = {}, studentOptions = []) {
  const inferred = inferQuickCapture(rawNote);
  const {
    structuredCapture,
    pauseType,
    pauseLessonDate,
    pauseFirstPauseDate,
    pauseReturnDate,
    pauseExtraNote,
    showPauseBuilder,
    hidePauseBuilder,
    studentSelectionSource,
    linkedStudentId: overrideStudentId,
    linkedStudentIds: overrideStudentIds,
    tutorAbsenceShortName,
    tutorAbsenceDates,
    showTutorAbsenceBuilder,
    hideTutorAbsenceBuilder,
    ...safeOverrides
  } = overrides;
  // A student list is explicit when the user touched it (manual/cleared) or when
  // a caller passed ids directly (e.g. a pause capture). Otherwise we infer one.
  const hasStudentOverride = studentSelectionSource === 'manual'
    || studentSelectionSource === 'cleared'
    || overrideStudentIds !== undefined
    || overrideStudentId !== undefined;
  const inferredStudent = hasStudentOverride ? null : inferStudentFromText(studentOptions, rawNote);
  const linkedStudentIds = hasStudentOverride
    ? parseLinkedStudentIds(overrideStudentIds ?? overrideStudentId)
    : (inferredStudent ? [inferredStudent.mmsId] : []);
  const item = {
    ...EMPTY_FORM,
    ...inferred,
    ...safeOverrides,
    title: safeOverrides.title || truncateTitle(rawNote),
    notes: safeOverrides.notes || rawNote.trim(),
    linkedStudentId: linkedStudentIds[0] || '',
    linkedStudentIds,
    targetDate: safeOverrides.targetDate || inferPlanningTargetDateFromText(rawNote),
    progressNote: safeOverrides.progressNote || 'Captured from quick brain capture.',
  };

  if (item.itemType === 'action') {
    item.nextAction = item.nextAction || item.title;
  }

  return item;
}

function momentumClasses(momentum = '') {
  if (momentum === 'moving') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (momentum === 'stalled' || momentum === 'no_next_action') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (momentum === 'done') {
    return 'border-slate-200 bg-slate-100 text-slate-700';
  }
  if (momentum === 'parked') {
    return 'border-purple-200 bg-purple-50 text-purple-800';
  }
  return 'border-blue-100 bg-blue-50 text-slate-700';
}

function applySmartDefaults(form) {
  const next = { ...form };
  if (next.itemType === 'initiative' && next.status === 'inbox') {
    next.status = 'active';
  }
  if (next.itemType === 'action' && next.status === 'inbox') {
    next.status = 'active';
  }
  return next;
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800"
      >
        {options.map((option) => {
          const valueForOption = typeof option === 'string' ? option : option.value;
          const labelForOption = typeof option === 'string' ? option : option.label;
          return (
            <option key={valueForOption} value={valueForOption}>{labelForOption}</option>
          );
        })}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:text-slate-400"
      />
    </label>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800"
      />
    </label>
  );
}

function StudentSearchField({ label = 'Linked Student', value, onChange, studentOptions = [], multiple = false }) {
  const [query, setQuery] = useState('');

  // Multi-select: selected students show as removable chips and the search box
  // stays available to add more (e.g. for a group lesson). `value` is an array
  // of MMS ids and `onChange` is called with the updated array.
  if (multiple) {
    const ids = parseLinkedStudentIds(value);
    const selectedStudents = ids.map((id) => findStudentById(studentOptions, id) || { mmsId: id, fullName: id });
    const suggestions = findStudentSuggestions(studentOptions, query).filter((student) => !ids.includes(student.mmsId));

    return (
      <div className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
        {selectedStudents.length ? (
          <div className="mt-2 flex flex-wrap gap-2 normal-case tracking-normal">
            {selectedStudents.map((student) => (
              <span
                key={student.mmsId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-sm font-medium text-slate-900"
              >
                {student.fullName || student.mmsId}
                <button
                  type="button"
                  onClick={() => onChange(ids.filter((id) => id !== student.mmsId))}
                  className="text-base leading-none text-slate-500 hover:text-slate-800"
                  aria-label={`Remove ${student.fullName || student.mmsId}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={selectedStudents.length ? 'Add another student' : 'Type a student name'}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:text-slate-400"
        />
        {suggestions.length ? (
          <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-white p-2 normal-case tracking-normal">
            {suggestions.map((student) => (
              <button
                key={student.mmsId}
                type="button"
                onClick={() => {
                  onChange([...ids, student.mmsId]);
                  setQuery('');
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
              >
                {studentLabel(student)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const selectedStudent = findStudentById(studentOptions, value);
  const suggestions = findStudentSuggestions(studentOptions, query);

  return (
    <div className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      {selectedStudent ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 normal-case tracking-normal">
          <span className="text-sm font-medium text-slate-900">{studentLabel(selectedStudent)}</span>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
          >
            Clear
          </button>
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a student name"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:text-slate-400"
          />
          {suggestions.length ? (
            <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-white p-2 normal-case tracking-normal">
              {suggestions.map((student) => (
                <button
                  key={student.mmsId}
                  type="button"
                  onClick={() => {
                    onChange(student.mmsId);
                    setQuery('');
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                >
                  {studentLabel(student)}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder = '', rows = 3 }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:text-slate-400"
      />
    </label>
  );
}

// Renders multi-line notes/reflections with line breaks preserved (the box is
// plain text, not Markdown), collapsing long entries to a few lines with a
// Show more/less toggle so a full meeting summary reads cleanly without
// dominating the card.
function ExpandableText({ text = '', previewLines = 4, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const full = `${text || ''}`.trim();
  const lines = full.split(/\r?\n/);
  const isLong = lines.length > previewLines || full.length > 400;
  const preview = lines.slice(0, previewLines).join('\n').slice(0, 400);
  const shown = expanded || !isLong ? full : preview;

  return (
    <div className={className}>
      <p className="whitespace-pre-line">{shown}{!expanded && isLong ? '…' : ''}</p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}

function buildSearchText(item) {
  return [
    item.title,
    item.notes,
    item.owner,
    item.areaLabel,
    item.statusLabel,
    item.itemTypeLabel,
    item.linkedWorkflowId,
    (item.linkedStudentIds || [item.linkedStudentId]).join(' '),
    item.linkedTutorId,
    item.outcome,
    item.nextAction,
    item.targetDate,
    item.latestProgress?.progressNote,
  ].join(' ').toLowerCase();
}

function workflowHref(workflowId = '') {
  const key = `${workflowId || ''}`.trim().toLowerCase();
  const routes = {
    'tutor-absence': '/admin/workflows/tutor-absence',
    'parent-understanding': '/admin/workflows/parent-understanding',
    waiting: '/admin/waiting',
    onboarding: '/admin/onboard',
    showcase: '/admin/showcase',
    holidays: '/admin/holidays',
  };
  return routes[key] || '';
}

// Tutor-absence cards keep the generic linkedWorkflowId ('tutor-absence') and store
// the specific tutor + date as parseable lines in notes; build the prefilled deep
// link from those so the workflow opens ready for that tutor/date.
function buildTutorAbsenceWorkflowHref(item = {}) {
  const notes = `${item.notes || ''}`;
  const dateMatch = notes.match(/Tutor absence date:\s*(\d{4}-\d{2}-\d{2})/u);
  const tutorMatch = notes.match(/^Tutor:\s*(\S+)/mu);
  const tutor = tutorMatch ? tutorMatch[1] : `${item.linkedTutorId || ''}`.trim();
  if (!dateMatch || !tutor) {
    return '/admin/workflows/tutor-absence';
  }
  return `/admin/workflows/tutor-absence?tutor=${encodeURIComponent(tutor)}&date=${encodeURIComponent(dateMatch[1])}`;
}

function studentHref(studentId = '') {
  const key = `${studentId || ''}`.trim();
  return key ? `/admin/students/${encodeURIComponent(key)}` : '';
}

function LinkPill({ label, href = '' }) {
  const classes = 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-slate-900';
  return href ? (
    <Link href={href} className={classes}>
      {label}
    </Link>
  ) : (
    <span className={classes}>{label}</span>
  );
}

function isPausePlanningItem(item = {}) {
  return /\bpaus(?:e|ed|ing)\b/iu.test([
    item.title,
    item.notes,
    item.nextAction,
  ].join(' '));
}

function isSchoolNotePlanningItem(item = {}) {
  return SCHOOL_NOTE_TYPES.has(item.itemType);
}

function hasPausePaymentConfirmation(item = {}) {
  return (item.progress || []).some((entry) => (
    `${entry.progressNote || ''}`.toLowerCase().includes(PAUSE_PAYMENT_CONFIRMATION_NOTE.toLowerCase())
  ));
}

function ItemForm({
  form,
  onChange,
  studentOptions = [],
  onSubmit,
  submitLabel = 'Save',
  pending = false,
  compact = false,
}) {
  const setValue = (key, value) => onChange({ ...form, [key]: value });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Title"
        value={form.title}
        onChange={(value) => setValue('title', value)}
        placeholder="Write the thought, initiative, or next action"
      />

      <div className="grid gap-3 md:grid-cols-4">
        <SelectField
          label="Type"
          value={form.itemType}
          onChange={(value) => onChange(applySmartDefaults({ ...form, itemType: value }))}
          options={PLANNING_ITEM_TYPES.map((value) => ({ value, label: labelPlanningType(value) }))}
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(value) => setValue('status', value)}
          options={PLANNING_STATUSES.map((value) => ({ value, label: labelPlanningStatus(value) }))}
        />
        <SelectField
          label="Owner"
          value={form.owner}
          onChange={(value) => setValue('owner', value)}
          options={PLANNING_OWNERS}
        />
        <SelectField
          label="Area"
          value={form.area}
          onChange={(value) => setValue('area', value)}
          options={PLANNING_AREAS.map((value) => ({ value, label: labelPlanningArea(value) }))}
        />
      </div>

      {!compact && (
        <>
          <TextAreaField
            label="Notes"
            value={form.notes}
            onChange={(value) => setValue('notes', value)}
            placeholder="Context, rough thinking, links, constraints, or why this matters"
          />
          <div className="grid gap-3 md:grid-cols-3">
            <TextField
              label="Linked Workflow"
              value={form.linkedWorkflowId}
              onChange={(value) => setValue('linkedWorkflowId', value)}
              placeholder="parent-understanding"
            />
            <StudentSearchField
              label="Linked Students"
              multiple
              value={form.linkedStudentIds ?? form.linkedStudentId}
              onChange={(ids) => onChange({ ...form, linkedStudentIds: ids, linkedStudentId: ids[0] || '' })}
              studentOptions={studentOptions}
            />
            <TextField
              label="Linked Tutor"
              value={form.linkedTutorId}
              onChange={(value) => setValue('linkedTutorId', value)}
              placeholder="Fennella"
            />
          </div>
          <TextAreaField
            label="Outcome"
            value={form.outcome}
            onChange={(value) => setValue('outcome', value)}
            placeholder="For initiatives: what finished looks like"
            rows={2}
          />
        </>
      )}

      <TextField
        label="Next Action"
        value={form.nextAction}
        onChange={(value) => setValue('nextAction', value)}
        placeholder="The next concrete step"
      />
      <DateField
        label="Do by"
        value={form.targetDate}
        onChange={(value) => setValue('targetDate', value)}
      />
      <TextAreaField
        label={compact ? 'Initial note' : 'Progress note'}
        value={form.progressNote}
        onChange={(value) => setValue('progressNote', value)}
        placeholder="Optional: what moved, what changed, or why this was captured"
        rows={2}
      />

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {submitLabel}
      </button>
    </form>
  );
}

function buildSchoolNoteItem(form = {}) {
  const mainNote = `${form.mainNote || ''}`.trim();
  const keyIdeas = `${form.keyIdeas || ''}`.trim();
  const applications = `${form.applications || ''}`.trim();
  const sections = [
    mainNote ? `Main note / transcript summary:\n${mainNote}` : '',
    keyIdeas ? `Key ideas:\n${keyIdeas}` : '',
    applications ? `Possible First Chord applications:\n${applications}` : '',
  ].filter(Boolean);
  const itemType = SCHOOL_NOTE_TYPES.has(form.noteKind) ? form.noteKind : 'learning_note';

  return {
    title: `${form.title || ''}`.trim(),
    notes: sections.join('\n\n'),
    itemType,
    owner: form.owner || 'Unassigned',
    status: form.status || 'active',
    area: form.area || (itemType === 'learning_note' ? 'learning' : 'other'),
    linkedWorkflowId: 'school-notes',
    nextAction: `${form.nextAction || ''}`.trim(),
    progressNote: itemType === 'learning_note'
      ? 'Captured as a learning note.'
      : 'Captured as a strategic note.',
  };
}

function SchoolNoteCapture({ form, onChange, onSubmit, pending = false }) {
  const setValue = (key, value) => {
    const next = { ...form, [key]: value };
    if (key === 'noteKind') {
      next.area = value === 'learning_note' ? 'learning' : (form.area === 'learning' ? 'growth' : form.area);
    }
    onChange(next);
  };
  const isLearning = form.noteKind === 'learning_note';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { value: 'learning_note', label: 'Learning note' },
          { value: 'strategic_note', label: 'Strategic note' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setValue('noteKind', option.value)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              form.noteKind === option.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <TextField
        label="Title"
        value={form.title}
        onChange={(value) => setValue('title', value)}
        placeholder={isLearning ? 'Book, podcast, conversation, or idea source' : 'Strategic thought or question'}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <SelectField
          label="Area"
          value={form.area}
          onChange={(value) => setValue('area', value)}
          options={PLANNING_AREAS.map((value) => ({ value, label: labelPlanningArea(value) }))}
        />
        <SelectField
          label="Owner"
          value={form.owner}
          onChange={(value) => setValue('owner', value)}
          options={PLANNING_OWNERS}
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(value) => setValue('status', value)}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'parked', label: 'Parked' },
            { value: 'done', label: 'Finished' },
            { value: 'inbox', label: 'Inbox' },
          ]}
        />
      </div>

      <TextAreaField
        label="Main note / transcript summary"
        value={form.mainNote}
        onChange={(value) => setValue('mainNote', value)}
        placeholder="Paste the summary from a conversation, audiobook notes, or rough thinking here."
        rows={6}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <TextAreaField
          label="Key ideas"
          value={form.keyIdeas}
          onChange={(value) => setValue('keyIdeas', value)}
          placeholder="What ideas are worth keeping?"
          rows={4}
        />
        <TextAreaField
          label="Possible First Chord applications"
          value={form.applications}
          onChange={(value) => setValue('applications', value)}
          placeholder="How could this affect teaching, parents, growth, systems, or culture?"
          rows={4}
        />
      </div>
      <TextField
        label="Optional next action"
        value={form.nextAction}
        onChange={(value) => setValue('nextAction', value)}
        placeholder="If this should become work, name the next concrete step"
      />

      <button
        type="submit"
        disabled={pending || !form.title.trim() || !form.mainNote.trim()}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Save note
      </button>
    </form>
  );
}

function QuickBrainCapture({
  rawNote,
  setRawNote,
  options,
  setOptions,
  studentOptions = [],
  expanded,
  setExpanded,
  onSubmit,
  onTutorAbsenceCapture,
  onPauseCapture,
  pending = false,
}) {
  // Live schedule refreshes done from this builder, keyed by MMS id. These take
  // precedence over the cached scheduleContext (which can be stale or missing).
  const [refreshedSchedules, setRefreshedSchedules] = useState({});
  const [scheduleRefreshState, setScheduleRefreshState] = useState({ pendingId: '', error: '' });
  const inferred = inferQuickCapture(rawNote);
  const inferredTargetDate = inferPlanningTargetDateFromText(rawNote);
  // Both an explicit pick ('manual') and an explicit clear ('cleared') suppress
  // auto-inference — otherwise clearing would immediately re-detect the student
  // mentioned in the note text and the name would never go away.
  const hasManualStudentOverride = options.studentSelectionSource === 'manual'
    || options.studentSelectionSource === 'cleared';
  const inferredStudent = hasManualStudentOverride ? null : inferStudentFromText(studentOptions, rawNote);
  // The full linked-student list (group lessons can have several); when nothing
  // is manually set we seed it from the single inferred student. The primary
  // (first) student drives the single-student pause/schedule flows below.
  const effectiveStudentIds = hasManualStudentOverride
    ? parseLinkedStudentIds(options.linkedStudentIds)
    : (inferredStudent ? [inferredStudent.mmsId] : []);
  const effectiveOptions = {
    ...inferred,
    targetDate: inferredTargetDate,
    ...options,
    linkedStudentId: effectiveStudentIds[0] || '',
    linkedStudentIds: effectiveStudentIds,
  };
  const tutorAbsenceDetection = detectTutorAbsenceCapture(rawNote, CLIENT_TUTOR_OPTIONS);
  const tutorAbsenceBuilderVisible = !effectiveOptions.hideTutorAbsenceBuilder
    && (tutorAbsenceDetection.isTutorAbsence || effectiveOptions.showTutorAbsenceBuilder);
  const effectiveTutorShortName = effectiveOptions.tutorAbsenceShortName
    || tutorAbsenceDetection.tutor?.shortName
    || '';
  const effectiveTutorDates = Array.isArray(effectiveOptions.tutorAbsenceDates) && effectiveOptions.tutorAbsenceDates.length
    ? effectiveOptions.tutorAbsenceDates
    : tutorAbsenceDetection.inferredDates;
  const cleanTutorDates = effectiveTutorDates.filter(Boolean);
  const tutorAbsenceFullName = CLIENT_TUTOR_OPTIONS.find((tutor) => tutor.shortName === effectiveTutorShortName)?.fullName
    || effectiveTutorShortName;
  // A tutor-absence capture takes precedence over the single-student pause builder
  // (e.g. "pause tutor robbie"), unless the pause builder was explicitly opened.
  const pauseBuilderVisible = !effectiveOptions.hidePauseBuilder
    && (effectiveOptions.showPauseBuilder
      || (isPauseCaptureText(rawNote) && !tutorAbsenceDetection.isTutorAbsence));
  const pauseType = effectiveOptions.pauseType === 'range' ? 'range' : 'single';
  const pauseStudent = findStudentById(studentOptions, effectiveOptions.linkedStudentId);
  // Prefer a just-fetched live schedule over the cached one (cache can be a month
  // stale or absent), so the suggested dates reflect MMS right now.
  const pauseStudentSchedule = refreshedSchedules[effectiveOptions.linkedStudentId]
    || pauseStudent?.scheduleContext
    || null;
  const pauseDateSuggestions = buildPauseLessonDateSuggestions(pauseStudentSchedule, {
    count: 6,
    startDate: pauseType === 'range' ? effectiveOptions.pauseFirstPauseDate || '' : '',
  });
  const pauseDraft = buildStructuredPausePlanningDraft({
    studentName: pauseStudent?.fullName || '',
    pauseType,
    lessonDate: effectiveOptions.pauseLessonDate || '',
    firstPauseDate: effectiveOptions.pauseFirstPauseDate || '',
    returnDate: effectiveOptions.pauseReturnDate || '',
    extraNote: effectiveOptions.pauseExtraNote || '',
  });

  function setOption(key, value) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  // The full linked-student list (group lessons). Marks the selection explicit so
  // auto-inference stops re-detecting names from the note text.
  function setStudentIds(ids) {
    const list = parseLinkedStudentIds(ids);
    setOptions((current) => ({
      ...current,
      linkedStudentIds: list,
      linkedStudentId: list[0] || '',
      studentSelectionSource: list.length ? 'manual' : 'cleared',
    }));
  }

  // Single-student picker used by the pause builder (pause stays bound to one
  // student); picking replaces the list with just that student.
  function setStudentOption(value) {
    setStudentIds(value ? [value] : []);
  }

  // Pull this student's schedule live from MMS (and refresh the cache) so the
  // suggested lesson dates are current even if the cached row is stale/missing.
  async function refreshPauseSchedule() {
    const mmsId = effectiveOptions.linkedStudentId;
    if (!mmsId) return;
    setScheduleRefreshState({ pendingId: mmsId, error: '' });
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(mmsId)}/schedule`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Schedule refresh failed');
      }
      setRefreshedSchedules((current) => ({ ...current, [mmsId]: data.scheduleContext }));
      setScheduleRefreshState({ pendingId: '', error: '' });
    } catch (error) {
      setScheduleRefreshState({ pendingId: '', error: error.message || 'Schedule refresh failed' });
    }
  }

  function setTutorDate(index, value) {
    setOptions((current) => {
      const base = Array.isArray(current.tutorAbsenceDates)
        ? [...current.tutorAbsenceDates]
        : [...effectiveTutorDates];
      base[index] = value;
      return { ...current, tutorAbsenceDates: base };
    });
  }

  async function handleTutorAbsenceCapture() {
    if (!effectiveTutorShortName || !cleanTutorDates.length || !onTutorAbsenceCapture) {
      return;
    }
    await onTutorAbsenceCapture(effectiveTutorShortName, cleanTutorDates);
  }

  async function captureStructuredPause() {
    if (!pauseDraft.isComplete || !onPauseCapture) {
      return;
    }
    await onPauseCapture(pauseDraft.title, {
      structuredCapture: 'pause',
      title: pauseDraft.title,
      notes: pauseDraft.notes,
      itemType: 'action',
      status: 'active',
      area: 'admin',
      targetDate: pauseDraft.targetDate,
      nextAction: pauseDraft.nextAction,
      progressNote: pauseDraft.progressNote,
      linkedStudentId: effectiveOptions.linkedStudentId || '',
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="sr-only">Brain capture note</span>
        <textarea
          value={rawNote}
          onChange={(event) => setRawNote(event.target.value)}
          rows={5}
          autoFocus
          placeholder="Pause Coban for 7 Feb&#10;Elena away next Friday - arrange cover&#10;Idea: meet students video"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-medium leading-7 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      {pauseBuilderVisible ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Structured pause</p>
              <p className="mt-1 text-sm text-violet-950">
                Use this when a pause covers one lesson or an away period. For away periods, “returning from” means the first lesson/date they are expected back.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOption('showPauseBuilder', false);
                setOption('hidePauseBuilder', true);
              }}
              className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
            >
              Hide
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SelectField
              label="Pause type"
              value={pauseType}
              onChange={(value) => setOption('pauseType', value)}
              options={[
                { value: 'single', label: 'One lesson' },
                { value: 'range', label: 'Away period' },
              ]}
            />
            <div>
              <StudentSearchField
                label="Student"
                value={effectiveOptions.linkedStudentId}
                onChange={setStudentOption}
                studentOptions={studentOptions}
              />
            </div>
          </div>

          {pauseStudentSchedule?.status === 'found' ? (
            <div className="mt-4 rounded-xl border border-violet-100 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                  Suggested lesson dates
                </p>
                <button
                  type="button"
                  onClick={refreshPauseSchedule}
                  disabled={scheduleRefreshState.pendingId === effectiveOptions.linkedStudentId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {scheduleRefreshState.pendingId === effectiveOptions.linkedStudentId
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Search className="h-3.5 w-3.5" />}
                  Refresh from MMS
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                Usual lesson: {[
                  pauseStudentSchedule.usualWeekday,
                  pauseStudentSchedule.usualTime,
                  pauseStudentSchedule.teacherName ? `with ${pauseStudentSchedule.teacherName}` : '',
                ].filter(Boolean).join(' ') || 'cached schedule found'}
              </p>
              {scheduleRefreshState.error ? (
                <p className="mt-1 text-sm text-rose-700">{scheduleRefreshState.error}</p>
              ) : null}
              {pauseDateSuggestions.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {pauseDateSuggestions.map((suggestion) => (
                    <div key={suggestion.date} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                      <p className="text-sm font-semibold text-slate-900">{suggestion.lessonLabel}</p>
                      {pauseType === 'single' ? (
                        <button
                          type="button"
                          onClick={() => setOption('pauseLessonDate', suggestion.date)}
                          className="mt-2 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                        >
                          Use this lesson
                        </button>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setOption('pauseFirstPauseDate', suggestion.date)}
                            className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                          >
                            First missed
                          </button>
                          <button
                            type="button"
                            onClick={() => setOption('pauseReturnDate', suggestion.date)}
                            className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                          >
                            Returning
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No upcoming cached lesson dates available.</p>
              )}
            </div>
          ) : effectiveOptions.linkedStudentId ? (
            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p>No cached lesson schedule for this student yet. Pull it live from MMS to get suggested dates, or fill the date fields manually.</p>
              <button
                type="button"
                onClick={refreshPauseSchedule}
                disabled={scheduleRefreshState.pendingId === effectiveOptions.linkedStudentId}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {scheduleRefreshState.pendingId === effectiveOptions.linkedStudentId
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Search className="h-3.5 w-3.5" />}
                Refresh from MMS
              </button>
              {scheduleRefreshState.error ? (
                <p className="mt-1 text-rose-700">{scheduleRefreshState.error}</p>
              ) : null}
            </div>
          ) : null}

          {pauseType === 'single' ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <DateField
                label="Lesson to pause"
                value={effectiveOptions.pauseLessonDate || ''}
                onChange={(value) => setOption('pauseLessonDate', value)}
              />
              <TextField
                label="Extra note"
                value={effectiveOptions.pauseExtraNote || ''}
                onChange={(value) => setOption('pauseExtraNote', value)}
                placeholder="Optional reason or context"
              />
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <DateField
                label="First lesson to pause"
                value={effectiveOptions.pauseFirstPauseDate || ''}
                onChange={(value) => setOption('pauseFirstPauseDate', value)}
              />
              <DateField
                label="Returning from"
                value={effectiveOptions.pauseReturnDate || ''}
                onChange={(value) => setOption('pauseReturnDate', value)}
              />
              <TextField
                label="Extra note"
                value={effectiveOptions.pauseExtraNote || ''}
                onChange={(value) => setOption('pauseExtraNote', value)}
                placeholder="Summer holiday, illness, etc."
              />
            </div>
          )}

          <div className="mt-4 rounded-xl border border-violet-100 bg-white p-3 text-sm text-slate-700">
            {pauseDraft.isComplete ? (
              <>
                <p className="font-semibold text-slate-900">{pauseDraft.title}</p>
                <p className="mt-1 whitespace-pre-line">{pauseDraft.notes}</p>
                {pauseDraft.targetDate ? (
                  <p className="mt-2 text-xs font-semibold text-amber-800">Do by {formatTargetDate(pauseDraft.targetDate)}</p>
                ) : null}
              </>
            ) : (
              <p>
                Add {pauseDraft.missingFields.join(' and ')} to generate a clear pause task.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={captureStructuredPause}
            disabled={pending || !pauseDraft.isComplete}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Capture pause
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOption('showPauseBuilder', true);
            setOption('hidePauseBuilder', false);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50"
        >
          Structure a pause
        </button>
      )}

      {tutorAbsenceBuilderVisible ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Tutor absence</p>
              <p className="mt-1 text-sm text-orange-950">
                Creates one planning card per day, snapshotting the affected students and linking to the tutor absence workflow.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOption('showTutorAbsenceBuilder', false);
                setOption('hideTutorAbsenceBuilder', true);
              }}
              className="rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100"
            >
              Hide
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SelectField
              label="Tutor"
              value={effectiveTutorShortName}
              onChange={(value) => setOption('tutorAbsenceShortName', value)}
              options={[
                { value: '', label: 'Select tutor…' },
                ...CLIENT_TUTOR_OPTIONS.map((tutor) => ({ value: tutor.shortName, label: tutor.fullName })),
              ]}
            />
            <div className="grid gap-2">
              <DateField
                label="Absence date"
                value={effectiveTutorDates[0] || ''}
                onChange={(value) => setTutorDate(0, value)}
              />
              <DateField
                label="Date 2 (optional)"
                value={effectiveTutorDates[1] || ''}
                onChange={(value) => setTutorDate(1, value)}
              />
              <DateField
                label="Date 3 (optional)"
                value={effectiveTutorDates[2] || ''}
                onChange={(value) => setTutorDate(2, value)}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-orange-100 bg-white p-3 text-sm text-slate-700">
            {effectiveTutorShortName && cleanTutorDates.length ? (
              <p className="font-semibold text-slate-900">
                Will create {cleanTutorDates.length} planning card{cleanTutorDates.length === 1 ? '' : 's'} for {tutorAbsenceFullName} ({cleanTutorDates.join(', ')}). Affected students load from MMS.
              </p>
            ) : (
              <p>Select a tutor and at least one absence date.</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleTutorAbsenceCapture}
            disabled={pending || !effectiveTutorShortName || !cleanTutorDates.length}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Capture absence
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOption('showTutorAbsenceBuilder', true);
            setOption('hideTutorAbsenceBuilder', false);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-50"
        >
          Structure a tutor absence
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">{labelPlanningType(effectiveOptions.itemType)}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">{labelPlanningArea(effectiveOptions.area)}</span>
          {effectiveOptions.linkedWorkflowId ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800">{effectiveOptions.linkedWorkflowId}</span>
          ) : null}
          {effectiveOptions.targetDate ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">Do by {formatTargetDate(effectiveOptions.targetDate)}</span>
          ) : null}
          {effectiveOptions.linkedStudentIds.map((id) => (
            <span key={id} className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
              Student: {findStudentById(studentOptions, id)?.fullName || id}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {expanded ? 'Hide structure' : 'Add structure'}
        </button>
      </div>

      {expanded ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
          <SelectField
            label="Type"
            value={effectiveOptions.itemType}
            onChange={(value) => setOption('itemType', value)}
            options={PLANNING_ITEM_TYPES.map((value) => ({ value, label: labelPlanningType(value) }))}
          />
          <SelectField
            label="Owner"
            value={effectiveOptions.owner}
            onChange={(value) => setOption('owner', value)}
            options={PLANNING_OWNERS}
          />
          <SelectField
            label="Area"
            value={effectiveOptions.area}
            onChange={(value) => setOption('area', value)}
            options={PLANNING_AREAS.map((value) => ({ value, label: labelPlanningArea(value) }))}
          />
          <DateField
            label="Do by"
            value={effectiveOptions.targetDate}
            onChange={(value) => setOption('targetDate', value)}
          />
          <SelectField
            label="Status"
            value={effectiveOptions.status}
            onChange={(value) => setOption('status', value)}
            options={PLANNING_STATUSES.map((value) => ({ value, label: labelPlanningStatus(value) }))}
          />
          <div className="md:col-span-5">
            <StudentSearchField
              label="Linked Students"
              multiple
              value={effectiveOptions.linkedStudentIds}
              onChange={setStudentIds}
              studentOptions={studentOptions}
            />
          </div>
        </div>
      ) : null}

      {pauseBuilderVisible ? null : (
        <button
          type="submit"
          disabled={pending || !rawNote.trim()}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Capture
        </button>
      )}
    </form>
  );
}

function PlanningCard({ item, studentOptions = [], paymentExpectationOverrides = {}, onStatus, onEdit, onProgress, onPauseCompleted, onRepairPauseDetails, onOpenPauseTool, onCreateLinkedAction, pendingId, compact = false }) {
  const [progressNote, setProgressNote] = useState('');
  const [nextAction, setNextAction] = useState(item.nextAction || '');
  const [pauseToolRan, setPauseToolRan] = useState(false);
  const [pauseMessageConfirmed, setPauseMessageConfirmed] = useState(false);
  const [copyState, setCopyState] = useState('');
  const [scheduleOverrides, setScheduleOverrides] = useState({});
  const [scheduleRefreshState, setScheduleRefreshState] = useState({ pendingId: '', error: '' });
  const existingPauseDates = extractPauseDatesFromPlanningItem(item);
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairOptions, setRepairOptions] = useState({
    pauseType: existingPauseDates.startDate && existingPauseDates.endDate && existingPauseDates.startDate !== existingPauseDates.endDate ? 'range' : 'single',
    linkedStudentId: item.linkedStudentId || '',
    pauseLessonDate: existingPauseDates.startDate === existingPauseDates.endDate ? existingPauseDates.startDate : '',
    pauseFirstPauseDate: existingPauseDates.startDate !== existingPauseDates.endDate ? existingPauseDates.startDate : '',
    pauseReturnDate: existingPauseDates.startDate !== existingPauseDates.endDate ? existingPauseDates.endDate : '',
    pauseExtraNote: '',
  });
  const isPending = pendingId === item.planningId;
  const isPauseReminder = isPausePlanningItem(item);
  const isSchoolNote = isSchoolNotePlanningItem(item);
  const isSchoolForwardReview = item.planningId === SCHOOL_FORWARD_PLANNING_ID;
  const pausePaymentConfirmed = hasPausePaymentConfirmation(item);
  const isTutorAbsenceCard = item.linkedWorkflowId === 'tutor-absence' && Boolean(item.linkedTutorId);
  const linkedWorkflowHref = isTutorAbsenceCard
    ? buildTutorAbsenceWorkflowHref(item)
    : workflowHref(item.linkedWorkflowId);
  const linkedStudentBase = findStudentById(studentOptions, item.linkedStudentId);
  const linkedStudent = linkedStudentBase ? {
    ...linkedStudentBase,
    scheduleContext: scheduleOverrides[item.linkedStudentId] || linkedStudentBase.scheduleContext,
  } : null;
  const repairStudentBase = findStudentById(studentOptions, repairOptions.linkedStudentId);
  const repairStudent = repairStudentBase ? {
    ...repairStudentBase,
    scheduleContext: scheduleOverrides[repairOptions.linkedStudentId] || repairStudentBase.scheduleContext,
  } : null;
  const repairPauseType = repairOptions.pauseType === 'range' ? 'range' : 'single';
  const repairDateSuggestions = buildPauseLessonDateSuggestions(repairStudent?.scheduleContext, {
    count: 6,
    startDate: repairPauseType === 'range' ? repairOptions.pauseFirstPauseDate || '' : '',
  });
  const repairDraft = buildStructuredPausePlanningDraft({
    studentName: repairStudent?.fullName || '',
    pauseType: repairPauseType,
    lessonDate: repairOptions.pauseLessonDate || '',
    firstPauseDate: repairOptions.pauseFirstPauseDate || '',
    returnDate: repairOptions.pauseReturnDate || '',
    extraNote: repairOptions.pauseExtraNote || '',
  });
  const linkedStudentPaymentExpectation = paymentExpectationOverrides[item.linkedStudentId] || linkedStudent?.paymentExpectation || '';
  const pauseExpectationAlreadySet = linkedStudentPaymentExpectation === 'stripe_paused_expected';
  const paymentPausePrefillUrl = isPauseReminder
    ? buildPaymentPausePrefillUrl({ item, student: linkedStudent })
    : '';
  const pauseConfirmationMessage = isPauseReminder
    ? buildPauseConfirmationMessage({ item, student: linkedStudent })
    : '';
  const canCompletePause = Boolean(
    item.linkedStudentId
    && paymentPausePrefillUrl
    && (pauseToolRan || pauseExpectationAlreadySet)
    && (pauseMessageConfirmed || pausePaymentConfirmed)
  );
  const linkedStudentIds = parseLinkedStudentIds(item.linkedStudentIds ?? item.linkedStudentId);
  const linkFacts = [
    item.linkedWorkflowId ? { label: `Workflow: ${item.linkedWorkflowId}`, href: linkedWorkflowHref } : null,
    ...linkedStudentIds.map((id) => ({
      label: `Student: ${findStudentById(studentOptions, id)?.fullName || id}`,
      href: studentHref(id),
    })),
    item.linkedTutorId ? { label: `Tutor: ${item.linkedTutorId}`, href: '' } : null,
  ].filter(Boolean);

  async function refreshRepairSchedule() {
    if (!repairOptions.linkedStudentId) return;
    setScheduleRefreshState({ pendingId: repairOptions.linkedStudentId, error: '' });
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(repairOptions.linkedStudentId)}/schedule`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Schedule refresh failed');
      }
      setScheduleOverrides((current) => ({
        ...current,
        [repairOptions.linkedStudentId]: data.scheduleContext,
      }));
      setScheduleRefreshState({ pendingId: '', error: '' });
    } catch (error) {
      setScheduleRefreshState({ pendingId: '', error: error.message || 'Schedule refresh failed' });
    }
  }

  return (
    <article className={compact ? '' : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]'}>
      {!compact && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {isPauseReminder ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pause
                {item.targetDate ? (
                  <span className="normal-case text-amber-800"> · do by {formatTargetDate(item.targetDate)}</span>
                ) : null}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {item.itemTypeLabel}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${momentumClasses(item.momentum)}`}>
                  {item.momentumLabel}
                </span>
              </div>
            )}
            <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      )}

      {!compact && !isPauseReminder && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          <span>{item.owner}</span>
          <span>·</span>
          <span>{item.areaLabel}</span>
          <span>·</span>
          <span>Updated {formatDateTime(item.updatedAt || item.createdAt)}</span>
        </div>
      )}

      {item.outcome && (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="font-semibold">Outcome: </span>
          {item.outcome}
        </div>
      )}

      {item.nextAction && !isPauseReminder && (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-slate-800">
          <span className="font-semibold">Next action: </span>
          {item.nextAction}
        </div>
      )}

      {item.targetDate && !isPauseReminder ? (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span className="font-semibold">Do by: </span>
          {formatTargetDate(item.targetDate)}
        </div>
      ) : null}

      {item.notes && !isPauseReminder && <p className="mt-3 text-sm leading-6 text-slate-600">{shortPreview(item.notes)}</p>}

      {linkFacts.length > 0 && !isPauseReminder && (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkFacts.map((fact) => (
            <LinkPill key={fact.label} label={fact.label} href={fact.href} />
          ))}
        </div>
      )}

      {linkedWorkflowHref && !isPauseReminder ? (
        <Link
          href={linkedWorkflowHref}
          className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white"
        >
          {isTutorAbsenceCard ? 'Open tutor absence workflow →' : 'Open linked workflow'}
        </Link>
      ) : null}

      {item.latestProgress && !isPauseReminder && (
        <div className="mt-4 border-l-2 border-slate-200 pl-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">{isSchoolForwardReview ? 'Latest reflection' : 'Latest progress'}</p>
          <ExpandableText text={item.latestProgress.progressNote} className="mt-1" />
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.latestProgress.createdAt)}</p>
        </div>
      )}

      {isSchoolNote && item.nextAction && item.status !== 'done' ? (
        <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
          <p className="text-sm font-semibold text-slate-900">Turn this thinking into work</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Keep the note as context, then create a linked action from the next step.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onCreateLinkedAction?.(item)}
            className="mt-3 inline-flex rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create linked action
          </button>
        </div>
      ) : null}

      {!compact && (
        <div className="mt-4 flex flex-wrap gap-2">
          {['active', 'waiting', 'done', 'parked'].map((status) => (
            <button
              key={status}
              type="button"
              disabled={isPending || item.status === status || (status === 'done' && isPauseReminder && !pausePaymentConfirmed)}
              onClick={() => onStatus(item, status)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {labelPlanningStatus(status)}
            </button>
          ))}
        </div>
      )}

      {isPauseReminder ? (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
          {(
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-amber-950">Complete this pause</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Run the tool, send the parent message, then mark it complete — the dashboard handles the rest.
                </p>
              </div>
              {paymentPausePrefillUrl ? (
                onOpenPauseTool ? (
                  <button
                    type="button"
                    onClick={() => onOpenPauseTool(paymentPausePrefillUrl, linkedStudent?.fullName || item.title)}
                    className="inline-flex rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-50"
                  >
                    Open payment pause tool
                  </button>
                ) : (
                  <a
                    href={paymentPausePrefillUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-50"
                  >
                    Open payment pause tool
                  </a>
                )
              ) : (
                <span className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900">
                  Add structured pause dates to prefill the pause tool
                </span>
              )}
              {!paymentPausePrefillUrl ? (
                <div className="rounded-lg border border-amber-100 bg-white p-3">
                  <button
                    type="button"
                    onClick={() => setRepairOpen((current) => !current)}
                    className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                  >
                    {repairOpen ? 'Hide date repair' : 'Add dates to this plan'}
                  </button>

                  {repairOpen ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <SelectField
                          label="Pause type"
                          value={repairPauseType}
                          onChange={(value) => setRepairOptions((current) => ({ ...current, pauseType: value }))}
                          options={[
                            { value: 'single', label: 'One lesson' },
                            { value: 'range', label: 'Away period' },
                          ]}
                        />
                        <StudentSearchField
                          label="Student"
                          value={repairOptions.linkedStudentId}
                          onChange={(value) => setRepairOptions((current) => ({ ...current, linkedStudentId: value }))}
                          studentOptions={studentOptions}
                        />
                      </div>

                      {repairStudent?.scheduleContext?.status === 'found' && repairDateSuggestions.length ? (
                        <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Suggested lesson dates</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {repairDateSuggestions.map((suggestion) => (
                              <div key={suggestion.date} className="rounded-lg border border-violet-100 bg-white p-2">
                                <p className="text-sm font-semibold text-slate-900">{suggestion.lessonLabel}</p>
                                {repairPauseType === 'single' ? (
                                  <button
                                    type="button"
                                    onClick={() => setRepairOptions((current) => ({ ...current, pauseLessonDate: suggestion.date }))}
                                    className="mt-2 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                                  >
                                    Use this lesson
                                  </button>
                                ) : (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setRepairOptions((current) => ({ ...current, pauseFirstPauseDate: suggestion.date }))}
                                      className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                                    >
                                      First missed
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRepairOptions((current) => ({ ...current, pauseReturnDate: suggestion.date }))}
                                      className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                                    >
                                      Returning
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : repairOptions.linkedStudentId ? (
                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                          <p className="text-sm font-semibold text-amber-950">No cached schedule for this student yet.</p>
                          <p className="mt-1 text-xs leading-5 text-amber-800">
                            Refresh from MMS to pull the usual lesson slot into `Schedule_Context`, then the suggested pause dates should appear here.
                          </p>
                          <button
                            type="button"
                            onClick={refreshRepairSchedule}
                            disabled={scheduleRefreshState.pendingId === repairOptions.linkedStudentId}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {scheduleRefreshState.pendingId === repairOptions.linkedStudentId ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Refreshing...
                              </>
                            ) : 'Refresh schedule from MMS'}
                          </button>
                          {scheduleRefreshState.error ? (
                            <p className="mt-2 text-xs font-semibold text-red-700">{scheduleRefreshState.error}</p>
                          ) : null}
                        </div>
                      ) : null}

                      {repairPauseType === 'single' ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <DateField
                            label="Lesson to pause"
                            value={repairOptions.pauseLessonDate || ''}
                            onChange={(value) => setRepairOptions((current) => ({ ...current, pauseLessonDate: value }))}
                          />
                          <TextField
                            label="Extra note"
                            value={repairOptions.pauseExtraNote || ''}
                            onChange={(value) => setRepairOptions((current) => ({ ...current, pauseExtraNote: value }))}
                            placeholder="Optional reason or context"
                          />
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-3">
                          <DateField
                            label="First lesson missed"
                            value={repairOptions.pauseFirstPauseDate || ''}
                            onChange={(value) => setRepairOptions((current) => ({ ...current, pauseFirstPauseDate: value }))}
                          />
                          <DateField
                            label="Returning from"
                            value={repairOptions.pauseReturnDate || ''}
                            onChange={(value) => setRepairOptions((current) => ({ ...current, pauseReturnDate: value }))}
                          />
                          <TextField
                            label="Extra note"
                            value={repairOptions.pauseExtraNote || ''}
                            onChange={(value) => setRepairOptions((current) => ({ ...current, pauseExtraNote: value }))}
                            placeholder="Summer holiday, illness, etc."
                          />
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                        {repairDraft.isComplete ? (
                          <>
                            <p className="font-semibold text-slate-900">{repairDraft.title}</p>
                            <p className="mt-1 whitespace-pre-line">{repairDraft.notes}</p>
                            {repairDraft.targetDate ? (
                              <p className="mt-2 text-xs font-semibold text-amber-800">Do by {formatTargetDate(repairDraft.targetDate)}</p>
                            ) : null}
                          </>
                        ) : (
                          <p>Add {repairDraft.missingFields.join(' and ')} to repair this pause plan.</p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isPending || !repairDraft.isComplete}
                        onClick={() => onRepairPauseDetails(item, {
                          draft: repairDraft,
                          linkedStudentId: repairOptions.linkedStudentId,
                        })}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save structured dates
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {pauseConfirmationMessage ? (
                <div className="rounded-lg border border-amber-100 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Parent message</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{pauseConfirmationMessage}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pauseConfirmationMessage);
                        setCopyState('Copied');
                        logCommunicationCopy({
                          category: 'pause',
                          mmsId: item.linkedStudentId,
                          studentName: linkedStudent?.fullName || '',
                          body: pauseConfirmationMessage,
                          source: 'pause_card',
                        });
                      } catch (error) {
                        setCopyState('Copy failed');
                      }
                    }}
                    className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Copy message
                  </button>
                  {copyState ? <span className="ml-2 text-xs font-semibold text-amber-800">{copyState}</span> : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm font-medium text-amber-950">
                  <input
                    type="checkbox"
                    checked={pauseToolRan || pauseExpectationAlreadySet}
                    disabled={isPending || pauseExpectationAlreadySet}
                    onChange={(event) => setPauseToolRan(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-300 text-slate-900"
                  />
                  <span>
                    Payment pause tool has been run
                    {pauseExpectationAlreadySet ? (
                      <span className="block text-xs font-normal text-amber-800">Payment expectation is already paused expected.</span>
                    ) : null}
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm font-medium text-amber-950">
                  <input
                    type="checkbox"
                    checked={pauseMessageConfirmed || pausePaymentConfirmed}
                    disabled={isPending || pausePaymentConfirmed}
                    onChange={(event) => setPauseMessageConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-300 text-slate-900"
                  />
                  <span>
                    Parent confirmation message sent
                    {pausePaymentConfirmed ? (
                      <span className="block text-xs font-normal text-amber-800">Already logged on this planning item.</span>
                    ) : null}
                  </span>
                </label>
              </div>
              <button
                type="button"
                disabled={isPending || !canCompletePause}
                onClick={() => onPauseCompleted(item)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-950 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? 'Completing...' : 'Mark pause completed'}
              </button>
              <p className="text-xs leading-5 text-amber-800">
                Logs the confirmation and sets paused-expected if needed — doesn&apos;t run Stripe directly.
              </p>
              {!item.linkedStudentId ? (
                <p className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900">
                  Save structured dates with a linked student before completing this pause.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {isPauseReminder ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-semibold text-slate-700">Details</summary>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{item.owner}</span>
              <span>·</span>
              <span>{item.areaLabel}</span>
              <span>·</span>
              <span>Updated {formatDateTime(item.updatedAt || item.createdAt)}</span>
            </div>
            {item.nextAction ? (
              <p><span className="font-semibold text-slate-700">Next action: </span>{item.nextAction}</p>
            ) : null}
            {item.notes ? <p className="leading-6">{shortPreview(item.notes)}</p> : null}
            {linkFacts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {linkFacts.map((fact) => (
                  <LinkPill key={fact.label} label={fact.label} href={fact.href} />
                ))}
              </div>
            ) : null}
            {item.latestProgress ? (
              <div className="border-l-2 border-slate-200 pl-3">
                <p className="font-semibold text-slate-800">Latest progress</p>
                <ExpandableText text={item.latestProgress.progressNote} className="mt-1" />
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.latestProgress.createdAt)}</p>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <form
        className={`mt-4 grid gap-2 ${isSchoolForwardReview ? 'md:grid-cols-[1fr_auto]' : 'md:grid-cols-[1fr_1fr_auto]'}`}
        onSubmit={(event) => {
          event.preventDefault();
          onProgress(item, { progressNote, nextAction });
          setProgressNote('');
        }}
      >
        {isSchoolForwardReview ? (
          <div className="space-y-2">
            <textarea
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
              placeholder={`What moved forward:\n-\n\nUseful decisions:\n-\n\nWhat felt stuck:\n-\n\nWhat we learned:\n-\n\nNext improvement to make time for:\n-`}
              rows={4}
              className="min-h-28 w-full rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500"
            />
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="Next improvement to make time for"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
            <p className="text-xs leading-5 text-slate-500">
              Saved as dated progress history for later monthly or quarterly summaries.
            </p>
          </div>
        ) : (
          <>
            <input
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
              placeholder="Add progress note"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="Update next action"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </>
        )}
        <button
          type="submit"
          disabled={isPending || !progressNote.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isSchoolForwardReview ? 'Add Friday reflection' : 'Log'}
        </button>
      </form>
    </article>
  );
}

// Calm, focused card for the "due today" view. Shows a plain-language headline +
// next step + minimal meta, with one obvious action. Deeper work (and the full
// pause toolkit) lives behind "Details", which renders the full PlanningCard with
// every handler passed through — so the pause checklist, the side-screen pause
// tool, and the copy-message button all still work.
function DueTodayCard({
  item,
  studentOptions = [],
  paymentExpectationOverrides = {},
  onStatus,
  onEdit,
  onProgress,
  onPauseCompleted,
  onRepairPauseDetails,
  onOpenPauseTool,
  onCreateLinkedAction,
  onDefer,
  pendingId,
}) {
  const isPause = isPausePlanningItem(item);
  const [expanded, setExpanded] = useState(false);
  const story = getPlanningStory(item, studentOptions);
  const whatToDo = getPlanningWhatToDo(item);
  const due = dueChipLabel(item.targetDate);
  const overdue = due.startsWith('Overdue');
  const isPending = pendingId === item.planningId;

  return (
    <article className={`rounded-2xl border bg-white p-5 shadow-sm ${overdue ? 'border-amber-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${overdue ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
            {due}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {item.owner && item.owner !== 'Unassigned' ? item.owner : 'Unassigned'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>

      <h3 className="mt-2 text-base font-semibold text-slate-900">{story}</h3>
      {!isPause && whatToDo ? <p className="mt-1 text-sm leading-6 text-slate-600">{whatToDo}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!isPause && (
          <button
            type="button"
            onClick={() => onStatus(item, 'done')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Mark done
          </button>
        )}
        <button
          type="button"
          onClick={() => onDefer(item)}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Defer until next meeting
        </button>
        {!isPause && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {expanded ? 'Hide details' : 'Details'}
          </button>
        )}
      </div>

      {/* Pause cards show the steps inline (unhidden, minus the noise); other
          cards reveal the full card under Details. Both use compact mode. */}
      {isPause || expanded ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <PlanningCard
            item={item}
            studentOptions={studentOptions}
            paymentExpectationOverrides={paymentExpectationOverrides}
            onStatus={onStatus}
            onEdit={onEdit}
            onProgress={onProgress}
            onPauseCompleted={onPauseCompleted}
            onRepairPauseDetails={onRepairPauseDetails}
            onOpenPauseTool={onOpenPauseTool}
            onCreateLinkedAction={onCreateLinkedAction}
            pendingId={pendingId}
            compact
          />
        </div>
      ) : null}
    </article>
  );
}

// One "next improvement" from Friday's reflection on the Monday panel. Click to
// expand into a small editor (shape the title, add a note, pick an owner and a
// do-by) before it becomes a planning card — rather than scheduling the raw line.
function MondayIntentionRow({ intention, defaultDueDate, onSchedule, onDismiss, pending }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(intention);
  const [notes, setNotes] = useState('');
  const [owner, setOwner] = useState('Unassigned');
  const [targetDate, setTargetDate] = useState(defaultDueDate);

  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-800">{intention}</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50"
          >
            {expanded ? 'Cancel' : <><Plus className="h-3.5 w-3.5" /> Schedule</>}
          </button>
          <button
            type="button"
            onClick={() => onDismiss(intention)}
            disabled={pending}
            title="Remove this suggestion from the Monday scheduling list"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Dismiss
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <TextField label="Title" value={title} onChange={setTitle} placeholder="Shorten into a clear task" />
          <TextAreaField label="Description (optional)" value={notes} onChange={setNotes} rows={2} placeholder="Any extra context" />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Owner" value={owner} onChange={setOwner} options={PLANNING_OWNERS} />
            <DateField label="Do by" value={targetDate} onChange={setTargetDate} />
          </div>
          <button
            type="button"
            onClick={() => onSchedule({ title, notes, owner, targetDate })}
            disabled={pending || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add to board
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminPlanningPageClient({ initialPlanning, initialFilter = 'all', studentOptions = [] }) {
  const [planning, setPlanning] = useState(initialPlanning || { items: [], summary: {} });
  const [quickNote, setQuickNote] = useState('');
  const [quickOptions, setQuickOptions] = useState({});
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [schoolNoteForm, setSchoolNoteForm] = useState(EMPTY_SCHOOL_NOTE_FORM);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saveState, setSaveState] = useState({ pending: false, error: '', savedAt: '' });
  const [pendingId, setPendingId] = useState('');
  const [paymentExpectationOverrides, setPaymentExpectationOverrides] = useState({});
  const [scheduledIntentions, setScheduledIntentions] = useState({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [showDone, setShowDone] = useState(false);
  // { url, name } when the pause-tool side window is open; null when closed.
  const [pauseToolPanel, setPauseToolPanel] = useState(null);

  useEffect(() => {
    if (!pauseToolPanel) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') setPauseToolPanel(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pauseToolPanel]);
  const editPanelRef = useRef(null);

  useEffect(() => {
    if (editingItem && editPanelRef.current) {
      editPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editingItem]);

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (planning.items || []).filter((item) => {
      if (!showDone && filter !== 'done' && item.status === 'done') {
        return false;
      }
      if (search && !buildSearchText(item).includes(search)) {
        return false;
      }
      if (filter === 'due_now') {
        return isDueNowPlanningItem(item);
      }
      if (filter === 'meeting') {
        return isMeetingPlanningItem(item);
      }
      if (filter === 'school_notes') {
        return SCHOOL_NOTE_TYPES.has(item.itemType);
      }
      if (filter === 'unassigned') {
        return isOpenPlanningItem(item) && item.owner === 'Unassigned';
      }
      if (filter === 'waiting_status') {
        return isOpenPlanningItem(item) && item.status === 'waiting';
      }
      if (filter === 'linked') {
        return isOpenPlanningItem(item) && hasPlanningLink(item);
      }
      if (filter === 'all') {
        return true;
      }
      if (filter === 'done') {
        return item.status === 'done';
      }
      if (PLANNING_ITEM_TYPES.includes(filter)) {
        return item.itemType === filter;
      }
      return item.momentum === filter;
    });
  }, [planning.items, query, filter, showDone]);

  // `silent` skips the pending/savedAt/pendingId bookkeeping so a multi-step
  // action (e.g. completing a pause) can own that state across several calls
  // without the button flickering enabled between steps.
  async function postPlanning(payload, targetId = '', { silent = false } = {}) {
    if (!silent) {
      setSaveState({ pending: true, error: '', savedAt: '' });
      setPendingId(targetId);
    }
    const response = await fetch('/api/admin/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Planning save failed');
    }

    setPlanning(data.planning);
    if (!silent) {
      setSaveState({
        pending: false,
        error: '',
        savedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      });
      setPendingId('');
    }
    return data.planning;
  }

  async function handleCapture(event) {
    event.preventDefault();
    const rawNote = quickNote.trim();
    if (!rawNote) {
      setSaveState({ pending: false, error: 'Write a note before capturing.', savedAt: '' });
      return;
    }

    const item = buildQuickCaptureItem(rawNote, quickOptions, studentOptions);

    try {
      await postPlanning({
        mode: 'save',
        item,
        progressNote: item.progressNote,
      });
      setQuickNote('');
      setQuickOptions({});
      setQuickExpanded(false);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleSchoolNoteCapture(event) {
    event.preventDefault();
    const item = buildSchoolNoteItem(schoolNoteForm);
    if (!item.title || !item.notes) {
      setSaveState({ pending: false, error: 'Add a title and main note before saving.', savedAt: '' });
      return;
    }

    try {
      await postPlanning({
        mode: 'save',
        item,
        progressNote: item.progressNote,
      });
      setSchoolNoteForm(EMPTY_SCHOOL_NOTE_FORM);
      setFilter('school_notes');
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleCreateLinkedAction(item) {
    const title = `${item.nextAction || ''}`.trim();
    if (!title) {
      setSaveState({ pending: false, error: 'Add a next action before creating a linked action.', savedAt: '' });
      return;
    }

    try {
      await postPlanning({
        mode: 'save',
        item: {
          title,
          notes: `Created from ${item.itemTypeLabel || labelPlanningType(item.itemType)}: ${item.title}`,
          itemType: 'action',
          owner: item.owner || 'Unassigned',
          status: 'active',
          area: item.area || 'other',
          parentPlanningId: item.planningId,
          nextAction: title,
        },
        progressNote: `Created linked action from: ${item.title}`,
      }, item.planningId);

      await postPlanning({
        mode: 'progress',
        planningId: item.planningId,
        progressNote: `Created linked action: ${title}`,
        progressType: 'decision',
        nextAction: item.nextAction,
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  // Monday review: turn one "next improvement" intention from Friday's reflection
  // into a dated, owned action item linked back to the reflection. The row's
  // editor supplies the shaped title/notes/owner/do-by; we key the scheduled
  // state by the original intention line so it flips even if the title was edited.
  async function handleScheduleIntention(intention, { title, notes, owner, targetDate } = {}) {
    const cleanTitle = `${title || ''}`.trim();
    if (!cleanTitle) {
      return;
    }
    try {
      await postPlanning({
        mode: 'save',
        item: {
          title: cleanTitle,
          notes: [
            `Friday intention: ${intention}`,
            `${notes || ''}`.trim(),
          ].filter(Boolean).join('\n'),
          itemType: 'action',
          owner: owner || 'Unassigned',
          status: 'active',
          area: 'other',
          parentPlanningId: SCHOOL_FORWARD_PLANNING_ID,
          targetDate: targetDate || calculateFridayReviewDate(new Date()),
          progressNote: 'Scheduled from Friday reflection.',
        },
        progressNote: 'Scheduled from Friday reflection.',
      });
      setScheduledIntentions((current) => ({
        ...current,
        [normaliseReflectionIntentionKey(intention || cleanTitle)]: { targetDate: targetDate || calculateFridayReviewDate(new Date()) },
      }));
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleDismissIntention(intention) {
    if (!mondayItem?.planningId) {
      return;
    }
    try {
      await postPlanning({
        mode: 'progress',
        planningId: mondayItem.planningId,
        progressNote: buildReflectionIntentionDismissalNote(intention),
        progressType: 'decision',
        nextAction: mondayItem.nextAction,
      }, mondayItem.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handlePauseCapture(rawNote, overrides) {
    const note = (rawNote || '').trim();
    if (!note) {
      setSaveState({ pending: false, error: 'Add the pause details before capturing.', savedAt: '' });
      return;
    }
    const item = buildQuickCaptureItem(note, overrides, studentOptions);
    try {
      await postPlanning({
        mode: 'save',
        item,
        progressNote: item.progressNote,
      });
      setQuickNote('');
      setQuickOptions({});
      setQuickExpanded(false);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleTutorAbsenceCapture(tutorShortName, dates) {
    setSaveState({ pending: true, error: '', savedAt: '' });
    try {
      const response = await fetch('/api/admin/planning/tutor-absence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorShortName, dates }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Tutor absence capture failed');
      }
      setPlanning(data.planning);
      setQuickNote('');
      setQuickOptions({});
      setQuickExpanded(false);
      setSaveState({
        pending: false,
        error: '',
        savedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
    }
  }

  function startEdit(item) {
    setEditingItem(item);
    setEditForm({
      ...EMPTY_FORM,
      title: item.title,
      notes: item.notes,
      itemType: item.itemType,
      owner: item.owner,
      status: item.status,
      area: item.area,
      linkedWorkflowId: item.linkedWorkflowId,
      linkedStudentId: item.linkedStudentId,
      linkedStudentIds: parseLinkedStudentIds(item.linkedStudentIds ?? item.linkedStudentId),
      linkedTutorId: item.linkedTutorId,
      parentPlanningId: item.parentPlanningId,
      outcome: item.outcome,
      nextAction: item.nextAction,
      targetDate: item.targetDate,
    });
  }

  async function handleEdit(event) {
    event.preventDefault();
    if (!editingItem) {
      return;
    }

    try {
      await postPlanning({
        mode: 'save',
        planningId: editingItem.planningId,
        item: editForm,
        progressNote: editForm.progressNote,
      }, editingItem.planningId);
      setEditingItem(null);
      setEditForm(EMPTY_FORM);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleStatus(item, status) {
    try {
      await postPlanning({
        mode: 'status',
        planningId: item.planningId,
        status,
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  // Push an item's "do by" to the next meeting day (Mon/Thu/Fri), used by the
  // calm due-today view. A save merges over the existing row, so only title +
  // targetDate need to be sent.
  async function handleDefer(item) {
    const tomorrow = new Date();
    tomorrow.setHours(12, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMeeting = calculateNextMeetingDate(tomorrow);
    try {
      await postPlanning({
        mode: 'save',
        planningId: item.planningId,
        item: { title: item.title, targetDate: nextMeeting },
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleProgress(item, { progressNote, nextAction }) {
    try {
      await postPlanning({
        mode: 'progress',
        planningId: item.planningId,
        progressNote,
        progressType: 'note',
        nextAction,
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleRepairPauseDetails(item, { draft, linkedStudentId }) {
    if (!draft?.isComplete) {
      setSaveState({ pending: false, error: 'Add the missing pause date details before saving.', savedAt: '' });
      return;
    }

    try {
      await postPlanning({
        mode: 'save',
        planningId: item.planningId,
        item: {
          ...item,
          title: draft.title,
          notes: draft.notes,
          itemType: 'action',
          status: item.status === 'inbox' ? 'active' : item.status,
          area: 'admin',
          linkedStudentId: linkedStudentId || item.linkedStudentId,
          targetDate: draft.targetDate || item.targetDate,
          nextAction: draft.nextAction,
        },
        progressNote: draft.progressNote || 'Added structured pause dates to existing planning item.',
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message || 'Pause date repair failed', savedAt: '' });
      setPendingId('');
    }
  }

  async function handlePauseCompleted(item) {
    if (!item.linkedStudentId) {
      setSaveState({ pending: false, error: 'Link a student before completing a pause task.', savedAt: '' });
      return;
    }

    try {
      setSaveState({ pending: true, error: '', savedAt: '' });
      setPendingId(item.planningId);

      if (!hasPausePaymentConfirmation(item)) {
        await postPlanning({
          mode: 'progress',
          planningId: item.planningId,
          progressNote: PAUSE_PAYMENT_CONFIRMATION_NOTE,
          progressType: 'action_completed',
          nextAction: item.nextAction,
        }, item.planningId, { silent: true });
      }

      const linkedStudent = findStudentById(studentOptions, item.linkedStudentId);
      const currentExpectation = paymentExpectationOverrides[item.linkedStudentId] || linkedStudent?.paymentExpectation || '';
      if (currentExpectation !== 'stripe_paused_expected') {
        const response = await fetch(`/api/admin/students/${encodeURIComponent(item.linkedStudentId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentExpectation: 'stripe_paused_expected',
            auditContext: {
              source: 'admin_pause_workflow_action',
              actionLabel: 'Complete pause from Planning',
              note: `Linked planning item: ${item.title}`,
            },
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Pause expectation update failed');
        }

        await postPlanning({
          mode: 'progress',
          planningId: item.planningId,
          progressNote: PAUSE_EXPECTATION_SET_NOTE,
          progressType: 'action_completed',
          nextAction: item.nextAction,
        }, item.planningId, { silent: true });
        setPaymentExpectationOverrides((current) => ({
          ...current,
          [item.linkedStudentId]: 'stripe_paused_expected',
        }));
      }

      await postPlanning({
        mode: 'status',
        planningId: item.planningId,
        status: 'done',
        progressNote: PAUSE_COMPLETED_NOTE,
        progressType: 'action_completed',
        nextAction: item.nextAction,
      }, item.planningId, { silent: true });

      // Clear the shared pending/pendingId once, after all steps — the button stays
      // in "Completing…" the whole time instead of flickering between calls.
      setSaveState({
        pending: false,
        error: '',
        savedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      });
      setPendingId('');
    } catch (error) {
      setSaveState({ pending: false, error: error.message || 'Pause completion failed', savedAt: '' });
      setPendingId('');
    }
  }

  const summary = planning.summary || {};
  const schoolForwardReflections = useMemo(
    () => buildSchoolForwardReflections(planning.items || [], { limit: 6 }),
    [planning.items],
  );

  const mondayItem = useMemo(
    () => (planning.items || []).find((item) => item.planningId === MONDAY_SCHEDULE_PLANNING_ID) || null,
    [planning.items],
  );
  const latestReflectionNote = useMemo(
    () => getLatestSchoolForwardReflectionNote(planning.items || []),
    [planning.items],
  );
  const reflectionIntentions = useMemo(
    () => extractReflectionIntentions(latestReflectionNote?.progressNote || ''),
    [latestReflectionNote],
  );
  const dismissedIntentions = useMemo(
    () => extractDismissedReflectionIntentions(mondayItem || {}),
    [mondayItem],
  );
  // Intentions already turned into linked action items (so they don't get
  // re-scheduled across reloads), keyed by lowercased title → the card's do-by.
  const alreadyScheduledByTitle = useMemo(() => {
    const map = new Map();
    for (const item of planning.items || []) {
      if (item.parentPlanningId === SCHOOL_FORWARD_PLANNING_ID && `${item.title || ''}`.trim()) {
        map.set(normaliseReflectionIntentionKey(item.title), { targetDate: item.targetDate || '' });
        const intentionLine = `${item.notes || ''}`.split(/\r?\n/u)
          .find((line) => /^Friday intention:/iu.test(line.trim()));
        const sourceIntention = intentionLine ? intentionLine.replace(/^Friday intention:\s*/iu, '') : '';
        const sourceKey = normaliseReflectionIntentionKey(sourceIntention);
        if (sourceKey) {
          map.set(sourceKey, { targetDate: item.targetDate || '' });
        }
      }
    }
    return map;
  }, [planning.items]);
  const openReflectionIntentions = useMemo(() => reflectionIntentions.filter((intention) => {
    const key = normaliseReflectionIntentionKey(intention);
    const sessionEntry = scheduledIntentions[key];
    const existing = alreadyScheduledByTitle.get(key);
    return !sessionEntry && !existing && !dismissedIntentions.has(key);
  }), [alreadyScheduledByTitle, dismissedIntentions, reflectionIntentions, scheduledIntentions]);
  const mondayDefaultDueDate = useMemo(() => calculateFridayReviewDate(new Date()), []);
  const mondayReviewOpen = Boolean(
    mondayItem
    && !['done', 'parked'].includes(mondayItem.status)
    && openReflectionIntentions.length > 0,
  );

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Planning inbox</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Planning
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Capture ideas quickly, turn chosen work into initiatives, and keep momentum visible through next actions and progress notes.
        </p>
      </section>

      {mondayReviewOpen ? (
        <section className="rounded-[1.2rem] border border-blue-100 bg-blue-50/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Monday scheduling</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">Schedule what we said we’d work on</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                From Friday’s reflection ({formatDateTime(latestReflectionNote.createdAt)}). Turn each “next improvement” into a dated, owned task — each gets a “Do by” of this Friday and links back to the reflection.
              </p>
            </div>
            <Link
              href="/admin/planning?filter=meeting"
              className="whitespace-nowrap rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50"
            >
              Meeting view
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {openReflectionIntentions.map((intention) => (
              <MondayIntentionRow
                key={intention}
                intention={intention}
                defaultDueDate={mondayDefaultDueDate}
                onSchedule={(values) => handleScheduleIntention(intention, values)}
                onDismiss={handleDismissIntention}
                pending={saveState.pending}
              />
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Scheduled items appear on the board as dated actions. Mark the Monday card done once you’ve scheduled this week’s work.
          </p>
        </section>
      ) : null}

      {filter === 'meeting' ? (
        <section className="rounded-[1.2rem] border border-emerald-100 bg-emerald-50/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Meeting rhythm</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Keep things running</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                Clear dated work, pauses, tutor absences, waiting items, and unresolved admin loops quickly.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Move the school forward</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                Protect time for one useful improvement, decision, or learning from the week, especially on Friday.
              </p>
            </div>
          </div>
          {schoolForwardReflections.length ? (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Recent Friday reflections</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Dated progress entries from the weekly school-forward prompt. This is the raw material for monthly or quarterly summaries.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {schoolForwardReflections.length} recent
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {schoolForwardReflections.map((reflection) => (
                  <div key={reflection.progressId} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">{formatDateTime(reflection.createdAt)}</p>
                    <ExpandableText text={reflection.progressNote} className="mt-1 text-sm leading-6 text-slate-700" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-white/70 p-4">
              <h3 className="text-base font-semibold text-slate-900">Friday reflections</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Add reflections to the Friday prompt and they will appear here as a dated record of what moved forward.
              </p>
            </div>
          )}
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-5">
        {[
          ['Open planning', summary.open || 0],
          ['Active', summary.active || 0],
          ['Inbox', summary.inbox || 0],
          ['School notes', summary.activeSchoolNotes || 0],
          ['No next action', summary.noNextAction || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section className={cardClasses('border-violet-100 bg-violet-50/50')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Work on the school notes</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Use this for learning notes, transcript summaries, and strategic scratchpad thoughts. Keep the thinking here, then turn the useful bit into a linked action when it is ready.
            </p>
          </div>
          <Link
            href="/admin/planning?filter=school_notes"
            className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-900 hover:bg-violet-50"
          >
            View school notes
          </Link>
        </div>
        <div className="mt-5 rounded-2xl border border-violet-100 bg-white/90 p-4">
          <SchoolNoteCapture
            form={schoolNoteForm}
            onChange={setSchoolNoteForm}
            onSubmit={handleSchoolNoteCapture}
            pending={saveState.pending && !pendingId}
          />
        </div>
      </section>

      <section className={cardClasses()}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Brain capture</h3>
            <p className="mt-1 text-sm text-slate-600">One box for the stuff that would usually disappear in WhatsApp.</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Add dates when you can. Pauses, cancellations, and tutor absences should usually be done before the lesson day. Review rhythm: Monday, Thursday, Friday.
            </p>
          </div>
          {saveState.savedAt && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Saved {saveState.savedAt}
            </span>
          )}
        </div>
        {saveState.error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveState.error}</p>
        )}
        <div className="mt-5">
          <QuickBrainCapture
            rawNote={quickNote}
            setRawNote={setQuickNote}
            options={quickOptions}
            setOptions={setQuickOptions}
            studentOptions={studentOptions}
            expanded={quickExpanded}
            setExpanded={setQuickExpanded}
            onSubmit={handleCapture}
            onTutorAbsenceCapture={handleTutorAbsenceCapture}
            onPauseCapture={handlePauseCapture}
            pending={saveState.pending && !pendingId}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className={cardClasses()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Review</h3>
              <p className="mt-1 text-sm text-slate-600">Grouped by current state, with initiatives and next actions kept visible.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowDone((current) => !current)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  showDone
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {showDone ? 'Showing done' : 'Hide done'}
              </button>
              {MOMENTUM_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    filter === option.value
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, owner, area, workflow, student, tutor"
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </label>

          <div className="mt-5 space-y-6">
            {filter === 'due_now' ? (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">On today</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    What needs doing today, calmly — overdue first. Open “Details” for the full card and tools.
                  </p>
                </div>
                {[...filteredItems]
                  .sort((a, b) => `${a.targetDate || ''}`.localeCompare(`${b.targetDate || ''}`))
                  .map((item) => (
                    <DueTodayCard
                      key={item.planningId}
                      item={item}
                      studentOptions={studentOptions}
                      paymentExpectationOverrides={paymentExpectationOverrides}
                      onStatus={handleStatus}
                      onEdit={startEdit}
                      onProgress={handleProgress}
                      onPauseCompleted={handlePauseCompleted}
                      onRepairPauseDetails={handleRepairPauseDetails}
                      onOpenPauseTool={(url, name) => setPauseToolPanel({ url, name })}
                      onCreateLinkedAction={handleCreateLinkedAction}
                      onDefer={handleDefer}
                      pendingId={pendingId}
                    />
                  ))}
              </div>
            ) : STATUS_GROUPS.map((group) => {
              const groupItems = filteredItems.filter((item) => item.status === group.key);
              if (!groupItems.length) {
                return null;
              }

              return (
                <section key={group.key}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{group.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">{group.hint}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {groupItems.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {groupItems.map((item) => (
                      <PlanningCard
                        key={item.planningId}
                        item={item}
                        studentOptions={studentOptions}
                        paymentExpectationOverrides={paymentExpectationOverrides}
                        onStatus={handleStatus}
                        onEdit={startEdit}
                        onProgress={handleProgress}
                        onPauseCompleted={handlePauseCompleted}
                        onRepairPauseDetails={handleRepairPauseDetails}
                        onOpenPauseTool={(url, name) => setPauseToolPanel({ url, name })}
                        onCreateLinkedAction={handleCreateLinkedAction}
                        pendingId={pendingId}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {!filteredItems.length && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No planning items match this view.
              </p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className={cardClasses()}>
            <h3 className="text-base font-semibold text-slate-900">Planning context</h3>
            <Link
              href="/admin/capacity"
              className="mt-4 block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
            >
              <p className="text-sm font-semibold text-slate-900">Capacity</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Free slots, tutor availability, waiting-list placement hints, and schedule-cache health.
              </p>
            </Link>
            <Link
              href="/admin/finance"
              className="mt-3 block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
            >
              <p className="text-sm font-semibold text-slate-900">Finance</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Estimate-only run-rate, tutor costs, overhead, and margin context.
              </p>
            </Link>
            <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Tutor absence</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Start the cancel-or-cover workflow for a tutor being off.
              </p>
              <Link
                href="/admin/workflows/tutor-absence"
                className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Open workflow
              </Link>
            </div>
            <Link
              href="/admin/workflows"
              className="mt-3 block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
            >
              <p className="text-sm font-semibold text-slate-900">Workflows</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Waiting list, onboarding, showcase, holidays, parent understanding, and tutor absence loops.
              </p>
            </Link>
          </div>

          {editingItem && (
            <div ref={editPanelRef} className={cardClasses('sticky top-4 ring-2 ring-blue-100')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Edit item</h3>
                  <p className="mt-1 text-sm text-slate-600">{editingItem.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setEditForm(EMPTY_FORM);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
              <div className="mt-4">
                <ItemForm
                  form={editForm}
                  onChange={setEditForm}
                  studentOptions={studentOptions}
                  onSubmit={handleEdit}
                  submitLabel="Save changes"
                  pending={pendingId === editingItem.planningId}
                />
              </div>
            </div>
          )}
        </aside>
      </section>

      {pauseToolPanel ? (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={() => setPauseToolPanel(null)}
            aria-hidden
          />
          <aside className="flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Payment pause tool</p>
                <p className="text-sm font-semibold text-slate-900">{pauseToolPanel.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pauseToolPanel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Open in full page ↗
                </a>
                <button
                  type="button"
                  onClick={() => setPauseToolPanel(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Close ✕
                </button>
              </div>
            </header>
            <iframe
              key={pauseToolPanel.url}
              src={pauseToolPanel.url}
              title={`Payment pause tool: ${pauseToolPanel.name}`}
              className="h-full w-full flex-1 border-0"
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
