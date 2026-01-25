// System asset helpers and migration logic
//
// SYSTEM_CASH is a special system-defined asset that:
// - Always exists exactly once per profile
// - Cannot be deleted or renamed by user
// - Has 0% growth rate and immediate availability
// - Is excluded from asset edit/delete UI and pickers
// - Is included in balances, net worth, and charts

import type { AssetItem, SnapshotState } from './types';
import { SYSTEM_CASH_ID, ATTRIBUTION_TOLERANCE } from './constants';

/**
 * Checks if an asset is the system-defined Cash asset.
 */
export function isSystemCash(asset: AssetItem): boolean {
  return asset.id === SYSTEM_CASH_ID;
}

/**
 * Creates the SYSTEM_CASH asset with default properties.
 */
function createSystemCashAsset(balance: number = 0): AssetItem {
  return {
    id: SYSTEM_CASH_ID,
    name: 'Cash',
    balance: Math.max(0, balance),
    annualGrowthRatePct: 0,
    groupId: 'assets-cash',
    availability: { type: 'immediate' },
    isActive: true,
  };
}

/**
 * Checks if an asset is cash-like (user-created cash asset to be migrated).
 * 
 * Criteria (strict):
 * - name.trim().toLowerCase() === 'cash'
 * - OR (groupId === 'assets-cash' AND annualGrowthRatePct === 0 AND availability.type === 'immediate')
 * 
 * Excludes:
 * - SYSTEM_CASH itself (already system-defined)
 * - High-yield savings (growth > 0)
 */
function isCashLikeAsset(asset: AssetItem): boolean {
  // Never migrate SYSTEM_CASH itself
  if (isSystemCash(asset)) {
    return false;
  }

  // Primary: name-based detection
  if (asset.name.trim().toLowerCase() === 'cash') {
    return true;
  }

  // Secondary: group + properties-based detection
  if (
    asset.groupId === 'assets-cash' &&
    (asset.annualGrowthRatePct ?? 0) === 0 &&
    asset.availability?.type === 'immediate'
  ) {
    return true;
  }

  return false;
}

/**
 * Ensures SYSTEM_CASH exists in the assets array.
 * If it doesn't exist, creates it with balance 0.
 * If multiple SYSTEM_CASH exist, keeps the first and merges balances.
 * 
 * Returns a new assets array (immutable).
 * 
 * This function should be called whenever assets are updated to preserve SYSTEM_CASH.
 */
export function ensureSystemCashExists(assets: AssetItem[]): AssetItem[] {
  const systemCashAssets = assets.filter(isSystemCash);
  const otherAssets = assets.filter(a => !isSystemCash(a));

  if (systemCashAssets.length === 0) {
    // Create SYSTEM_CASH with balance 0
    return [...otherAssets, createSystemCashAsset(0)];
  }

  if (systemCashAssets.length === 1) {
    // SYSTEM_CASH already exists, keep it
    return assets;
  }

  // Multiple SYSTEM_CASH found (shouldn't happen, but handle gracefully)
  // Sum balances and keep the first one
  const totalBalance = systemCashAssets.reduce((sum, a) => sum + a.balance, 0);
  const firstSystemCash = { ...systemCashAssets[0], balance: totalBalance };
  return [...otherAssets, firstSystemCash];
}

/**
 * Migrates cash-like user assets to SYSTEM_CASH.
 * 
 * Process:
 * 1. Ensures SYSTEM_CASH exists
 * 2. Finds all cash-like user assets
 * 3. Sums their balances into SYSTEM_CASH
 * 4. Removes cash-like assets from assets array
 * 
 * Returns { migratedAssets, migratedBalance, removedAssetIds }.
 */
