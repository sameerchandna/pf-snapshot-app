/**
 * Entry screen helper functions.
 * 
 * Phase 6.9: Meaningful User Data detection for Entry / Launch surface.
 */

import type { SnapshotState } from './types';
import { SYSTEM_CASH_ID } from './constants';

/**
 * Determines if a snapshot contains meaningful user data for Entry screen purposes.
 * 
 * Meaningful data is defined as:
 * - At least one active non-SYSTEM asset, OR
 * - At least one active liability
 * 
 * This check excludes SYSTEM_CASH (which always exists) and inactive items.
 * 
 * @param snapshotState - Snapshot state to check
 * @returns true if meaningful data exists, false otherwise
 */
export function hasMeaningfulUserData(snapshotState: SnapshotState): boolean {
  // Filter to active assets only, excluding SYSTEM_CASH
  const activeNonSystemAssets = snapshotState.assets.filter(
    a => a.isActive !== false && a.id !== SYSTEM_CASH_ID
  );
  
  // Filter to active liabilities only
  const activeLiabilities = snapshotState.liabilities.filter(
    l => l.isActive !== false
  );
  
  // Meaningful if at least one active non-SYSTEM asset OR at least one active liability
  return activeNonSystemAssets.length > 0 || activeLiabilities.length > 0;
}
