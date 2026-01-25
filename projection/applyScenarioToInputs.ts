// Scenario application to projection inputs (Phase 2)
//
// Applies a single scenario to baseline ProjectionEngineInputs by merging deltas.
// Pure function - no side effects, no mutation.
//
// Rules:
// - If scenario is undefined, return baseline unchanged (same reference allowed).
// - Merge deltas into baseline inputs (assetContributionsMonthly, liabilityOverpaymentsMonthly).
// - If matching assetId/liabilityId exists, increase the amount.
// - If not, append a new entry.
// - FLOW_TO_ASSET scenarios are validated for affordability if snapshotState is provided.

import type { ProjectionEngineInputs } from '../projectionEngine';
import type { Scenario } from '../domain/scenario/types';
import type { SnapshotState } from '../types';
import { BASELINE_SCENARIO_ID } from '../domain/scenario/types';
import { scenarioToDelta } from '../domain/scenario/delta';
import { isScenarioTargetValid } from '../domain/scenario/validation';
import { SYSTEM_CASH_ID, UI_TOLERANCE } from '../constants';
import { selectMonthlySurplus } from '../selectors';

/**
 * Merges asset contribution deltas into baseline contributions.
 * - If assetId exists in baseline, increases amountMonthly.
 * - If not, appends new entry.
 * - If delta is empty/undefined, returns baseline unchanged.
 */
function mergeAssetContributions(
  baseline: Array<{ assetId: string; amountMonthly: number }>,
  delta: Array<{ assetId: string; amountMonthly: number }> | undefined
): Array<{ assetId: string; amountMonthly: number }> {
  if (!delta || delta.length === 0) {
    return baseline;
  }

  const result = [...baseline];

  for (const deltaEntry of delta) {
    const existingIndex = result.findIndex(c => c.assetId === deltaEntry.assetId);
    if (existingIndex >= 0) {
      // Increase existing contribution
      result[existingIndex] = {
        assetId: result[existingIndex].assetId,
        amountMonthly: result[existingIndex].amountMonthly + deltaEntry.amountMonthly,
      };
    } else {
      // Append new contribution
      result.push({
        assetId: deltaEntry.assetId,
        amountMonthly: deltaEntry.amountMonthly,
      });
    }
  }

  return result;
}

/**
 * Merges liability overpayment deltas into baseline overpayments.
 * - Handles undefined baseline (creates new array).
 * - If liabilityId exists in baseline, increases amountMonthly.
 * - If not, appends new entry.
 * - If delta is empty/undefined, returns baseline unchanged (including undefined).
 */
function mergeLiabilityOverpayments(
  baseline: Array<{ liabilityId: string; amountMonthly: number }> | undefined,
  delta: Array<{ liabilityId: string; amountMonthly: number }> | undefined
): Array<{ liabilityId: string; amountMonthly: number }> | undefined {
  if (!delta || delta.length === 0) {
    return baseline;
  }

  const baselineArray = baseline ?? [];
  const result = [...baselineArray];

  for (const deltaEntry of delta) {
    const existingIndex = result.findIndex(o => o.liabilityId === deltaEntry.liabilityId);
    if (existingIndex >= 0) {
      // Increase existing overpayment
      result[existingIndex] = {
        liabilityId: result[existingIndex].liabilityId,
        amountMonthly: result[existingIndex].amountMonthly + deltaEntry.amountMonthly,
      };
    } else {
      // Append new overpayment
      result.push({
        liabilityId: deltaEntry.liabilityId,
        amountMonthly: deltaEntry.amountMonthly,
      });
    }
  }

  return result;
}

/**
 * Applies a scenario to baseline projection inputs by merging deltas.
 *
 * @param baseline - Baseline projection inputs (must be valid and complete)
 * @param scenario - Optional scenario to apply (if undefined, returns baseline unchanged)
 * @param snapshotState - Optional snapshot state for affordability validation (FLOW_TO_ASSET scenarios)
 * @returns New ProjectionEngineInputs with scenario deltas merged (or baseline if no scenario or invalid)
 */
