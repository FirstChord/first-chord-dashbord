import { derivePaymentValueContext } from './payment-value-helpers.mjs';
import { resolveTutor } from './cost-helpers.mjs';

// Read-only "estimate coverage" / data-health for the finance layer. Every revenue,
// cost, margin and snapshot figure inherits the gaps in its inputs (missing duration,
// no schedule context, a tutor absent from Tutor_Pay, etc.). This surfaces those gaps
// so the accruing series stays trustworthy rather than quietly wrong. Pure; no writes.

const ACTIVE = 'active';

function toNumber(value) {
  const parsed = Number.parseFloat(`${value || ''}`.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalise(value) {
  return `${value || ''}`.trim().toLowerCase();
}

const FLAG_LABELS = {
  noRevenuePrice: 'no revenue price',
  noDuration: 'no duration',
  noSchedule: 'no schedule context',
  lowConfidence: 'low confidence',
  noTutor: 'no tutor',
};

export function buildFinanceCoverage(students = [], { tutorPay = new Map() } = {}) {
  const active = students.filter((s) => `${s.lifecycleStatus || ''}`.trim() === ACTIVE);

  const flagged = [];
  const flagCounts = {
    noRevenuePrice: 0,
    noDuration: 0,
    noSchedule: 0,
    lowConfidence: 0,
    noTutor: 0,
  };
  // Tutors teaching active students but absent from Tutor_Pay default to the hourly
  // rate. For genuinely hourly tutors that's correct, so this is an informational
  // tutor-level list ("confirm none should be salaried"), NOT a per-student gap flag.
  const tutorGaps = new Map(); // normalisedTutor -> { tutor, studentCount }
  let pricedCount = 0;

  for (const student of active) {
    const value = derivePaymentValueContext(student);
    const tutor = resolveTutor(student);
    const tutorKey = normalise(tutor);
    const inPayTable = tutorKey ? tutorPay.has(tutorKey) : false;

    const flags = [];
    if (!Number.isFinite(value.baselineWeeklyValue) && !Number.isFinite(value.baselineMonthlyValue)) {
      flags.push('noRevenuePrice');
    } else {
      pricedCount += 1;
    }
    if (!Number.isFinite(toNumber(value.durationMinutes))) flags.push('noDuration');
    if (student.scheduleContext?.status !== 'found') flags.push('noSchedule');
    if (value.confidence === 'low') flags.push('lowConfidence');
    if (!tutor) flags.push('noTutor');
    if (tutor && !inPayTable) {
      // tutor-level informational list only — not a per-student flag (see note above)
      const current = tutorGaps.get(tutorKey) || { tutor, studentCount: 0 };
      current.studentCount += 1;
      tutorGaps.set(tutorKey, current);
    }

    for (const flag of flags) flagCounts[flag] += 1;

    if (flags.length) {
      flagged.push({
        mmsId: student.mmsId || '',
        name: student.fullName || '',
        tutor,
        lessonKind: value.lessonKind,
        confidence: value.confidence,
        flags,
        flagLabels: flags.map((f) => FLAG_LABELS[f] || f),
      });
    }
  }

  const activeCount = active.length;
  const coveragePct = activeCount > 0 ? Math.round((pricedCount / activeCount) * 1000) / 10 : null;

  return {
    activeCount,
    pricedCount,
    coveragePct,
    flagCounts,
    flagged: flagged.sort((a, b) => b.flags.length - a.flags.length || a.name.localeCompare(b.name)),
    // Tutors who teach active students but aren't in Tutor_Pay → silently defaulted to
    // the hourly rate. A salaried tutor surfacing here (e.g. a name variant) is mispriced.
    tutorsNotInPayTable: [...tutorGaps.values()].sort((a, b) => b.studentCount - a.studentCount),
    isClean: flagged.length === 0,
  };
}

export { FLAG_LABELS };
