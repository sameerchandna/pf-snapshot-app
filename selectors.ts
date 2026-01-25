// Pure financial selectors (single source of truth for totals)
//
// - No formatting
// - No validation (assume state is valid; boundaries already enforce that)
// - Deterministic and side-effect free

import type { SnapshotState } from './types';
import { initLoan, stepLoanMonth } from './loanEngine';
import type { Scenario } from './domain/scenario/types';

// ----- Low-level helpers
export function sumFlat(items: ReadonlyArray<{ monthlyAmount: number }>): number {
  return items.reduce((sum, item) => sum + item.monthlyAmount, 0);
}

export function sumAmountMonthly(items: ReadonlyArray<{ amountMonthly: number }>): number {
  return items.reduce((sum, item) => sum + item.amountMonthly, 0);
}

export function sumGrouped(items: ReadonlyArray<{ groupId: string; monthlyAmount: number }>): number {
  // Current state shape stores grouped data as flat arrays with groupId.
  // For totals, we intentionally ignore grouping and just sum amounts.
  return items.reduce((sum, item) => sum + item.monthlyAmount, 0);
}

function sumBalances(items: ReadonlyArray<{ groupId: string; balance: number }>): number {
  return items.reduce((sum, item) => sum + item.balance, 0);
}

// ----- Cashflow selectors
export function selectGrossIncome(state: SnapshotState): number {
  return sumFlat(state.grossIncomeItems);
}

export function selectPension(state: SnapshotState): number {
  // Pension contributions are now stored as assetContributions with contributionType === 'preTax'
  return state.assetContributions
    .filter(c => c.contributionType === 'preTax')
    .reduce((sum, c) => sum + c.amountMonthly, 0);
}

export function selectNetIncome(state: SnapshotState): number {
  return sumFlat(state.netIncomeItems);
}

export function selectExpenses(state: SnapshotState): number {
  // Filter to active expenses only
  const activeExpenses = state.expenses.filter(e => e.isActive !== false);
  return sumGrouped(activeExpenses);
}

function isLoanLiability(x: SnapshotState['liabilities'][number]): x is SnapshotState['liabilities'][number] & {
  kind: 'loan';
  annualInterestRatePct: number;
  remainingTermYears: number;
} {
  return (
    x.kind === 'loan' &&
    typeof x.annualInterestRatePct === 'number' &&
    Number.isFinite(x.annualInterestRatePct) &&
    typeof x.remainingTermYears === 'number' &&
    Number.isFinite(x.remainingTermYears) &&
    x.remainingTermYears >= 1
  );
}

export function selectLoanInterestExpense(state: SnapshotState): number {
  // Snapshot is point-in-time: derive the current-month interest on loan balances.
  // This is an expense (consumption of cash) but is NOT a loan payment.
  // Only derive from active liabilities
  let total = 0;
  for (const liab of state.liabilities) {
    if (!isLoanLiability(liab)) continue;
    if (liab.isActive === false) continue; // Skip inactive liabilities
    const init = initLoan({
      balance: liab.balance,
      annualInterestRatePct: liab.annualInterestRatePct,
      remainingTermYears: liab.remainingTermYears,
    });
    const month = stepLoanMonth({ balance: liab.balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate });
    total += month.interest;
  }
  return total;
}

export function selectLoanPrincipalReduction(state: SnapshotState): number {
  // Snapshot is point-in-time: derive the current-month principal portion of the loan payment.
  // This is a real cash outflow, but NOT an expense; it belongs in Liability Reduction.
  // Only derive from active liabilities
  let total = 0;
  for (const liab of state.liabilities) {
    if (!isLoanLiability(liab)) continue;
    if (liab.isActive === false) continue; // Skip inactive liabilities
    const init = initLoan({
      balance: liab.balance,
      annualInterestRatePct: liab.annualInterestRatePct,
      remainingTermYears: liab.remainingTermYears,
    });
    const month = stepLoanMonth({ balance: liab.balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate });
    total += month.principal;
  }
  return total;
}

export type LoanDerivedRow = {
  liabilityId: string;
  name: string;
  monthlyInterest: number;
  monthlyPrincipal: number;
};

export function selectLoanDerivedRows(state: SnapshotState): LoanDerivedRow[] {
  const rows: LoanDerivedRow[] = [];
  for (const liab of state.liabilities) {
    if (!isLoanLiability(liab)) continue;
    if (liab.isActive === false) continue; // Skip inactive liabilities
    const init = initLoan({
      balance: liab.balance,
      annualInterestRatePct: liab.annualInterestRatePct,
      remainingTermYears: liab.remainingTermYears,
    });
    const month = stepLoanMonth({ balance: liab.balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate });
    rows.push({
      liabilityId: liab.id,
      name: liab.name,
      monthlyInterest: month.interest,
      monthlyPrincipal: month.principal,
    });
  }
  return rows;
}

