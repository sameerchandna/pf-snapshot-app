/**
 * Phase 10.1: Interpretation engine
 *
 * Pure function that takes projection data → InterpretationResult.
 * Absorbs and replaces insightEngine.ts (Phase 5.4/5.5).
 *
 * Responsibilities:
 * - Key moment detection (debt-free, net worth positive, assets exceed liabilities)
 * - Net worth milestone detection (£100k, £250k, £500k, £1M)
 * - Trajectory analysis (growing / shrinking / flat)
 * - FI number and progress calculation (expenses × 25 rule)
 * - Retirement readiness (UK state pension age 67)
 * - Goal assessment (on-track / off-track / achieved)
 * - Headline and subline generation (observational only, never prescriptive)
 */

import { UI_TOLERANCE } from '../constants';
import { GoalConfig } from '../types';
import { ProjectionSeriesPoint, ProjectionSummary } from '../engines/projectionEngine';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MomentType =
  | 'DEBT_FREE'                  // first point where liabilities <= UI_TOLERANCE
  | 'NET_WORTH_POSITIVE'         // first crossing from negative to non-negative
  | 'ASSETS_EXCEED_LIABILITIES'  // first crossing where assets >= liabilities
  | 'NET_WORTH_100K'
  | 'NET_WORTH_250K'
  | 'NET_WORTH_500K'
  | 'NET_WORTH_1M';

export type InterpretationKeyMoment = {
  type: MomentType;
  /** Age at which the moment occurs (may be fractional from series sampling) */
  age: number;
  /** Value at that point (real £, today's money) */
  value: number;
  /** Which chart series this dot belongs on */
  seriesId: 'netWorth' | 'assets' | 'liabilities';
};

export type TrajectoryDirection = 'growing' | 'shrinking' | 'flat';

export type GoalAssessment = {
  goalType: GoalConfig['type'];
  label: string;
  status: 'on_track' | 'off_track' | 'achieved';
  /** Age at which goal target is reached, or null if never within projection */
  achievedAge: number | null;
  /** User-specified target age, if any */
  targetAge: number | null;
  /** Shortfall in £ at targetAge — null if on_track or achieved */
  gap: number | null;
};

