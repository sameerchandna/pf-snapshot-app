/**
 * Balance Deep Dive Insight Framework
 * 
 * Phase 5.7.1: Observational insights for Balance Deep Dive screen only.
 * Phase 5.7.2: Savings-specific balance insights.
 * 
 * This framework is distinct from:
 * - ProjectionResultsScreen ValuesCard insights (Phase 5.5)
 * - Hero Insights (Phase 5.5)
 * - Attribution logic
 * - Snapshot insights
 * 
 * Insights are:
 * - Single-sentence
 * - Template-based
 * - Observational only
 * - Visually provable from the chart
 * - Read-only
 */

import { UI_TOLERANCE, ATTRIBUTION_TOLERANCE } from './constants';

/**
 * Balance Insight type for Balance Deep Dive only.
 */
export type BalanceInsight = {
  id: string;
  balanceType: 'savings' | 'mortgage';
  sentence: string; // Exactly one sentence
  age: number; // Age at which this insight is relevant
  chartRef: {
    series: 'contributions' | 'growth' | 'principal' | 'interest' | 'balance';
    pointIndex?: number; // Optional index into time series array
    rangeStartIndex?: number; // Optional start of range
    rangeEndIndex?: number; // Optional end of range
  };
};

/**
 * Asset time series point structure (from computeSingleAssetTimeSeries)
 */
export type AssetTimeSeriesPoint = {
  age: number;
  balance: number;
  cumulativeContributions: number;
  cumulativeGrowth: number;
};

/**
 * Liability time series point structure (from computeSingleLiabilityTimeSeries)
 */
export type LiabilityTimeSeriesPoint = {
  age: number;
  balance: number;
  cumulativePrincipalPaid: number;
  cumulativeInterestPaid: number;
};

/**
 * Generate balance insights for savings assets.
 * 
 * Phase 5.7.2: Implements three observational insight categories:
 * 1. Contribution dominance (contributions > 60% of balance)
 * 2. Growth dominance / acceleration (growth > 40% of balance, or accelerating)
 * 3. Balance milestone (balance reaches 2x, 3x, 4x, or 5x starting balance)
 * 
 * Insights are suppressed if:
 * - Data is missing or inconsistent
 * - Dominance flips back and forth across nearby ages (stability check)
 * - Conditions are marginal or noisy (thresholds ensure clarity)
 * 
 * @param timeSeries - Asset time series data
 * @param selectedAge - Currently selected age (for filtering insights)
 * @returns Array of BalanceInsight (0-3 insights, max one per category)
 */
