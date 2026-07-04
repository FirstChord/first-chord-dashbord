// Single version marker for the pricing/cost assumptions baked into the finance
// estimate. It is written into every Finance_Snapshot row's `notes` column so the
// append-only series stays interpretable: when an assumption changes, the series
// shows a step-change *with* its cause, instead of silently changing basis.
//
// BUMP THIS STRING whenever any of these change:
//   - one-to-one price table        lib/admin/payment-value-helpers.mjs
//   - group / orchestra prices      lib/admin/payment-value-helpers.mjs
//   - default hourly rate / uplift  lib/admin/cost-helpers.mjs
//   - VAT flat rate                 lib/admin/finance-helpers.mjs
// Format: <YYYY-MM>.<n> followed by the live numbers, so a snapshot row is
// self-describing without a trip back through git history.
export const PRICE_ASSUMPTIONS_VERSION =
  '2026-07.1 | 1:1 £25/£33/£41.50 wk (30/45/60m) | group £20 wk | orchestra £42.50 mo | default £24/hr +£2 group-45 | VAT flat 11%';
