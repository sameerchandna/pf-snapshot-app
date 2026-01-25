// Scenario delta mapping (Phase 1)
//
// Converts scenarios to projection input deltas.
// Pure mapping only - does not apply deltas to baseline inputs.
//
// Cashflow redirection is implicit in Phase 1:
// - Scenarios redirect from "available cash" (remaining cash after baseline allocations)
// - Future: explicit source modeling (income increase, expense reduction, etc.)

import type { Scenario, FlowToAssetScenario, FlowToDebtScenario } from './types';
import { BASELINE_SCENARIO_ID } from './types';

export type ProjectionInputDelta = {
  assetContributionsDelta?: Array<{ assetId: string; amountMonthly: number }>;
  liabilityOverpaymentsDelta?: Array<{ liabilityId: string; amountMonthly: number }>;
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

  // Exhaustive check (TypeScript will error if a new kind is added without handling)
  const _exhaustive: never = s;
  return {};
}
