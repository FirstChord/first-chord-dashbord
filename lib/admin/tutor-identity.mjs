/** @fileoverview Resolves the short and full forms the school records a tutor under to one canonical name, so cross-lane views never show a tutor twice. */
import { ADMIN_TUTORS } from './tutors-data.js';

// One tutor, one name.
//
// The school records tutors under two forms and always has: assignments and the
// tutor surface use the short key ("Calum", "Dean"), while practice notes carry
// whatever the dashboard passed through, which is often the full name ("Calum
// Steel", "Dean Louden") — and both forms appear inside the same column. Any
// view that gathers across lanes therefore shows one human twice, which is what
// song teaching history did on its first day: "Calum, Calum Steel +1".
//
// `ADMIN_TUTORS` is the canonical roster, keyed by short name with `fullName`
// alongside, so this is a lookup against a closed vocabulary rather than a
// guess. An unrecognised name is returned unchanged — never approximated,
// because a wrong tutor attributed to a teaching note is worse than two names.

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

function buildIndex(roster) {
  const index = new Map();
  const ambiguous = new Set();

  const add = (name, canonical) => {
    const key = clean(name).toLowerCase();
    if (!key) return;
    const existing = index.get(key);
    // Two tutors answering to the same string is exactly when guessing does
    // damage, so the string stops resolving to either of them.
    if (existing && existing !== canonical) ambiguous.add(key);
    index.set(key, canonical);
  };

  for (const [shortName, tutor] of Object.entries(roster)) {
    add(shortName, shortName);
    add(tutor?.fullName, shortName);
  }

  for (const key of ambiguous) index.delete(key);
  return index;
}

let cachedIndex = null;

/**
 * The canonical short name for a tutor, or the input unchanged when the roster
 * does not recognise it.
 */
export function resolveTutorName(name = '', roster = ADMIN_TUTORS) {
  const raw = clean(name);
  if (!raw) return '';

  const index = roster === ADMIN_TUTORS
    ? (cachedIndex ||= buildIndex(ADMIN_TUTORS))
    : buildIndex(roster);

  return index.get(raw.toLowerCase()) || raw;
}

export function resetTutorIdentityCacheForTests() {
  cachedIndex = null;
}
