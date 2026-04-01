// Liquid and locked asset series computation (Phase 13.2)
//
// Extracted from ProjectionResultsScreen so they can be consumed by:
//   - ProjectionResultsScreen (chart display)
//   - detectProblems.ts (gap detection)
//   - backSolve.ts (back-solve engine)

import type { ProjectionEngineInputs } from '../engines/projectionEngine';
import { annualPctToMonthlyRate, deflateToTodaysMoney } from '../engines/projectionEngine';
import { initLoan, stepLoanMonth } from '../engines/loanEngine';
import type { AssetItem } from '../types';

/**
 * Returns true if the given asset is accessible (liquid) at `age`.
 * - immediate: always liquid
 * - illiquid: never liquid
 * - locked: liquid once unlockAge is reached; treated as illiquid if unlockAge is missing/invalid
 */
export function isAssetLiquidAtAge(
  asset: AssetItem,
  age: number,
  _currentAge: number,
): boolean {
  const avail = asset.availability ?? { type: 'immediate' };

  if (avail.type === 'immediate') return true;
  if (avail.type === 'illiquid') return false;

  // locked: check if unlock age has been reached
  if (avail.type === 'locked') {
    if (typeof avail.unlockAge === 'number' && Number.isFinite(avail.unlockAge)) {
      return age >= avail.unlockAge;
    }
    return false;
  }

  return false;
}

/**
 * Compute the series of liquid (accessible) asset values in today's money, sampled yearly.
 *
 * Mirrors the core loop of projectionEngine.ts but tracks individual asset balances and
 * filters by availability at each age. Index 0 = today (currentAge), index 1 = currentAge+1, etc.
 *
 * Used for bridge-gap detection and the liquid assets chart line.
 */
