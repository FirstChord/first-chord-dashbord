// Simple growth/churn logging: count students onboarded vs left, by month.
// Pure. Onboarded dates come from Waiting_List_State (status 'onboarded'); left dates
// from Students_Archive (archived_at). Both only capture movements made THROUGH the
// dashboard flows — a student added/removed outside them won't be counted.

function monthKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseMonthDate(value) {
  const raw = `${value || ''}`.trim();
  if (!raw) return null;
  const d = new Date(raw.length <= 10 ? `${raw}T00:00:00Z` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildRosterMovement({ onboardedDates = [], leftDates = [], now = new Date(), months = 6 } = {}) {
  const buckets = new Map();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(monthKey(d), { month: monthKey(d), onboarded: 0, left: 0, net: 0 });
  }

  const tally = (dates, field) => {
    for (const value of dates) {
      const d = parseMonthDate(value);
      if (!d) continue;
      const key = monthKey(d);
      if (buckets.has(key)) buckets.get(key)[field] += 1;
    }
  };
  tally(onboardedDates, 'onboarded');
  tally(leftDates, 'left');

  const rows = [...buckets.values()];
  for (const r of rows) r.net = r.onboarded - r.left;

  const totals = rows.reduce(
    (acc, r) => ({ onboarded: acc.onboarded + r.onboarded, left: acc.left + r.left, net: acc.net + r.net }),
    { onboarded: 0, left: 0, net: 0 },
  );

  return { months: rows, totals };
}

// Adapter helpers: pull the dated movement signals from the two source tabs.
export function onboardedDatesFromWaitingState(waitingStateRows = []) {
  return waitingStateRows
    .filter((row) => `${row.status || ''}`.trim() === 'onboarded')
    .map((row) => row.updatedAt || row.dateStarted || '')
    .filter(Boolean);
}

export function leftDatesFromArchive(archiveRows = []) {
  return archiveRows.map((row) => row.archived_at || row.archivedAt || '').filter(Boolean);
}
