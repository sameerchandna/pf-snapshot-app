// Back-solve engine (Phase 13.2)
//
// Binary-search solver: for a given DetectedProblem, finds the minimum change
// to each lever that eliminates the problem.
//
// Levers:
//   CHANGE_RETIREMENT_AGE   — retire later (integer age)
//   FLOW_TO_ASSET           — invest more each month (targets highest-balance liquid asset)
//   REDUCE_EXPENSES         — spend less each month
//   CHANGE_ASSET_GROWTH_RATE — grow an asset faster (targets highest-balance asset)
//
// All solver calls are synchronous and pure. The caller supplies baseline inputs
// and the problem to solve; the engine returns a solved value (or null if the
// lever can't fix the problem within its range).

import type { ProjectionEngineInputs } from '../engines/projectionEngine';
import { computeProjectionSummary } from '../engines/projectionEngine';
import type { AssetItem } from '../types';
import type { DetectedProblem, ProblemKind } from './detectProblems';
import { detectProblems } from './detectProblems';
import { computeLiquidAssetsSeries } from './computeLiquidAssets';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result for a single lever. */
export interface LeverSolution {
  kind: 'CHANGE_RETIREMENT_AGE' | 'FLOW_TO_ASSET' | 'REDUCE_EXPENSES' | 'CHANGE_ASSET_GROWTH_RATE';
  /**
   * Minimum value that eliminates the problem, or null if unsolvable within range.
   * - CHANGE_RETIREMENT_AGE: new retirement age (integer)
   * - FLOW_TO_ASSET: additional monthly contribution (£/month)
   * - REDUCE_EXPENSES: monthly spending reduction (£/month)
   * - CHANGE_ASSET_GROWTH_RATE: new annual growth rate (%)
   */
  solvedValue: number | null;
  /** Target asset for FLOW_TO_ASSET and CHANGE_ASSET_GROWTH_RATE */
  assetId?: string;
  assetName?: string;
  /** Slider bounds for exploration UI */
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  /** Human-readable label */
  label: string;
}

