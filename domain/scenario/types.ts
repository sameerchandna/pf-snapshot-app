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

export type ScenarioKind = 'FLOW_TO_ASSET' | 'FLOW_TO_DEBT';

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

export type Scenario = FlowToAssetScenario | FlowToDebtScenario;

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
