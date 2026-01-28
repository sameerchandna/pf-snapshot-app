// Projection analytics engine (A1)
//
// - Pure + deterministic (no UI logic, no I/O)
// - Force-based balance sheet model:
//   - assets grow by their own annual growth rate (compounded monthly); missing -> 0%
//   - non-loan liabilities accrue interest by their own annual interest rate (compounded monthly); missing -> 0%
//   - loan liabilities amortise via the pure loan engine (unchanged)
//   - explicit monthly contributions are applied by assetId (linked contributions)
//   - monthlyDebtReduction is applied proportionally across non-loan liabilities
//   - inflation adjustment applied once at the end (today's money)

import { initLoan, stepLoanMonth } from './loanEngine';
import { SYSTEM_CASH_ID } from './constants';

export type ProjectionEngineInputs = {
  // Today's instruments
  assetsToday: Array<{
    id: string;
    name: string;
    balance: number; // >= 0
    annualGrowthRatePct?: number; // percent (5.0 = 5%); missing -> 0
  }>;

  liabilitiesToday: Array<{
    id: string;
    name: string;
    balance: number; // >= 0
    annualInterestRatePct?: number; // percent; missing -> 0
    kind?: 'standard' | 'loan';
    remainingTermYears?: number; // required if kind='loan'
  }>;

  // Time horizon
  currentAge: number; // integer
  endAge: number; // integer

  inflationRatePct: number;

  // Explicit user effort (monthly, >= 0)
  assetContributionsMonthly: Array<{ assetId: string; amountMonthly: number }>;
  monthlyDebtReduction: number;
  liabilityOverpaymentsMonthly?: Array<{ liabilityId: string; amountMonthly: number }>;
  
  // Scenario transfers (explicit asset-to-asset transfers, e.g., SYSTEM_CASH -> target asset)
  // 
  // NOTE: scenarioTransfers is no longer used for FLOW scenarios (FLOW_TO_ASSET, FLOW_TO_DEBT).
  // FLOW scenarios work through contribution deltas (assetContributionsMonthly, liabilityOverpaymentsMonthly).
  // This field is retained for potential future use cases (e.g., lump-sum transfers, STOCK scenarios).
  scenarioTransfers?: Array<{ fromAssetId: string; toAssetId: string; amountMonthly: number }>;
};

export type ProjectionSummary = {
  endAssets: number;
  endLiabilities: number;
  endNetWorth: number;
  totalContributions: number; // asset contributions only (post-tax + pension)
  totalPrincipalRepaid: number; // liability reduction (non-loan debt paydown + loan principal: scheduled + overpayments)
  totalScheduledMortgagePayment: number; // interest + scheduled principal (full payment as expense)
  totalMortgageOverpayments: number; // explicit overpayments only (liability reduction)
};

export type ProjectionSeriesPoint = {
  age: number; // age at the sampled point (years)
  assets: number; // real £ (today's money)
  liabilities: number; // real £ (today's money, positive)
  netWorth: number; // real £ (today's money, may be negative)
};

// Exported helper for view-layer computations (used in ProjectionResultsScreen)
export function annualPctToMonthlyRate(pct: number): number {
  // rg = (1 + g)^(1/12) - 1
  const g = pct / 100;
  return Math.pow(1 + g, 1 / 12) - 1;
}

function isLoanLike(x: ProjectionEngineInputs['liabilitiesToday'][number]): x is ProjectionEngineInputs['liabilitiesToday'][number] & {
  kind: 'loan';
  annualInterestRatePct?: number;
  remainingTermYears: number;
} {
  return x.kind === 'loan' && typeof x.remainingTermYears === 'number' && Number.isFinite(x.remainingTermYears) && x.remainingTermYears >= 1;
}

// Removed isCashAsset - now using SYSTEM_CASH_ID constant

/**
 * Canonical monthly simulation loop.
 * 
 * Orchestrates asset and liability updates while preserving existing semantics.
 * State is ephemeral and mutable only within the loop.
 * Never mutates Snapshot.
 */
