// Scenario delta mapping (Phase 1)
//
// Converts scenarios to projection input deltas.
// Pure mapping only - does not apply deltas to baseline inputs.
//
// Cashflow redirection is implicit in Phase 1:
// - Scenarios redirect from "available cash" (remaining cash after baseline allocations)
// - Future: explicit source modeling (income increase, expense reduction, etc.)

import type {
  Scenario,
  FlowToAssetScenario,
  FlowToDebtScenario,
  ChangeRetirementAgeScenario,
  ReduceExpensesScenario,
  ChangeAssetGrowthRateScenario,
  SavingsWhatIfScenario,
} from './types';
import { BASELINE_SCENARIO_ID } from './types';

export type ProjectionInputDelta = {
  assetContributionsDelta?: Array<{ assetId: string; amountMonthly: number }>;
  liabilityOverpaymentsDelta?: Array<{ liabilityId: string; amountMonthly: number }>;
  // CHANGE_RETIREMENT_AGE: override (not additive) — replaces retirementAge in ProjectionEngineInputs
  retirementAgeOverride?: number;
  // REDUCE_EXPENSES: additive delta applied to monthlyExpensesReal (negative = spending less)
  monthlyExpensesRealDelta?: number;
  // CHANGE_ASSET_GROWTH_RATE: per-asset override of annualGrowthRatePct
  assetGrowthRateOverrides?: Array<{ assetId: string; annualGrowthRatePct: number }>;
};

export function scenarioToDelta(s: Scenario): ProjectionInputDelta {
  // Baseline scenario has no deltas (hard invariant)
  if (s.id === BASELINE_SCENARIO_ID) {
    return {};
  }

  if (s.kind === 'FLOW_TO_ASSET') {
    const flowToAsset = s as FlowToAssetScenario;
    return {
      assetContributionsDelta: [
        {
          assetId: flowToAsset.assetId,
          amountMonthly: flowToAsset.amountMonthly,
        },
      ],
    };
  }

  if (s.kind === 'FLOW_TO_DEBT') {
    const flowToDebt = s as FlowToDebtScenario;
    return {
      liabilityOverpaymentsDelta: [
        {
          liabilityId: flowToDebt.liabilityId,
          amountMonthly: flowToDebt.amountMonthly,
        },
      ],
    };
  }

  if (s.kind === 'CHANGE_RETIREMENT_AGE') {
    const changeAge = s as ChangeRetirementAgeScenario;
    return {
      retirementAgeOverride: changeAge.retirementAge,
    };
  }

  if (s.kind === 'REDUCE_EXPENSES') {
    const reduceExpenses = s as ReduceExpensesScenario;
    // reductionMonthly > 0 means spending less, so delta is negative
    return {
      monthlyExpensesRealDelta: -reduceExpenses.reductionMonthly,
    };
  }

  if (s.kind === 'CHANGE_ASSET_GROWTH_RATE') {
    const changeGrowth = s as ChangeAssetGrowthRateScenario;
    return {
      assetGrowthRateOverrides: [
        {
          assetId: changeGrowth.assetId,
          annualGrowthRatePct: changeGrowth.newAnnualGrowthRatePct,
        },
      ],
    };
  }

  if (s.kind === 'SAVINGS_WHAT_IF') {
    const compound = s as SavingsWhatIfScenario;
    return {
      assetContributionsDelta: [
        {
          assetId: compound.assetId,
          amountMonthly: compound.contributionMonthly,
        },
      ],
      assetGrowthRateOverrides: [
        {
          assetId: compound.assetId,
          annualGrowthRatePct: compound.newAnnualGrowthRatePct,
        },
      ],
    };
  }

  // Exhaustive check (TypeScript will error if a new kind is added without handling)
  const _exhaustive: never = s;
  return {};
}
