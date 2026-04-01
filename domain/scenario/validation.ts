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

import type {
  Scenario,
  ScenarioKind,
  FlowToAssetScenario,
  FlowToDebtScenario,
  ChangeRetirementAgeScenario,
  ReduceExpensesScenario,
  ChangeAssetGrowthRateScenario,
  SavingsWhatIfScenario,
  MortgageWhatIfScenario,
} from './types';
import { BASELINE_SCENARIO_ID } from './types';

export function isScenarioKind(x: unknown): x is ScenarioKind {
  return (
    x === 'FLOW_TO_ASSET' ||
    x === 'FLOW_TO_DEBT' ||
    x === 'CHANGE_RETIREMENT_AGE' ||
    x === 'REDUCE_EXPENSES' ||
    x === 'CHANGE_ASSET_GROWTH_RATE' ||
    x === 'SAVINGS_WHAT_IF' ||
    x === 'MORTGAGE_WHAT_IF'
  );
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

  if (obj.kind === 'CHANGE_RETIREMENT_AGE') {
    if (typeof obj.retirementAge !== 'number' || !Number.isFinite(obj.retirementAge)) {
      return false;
    }
    return true;
  }

  if (obj.kind === 'REDUCE_EXPENSES') {
    if (typeof obj.reductionMonthly !== 'number' || !Number.isFinite(obj.reductionMonthly)) {
      return false;
    }
    return true;
  }

  if (obj.kind === 'CHANGE_ASSET_GROWTH_RATE') {
    if (typeof obj.assetId !== 'string' || obj.assetId.trim() === '') {
      return false;
    }
    if (typeof obj.newAnnualGrowthRatePct !== 'number' || !Number.isFinite(obj.newAnnualGrowthRatePct)) {
      return false;
    }
    return true;
  }

  if (obj.kind === 'SAVINGS_WHAT_IF') {
    if (typeof obj.assetId !== 'string' || obj.assetId.trim() === '') {
      return false;
    }
    if (typeof obj.contributionMonthly !== 'number' || !Number.isFinite(obj.contributionMonthly)) {
      return false;
    }
    if (typeof obj.newAnnualGrowthRatePct !== 'number' || !Number.isFinite(obj.newAnnualGrowthRatePct)) {
      return false;
    }
    return true;
  }

  if (obj.kind === 'MORTGAGE_WHAT_IF') {
    if (typeof obj.liabilityId !== 'string' || obj.liabilityId.trim() === '') {
      return false;
    }
    if (typeof obj.overpaymentMonthly !== 'number' || !Number.isFinite(obj.overpaymentMonthly)) {
      return false;
    }
    if (typeof obj.newAnnualInterestRatePct !== 'number' || !Number.isFinite(obj.newAnnualInterestRatePct)) {
      return false;
    }
    if (typeof obj.newRemainingTermYears !== 'number' || !Number.isFinite(obj.newRemainingTermYears)) {
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

    if (s.kind === 'CHANGE_RETIREMENT_AGE') {
      const changeAge = s as ChangeRetirementAgeScenario;
      if (typeof changeAge.retirementAge !== 'number' || !Number.isFinite(changeAge.retirementAge)) {
        errors.push('ChangeRetirementAgeScenario retirementAge must be a finite number');
      } else if (!Number.isInteger(changeAge.retirementAge) || changeAge.retirementAge < 1) {
        errors.push('ChangeRetirementAgeScenario retirementAge must be a positive integer');
      }
    }

    if (s.kind === 'REDUCE_EXPENSES') {
      const reduceExpenses = s as ReduceExpensesScenario;
      if (typeof reduceExpenses.reductionMonthly !== 'number' || !Number.isFinite(reduceExpenses.reductionMonthly)) {
        errors.push('ReduceExpensesScenario reductionMonthly must be a finite number');
      } else if (reduceExpenses.reductionMonthly <= 0) {
        errors.push('ReduceExpensesScenario reductionMonthly must be > 0');
      }
    }

    if (s.kind === 'CHANGE_ASSET_GROWTH_RATE') {
      const changeGrowth = s as ChangeAssetGrowthRateScenario;
      if (typeof changeGrowth.assetId !== 'string' || changeGrowth.assetId.trim() === '') {
        errors.push('ChangeAssetGrowthRateScenario assetId must be a non-empty string');
      }
      if (typeof changeGrowth.newAnnualGrowthRatePct !== 'number' || !Number.isFinite(changeGrowth.newAnnualGrowthRatePct)) {
        errors.push('ChangeAssetGrowthRateScenario newAnnualGrowthRatePct must be a finite number');
      }
    }

    if (s.kind === 'SAVINGS_WHAT_IF') {
      const compound = s as SavingsWhatIfScenario;
      if (typeof compound.assetId !== 'string' || compound.assetId.trim() === '') {
        errors.push('SavingsWhatIfScenario assetId must be a non-empty string');
      }
      if (typeof compound.contributionMonthly !== 'number' || !Number.isFinite(compound.contributionMonthly)) {
        errors.push('SavingsWhatIfScenario contributionMonthly must be a finite number');
      } else if (compound.contributionMonthly <= 0) {
        errors.push('SavingsWhatIfScenario contributionMonthly must be > 0');
      }
      if (typeof compound.newAnnualGrowthRatePct !== 'number' || !Number.isFinite(compound.newAnnualGrowthRatePct)) {
        errors.push('SavingsWhatIfScenario newAnnualGrowthRatePct must be a finite number');
      }
    }

    if (s.kind === 'MORTGAGE_WHAT_IF') {
      const mwi = s as MortgageWhatIfScenario;
      if (typeof mwi.liabilityId !== 'string' || mwi.liabilityId.trim() === '') {
        errors.push('MortgageWhatIfScenario liabilityId must be a non-empty string');
      }
      if (typeof mwi.overpaymentMonthly !== 'number' || !Number.isFinite(mwi.overpaymentMonthly)) {
        errors.push('MortgageWhatIfScenario overpaymentMonthly must be a finite number');
      } else if (mwi.overpaymentMonthly < 0) {
        errors.push('MortgageWhatIfScenario overpaymentMonthly must be >= 0');
      }
      if (typeof mwi.newAnnualInterestRatePct !== 'number' || !Number.isFinite(mwi.newAnnualInterestRatePct)) {
        errors.push('MortgageWhatIfScenario newAnnualInterestRatePct must be a finite number');
      }
      if (typeof mwi.newRemainingTermYears !== 'number' || !Number.isFinite(mwi.newRemainingTermYears)) {
        errors.push('MortgageWhatIfScenario newRemainingTermYears must be a finite number');
      } else if (!Number.isInteger(mwi.newRemainingTermYears) || mwi.newRemainingTermYears < 1) {
        errors.push('MortgageWhatIfScenario newRemainingTermYears must be a positive integer');
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

  // CHANGE_RETIREMENT_AGE and REDUCE_EXPENSES have no asset/liability target
  if (scenario.kind === 'CHANGE_RETIREMENT_AGE' || scenario.kind === 'REDUCE_EXPENSES') {
    return true;
  }

  if (scenario.kind === 'CHANGE_ASSET_GROWTH_RATE') {
    const changeGrowth = scenario as ChangeAssetGrowthRateScenario;
    return assets.some(a => a.id === changeGrowth.assetId);
  }

  if (scenario.kind === 'SAVINGS_WHAT_IF') {
    const compound = scenario as SavingsWhatIfScenario;
    return assets.some(a => a.id === compound.assetId);
  }

  if (scenario.kind === 'MORTGAGE_WHAT_IF') {
    const mwi = scenario as MortgageWhatIfScenario;
    return liabilities.some(l => l.id === mwi.liabilityId);
  }

  return false;
}
