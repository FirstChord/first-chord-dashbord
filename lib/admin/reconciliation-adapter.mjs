import { derivePaymentValueContext } from './payment-value-helpers.mjs';
import { calculateTutorSlotPay, DEFAULT_HOURLY_RATE } from './cost-helpers.mjs';
import { buildPauseSummary } from './pause-helpers.mjs';

// Pure adapter: maps tutor-absence facts + pause history into reconcileEpisode inputs.
// No sheet/MMS access — the caller fetches rows and passes them in. The cross-lane
// confidence rule lives here (not in the engine), so the engine stays lane-pure.

const PAUSED_EXPECTATIONS = new Set(['stripe_paused_expected', 'payment_not_needed', 'inactive_or_stopped']);

function normalise(value) {
  return `${value || ''}`.trim().toLowerCase();
}

// A dated pause window only counts as a confident suppression when the dashboard's own
// payment expectation AGREES the student is paused. A high-confidence pause match that
// disagrees with an "active" flag is a lane conflict → low confidence → the engine routes
// it to needs_clarification (surfaced for a human, not silently suppressed).
export function resolvePauseMatchConfidence({ pauseMatchConfidence, paymentExpectation }) {
  const pausedFlag = PAUSED_EXPECTATIONS.has(normalise(paymentExpectation));
  return pauseMatchConfidence === 'high' && pausedFlag ? 'high' : 'low';
}

function tutorPayAmountFor({ tutorName, tutorPay, durationMinutes, lessonKind, studentCount }) {
  const info = tutorPay.get(normalise(tutorName));
  if (info?.payModel === 'salary') return 0; // salaried tutors carry no per-lesson variable pay
  const rate = info?.hourlyRate ?? DEFAULT_HOURLY_RATE;
  const minutes = Number.parseFloat(`${durationMinutes || ''}`.replace(/[^\d.]/g, ''));
  return calculateTutorSlotPay(Number.isFinite(minutes) ? minutes : 0, lessonKind, rate, { studentCount });
}

function lessonValueFor({ instrument, durationMinutes, studentCount }) {
  const value = derivePaymentValueContext({
    instrument,
    lessonType: studentCount > 1 ? 'sibling_group' : 'individual',
    scheduleContext: { status: 'found', durationMinutes },
  });
  return Number.isFinite(value.baselineWeeklyValue) ? value.baselineWeeklyValue : 0;
}

// absenceRows: parsed Tutor_Absence_State rows (parseTutorAbsenceStateRow output).
// studentsByMmsId: live student records (Map) — the source of CURRENT payment_expectation,
// email and Stripe sub. The absence row stores a point-in-time snapshot of these, which
// goes stale (e.g. a student paused after the absence card was made), so live wins.
export function buildReconciliationInputs({ absenceRows = [], pauseRows = [], tutorPay = new Map(), studentsByMmsId = new Map(), now = new Date(), tutorFilter = null } = {}) {
  const filter = tutorFilter ? normalise(tutorFilter) : null;
  const lessonInstances = [];
  const pauseByStudent = new Map();

  for (const row of absenceRows) {
    if (filter && normalise(row.tutorShortName) !== filter && !normalise(row.tutorName).includes(filter)) continue;
    if (row.decision !== 'cancel_day' && row.decision !== 'cover') continue;
    const decision = row.decision === 'cover' ? 'cover' : 'cancel';

    for (const lesson of row.affectedLessons || []) {
      const studentCount = Number(lesson.studentCount) || 1;
      const lessonKind = studentCount > 1 ? 'group' : 'one_to_one';
      const live = studentsByMmsId.get(lesson.studentMmsId) || null;
      // Live state beats the absence-row snapshot for the lane-conflict check.
      const paymentExpectation = live?.paymentExpectation || lesson.paymentExpectation || '';
      const studentEmail = live?.email || lesson.parentEmail || '';
      const stripeSubscriptionId = live?.stripeSubscriptionId || lesson.stripeSubscriptionId || '';

      lessonInstances.push({
        eventId: lesson.eventId || '',
        studentMmsId: lesson.studentMmsId || '',
        studentName: lesson.studentName || '',
        studentCount,
        date: lesson.lessonDate || '',
        startTime: lesson.lessonTime || '',
        durationMinutes: lesson.durationMinutes || '',
        lessonKind,
        tutorId: row.tutorShortName || '',
        paymentExpectation,
        lessonValue: lessonValueFor({ instrument: lesson.instrument, durationMinutes: lesson.durationMinutes, studentCount }),
        tutorPayAmount: tutorPayAmountFor({ tutorName: row.tutorName, tutorPay, durationMinutes: lesson.durationMinutes, lessonKind, studentCount }),
        absence: {
          decision,
          coverTutorId: row.coverTutorShortName || '',
          coverPayAmount: decision === 'cover'
            ? tutorPayAmountFor({ tutorName: row.coverTutorName, tutorPay, durationMinutes: lesson.durationMinutes, lessonKind, studentCount })
            : 0,
          absenceRowRef: row.absenceId || '',
        },
      });

      const studentId = lesson.studentMmsId || '';
      if (studentId && !pauseByStudent.has(studentId)) {
        const summary = buildPauseSummary({
          studentEmail,
          studentName: lesson.studentName,
          stripeSubscriptionId,
          pauseRows,
          currentDate: now,
        });
        if (summary.latestPause?.startDate && summary.latestPause?.endDate) {
          pauseByStudent.set(studentId, {
            studentMmsId: studentId,
            startDate: summary.latestPause.startDate,
            endDate: summary.latestPause.endDate,
            sourceRef: `pausehistory:${summary.matchedBy || ''}`,
            matchConfidence: resolvePauseMatchConfidence({ pauseMatchConfidence: summary.matchConfidence, paymentExpectation }),
          });
        } else {
          pauseByStudent.set(studentId, null);
        }
      }
    }
  }

  return { lessonInstances, pauseWindows: [...pauseByStudent.values()].filter(Boolean) };
}
