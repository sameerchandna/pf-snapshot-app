// Helper to build ProjectionEngineInputs from SnapshotState
// Filters inactive items and contributions to inactive assets

import type { SnapshotState } from '../types';
import type { ProjectionEngineInputs } from '../projectionEngine';

/**
 * Builds ProjectionEngineInputs from SnapshotState, filtering inactive items.
 * - Only includes active assets and liabilities
 * - Only includes contributions to active assets
 * 
 * SCENARIO BOUNDARY: This is the canonical boundary for projection inputs.
 * 
 * FLOW vs STOCK semantics:
 * - FLOW: monthlySurplus = availableCash - assetContributions - liabilityReduction
 *   This is a pure cashflow concept (what happens per month), used for affordability checks.
 * - STOCK: SYSTEM_CASH.balance represents accumulated cash balance (asset state at a point in time).
 *   Cash is treated as a normal asset: opening balance, growth, optional contributions.
 *   FLOW scenarios do not mutate cash balance - they work through contribution deltas only.
 *   Cash balance is reserved for STOCK scenarios (lump-sum transfers).
 */
export function buildProjectionInputsFromState(state: SnapshotState): ProjectionEngineInputs {
  // Filter to active assets only
  const activeAssets = state.assets.filter(a => a.isActive !== false);
  
  // Filter to active liabilities only
  const activeLiabilities = state.liabilities.filter(l => l.isActive !== false);
  
  // Build set of active asset IDs for contribution filtering
  const activeAssetIds = new Set(activeAssets.map(a => a.id));
  
  // Filter contributions to only those targeting active assets
  const activeContributions = state.assetContributions
    .filter(c => activeAssetIds.has(c.assetId))
    .map(c => ({ assetId: c.assetId, amountMonthly: c.amountMonthly }));

  // Map assets - cash is treated like any other asset (no special case)
  // Cash balance comes from state.assets (STOCK concept), not from monthlySurplus (FLOW concept)
  const assetsToday = activeAssets.map(a => ({
    id: a.id,
    name: a.name,
    balance: a.balance,
    annualGrowthRatePct: a.annualGrowthRatePct,
  }));

  // Phase 3.1: Deterministic ordering - sort by id for consistent iteration order
  assetsToday.sort((a, b) => a.id.localeCompare(b.id));

  const liabilitiesToday = activeLiabilities.map(l => ({
    id: l.id,
    name: l.name,
    balance: l.balance,
    annualInterestRatePct: l.annualInterestRatePct,
    kind: l.kind,
    remainingTermYears: l.remainingTermYears,
  }));

  // Phase 3.1: Deterministic ordering - sort by id for consistent iteration order
  liabilitiesToday.sort((a, b) => a.id.localeCompare(b.id));

  // Phase 3.1: Deterministic ordering - sort contributions by assetId, then amountMonthly (stable secondary key)
  activeContributions.sort((a, b) => {
    const idCompare = a.assetId.localeCompare(b.assetId);
    if (idCompare !== 0) return idCompare;
    return a.amountMonthly - b.amountMonthly;
  });

  return {
    assetsToday,
    liabilitiesToday,
    currentAge: state.projection.currentAge,
    endAge: state.projection.endAge,
    inflationRatePct: state.projection.inflationPct,
    assetContributionsMonthly: activeContributions,
    monthlyDebtReduction: state.projection.monthlyDebtReduction,
  };
}