export type InterpretationResult = {
  /** Single-sentence story headline */
  headline: string;
  /** 1–2 sentence supporting context */
  subline: string;

  endNetWorth: number;
  trajectory: TrajectoryDirection;

  /** FI number = monthlyExpenses × 12 × 25 */
  fiNumber: number;
  /** Net worth at start of projection / FI number, capped at 1.0 */
  fiProgress: number;

  /** UK state pension age */
  retirementAge: 67;
  netWorthAtRetirement: number;

  /** All detected moments, sorted by age ascending */
  keyMoments: InterpretationKeyMoment[];

  /** Goal assessments (0–N, one per active goal) */
  goals: GoalAssessment[];
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

const NET_WORTH_MILESTONES: Array<{ type: MomentType; threshold: number }> = [
  { type: 'NET_WORTH_100K', threshold: 100_000 },
  { type: 'NET_WORTH_250K', threshold: 250_000 },
  { type: 'NET_WORTH_500K', threshold: 500_000 },
  { type: 'NET_WORTH_1M',   threshold: 1_000_000 },
];

const UK_STATE_PENSION_AGE = 67 as const;
const FLAT_THRESHOLD_PCT = 0.02; // ±2% change over the projection → flat

function detectKeyMoments(
  series: ProjectionSeriesPoint[],
  liquidAssetsSeries?: number[],
): InterpretationKeyMoment[] {
  const moments: InterpretationKeyMoment[] = [];
  if (!series || series.length === 0) return moments;

  // DEBT_FREE: first point where liabilities <= UI_TOLERANCE
  const debtFreePoint = series.find(p => p.liabilities <= UI_TOLERANCE);
  if (debtFreePoint) {
    moments.push({
      type: 'DEBT_FREE',
      seriesId: 'liabilities',
      age: debtFreePoint.age,
      value: debtFreePoint.liabilities,
    });
  }

  // NET_WORTH_POSITIVE: first crossing from negative to non-negative
  if (series.length > 1) {
    let hasSeenNegative = false;
    for (const point of series) {
      if (point.netWorth < 0) {
        hasSeenNegative = true;
      } else if (hasSeenNegative && point.netWorth >= 0) {
        moments.push({
          type: 'NET_WORTH_POSITIVE',
          seriesId: 'netWorth',
          age: point.age,
          value: point.netWorth,
        });
        break;
      }
    }
  }

  // ASSETS_EXCEED_LIABILITIES: first crossing where assets >= liabilities
  // Uses liquid assets series if provided
  if (series.length > 1) {
    const assetsData = liquidAssetsSeries && liquidAssetsSeries.length > 0
      ? series.map((p, idx) => ({
          age: p.age,
          assets: idx < liquidAssetsSeries.length ? liquidAssetsSeries[idx] : 0,
          liabilities: p.liabilities,
        }))
      : series.map(p => ({ age: p.age, assets: p.assets, liabilities: p.liabilities }));

    let hasSeenBelow = false;
    for (const point of assetsData) {
      if (point.assets < point.liabilities) {
        hasSeenBelow = true;
      } else if (hasSeenBelow && point.assets >= point.liabilities) {
        moments.push({
          type: 'ASSETS_EXCEED_LIABILITIES',
          seriesId: 'assets',
          age: point.age,
          value: point.assets,
        });
        break;
      }
    }
  }

  // Net worth milestone crossings
  for (const { type, threshold } of NET_WORTH_MILESTONES) {
    let hasSeenBelow = false;
    for (const point of series) {
      if (point.netWorth < threshold) {
        hasSeenBelow = true;
      } else if (hasSeenBelow && point.netWorth >= threshold) {
        moments.push({
          type,
          seriesId: 'netWorth',
          age: point.age,
          value: point.netWorth,
        });
        break;
      }
    }
  }

  // Sort all moments by age ascending
  return moments.sort((a, b) => a.age - b.age);
}

function computeTrajectory(series: ProjectionSeriesPoint[]): TrajectoryDirection {
  if (series.length < 2) return 'flat';
  const third = Math.max(1, Math.floor(series.length / 3));
  const firstThirdAvg =
    series.slice(0, third).reduce((sum, p) => sum + p.netWorth, 0) / third;
  const lastThirdAvg =
    series.slice(-third).reduce((sum, p) => sum + p.netWorth, 0) / third;

  if (Math.abs(firstThirdAvg) < UI_TOLERANCE) return 'growing';

  const changePct = (lastThirdAvg - firstThirdAvg) / Math.abs(firstThirdAvg);
  if (changePct > FLAT_THRESHOLD_PCT) return 'growing';
  if (changePct < -FLAT_THRESHOLD_PCT) return 'shrinking';
  return 'flat';
}

function netWorthAtAge(series: ProjectionSeriesPoint[], targetAge: number): number {
  if (series.length === 0) return 0;
  // Find closest point at or after targetAge
  const point = series.find(p => p.age >= targetAge);
  return point ? point.netWorth : series[series.length - 1].netWorth;
}

function computeDefaultGoals(monthlyExpenses: number): GoalConfig[] {
  const annualExpenses = monthlyExpenses * 12;
  return [
    { type: 'fi', target: annualExpenses * 25 },
    { type: 'retirementIncome', target: annualExpenses, targetAge: UK_STATE_PENSION_AGE },
  ];
}

function assessGoal(
  goal: GoalConfig,
  series: ProjectionSeriesPoint[],
  monthlyExpenses: number,
): GoalAssessment {
  if (goal.type === 'fi') {
    const fiNumber = goal.target;
    // Find first age where netWorth >= fiNumber
    const achievedPoint = series.find(p => p.netWorth >= fiNumber);
    const achievedAge = achievedPoint ? achievedPoint.age : null;
    const targetAge = null;

    if (achievedAge !== null) {
      return {
        goalType: 'fi',
        label: 'Financial independence',
        status: 'on_track',
        achievedAge,
        targetAge,
        gap: null,
      };
    }
    // Off track — compute gap at end of projection
    const endNetWorth = series.length > 0 ? series[series.length - 1].netWorth : 0;
    return {
      goalType: 'fi',
      label: 'Financial independence',
      status: 'off_track',
      achievedAge: null,
      targetAge,
      gap: Math.max(0, fiNumber - endNetWorth),
    };
  }

  if (goal.type === 'netWorthMilestone') {
    const label = `£${Math.round(goal.target / 1000)}k net worth${goal.targetAge ? ` by ${goal.targetAge}` : ''}`;
    const achievedPoint = series.find(p => p.netWorth >= goal.target);
    const achievedAge = achievedPoint ? achievedPoint.age : null;
    const targetAge = goal.targetAge ?? null;

    if (targetAge !== null && achievedAge !== null && achievedAge <= targetAge) {
      return { goalType: 'netWorthMilestone', label, status: 'on_track', achievedAge, targetAge, gap: null };
    }
    if (targetAge !== null) {
      const nwAtTarget = netWorthAtAge(series, targetAge);
      if (nwAtTarget >= goal.target) {
        return { goalType: 'netWorthMilestone', label, status: 'on_track', achievedAge, targetAge, gap: null };
      }
      return {
        goalType: 'netWorthMilestone',
        label,
        status: 'off_track',
        achievedAge,
        targetAge,
        gap: Math.max(0, goal.target - nwAtTarget),
      };
    }
    // No target age — just on_track if reached at any point
    if (achievedAge !== null) {
      return { goalType: 'netWorthMilestone', label, status: 'on_track', achievedAge, targetAge: null, gap: null };
    }
    const endNetWorth = series.length > 0 ? series[series.length - 1].netWorth : 0;
    return {
      goalType: 'netWorthMilestone',
      label,
      status: 'off_track',
      achievedAge: null,
      targetAge: null,
      gap: Math.max(0, goal.target - endNetWorth),
    };
  }

  if (goal.type === 'retirementIncome') {
    const targetAge = goal.targetAge ?? UK_STATE_PENSION_AGE;
    const label = `Retirement income at ${targetAge}`;
    // Assess: does the 4% rule hold? i.e. netWorth at targetAge >= target * 25
    const nwAtTarget = netWorthAtAge(series, targetAge);
    const requiredNetWorth = goal.target * 25;
    if (nwAtTarget >= requiredNetWorth) {
      return {
        goalType: 'retirementIncome',
        label,
        status: 'on_track',
        achievedAge: targetAge,
        targetAge,
        gap: null,
      };
    }
    return {
      goalType: 'retirementIncome',
      label,
      status: 'off_track',
      achievedAge: null,
      targetAge,
      gap: Math.max(0, requiredNetWorth - nwAtTarget),
    };
  }

  // Fallback (exhaustive, should never reach)
  return {
    goalType: (goal as GoalConfig).type,
    label: 'Goal',
    status: 'off_track',
    achievedAge: null,
    targetAge: null,
    gap: null,
  };
}

function formatAge(age: number): string {
  return `age ${Math.round(age)}`;
}

function formatGBP(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000)    return `£${Math.round(value / 1_000)}k`;
  return `£${Math.round(value)}`;
}

