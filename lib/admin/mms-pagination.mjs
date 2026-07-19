// Pure pagination driver for MMS offset/limit searches.
//
// Exists because /search/attendance silently truncates at `limit` — a 35-day
// payroll window measured ~950 rows against a 1000 cap, which is the same
// "plausible-looking but short" failure shape as the EndDate-exclusivity bug
// that underpaid every window for 12 days in June–July 2026. The rule this
// module enforces: fetch every page, and if the data outgrows the safety cap,
// FAIL LOUDLY — a thrown error gets fixed the same day; a short total gets paid.

// fetchPage({ offset, limit }) → array of rows for that page.
export async function fetchAllPages(fetchPage, { pageSize = 1000, maxPages = 10, label = 'MMS search' } = {}) {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error(`${label}: pageSize must be a positive integer`);
  }

  const all = [];
  for (let page = 0; page < maxPages; page += 1) {
    const rows = await fetchPage({ offset: page * pageSize, limit: pageSize });
    if (!Array.isArray(rows)) {
      throw new Error(`${label}: page fetch returned a non-array`);
    }
    all.push(...rows);
    if (rows.length < pageSize) {
      return all;
    }
  }

  // Every page came back full — the true total may exceed what we hold.
  throw new Error(
    `${label}: exceeded ${maxPages * pageSize} rows; refusing to return a possibly-truncated result. `
    + 'Narrow the date window or raise maxPages deliberately.'
  );
}
