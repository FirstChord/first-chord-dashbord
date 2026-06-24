import { VAT_FLAT_RATE } from './finance-helpers.mjs';

// "Capacity = money": attach £ to the waiting list. Splits latent demand into what you
// can book now (a free tutor slot exists) vs what's blocked on tutor-hours (taught but
// full) or a missing tutor (not taught) — the recruiting business case. Freshness-aware:
// the headline £ is built only on recent entries so a list with stale leads isn't a
// vanity number. Pure, read-only; values a waiting student as a standard 30-min 1:1.

const WEEKS_PER_MONTH = 52 / 12;
const ASSUMED_WEEKLY_PRICE = 25; // a standard 30-min 1:1 — the modal lesson
const ASSUMED_TUTOR_WEEKLY_COST = 12; // hourly tutor, 30 min @ £24/hr
const FRESH_DAYS = 90;

function round(n) {
  return Math.round(n * 100) / 100;
}

function perStudentValue() {
  const grossMonthly = ASSUMED_WEEKLY_PRICE * WEEKS_PER_MONTH;
  const netMonthly = grossMonthly * (1 - VAT_FLAT_RATE);
  const tutorMonthly = ASSUMED_TUTOR_WEEKLY_COST * WEEKS_PER_MONTH;
  return {
    grossMonthly: round(grossMonthly),
    netMonthly: round(netMonthly),
    contributionMonthly: round(netMonthly - tutorMonthly),
  };
}

function ageInDays(student, now) {
  if (Number.isFinite(student.ageInDays)) return student.ageInDays;
  const started = `${student.dateStarted || ''}`.trim();
  if (!started) return null;
  const t = new Date(started).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000));
}

function classify(student) {
  if (student.capacityMatchStatus === 'instrument_unknown') return 'unknown';
  if ((student.capacityMatches?.length || 0) > 0 || student.capacityMatchStatus === 'matched') return 'bookableNow';
  // no_match: taught-but-full (need hours) vs not-taught (need a tutor)
  const reasons = (student.uncoveredInstruments || []).map((u) => u.reason);
  return reasons.includes('no_free_slots') ? 'needHours' : 'needTutor';
}

export function buildCapacityValue(matchedWaitingStudents = [], { now = new Date(), freshDays = FRESH_DAYS } = {}) {
  const per = perStudentValue();
  const emptyBucket = () => ({ count: 0, freshCount: 0 });
  const buckets = {
    bookableNow: emptyBucket(),
    needHours: emptyBucket(),
    needTutor: emptyBucket(),
    unknown: emptyBucket(),
  };
  let freshTotal = 0;
  let staleCount = 0;
  let datedCount = 0;
  const instrumentDemand = new Map(); // key -> { instrument, reason, freshCount }

  for (const student of matchedWaitingStudents) {
    const age = ageInDays(student, now);
    const fresh = age !== null && age <= freshDays;
    if (age !== null) datedCount += 1;
    if (age !== null && age > freshDays) staleCount += 1;
    if (fresh) freshTotal += 1;

    const bucket = buckets[classify(student)];
    bucket.count += 1;
    if (fresh) bucket.freshCount += 1;

    // Recruiting targets: which instruments have unmet demand (fresh), and why.
    for (const uncovered of student.uncoveredInstruments || []) {
      const key = `${uncovered.instrument}|${uncovered.reason}`;
      const current = instrumentDemand.get(key) || { instrument: uncovered.instrument, reason: uncovered.reason, freshCount: 0 };
      if (fresh) current.freshCount += 1;
      instrumentDemand.set(key, current);
    }
  }

  const money = (bucket) => ({
    count: bucket.count,
    freshCount: bucket.freshCount,
    revenueMonthly: round(bucket.freshCount * per.netMonthly),
    contributionMonthly: round(bucket.freshCount * per.contributionMonthly),
  });

  const bookableNow = money(buckets.bookableNow);
  const needHours = money(buckets.needHours);
  const needTutor = money(buckets.needTutor);
  const blockedFresh = buckets.needHours.freshCount + buckets.needTutor.freshCount;
  const blocked = {
    count: buckets.needHours.count + buckets.needTutor.count,
    freshCount: blockedFresh,
    revenueMonthly: round(blockedFresh * per.netMonthly),
    contributionMonthly: round(blockedFresh * per.contributionMonthly),
  };

  return {
    perStudent: per,
    freshDays,
    waitingTotal: matchedWaitingStudents.length,
    freshTotal,
    staleCount,
    datedCount,
    bookableNow,
    blocked,
    needHours,
    needTutor,
    unknownCount: buckets.unknown.count,
    // Recruiting targets, biggest fresh demand first; 'not_taught' = need a tutor for it,
    // 'no_free_slots' = taught but full (more hours from existing tutors).
    recruitingTargets: [...instrumentDemand.values()]
      .filter((t) => t.freshCount > 0)
      .map((t) => ({ ...t, contributionMonthly: round(t.freshCount * per.contributionMonthly) }))
      .sort((a, b) => b.freshCount - a.freshCount),
  };
}