function buildHeadlineAndSubline(
  series: ProjectionSeriesPoint[],
  summary: ProjectionSummary,
  trajectory: TrajectoryDirection,
  keyMoments: InterpretationKeyMoment[],
  fiNumber: number,
  endAge: number,
): { headline: string; subline: string } {
  const debtFree = keyMoments.find(m => m.type === 'DEBT_FREE');
  const nwPositive = keyMoments.find(m => m.type === 'NET_WORTH_POSITIVE');
  const fiReached = series.find(p => p.netWorth >= fiNumber);

  // Headline
  let headline: string;
  if (trajectory === 'shrinking') {
    const startNW = series.length > 0 ? series[0].netWorth : 0;
    const years = endAge - (series.length > 0 ? series[0].age : 0);
    headline = `Net worth is projected to decline from ${formatGBP(startNW)} to ${formatGBP(summary.endNetWorth)} over ${Math.round(years)} years.`;
  } else if (debtFree && Math.round(debtFree.age) > (series.length > 0 ? series[0].age : 0)) {
    headline = `Debt-free by ${formatAge(debtFree.age)}. Net worth reaches ${formatGBP(summary.endNetWorth)} by ${endAge}.`;
  } else {
    headline = `Net worth reaches ${formatGBP(summary.endNetWorth)} by ${endAge}.`;
  }

  // Subline
  const parts: string[] = [];
  if (trajectory === 'growing') parts.push('Net worth is on a growing trajectory.');
  else if (trajectory === 'flat')    parts.push('Net worth is broadly stable.');

  if (nwPositive) parts.push(`Net worth turns positive at ${formatAge(nwPositive.age)}.`);
  if (fiReached)  parts.push(`FI threshold reached at ${formatAge(fiReached.age)}.`);

  const subline = parts.join(' ') || 'Review the chart for a detailed breakdown.';

  return { headline, subline };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Interprets a projection and returns a structured result for display.
 *
 * Pure function — no side effects, no external calls.
 *
 * @param series           Yearly projection series (ProjectionSeriesPoint[])
 * @param summary          End-of-projection summary totals
 * @param monthlyExpenses  Total monthly expenses from snapshot (selectExpenses)
 * @param currentAge       User's current age (start of projection)
 * @param endAge           Projection end age
 * @param goals            User-defined goals from goalState; pass [] to use computed defaults
 * @param liquidAssetsSeries  Optional parallel array of liquid-asset balances for ASSETS_EXCEED_LIABILITIES
 */
export function interpretProjection(
  series: ProjectionSeriesPoint[],
  summary: ProjectionSummary,
  monthlyExpenses: number,
  currentAge: number,
  endAge: number,
  goals: GoalConfig[],
  liquidAssetsSeries?: number[],
): InterpretationResult {
  const keyMoments = detectKeyMoments(series, liquidAssetsSeries);
  const trajectory = computeTrajectory(series);

  const fiNumber = monthlyExpenses * 12 * 25;
  const startNetWorth = series.length > 0 ? series[0].netWorth : 0;
  const fiProgress = fiNumber > UI_TOLERANCE
    ? Math.min(1, Math.max(0, startNetWorth / fiNumber))
    : 1;

  const netWorthAtRetirement = netWorthAtAge(series, UK_STATE_PENSION_AGE);

  const { headline, subline } = buildHeadlineAndSubline(
    series,
    summary,
    trajectory,
    keyMoments,
    fiNumber,
    endAge,
  );

  // Use computed defaults when no goals have been user-customised
  const effectiveGoals = goals.length > 0
    ? goals
    : computeDefaultGoals(monthlyExpenses);

  const goalAssessments = effectiveGoals.map(g => assessGoal(g, series, monthlyExpenses));

  return {
    headline,
    subline,
    endNetWorth: summary.endNetWorth,
    trajectory,
    fiNumber,
    fiProgress,
    retirementAge: UK_STATE_PENSION_AGE,
    netWorthAtRetirement,
    keyMoments,
    goals: goalAssessments,
  };
}
