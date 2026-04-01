// Problem detection from projection data (Phase 13.2)
//
// Pure function — takes pre-computed series + summary and returns a list of
// detected financial problems that the Problem Solver can act on.
//
// Two problem kinds:
//   BRIDGE_GAP    — liquid assets deplete post-retirement before a locked asset unlocks.
//                   User has no accessible funds during the gap period.
//   LONGEVITY_GAP — full portfolio depletes before the projection end age.
//                   User outlives their assets.

import { UI_TOLERANCE } from '../constants';
import type { ProjectionEngineInputs } from '../engines/projectionEngine';
import type { AssetItem } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProblemKind = 'BRIDGE_GAP' | 'LONGEVITY_GAP';

/** Liquid assets run dry post-retirement, then a locked asset unlocks later. */
export interface BridgeGapProblem {
  kind: 'BRIDGE_GAP';
  /** Age when liquid assets first hit zero after retirement */
  liquidDepletionAge: number;
  /** Age when the next locked asset unlocks (end of the gap) */
  lockedUnlockAge: number;
  bridgeAssetId: string;
  bridgeAssetName: string;
  /** Number of years with no accessible assets */
  gapYears: number;
}

/** Full portfolio (liquid + locked) depletes before projection end. */
export interface LongevityGapProblem {
  kind: 'LONGEVITY_GAP';
  /** Age when all withdrawable assets hit zero */
  depletionAge: number;
  /** Projection end age */
  endAge: number;
  /** Years the user would outlive their assets */
  shortfallYears: number;
}

export type DetectedProblem = BridgeGapProblem | LongevityGapProblem;

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Detects financial problems from pre-computed projection data.
 *
 * Caller is responsible for computing liquidAssetsSeries and depletionAge before calling.
 * This keeps the function pure and avoids redundant simulation runs.
 *
 * @param inputs                Projection engine inputs (for ages and config)
 * @param assetsWithAvailability Full asset list (for availability metadata)
 * @param liquidAssetsSeries    Yearly liquid asset values (index 0 = currentAge)
 * @param depletionAge          From ProjectionSummary.depletionAge; undefined if never depleted
 */
export function detectProblems(params: {
  inputs: ProjectionEngineInputs;
  assetsWithAvailability: AssetItem[];
  liquidAssetsSeries: number[];
  depletionAge: number | undefined;
}): DetectedProblem[] {
  const { inputs, assetsWithAvailability, liquidAssetsSeries, depletionAge } = params;
  const { currentAge, retirementAge, endAge } = inputs;
  const problems: DetectedProblem[] = [];

  // ── Bridge gap ─────────────────────────────────────────────────────────────
  // Find the first post-retirement point where liquid assets hit zero.
  let liquidDepletionAge: number | undefined;
  for (let i = 0; i < liquidAssetsSeries.length; i++) {
    const age = currentAge + i;
    if (age >= retirementAge && liquidAssetsSeries[i] <= UI_TOLERANCE) {
      liquidDepletionAge = age;
      break;
    }
  }

  if (liquidDepletionAge !== undefined) {
    // Find the next locked asset that unlocks after the liquid depletion
    const bridgeAsset = assetsWithAvailability
      .filter(a => a.isActive !== false && a.availability?.type === 'locked')
      .filter(a => {
        const u = a.availability?.unlockAge;
        return typeof u === 'number' && u > liquidDepletionAge! && u <= endAge;
      })
      .sort(
        (a, b) =>
          (a.availability!.unlockAge as number) - (b.availability!.unlockAge as number),
      )[0];

    if (bridgeAsset) {
      const lockedUnlockAge = bridgeAsset.availability!.unlockAge as number;
      problems.push({
        kind: 'BRIDGE_GAP',
        liquidDepletionAge,
        lockedUnlockAge,
        bridgeAssetId: bridgeAsset.id,
        bridgeAssetName: bridgeAsset.name,
        gapYears: lockedUnlockAge - liquidDepletionAge,
      });
    }
  }

  // ── Longevity gap ──────────────────────────────────────────────────────────
  if (depletionAge !== undefined && depletionAge < endAge) {
    problems.push({
      kind: 'LONGEVITY_GAP',
      depletionAge,
      endAge,
      shortfallYears: endAge - depletionAge,
    });
  }

  return problems;
}
