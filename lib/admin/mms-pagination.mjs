/** @fileoverview Pure pagination driver for MMS offset/limit searches that fails loudly rather than returning a silently truncated page set. */
// Pure pagination driver for MMS offset/limit searches.
//
// Exists because /search/attendance silently truncates at `limit` — a 35-day
// payroll window measured ~950 rows against a 1000 cap, which is the same
// "plausible-looking but short" failure shape as the EndDate-exclusivity bug
// that underpaid every window for 12 days in June–July 2026. The rule this
// module enforces: fetch every row, and if we cannot prove we did, FAIL LOUDLY —
// a thrown error gets fixed the same day; a short total gets paid.
//
// How completeness is established, best first:
//
//   1. `TotalItemCount`. MMS returns its own count of matching records on every
//      /search response (verified 2026-08-01 on /search/attendance). A fetchPage
//      that hands back `{ rows, total }` gets the strong contract: we stop when
//      we hold exactly `total` rows and throw if we ever hold a different
//      number. Completeness becomes a fact we check, not a shape we infer.
//
//   2. The short-page heuristic ("a page smaller than asked is the last one"),
//      used only when no total is available. It is weaker than it looks: it
//      assumes the endpoint honours the `limit` we send. Ask for 5000 against a
//      server that caps at 1000 and every page comes back "short", so the walk
//      stops at the first page and truncates in silence.
//
// That asymmetry is the point. Under the heuristic alone, raising the page size
// is a dangerous optimisation. Under `TotalItemCount` it is safe — a cap we did
// not know about becomes a loud mismatch instead of a quiet short payroll — so
// the page size can be sized for latency rather than kept small out of fear.

// fetchPage({ offset, limit }) → rows[]  (heuristic mode)
//                              → { rows, total }  (verified mode)
export async function fetchAllPages(fetchPage, { pageSize = 1000, maxPages = 10, label = 'MMS search' } = {}) {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error(`${label}: pageSize must be a positive integer`);
  }

  const all = [];
  let reportedTotal = null;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchPage({ offset: page * pageSize, limit: pageSize });
    const rows = Array.isArray(result) ? result : result?.rows;
    if (!Array.isArray(rows)) {
      throw new Error(`${label}: page fetch returned a non-array`);
    }
    const total = Array.isArray(result) ? null : result?.total;
    // Latch the count once seen: a later page omitting it must not downgrade us
    // back to guessing.
    if (Number.isInteger(total) && total >= 0) {
      if (reportedTotal !== null && total !== reportedTotal) {
        throw new Error(
          `${label}: endpoint total changed from ${reportedTotal} to ${total} while paging; `
          + 'refusing to combine an unstable snapshot.'
        );
      }
      reportedTotal = total;
    }

    all.push(...rows);

    if (reportedTotal === null) {
      if (rows.length < pageSize) return all;
      continue;
    }

    if (all.length >= reportedTotal) {
      if (all.length !== reportedTotal) {
        throw new Error(
          `${label}: endpoint reported ${reportedTotal} rows but returned ${all.length}; `
          + 'refusing to return a result we cannot account for.'
        );
      }
      return all;
    }

    // Still short of the reported total with nothing left coming: the endpoint
    // is contradicting itself. Never quietly accept the smaller number.
    if (!rows.length) {
      throw new Error(
        `${label}: endpoint reported ${reportedTotal} rows but ran out after ${all.length}; `
        + 'refusing to return a possibly-truncated result.'
      );
    }
  }

  throw new Error(
    reportedTotal === null
      ? `${label}: exceeded ${maxPages * pageSize} rows; refusing to return a possibly-truncated result. `
        + 'Narrow the date window or raise maxPages deliberately.'
      : `${label}: ${reportedTotal} rows needs more than ${maxPages} pages of ${pageSize}; `
        + 'raise maxPages or pageSize deliberately.'
  );
}