export function selectSnapshotExpenses(state: SnapshotState): number {
  // Snapshot Expenses = consumption expenses + full scheduled mortgage payment (interest + scheduled principal).
  // Mortgage payments are treated as expenses; overpayments are discretionary liability reductions.
  //
  // We support two representations:
  // - Legacy: loan payment components are derived virtually from liabilities (not stored as expense items)
  // - New: loan payment components are materialised into state.expenses as `loan-interest:${liabilityId}` and `loan-principal:${liabilityId}` (Derived)
  //
  // To avoid double counting during migration or partial state, only add derived payment components for
  // loans that do NOT already have materialised items.
  // Only count active expenses
  const activeExpenses = state.expenses.filter(e => e.isActive !== false);
  const base = activeExpenses.reduce((sum, item) => sum + item.monthlyAmount, 0);
  const hasInterestItem = new Set(activeExpenses.map(e => e.id).filter(id => id.startsWith('loan-interest:')));
  const hasPrincipalItem = new Set(activeExpenses.map(e => e.id).filter(id => id.startsWith('loan-principal:')));
  let missingDerivedInterest = 0;
  let missingDerivedPrincipal = 0;
  for (const row of selectLoanDerivedRows(state)) {
    const interestId = `loan-interest:${row.liabilityId}`;
    const principalId = `loan-principal:${row.liabilityId}`;
    if (!hasInterestItem.has(interestId)) {
      missingDerivedInterest += row.monthlyInterest;
    }
    // Scheduled principal is part of expenses (full mortgage payment)
    if (!hasPrincipalItem.has(principalId)) {
      missingDerivedPrincipal += row.monthlyPrincipal;
    }
  }
  return base + missingDerivedInterest + missingDerivedPrincipal;
}

export function selectAssetContributions(state: SnapshotState): number {
  // Only count postTax contributions (exclude preTax/pension contributions)
  // PreTax contributions come from gross income, not from available cash
  return state.assetContributions
    .filter(c => c.contributionType !== 'preTax')
    .reduce((sum, c) => sum + c.amountMonthly, 0);
}

export function selectLiabilityReduction(state: SnapshotState): number {
  return sumFlat(state.liabilityReductions);
}

export function selectSnapshotLiabilityReduction(state: SnapshotState): number {
  // Snapshot Liability Reduction = manual other debt reduction + overpayments only.
  // Scheduled mortgage principal is NOT included here (it's treated as an expense).
  // Mortgage payments are treated as expenses; overpayments are discretionary liability reductions.
  //
  // We support two representations:
  // - Legacy: overpayments are stored in state.liabilityReductions
  // - New: overpayments may be materialised into state.liabilityReductions as `loan-overpayment:${liabilityId}` (Derived)
  //
  // DEFENSIVE GUARDRAIL: Explicitly exclude scheduled principal entries (loan-principal:*).
  // This protects against legacy state and future regressions.
  // Scheduled principal belongs in expenses, never in liability reduction.
  const base = selectLiabilityReduction(state);
  // Filter out any loan-principal items (scheduled principal is in expenses, not liability reduction)
  const filtered = state.liabilityReductions
    .filter(item => !item.id.startsWith('loan-principal:'))
    .reduce((sum, item) => sum + (Number.isFinite(item.monthlyAmount) ? Math.max(0, item.monthlyAmount) : 0), 0);
  return filtered;
}

export function selectAvailableCash(state: SnapshotState): number {
  // availableCash = netIncome − expenses
  return selectNetIncome(state) - selectSnapshotExpenses(state);
}

/**
 * Selects monthly surplus (FLOW concept).
 * 
 * FLOW vs STOCK semantics:
 * - FLOW: monthlySurplus = availableCash − assetContributions − liabilityReduction
 *   This is a pure cashflow concept computed ONLY from cashflow inputs:
 *   - availableCash (netIncome - expenses)
 *   - assetContributions (postTax contributions only)
 *   - liabilityReduction (manual debt reduction + overpayments)
 * - STOCK: SYSTEM_CASH.balance represents accumulated cash balance (asset state)
 * 
 * MUST NOT reference SYSTEM_CASH, asset balances, or projection logic.
 * This selector computes FLOW only.
 */
export function selectMonthlySurplus(state: SnapshotState): number {
  // monthlySurplus = availableCash − assetContributions − liabilityReduction
  // This is a pure cashflow concept computed ONLY from cashflow inputs:
  //   - availableCash (netIncome - expenses)
  //   - assetContributions (postTax contributions only)
  //   - liabilityReduction (manual debt reduction + overpayments)
  // MUST NOT reference SYSTEM_CASH, asset balances, or projection logic
  const availableCash = selectAvailableCash(state);
  const assetContributions = selectAssetContributions(state);
  const liabilityReduction = selectSnapshotLiabilityReduction(state);
  const monthlySurplus = availableCash - assetContributions - liabilityReduction;

  if (!Number.isFinite(monthlySurplus)) {
    if (__DEV__) {
      throw new Error(
        `[monthlySurplus] Non-finite monthlySurplus. availableCash=${availableCash}, assetContributions=${assetContributions}, liabilityReduction=${liabilityReduction}`
      );
    }
    console.error('[monthlySurplus] Non-finite monthlySurplus, defaulting to 0');
    return 0;
  }

  return monthlySurplus;
}