export function applyScenarioToProjectionInputs(
  baseline: ProjectionEngineInputs,
  scenario?: Scenario,
  snapshotState?: SnapshotState
): ProjectionEngineInputs {
  // Early return: if no scenario, return baseline unchanged (same reference allowed)
  if (!scenario) {
    return baseline;
  }

  // Hard invariant: baseline scenario has no effect (return baseline unchanged)
  if (scenario.id === BASELINE_SCENARIO_ID) {
    return baseline;
  }

  // Validate scenario target exists in projection inputs (safety check)
  // If target doesn't exist, fallback to baseline to prevent invalid projections
  const isValid = isScenarioTargetValid(
    scenario,
    baseline.assetsToday,
    baseline.liabilitiesToday
  );
  if (!isValid) {
    console.warn(`Scenario ${scenario.id} references non-existent target, falling back to baseline`);
    return baseline;
  }

  // Phase 2.1: Affordability validation for FLOW_TO_ASSET scenarios
  // A FLOW_TO_ASSET scenario is unaffordable if applying it would make monthly surplus negative beyond tolerance.
  // Validation is flow-only: Snapshot and SYSTEM_CASH are not mutated.
  if (scenario.kind === 'FLOW_TO_ASSET' && snapshotState) {
    const baselineSurplus = selectMonthlySurplus(snapshotState);
    const surplusAfter = baselineSurplus - scenario.amountMonthly;
    
    // If surplusAfter < -UI_TOLERANCE, scenario is unaffordable → return baseline unchanged (fallback)
    // Equality at boundary (=== -UI_TOLERANCE) is allowed
    if (surplusAfter < -UI_TOLERANCE) {
      if (__DEV__) {
        console.warn(
          `[FLOW_TO_ASSET Affordability] Scenario ${scenario.id} is unaffordable. ` +
          `Baseline surplus: ${baselineSurplus}, scenario amount: ${scenario.amountMonthly}, ` +
          `surplus after: ${surplusAfter} < -${UI_TOLERANCE}, falling back to baseline`
        );
      }
      return baseline;
    }
  }

  // Get delta from scenario domain
  const delta = scenarioToDelta(scenario);

  // DEV guardrail: Assert FLOW scenarios do not mutate cash balance
  // Cash is STOCK-only - FLOW scenarios work through contribution deltas to other assets/liabilities
  if (__DEV__) {
    if (delta.assetContributionsDelta) {
      const cashContribution = delta.assetContributionsDelta.find(c => c.assetId === SYSTEM_CASH_ID);
      if (cashContribution && cashContribution.amountMonthly > 0) {
        console.error(
          `[FLOW Scenario Guardrail] FLOW scenario ${scenario.id} attempts to add contribution to SYSTEM_CASH. ` +
          `FLOW scenarios must not mutate cash balance - cash is STOCK-only. ` +
          `FLOW scenarios work through contribution deltas to other assets/liabilities only.`
        );
      }
    }
  }

  // SCENARIO BOUNDARY: Merge FLOW scenario deltas into baseline contributions
  // 
  // FLOW vs STOCK semantics:
  // - FLOW scenarios (FLOW_TO_ASSET, FLOW_TO_DEBT) represent monthly cashflow changes.
  // - FLOW scenarios work directly through contribution deltas (no SYSTEM_CASH transfers).
  // - FLOW scenarios must NOT mutate cash balance - cash is STOCK-only.
  // - STOCK: SYSTEM_CASH.balance represents accumulated cash balance (asset state, unchanged).
  // 
  // FLOW_TO_ASSET: delta added to assetContributionsMonthly (target must not be SYSTEM_CASH)
  // FLOW_TO_DEBT: delta added to liabilityOverpaymentsMonthly
  const mergedAssetContributions = mergeAssetContributions(
    baseline.assetContributionsMonthly,
    delta.assetContributionsDelta
  );

  // Merge liability overpayments
  const mergedLiabilityOverpayments = mergeLiabilityOverpayments(
    baseline.liabilityOverpaymentsMonthly,
    delta.liabilityOverpaymentsDelta
  );

  // Return new object with merged values (immutable)
  // CRITICAL: Do NOT modify currentAge or endAge - these come from baseline projection settings
  // Only adjust: asset contributions, debt overpayments
  // Projection horizon (currentAge, endAge) MUST be preserved from baseline
  // FLOW scenarios no longer use scenarioTransfers - they work through contribution deltas only
  return {
    ...baseline,
    assetContributionsMonthly: mergedAssetContributions,
    liabilityOverpaymentsMonthly: mergedLiabilityOverpayments,
    // scenarioTransfers is not set (undefined) for FLOW scenarios
    // currentAge and endAge are preserved from baseline via spread operator
  };
}