function runMonthlySimulation(
  inputs: ProjectionEngineInputs,
  onMonth?: (ctx: {
    monthIndex: number;
    state: {
      assets: Array<{ id: string; balance: number }>;
      loans: Array<{ id: string; balance: number }>;
      nonLoans: Array<{ id: string; balance: number }>;
      totals: {
        contributions: number;
        principalRepaid: number;
        scheduledMortgagePayment: number;
        mortgageOverpayments: number;
      };
    };
    aggregates: {
      assets: number;
      liabilities: number;
    };
  }) => void
): {
  finalState: {
    assets: Array<{ id: string; balance: number }>;
    loans: Array<{ id: string; balance: number }>;
    nonLoans: Array<{ id: string; balance: number }>;
  };
  totals: {
    contributions: number;
    principalRepaid: number;
    scheduledMortgagePayment: number;
    mortgageOverpayments: number;
  };
  horizonMonths: number;
} {
  const horizonMonthsRaw = (inputs.endAge - inputs.currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;

  let totalContributions = 0; // Asset contributions only (post-tax + pension)
  let totalPrincipalRepaid = 0; // Liability reduction (non-loan debt paydown + loan principal: scheduled + overpayments)
  let totalScheduledMortgagePayment = 0; // Full scheduled payment (interest + scheduled principal) - treated as expense
  let totalMortgageOverpayments = 0; // Explicit overpayments only - treated as liability reduction

  const assetStates: Array<{ id: string; name: string; balance: number; monthlyGrowthRate: number }> = inputs.assetsToday.map(a => {
    const pct = typeof a.annualGrowthRatePct === 'number' && Number.isFinite(a.annualGrowthRatePct) ? a.annualGrowthRatePct : 0;
    const monthlyGrowthRate = annualPctToMonthlyRate(pct);
    return {
      id: a.id,
      name: a.name,
      balance: Number.isFinite(a.balance) ? Math.max(0, a.balance) : 0,
      monthlyGrowthRate,
    };
  });

  // Phase 3.1: Deterministic ordering - sort by id immediately after creation
  // This ensures consistent iteration order, especially for proportional debt reduction
  assetStates.sort((a, b) => a.id.localeCompare(b.id));

  const nonLoanStates: Array<{ id: string; balance: number; monthlyRate: number }> = inputs.liabilitiesToday
    .filter(l => !isLoanLike(l))
    .map(l => {
      const pct = typeof l.annualInterestRatePct === 'number' && Number.isFinite(l.annualInterestRatePct) ? l.annualInterestRatePct : 0;
      return {
        id: l.id,
        balance: Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0,
        monthlyRate: annualPctToMonthlyRate(pct),
      };
    });

  // Phase 3.1: Deterministic ordering - sort by id immediately after creation
  // CRITICAL: This ensures proportional debt reduction remainder logic is deterministic
  nonLoanStates.sort((a, b) => a.id.localeCompare(b.id));

  // Mortgage payments are treated as expenses; overpayments are discretionary liability reductions.
  // The full scheduled mortgage payment (interest + scheduled principal) is an expense.
  // Only explicit overpayments appear as liability reductions.
  const loanStates: Array<{
    id: string;
    balance: number;
    monthlyPayment: number;
    monthlyRate: number;
    remainingMonths: number;
  }> = inputs.liabilitiesToday.filter(isLoanLike).map(l => {
    // isLoanLike ensures remainingTermYears is a number >= 1, but add explicit check for safety
    const remainingTermYears = typeof l.remainingTermYears === 'number' && Number.isFinite(l.remainingTermYears) && l.remainingTermYears >= 1
      ? l.remainingTermYears
      : 1; // Fallback to 1 year if somehow invalid
    const init = initLoan({
      balance: l.balance,
      annualInterestRatePct: typeof l.annualInterestRatePct === 'number' && Number.isFinite(l.annualInterestRatePct) ? l.annualInterestRatePct : 0,
      remainingTermYears,
    });
    return {
      id: l.id,
      balance: Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0,
      monthlyPayment: init.monthlyPayment,
      monthlyRate: init.monthlyRate,
      remainingMonths: init.remainingMonths,
    };
  });

  // Phase 3.1: Deterministic ordering - sort by id immediately after creation
  loanStates.sort((a, b) => a.id.localeCompare(b.id));

  // Build lookup map for liability overpayments (only for loan-type liabilities)
  const overpaymentMap = new Map<string, number>();
  if (inputs.liabilityOverpaymentsMonthly && Array.isArray(inputs.liabilityOverpaymentsMonthly)) {
    for (const op of inputs.liabilityOverpaymentsMonthly) {
      if (typeof op.liabilityId === 'string' && typeof op.amountMonthly === 'number' && Number.isFinite(op.amountMonthly)) {
        // Only apply to loan-type liabilities (validated by lookup during stepping)
        const amount = Math.max(0, op.amountMonthly);
        if (amount > 0) {
          overpaymentMap.set(op.liabilityId, amount);
        }
      }
    }
  }

  // Phase 3.1: Deterministic ordering - sort contributions by assetId, then amountMonthly
  // This ensures consistent processing order even if input order varies
  const sortedContributions = [...inputs.assetContributionsMonthly].sort((a, b) => {
    const idCompare = a.assetId.localeCompare(b.assetId);
    if (idCompare !== 0) return idCompare;
    return a.amountMonthly - b.amountMonthly;
  });

  for (let monthIndex = 1; monthIndex <= horizonMonths; monthIndex++) {
    // CORRECT MONTHLY MODEL: All money present in a period must compound together.
    // Order: 1) Add contributions (baseline + scenario deltas), 2) Apply growth to entire balance
    // This ensures contributions compound with the balance, maintaining compound growth invariants.
    // 
    // FLOW scenarios work through contribution deltas (assetContributionsMonthly, liabilityOverpaymentsMonthly).
    // Scenario deltas are already merged into these arrays by applyScenarioToProjectionInputs().
    // No scenarioTransfers are used for FLOW scenarios.
    
    // 1) Apply asset contributions (baseline + scenario deltas already merged)
    // Contributions are added to balance, then the entire balance compounds together
    // FLOW scenarios: scenario deltas are already merged into assetContributionsMonthly
    // Cash is STOCK-only - FLOW scenarios do not mutate cash balance (enforced by guardrail in applyScenarioToInputs)
    let contributionTotalThisMonth = 0; // Track only contributions that were actually applied
    for (const c of sortedContributions) {
      const amt = typeof c.amountMonthly === 'number' && Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0;
      if (amt <= 0) continue;
      const idx = assetStates.findIndex(a => a.id === c.assetId);
      if (idx >= 0) {
        assetStates[idx].balance += amt;
        contributionTotalThisMonth += amt; // Only count contributions that were actually applied
      } else {
        // Contribution references a missing asset id. Ignore (state should prevent this).
        // Keep it silent to avoid noisy logs on bad persisted states.
        // Do NOT count this contribution - it was not applied to any asset
      }
    }

    // 2) Apply per-asset growth forces to entire balance (missing -> 0%)
    // Growth is applied AFTER transfers and contributions, so all money compounds together
    for (const a of assetStates) {
      a.balance = a.balance * (1 + a.monthlyGrowthRate);
    }

    // 3) Apply per-liability interest for non-loan liabilities (missing -> 0%)
    // NON-LOAN LIFECYCLE ENFORCEMENT:
    // Once a non-loan liability balance reaches zero, it is inactive and must not accrue interest.
    // Skip paid-off liabilities to prevent unnecessary processing and maintain lifecycle consistency.
    for (const l of nonLoanStates) {
      if (l.balance <= 0) continue; // Skip paid-off liabilities
      l.balance = l.balance * (1 + l.monthlyRate);
    }

    // 4) Amortise smart loans (payment computed once at start; principal clamped in final month)
    // LOAN LIFECYCLE ENFORCEMENT:
    // Once a loan balance reaches zero, the loan is inactive and must produce no cashflows.
    // The continue check below prevents calling stepLoanMonth after payoff, ensuring:
    // - No interest accumulation after payoff
    // - No principal accumulation after payoff
    // - No scheduled payment accumulation after payoff
    // Step 1 guarantees that stepLoanMonth returns zeros after payoff, providing additional safety.
    // Overpayments are only applied while balance > 0; after payoff, overpayments are ignored.
    // 
    // MORTGAGE MODEL: Full scheduled payment (interest + scheduled principal) is treated as an expense.
    // Only explicit overpayments appear as liability reductions.
    let loanScheduledInterestThisMonth = 0;
    let loanScheduledPrincipalThisMonth = 0;
    let loanOverpaymentThisMonth = 0;
    
    for (const loan of loanStates) {
      // Skip paid-off loans to prevent ghost accumulation after payoff.
      // This ensures loan-related totals stop accumulating once the loan balance reaches zero.
      if (loan.balance <= 0) continue;
      
      // Get overpayment amount (if any) for this loan
      const extraPrincipal = overpaymentMap.get(loan.id) ?? 0;
      
      // Compute scheduled payment (interest + scheduled principal) WITHOUT overpayment
      // This gives us the scheduled payment components that are treated as expenses
      const scheduled = stepLoanMonth({ 
        balance: loan.balance, 
        monthlyPayment: loan.monthlyPayment, 
        monthlyRate: loan.monthlyRate
        // NO extraPrincipal - this is the scheduled payment
      });
      
      loanScheduledInterestThisMonth += scheduled.interest;
      loanScheduledPrincipalThisMonth += scheduled.principal;
      
      // Apply overpayment separately (if any) - treated as liability reduction
      if (extraPrincipal > 0) {
        // Overpayment is applied on top of scheduled principal, capped by remaining balance
        const remainingBalanceAfterScheduled = scheduled.newBalance;
        const overpaymentApplied = Math.min(extraPrincipal, remainingBalanceAfterScheduled);
        loanOverpaymentThisMonth += overpaymentApplied;
        
        // Update loan balance with overpayment applied
        loan.balance = Math.max(0, remainingBalanceAfterScheduled - overpaymentApplied);
      } else {
        loan.balance = scheduled.newBalance;
      }
      
      if (loan.remainingMonths > 0) loan.remainingMonths -= 1;
    }
    
    // Accumulate scheduled mortgage payment (full payment as expense) and overpayments (liability reduction)
    const scheduledMortgagePaymentThisMonth = loanScheduledInterestThisMonth + loanScheduledPrincipalThisMonth;
    totalScheduledMortgagePayment += scheduledMortgagePaymentThisMonth;
    totalMortgageOverpayments += loanOverpaymentThisMonth;

    // 5) Monthly debt reduction input applies ONLY to non-loan debt, proportionally by balance.
    const nonLoanTotal = nonLoanStates.reduce((sum, l) => sum + l.balance, 0);
    const debtPaydownTotal = nonLoanTotal > 0 ? Math.min(inputs.monthlyDebtReduction, nonLoanTotal) : 0;
    if (debtPaydownTotal > 0 && nonLoanTotal > 0) {
      let remaining = debtPaydownTotal;
      for (let i = 0; i < nonLoanStates.length; i++) {
        const l = nonLoanStates[i];
        if (l.balance <= 0) continue;
        const isLast = i === nonLoanStates.length - 1;
        const share = isLast ? remaining : debtPaydownTotal * (l.balance / nonLoanTotal);
        const pay = Math.min(l.balance, share);
        l.balance -= pay;
        // Clamp to prevent negative residue from rounding or ordering issues
        l.balance = Math.max(0, l.balance);
        remaining -= pay;
      }
    }

    // 6) Accumulate explicit effort
    // contributionTotalThisMonth was already computed during contribution application (step 1)
    // This ensures we only count contributions that were actually applied to existing assets
    // totalContributions: asset contributions only (post-tax + pension)
    totalContributions += contributionTotalThisMonth;
    // totalPrincipalRepaid: liability reduction (non-loan debt paydown + loan principal: scheduled + overpayments)
    // Note: Scheduled principal is treated as expense, but still reduces liability balance
    const totalLoanPrincipalThisMonth = loanScheduledPrincipalThisMonth + loanOverpaymentThisMonth;
    totalPrincipalRepaid += debtPaydownTotal + totalLoanPrincipalThisMonth;

    const assetsNow = assetStates.reduce((sum, a) => sum + a.balance, 0);
    const nonLoanNow = nonLoanStates.reduce((sum, l) => sum + l.balance, 0);
    const loanBalancesNow = loanStates.reduce((sum, l) => sum + l.balance, 0);
    const liabilities = nonLoanNow + loanBalancesNow;

    // Dev-time assertion: Verify no non-loan liability has negative balance after monthly processing
    if (__DEV__) {
      for (const l of nonLoanStates) {
        if (l.balance < 0) {
          throw new Error(
            `[Projection Engine] Non-loan liability balance went negative: ` +
            `liabilityId=${l.id}, balance=${l.balance}, monthIndex=${monthIndex}. ` +
            `This indicates a calculation error in debt reduction or interest accrual logic.`
          );
        }
      }
    }

    // Call onMonth callback with full state if provided
    if (onMonth) {
      onMonth({
        monthIndex,
        state: {
          assets: assetStates.map(a => ({ id: a.id, balance: a.balance })),
          loans: loanStates.map(l => ({ id: l.id, balance: l.balance })),
          nonLoans: nonLoanStates.map(l => ({ id: l.id, balance: l.balance })),
          totals: {
            contributions: totalContributions,
            principalRepaid: totalPrincipalRepaid,
            scheduledMortgagePayment: totalScheduledMortgagePayment,
            mortgageOverpayments: totalMortgageOverpayments,
          },
        },
        aggregates: {
          assets: assetsNow,
          liabilities,
        },
      });
    }
  }

  // Dev guardrails: SYSTEM_CASH invariants
  // 
  // Cash is STOCK-only: treated as a normal asset (opening balance, growth, optional contributions).
  // FLOW scenarios do not mutate cash balance - they work through contribution deltas to other assets/liabilities.
  // Cash balance is reserved for STOCK scenarios (lump-sum transfers via scenarioTransfers).
  if (__DEV__) {
    const systemCashAsset = assetStates.find(a => a.id === SYSTEM_CASH_ID);
    if (!systemCashAsset) {
      console.error('[Projection Engine] SYSTEM_CASH not found in asset states');
    } else {
      // Check that SYSTEM_CASH never went negative (for future STOCK scenarios with lump-sum transfers)
      // This is a guardrail for scenarioTransfers, not for FLOW scenarios
      if (systemCashAsset.balance < 0) {
        console.error(
          `[Projection Engine] SYSTEM_CASH balance went negative: ${systemCashAsset.balance}. ` +
          `This should only happen with STOCK scenarios (lump-sum transfers), not FLOW scenarios.`
        );
      }
    }
  }

  return {
    finalState: {
      assets: assetStates.map(a => ({ id: a.id, balance: a.balance })),
      loans: loanStates.map(l => ({ id: l.id, balance: l.balance })),
      nonLoans: nonLoanStates.map(l => ({ id: l.id, balance: l.balance })),
    },
    totals: {
      contributions: totalContributions,
      principalRepaid: totalPrincipalRepaid,
      scheduledMortgagePayment: totalScheduledMortgagePayment,
      mortgageOverpayments: totalMortgageOverpayments,
    },
    horizonMonths,
  };
}

/**
 * Legacy wrapper for computeMonthlyProjection.
 * Delegates to runMonthlySimulation for backward compatibility.
 */
function computeMonthlyProjection(
  inputs: ProjectionEngineInputs,
  onMonth?: (ctx: { monthIndex: number; assets: number; liabilities: number }) => void,
): { assets: number; liabilities: number; totalContributions: number; totalPrincipalRepaid: number; totalScheduledMortgagePayment: number; totalMortgageOverpayments: number; horizonMonths: number } {
  // Handle zero horizon case
  const horizonMonthsRaw = (inputs.endAge - inputs.currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;

  if (horizonMonths <= 0) {
    const assetsNow = inputs.assetsToday.reduce((sum, a) => sum + (Number.isFinite(a.balance) ? Math.max(0, a.balance) : 0), 0);
    const nonLoanNow = inputs.liabilitiesToday
      .filter(l => !isLoanLike(l))
      .reduce((sum, l) => sum + (Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0), 0);
    const loanStart = inputs.liabilitiesToday
      .filter(isLoanLike)
      .reduce((sum, l) => sum + (Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0), 0);
    return { 
      assets: assetsNow, 
      liabilities: nonLoanNow + loanStart, 
      totalContributions: 0, 
      totalPrincipalRepaid: 0,
      totalScheduledMortgagePayment: 0, 
      totalMortgageOverpayments: 0, 
      horizonMonths: 0,
    };
  }

  // Delegate to runMonthlySimulation
  const { finalState, totals, horizonMonths: computedHorizonMonths } = runMonthlySimulation(
    inputs,
    onMonth ? (ctx) => {
      // Convert new callback format to legacy format
      onMonth({
        monthIndex: ctx.monthIndex,
        assets: ctx.aggregates.assets,
        liabilities: ctx.aggregates.liabilities,
      });
    } : undefined
  );

  const assetsEnd = finalState.assets.reduce((sum, a) => sum + a.balance, 0);
  const nonLoanEnd = finalState.nonLoans.reduce((sum, l) => sum + l.balance, 0);
  const loanEnd = finalState.loans.reduce((sum, l) => sum + l.balance, 0);
  const liabilitiesEnd = nonLoanEnd + loanEnd;

  return {
    assets: assetsEnd,
    liabilities: liabilitiesEnd,
    totalContributions: totals.contributions,
    totalPrincipalRepaid: totals.principalRepaid,
    totalScheduledMortgagePayment: totals.scheduledMortgagePayment,
    totalMortgageOverpayments: totals.mortgageOverpayments,
    horizonMonths: computedHorizonMonths,
  };
}

// Exported helper for view-layer computations (used in ProjectionResultsScreen)
export function deflateToTodaysMoney(value: number, inflationRatePct: number, elapsedMonths: number): number {
  if (elapsedMonths <= 0) return value;
  const elapsedYears = elapsedMonths / 12;
  const inflationRate = inflationRatePct / 100;
  const deflator = Math.pow(1 + inflationRate, elapsedYears);
  const safeDeflator = Number.isFinite(deflator) && deflator > 0 ? deflator : 1;
  return value / safeDeflator;
}

export function computeProjectionSummary(inputs: ProjectionEngineInputs): ProjectionSummary {
  // Phase 3.1: Defensive copying - clone input arrays and shallow-clone objects to prevent mutation
  const clonedInputs: ProjectionEngineInputs = {
    ...inputs,
    assetsToday: inputs.assetsToday.map(a => ({ ...a })),
    liabilitiesToday: inputs.liabilitiesToday.map(l => ({ ...l })),
    assetContributionsMonthly: inputs.assetContributionsMonthly.map(c => ({ ...c })),
    liabilityOverpaymentsMonthly: inputs.liabilityOverpaymentsMonthly?.map(o => ({ ...o })),
    scenarioTransfers: inputs.scenarioTransfers?.map(t => ({ ...t })),
  };

  // Horizon must come from top-level inputs (baseline & scenario safe)
  // Normalize endAge: check top-level first, then fallback to settings if present
  const currentAge = clonedInputs.currentAge;
  const endAge = clonedInputs.endAge ?? (clonedInputs as any).settings?.endAge;
  
  // Guardrail: for zero/invalid horizons, return today's values (no inflation adjustment).
  const horizonMonthsRaw = (endAge - currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) && Number.isFinite(endAge) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;
  if (horizonMonths <= 0 || !Number.isFinite(endAge) || endAge <= currentAge) {
    const endAssets = clonedInputs.assetsToday.reduce((sum, a) => sum + (Number.isFinite(a.balance) ? Math.max(0, a.balance) : 0), 0);
    const loanStart = clonedInputs.liabilitiesToday
      .filter(isLoanLike)
      .reduce((sum, l) => sum + (Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0), 0);
    const nonLoanStart = clonedInputs.liabilitiesToday
      .filter(l => !isLoanLike(l))
      .reduce((sum, l) => sum + (Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0), 0);
    const endLiabilities = nonLoanStart + loanStart;
    const endNetWorth = endAssets - endLiabilities;
    return { 
      endAssets, 
      endLiabilities, 
      endNetWorth, 
      totalContributions: 0, 
      totalPrincipalRepaid: 0,
      totalScheduledMortgagePayment: 0, 
      totalMortgageOverpayments: 0,
    };
  }

  // Create normalized inputs object with derived horizon values for computeMonthlyProjection
  const normalizedInputs: ProjectionEngineInputs = {
    ...clonedInputs,
    currentAge,
    endAge,
  };

  const { assets, liabilities, totalContributions, totalPrincipalRepaid, totalScheduledMortgagePayment, totalMortgageOverpayments } = computeMonthlyProjection(normalizedInputs);

  const endAssets = deflateToTodaysMoney(assets, clonedInputs.inflationRatePct, horizonMonths);
  const endLiabilities = deflateToTodaysMoney(liabilities, clonedInputs.inflationRatePct, horizonMonths);
  const endNetWorth = endAssets - endLiabilities;
  const endTotalContributions = deflateToTodaysMoney(totalContributions, clonedInputs.inflationRatePct, horizonMonths);
  const endTotalPrincipalRepaid = deflateToTodaysMoney(totalPrincipalRepaid, clonedInputs.inflationRatePct, horizonMonths);
  const endScheduledMortgagePayment = deflateToTodaysMoney(totalScheduledMortgagePayment, clonedInputs.inflationRatePct, horizonMonths);
  const endMortgageOverpayments = deflateToTodaysMoney(totalMortgageOverpayments, clonedInputs.inflationRatePct, horizonMonths);

  return {
    endAssets,
    endLiabilities,
    endNetWorth,
    totalContributions: endTotalContributions,
    totalPrincipalRepaid: endTotalPrincipalRepaid,
    totalScheduledMortgagePayment: endScheduledMortgagePayment,
    totalMortgageOverpayments: endMortgageOverpayments,
  };
}

export function computeProjectionSeries(inputs: ProjectionEngineInputs): ProjectionSeriesPoint[] {
  // Phase 3.1: Defensive copying - clone input arrays and shallow-clone objects to prevent mutation
  const clonedInputs: ProjectionEngineInputs = {
    ...inputs,
    assetsToday: inputs.assetsToday.map(a => ({ ...a })),
    liabilitiesToday: inputs.liabilitiesToday.map(l => ({ ...l })),
    assetContributionsMonthly: inputs.assetContributionsMonthly.map(c => ({ ...c })),
    liabilityOverpaymentsMonthly: inputs.liabilityOverpaymentsMonthly?.map(o => ({ ...o })),
    scenarioTransfers: inputs.scenarioTransfers?.map(t => ({ ...t })),
  };

  // Horizon must come from top-level inputs (baseline & scenario safe)
  // Normalize endAge: check top-level first, then fallback to settings if present
  
  // Normalize with Number() coercion to handle string/undefined/null
  const currentAge = Number(clonedInputs.currentAge);
  const endAge = Number(clonedInputs.endAge ?? (clonedInputs as any).settings?.endAge);
  
  // DEV-only CRITICAL: Check for NaN/invalid values before proceeding
  if (__DEV__) {
    if (!Number.isFinite(currentAge) || !Number.isFinite(endAge)) {
      console.error('[CRITICAL] ProjectionEngine: Non-finite horizon values:', {
        currentAge,
        endAge,
        rawCurrentAge: clonedInputs.currentAge,
        rawEndAge: clonedInputs.endAge,
        rawSettingsEndAge: (clonedInputs as any).settings?.endAge,
        currentAgeIsFinite: Number.isFinite(currentAge),
        endAgeIsFinite: Number.isFinite(endAge),
        inputs: clonedInputs,
      });
      return [];
    }
  }
  
  // Production guard: Return empty series if horizon is invalid (NaN or non-finite)
  if (!Number.isFinite(currentAge) || !Number.isFinite(endAge)) {
    console.error('[CRITICAL] Projection horizon invalid (non-finite values):', {
      currentAge,
      endAge,
      rawCurrentAge: clonedInputs.currentAge,
      rawEndAge: clonedInputs.endAge,
    });
    return [];
  }
  
  // Compute horizonMonths from normalized values
  const horizonMonthsRaw = (endAge - currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;
  
  // DEV-only CRITICAL: Check if endAge <= currentAge (invalid horizon)
  if (__DEV__) {
    if (endAge <= currentAge) {
      console.error('[CRITICAL] ProjectionEngine: Invalid horizon (endAge <= currentAge):', {
        currentAge,
        endAge,
        horizonMonths,
        horizonYears: (endAge - currentAge),
        rawCurrentAge: clonedInputs.currentAge,
        rawEndAge: clonedInputs.endAge,
        rawSettingsEndAge: (clonedInputs as any).settings?.endAge,
        inputs: clonedInputs,
      });
      return [];
    }
  }
  
  // Production guard: Return empty series if horizon is invalid (endAge <= currentAge)
  if (endAge <= currentAge) {
    console.error('[CRITICAL] Projection horizon invalid (endAge <= currentAge):', {
      currentAge,
      endAge,
      horizonMonths,
    });
    return [];
  }
  
  // Use ONLY normalized values in the loop - do NOT read endAge from inputs.settings again

  // Always include a start point at "today" (month 0).
  const assetsToday = clonedInputs.assetsToday.reduce((sum, a) => sum + (Number.isFinite(a.balance) ? Math.max(0, a.balance) : 0), 0);
  const loanStart = clonedInputs.liabilitiesToday
    .filter(isLoanLike)
    .reduce((sum, l) => sum + (Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0), 0);
  const nonLoanStart = clonedInputs.liabilitiesToday
    .filter(l => !isLoanLike(l))
    .reduce((sum, l) => sum + (Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0), 0);
  const startAssets = deflateToTodaysMoney(assetsToday, clonedInputs.inflationRatePct, 0);
  const startLiabilities = deflateToTodaysMoney(nonLoanStart + loanStart, clonedInputs.inflationRatePct, 0);
  const startNetWorth = startAssets - startLiabilities;

  const points: ProjectionSeriesPoint[] = [
    {
      age: currentAge,
      assets: startAssets,
      liabilities: startLiabilities,
      netWorth: startNetWorth,
    },
  ];

  if (horizonMonths <= 0) return points;

  // Create normalized inputs object with derived horizon values for computeMonthlyProjection
  const normalizedInputs: ProjectionEngineInputs = {
    ...clonedInputs,
    currentAge,
    endAge,
  };

  computeMonthlyProjection(normalizedInputs, ({ monthIndex, assets, liabilities }) => {
    // Sample yearly points only (every 12 months).
    if (monthIndex % 12 !== 0) return;

    const age = currentAge + monthIndex / 12;
    const realAssets = deflateToTodaysMoney(assets, clonedInputs.inflationRatePct, monthIndex);
    const realLiabilities = deflateToTodaysMoney(liabilities, clonedInputs.inflationRatePct, monthIndex);
    const realNetWorth = realAssets - realLiabilities;

    points.push({
      age,
      assets: realAssets,
      liabilities: realLiabilities,
      netWorth: realNetWorth,
    });
  });

  return points;
}

/**
 * Phase 3.1: Optional __DEV__ determinism assertion helper.
 * 
 * Runs projection twice on deep-cloned normalized inputs and asserts outputs match within tolerance.
 * This helps detect non-deterministic behavior during development.
 * 
 * @param inputs - Projection inputs to test
 * @param tolerance - Tolerance for numeric comparison (defaults to UI_TOLERANCE)
 * @returns true if outputs match within tolerance, false otherwise
 */
export function assertProjectionDeterminism(
  inputs: ProjectionEngineInputs,
  tolerance: number = 0.01 // UI_TOLERANCE default
): boolean {
  if (!__DEV__) {
    console.warn('[assertProjectionDeterminism] Only available in __DEV__ mode');
    return true;
  }

  // Deep clone inputs for both runs
  const deepClone = (inp: ProjectionEngineInputs): ProjectionEngineInputs => ({
    ...inp,
    assetsToday: inp.assetsToday.map(a => ({ ...a })),
    liabilitiesToday: inp.liabilitiesToday.map(l => ({ ...l })),
    assetContributionsMonthly: inp.assetContributionsMonthly.map(c => ({ ...c })),
    liabilityOverpaymentsMonthly: inp.liabilityOverpaymentsMonthly?.map(o => ({ ...o })),
    scenarioTransfers: inp.scenarioTransfers?.map(t => ({ ...t })),
  });

  const inputs1 = deepClone(inputs);
  const inputs2 = deepClone(inputs);

  // Run projection twice
  const summary1 = computeProjectionSummary(inputs1);
  const summary2 = computeProjectionSummary(inputs2);
  const series1 = computeProjectionSeries(inputs1);
  const series2 = computeProjectionSeries(inputs2);

  // Compare summaries
  const summaryMatches = 
    Math.abs(summary1.endAssets - summary2.endAssets) <= tolerance &&
    Math.abs(summary1.endLiabilities - summary2.endLiabilities) <= tolerance &&
    Math.abs(summary1.endNetWorth - summary2.endNetWorth) <= tolerance &&
    Math.abs(summary1.totalContributions - summary2.totalContributions) <= tolerance &&
    Math.abs(summary1.totalPrincipalRepaid - summary2.totalPrincipalRepaid) <= tolerance &&
    Math.abs(summary1.totalScheduledMortgagePayment - summary2.totalScheduledMortgagePayment) <= tolerance &&
    Math.abs(summary1.totalMortgageOverpayments - summary2.totalMortgageOverpayments) <= tolerance;

  // Compare series (length and values)
  const seriesLengthMatches = series1.length === series2.length;
  let seriesValuesMatch = true;
  if (seriesLengthMatches) {
    for (let i = 0; i < series1.length; i++) {
      const p1 = series1[i];
      const p2 = series2[i];
      if (
        Math.abs(p1.age - p2.age) > tolerance ||
        Math.abs(p1.assets - p2.assets) > tolerance ||
        Math.abs(p1.liabilities - p2.liabilities) > tolerance ||
        Math.abs(p1.netWorth - p2.netWorth) > tolerance
      ) {
        seriesValuesMatch = false;
        break;
      }
    }
  } else {
    seriesValuesMatch = false;
  }

  const allMatch = summaryMatches && seriesLengthMatches && seriesValuesMatch;

  if (!allMatch) {
    console.error('[Projection Determinism] Outputs do not match within tolerance:', {
      summary1,
      summary2,
      summaryDiffs: {
        endAssets: Math.abs(summary1.endAssets - summary2.endAssets),
        endLiabilities: Math.abs(summary1.endLiabilities - summary2.endLiabilities),
        endNetWorth: Math.abs(summary1.endNetWorth - summary2.endNetWorth),
        totalContributions: Math.abs(summary1.totalContributions - summary2.totalContributions),
        totalPrincipalRepaid: Math.abs(summary1.totalPrincipalRepaid - summary2.totalPrincipalRepaid),
        totalScheduledMortgagePayment: Math.abs(summary1.totalScheduledMortgagePayment - summary2.totalScheduledMortgagePayment),
        totalMortgageOverpayments: Math.abs(summary1.totalMortgageOverpayments - summary2.totalMortgageOverpayments),
      },
      seriesLength1: series1.length,
      seriesLength2: series2.length,
      tolerance,
    });
  }

  return allMatch;
}

/**
 * Compute time series for a single asset.
 * 
 * Returns yearly samples with balance, cumulative contributions, and cumulative growth.
 * Growth is calculated as residual: balance - startingBalance - cumulativeContributions.
 * 
 * Uses runMonthlySimulation internally. Ephemeral and deterministic.
 */
export function computeSingleAssetTimeSeries(
  inputs: ProjectionEngineInputs,
  assetId: string
): Array<{
  age: number;
  balance: number;
  cumulativeContributions: number;
  cumulativeGrowth: number;
}> {
  // Defensive copying
  const clonedInputs: ProjectionEngineInputs = {
    ...inputs,
    assetsToday: inputs.assetsToday.map(a => ({ ...a })),
    liabilitiesToday: inputs.liabilitiesToday.map(l => ({ ...l })),
    assetContributionsMonthly: inputs.assetContributionsMonthly.map(c => ({ ...c })),
    liabilityOverpaymentsMonthly: inputs.liabilityOverpaymentsMonthly?.map(o => ({ ...o })),
    scenarioTransfers: inputs.scenarioTransfers?.map(t => ({ ...t })),
  };

  const currentAge = Number(clonedInputs.currentAge);
  const endAge = Number(clonedInputs.endAge ?? (clonedInputs as any).settings?.endAge);

  // Guard: Return empty if invalid horizon
  if (!Number.isFinite(currentAge) || !Number.isFinite(endAge) || endAge <= currentAge) {
    return [];
  }

  // Find starting balance for the asset
  const startingAsset = clonedInputs.assetsToday.find(a => a.id === assetId);
  if (!startingAsset) {
    return [];
  }
  const startingBalance = Number.isFinite(startingAsset.balance) ? Math.max(0, startingAsset.balance) : 0;

  // Find contributions for this asset
  const assetContributions = clonedInputs.assetContributionsMonthly
    .filter(c => c.assetId === assetId)
    .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? Math.max(0, c.amountMonthly) : 0), 0);

  const points: Array<{
    age: number;
    balance: number;
    cumulativeContributions: number;
    cumulativeGrowth: number;
  }> = [
    {
      age: currentAge,
      balance: deflateToTodaysMoney(startingBalance, clonedInputs.inflationRatePct, 0),
      cumulativeContributions: 0,
      cumulativeGrowth: 0,
    },
  ];

  const horizonMonthsRaw = (endAge - currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;

  if (horizonMonths <= 0) return points;

  // Track cumulative contributions month-by-month
  let cumulativeContributions = 0;

  // Create normalized inputs
  const normalizedInputs: ProjectionEngineInputs = {
    ...clonedInputs,
    currentAge,
    endAge,
  };

  runMonthlySimulation(normalizedInputs, ({ monthIndex, state }) => {
    // Track contributions each month (before sampling)
    cumulativeContributions += assetContributions;

    // Sample yearly points only (every 12 months)
    if (monthIndex % 12 !== 0) return;

    // Find the asset in state
    const assetState = state.assets.find(a => a.id === assetId);
    if (!assetState) return;

    const age = currentAge + monthIndex / 12;
    const balance = deflateToTodaysMoney(assetState.balance, clonedInputs.inflationRatePct, monthIndex);
    const cumulativeContributionsReal = deflateToTodaysMoney(cumulativeContributions, clonedInputs.inflationRatePct, monthIndex);
    
    // Growth = balance - startingBalance - cumulativeContributions
    // This is the residual after accounting for starting balance and contributions
    const startingBalanceReal = deflateToTodaysMoney(startingBalance, clonedInputs.inflationRatePct, 0);
    const cumulativeGrowth = balance - startingBalanceReal - cumulativeContributionsReal;

    points.push({
      age,
      balance,
      cumulativeContributions: cumulativeContributionsReal,
      cumulativeGrowth,
    });
  });

  return points;
}

/**
 * Compute time series for a single liability.
 * 
 * Returns yearly samples with balance, cumulative principal paid, and cumulative interest paid.
 * 
 * Uses runMonthlySimulation internally. Ephemeral and deterministic.
 */
export function computeSingleLiabilityTimeSeries(
  inputs: ProjectionEngineInputs,
  liabilityId: string
): Array<{
  age: number;
  balance: number;
  cumulativePrincipalPaid: number;
  cumulativeInterestPaid: number;
}> {
  // Defensive copying
  const clonedInputs: ProjectionEngineInputs = {
    ...inputs,
    assetsToday: inputs.assetsToday.map(a => ({ ...a })),
    liabilitiesToday: inputs.liabilitiesToday.map(l => ({ ...l })),
    assetContributionsMonthly: inputs.assetContributionsMonthly.map(c => ({ ...c })),
    liabilityOverpaymentsMonthly: inputs.liabilityOverpaymentsMonthly?.map(o => ({ ...o })),
    scenarioTransfers: inputs.scenarioTransfers?.map(t => ({ ...t })),
  };

  const currentAge = Number(clonedInputs.currentAge);
  const endAge = Number(clonedInputs.endAge ?? (clonedInputs as any).settings?.endAge);

  // Guard: Return empty if invalid horizon
  if (!Number.isFinite(currentAge) || !Number.isFinite(endAge) || endAge <= currentAge) {
    return [];
  }

  // Find starting balance for the liability
  const startingLiability = clonedInputs.liabilitiesToday.find(l => l.id === liabilityId);
  if (!startingLiability) {
    return [];
  }
  const startingBalance = Number.isFinite(startingLiability.balance) ? Math.max(0, startingLiability.balance) : 0;

  const isLoan = isLoanLike(startingLiability);

  const points: Array<{
    age: number;
    balance: number;
    cumulativePrincipalPaid: number;
    cumulativeInterestPaid: number;
  }> = [
    {
      age: currentAge,
      balance: deflateToTodaysMoney(startingBalance, clonedInputs.inflationRatePct, 0),
      cumulativePrincipalPaid: 0,
      cumulativeInterestPaid: 0,
    },
  ];

  const horizonMonthsRaw = (endAge - currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;

  if (horizonMonths <= 0) return points;

  // Track cumulative principal and interest month-by-month
  let cumulativePrincipalPaid = 0;
  let cumulativeInterestPaid = 0;
  let trackedLoanBalance = startingBalance; // Track loan balance separately for accurate interest/principal calculation

  // For loans, initialize to get payment schedule
  let loanMonthlyPayment = 0;
  let loanMonthlyRate = 0;
  if (isLoan) {
    const loanInit = initLoan({
      balance: startingBalance,
      annualInterestRatePct: typeof startingLiability.annualInterestRatePct === 'number' && Number.isFinite(startingLiability.annualInterestRatePct) 
        ? startingLiability.annualInterestRatePct 
        : 0,
      remainingTermYears: startingLiability.remainingTermYears ?? 0,
    });
    loanMonthlyPayment = loanInit.monthlyPayment;
    loanMonthlyRate = loanInit.monthlyRate;
  }

  // Get interest rate for non-loans
  const nonLoanMonthlyRate = isLoan ? 0 : annualPctToMonthlyRate(
    typeof startingLiability.annualInterestRatePct === 'number' && Number.isFinite(startingLiability.annualInterestRatePct)
      ? startingLiability.annualInterestRatePct
      : 0
  );

  // Get overpayment for loans
  const overpaymentMonthly = isLoan && clonedInputs.liabilityOverpaymentsMonthly
    ? (clonedInputs.liabilityOverpaymentsMonthly.find(op => op.liabilityId === liabilityId)?.amountMonthly ?? 0)
    : 0;
  const overpaymentAmount = Number.isFinite(overpaymentMonthly) ? Math.max(0, overpaymentMonthly) : 0;

  // Create normalized inputs
  const normalizedInputs: ProjectionEngineInputs = {
    ...clonedInputs,
    currentAge,
    endAge,
  };

  runMonthlySimulation(normalizedInputs, ({ monthIndex, state }) => {
    // Find the liability in state (check both loans and nonLoans)
    const liabilityState = isLoan 
      ? state.loans.find(l => l.id === liabilityId)
      : state.nonLoans.find(l => l.id === liabilityId);
    
    if (!liabilityState) return;

    const currentBalance = liabilityState.balance;

    if (isLoan) {
      // For loans: recalculate interest and principal using loan engine
      // This matches the exact logic used in runMonthlySimulation
      if (trackedLoanBalance > 0) {
        // Calculate scheduled payment (without overpayment)
        const scheduled = stepLoanMonth({
          balance: trackedLoanBalance,
          monthlyPayment: loanMonthlyPayment,
          monthlyRate: loanMonthlyRate,
        });
        
        const interestThisMonth = scheduled.interest;
        let principalThisMonth = scheduled.principal;
        
        // Apply overpayment if any
        if (overpaymentAmount > 0) {
          const remainingAfterScheduled = scheduled.newBalance;
          const overpaymentApplied = Math.min(overpaymentAmount, remainingAfterScheduled);
          principalThisMonth += overpaymentApplied;
          trackedLoanBalance = Math.max(0, remainingAfterScheduled - overpaymentApplied);
        } else {
          trackedLoanBalance = scheduled.newBalance;
        }
        
        cumulativeInterestPaid += interestThisMonth;
        cumulativePrincipalPaid += principalThisMonth;
      }
    } else {
      // For non-loans: interest accrues first, then debt reduction
      if (trackedLoanBalance > 0) {
        // Interest accrues on opening balance
        const interestThisMonth = trackedLoanBalance * nonLoanMonthlyRate;
        cumulativeInterestPaid += interestThisMonth;
        
        // Update balance after interest (before debt reduction)
        trackedLoanBalance = trackedLoanBalance * (1 + nonLoanMonthlyRate);
      }
      
      // Principal paid is the reduction in balance
      const balanceChange = trackedLoanBalance - currentBalance;
      if (balanceChange > 0) {
        cumulativePrincipalPaid += balanceChange;
      }
      trackedLoanBalance = currentBalance;
    }

    // Sample yearly points only (every 12 months)
    if (monthIndex % 12 !== 0) return;

    const age = currentAge + monthIndex / 12;
    const balance = deflateToTodaysMoney(currentBalance, clonedInputs.inflationRatePct, monthIndex);
    const cumulativePrincipalPaidReal = deflateToTodaysMoney(cumulativePrincipalPaid, clonedInputs.inflationRatePct, monthIndex);
    const cumulativeInterestPaidReal = deflateToTodaysMoney(cumulativeInterestPaid, clonedInputs.inflationRatePct, monthIndex);

    points.push({
      age,
      balance,
      cumulativePrincipalPaid: cumulativePrincipalPaidReal,
      cumulativeInterestPaid: cumulativeInterestPaidReal,
    });
  });

  return points;
}


