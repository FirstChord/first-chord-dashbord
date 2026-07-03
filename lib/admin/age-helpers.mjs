const DAY_MS = 24 * 60 * 60 * 1000;

// Quiet lingering-item signal: every workflow-state tab stores updated_at, so
// any card can show how long it has sat untouched without new columns or a
// timer engine. Under 2 days returns null — fresh items should not carry a
// chip at all (calm by default, per the copy guide).
export function formatAgeChip(updatedAt, now = new Date()) {
  if (!updatedAt) return null;
  const then = new Date(updatedAt);
  if (Number.isNaN(then.getTime())) return null;

  const reference = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const days = Math.floor((reference.getTime() - then.getTime()) / DAY_MS);

  if (days < 2) return null;
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}
