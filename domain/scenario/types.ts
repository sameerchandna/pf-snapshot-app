// Scenario domain model (Phase 1)
//
// Core principles:
// - Baseline is implicit (absence of scenario). No BaselineScenario type.
// - Scenarios are deltas relative to baseline.
// - Use discriminated unions via `kind` for type safety.
// - Cashflow source is IMPLICIT in Phase 1: scenarios redirect from "available cash".
//   Future: explicit source modeling (income increase, expense reduction, etc.)

export type ScenarioId = string;

/**
 * Baseline scenario ID constant.
 * Baseline is a hard invariant: it always exists and cannot be edited, renamed, or deleted.
 */
export const BASELINE_SCENARIO_ID: ScenarioId = '__BASELINE__';

export type ScenarioKind =
  | 'FLOW_TO_ASSET'
  | 'FLOW_TO_DEBT'
  | 'CHANGE_RETIREMENT_AGE'
  | 'REDUCE_EXPENSES'
  | 'CHANGE_ASSET_GROWTH_RATE'
  | 'SAVINGS_WHAT_IF'
  | 'MORTGAGE_WHAT_IF';

export interface ScenarioBase {
  id: ScenarioId;
  name: string;
  kind: ScenarioKind;
  description?: string;
}

export interface FlowToAssetScenario extends ScenarioBase {
  kind: 'FLOW_TO_ASSET';
  assetId: string;
  amountMonthly: number;
}

export interface FlowToDebtScenario extends ScenarioBase {
  kind: 'FLOW_TO_DEBT';
  liabilityId: string;
  amountMonthly: number;
}

export interface ChangeRetirementAgeScenario extends ScenarioBase {
  kind: 'CHANGE_RETIREMENT_AGE';
  retirementAge: number; // new retirement age (integer, >= 1)
}

export interface ReduceExpensesScenario extends ScenarioBase {
  kind: 'REDUCE_EXPENSES';
  reductionMonthly: number; // monthly expense reduction in today's money (> 0 means spending less)
}

export interface ChangeAssetGrowthRateScenario extends ScenarioBase {
  kind: 'CHANGE_ASSET_GROWTH_RATE';
  assetId: string;
  newAnnualGrowthRatePct: number; // new growth rate in percent (e.g. 7.0 = 7%); must be finite
}

export interface SavingsWhatIfScenario extends ScenarioBase {
  kind: 'SAVINGS_WHAT_IF';
  assetId: string;
  contributionMonthly: number; // extra monthly contribution (> 0)
  newAnnualGrowthRatePct: number; // growth rate override in percent (e.g. 7.0 = 7%)
}

export interface MortgageWhatIfScenario extends ScenarioBase {
  kind: 'MORTGAGE_WHAT_IF';
  liabilityId: string;
  overpaymentMonthly: number; // extra monthly payment (>= 0; can be 0 if only adjusting rate/term)
  newAnnualInterestRatePct: number; // rate override in percent (e.g. 4.5 = 4.5%)
  newRemainingTermYears: number; // term override in years (integer, >= 1)
}

export type Scenario =
  | FlowToAssetScenario
  | FlowToDebtScenario
  | ChangeRetirementAgeScenario
  | ReduceExpensesScenario
  | ChangeAssetGrowthRateScenario
  | SavingsWhatIfScenario
  | MortgageWhatIfScenario;

/**
 * Creates the baseline scenario object.
 * Baseline is a hard invariant: it always exists and cannot be edited, renamed, or deleted.
 * 
 * Baseline uses FLOW_TO_ASSET kind with dummy values (it has no effect on projections).
 */
export function createBaselineScenario(): FlowToAssetScenario {
  return {
    id: BASELINE_SCENARIO_ID,
    name: 'Baseline',
    kind: 'FLOW_TO_ASSET',
    assetId: '', // Dummy value (baseline has no effect)
    amountMonthly: 0.01, // Minimal value to pass validation (baseline has no effect)
  };
}
