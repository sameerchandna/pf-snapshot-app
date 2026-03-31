import type { SnapshotState } from '../types';
import type { ProjectionSeriesPoint, ProjectionSummary, ProjectionEngineInputs } from './projectionEngine';
import { initLoan, stepLoanMonth } from './loanEngine';
import { selectPension } from './selectors';
import { ATTRIBUTION_TOLERANCE, SYSTEM_CASH_ID } from '../constants';
import { isSystemCash } from '../domain/systemAssets';

export type A3Attribution = {
  startingNetWorth: number;
  endingNetWorth: number;

  cashflow: {
    grossIncome: number;
    pensionContributions: number; // pre-tax pension contributions
    taxes: number;
    livingExpenses: number; // base living expenses + loan interest
    netSurplus: number;
    postTaxContributions: number; // post-tax asset contributions (ISA, etc.)
    debtRepayment: number; // loan principal only (cash out)
  };

  debt: {
    interestPaid: number; // loan interest only (cash out)
    principalRepaid: number; // loan principal only (cash out)
    remainingDebt: number; // total ending liabilities (balance)
  };

  assets: {
    startingValue: number;
    contributions: number; // total contributions (pension + postTax)
    growth: number; // returns only (residual: endingAssets - startingAssets - contributions)
    endingValue: number;
  };

  reconciliation: {
    lhs: number; // endingNetWorth
    rhs: number; // endAssets - endLiabilities (canonical)
    delta: number; // lhs - rhs
  };

  inactiveCounts: {
    assets: number;
    liabilities: number;
    expenses: number;
  };
};

function sumMonthly(items: ReadonlyArray<{ monthlyAmount: number }>): number {
  return items.reduce((sum, it) => sum + (Number.isFinite(it.monthlyAmount) ? it.monthlyAmount : 0), 0);
}

function sumAmountMonthly(items: ReadonlyArray<{ amountMonthly: number }>): number {
  return items.reduce((sum, it) => sum + (Number.isFinite(it.amountMonthly) ? it.amountMonthly : 0), 0);
}

function sumBalances(items: ReadonlyArray<{ balance: number }>): number {
  return items.reduce((sum, it) => sum + (Number.isFinite(it.balance) ? it.balance : 0), 0);
}

function deriveMonthlyTaxes(snapshot: SnapshotState): number {
  // Current app model: “taxes” are derived as the residual between gross and net (after pension).
  const gross = sumMonthly(snapshot.grossIncomeItems);
  const pension = selectPension(snapshot); // Now reads from assetContributions with contributionType === 'preTax'
  const net = sumMonthly(snapshot.netIncomeItems);
  return Math.max(0, gross - pension - net);
}

function inflationMonthlyFactor(inflationPct: number): number {
  const r = inflationPct / 100;
  if (!Number.isFinite(r)) return 1;
  if (r <= -0.99) return 1;
  return Math.pow(1 + r, 1 / 12);
}

function pvSumConstantMonthly(amount: number, months: number, inflationPct: number): number {
  const n = Number.isFinite(months) ? Math.max(0, Math.floor(months)) : 0;
  if (n <= 0) return 0;
  const mInfl = inflationMonthlyFactor(inflationPct);
  if (mInfl === 1) return amount * n;

  // PV = Σ amount / (mInfl^i), i=1..n
  let pv = 0;
  let df = 1 / mInfl; // i=1
  for (let i = 1; i <= n; i++) {
    pv += amount * df;
    df = df / mInfl;
  }
  return pv;
}

type LoanLike = {
  balance: number;
  annualInterestRatePct: number;
  remainingTermYears: number;
};

function isLoan(liab: SnapshotState['liabilities'][number]): liab is SnapshotState['liabilities'][number] & {
  kind: 'loan';
  annualInterestRatePct: number;
  remainingTermYears: number;
} {
  return (
    liab.kind === 'loan' &&
    typeof liab.annualInterestRatePct === 'number' &&
    Number.isFinite(liab.annualInterestRatePct) &&
    typeof liab.remainingTermYears === 'number' &&
    Number.isFinite(liab.remainingTermYears) &&
    liab.remainingTermYears >= 1
  );
}

