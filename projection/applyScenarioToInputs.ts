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
// - FLOW_TO_ASSET scenarios are validated for affordability if snapshotState is provided (Phase 2.1).
// - FLOW_TO_DEBT scenarios are validated for affordability and paid-off target if snapshotState is provided (Phase 2.2).
// - Scenario delta reconciliation is asserted in __DEV__ mode (Phase 2.3).

import type { ProjectionEngineInputs } from '../engines/projectionEngine';
import type { Scenario } from '../domain/scenario/types';
import type { SnapshotState } from '../types';
import { BASELINE_SCENARIO_ID } from '../domain/scenario/types';
import { scenarioToDelta } from '../domain/scenario/delta';
import { isScenarioTargetValid } from '../domain/scenario/validation';
import { UI_TOLERANCE } from '../constants';
import { selectMonthlySurplus } from '../engines/selectors';

/**
 * Phase 2.3: Reconciliation helper functions
 */

/**
 * Checks if two GBP values are approximately equal within UI_TOLERANCE.
 */
function approxEqualGBP(a: number, b: number): boolean {
  return Math.abs(a - b) <= UI_TOLERANCE;
}

/**
 * Converts an array of contribution/overpayment entries to a map by ID.
 * @param array - Array of entries with assetId or liabilityId and amountMonthly
 * @param keyField - 'assetId' or 'liabilityId' to use as map key
 * @returns Map from ID to amountMonthly value
 */
function arrayToMap(
  array: Array<{ assetId?: string; liabilityId?: string; amountMonthly: number }>,
  keyField: 'assetId' | 'liabilityId'
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of array) {
    const key = keyField === 'assetId' 
      ? (entry as { assetId: string }).assetId
      : (entry as { liabilityId: string }).liabilityId;
    if (key) {
      map.set(key, entry.amountMonthly);
    }
  }
  return map;
}

/**
 * Finds entries that changed beyond tolerance between two maps.
 * Includes removals (entries that exist in before but not in after).
 * @param beforeMap - Map of before values
 * @param afterMap - Map of after values
 * @returns Array of entries that changed beyond UI_TOLERANCE
 */
