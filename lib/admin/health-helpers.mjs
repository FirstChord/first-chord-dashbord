function parseIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildFlagsFreshnessSummary(flags = []) {
  const generatedDates = [...new Set(flags.map((flag) => `${flag.generated_date || ''}`.trim()).filter(Boolean))];
  const parsedDates = generatedDates.map(parseIsoDate).filter(Boolean).sort((a, b) => b.getTime() - a.getTime());
  const latestGeneratedAt = parsedDates[0] || null;

  if (!latestGeneratedAt) {
    return {
      latestGeneratedAt: null,
      distinctGeneratedDates: generatedDates,
      status: 'Unknown',
      statusDetail: 'No generated_date found on Review_Flags.',
      ageDays: null,
    };
  }

  const ageMs = Date.now() - latestGeneratedAt.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  if (ageDays <= 1) {
    return {
      latestGeneratedAt,
      distinctGeneratedDates: generatedDates,
      status: 'Fresh',
      statusDetail: 'Review flags look current.',
      ageDays,
    };
  }

  if (ageDays <= 7) {
    return {
      latestGeneratedAt,
      distinctGeneratedDates: generatedDates,
      status: 'Aging',
      statusDetail: 'Review flags are usable but no longer very fresh.',
      ageDays,
    };
  }

  return {
    latestGeneratedAt,
    distinctGeneratedDates: generatedDates,
    status: 'Stale',
    statusDetail: 'Review flags should be regenerated before heavy triage.',
    ageDays,
  };
}

export function formatDateTime(value) {
  if (!value) return '—';
  const parsed = value instanceof Date ? value : parseIsoDate(value);
  if (!parsed) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}