function pvLoanTotals(loans: LoanLike[], months: number, inflationPct: number): {
  interestPaid: number;
  principalRepaid: number;
  remainingBalance: number;
  // Nominal diagnostics (no inflation discounting)
  startingBalanceNominal: number;
  interestPaidNominal: number;
  principalRepaidNominal: number;
  remainingBalanceNominal: number;
} {
  const n = Number.isFinite(months) ? Math.max(0, Math.floor(months)) : 0;
  const startingBalanceNominal = loans.reduce((sum, l) => sum + (Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0), 0);
  if (n <= 0 || loans.length === 0) {
    return {
      interestPaid: 0,
      principalRepaid: 0,
      remainingBalance: startingBalanceNominal,
      startingBalanceNominal,
      interestPaidNominal: 0,
      principalRepaidNominal: 0,
      remainingBalanceNominal: startingBalanceNominal,
    };
  }

  const mInfl = inflationMonthlyFactor(inflationPct);
  const df1 = mInfl === 1 ? 1 : 1 / mInfl;

  let totalInterestPV = 0;
  let totalPrincipalPV = 0;
  let totalInterestNominal = 0;
  let totalPrincipalNominal = 0;
  let remainingBalanceNominal = 0;

  for (const l of loans) {
    const init = initLoan({
      balance: l.balance,
      annualInterestRatePct: l.annualInterestRatePct,
      remainingTermYears: l.remainingTermYears,
    });
    let balance = Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0;
    const runMonths = Math.min(n, init.remainingMonths);

    let df = df1;
    for (let i = 1; i <= runMonths; i++) {
      if (balance <= 0) break;
      const m = stepLoanMonth({ balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate });
      totalInterestNominal += m.interest;
      totalPrincipalNominal += m.principal;
      totalInterestPV += m.interest * df;
      totalPrincipalPV += m.principal * df;
      balance = m.newBalance;
      if (mInfl !== 1) df = df / mInfl;
    }

    remainingBalanceNominal += balance;
  }

  // Remaining balance: express in today’s money at end of horizon (same basis as projection engine outputs).
  const endDeflator = Math.pow(mInfl, n);
  const safeDeflator = Number.isFinite(endDeflator) && endDeflator > 0 ? endDeflator : 1;
  const remainingBalancePV = remainingBalanceNominal / safeDeflator;

  return {
    interestPaid: totalInterestPV,
    principalRepaid: totalPrincipalPV,
    remainingBalance: remainingBalancePV,
    startingBalanceNominal,
    interestPaidNominal: totalInterestNominal,
    principalRepaidNominal: totalPrincipalNominal,
    remainingBalanceNominal,
  };
}

/**
 * Computes A3 attribution from projection data.
 * 
 * CRITICAL INVARIANTS:
 * - Always returns a NEW object (no mutation, no reuse)
 * - A3 must NEVER be scenario-aware
 * - A3 treats projectionSeries and projectionSummary as ground truth
 * - Do not reuse or mutate attribution objects between baseline/scenario calls
 * - projectionInputs MUST be the exact object used to compute projectionSeries and projectionSummary
 * 
 * @param snapshot - Baseline snapshot state (never scenario-modified)
 * @param projectionSeries - Projection series (baselineSeries for baseline, scenarioSeries for scenario)
 * @param projectionSummary - Projection summary (baselineSummary for baseline, scenarioSummary for scenario)
 * @param projectionInputs - REQUIRED projection inputs (must be the exact object used to compute series/summary)
 */
