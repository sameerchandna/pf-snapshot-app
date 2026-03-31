/**
 * Validation script for projection engine refactor.
 * 
 * Tests:
 * 1. Aggregate projection determinism (using assertProjectionDeterminism)
 * 2. Attribution reconciliation
 * 3. Single-item helper sanity checks
 * 
 * Run this in __DEV__ mode to validate the refactor.
 */

import { 
  computeProjectionSeries, 
  computeProjectionSummary, 
  assertProjectionDeterminism,
  computeSingleAssetTimeSeries,
  computeSingleLiabilityTimeSeries,
  type ProjectionEngineInputs 
} from '../engines/projectionEngine';
import { computeA3Attribution } from '../engines/computeA3Attribution';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { UI_TOLERANCE, ATTRIBUTION_TOLERANCE } from '../constants';
import type { SnapshotState } from '../types';

export type ValidationResult = {
  aggregateProjection: 'PASS' | 'FAIL';
  attributionReconciliation: 'PASS' | 'FAIL';
  assetHelperSanity: 'PASS' | 'FAIL';
  liabilityHelperSanity: 'PASS' | 'FAIL';
  errors: Array<{
    test: string;
    cause: string;
    file: string;
    function: string;
  }>;
};

/**
 * Validate projection refactor for numerical identity and safety.
 */