/**
 * Selects monthly surplus adjusted for active FLOW scenario (display-only).
 * 
 * FLOW vs STOCK semantics:
 * - FLOW scenarios (FLOW_TO_ASSET, FLOW_TO_DEBT) represent monthly cashflow changes.
 * - When a FLOW scenario is active, the displayed monthly surplus is reduced by the scenario amount.
 * - This shows what monthly surplus would be if the scenario were applied.
 * - Cash balance (STOCK) is NOT affected by this selector (it remains unchanged).
 * 
 * This is a display-only selector for UI purposes. It does not mutate state.
 * 
 * @param state Snapshot state
 * @param activeScenario Optional active scenario (FLOW_TO_ASSET or FLOW_TO_DEBT)
 * @returns Monthly surplus adjusted for active scenario, or baseline monthly surplus if no scenario
 */
export function selectMonthlySurplusWithScenario(state: SnapshotState, activeScenario?: Scenario): number {
  const baselineSurplus = selectMonthlySurplus(state);
  
  // If no active scenario, return baseline
  if (!activeScenario) {
    return baselineSurplus;
  }
  
  // For FLOW scenarios, subtract the scenario amount from monthly surplus
  // This shows what monthly surplus would be if the scenario were applied
  if (activeScenario.kind === 'FLOW_TO_ASSET' || activeScenario.kind === 'FLOW_TO_DEBT') {
    const adjustedSurplus = baselineSurplus - activeScenario.amountMonthly;
    // Clamp to 0 minimum (surplus cannot go negative in display)
    return Math.max(0, adjustedSurplus);
  }
  
  // Unknown scenario kind, return baseline
  return baselineSurplus;
}

// Deductions (used across Snapshot + detail explanation screens)
export function selectDeductions(state: SnapshotState): number {
  // Other Deductions = Gross − Pension − Net (cannot be negative)
  return Math.max(0, selectGrossIncome(state) - selectPension(state) - selectNetIncome(state));
}

// ----- Balance sheet selectors
export function selectAssets(state: SnapshotState): number {
  // Only count active assets
  const activeAssets = state.assets.filter(a => a.isActive !== false);
  return sumBalances(activeAssets);
}

export function selectLiabilities(state: SnapshotState): number {
  // Only count active liabilities
  const activeLiabilities = state.liabilities.filter(l => l.isActive !== false);
  return sumBalances(activeLiabilities);
}

export function selectNonLoanLiabilitiesTotal(state: SnapshotState): number {
  let total = 0;
  for (const liab of state.liabilities) {
    if (liab.kind === 'loan') continue;
    if (liab.isActive === false) continue; // Skip inactive liabilities
    total += liab.balance;
  }
  return total;
}

export function selectLoanLiabilitiesForProjection(state: SnapshotState): Array<{
  balance: number;
  annualInterestRatePct: number;
  remainingTermYears: number;
}> {
  const out: Array<{ balance: number; annualInterestRatePct: number; remainingTermYears: number }> = [];
  for (const liab of state.liabilities) {
    if (!isLoanLiability(liab)) continue;
    out.push({
      balance: liab.balance,
      annualInterestRatePct: liab.annualInterestRatePct,
      remainingTermYears: liab.remainingTermYears,
    });
  }
  return out;
}

export function selectNetWorth(state: SnapshotState): number {
  return selectAssets(state) - selectLiabilities(state);
}

// ----- Aggregate selector (Snapshot screen)
export function selectSnapshotTotals(state: SnapshotState): {
  grossIncome: number;
  pension: number;
  deductions: number;
  netIncome: number;
  expenses: number;
  availableCash: number;
  assetContributions: number;
  liabilityReduction: number;
  monthlySurplus: number;
  assets: number;
  liabilities: number;
  netWorth: number;
} {
  const grossIncome = selectGrossIncome(state);
  const pension = selectPension(state);
  const deductions = selectDeductions(state);
  const netIncome = selectNetIncome(state);
  const expenses = selectSnapshotExpenses(state);
  const availableCash = netIncome - expenses;
  const assetContributions = selectAssetContributions(state);
  const liabilityReduction = selectSnapshotLiabilityReduction(state);
  const monthlySurplus = selectMonthlySurplus(state);
  const assets = selectAssets(state);
  const liabilities = selectLiabilities(state);
  const netWorth = assets - liabilities;

  return {
    grossIncome,
    pension,
    deductions,
    netIncome,
    expenses,
    availableCash,
    assetContributions,
    liabilityReduction,
    monthlySurplus,
    assets,
    liabilities,
    netWorth,
  };
}