export function computeA3Attribution({
  snapshot,
  projectionSeries,
  projectionSummary,
  projectionInputs,
}: {
  snapshot: SnapshotState;
  projectionSeries: ProjectionSeriesPoint[];
  projectionSummary: ProjectionSummary;
  projectionInputs: ProjectionEngineInputs;
}): A3Attribution {
  // CRITICAL: Validate that projectionInputs is provided (required, no fallback)
  if (!projectionInputs) {
    throw new Error('[computeA3Attribution] projectionInputs is required and must be the exact object used to compute projectionSeries and projectionSummary');
  }

  // CRITICAL: Validate that projectionInputs matches the series/summary horizon
  // This ensures projectionInputs is the exact object used to compute the series/summary
  if (projectionSeries.length > 0) {
    const firstPoint = projectionSeries[0];
    const lastPoint = projectionSeries[projectionSeries.length - 1];
    
    // Validate horizon alignment: projectionInputs must match series age range
    const inputsCurrentAge = Number(projectionInputs.currentAge);
    const inputsEndAge = Number(projectionInputs.endAge);
    const seriesStartAge = firstPoint.age;
    const seriesEndAge = lastPoint.age;
    
    // Allow small tolerance for floating point comparison
    const AGE_TOLERANCE = 0.01;
    
    if (!Number.isFinite(inputsCurrentAge) || !Number.isFinite(inputsEndAge)) {
      throw new Error(`[computeA3Attribution] projectionInputs has invalid horizon: currentAge=${inputsCurrentAge}, endAge=${inputsEndAge}. projectionInputs must be the exact object used to compute projectionSeries and projectionSummary.`);
    }
    
    if (Math.abs(inputsCurrentAge - seriesStartAge) > AGE_TOLERANCE) {
      throw new Error(`[computeA3Attribution] projectionInputs.currentAge (${inputsCurrentAge}) does not match projectionSeries start age (${seriesStartAge}). projectionInputs must be the exact object used to compute projectionSeries and projectionSummary.`);
    }
    
    if (Math.abs(inputsEndAge - seriesEndAge) > AGE_TOLERANCE) {
      throw new Error(`[computeA3Attribution] projectionInputs.endAge (${inputsEndAge}) does not match projectionSeries end age (${seriesEndAge}). projectionInputs must be the exact object used to compute projectionSeries and projectionSummary.`);
    }
  }
  
  // CRITICAL: Validate that projectionInputs.inflationRatePct matches snapshot (consistency check)
  const inputsInflationPct = Number(projectionInputs.inflationRatePct);
  const snapshotInflationPct = Number(snapshot.projection.inflationPct);
  if (!Number.isFinite(inputsInflationPct) || !Number.isFinite(snapshotInflationPct)) {
    throw new Error(`[computeA3Attribution] Invalid inflation rates: projectionInputs.inflationRatePct=${inputsInflationPct}, snapshot.projection.inflationPct=${snapshotInflationPct}`);
  }
  
  // Note: We don't enforce exact match on inflationPct because scenarios may modify it
  // But we validate that both are finite numbers
  // Filter to active items only at the boundary
  const activeAssets = snapshot.assets.filter(a => a.isActive !== false);
  const activeLiabilities = snapshot.liabilities.filter(l => l.isActive !== false);
  const activeExpenses = snapshot.expenses.filter(e => e.isActive !== false);
  
  // Count inactive items for UI footer
  const inactiveCounts = {
    assets: snapshot.assets.filter(a => a.isActive === false).length,
    liabilities: snapshot.liabilities.filter(l => l.isActive === false).length,
    expenses: snapshot.expenses.filter(e => e.isActive === false).length,
  };

  const horizonMonthsRaw = (snapshot.projection.endAge - snapshot.projection.currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;

  const startingAssets = sumBalances(activeAssets);
  const startingLiabilities = sumBalances(activeLiabilities);
  const startingNetWorth = startingAssets - startingLiabilities;

  const endingNetWorth = projectionSummary.endNetWorth;

  // Cashflow (monthly snapshot inputs; aggregated over horizon as PV in today's money)
  const grossIncomeMonthly = sumMonthly(snapshot.grossIncomeItems);
  const taxesMonthly = deriveMonthlyTaxes(snapshot);
  // Exclude loan interest and loan principal from base living expenses
  // Both are included in scheduledMortgagePayment (from projection engine outputs)
  // Use active expenses only
  const baseLivingExpensesMonthly = activeExpenses
    .filter(it => !it.id.startsWith('loan-interest:') && !it.id.startsWith('loan-principal:'))
    .reduce((sum, it) => sum + (Number.isFinite(it.monthlyAmount) ? it.monthlyAmount : 0), 0);
  
  // Separate preTax (pension) and postTax contributions
  // Only count contributions to active assets
  const activeAssetIds = new Set(activeAssets.map(a => a.id));
  
  // Build map from snapshot to identify pension (preTax) assets
  // This is used to classify contributions from projectionInputs when provided
  const pensionAssetIds = new Set(
    snapshot.assetContributions
      .filter(c => c.contributionType === 'preTax' && activeAssetIds.has(c.assetId))
      .map(c => c.assetId)
  );
  
  let pensionContribMonthly: number;
  let postTaxContribMonthly: number;
  
  if (projectionInputs) {
    // Compute contributions from projection inputs (scenario case)
    // Use snapshot metadata to classify pension vs postTax
    pensionContribMonthly = projectionInputs.assetContributionsMonthly
      .filter(c => pensionAssetIds.has(c.assetId))
      .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0), 0);
    postTaxContribMonthly = projectionInputs.assetContributionsMonthly
      .filter(c => !pensionAssetIds.has(c.assetId))
      .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0), 0);
  } else {
    // Compute contributions from snapshot (baseline case)
    pensionContribMonthly = snapshot.assetContributions
      .filter(c => c.contributionType === 'preTax' && activeAssetIds.has(c.assetId))
      .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0), 0);
    postTaxContribMonthly = snapshot.assetContributions
      .filter(c => c.contributionType !== 'preTax' && activeAssetIds.has(c.assetId))
      .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0), 0);
  }

  const inflationPct = snapshot.projection.inflationPct;

  const grossIncome = pvSumConstantMonthly(grossIncomeMonthly, horizonMonths, inflationPct);
  const pensionContributions = pvSumConstantMonthly(pensionContribMonthly, horizonMonths, inflationPct);
  const taxes = pvSumConstantMonthly(taxesMonthly, horizonMonths, inflationPct);
  const baseLivingExpenses = pvSumConstantMonthly(baseLivingExpensesMonthly, horizonMonths, inflationPct);
  const postTaxContributions = pvSumConstantMonthly(postTaxContribMonthly, horizonMonths, inflationPct);

  // Loans only (per spec) - use active liabilities only
  const loans: LoanLike[] = activeLiabilities
    .filter(isLoan)
    .map(l => ({
      balance: l.balance,
      annualInterestRatePct: l.annualInterestRatePct ?? 0,
      remainingTermYears: l.remainingTermYears ?? 0,
    }));

  // Mortgage payments are treated as expenses; overpayments are discretionary liability reductions.
  // Use engine outputs (single source of truth) - never recompute loan maths in attribution.
  const scheduledMortgagePayment = projectionSummary.totalScheduledMortgagePayment; // Full payment (interest + scheduled principal) - expense
  const mortgageOverpayments = projectionSummary.totalMortgageOverpayments; // Explicit overpayments only - liability reduction

  // Total living expenses include full scheduled mortgage payment (interest + scheduled principal).
  // The full scheduled payment is treated as an expense.
  const livingExpenses = baseLivingExpenses + scheduledMortgagePayment;

  // Detect if cashflow is actually modeled (projection mode vs snapshot mode)
  // Projection mode: no income/expenses modeled, only asset growth and contributions
  // Snapshot mode: income/expenses are modeled, cashflow constraints apply
  const isCashflowModeled = Math.abs(grossIncome) > ATTRIBUTION_TOLERANCE 
    || Math.abs(taxes) > ATTRIBUTION_TOLERANCE 
    || Math.abs(livingExpenses) > ATTRIBUTION_TOLERANCE;

  // For debt attribution, we need interest and principal totals for display
  // Compute these from loan amortization (for informational purposes only)
  const loanTotals = pvLoanTotals(loans, horizonMonths, inflationPct);
  const interestPaid = loanTotals.interestPaid;
  const principalRepaid = loanTotals.principalRepaid; // Total principal (scheduled + overpayments)
  
  // debtRepayment refers ONLY to overpayments (scheduled principal is in expenses).
  const debtRepayment = mortgageOverpayments;
  
  // Net surplus logic depends on whether cashflow is modeled
  let netSurplus: number;
  
  if (isCashflowModeled) {
    // Snapshot mode: cashflow is modeled, enforce cashflow constraints
    // Net surplus is calculated after pension (pre-tax) and taxes
    // Formula: grossIncome - pensionContributions - taxes - livingExpenses
    netSurplus = grossIncome - pensionContributions - taxes - livingExpenses;
  } else {
    // Projection-only mode: no cashflow modeled, explain net-worth evolution only
    // Scenario allocations are already validated at Snapshot/apply-time
    // A3 must explain net-worth evolution, not re-evaluate affordability
    
    // Derive netSurplus backwards from allocations (for display consistency)
    // netSurplus = contributions + principalRepaid (no cash build in projection mode)
    netSurplus = postTaxContributions + principalRepaid;
  }
  
  // monthlySurplus computed as cumulative residual (display-only, NOT part of asset roll-forward):
  // FLOW semantics: monthlySurplus = netSurplus - postTaxContributions - debtOverpayments
  // This matches user intuition: money left after all allocations (FLOW concept)
  // Computed inline, not stored in attribution type
  // Preserve sign for diagnostic display (negative surplus indicates over-allocation)
  const allocationsTotal = postTaxContributions + mortgageOverpayments;
  const monthlySurplus = netSurplus - allocationsTotal;

  // Asset attribution: assets = starting + contributions + growth
  // monthlySurplus is NOT part of asset roll-forward (display-only residual in cashflow table)
  const assetsStartingValue = startingAssets;
  const assetsEndingValue = projectionSummary.endAssets;
  // Total contributions for asset growth includes:
  //   - Pension (preTax) contributions
  //   - PostTax contributions (from snapshot, projectionSeries already reflects scenario changes)
  // Do NOT include monthlySurplus or cash accumulation in asset contributions
  const assetsContributions = pensionContributions + postTaxContributions;
  // Growth is residual: endingAssets - startingAssets - explicitContributions
  const assetsGrowth = assetsEndingValue - assetsStartingValue - assetsContributions;

  const out: A3Attribution = {
    startingNetWorth,
    endingNetWorth,
    cashflow: {
      grossIncome,
      pensionContributions,
      taxes,
      livingExpenses,
      netSurplus,
      postTaxContributions,
      debtRepayment,
    },
    debt: {
      interestPaid,
      principalRepaid: loanTotals.principalRepaid,
      remainingDebt: projectionSummary.endLiabilities,
    },
    assets: {
      startingValue: assetsStartingValue,
      contributions: assetsContributions,
      growth: assetsGrowth,
      endingValue: assetsEndingValue,
    },
    reconciliation: {
      lhs: endingNetWorth,
      rhs: 0,
      delta: 0,
    },
    inactiveCounts,
  };

  // Canonical reconciliation (CRITICAL): Ending Net Worth must match Ending Assets − Ending Liabilities.
  const rhs = projectionSummary.endAssets - projectionSummary.endLiabilities;
  const delta = projectionSummary.endNetWorth - rhs;
  out.reconciliation.rhs = rhs;
  out.reconciliation.delta = delta;

  // Phase 3.2: __DEV__-only enforcement for primary reconciliation
  // Fail fast in development if reconciliation is outside tolerance
  // Production behavior unchanged: still log and return attribution object
  if (__DEV__) {
    if (Math.abs(delta) > ATTRIBUTION_TOLERANCE) {
      throw new Error(
        `[A3 Attribution] Balance-sheet reconciliation failed: ` +
        `endNetWorth (${projectionSummary.endNetWorth}) != endAssets (${projectionSummary.endAssets}) - endLiabilities (${projectionSummary.endLiabilities}). ` +
        `Delta: ${delta}, tolerance: £${ATTRIBUTION_TOLERANCE}. ` +
        `This indicates a calculation error in projection or attribution logic.`
      );
    }
  }

  // ---- Diagnostics (log-only)
  const logIfBad = (label: string, d: number, extra?: Record<string, unknown>) => {
    if (Math.abs(d) <= ATTRIBUTION_TOLERANCE) return;
    console.error(`[A3 Attribution] ${label} delta is out of tolerance (|delta| > £${ATTRIBUTION_TOLERANCE}): ${d}`, extra);
  };

  // Production: Log reconciliation failures (diagnostic only, no enforcement)
  logIfBad('Balance-sheet reconciliation (endNetWorth vs endAssets - endLiabilities)', delta, {
    endAssets: projectionSummary.endAssets,
    endLiabilities: projectionSummary.endLiabilities,
    endNetWorth: projectionSummary.endNetWorth,
    seriesPoints: projectionSeries.length,
  });

  // 1) Asset roll-forward
  // Formula: endingAssets = startingAssets + contributions + growth
  // Growth is residual, so this should reconcile exactly
  const assetRollDelta =
    out.assets.startingValue + out.assets.contributions + out.assets.growth - out.assets.endingValue;
  logIfBad('Asset roll-forward (start + contrib + growth vs end)', assetRollDelta);

  // 2) Loan roll-forward (nominal, diagnostics only)
  const loanRollDelta = loanTotals.startingBalanceNominal - loanTotals.principalRepaidNominal - loanTotals.remainingBalanceNominal;
  logIfBad('Loan roll-forward (startingLoanBalance - principalRepaid vs remainingLoanBalance)', loanRollDelta, {
    startingLoanBalance: loanTotals.startingBalanceNominal,
    principalRepaid: loanTotals.principalRepaidNominal,
    remainingLoanBalance: loanTotals.remainingBalanceNominal,
  });

  // 3) Guardrail: Cashflow overspend (only when cashflow is modeled)
  // Positive monthlySurplus is allowed (money left after allocations)
  // monthlySurplus is display-only, not part of asset roll-forward
  // ONLY enforce this when cashflow is modeled (snapshot mode)
  // In projection-only mode, scenario allocations are already validated at apply-time
  // NOTE: Negative surplus is valid (external funding / SYSTEM_CASH does not auto-adjust)
  // Downgrade to WARN since this is a valid projection state, not an error
  if (isCashflowModeled && monthlySurplus < -ATTRIBUTION_TOLERANCE) {
    console.warn(`[A3 Attribution] Cashflow overspend (allocations exceed net surplus, |delta| > £${ATTRIBUTION_TOLERANCE}). This may indicate external funding or SYSTEM_CASH mutation.`, {
      monthlySurplus,
      netSurplus: out.cashflow.netSurplus,
      postTaxContributions: out.cashflow.postTaxContributions,
      debtRepayment: out.cashflow.debtRepayment,
      note: 'Negative surplus is valid when external funding exists or SYSTEM_CASH is explicitly adjusted',
    });
  }

  // 4) Dev assertion: Verify endingNetWorth matches projection summary (catch regressions)
  if (__DEV__) {
    const netWorthDelta = Math.abs(endingNetWorth - projectionSummary.endNetWorth);
    if (netWorthDelta > ATTRIBUTION_TOLERANCE) {
      console.error(`[A3 Attribution] endingNetWorth mismatch: attribution=${endingNetWorth}, projection=${projectionSummary.endNetWorth}, delta=${netWorthDelta}`);
    }

    // 6) SYSTEM_CASH invariants
    const systemCash = activeAssets.find(isSystemCash);
    if (!systemCash) {
      console.error('[A3 Attribution] SYSTEM_CASH not found in active assets');
    } else {
      // Assert SYSTEM_CASH properties
      if (systemCash.id !== SYSTEM_CASH_ID) {
        console.error(`[A3 Attribution] SYSTEM_CASH has incorrect id: ${systemCash.id}`);
      }
      if ((systemCash.annualGrowthRatePct ?? 0) !== 0) {
        console.error(`[A3 Attribution] SYSTEM_CASH must have 0% growth, found: ${systemCash.annualGrowthRatePct}`);
      }
      if (systemCash.availability?.type !== 'immediate') {
        console.error(`[A3 Attribution] SYSTEM_CASH must have immediate availability, found: ${systemCash.availability?.type}`);
      }
      if (systemCash.isActive === false) {
        console.error('[A3 Attribution] SYSTEM_CASH must be active');
      }
    }
  }

  return out;
}