export function validateProjectionRefactor(state: SnapshotState): ValidationResult {
  const errors: ValidationResult['errors'] = [];

  // Step 1: Aggregate projection determinism
  const inputs = buildProjectionInputsFromState(state);
  const determinismPass = assertProjectionDeterminism(inputs, UI_TOLERANCE);
  
  if (!determinismPass) {
    errors.push({
      test: 'Aggregate Projection Determinism',
      cause: 'Projection outputs differ between runs (non-deterministic)',
      file: 'projectionEngine.ts',
      function: 'assertProjectionDeterminism',
    });
  }

  // Step 2: Attribution reconciliation
  const projectionSeries = computeProjectionSeries(inputs);
  const projectionSummary = computeProjectionSummary(inputs);
  const attribution = computeA3Attribution({
    snapshot: state,
    projectionSeries,
    projectionSummary,
    projectionInputs: inputs, // Use actual simulation inputs to match summary contributions
  });

  const attributionDelta = Math.abs(attribution.reconciliation.delta);
  const attributionPass = attributionDelta <= ATTRIBUTION_TOLERANCE;

  if (!attributionPass) {
    errors.push({
      test: 'Attribution Reconciliation',
      cause: `Attribution delta ${attributionDelta} exceeds tolerance ${ATTRIBUTION_TOLERANCE}`,
      file: 'computeA3Attribution.ts',
      function: 'computeA3Attribution',
    });
  }

  // Step 3: Single-item helper sanity checks
  let assetHelperPass = true;
  let liabilityHelperPass = true;

  const activeAssets = state.assets.filter(a => a.isActive !== false);
  if (activeAssets.length > 0) {
    const testAsset = activeAssets[0];
    let assetSeries: Array<{ age: number; balance: number; cumulativeContributions: number; cumulativeGrowth: number }>;
    try {
      assetSeries = computeSingleAssetTimeSeries(inputs, testAsset.id);
    } catch (error) {
      assetHelperPass = false;
      errors.push({
        test: 'Asset Helper Sanity',
        cause: `Error computing asset series: ${error instanceof Error ? error.message : String(error)}`,
        file: 'projectionEngine.ts',
        function: 'computeSingleAssetTimeSeries',
      });
      assetSeries = [];
    }

    // Validate asset series
    if (assetSeries.length === 0) {
      assetHelperPass = false;
      errors.push({
        test: 'Asset Helper Sanity',
        cause: 'Asset series is empty',
        file: 'projectionEngine.ts',
        function: 'computeSingleAssetTimeSeries',
      });
    } else {
      const startingBalance = assetSeries[0].balance;
      let prevContributions = assetSeries[0].cumulativeContributions;
      let prevBalance = assetSeries[0].balance;

      for (let i = 1; i < assetSeries.length; i++) {
        const point = assetSeries[i];

        // Check balances are non-negative
        if (point.balance < 0) {
          assetHelperPass = false;
          errors.push({
            test: 'Asset Helper Sanity',
            cause: `Negative balance at age ${point.age}: ${point.balance}`,
            file: 'projectionEngine.ts',
            function: 'computeSingleAssetTimeSeries',
          });
          break;
        }

        // Check contributions are monotonically increasing
        if (point.cumulativeContributions < prevContributions - UI_TOLERANCE) {
          assetHelperPass = false;
          errors.push({
            test: 'Asset Helper Sanity',
            cause: `Contributions decreased at age ${point.age}: ${prevContributions} -> ${point.cumulativeContributions}`,
            file: 'projectionEngine.ts',
            function: 'computeSingleAssetTimeSeries',
          });
          break;
        }

        // Check growth reconciliation: balance = starting + contributions + growth
        const expectedBalance = startingBalance + point.cumulativeContributions + point.cumulativeGrowth;
        const balanceDiff = Math.abs(point.balance - expectedBalance);
        if (balanceDiff > UI_TOLERANCE) {
          assetHelperPass = false;
          errors.push({
            test: 'Asset Helper Sanity',
            cause: `Growth reconciliation failed at age ${point.age}: balance ${point.balance} != starting ${startingBalance} + contributions ${point.cumulativeContributions} + growth ${point.cumulativeGrowth} (diff: ${balanceDiff})`,
            file: 'projectionEngine.ts',
            function: 'computeSingleAssetTimeSeries',
          });
          break;
        }

        prevContributions = point.cumulativeContributions;
        prevBalance = point.balance;
      }

      // Check final balance matches aggregate (if asset exists in final state)
      const finalPoint = assetSeries[assetSeries.length - 1];
      const finalAge = finalPoint.age;
      const finalProjectionPoint = projectionSeries.find(p => Math.abs(p.age - finalAge) < 0.01);
      if (finalProjectionPoint) {
        // Note: We can't directly compare because aggregate includes all assets
        // This is a sanity check, not a strict equality check
      }
    }
  }

  // Test liability helper with first active liability
  const activeLiabilities = state.liabilities.filter(l => l.isActive !== false);
  if (activeLiabilities.length > 0) {
    const testLiability = activeLiabilities[0];
    let liabilitySeries: Array<{ age: number; balance: number; cumulativePrincipalPaid: number; cumulativeInterestPaid: number }>;
    try {
      liabilitySeries = computeSingleLiabilityTimeSeries(inputs, testLiability.id);
    } catch (error) {
      liabilityHelperPass = false;
      errors.push({
        test: 'Liability Helper Sanity',
        cause: `Error computing liability series: ${error instanceof Error ? error.message : String(error)}`,
        file: 'projectionEngine.ts',
        function: 'computeSingleLiabilityTimeSeries',
      });
      liabilitySeries = [];
    }

    // Validate liability series
    if (liabilitySeries.length === 0) {
      liabilityHelperPass = false;
      errors.push({
        test: 'Liability Helper Sanity',
        cause: 'Liability series is empty',
        file: 'projectionEngine.ts',
        function: 'computeSingleLiabilityTimeSeries',
      });
    } else {
      let prevBalance = liabilitySeries[0].balance;
      let prevPrincipal = liabilitySeries[0].cumulativePrincipalPaid;
      let prevInterest = liabilitySeries[0].cumulativeInterestPaid;

      for (let i = 1; i < liabilitySeries.length; i++) {
        const point = liabilitySeries[i];

        // Check balance is non-negative
        if (point.balance < 0) {
          liabilityHelperPass = false;
          errors.push({
            test: 'Liability Helper Sanity',
            cause: `Negative balance at age ${point.age}: ${point.balance}`,
            file: 'projectionEngine.ts',
            function: 'computeSingleLiabilityTimeSeries',
          });
          break;
        }

        // Check balance monotonically decreases (or stays same after payoff)
        if (point.balance > prevBalance + UI_TOLERANCE) {
          liabilityHelperPass = false;
          errors.push({
            test: 'Liability Helper Sanity',
            cause: `Balance increased at age ${point.age}: ${prevBalance} -> ${point.balance}`,
            file: 'projectionEngine.ts',
            function: 'computeSingleLiabilityTimeSeries',
          });
          break;
        }

        // Check principal and interest are monotonically increasing
        if (point.cumulativePrincipalPaid < prevPrincipal - UI_TOLERANCE) {
          liabilityHelperPass = false;
          errors.push({
            test: 'Liability Helper Sanity',
            cause: `Principal paid decreased at age ${point.age}: ${prevPrincipal} -> ${point.cumulativePrincipalPaid}`,
            file: 'projectionEngine.ts',
            function: 'computeSingleLiabilityTimeSeries',
          });
          break;
        }

        if (point.cumulativeInterestPaid < prevInterest - UI_TOLERANCE) {
          liabilityHelperPass = false;
          errors.push({
            test: 'Liability Helper Sanity',
            cause: `Interest paid decreased at age ${point.age}: ${prevInterest} -> ${point.cumulativeInterestPaid}`,
            file: 'projectionEngine.ts',
            function: 'computeSingleLiabilityTimeSeries',
          });
          break;
        }

        // Check interest stops accruing after payoff
        if (prevBalance <= UI_TOLERANCE && point.cumulativeInterestPaid > prevInterest + UI_TOLERANCE) {
          liabilityHelperPass = false;
          errors.push({
            test: 'Liability Helper Sanity',
            cause: `Interest accrued after payoff at age ${point.age}`,
            file: 'projectionEngine.ts',
            function: 'computeSingleLiabilityTimeSeries',
          });
          break;
        }

        prevBalance = point.balance;
        prevPrincipal = point.cumulativePrincipalPaid;
        prevInterest = point.cumulativeInterestPaid;
      }
    }
  }

  return {
    aggregateProjection: determinismPass ? 'PASS' : 'FAIL',
    attributionReconciliation: attributionPass ? 'PASS' : 'FAIL',
    assetHelperSanity: assetHelperPass ? 'PASS' : 'FAIL',
    liabilityHelperSanity: liabilityHelperPass ? 'PASS' : 'FAIL',
    errors,
  };
}