function diffMapGBP(
  beforeMap: Map<string, number>,
  afterMap: Map<string, number>
): Array<{ id: string; before: number; after: number; diff: number }> {
  const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const diffs: Array<{ id: string; before: number; after: number; diff: number }> = [];
  
  for (const key of allKeys) {
    const before = beforeMap.get(key) ?? 0;
    const after = afterMap.get(key) ?? 0;
    const diff = after - before;
    
    if (Math.abs(diff) > UI_TOLERANCE) {
      diffs.push({ id: key, before, after, diff });
    }
  }
  
  return diffs;
}

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
 * @param snapshotState - Optional snapshot state for affordability validation (FLOW_TO_ASSET and FLOW_TO_DEBT scenarios)
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

  // CHANGE_RETIREMENT_AGE, REDUCE_EXPENSES, CHANGE_ASSET_GROWTH_RATE: no affordability check needed
  // (these don't redirect cashflow, so surplus is unaffected)

  // MORTGAGE_WHAT_IF: affordability check on overpayment component only
  if (scenario.kind === 'MORTGAGE_WHAT_IF' && snapshotState && scenario.overpaymentMonthly > 0) {
    const baselineSurplus = selectMonthlySurplus(snapshotState);
    const surplusAfter = baselineSurplus - scenario.overpaymentMonthly;
    if (surplusAfter < -UI_TOLERANCE) {
      console.warn(
        `[MORTGAGE_WHAT_IF Affordability] Scenario ${scenario.id} is unaffordable. ` +
        `Baseline surplus: ${baselineSurplus}, overpayment: ${scenario.overpaymentMonthly}, ` +
        `surplus after: ${surplusAfter} < -${UI_TOLERANCE}, falling back to baseline`
      );
      return baseline;
    }
  }

  // SAVINGS_WHAT_IF: affordability check on the contribution component
  if (scenario.kind === 'SAVINGS_WHAT_IF' && snapshotState) {
    const baselineSurplus = selectMonthlySurplus(snapshotState);
    const surplusAfter = baselineSurplus - scenario.contributionMonthly;
    if (surplusAfter < -UI_TOLERANCE) {
      console.warn(
        `[SAVINGS_WHAT_IF Affordability] Scenario ${scenario.id} is unaffordable. ` +
        `Baseline surplus: ${baselineSurplus}, contribution: ${scenario.contributionMonthly}, ` +
        `surplus after: ${surplusAfter} < -${UI_TOLERANCE}, falling back to baseline`
      );
      return baseline;
    }
  }

  // Phase 2.1: Affordability validation for FLOW_TO_ASSET scenarios
  // A FLOW_TO_ASSET scenario is unaffordable if applying it would make monthly surplus negative beyond tolerance.
  if (scenario.kind === 'FLOW_TO_ASSET' && snapshotState) {
    const baselineSurplus = selectMonthlySurplus(snapshotState);
    const surplusAfter = baselineSurplus - scenario.amountMonthly;
    
    // If surplusAfter < -UI_TOLERANCE, scenario is unaffordable → return baseline unchanged (fallback)
    // Equality at boundary (=== -UI_TOLERANCE) is allowed
    if (surplusAfter < -UI_TOLERANCE) {
      // Log warning and return baseline unchanged (fallback behavior)
      // UI-level validation will show error message to user
      console.warn(
        `[FLOW_TO_ASSET Affordability] Scenario ${scenario.id} is unaffordable. ` +
        `Baseline surplus: ${baselineSurplus}, scenario amount: ${scenario.amountMonthly}, ` +
        `surplus after: ${surplusAfter} < -${UI_TOLERANCE}, falling back to baseline`
      );
      return baseline;
    }
  }

  // Phase 2.2: Affordability validation for FLOW_TO_DEBT scenarios
  // A FLOW_TO_DEBT scenario is unaffordable if applying it would make monthly surplus negative beyond tolerance.
  if (scenario.kind === 'FLOW_TO_DEBT' && snapshotState) {
    const baselineSurplus = selectMonthlySurplus(snapshotState);
    const surplusAfter = baselineSurplus - scenario.amountMonthly;
    
    // If surplusAfter < -UI_TOLERANCE, scenario is unaffordable → return baseline unchanged (fallback)
    // Equality at boundary (=== -UI_TOLERANCE) is allowed
    if (surplusAfter < -UI_TOLERANCE) {
      // Log warning and return baseline unchanged (fallback behavior)
      // UI-level validation will show error message to user
      console.warn(
        `[FLOW_TO_DEBT Affordability] Scenario ${scenario.id} is unaffordable. ` +
        `Baseline surplus: ${baselineSurplus}, scenario amount: ${scenario.amountMonthly}, ` +
        `surplus after: ${surplusAfter} < -${UI_TOLERANCE}, falling back to baseline`
      );
      return baseline;
    }
  }

  // Phase 2.2: Paid-off target guard for FLOW_TO_DEBT scenarios
  // A FLOW_TO_DEBT scenario is invalid if the target liability is already paid off at projection start.
  // Check if target liability's starting balance is effectively zero (<= UI_TOLERANCE).
  if (scenario.kind === 'FLOW_TO_DEBT') {
    // Find target liability in baseline projection inputs
    const targetLiability = baseline.liabilitiesToday.find(
      l => l.id === scenario.liabilityId
    );
    
    // Defensive check: if target not found, fallback to baseline
    // (This should not happen if isScenarioTargetValid passed, but defensive)
    if (!targetLiability) {
      if (__DEV__) {
        console.warn(
          `[FLOW_TO_DEBT Paid-Off Guard] Target liability ${scenario.liabilityId} not found in baseline inputs, ` +
          `falling back to baseline`
        );
      }
      return baseline;
    }
    
    // Check if starting balance is effectively zero (paid off)
    // Use UI_TOLERANCE as "effectively zero" threshold for GBP values
    if (targetLiability.balance <= UI_TOLERANCE) {
      if (__DEV__) {
        console.warn(
          `[FLOW_TO_DEBT Paid-Off Guard] Scenario ${scenario.id} target liability ${scenario.liabilityId} ` +
          `is already paid off (balance: ${targetLiability.balance} <= ${UI_TOLERANCE}), falling back to baseline`
        );
      }
      return baseline;
    }
  }

  // Paid-off target guard for MORTGAGE_WHAT_IF scenarios
  if (scenario.kind === 'MORTGAGE_WHAT_IF') {
    const targetLiability = baseline.liabilitiesToday.find(
      l => l.id === scenario.liabilityId
    );
    if (!targetLiability) {
      if (__DEV__) {
        console.warn(
          `[MORTGAGE_WHAT_IF Paid-Off Guard] Target liability ${scenario.liabilityId} not found, falling back to baseline`
        );
      }
      return baseline;
    }
    if (targetLiability.balance <= UI_TOLERANCE) {
      if (__DEV__) {
        console.warn(
          `[MORTGAGE_WHAT_IF Paid-Off Guard] Scenario ${scenario.id} target liability ${scenario.liabilityId} ` +
          `is already paid off (balance: ${targetLiability.balance} <= ${UI_TOLERANCE}), falling back to baseline`
        );
      }
      return baseline;
    }
  }

  // Get delta from scenario domain
  const delta = scenarioToDelta(scenario);

  // SCENARIO BOUNDARY: Merge FLOW scenario deltas into baseline contributions
  //
  // FLOW_TO_ASSET: delta added to assetContributionsMonthly
  // FLOW_TO_DEBT: delta added to liabilityOverpaymentsMonthly
  const mergedAssetContributions = mergeAssetContributions(
    baseline.assetContributionsMonthly,
    delta.assetContributionsDelta
  );

  // Phase 3.1: Deterministic ordering - sort merged contributions by assetId, then amountMonthly
  mergedAssetContributions.sort((a, b) => {
    const idCompare = a.assetId.localeCompare(b.assetId);
    if (idCompare !== 0) return idCompare;
    return a.amountMonthly - b.amountMonthly;
  });

  // INCOME_CHANGE: scale all contributions proportionally by income delta
  const scaledAssetContributions = (() => {
    if (delta.incomeChangeDelta === undefined) {
      return mergedAssetContributions;
    }
    const totalContribs = mergedAssetContributions.reduce((s, c) => s + c.amountMonthly, 0);
    if (totalContribs <= 0) return mergedAssetContributions;
    const ratio = Math.max(0, 1 - delta.incomeChangeDelta / totalContribs);
    return mergedAssetContributions.map(c => ({ ...c, amountMonthly: c.amountMonthly * ratio }));
  })();

  // Merge liability overpayments
  const mergedLiabilityOverpayments = mergeLiabilityOverpayments(
    baseline.liabilityOverpaymentsMonthly,
    delta.liabilityOverpaymentsDelta
  );

  // Phase 3.1: Deterministic ordering - sort merged overpayments by liabilityId, then amountMonthly
  if (mergedLiabilityOverpayments) {
    mergedLiabilityOverpayments.sort((a, b) => {
      const idCompare = a.liabilityId.localeCompare(b.liabilityId);
      if (idCompare !== 0) return idCompare;
      return a.amountMonthly - b.amountMonthly;
    });
  }

  // Apply CHANGE_RETIREMENT_AGE override
  const mergedRetirementAge =
    delta.retirementAgeOverride !== undefined ? delta.retirementAgeOverride : baseline.retirementAge;

  // Apply REDUCE_EXPENSES delta (clamp to 0 — expenses cannot go negative)
  const mergedMonthlyExpensesReal =
    delta.monthlyExpensesRealDelta !== undefined
      ? Math.max(0, (baseline.monthlyExpensesReal ?? 0) + delta.monthlyExpensesRealDelta)
      : baseline.monthlyExpensesReal;

  // Apply CHANGE_ASSET_GROWTH_RATE overrides — only mutate matching assets
  const mergedAssetsToday =
    delta.assetGrowthRateOverrides && delta.assetGrowthRateOverrides.length > 0
      ? baseline.assetsToday.map(asset => {
          const override = delta.assetGrowthRateOverrides!.find(o => o.assetId === asset.id);
          return override ? { ...asset, annualGrowthRatePct: override.annualGrowthRatePct } : asset;
        })
      : baseline.assetsToday;

  // Apply MORTGAGE_WHAT_IF liability rate/term overrides — only mutate matching liabilities
  let mergedLiabilitiesToday = baseline.liabilitiesToday;
  if (delta.liabilityRateOverrides && delta.liabilityRateOverrides.length > 0) {
    mergedLiabilitiesToday = mergedLiabilitiesToday.map(liability => {
      const override = delta.liabilityRateOverrides!.find(o => o.liabilityId === liability.id);
      return override ? { ...liability, annualInterestRatePct: override.annualInterestRatePct } : liability;
    });
  }
  if (delta.liabilityTermOverrides && delta.liabilityTermOverrides.length > 0) {
    mergedLiabilitiesToday = mergedLiabilitiesToday.map(liability => {
      const override = delta.liabilityTermOverrides!.find(o => o.liabilityId === liability.id);
      return override ? { ...liability, remainingTermYears: override.remainingTermYears } : liability;
    });
  }

  // Construct scenario inputs with merged values
  const scenarioInputs: ProjectionEngineInputs = {
    ...baseline,
    assetsToday: mergedAssetsToday,
    liabilitiesToday: mergedLiabilitiesToday,
    assetContributionsMonthly: scaledAssetContributions,
    liabilityOverpaymentsMonthly: mergedLiabilityOverpayments,
    retirementAge: mergedRetirementAge,
    monthlyExpensesReal: mergedMonthlyExpensesReal,
    // scenarioTransfers is not set (undefined) for FLOW scenarios
    // currentAge and endAge are preserved from baseline via spread operator
  };

  // Phase 2.3: Reconciliation assertions (__DEV__ only)
  // Verify that scenario application matches scenario deltas within tolerance.
  // On mismatch, log diagnostics and fall back to baseline (safe).
  // CHANGE_RETIREMENT_AGE, REDUCE_EXPENSES, CHANGE_ASSET_GROWTH_RATE are overrides —
  // no delta reconciliation needed (no cashflow redirection occurs).
  if (__DEV__) {
    let reconciliationFailed = false;
    const warnings: string[] = [];

    if (scenario.kind === 'FLOW_TO_ASSET') {
      // FLOW_TO_ASSET: Assert assetContributionsMonthly delta matches scenario amount
      const beforeMap = arrayToMap(baseline.assetContributionsMonthly, 'assetId');
      const afterMap = arrayToMap(scenarioInputs.assetContributionsMonthly, 'assetId');
      
      const targetAssetId = scenario.assetId;
      const before = beforeMap.get(targetAssetId) ?? 0;
      const after = afterMap.get(targetAssetId) ?? 0;
      const actualDelta = after - before;
      const expectedDelta = scenario.amountMonthly;
      const deltaDiff = Math.abs(actualDelta - expectedDelta);
      
      // Assert target entry changed by expected amount
      if (deltaDiff > UI_TOLERANCE) {
        reconciliationFailed = true;
        warnings.push(
          `Target asset ${targetAssetId}: expected delta ${expectedDelta}, actual delta ${actualDelta}, difference ${deltaDiff}`
        );
      }
      
      // Assert no other entries changed beyond tolerance
      const unexpectedChanges = diffMapGBP(beforeMap, afterMap).filter(d => d.id !== targetAssetId);
      if (unexpectedChanges.length > 0) {
        reconciliationFailed = true;
        warnings.push(
          `Unexpected changes in other assets: ${unexpectedChanges.map(c => `${c.id}: ${c.before} → ${c.after} (diff: ${c.diff})`).join(', ')}`
        );
      }
    } else if (scenario.kind === 'FLOW_TO_DEBT') {
      // FLOW_TO_DEBT: Assert liabilityOverpaymentsMonthly delta matches scenario amount
      const beforeArray = baseline.liabilityOverpaymentsMonthly ?? [];
      const afterArray = scenarioInputs.liabilityOverpaymentsMonthly ?? [];
      
      const beforeMap = arrayToMap(beforeArray, 'liabilityId');
      const afterMap = arrayToMap(afterArray, 'liabilityId');
      
      const targetLiabilityId = scenario.liabilityId;
      const before = beforeMap.get(targetLiabilityId) ?? 0;
      const after = afterMap.get(targetLiabilityId) ?? 0;
      const actualDelta = after - before;
      const expectedDelta = scenario.amountMonthly;
      const deltaDiff = Math.abs(actualDelta - expectedDelta);
      
      // Assert target entry changed by expected amount
      if (deltaDiff > UI_TOLERANCE) {
        reconciliationFailed = true;
        warnings.push(
          `Target liability ${targetLiabilityId}: expected delta ${expectedDelta}, actual delta ${actualDelta}, difference ${deltaDiff}`
        );
      }
      
      // Assert no other entries changed beyond tolerance
      const unexpectedChanges = diffMapGBP(beforeMap, afterMap).filter(d => d.id !== targetLiabilityId);
      if (unexpectedChanges.length > 0) {
        reconciliationFailed = true;
        warnings.push(
          `Unexpected changes in other liabilities: ${unexpectedChanges.map(c => `${c.id}: ${c.before} → ${c.after} (diff: ${c.diff})`).join(', ')}`
        );
      }
    } else if (scenario.kind === 'SAVINGS_WHAT_IF') {
      // SAVINGS_WHAT_IF: Assert contribution delta matches
      const beforeMap = arrayToMap(baseline.assetContributionsMonthly, 'assetId');
      const afterMap = arrayToMap(scenarioInputs.assetContributionsMonthly, 'assetId');

      const targetAssetId = scenario.assetId;
      const before = beforeMap.get(targetAssetId) ?? 0;
      const after = afterMap.get(targetAssetId) ?? 0;
      const actualDelta = after - before;
      const expectedDelta = scenario.contributionMonthly;
      const deltaDiff = Math.abs(actualDelta - expectedDelta);

      if (deltaDiff > UI_TOLERANCE) {
        reconciliationFailed = true;
        warnings.push(
          `Target asset ${targetAssetId}: expected contribution delta ${expectedDelta}, actual ${actualDelta}, diff ${deltaDiff}`
        );
      }

      // Assert growth rate override was applied
      const targetAsset = scenarioInputs.assetsToday.find(a => a.id === targetAssetId);
      if (targetAsset && targetAsset.annualGrowthRatePct !== undefined && Math.abs(targetAsset.annualGrowthRatePct - scenario.newAnnualGrowthRatePct) > UI_TOLERANCE) {
        reconciliationFailed = true;
        warnings.push(
          `Target asset ${targetAssetId}: expected growth rate ${scenario.newAnnualGrowthRatePct}%, got ${targetAsset.annualGrowthRatePct}%`
        );
      }
    } else if (scenario.kind === 'MORTGAGE_WHAT_IF') {
      // MORTGAGE_WHAT_IF: Assert overpayment delta + rate/term overrides
      const targetLiabilityId = scenario.liabilityId;

      // Check overpayment delta (only when > 0)
      if (scenario.overpaymentMonthly > 0) {
        const beforeArray = baseline.liabilityOverpaymentsMonthly ?? [];
        const afterArray = scenarioInputs.liabilityOverpaymentsMonthly ?? [];
        const beforeMap = arrayToMap(beforeArray, 'liabilityId');
        const afterMap = arrayToMap(afterArray, 'liabilityId');
        const before = beforeMap.get(targetLiabilityId) ?? 0;
        const after = afterMap.get(targetLiabilityId) ?? 0;
        const actualDelta = after - before;
        const deltaDiff = Math.abs(actualDelta - scenario.overpaymentMonthly);
        if (deltaDiff > UI_TOLERANCE) {
          reconciliationFailed = true;
          warnings.push(
            `Target liability ${targetLiabilityId}: expected overpayment delta ${scenario.overpaymentMonthly}, actual ${actualDelta}, diff ${deltaDiff}`
          );
        }
      }

      // Check rate override was applied
      const targetLiability = scenarioInputs.liabilitiesToday.find(l => l.id === targetLiabilityId);
      if (targetLiability) {
        if (targetLiability.annualInterestRatePct !== undefined &&
            Math.abs(targetLiability.annualInterestRatePct - scenario.newAnnualInterestRatePct) > UI_TOLERANCE) {
          reconciliationFailed = true;
          warnings.push(
            `Target liability ${targetLiabilityId}: expected rate ${scenario.newAnnualInterestRatePct}%, got ${targetLiability.annualInterestRatePct}%`
          );
        }
        if (targetLiability.remainingTermYears !== undefined &&
            Math.abs(targetLiability.remainingTermYears - scenario.newRemainingTermYears) > UI_TOLERANCE) {
          reconciliationFailed = true;
          warnings.push(
            `Target liability ${targetLiabilityId}: expected term ${scenario.newRemainingTermYears}yr, got ${targetLiability.remainingTermYears}yr`
          );
        }
      }
    }

    // On reconciliation failure, log and fall back to baseline
    if (reconciliationFailed) {
      console.warn(
        `[Scenario Reconciliation] Scenario ${scenario.id} (${scenario.kind}) reconciliation failed:\n` +
        `  ${warnings.join('\n  ')}\n` +
        `  ${warnings.join('\n  ')}\n` +
        `  Falling back to baseline.`
      );
      return baseline;
    }
  }

  // Return new object with merged values (immutable)
  // CRITICAL: Do NOT modify currentAge or endAge - these come from baseline projection settings
  // Only adjust: asset contributions, debt overpayments
  // Projection horizon (currentAge, endAge) MUST be preserved from baseline
  // FLOW scenarios no longer use scenarioTransfers - they work through contribution deltas only
  return scenarioInputs;
}