export function computeLiquidAssetsSeries(
  inputs: ProjectionEngineInputs,
  assetsWithAvailability: AssetItem[],
): number[] {
  const { currentAge, retirementAge, inflationRatePct } = inputs;
  const horizonMonthsRaw = (inputs.endAge - currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;

  // Map assets by id for availability lookup
  const assetMap = new Map<string, AssetItem>();
  for (const asset of assetsWithAvailability) {
    assetMap.set(asset.id, asset);
  }

  // Track individual asset balances with availability (mirrors projectionEngine assetStates)
  const assetStates: Array<{
    id: string;
    balance: number;
    monthlyGrowthRate: number;
    availability: AssetItem['availability'];
  }> = inputs.assetsToday.map(a => {
    const pct =
      typeof a.annualGrowthRatePct === 'number' && Number.isFinite(a.annualGrowthRatePct)
        ? a.annualGrowthRatePct
        : 0;
    return {
      id: a.id,
      balance: Number.isFinite(a.balance) ? Math.max(0, a.balance) : 0,
      monthlyGrowthRate: annualPctToMonthlyRate(pct),
      availability: assetMap.get(a.id)?.availability,
    };
  });

  // Pre-compute mortgage monthly payment (fixed P&I, mirrors projectionEngine step 4)
  const loanLiability = inputs.liabilitiesToday.find(
    l => l.kind === 'loan' && typeof l.remainingTermYears === 'number' && l.remainingTermYears >= 1,
  );
  const loanState = loanLiability
    ? {
        ...initLoan({
          balance: loanLiability.balance,
          annualInterestRatePct: loanLiability.annualInterestRatePct ?? 0,
          remainingTermYears: loanLiability.remainingTermYears!,
        }),
        balance: loanLiability.balance,
      }
    : null;

  // Start point: liquid assets at current age
  const startLiquidAssets = assetStates.reduce((sum, a) => {
    const asset = assetMap.get(a.id);
    if (!asset) return sum;
    return isAssetLiquidAtAge(asset, currentAge, currentAge) ? sum + a.balance : sum;
  }, 0);

  const liquidSeries: number[] = [deflateToTodaysMoney(startLiquidAssets, inflationRatePct, 0)];

  if (horizonMonths <= 0) return liquidSeries;

  for (let monthIndex = 1; monthIndex <= horizonMonths; monthIndex++) {
    const ageAtMonth = currentAge + monthIndex / 12;
    const isRetired = ageAtMonth >= retirementAge;

    // 1) Contributions (pre-retirement only)
    if (!isRetired) {
      for (const c of inputs.assetContributionsMonthly) {
        const amt =
          typeof c.amountMonthly === 'number' && Number.isFinite(c.amountMonthly)
            ? c.amountMonthly
            : 0;
        if (amt <= 0) continue;
        const idx = assetStates.findIndex(a => a.id === c.assetId);
        if (idx >= 0) assetStates[idx].balance += amt;
      }
    }

    // 2) Per-asset growth (entire balance compounds, matches projectionEngine step 2)
    for (const a of assetStates) {
      a.balance = a.balance * (1 + a.monthlyGrowthRate);
    }

    // 3) Mortgage amortisation — track balance to know when paid off
    let scheduledMortgagePaymentThisMonth = 0;
    if (loanState && loanState.balance > 0) {
      const step = stepLoanMonth({
        balance: loanState.balance,
        monthlyPayment: loanState.monthlyPayment,
        monthlyRate: loanState.monthlyRate,
      });
      scheduledMortgagePaymentThisMonth = step.interest + step.principal;
      loanState.balance = step.newBalance;
    }

    // 4) Post-retirement withdrawal (mirrors projectionEngine step 6 exactly)
    if (isRetired) {
      const inflationFactor = Math.pow(1 + inflationRatePct / 100, monthIndex / 12);
      const nominalLivingExpenses = (inputs.monthlyExpensesReal ?? 0) * inflationFactor;
      const totalWithdrawal = nominalLivingExpenses + scheduledMortgagePaymentThisMonth;

      if (totalWithdrawal > 0) {
        const withdrawable = assetStates.filter(a => {
          if (!a.availability || a.availability.type === 'immediate') return true;
          if (a.availability.type === 'locked' && typeof a.availability.unlockAge === 'number') {
            return ageAtMonth >= a.availability.unlockAge;
          }
          return false;
        });
        const totalWithdrawable = withdrawable.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
        if (totalWithdrawable > 0) {
          const capped = Math.min(totalWithdrawal, totalWithdrawable);
          for (const a of withdrawable) {
            if (a.balance <= 0) continue;
            a.balance = Math.max(0, a.balance - capped * (a.balance / totalWithdrawable));
          }
        }
      }
    }

    // Sample yearly points
    if (monthIndex % 12 === 0) {
      const age = currentAge + monthIndex / 12;
      const liquidAssets = assetStates.reduce((sum, a) => {
        const asset = assetMap.get(a.id);
        if (!asset) return sum;
        return isAssetLiquidAtAge(asset, age, currentAge) ? sum + a.balance : sum;
      }, 0);
      liquidSeries.push(deflateToTodaysMoney(liquidAssets, inflationRatePct, monthIndex));
    }
  }

  return liquidSeries;
}

/**
 * Compute the series of locked (pension/deferred) asset values in today's money, sampled yearly.
 *
 * Tracks locked assets only: growth + contributions, no withdrawals.
 * Stops at the earliest unlock age — once unlocked, assets join the liquid pool and
 * are already reflected in the liquid series.
 *
 * Returns [] if there are no locked assets.
 */
export function computeLockedAssetsSeries(
  inputs: ProjectionEngineInputs,
  assetsWithAvailability: AssetItem[],
): number[] {
  const { currentAge, retirementAge, endAge, inflationRatePct } = inputs;

  // Stop at the earliest unlock age
  const unlockAges = assetsWithAvailability
    .filter(a => a.availability?.type === 'locked' && typeof a.availability.unlockAge === 'number')
    .map(a => a.availability!.unlockAge as number);
  const stopAge = unlockAges.length > 0 ? Math.min(...unlockAges) : endAge;
  const horizonMonthsRaw = (stopAge - currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;

  const assetMap = new Map<string, AssetItem>();
  for (const asset of assetsWithAvailability) {
    assetMap.set(asset.id, asset);
  }

  const lockedAssetStates = inputs.assetsToday
    .filter(a => assetMap.get(a.id)?.availability?.type === 'locked')
    .map(a => {
      const pct =
        typeof a.annualGrowthRatePct === 'number' && Number.isFinite(a.annualGrowthRatePct)
          ? a.annualGrowthRatePct
          : 0;
      return {
        id: a.id,
        balance: Number.isFinite(a.balance) ? Math.max(0, a.balance) : 0,
        monthlyGrowthRate: annualPctToMonthlyRate(pct),
      };
    });

  if (lockedAssetStates.length === 0) return [];

  const startLocked = lockedAssetStates.reduce((sum, a) => sum + a.balance, 0);
  const lockedSeries: number[] = [deflateToTodaysMoney(startLocked, inflationRatePct, 0)];

  if (horizonMonths <= 0) return lockedSeries;

  for (let monthIndex = 1; monthIndex <= horizonMonths; monthIndex++) {
    const ageAtMonth = currentAge + monthIndex / 12;
    const isRetired = ageAtMonth >= retirementAge;

    // Contributions (pre-retirement only)
    if (!isRetired) {
      for (const c of inputs.assetContributionsMonthly) {
        const amt =
          typeof c.amountMonthly === 'number' && Number.isFinite(c.amountMonthly)
            ? c.amountMonthly
            : 0;
        if (amt <= 0) continue;
        const idx = lockedAssetStates.findIndex(a => a.id === c.assetId);
        if (idx >= 0) lockedAssetStates[idx].balance += amt;
      }
    }

    // Growth
    for (const a of lockedAssetStates) {
      a.balance = a.balance * (1 + a.monthlyGrowthRate);
    }

    // Sample yearly
    if (monthIndex % 12 === 0) {
      const total = lockedAssetStates.reduce((sum, a) => sum + a.balance, 0);
      lockedSeries.push(deflateToTodaysMoney(total, inflationRatePct, monthIndex));
    }
  }

  return lockedSeries;
}
