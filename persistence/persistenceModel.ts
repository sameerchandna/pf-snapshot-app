// Persistence boundary helpers (pure, no throwing)
//
// - loadSnapshotState(raw) hardens unknown JSON into a valid SnapshotState
// - saveSnapshotState(state) produces a versioned, serializable payload
//
// This is intentionally boring: best-effort persistence that never blocks boot.

import type { SnapshotState } from '../types';
import { coerceSnapshotState, emptySnapshotState } from '../domain/domainValidation';

export const SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type PersistedSnapshot = {
  schemaVersion: number;
  state: SnapshotState;
};

export function loadSnapshotState(raw: unknown): SnapshotState {
  // New format: { schemaVersion, state }
  if (isRecord(raw) && 'schemaVersion' in raw && 'state' in raw) {
    const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : NaN;
    if (!Number.isFinite(version) || version !== SNAPSHOT_SCHEMA_VERSION) {
      // Version mismatch: safest fallback (explicit requirement).
      return emptySnapshotState();
    }
    const coerced = coerceSnapshotState(raw.state);
    return applyTemplateGroupsIfMissing(coerced);
  }

  // Legacy format: snapshot state stored directly
  const coerced = coerceSnapshotState(raw);
  return applyTemplateGroupsIfMissing(coerced);
}

export function saveSnapshotState(state: SnapshotState): PersistedSnapshot {
  // Re-coerce at the persistence boundary to guarantee plain serializable data
  // and to drop any accidental invalid values without throwing.
  const hardened = coerceSnapshotState(state);

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    state: hardened,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// One-time UX migration:
// If a persisted snapshot exists but group arrays are empty, re-seed educational templates.
// - Do NOT overwrite groups if they already exist
// - Do NOT touch item arrays
function applyTemplateGroupsIfMissing(state: SnapshotState): SnapshotState {
  const needsExpenseGroups = state.expenseGroups.length === 0;
  const needsAssetGroups = state.assetGroups.length === 0;
  const needsLiabilityGroups = state.liabilityGroups.length === 0;

  if (!needsExpenseGroups && !needsAssetGroups && !needsLiabilityGroups) return state;

  return {
    ...state,
    expenseGroups: needsExpenseGroups
      ? [
          { id: 'housing', name: 'Housing' },
          { id: 'subscriptions', name: 'Subscriptions' },
          { id: 'other', name: 'Other' },
        ]
      : state.expenseGroups,
    assetGroups: needsAssetGroups
      ? [
          { id: 'assets-cash', name: 'Cash' },
          { id: 'assets-savings', name: 'Savings' },
          { id: 'assets-investments', name: 'Investments' },
          { id: 'assets-other', name: 'Other' },
        ]
      : state.assetGroups,
    liabilityGroups: needsLiabilityGroups
      ? [
          { id: 'liab-mortgage', name: 'Mortgage' },
          { id: 'liab-credit', name: 'Credit' },
          { id: 'liab-loans', name: 'Loans' },
          { id: 'liab-other', name: 'Other' },
        ]
      : state.liabilityGroups,
  };
}


