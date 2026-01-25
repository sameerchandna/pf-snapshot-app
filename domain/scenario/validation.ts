// Scenario validation helpers (Phase 1)
//
// Structural validation only:
// - Required fields present
// - IDs are non-empty strings
// - amountMonthly must be > 0
//
// Forward compatibility:
// - Unknown/extra fields are allowed (ignored during validation)
// - Only required fields are validated
// - Best-effort recovery for partial but usable data
//
// Does NOT check whether assetId/liabilityId exists in state (that comes later).

import type { Scenario, ScenarioKind, FlowToAssetScenario, FlowToDebtScenario } from './types';
import { BASELINE_SCENARIO_ID } from './types';

export function isScenarioKind(x: unknown): x is ScenarioKind {
  return x === 'FLOW_TO_ASSET' || x === 'FLOW_TO_DEBT';
}

export function isScenario(x: unknown): x is Scenario {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const obj = x as Record<string, unknown>;

  // Check base fields
  if (typeof obj.id !== 'string' || obj.id.trim() === '') {
    return false;
  }
  if (typeof obj.name !== 'string') {
    return false;
  }
  if (!isScenarioKind(obj.kind)) {
    return false;
  }

  // Baseline scenario has special validation (dummy values are allowed)
  if (typeof obj.id === 'string' && obj.id === BASELINE_SCENARIO_ID) {
    // Baseline only needs base fields (id, name, kind) - kind-specific fields can be dummy values
    return true;
  }

  // Check kind-specific fields
  if (obj.kind === 'FLOW_TO_ASSET') {
    if (typeof obj.assetId !== 'string' || obj.assetId.trim() === '') {
      return false;
    }
    if (typeof obj.amountMonthly !== 'number' || !Number.isFinite(obj.amountMonthly)) {
      return false;
    }
    return true;
  }

  if (obj.kind === 'FLOW_TO_DEBT') {
    if (typeof obj.liabilityId !== 'string' || obj.liabilityId.trim() === '') {
      return false;
    }
    if (typeof obj.amountMonthly !== 'number' || !Number.isFinite(obj.amountMonthly)) {
      return false;
    }
    return true;
  }

  return false;
}

export function validateScenario(s: Scenario): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  // Base fields
  if (typeof s.id !== 'string' || s.id.trim() === '') {
    errors.push('Scenario id must be a non-empty string');
  }
  if (typeof s.name !== 'string' || s.name.trim() === '') {
    errors.push('Scenario name must be a non-empty string');
  }
  if (!isScenarioKind(s.kind)) {
    errors.push(`Scenario kind must be one of: FLOW_TO_ASSET, FLOW_TO_DEBT`);
  }

  // Baseline scenario has special validation (dummy values are allowed)
  if (s.id === BASELINE_SCENARIO_ID) {
    // Baseline only needs base fields (id, name, kind) - kind-specific fields can be dummy values
    // No additional validation needed
  } else {
    // Kind-specific validation
    if (s.kind === 'FLOW_TO_ASSET') {
      const flowToAsset = s as FlowToAssetScenario;
      if (typeof flowToAsset.assetId !== 'string' || flowToAsset.assetId.trim() === '') {
        errors.push('FlowToAssetScenario assetId must be a non-empty string');
      }
      if (typeof flowToAsset.amountMonthly !== 'number' || !Number.isFinite(flowToAsset.amountMonthly)) {
        errors.push('FlowToAssetScenario amountMonthly must be a finite number');
      } else if (flowToAsset.amountMonthly <= 0) {
        errors.push('FlowToAssetScenario amountMonthly must be > 0');
      }
    }

    if (s.kind === 'FLOW_TO_DEBT') {
      const flowToDebt = s as FlowToDebtScenario;
      if (typeof flowToDebt.liabilityId !== 'string' || flowToDebt.liabilityId.trim() === '') {
        errors.push('FlowToDebtScenario liabilityId must be a non-empty string');
      }
      if (typeof flowToDebt.amountMonthly !== 'number' || !Number.isFinite(flowToDebt.amountMonthly)) {
        errors.push('FlowToDebtScenario amountMonthly must be a finite number');
      } else if (flowToDebt.amountMonthly <= 0) {
        errors.push('FlowToDebtScenario amountMonthly must be > 0');
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

/**
 * Validates that a scenario's target (assetId or liabilityId) exists in the provided arrays.
 * 
 * This checks runtime target existence, not just structural validity.
 * Baseline scenario is always valid (has dummy values that are never used).
 * 
 * @param scenario - Scenario to validate
 * @param assets - Array of assets to check against (for FLOW_TO_ASSET scenarios)
 * @param liabilities - Array of liabilities to check against (for FLOW_TO_DEBT scenarios)
 * @returns true if scenario target exists, false otherwise (baseline always valid)
 */
export function isScenarioTargetValid(
  scenario: Scenario,
  assets: Array<{ id: string }>,
  liabilities: Array<{ id: string }>
): boolean {
  // Baseline scenario is always valid (has dummy values that are never used)
  if (scenario.id === BASELINE_SCENARIO_ID) {
    return true;
  }

  if (scenario.kind === 'FLOW_TO_ASSET') {
    const flowToAsset = scenario as FlowToAssetScenario;
    return assets.some(a => a.id === flowToAsset.assetId);
  }

  if (scenario.kind === 'FLOW_TO_DEBT') {
    const flowToDebt = scenario as FlowToDebtScenario;
    return liabilities.some(l => l.id === flowToDebt.liabilityId);
  }

  return false;
}