function migrateCashLikeAssets(assets: AssetItem[]): {
  migratedAssets: AssetItem[];
  migratedBalance: number;
  removedAssetIds: string[];
} {
  // Ensure SYSTEM_CASH exists first
  let assetsWithSystemCash = ensureSystemCashExists(assets);

  // Find cash-like assets (excluding SYSTEM_CASH)
  const cashLikeAssets = assetsWithSystemCash.filter(isCashLikeAsset);
  const nonCashLikeAssets = assetsWithSystemCash.filter(a => !isCashLikeAsset(a));

  if (cashLikeAssets.length === 0) {
    // No migration needed
    return {
      migratedAssets: assetsWithSystemCash,
      migratedBalance: 0,
      removedAssetIds: [],
    };
  }

  // Sum balances of cash-like assets
  const migratedBalance = cashLikeAssets.reduce((sum, a) => sum + a.balance, 0);
  const removedAssetIds = cashLikeAssets.map(a => a.id);

  // Find SYSTEM_CASH and update its balance
  const systemCashIndex = assetsWithSystemCash.findIndex(isSystemCash);
  if (systemCashIndex >= 0) {
    const systemCash = assetsWithSystemCash[systemCashIndex];
    assetsWithSystemCash[systemCashIndex] = {
      ...systemCash,
      balance: systemCash.balance + migratedBalance,
    };
  } else {
    // Shouldn't happen (ensureSystemCashExists should have created it), but handle gracefully
    assetsWithSystemCash.push(createSystemCashAsset(migratedBalance));
  }

  // Remove cash-like assets
  const migratedAssets = nonCashLikeAssets;

  return {
    migratedAssets,
    migratedBalance,
    removedAssetIds,
  };
}

/**
 * Ensures SYSTEM_CASH exists and migrates cash-like assets.
 * 
 * This is the main migration function that should be called on profile load.
 * 
 * Returns a new SnapshotState with migrated assets and cleaned contributions.
 */
export function ensureSystemCash(state: SnapshotState): SnapshotState {
  // Migrate cash-like assets to SYSTEM_CASH
  const { migratedAssets, migratedBalance, removedAssetIds } = migrateCashLikeAssets(state.assets);

  // Remove contributions pointing to removed cash-like assets
  const cleanedContributions = state.assetContributions.filter(
    c => !removedAssetIds.includes(c.assetId)
  );

  // Log migration details in dev mode
  if (__DEV__) {
    if (removedAssetIds.length > 0) {
      console.log(
        `[SYSTEM_CASH Migration] Migrated ${removedAssetIds.length} cash-like asset(s) to SYSTEM_CASH:`,
        {
          removedAssetIds,
          migratedBalance,
          removedContributions: state.assetContributions.length - cleanedContributions.length,
        }
      );
    }
  }

  // Dev assertions
  if (__DEV__) {
    const systemCashCount = migratedAssets.filter(isSystemCash).length;
    if (systemCashCount !== 1) {
      console.error(
        `[SYSTEM_CASH Migration] Expected exactly 1 SYSTEM_CASH, found ${systemCashCount}`
      );
    }

    const remainingCashLike = migratedAssets.filter(isCashLikeAsset);
    if (remainingCashLike.length > 0) {
      console.error(
        `[SYSTEM_CASH Migration] Found ${remainingCashLike.length} remaining cash-like assets after migration:`,
        remainingCashLike.map(a => ({ id: a.id, name: a.name }))
      );
    }

    // Net worth preservation check
    const preNetWorth =
      state.assets.reduce((sum, a) => sum + a.balance, 0) -
      state.liabilities.reduce((sum, l) => sum + l.balance, 0);
    const postNetWorth =
      migratedAssets.reduce((sum, a) => sum + a.balance, 0) -
      state.liabilities.reduce((sum, l) => sum + l.balance, 0);
    const netWorthDelta = Math.abs(preNetWorth - postNetWorth);
    if (netWorthDelta > ATTRIBUTION_TOLERANCE) {
      console.error(
        `[SYSTEM_CASH Migration] Net worth not preserved: pre=${preNetWorth}, post=${postNetWorth}, delta=${netWorthDelta}`
      );
    }
  }

  return {
    ...state,
    assets: migratedAssets,
    assetContributions: cleanedContributions,
  };
}

/**
 * Filters out SYSTEM_CASH from assets array.
 * Used for UI that should not show/edit SYSTEM_CASH.
 */
export function getUserEditableAssets(assets: AssetItem[]): AssetItem[] {
  return assets.filter(a => !isSystemCash(a));
}