export interface BackSolveResult {
  problem: DetectedProblem;
  levers: LeverSolution[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Checks whether the given problem kind is absent from a candidate set of inputs.
 * Runs a mini-projection internally.
 */
function isProblemSolved(
  candidate: ProjectionEngineInputs,
  assetsWithAvailability: AssetItem[],
  problemKind: ProblemKind,
): boolean {
  const liquidSeries = computeLiquidAssetsSeries(candidate, assetsWithAvailability);
  const summary = computeProjectionSummary(candidate);
  const remaining = detectProblems({
    inputs: candidate,
    assetsWithAvailability,
    liquidAssetsSeries: liquidSeries,
    depletionAge: summary.depletionAge,
  });
  return !remaining.some(p => p.kind === problemKind);
}

/**
 * Binary search over a continuous range [lo, hi].
 * Returns the minimum value in [lo, hi] at which `test` returns true,
 * or null if test(hi) returns false (unsolvable in range).
 */
function binarySearchContinuous(
  lo: number,
  hi: number,
  precision: number,
  applyLever: (value: number) => ProjectionEngineInputs,
  test: (inputs: ProjectionEngineInputs) => boolean,
): number | null {
  if (!test(applyLever(hi))) return null;
  if (test(applyLever(lo))) return lo; // already solved — no change needed

  for (let i = 0; i < 50 && hi - lo > precision; i++) {
    const mid = (lo + hi) / 2;
    if (test(applyLever(mid))) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
}

/**
 * Binary search over an integer range [lo, hi].
 * Returns the minimum integer in [lo, hi] at which `test` returns true,
 * or null if test(hi) is false (unsolvable in range).
 */
function binarySearchInteger(
  lo: number,
  hi: number,
  applyLever: (value: number) => ProjectionEngineInputs,
  test: (inputs: ProjectionEngineInputs) => boolean,
): number | null {
  if (!test(applyLever(hi))) return null;
  if (test(applyLever(lo))) return lo;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (test(applyLever(mid))) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return hi;
}

/**
 * Pick the highest-balance immediate asset for FLOW_TO_ASSET back-solve.
 * Falls back to any active asset if none are immediate.
 */
function pickFlowAsset(
  assetsWithAvailability: AssetItem[],
): AssetItem | null {
  const active = assetsWithAvailability.filter(a => a.isActive !== false);

  const immediate = active
    .filter(a => !a.availability || a.availability.type === 'immediate')
    .sort((a, b) => b.balance - a.balance);
  if (immediate.length > 0) return immediate[0];

  // Fall back to any active asset (e.g., all assets are locked)
  return active.sort((a, b) => b.balance - a.balance)[0] ?? null;
}

/**
 * Pick the highest-balance asset for CHANGE_ASSET_GROWTH_RATE back-solve.
 *
 * For BRIDGE_GAP: prefer immediate (liquid) assets — growing a locked pension
 * faster does nothing for a gap in liquid savings before the pension unlocks.
 * For LONGEVITY_GAP: any highest-balance asset, since all assets eventually
 * contribute to the total portfolio.
 */
function pickGrowthAsset(
  assetsWithAvailability: AssetItem[],
  inputs: ProjectionEngineInputs,
  problemKind: ProblemKind,
): { assetId: string; assetName: string; currentGrowthRatePct: number } | null {
  const active = assetsWithAvailability.filter(a => a.isActive !== false);

  let candidates = active;
  // For both BRIDGE_GAP and LONGEVITY_GAP, prefer immediate (liquid) assets.
  // depletionAge is triggered when withdrawable (liquid) assets hit zero, so growing
  // a locked pension faster doesn't fix the depletion that drives either gap.
  const immediate = active.filter(
    a => !a.availability || a.availability.type === 'immediate',
  );
  if (immediate.length > 0) candidates = immediate;

  const sorted = candidates.slice().sort((a, b) => b.balance - a.balance);
  if (sorted.length === 0) return null;

  const best = sorted[0];
  const engineAsset = inputs.assetsToday.find(a => a.id === best.id);
  const currentGrowthRatePct =
    typeof engineAsset?.annualGrowthRatePct === 'number' ? engineAsset.annualGrowthRatePct : 0;

  return { assetId: best.id, assetName: best.name, currentGrowthRatePct };
}

// ─── Main solver ──────────────────────────────────────────────────────────────

/**
 * Back-solves all four levers for the given problem.
 *
 * @param baseline               Baseline projection inputs (no scenario applied)
 * @param assetsWithAvailability Full asset list from SnapshotState (availability metadata)
 * @param problem                The detected problem to eliminate
 */
export function backSolve(
  baseline: ProjectionEngineInputs,
  assetsWithAvailability: AssetItem[],
  problem: DetectedProblem,
): BackSolveResult {
  const { currentAge, endAge, retirementAge } = baseline;
  const problemKind: ProblemKind = problem.kind;

  const test = (candidate: ProjectionEngineInputs): boolean =>
    isProblemSolved(candidate, assetsWithAvailability, problemKind);

  const levers: LeverSolution[] = [];

  // ── Lever 1: CHANGE_RETIREMENT_AGE ──────────────────────────────────────
  {
    const lo = retirementAge + 1; // start searching one year later than baseline
    const hi = Math.min(endAge - 1, retirementAge + 20); // cap at 20 years later
    if (lo <= hi) {
      const solvedValue = binarySearchInteger(
        lo,
        hi,
        age => ({ ...baseline, retirementAge: age }),
        test,
      );
      levers.push({
        kind: 'CHANGE_RETIREMENT_AGE',
        solvedValue,
        sliderMin: retirementAge,
        sliderMax: hi,
        sliderStep: 1,
        label: 'Retire later',
      });
    }
  }

  // ── Lever 2: FLOW_TO_ASSET ───────────────────────────────────────────────
  {
    const flowAsset = pickFlowAsset(assetsWithAvailability);
    if (flowAsset) {
      const MAX_MONTHLY = 5000;

      const solvedValue = binarySearchContinuous(
        0,
        MAX_MONTHLY,
        1, // £1 precision
        extraMonthly => {
          const mergedContribs = baseline.assetContributionsMonthly.map(c =>
            c.assetId === flowAsset.id
              ? { ...c, amountMonthly: c.amountMonthly + extraMonthly }
              : c,
          );
          // If asset has no existing contribution entry, append one
          const hasEntry = baseline.assetContributionsMonthly.some(c => c.assetId === flowAsset.id);
          if (!hasEntry) {
            mergedContribs.push({ assetId: flowAsset.id, amountMonthly: extraMonthly });
          }
          return { ...baseline, assetContributionsMonthly: mergedContribs };
        },
        test,
      );

      levers.push({
        kind: 'FLOW_TO_ASSET',
        solvedValue,
        assetId: flowAsset.id,
        assetName: flowAsset.name,
        sliderMin: 0,
        sliderMax: MAX_MONTHLY,
        sliderStep: 25,
        label: 'Invest more',
      });
    }
  }

  // ── Lever 3: REDUCE_EXPENSES ─────────────────────────────────────────────
  {
    const currentExpenses = baseline.monthlyExpensesReal ?? 0;
    if (currentExpenses > 0) {
      const MAX_REDUCTION = currentExpenses * 0.9; // can reduce up to 90% of expenses

      const solvedValue = binarySearchContinuous(
        0,
        MAX_REDUCTION,
        1, // £1 precision
        reductionMonthly => ({
          ...baseline,
          monthlyExpensesReal: Math.max(0, currentExpenses - reductionMonthly),
        }),
        test,
      );

      levers.push({
        kind: 'REDUCE_EXPENSES',
        solvedValue,
        sliderMin: 0,
        sliderMax: Math.ceil(MAX_REDUCTION / 50) * 50, // round up to nearest £50
        sliderStep: 25,
        label: 'Spend less',
      });
    }
  }

  // ── Lever 4: CHANGE_ASSET_GROWTH_RATE ───────────────────────────────────
  {
    const growthTarget = pickGrowthAsset(assetsWithAvailability, baseline, problemKind);
    if (growthTarget) {
      const { assetId, assetName, currentGrowthRatePct } = growthTarget;
      const MAX_GROWTH_PCT = 20; // 20% annual growth — ceiling for "optimistic" scenario
      const hi = Math.max(MAX_GROWTH_PCT, currentGrowthRatePct + 1);

      const solvedValue = binarySearchContinuous(
        currentGrowthRatePct,
        hi,
        0.1, // 0.1% precision
        newRatePct => ({
          ...baseline,
          assetsToday: baseline.assetsToday.map(a =>
            a.id === assetId ? { ...a, annualGrowthRatePct: newRatePct } : a,
          ),
        }),
        test,
      );

      levers.push({
        kind: 'CHANGE_ASSET_GROWTH_RATE',
        solvedValue,
        assetId,
        assetName,
        sliderMin: 0,
        sliderMax: hi,
        sliderStep: 0.5,
        label: 'Grow faster',
      });
    }
  }

  return { problem, levers };
}

// ─── Goal-seeking: earliest retirement age ───────────────────────────────────

/**
 * Checks whether a set of projection inputs has no problems of any kind.
 */
function isGapFree(
  candidate: ProjectionEngineInputs,
  assetsWithAvailability: AssetItem[],
): boolean {
  const liquidSeries = computeLiquidAssetsSeries(candidate, assetsWithAvailability);
  const summary = computeProjectionSummary(candidate);
  const problems = detectProblems({
    inputs: candidate,
    assetsWithAvailability,
    liquidAssetsSeries: liquidSeries,
    depletionAge: summary.depletionAge,
  });
  return problems.length === 0;
}

export interface EarliestRetirementResult {
  /**
   * Minimum retirement age where all funding gaps are resolved, or null if
   * no age within the search range achieves this.
   */
  earliestAge: number | null;
  /** Problems detected at the current planned retirement age. */
  currentProblems: DetectedProblem[];
  /**
   * Minimum retirement age that resolves the bridge gap alone.
   * Null if no bridge gap exists at the current plan, or if unsolvable in range.
   */
  bridgeGapMinAge: number | null;
  /**
   * Minimum retirement age that resolves the longevity gap alone.
   * Null if no longevity gap exists at the current plan, or if unsolvable in range.
   */
  longevityGapMinAge: number | null;
}

/**
 * Back-solves for the earliest retirement age that has no funding gaps.
 *
 * Searches from a minimum floor (age 50 or currentAge+5) up to 20 years
 * beyond the current planned retirement age. This correctly handles the case
 * where the current plan already has gaps — it finds the minimum LATER age
 * that resolves them.
 *
 * Also computes per-gap minimum ages (bridge gap alone, longevity gap alone)
 * so the caller can explain each gap individually, matching the Problem Solver output.
 */
export function backSolveEarliestRetirement(
  baseline: ProjectionEngineInputs,
  assetsWithAvailability: AssetItem[],
): EarliestRetirementResult {
  const { retirementAge, currentAge, endAge } = baseline;
  const lo = Math.max(50, currentAge + 5);
  // Search up to 20 years beyond the current plan, capped at endAge - 1
  const hi = Math.min(endAge - 1, Math.max(retirementAge, lo) + 20);

  // Detect what problems exist at the current planned retirement age
  const currentLiquidSeries = computeLiquidAssetsSeries(baseline, assetsWithAvailability);
  const currentSummary = computeProjectionSummary(baseline);
  const currentProblems = detectProblems({
    inputs: baseline,
    assetsWithAvailability,
    liquidAssetsSeries: currentLiquidSeries,
    depletionAge: currentSummary.depletionAge,
  });

  const hasBridgeGap = currentProblems.some(p => p.kind === 'BRIDGE_GAP');
  const hasLongevityGap = currentProblems.some(p => p.kind === 'LONGEVITY_GAP');
  const applyAge = (age: number) => ({ ...baseline, retirementAge: age });

  // Per-gap minimum ages (only computed when that gap actually exists)
  const bridgeGapMinAge = hasBridgeGap
    ? binarySearchInteger(lo, hi, applyAge, c => isProblemSolved(c, assetsWithAvailability, 'BRIDGE_GAP')) ?? null
    : null;

  const longevityGapMinAge = hasLongevityGap
    ? binarySearchInteger(lo, hi, applyAge, c => isProblemSolved(c, assetsWithAvailability, 'LONGEVITY_GAP')) ?? null
    : null;

  // Minimum age where ALL gaps are gone
  const earliestAge =
    binarySearchInteger(lo, hi, applyAge, c => isGapFree(c, assetsWithAvailability)) ?? null;

  return { earliestAge, currentProblems, bridgeGapMinAge, longevityGapMinAge };
}