export function generateSavingsInsights(
  timeSeries: AssetTimeSeriesPoint[],
  selectedAge: number
): BalanceInsight[] {
  // Defensive guards: return empty array if data is invalid
  if (!Array.isArray(timeSeries) || timeSeries.length === 0) {
    return [];
  }

  if (!Number.isFinite(selectedAge) || selectedAge < 0) {
    return [];
  }

  // Validate time series structure
  const hasValidStructure = timeSeries.every(point => 
    Number.isFinite(point.age) &&
    Number.isFinite(point.balance) &&
    Number.isFinite(point.cumulativeContributions) &&
    Number.isFinite(point.cumulativeGrowth)
  );

  if (!hasValidStructure) {
    return [];
  }

  // Find point at or near selectedAge (for stability, use closest point)
  const selectedPointIndex = timeSeries.findIndex(p => Math.floor(p.age) >= selectedAge);
  const currentPointIndex = selectedPointIndex >= 0 
    ? selectedPointIndex 
    : timeSeries.length - 1;
  
  const currentPoint = timeSeries[currentPointIndex];
  const firstPoint = timeSeries[0];

  // Extract values with defensive checks
  const startingBalance = firstPoint.balance;
  const currentBalance = currentPoint.balance;
  const currentContributions = currentPoint.cumulativeContributions;
  const currentGrowth = currentPoint.cumulativeGrowth;

  // Suppress insights if balance is too small (noisy/marginal)
  if (Math.abs(currentBalance) < UI_TOLERANCE * 100) {
    return [];
  }

  // Suppress if starting balance is invalid (needed for milestones and ratios)
  if (!Number.isFinite(startingBalance) || Math.abs(startingBalance) < UI_TOLERANCE) {
    return [];
  }

  const insights: BalanceInsight[] = [];

  // ============================================================================
  // INSIGHT 1: Contribution Dominance
  // ============================================================================
  // Observational: When contributions represent a clear majority of the balance,
  // this is visually evident in the stacked chart (contributions layer dominates).
  // Visual provability: The contributions area in the stacked chart is larger than
  // the growth area, making this observation directly verifiable.
  // Threshold: 60% ensures clear dominance (not marginal).
  // Stability: Check that dominance holds at nearby points to prevent flickering.
  {
    const contributionRatio = currentBalance > UI_TOLERANCE
      ? currentContributions / currentBalance
      : 0;

    // Threshold: contributions must be at least 60% of balance (clear dominance)
    if (contributionRatio >= 0.60 && currentContributions > UI_TOLERANCE * 10) {
      // Stability check: verify dominance holds at adjacent points (within 2 years)
      const ageWindow = 2;
      const nearbyPoints = timeSeries.filter(p => 
        Math.abs(p.age - currentPoint.age) <= ageWindow
      );
      
      const isStable = nearbyPoints.every(p => {
        const pBalance = p.balance;
        if (Math.abs(pBalance) < UI_TOLERANCE) return false;
        const pRatio = p.cumulativeContributions / pBalance;
        return pRatio >= 0.55; // Slightly lower threshold for stability (allows small variation)
      });

      if (isStable && nearbyPoints.length >= 2) {
        const contributionPct = Math.round(contributionRatio * 100);
        insights.push({
          id: 'SAVINGS_CONTRIBUTION_DOMINANCE',
          balanceType: 'savings',
          sentence: `Contributions account for ${contributionPct}% of the balance at age ${Math.round(currentPoint.age)}.`,
          age: currentPoint.age,
          chartRef: {
            series: 'contributions',
            pointIndex: currentPointIndex,
          },
        });
      }
    }
  }

  // ============================================================================
  // INSIGHT 2: Growth Dominance / Acceleration
  // ============================================================================
  // Observational: When growth represents a significant portion of balance, or
  // when growth is accelerating, this is visible in the chart's growth layer.
  // Visual provability: The growth area in the stacked chart is substantial,
  // or the growth curve shows acceleration (steeper slope over time).
  // Threshold: 40% ensures growth is meaningful (not marginal).
  // Stability: Check that growth dominance/acceleration is consistent.
  // Preference: Show dominance if both conditions are met (dominance is clearer).
  {
    const growthRatio = currentBalance > UI_TOLERANCE
      ? currentGrowth / currentBalance
      : 0;

    // Option A: Growth dominance (growth >= 40% of balance)
    // This is the primary growth insight - prefer it over acceleration
    if (growthRatio >= 0.40 && currentGrowth > UI_TOLERANCE * 10) {
      // Stability check: verify growth dominance holds at nearby points
      const ageWindow = 2;
      const nearbyPoints = timeSeries.filter(p => 
        Math.abs(p.age - currentPoint.age) <= ageWindow
      );
      
      const isStable = nearbyPoints.every(p => {
        const pBalance = p.balance;
        if (Math.abs(pBalance) < UI_TOLERANCE) return false;
        const pRatio = p.cumulativeGrowth / pBalance;
        return pRatio >= 0.35; // Slightly lower threshold for stability
      });

      if (isStable && nearbyPoints.length >= 2) {
        const growthPct = Math.round(growthRatio * 100);
        insights.push({
          id: 'SAVINGS_GROWTH_DOMINANCE',
          balanceType: 'savings',
          sentence: `Growth accounts for ${growthPct}% of the balance at age ${Math.round(currentPoint.age)}.`,
          age: currentPoint.age,
          chartRef: {
            series: 'growth',
            pointIndex: currentPointIndex,
          },
        });
      }
    } else if (growthRatio >= 0.10 && currentGrowth > UI_TOLERANCE * 10) {
      // Option B: Growth acceleration (only if dominance doesn't apply)
      // Check if growth is accelerating by comparing recent growth increments
      // This is observational: acceleration is visible as a steeper growth curve
      // Visual provability: The growth layer shows increasing slope over time
      if (currentPointIndex >= 3) {
        const recentPoints = timeSeries.slice(Math.max(0, currentPointIndex - 2), currentPointIndex + 1);
        if (recentPoints.length >= 3) {
          // Calculate growth increments between consecutive points
          const growthIncrements: number[] = [];
          for (let i = 1; i < recentPoints.length; i++) {
            const prevGrowth = recentPoints[i - 1].cumulativeGrowth;
            const currGrowth = recentPoints[i].cumulativeGrowth;
            const increment = currGrowth - prevGrowth;
            if (increment > UI_TOLERANCE) {
              growthIncrements.push(increment);
            }
          }

          // Check if increments are increasing (acceleration)
          // Stability: require at least 2 increments and consistent acceleration
          if (growthIncrements.length >= 2) {
            const isAccelerating = growthIncrements.every((inc, idx) => 
              idx === 0 || inc >= growthIncrements[idx - 1] * 0.95 // Allow 5% tolerance for stability
            );

            // Only show acceleration if it's clear and meaningful
            // Suppress if marginal or noisy (growth must be > 10% of balance)
            if (isAccelerating) {
              insights.push({
                id: 'SAVINGS_GROWTH_ACCELERATION',
                balanceType: 'savings',
                sentence: `Growth is accelerating, contributing ${Math.round(growthRatio * 100)}% to the balance at age ${Math.round(currentPoint.age)}.`,
                age: currentPoint.age,
                chartRef: {
                  series: 'growth',
                  pointIndex: currentPointIndex,
                },
              });
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // INSIGHT 3: Balance Milestone
  // ============================================================================
  // Observational: When balance reaches a clear multiple of starting balance
  // (2x, 3x, 4x, or 5x), this is a visible milestone in the chart.
  // Visual provability: The balance line crosses clear multiples of the starting
  // balance, making this observation directly verifiable from the chart.
  // Threshold: Use 0.95x multiplier to account for rounding (e.g., 1.95x ≈ 2x).
  // Stability: Check that milestone is crossed (not just touched) to prevent
  // flickering when balance hovers near a multiple.
  {
    const multiplier = startingBalance > UI_TOLERANCE
      ? currentBalance / startingBalance
      : 0;

    // Check for milestones: 2x, 3x, 4x, or 5x (max 5x to avoid noise)
    const milestones = [2, 3, 4, 5];
    for (const targetMultiplier of milestones) {
      // Check if we've crossed this milestone (within 5% tolerance)
      const lowerBound = targetMultiplier * 0.95;
      const upperBound = targetMultiplier * 1.05;

      if (multiplier >= lowerBound && multiplier <= upperBound) {
        // Stability check: verify milestone is crossed (not just touched)
        // Check that we're past the milestone at current point and were below it earlier
        if (currentPointIndex > 0) {
          const prevPoint = timeSeries[currentPointIndex - 1];
          const prevMultiplier = startingBalance > UI_TOLERANCE
            ? prevPoint.balance / startingBalance
            : 0;

          // Milestone is crossed if previous point was below threshold and current is at/above
          const wasBelow = prevMultiplier < lowerBound;
          const isAtOrAbove = multiplier >= lowerBound;

          if (wasBelow && isAtOrAbove) {
            insights.push({
              id: `SAVINGS_MILESTONE_${targetMultiplier}X`,
              balanceType: 'savings',
              sentence: `Balance has reached ${targetMultiplier}x the starting balance at age ${Math.round(currentPoint.age)}.`,
              age: currentPoint.age,
              chartRef: {
                series: 'balance',
                pointIndex: currentPointIndex,
              },
            });
            break; // Only show one milestone at a time (most recent)
          }
        }
      }
    }
  }

  // Return insights (max 3, one per category)
  // Insights are already filtered by stability and thresholds above
  return insights;
}

/**
 * Generate balance insights for mortgage/loan liabilities.
 * 
 * Phase 5.7.3: Implements three observational insight categories:
 * 1. Interest drag dominance (interest > 50% of total payments)
 * 2. Principal acceleration (principal repayment rate is increasing)
 * 3. Loan payoff moment (balance reaches zero, aligns with existing payoff detection)
 * 
 * Insights are suppressed if:
 * - Data is missing or inconsistent
 * - Dominance flips back and forth across nearby ages (stability check)
 * - Conditions are marginal or noisy (thresholds ensure clarity)
 * 
 * @param timeSeries - Liability time series data
 * @param selectedAge - Currently selected age (for filtering insights)
 * @returns Array of BalanceInsight (0-3 insights, max one per category)
 */
export function generateMortgageInsights(
  timeSeries: LiabilityTimeSeriesPoint[],
  selectedAge: number
): BalanceInsight[] {
  // Defensive guards: return empty array if data is invalid
  if (!Array.isArray(timeSeries) || timeSeries.length === 0) {
    return [];
  }

  if (!Number.isFinite(selectedAge) || selectedAge < 0) {
    return [];
  }

  // Validate time series structure
  const hasValidStructure = timeSeries.every(point => 
    Number.isFinite(point.age) &&
    Number.isFinite(point.balance) &&
    Number.isFinite(point.cumulativePrincipalPaid) &&
    Number.isFinite(point.cumulativeInterestPaid)
  );

  if (!hasValidStructure) {
    return [];
  }

  // Find point at or near selectedAge (for stability, use closest point)
  const selectedPointIndex = timeSeries.findIndex(p => Math.floor(p.age) >= selectedAge);
  const currentPointIndex = selectedPointIndex >= 0 
    ? selectedPointIndex 
    : timeSeries.length - 1;
  
  const currentPoint = timeSeries[currentPointIndex];
  const firstPoint = timeSeries[0];

  // Extract values with defensive checks
  const originalBalance = firstPoint.balance;
  const currentBalance = currentPoint.balance;
  const currentPrincipalPaid = currentPoint.cumulativePrincipalPaid;
  const currentInterestPaid = currentPoint.cumulativeInterestPaid;
  const totalPayments = currentPrincipalPaid + currentInterestPaid;

  // Suppress insights if original balance is invalid (needed for ratios)
  if (!Number.isFinite(originalBalance) || Math.abs(originalBalance) < UI_TOLERANCE) {
    return [];
  }

  // Suppress insights if total payments are too small (noisy/marginal)
  if (totalPayments < UI_TOLERANCE * 100) {
    return [];
  }

  const insights: BalanceInsight[] = [];

  // ============================================================================
  // INSIGHT 1: Interest Drag Dominance
  // ============================================================================
  // Observational: When interest represents a clear majority of total payments,
  // this is visually evident in the stacked chart (interest area dominates).
  // Visual provability: The interest area in the stacked chart is larger than
  // the principal area, making this observation directly verifiable.
  // Threshold: 50% ensures clear dominance (interest > principal).
  // Stability: Check that dominance holds at nearby points to prevent flickering.
  // This is observational: we describe what the chart shows, not advice.
  {
    const interestRatio = totalPayments > UI_TOLERANCE
      ? currentInterestPaid / totalPayments
      : 0;

    // Threshold: interest must be at least 50% of total payments (clear dominance)
    if (interestRatio >= 0.50 && currentInterestPaid > UI_TOLERANCE * 10) {
      // Stability check: verify dominance holds at adjacent points (within 2 years)
      const ageWindow = 2;
      const nearbyPoints = timeSeries.filter(p => 
        Math.abs(p.age - currentPoint.age) <= ageWindow
      );
      
      const isStable = nearbyPoints.every(p => {
        const pTotal = p.cumulativePrincipalPaid + p.cumulativeInterestPaid;
        if (pTotal < UI_TOLERANCE) return false;
        const pRatio = p.cumulativeInterestPaid / pTotal;
        return pRatio >= 0.45; // Slightly lower threshold for stability (allows small variation)
      });

      if (isStable && nearbyPoints.length >= 2) {
        const interestPct = Math.round(interestRatio * 100);
        insights.push({
          id: 'MORTGAGE_INTEREST_DRAG_DOMINANCE',
          balanceType: 'mortgage',
          sentence: `Interest accounts for ${interestPct}% of total payments at age ${Math.round(currentPoint.age)}.`,
          age: currentPoint.age,
          chartRef: {
            series: 'interest',
            pointIndex: currentPointIndex,
          },
        });
      }
    }
  }

  // ============================================================================
  // INSIGHT 2: Principal Acceleration
  // ============================================================================
  // Observational: When principal repayment rate is accelerating over time,
  // this is visible in the chart's principal curve (steeper slope).
  // Visual provability: The principal area shows increasing slope over time,
  // indicating acceleration in principal repayment.
  // Threshold: Require meaningful principal paid (> 10% of original balance)
  // and clear acceleration pattern.
  // Stability: Check that acceleration is consistent across recent points.
  // This is observational: we describe the visible trend, not advice.
  {
    // Only check acceleration if principal is meaningful (> 10% of original balance)
    const principalRatio = originalBalance > UI_TOLERANCE
      ? currentPrincipalPaid / originalBalance
      : 0;

    if (principalRatio >= 0.10 && currentPrincipalPaid > UI_TOLERANCE * 10) {
      // Check if principal repayment is accelerating by comparing recent increments
      // This requires at least 3 points to detect acceleration pattern
      if (currentPointIndex >= 3) {
        const recentPoints = timeSeries.slice(Math.max(0, currentPointIndex - 2), currentPointIndex + 1);
        if (recentPoints.length >= 3) {
          // Calculate principal increments between consecutive points
          const principalIncrements: number[] = [];
          for (let i = 1; i < recentPoints.length; i++) {
            const prevPrincipal = recentPoints[i - 1].cumulativePrincipalPaid;
            const currPrincipal = recentPoints[i].cumulativePrincipalPaid;
            const increment = currPrincipal - prevPrincipal;
            if (increment > UI_TOLERANCE) {
              principalIncrements.push(increment);
            }
          }

          // Check if increments are increasing (acceleration)
          // Stability: require at least 2 increments and consistent acceleration
          if (principalIncrements.length >= 2) {
            const isAccelerating = principalIncrements.every((inc, idx) => 
              idx === 0 || inc >= principalIncrements[idx - 1] * 0.95 // Allow 5% tolerance for stability
            );

            // Only show acceleration if it's clear and meaningful
            // Suppress if marginal or noisy (principal must be > 10% of original)
            if (isAccelerating) {
              const principalPct = Math.round(principalRatio * 100);
              insights.push({
                id: 'MORTGAGE_PRINCIPAL_ACCELERATION',
                balanceType: 'mortgage',
                sentence: `Principal repayment is accelerating, with ${principalPct}% of the original balance repaid at age ${Math.round(currentPoint.age)}.`,
                age: currentPoint.age,
                chartRef: {
                  series: 'principal',
                  pointIndex: currentPointIndex,
                },
              });
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // INSIGHT 3: Loan Payoff Moment
  // ============================================================================
  // Observational: When the loan balance reaches zero (within tolerance),
  // this is a visible milestone in the chart (balance line reaches zero).
  // Visual provability: The balance line crosses zero, making this observation
  // directly verifiable from the chart.
  // Alignment: Uses ATTRIBUTION_TOLERANCE (£1.00) to match existing payoff
  // detection logic in BalanceDeepDiveScreen.
  // Stability: Only trigger once when balance crosses from above tolerance to
  // within tolerance (prevents flickering if balance hovers near zero).
  // This is observational: we describe when the loan is paid off, not advice.
  {
    // Check if loan is paid off (balance <= ATTRIBUTION_TOLERANCE, matching existing logic)
    if (currentBalance <= ATTRIBUTION_TOLERANCE && currentBalance >= 0) {
      // Stability check: verify payoff is crossed (not just touched)
      // Check that we're at/within tolerance at current point and were above it earlier
      if (currentPointIndex > 0) {
        const prevPoint = timeSeries[currentPointIndex - 1];
        const wasAbove = prevPoint.balance > ATTRIBUTION_TOLERANCE;
        const isAtOrBelow = currentBalance <= ATTRIBUTION_TOLERANCE;

        // Payoff is crossed if previous point was above tolerance and current is at/within
        if (wasAbove && isAtOrBelow) {
          insights.push({
            id: 'MORTGAGE_PAYOFF_MOMENT',
            balanceType: 'mortgage',
            sentence: `Loan is fully repaid at age ${Math.round(currentPoint.age)}.`,
            age: currentPoint.age,
            chartRef: {
              series: 'balance',
              pointIndex: currentPointIndex,
            },
          });
        }
      } else if (currentPointIndex === 0 && currentBalance <= ATTRIBUTION_TOLERANCE) {
        // Edge case: loan starts paid off (unusual but handle gracefully)
        // Only show if balance is exactly zero (not just within tolerance)
        if (Math.abs(currentBalance) < UI_TOLERANCE) {
          insights.push({
            id: 'MORTGAGE_PAYOFF_MOMENT',
            balanceType: 'mortgage',
            sentence: `Loan is fully repaid at age ${Math.round(currentPoint.age)}.`,
            age: currentPoint.age,
            chartRef: {
              series: 'balance',
              pointIndex: currentPointIndex,
            },
          });
        }
      }
    }
  }

  // Return insights (max 3, one per category)
  // Insights are already filtered by stability and thresholds above
  return insights;
}
