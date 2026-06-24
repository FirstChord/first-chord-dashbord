// Pure what-if / break-even modelling on top of the finance run-rate. Lets you ask
// "what if N students take a break over summer?" or "what if I raise prices X%?" and
// see the projected margin + how much buffer you have before break-even.
//
// Key economics: revenue and *variable* tutor pay both scale with active student count
// (paused students bill nothing and cost nothing — no pay when paused). Salaries and
// fixed overhead do not move. So the per-student "contribution" = net revenue − variable
// pay, and break-even is where that contribution just covers the fixed costs.

function round(n) {
  return Math.round(n * 100) / 100;
}

export function buildFinanceScenario(totals = {}, activeCount = 0, { studentsDelta = 0, pricePctDelta = 0 } = {}) {
  const netRevenueMonthly = Number.isFinite(totals.netRevenueMonthly) ? totals.netRevenueMonthly : 0;
  const variableMonthly = Number.isFinite(totals.variableMonthly) ? totals.variableMonthly : 0;
  const salariedMonthly = Number.isFinite(totals.salariedMonthly) ? totals.salariedMonthly : 0;
  const fixedMonthly = Number.isFinite(totals.fixedMonthly) ? totals.fixedMonthly : 0;

  const fixedCosts = salariedMonthly + fixedMonthly; // independent of student volume
  const contributionTotal = netRevenueMonthly - variableMonthly; // scales with volume
  const avgContributionPerStudent = activeCount > 0 ? round(contributionTotal / activeCount) : 0;
  const baseMargin = round(contributionTotal - fixedCosts);

  // Break-even at current prices: contributionTotal × (x / active) = fixedCosts
  const breakEvenActiveCount =
    contributionTotal > 0 ? Math.ceil((activeCount * fixedCosts) / contributionTotal) : null;
  const bufferStudents = breakEvenActiveCount !== null ? activeCount - breakEvenActiveCount : null;
  const bufferPct =
    breakEvenActiveCount !== null && activeCount > 0 ? round((bufferStudents / activeCount) * 100) : null;

  // Projection: scale volume, apply a blanket price change to revenue (variable pay is
  // per-lesson so it is unaffected by price; VAT % is constant so net scales with price).
  const projectedActive = Math.max(0, activeCount + studentsDelta);
  const scale = activeCount > 0 ? projectedActive / activeCount : 0;
  const priceFactor = 1 + pricePctDelta;

  const projectedNetRevenue = round(netRevenueMonthly * priceFactor * scale);
  const projectedVariable = round(variableMonthly * scale);
  const projectedMargin = round(projectedNetRevenue - projectedVariable - fixedCosts);
  const projectedMarginPct = projectedNetRevenue > 0 ? round((projectedMargin / projectedNetRevenue) * 100) : null;

  return {
    base: { activeCount, netRevenueMonthly, variableMonthly, fixedCosts, marginMonthly: baseMargin },
    avgContributionPerStudent,
    breakEvenActiveCount,
    bufferStudents,
    bufferPct,
    scenario: {
      studentsDelta,
      pricePctDelta,
      activeCount: projectedActive,
      netRevenueMonthly: projectedNetRevenue,
      variableMonthly: projectedVariable,
      marginMonthly: projectedMargin,
      marginPct: projectedMarginPct,
      aboveBreakEven: projectedMargin >= 0,
      marginDelta: round(projectedMargin - baseMargin),
    },
    isChanged: studentsDelta !== 0 || pricePctDelta !== 0,
  };
}
