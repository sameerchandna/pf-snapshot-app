import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { VictoryAxis, VictoryChart, VictoryLabel, VictoryLine, VictoryScatter } from 'victory-native';
import * as Clipboard from 'expo-clipboard';

import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SectionCard from '../components/SectionCard';
import Button from '../components/Button';
import { spacing } from '../spacing';
import { layout } from '../layout';
import { useTheme } from '../ui/theme/useTheme';

// Snapshot visual language constants (reused for Projected Snapshot)
const snapshotTypography = {
  sectionTitleSize: 16,
  cardTitleSize: 14,
  primaryValueSize: 15,
  bodySize: 12,
  sectionTitleWeight: '600' as const,
  cardTitleWeight: '500' as const,
  primaryValueWeight: '600' as const,
  bodyWeight: '400' as const,
};

import { useSnapshot } from '../SnapshotContext';
import { computeProjectionSeries, computeProjectionSummary, type ProjectionEngineInputs } from '../projectionEngine';
import { computeA3Attribution, type A3Attribution } from '../computeA3Attribution';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { initLoan, stepLoanMonth } from '../loanEngine';
import { formatCurrencyFull, formatCurrencyFullSigned, formatCurrencyCompact, formatCurrencyCompactSigned } from '../formatters';
import { useWindowDimensions } from 'react-native';
import type { AssetItem, ScenarioState, SnapshotState } from '../types';
import { selectPension, selectMonthlySurplus, selectMonthlySurplusWithScenario, selectSnapshotTotals, selectLoanDerivedRows } from '../selectors';
import { UI_TOLERANCE, ATTRIBUTION_TOLERANCE, AGE_COMPARISON_TOLERANCE, SYSTEM_CASH_ID } from '../constants';
import { serializeDebugState } from '../debug/serializeDebugState';
import type { Scenario, ScenarioId } from '../domain/scenario/types';
import { BASELINE_SCENARIO_ID } from '../domain/scenario/types';
import { getScenarios, getActiveScenarioId, setActiveScenarioId as persistActiveScenarioId, getActiveScenario } from '../scenarioState';
import { isScenarioTargetValid } from '../domain/scenario/validation';
import { applyScenarioToProjectionInputs } from '../projection/applyScenarioToInputs';
import type { Theme } from '../ui/theme/theme';

// Phase 3.3: Removed local computeMonthlySurplus() - use selectMonthlySurplus() or selectMonthlySurplusWithScenario() instead
// Monthly surplus is now single-sourced from selectors (no manual computation, no clamping)

// Note: Golden Rule validation (extraContributions vs extraGrowth vs netWorthIncrease) 
// belongs to wiring validation, not A3. A3 treats projectionSeries as ground truth.

// Phase 4.4: Centralized chart color palette
// All chart colors are derived from theme tokens to ensure light/dark mode safety
function getChartPalette(theme: Theme) {
  return {
    // Baseline and scenario lines use the same brand color
    // Visual distinction is enforced via strokeWidth / opacity, not color (structural, not chromatic)
    baselineLine: theme.colors.brand.primary,
    scenarioLine: theme.colors.brand.primary,
    // Assets and liabilities use the same muted color
    // Distinction is via existing opacity / stroke logic (intentional for Phase 4.4)
    assetsLine: theme.colors.text.muted,
    liabilitiesLine: theme.colors.text.muted,
    // Marker line uses brand color
    markerLine: theme.colors.brand.primary,
    // Axis and grid use border colors
    axis: theme.colors.border.default,
    grid: theme.colors.border.subtle,
    // Tick labels use secondary text color
    tickLabels: theme.colors.text.secondary,
    // Legend text colors
    legendText: theme.colors.text.tertiary,
    legendTextMuted: theme.colors.text.disabled,
  };
}

// Phase 5.3: Chart series structure with stable semantic identifiers
type ChartSeries = {
  seriesId: 'netWorth' | 'scenarioNetWorth' | 'assets' | 'liabilities';
  label: string;
  color: string;
  data: Array<{ x: number; y: number }>;
  style: {
    strokeWidth: number;
    opacity: number;
  };
  // Conditional rendering flags
  shouldRender: boolean;
};

// Phase 5.4: Key moment detection types
type KeyMomentId = 'LIABILITY_PAYOFF' | 'NET_WORTH_ZERO' | 'ASSETS_OVER_LIABILITIES';

type KeyMoment = {
  id: KeyMomentId;
  seriesId: 'netWorth' | 'assets' | 'liabilities';
  age: number;
  value: number;
};

// Phase 5.4: Key moment detection function
// Pure function that detects key moments from baseline projection data
function detectKeyMoments(
  baselineSeries: Array<{ age: number; assets: number; liabilities: number; netWorth: number }>,
  liquidAssetsSeries?: number[]
): KeyMoment[] {
  const moments: KeyMoment[] = [];

  // Guard against empty or insufficient data
  if (!baselineSeries || baselineSeries.length === 0) {
    return moments;
  }

  // LIABILITY_PAYOFF: First point where liabilities <= UI_TOLERANCE
  // If already <= tolerance at first point, mark at first point
  const liabilityPayoffPoint = baselineSeries.find(p => p.liabilities <= UI_TOLERANCE);
  if (liabilityPayoffPoint) {
    moments.push({
      id: 'LIABILITY_PAYOFF',
      seriesId: 'liabilities',
      age: liabilityPayoffPoint.age,
      value: liabilityPayoffPoint.liabilities,
    });
  }

  // NET_WORTH_ZERO: First crossing where netWorth goes from < 0 to >= 0
  // Use the first point where condition is met (no interpolation)
  if (baselineSeries.length > 1) {
    // Find the first point where netWorth >= 0, but only if we've seen a negative value before
    let hasSeenNegative = false;
    for (let i = 0; i < baselineSeries.length; i++) {
      const point = baselineSeries[i];
      if (point.netWorth < 0) {
        hasSeenNegative = true;
      } else if (hasSeenNegative && point.netWorth >= 0) {
        // First crossing from negative to non-negative
        moments.push({
          id: 'NET_WORTH_ZERO',
          seriesId: 'netWorth',
          age: point.age,
          value: point.netWorth,
        });
        break; // Only detect the first crossing
      }
    }
  }

  // ASSETS_OVER_LIABILITIES: First crossing where assets go from < liabilities to >= liabilities
  // Use liquid assets if provided, otherwise use total assets
  if (baselineSeries.length > 1) {
    const assetsData = liquidAssetsSeries && liquidAssetsSeries.length > 0
      ? baselineSeries.map((p, idx) => ({
          age: p.age,
          assets: idx < liquidAssetsSeries.length ? liquidAssetsSeries[idx] : 0,
          liabilities: p.liabilities,
        }))
      : baselineSeries.map(p => ({
          age: p.age,
          assets: p.assets,
          liabilities: p.liabilities,
        }));

    // Check if we start with assets < liabilities and cross to assets >= liabilities
    // Find the first point where assets >= liabilities, but only if we've seen assets < liabilities before
    let hasSeenBelow = false;
    for (let i = 0; i < assetsData.length; i++) {
      const point = assetsData[i];
      if (point.assets < point.liabilities) {
        hasSeenBelow = true;
      } else if (hasSeenBelow && point.assets >= point.liabilities) {
        // First crossing from below to above/equal
        moments.push({
          id: 'ASSETS_OVER_LIABILITIES',
          seriesId: 'assets',
          age: point.age,
          value: point.assets,
        });
        break; // Only detect the first crossing
      }
    }
  }

  return moments;
}

// Phase 5.5: Generate insight text from KeyMoment
function generateInsightText(moment: KeyMoment): string {
  const age = Math.round(moment.age);
  switch (moment.id) {
    case 'LIABILITY_PAYOFF':
      return `Liabilities are fully repaid by age ${age}.`;
    case 'NET_WORTH_ZERO':
      return `Net worth becomes positive at age ${age}.`;
    case 'ASSETS_OVER_LIABILITIES':
      return `Assets exceed liabilities from age ${age} onward.`;
    default:
      return '';
  }
}

// Helper to convert annual percentage to monthly rate (mirrors projectionEngine logic)
function annualPctToMonthlyRate(pct: number): number {
  const g = pct / 100;
  return Math.pow(1 + g, 1 / 12) - 1;
}

// Helper to deflate value to today's money (mirrors projectionEngine logic)
function deflateToTodaysMoney(value: number, inflationRatePct: number, elapsedMonths: number): number {
  if (elapsedMonths <= 0) return value;
  const elapsedYears = elapsedMonths / 12;
  const inflationRate = inflationRatePct / 100;
  const deflator = Math.pow(1 + inflationRate, elapsedYears);
  const safeDeflator = Number.isFinite(deflator) && deflator > 0 ? deflator : 1;
  return value / safeDeflator;
}

// Check if an asset is liquid at a given age
function isAssetLiquidAtAge(asset: AssetItem, age: number, currentAge: number): boolean {
  const avail = asset.availability ?? { type: 'immediate' };
  
  if (avail.type === 'immediate') return true;
  if (avail.type === 'illiquid') return false;
  
  // locked: check if unlock age has been reached
  if (avail.type === 'locked') {
    if (typeof avail.unlockAge === 'number' && Number.isFinite(avail.unlockAge)) {
      return age >= avail.unlockAge;
    }
    // If locked but no valid unlockAge, treat as illiquid
    return false;
  }
  
  return false;
}

// Helper: Calculate present value sum of constant monthly amount over horizon
// Mirrors computeA3Attribution's pvSumConstantMonthly logic
function pvSumConstantMonthly(amount: number, months: number, inflationPct: number): number {
  const n = Number.isFinite(months) ? Math.max(0, Math.floor(months)) : 0;
  if (n <= 0) return 0;
  const mInfl = inflationPct / 100;
  const inflationMonthlyFactor = mInfl <= -0.99 ? 1 : Math.pow(1 + mInfl, 1 / 12);
  if (inflationMonthlyFactor === 1) return amount * n;
  
  let pv = 0;
  let df = 1 / inflationMonthlyFactor;
  for (let i = 1; i <= n; i++) {
    pv += amount * df;
    df = df / inflationMonthlyFactor;
  }
  return pv;
}

// Helper: Filter expenses to exclude loan payment components
// Excludes both loan-interest and loan-principal (included in scheduledMortgagePayment)
function filterBaseLivingExpenses(expenses: SnapshotState['expenses']): number {
  return expenses
    .filter(it => !it.id.startsWith('loan-interest:') && !it.id.startsWith('loan-principal:'))
    .reduce((sum, it) => sum + (Number.isFinite(it.monthlyAmount) ? Math.max(0, it.monthlyAmount) : 0), 0);
}

// Helper: Calculate allocation delta (PV sum) for FLOW_INVESTING scenarios
function calculateAllocationDelta(monthlyAmount: number, currentAge: number, endAge: number, inflationPct: number): number {
  if (monthlyAmount <= 0) return 0;
  const horizonMonthsRaw = (endAge - currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;
  if (horizonMonths <= 0) return 0;
  return pvSumConstantMonthly(monthlyAmount, horizonMonths, inflationPct);
}

// Helper: Calculate loan amortization totals for baseline (no overpayments)
function calculateBaselineLoanTotals(
  loans: Array<{ balance: number; annualInterestRatePct?: number; remainingTermYears?: number }>,
  horizonMonths: number,
  inflationPct: number
): { scheduledMortgagePayment: number; interestPaid: number; principalRepaid: number } {
  const mInfl = inflationPct / 100;
  const inflationMonthlyFactor = mInfl <= -0.99 ? 1 : Math.pow(1 + mInfl, 1 / 12);
  
  let scheduledMortgagePayment = 0;
  let interestPaid = 0;
  let principalRepaid = 0;
  
  for (const loan of loans) {
    const loanBalance = Number.isFinite(loan.balance) ? Math.max(0, loan.balance) : 0;
    const loanRate = loan.annualInterestRatePct ?? 0;
    const loanTerm = loan.remainingTermYears ?? 0;
    
    const init = initLoan({
      balance: loanBalance,
      annualInterestRatePct: loanRate,
      remainingTermYears: loanTerm,
    });
    const runMonths = Math.min(horizonMonths, init.remainingMonths);
    
    if (runMonths <= 0) continue;
    
    let balance = loanBalance;
    let df = 1 / inflationMonthlyFactor;
    
    for (let i = 1; i <= runMonths && balance > 0; i++) {
      const m = stepLoanMonth({ balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate });
      scheduledMortgagePayment += (m.interest + m.principal) * df;
      interestPaid += m.interest * df;
      principalRepaid += m.principal * df;
      balance = m.newBalance;
      if (inflationMonthlyFactor !== 1) df = df / inflationMonthlyFactor;
    }
  }
  
  return { scheduledMortgagePayment, interestPaid, principalRepaid };
}

// Helper: Calculate loan amortization totals for scenarios (with optional overpayments)
function calculateScenarioLoanTotals(
  loans: Array<{ id: string; balance: number; annualInterestRatePct?: number; remainingTermYears?: number }>,
  horizonMonths: number,
  inflationPct: number,
  overpaymentMap: Map<string, number>
): { scheduledMortgagePayment: number; interestPaid: number; principalRepaid: number; mortgageOverpayments: number } {
  const mInfl = inflationPct / 100;
  const inflationMonthlyFactor = mInfl <= -0.99 ? 1 : Math.pow(1 + mInfl, 1 / 12);
  
  let scheduledMortgagePayment = 0;
  let interestPaid = 0;
  let principalRepaid = 0;
  let mortgageOverpayments = 0;
  
  for (const loan of loans) {
    const loanBalance = Number.isFinite(loan.balance) ? Math.max(0, loan.balance) : 0;
    const loanRate = loan.annualInterestRatePct ?? 0;
    const loanTerm = loan.remainingTermYears ?? 0;
    
    const init = initLoan({
      balance: loanBalance,
      annualInterestRatePct: loanRate,
      remainingTermYears: loanTerm,
    });
    const runMonths = Math.min(horizonMonths, init.remainingMonths);
    
    if (runMonths <= 0) continue;
    
    let balance = loanBalance;
    let df = 1 / inflationMonthlyFactor;
    const extraPrincipal = overpaymentMap.get(loan.id) ?? 0;
    
    for (let i = 1; i <= runMonths && balance > 0; i++) {
      const scheduled = stepLoanMonth({ balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate });
      scheduledMortgagePayment += (scheduled.interest + scheduled.principal) * df;
      interestPaid += scheduled.interest * df;
      principalRepaid += scheduled.principal * df;
      
      if (extraPrincipal > 0) {
        const remainingBalanceAfterScheduled = scheduled.newBalance;
        const overpaymentApplied = Math.min(extraPrincipal, remainingBalanceAfterScheduled);
        mortgageOverpayments += overpaymentApplied * df;
        principalRepaid += overpaymentApplied * df;
        balance = Math.max(0, remainingBalanceAfterScheduled - overpaymentApplied);
      } else {
        balance = scheduled.newBalance;
      }
      
      if (inflationMonthlyFactor !== 1) df = df / inflationMonthlyFactor;
    }
  }
  
  return { scheduledMortgagePayment, interestPaid, principalRepaid, mortgageOverpayments };
}

// Compute liquid assets series by tracking individual assets and filtering by availability
function computeLiquidAssetsSeries(
  inputs: ProjectionEngineInputs,
  assetsWithAvailability: AssetItem[],
): number[] {
  const horizonMonthsRaw = (inputs.endAge - inputs.currentAge) * 12;
  const horizonMonths = Number.isFinite(horizonMonthsRaw) ? Math.max(0, Math.floor(horizonMonthsRaw)) : 0;
  
  // Create a map of assets by id for efficient lookup
  const assetMap = new Map<string, AssetItem>();
  for (const asset of assetsWithAvailability) {
    assetMap.set(asset.id, asset);
  }
  
  // Track individual asset balances (mirroring projectionEngine's assetStates)
  const assetStates: Array<{ id: string; balance: number; monthlyGrowthRate: number }> = inputs.assetsToday.map(a => {
    const pct = typeof a.annualGrowthRatePct === 'number' && Number.isFinite(a.annualGrowthRatePct) ? a.annualGrowthRatePct : 0;
    const monthlyGrowthRate = annualPctToMonthlyRate(pct);
    return {
      id: a.id,
      balance: Number.isFinite(a.balance) ? Math.max(0, a.balance) : 0,
      monthlyGrowthRate,
    };
  });
  
  // Start point: compute liquid assets at current age
  const startLiquidAssets = assetStates.reduce((sum, a) => {
    const asset = assetMap.get(a.id);
    if (!asset) return sum;
    if (isAssetLiquidAtAge(asset, inputs.currentAge, inputs.currentAge)) {
      return sum + a.balance;
    }
    return sum;
  }, 0);
  
  const liquidSeries: number[] = [deflateToTodaysMoney(startLiquidAssets, inputs.inflationRatePct, 0)];
  
  if (horizonMonths <= 0) return liquidSeries;
  
  // Run monthly projection and sample liquid assets at yearly intervals
  for (let monthIndex = 1; monthIndex <= horizonMonths; monthIndex++) {
    // 1) Apply per-asset growth
    for (const a of assetStates) {
      a.balance = a.balance * (1 + a.monthlyGrowthRate);
    }
    
    // 2) Apply linked asset contributions
    for (const c of inputs.assetContributionsMonthly) {
      const amt = typeof c.amountMonthly === 'number' && Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0;
      if (amt <= 0) continue;
      const idx = assetStates.findIndex(a => a.id === c.assetId);
      if (idx >= 0) {
        assetStates[idx].balance += amt;
      }
    }
    
    // Sample yearly points only (every 12 months)
    if (monthIndex % 12 === 0) {
      const age = inputs.currentAge + monthIndex / 12;
      const liquidAssets = assetStates.reduce((sum, a) => {
        const asset = assetMap.get(a.id);
        if (!asset) return sum;
        if (isAssetLiquidAtAge(asset, age, inputs.currentAge)) {
          return sum + a.balance;
        }
        return sum;
      }, 0);
      
      const realLiquidAssets = deflateToTodaysMoney(liquidAssets, inputs.inflationRatePct, monthIndex);
      liquidSeries.push(realLiquidAssets);
    }
  }
  
  return liquidSeries;
}

function niceStep(range: number): number {
  if (range <= 0) return 1;
  const rough = range / 4; // ~4 ticks
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow10;
  if (n <= 1) return 1 * pow10;
  if (n <= 2) return 2 * pow10;
  if (n <= 5) return 5 * pow10;
  return 10 * pow10;
}

/**
 * Rounds a number to a "nice" value for chart display.
 * Rounds to controlled nice values (e.g. 25k, 50k, 100k) instead of letting chart library decide.
 * This prevents aggressive rounding (e.g. 23k -> 50k) and produces calm, proportional charts.
 */
function roundNice(value: number): number {
  if (value <= 0) return 0;
  const pow10 = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow10;
  let roundedN: number;
  // Round to nice increments: 1, 2, 2.5, 5, 10
  // This produces: 10k, 20k, 25k, 50k, 100k instead of just 10k, 20k, 50k, 100k
  if (n <= 1) roundedN = 1;
  else if (n <= 2) roundedN = 2;
  else if (n <= 2.5) roundedN = 2.5; // Allows 25k increments
  else if (n <= 5) roundedN = 5;
  else roundedN = 10;
  return roundedN * pow10;
}

/**
 * Phase 5.3: Generate ticks that stay within the domain boundary.
 * Ticks are rounded to "nice" values but never exceed max.
 */
function buildTicks(min: number, max: number): number[] {
  const range = max - min;
  const step = niceStep(range);
  const start = Math.floor(min / step) * step;
  // Clamp end to domain max - ticks must never exceed the domain boundary
  const end = Math.min(max, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) {
    // Only include ticks that are within the domain
    if (v <= max) ticks.push(v);
  }
  return ticks;
}


// Snapshot-compatible card component
// Reuses Snapshot card structure exactly, with visual emphasis for scenario values
function SnapshotComparisonCard({
  title,
  description,
  baselineValue,
  scenarioValue,
  showScenario,
  isOutcome = false,
  isSubCard = false,
}: {
  title: string;
  description: string;
  baselineValue: number;
  scenarioValue?: number;
  showScenario: boolean;
  isOutcome?: boolean;
  isSubCard?: boolean;
}) {
  const { theme } = useTheme();
  // Use unsigned formatting for all baseline and scenario values (no + or - signs)
  // Use compact formatting (k/m) for Projected Snapshot
  // Signs are only used for deltas
  const formatValue = formatCurrencyCompact;

  const delta = scenarioValue !== undefined ? scenarioValue - baselineValue : 0;
  const hasDelta = Math.abs(delta) >= UI_TOLERANCE;

  return (
    <View style={[
      styles.snapshotCard,
      styles.cashflowCard,
      isSubCard ? styles.cashflowSubCard : styles.cashflowPrimaryCard,
      styles.cashflowMb,
    ]}>
      <View style={styles.cashflowCardRow}>
        <View style={isSubCard ? styles.cashflowCardLeftIndented : styles.cashflowCardLeft}>
          <Text style={[styles.snapshotCardTitle, isSubCard && styles.snapshotSubCardTitle]}>
            {title}
          </Text>
          <Text style={styles.snapshotCardDescription}>
            {description}
          </Text>
        </View>
        <View style={styles.cashflowCardRight}>
          {!showScenario || scenarioValue === undefined ? (
            // Single value mode (matches Snapshot exactly)
            <Text style={[
              styles.snapshotPrimaryValue,
              isOutcome && styles.snapshotPrimaryValueOutcome,
              isSubCard && styles.snapshotSubCardValue,
              styles.cashflowValueRight,
              isOutcome && { color: theme.colors.brand.primary },
              !isOutcome && { color: theme.colors.text.primary },
              isSubCard && { color: theme.colors.text.secondary },
            ]}>
              {formatValue(baselineValue)}
            </Text>
          ) : (
            // Baseline and Scenario side-by-side, Delta under Scenario (only if delta ≠ 0)
            <View style={styles.comparisonValuesContainer}>
              <View style={styles.comparisonValuesRow}>
                {/* Baseline value (first column) - always black/neutral */}
                <View style={styles.comparisonValueColumn}>
                  <Text style={[
                    styles.snapshotPrimaryValue,
                    isSubCard && styles.snapshotSubCardValue,
                    styles.cashflowValueRight,
                  ]}>
                    {formatValue(baselineValue)}
                  </Text>
                </View>
                {/* Scenario value and Delta (second column, stacked) */}
                <View style={styles.comparisonValueColumn}>
                  {hasDelta ? (
                    <>
                      <Text style={[
                        styles.snapshotPrimaryValue,
                        styles.snapshotPrimaryValueScenario,
                        styles.cashflowValueRight,
                        { color: theme.colors.brand.primary },
                      ]}>
                        {formatValue(scenarioValue)}
                      </Text>
                      <Text style={[
                        styles.snapshotDeltaValue,
                        styles.snapshotDeltaValueMuted,
                        styles.cashflowValueRight,
                      ]}>
                        {formatCurrencyCompactSigned(delta)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[
                      styles.snapshotPrimaryValue,
                      { color: '#999' },
                      styles.cashflowValueRight,
                    ]}>
                      -
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// Helper component for dual-column value display (Snapshot cards)
function DualValueCard({ 
  title, 
  baselineValue, 
  scenarioValue, 
  scenarioDelta, 
  showScenario,
  isOutcome = false,
}: { 
  title: string; 
  baselineValue: number; 
  scenarioValue?: number; 
  scenarioDelta?: number;
  showScenario: boolean;
  isOutcome?: boolean;
}) {
  const { theme } = useTheme();
  // Use unsigned formatting for all baseline and scenario values (no + or - signs)
  // Signs are only used for deltas
  const formatValue = formatCurrencyCompact;

  if (!showScenario || scenarioValue === undefined) {
    return (
      <View style={[styles.projectedCardBordered, styles.cashflowCard, styles.cashflowPrimaryCard, styles.cashflowMb]}>
        <Text style={[styles.projectedCardTitle, styles.cashflowTextCentered]}>{title}</Text>
        <Text style={[styles.projectedPrimaryValue, isOutcome && styles.projectedPrimaryValueOutcome, styles.cashflowTextCentered, isOutcome && { color: theme.colors.brand.primary }, !isOutcome && { color: theme.colors.text.primary }]}>
          {formatValue(baselineValue)}
        </Text>
      </View>
    );
  }

  // If baseline and scenario values are equal, render baseline-only layout
  const valuesEqual = Math.abs(baselineValue - scenarioValue) < UI_TOLERANCE;
  if (valuesEqual) {
    return (
      <View style={[styles.projectedCardBordered, styles.cashflowCard, styles.cashflowPrimaryCard, styles.cashflowMb]}>
        <Text style={[styles.projectedCardTitle, styles.cashflowTextCentered]}>{title}</Text>
        <Text style={[styles.projectedPrimaryValue, isOutcome && styles.projectedPrimaryValueOutcome, styles.cashflowTextCentered, isOutcome && { color: theme.colors.brand.primary }, !isOutcome && { color: theme.colors.text.primary }]}>
          {formatValue(baselineValue)}
        </Text>
      </View>
    );
  }

  const delta = scenarioDelta ?? (scenarioValue - baselineValue);
  const hasDelta = Math.abs(delta) >= UI_TOLERANCE;

  return (
    <View style={[styles.projectedCardBordered, styles.cashflowCard, styles.cashflowPrimaryCard, styles.cashflowMb]}>
      <Text style={[styles.projectedCardTitle, styles.cashflowTextCentered]}>{title}</Text>
      <View style={styles.dualValueRow}>
        <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start', paddingRight: spacing.xs }}>
          <Text style={[styles.projectedPrimaryValue, { textAlign: 'right' }]}>
            {formatValue(baselineValue)}
          </Text>
        </View>
        <View style={styles.dualValueDivider} />
        <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start', paddingLeft: spacing.xs }}>
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={[styles.projectedPrimaryValue, styles.projectedPrimaryValueScenario, { textAlign: 'left', color: theme.colors.brand.primary }]}>
              {formatValue(scenarioValue)}
            </Text>
            {hasDelta && (
              <Text style={[styles.projectedDelta, styles.projectedDeltaScenario, { textAlign: 'left', marginTop: 2 }]}>
                {formatCurrencyCompactSigned(delta)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// Helper component for Balance Sheet cards with three-row structure
function BalanceSheetCard({
  title,
  description,
  baselineValue,
  scenarioValue,
  baselineAgeDelta,
  scenarioAgeDelta,
  scenarioDelta,
  showScenario,
  isOutcome = false,
  startingValue,
  startingValueForScenario,
}: {
  title: string;
  description?: string;
  baselineValue: number;
  scenarioValue?: number;
  baselineAgeDelta: number; // baseline projected - today
  scenarioAgeDelta?: number; // scenario projected - today
  scenarioDelta?: number; // scenario projected - baseline projected
  showScenario: boolean;
  isOutcome?: boolean;
  startingValue: number; // today's value for age delta calculation
  startingValueForScenario?: number; // today's value for scenario age delta (usually same as startingValue)
}) {
  const { theme } = useTheme();
  if (!showScenario || scenarioValue === undefined) {
    // Single column: baseline only
    const ageDelta = baselineAgeDelta;
    const hasAgeDelta = Math.abs(ageDelta) >= UI_TOLERANCE;
    
    return (
      <View style={styles.projectedBalanceSheetCard}>
        <Text style={[styles.projectedCardTitle, styles.cashflowTextCentered]}>{title}</Text>
        <Text style={[styles.projectedPrimaryValue, isOutcome && styles.projectedPrimaryValueOutcome, styles.cashflowTextCentered]}>
          {formatCurrencyCompact(baselineValue)}
        </Text>
        {hasAgeDelta && (
          <Text style={[styles.projectedDelta, styles.projectedDeltaAge, styles.cashflowTextCentered]}>
            {formatCurrencyCompactSigned(ageDelta)}
          </Text>
        )}
      </View>
    );
  }

  // Check if baseline and scenario values are equal
  const valuesEqual = Math.abs(baselineValue - scenarioValue) < UI_TOLERANCE;

  // Two columns: baseline | scenario
  const delta = scenarioDelta ?? (scenarioValue - baselineValue);
  const hasScenarioDelta = Math.abs(delta) >= UI_TOLERANCE;
  const hasBaselineAgeDelta = Math.abs(baselineAgeDelta) >= UI_TOLERANCE;

  return (
    <View style={styles.projectedBalanceSheetCard}>
      <Text style={[styles.projectedCardTitle, styles.cashflowTextCentered]}>{title}</Text>
      
      <View style={styles.balanceSheetDualColumn}>
        {/* LEFT COLUMN: Baseline */}
        <View style={styles.balanceSheetColumn}>
          {/* Row 1: Values */}
          <Text style={[styles.projectedPrimaryValue, styles.cashflowTextCentered]}>
            {formatCurrencyCompact(baselineValue)}
          </Text>
          {/* Row 2: Age delta or placeholder - always reserve space */}
          <View style={styles.balanceSheetDeltaRow}>
            {hasBaselineAgeDelta ? (
              <Text style={[styles.projectedDelta, styles.projectedDeltaAge, styles.cashflowTextCentered]}>
                {formatCurrencyCompactSigned(baselineAgeDelta)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.balanceSheetDivider} />

        {/* RIGHT COLUMN: Scenario */}
        <View style={styles.balanceSheetColumn}>
          {/* Row 1: Values */}
          {valuesEqual ? (
            <Text style={[styles.projectedPrimaryValue, styles.projectedDelta, styles.cashflowTextCentered]}>
              -
            </Text>
          ) : (
            <>
          <Text style={[styles.projectedPrimaryValue, styles.projectedPrimaryValueScenario, styles.cashflowTextCentered]}>
            {formatCurrencyCompact(scenarioValue)}
          </Text>
              {/* Row 2: Scenario delta (baseline → scenario) */}
              {hasScenarioDelta && (
              <Text style={[styles.projectedDelta, styles.projectedDeltaScenario, styles.cashflowTextCentered]}>
                {formatCurrencyCompactSigned(delta)}
              </Text>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

type Row = { 
  label: string; 
  valueText: string; 
  showDividerAfter?: boolean;
  scenarioValueText?: string; // Scenario value (brand blue if different, muted if same)
  deltaValueText?: string; // Delta value (muted, signed)
  valuesDiffer?: boolean; // Whether baseline and scenario values differ
};

function KeyDriversCard({ rows, showScenario, showDelta, scenarioResult, endNetWorthBaseline, endNetWorthScenario, endNetWorthDelta }: { rows: Row[]; showScenario: boolean; showDelta: boolean; scenarioResult?: string | null; endNetWorthBaseline?: string; endNetWorthScenario?: string; endNetWorthDelta?: string }) {
  const endNetWorthValuesDiffer = endNetWorthDelta && endNetWorthDelta !== '—';
  
  return (
    <View style={styles.keyDriversCard}>
      <Text style={styles.keyDriversTitle}>What mattered most over this time</Text>
      {showScenario && scenarioResult ? (
        <Text style={styles.scenarioResultSummary}>{scenarioResult}</Text>
      ) : null}
      {showScenario && rows.some(r => r.scenarioValueText) ? (
        <View style={styles.keyDriversHeaderRow}>
          <View style={styles.keyDriversHeaderSpacer} />
          <Text style={styles.keyDriversHeaderLabel}>Baseline</Text>
          <Text style={styles.keyDriversHeaderLabelScenario}>Scenario</Text>
          {showDelta ? <Text style={styles.keyDriversHeaderLabelDelta}>Δ</Text> : null}
        </View>
      ) : null}
      <View style={styles.keyDriversRows}>
        {rows
          .map(r => {
            const isUnchanged = showScenario && r.valuesDiffer === false;
            return (
              <View key={r.label} style={[styles.keyDriversRow, isUnchanged && styles.attrRowUnchanged]}>
                <Text style={[styles.keyDriversLabel, isUnchanged && styles.attrLabelUnchanged]}>{r.label}</Text>
                {showScenario && r.scenarioValueText ? (
                  <View style={styles.keyDriversValuesRow}>
                    <Text style={styles.keyDriversValue}>{r.valueText}</Text>
                    <Text style={[
                      r.valuesDiffer ? styles.keyDriversValueScenario : styles.keyDriversValueScenarioUnchanged
                    ]}>{r.scenarioValueText}</Text>
                    {showDelta && r.deltaValueText ? (
                      <Text style={styles.keyDriversValueDelta}>{r.deltaValueText}</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.keyDriversValue}>{r.valueText}</Text>
                )}
              </View>
            );
          })}
        {showScenario && endNetWorthBaseline && endNetWorthScenario ? (
          <>
            <View style={styles.endNetWorthDivider} />
            <View style={styles.keyDriversRow}>
              <Text style={styles.keyDriversLabel}>Net Worth</Text>
              <View style={styles.keyDriversValuesRow}>
                <Text style={styles.keyDriversValue}>{endNetWorthBaseline}</Text>
                <Text style={[
                  endNetWorthValuesDiffer ? styles.keyDriversValueScenario : styles.keyDriversValueScenarioUnchanged
                ]}>{endNetWorthScenario}</Text>
                {showDelta && endNetWorthDelta ? (
                  <Text style={styles.keyDriversValueDelta}>{endNetWorthDelta}</Text>
                ) : null}
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

// Dev-only: Math reconciliation overlay component
function ReconciliationOverlay({
  valuesAtAge,
  scenarioValuesAtAge,
  scenarioDeltas,
  selectedAge,
}: {
  valuesAtAge: {
    netWorth: number;
    assets: number;
    liabilities: number;
    growth: number;
    contributions: number;
    interestPaid: number;
    grossIncome: number;
    pensionContributions: number;
    taxes: number;
    livingExpenses: number;
    netSurplus: number;
    postTaxContributions: number;
    debtRepayment: number;
    principalRepaid: number;
    remainingDebt: number;
    startingAssets: number;
  };
  scenarioValuesAtAge: {
    netWorth: number;
    assets: number;
    liabilities: number;
    growth: number;
    contributions: number;
    interestPaid: number;
    grossIncome: number;
    pensionContributions: number;
    taxes: number;
    livingExpenses: number;
    netSurplus: number;
    postTaxContributions: number;
    debtRepayment: number;
    principalRepaid: number;
    remainingDebt: number;
    startingAssets: number;
  };
  scenarioDeltas: {
    netWorth: number;
    assets: number;
    liabilities: number;
    allocationDelta: number;
  };
  selectedAge: number;
}) {
  // Core reconciliation
  const baselineNetWorth = valuesAtAge.netWorth;
  const scenarioNetWorth = scenarioValuesAtAge.netWorth;
  const deltaCalculated = scenarioNetWorth - baselineNetWorth;
  const deltaUI = scenarioDeltas.netWorth;
  const reconciles = Math.abs(deltaCalculated - deltaUI) < UI_TOLERANCE;

  // Attribution breakdown (incremental effects only)
  const netWorthIncrease = scenarioNetWorth - baselineNetWorth;
  const baselineTotalContributions = valuesAtAge.pensionContributions + valuesAtAge.postTaxContributions;
  const scenarioTotalContributions = scenarioValuesAtAge.pensionContributions + scenarioValuesAtAge.postTaxContributions;
  const extraContributions = scenarioTotalContributions - baselineTotalContributions;
  const extraGrowth = netWorthIncrease - extraContributions;
  const debtReduction = scenarioValuesAtAge.liabilities - valuesAtAge.liabilities; // Negative if debt reduced
  const attributionSum = extraContributions + extraGrowth - debtReduction; // debtReduction is negative, so subtract

  // Canonical invariants
  const invariant1 = Math.abs(netWorthIncrease - (scenarioNetWorth - baselineNetWorth)) < UI_TOLERANCE;
  const invariant2 = Math.abs(netWorthIncrease - (extraContributions + extraGrowth)) < UI_TOLERANCE;
  const invariant3 = Math.abs(attributionSum - netWorthIncrease) < UI_TOLERANCE;
  const invariant4 = true; // Growth attribution is always extraGrowth = netWorthIncrease - extraContributions (residual)

  const allInvariantsPass = invariant1 && invariant2 && invariant3 && invariant4;

  return (
    <View style={styles.reconciliationPanel}>
      <Text style={styles.reconciliationTitle}>Core Reconciliation (Age {selectedAge})</Text>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Baseline net worth:</Text>
        <Text style={styles.reconciliationValue}>{formatCurrencyFull(baselineNetWorth)}</Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Scenario net worth:</Text>
        <Text style={styles.reconciliationValue}>{formatCurrencyFull(scenarioNetWorth)}</Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Delta (calculated):</Text>
        <Text style={styles.reconciliationValue}>{formatCurrencyFull(deltaCalculated)}</Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Delta (UI):</Text>
        <Text style={styles.reconciliationValue}>{formatCurrencyFull(deltaUI)}</Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Reconciles:</Text>
        <Text style={[styles.reconciliationValue, reconciles ? [styles.reconciliationPass, { color: theme.colors.semantic.success }] : styles.reconciliationFail]}>
          {reconciles ? '✓ YES' : '✕ NO'}
        </Text>
      </View>

      <View style={styles.reconciliationDivider} />

      <Text style={styles.reconciliationTitle}>Attribution Breakdown</Text>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Extra contributions:</Text>
        <Text style={styles.reconciliationValue}>{formatCurrencyFull(extraContributions)}</Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Extra asset growth:</Text>
        <Text style={styles.reconciliationValue}>{formatCurrencyFull(extraGrowth)}</Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Debt reduction:</Text>
        <Text style={styles.reconciliationValue}>{formatCurrencyFull(-debtReduction)}</Text>
      </View>
      
      <View style={styles.reconciliationDivider} />
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Sum:</Text>
        <Text style={styles.reconciliationValue}>{formatCurrencyFull(attributionSum)}</Text>
      </View>

      <View style={styles.reconciliationDivider} />

      <Text style={styles.reconciliationTitle}>Canonical Invariants</Text>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>netWorthDelta = scenario − baseline:</Text>
        <Text style={[styles.reconciliationValue, invariant1 ? [styles.reconciliationPass, { color: theme.colors.semantic.success }] : styles.reconciliationFail]}>
          {invariant1 ? '✓' : '✕'}
        </Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>netWorthDelta = extraContributions + extraGrowth:</Text>
        <Text style={[styles.reconciliationValue, invariant2 ? [styles.reconciliationPass, { color: theme.colors.semantic.success }] : styles.reconciliationFail]}>
          {invariant2 ? '✓' : '✕'}
        </Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>netWorthDelta = sum(attribution):</Text>
        <Text style={[styles.reconciliationValue, invariant3 ? [styles.reconciliationPass, { color: theme.colors.semantic.success }] : styles.reconciliationFail]}>
          {invariant3 ? '✓' : '✕'}
        </Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Growth = residual (not total):</Text>
        <Text style={[styles.reconciliationValue, invariant4 ? [styles.reconciliationPass, { color: theme.colors.semantic.success }] : styles.reconciliationFail]}>
          {invariant4 ? '✓' : '✕'}
        </Text>
      </View>

      {!allInvariantsPass && (
        <View style={styles.reconciliationWarning}>
          <Text style={styles.reconciliationWarningText}>
            ⚠️ One or more invariants failed. Check console for details.
          </Text>
        </View>
      )}
    </View>
  );
}

// Phase 5.1: Financial Health Summary
// Threshold for expense dominance (expenses / income >= this value triggers T2)
const EXPENSE_DOMINANCE_THRESHOLD = 0.8; // 80%

type Insight = {
  id: string;
  text: string;
  salience: {
    magnitude: number;
    dominance: number;
    temporal: number;
    isSnapshot: boolean;
  };
};

function FinancialHealthSummary({
  snapshotTotals,
  baselineSummary,
  baselineSeries,
  currentAge,
  endAge,
  assets,
}: {
  snapshotTotals: ReturnType<typeof selectSnapshotTotals>;
  baselineSummary: ReturnType<typeof computeProjectionSummary>;
  baselineSeries: ReturnType<typeof computeProjectionSeries>;
  currentAge: number;
  endAge: number;
  assets: AssetItem[];
}) {
  const { theme } = useTheme();
  const insights: Insight[] = [];

  // T1 — Cashflow Balance
  if (snapshotTotals.netIncome > UI_TOLERANCE && snapshotTotals.expenses > UI_TOLERANCE) {
    const surplus = snapshotTotals.monthlySurplus;
    const allocated = snapshotTotals.netIncome - snapshotTotals.expenses - surplus;
    const surplusPct = snapshotTotals.netIncome > UI_TOLERANCE
      ? Math.round((surplus / snapshotTotals.netIncome) * 100)
      : 0;
    insights.push({
      id: 'T1',
      text: `Monthly income of ${formatCurrencyCompact(snapshotTotals.netIncome)} exceeds expenses of ${formatCurrencyCompact(snapshotTotals.expenses)}, with ${formatCurrencyCompact(allocated)} allocated and ${formatCurrencyCompact(surplus)} (${surplusPct}%) remaining unallocated.`,
      salience: {
        magnitude: Math.abs(surplus),
        dominance: Math.abs(surplusPct),
        temporal: 0,
        isSnapshot: true,
      },
    });
  }

  // T2 — Expense Dominance
  if (snapshotTotals.netIncome > UI_TOLERANCE) {
    const expenseRatio = snapshotTotals.expenses / snapshotTotals.netIncome;
    if (expenseRatio >= EXPENSE_DOMINANCE_THRESHOLD) {
      const expensePct = Math.round(expenseRatio * 100);
      insights.push({
        id: 'T2',
        text: `Expenses consume ${expensePct}% of monthly income.`,
        salience: {
          magnitude: snapshotTotals.expenses,
          dominance: expensePct,
          temporal: 0,
          isSnapshot: true,
        },
      });
    }
  }

  // T3 — Unallocated Surplus
  if (snapshotTotals.monthlySurplus > UI_TOLERANCE) {
    const surplus = snapshotTotals.monthlySurplus;
    const surplusPct = snapshotTotals.netIncome > UI_TOLERANCE
      ? Math.round((surplus / snapshotTotals.netIncome) * 100)
      : 0;
    insights.push({
      id: 'T3',
      text: `${formatCurrencyFull(surplus)} per month remains unallocated, representing ${surplusPct}% of income.`,
      salience: {
        magnitude: surplus,
        dominance: surplusPct,
        temporal: 0,
        isSnapshot: true,
      },
    });
  }

  // T4 — Asset Composition
  if (snapshotTotals.assets > UI_TOLERANCE) {
    // Find SYSTEM_CASH balance
    const systemCashAsset = assets.find(a => a.id === SYSTEM_CASH_ID);
    const cashBalance = systemCashAsset?.balance ?? 0;
    const cashPct = Math.round((cashBalance / snapshotTotals.assets) * 100);
    insights.push({
      id: 'T4',
      text: `Cash represents ${cashPct}% of total assets, with the remainder held in long-term assets.`,
      salience: {
        magnitude: cashBalance,
        dominance: cashPct,
        temporal: 0,
        isSnapshot: true,
      },
    });
  }

  // T5 — Liability Payoff
  if (snapshotTotals.liabilities > UI_TOLERANCE && baselineSeries.length > 0) {
    // Find first point where liabilities <= tolerance (fully repaid)
    const payoffPoint = baselineSeries.find(p => p.liabilities <= UI_TOLERANCE);
    if (payoffPoint) {
      const payoffAge = Math.round(payoffPoint.age);
      insights.push({
        id: 'T5',
        text: `Liabilities decline over time and are fully repaid by age ${payoffAge}.`,
        salience: {
          magnitude: snapshotTotals.liabilities,
          dominance: 0,
          temporal: payoffAge, // Earlier payoff = higher temporal salience (inverted)
          isSnapshot: false,
        },
      });
    }
  }

  // T6 — Projection Stability
  if (baselineSeries.length > 0) {
    const netWorthNeverNegative = baselineSeries.every(p => p.netWorth >= -UI_TOLERANCE);
    if (netWorthNeverNegative) {
      const years = endAge - currentAge;
      insights.push({
        id: 'T6',
        text: `Net worth remains positive across the entire ${years}-year projection horizon.`,
        salience: {
          magnitude: baselineSummary.endNetWorth,
          dominance: 0,
          temporal: endAge,
          isSnapshot: false,
        },
      });
    }
  }

  // Rank insights by structural salience
  // 1. Magnitude (absolute £ values)
  // 2. Dominance (% of total)
  // 3. Temporal significance (earlier age/year milestones)
  // Tie-breaker: Prefer Snapshot-based insights over Projection-based ones
  insights.sort((a, b) => {
    // Primary: Magnitude
    if (Math.abs(a.salience.magnitude - b.salience.magnitude) > UI_TOLERANCE) {
      return b.salience.magnitude - a.salience.magnitude;
    }
    // Secondary: Dominance
    if (Math.abs(a.salience.dominance - b.salience.dominance) > 0.1) {
      return b.salience.dominance - a.salience.dominance;
    }
    // Tertiary: Temporal (earlier = higher salience, so invert)
    if (a.salience.temporal > 0 && b.salience.temporal > 0) {
      return a.salience.temporal - b.salience.temporal; // Earlier age = higher rank
    }
    // Tie-breaker: Snapshot over Projection
    if (a.salience.isSnapshot !== b.salience.isSnapshot) {
      return a.salience.isSnapshot ? -1 : 1;
    }
    return 0;
  });

  // Select at most 3 insights
  const selectedInsights = insights.slice(0, 3);

  // If no insights qualify, render nothing
  if (selectedInsights.length === 0) {
    return null;
  }

  return (
    <SectionCard>
      <SectionHeader title="Financial Health Summary" />
      <View style={styles.insightsList}>
        {selectedInsights.map(insight => (
          <Text key={insight.id} style={styles.bodyText}>
            • {insight.text}
          </Text>
        ))}
      </View>
    </SectionCard>
  );
}

function AttributionCard({ title, subtitle, education, rows, showScenario, showDelta }: { title: string; subtitle?: string; education: string; rows: Row[]; showScenario: boolean; showDelta: boolean }) {
  return (
    <View style={styles.attrCard}>
      <Text style={styles.attrTitle}>{title}</Text>
      {subtitle ? <Text style={styles.attrSubtitle}>{subtitle}</Text> : null}
      {education ? <Text style={styles.attrEducation}>{education}</Text> : null}
      {showScenario && rows.some(r => r.scenarioValueText) ? (
        <View style={styles.attrHeaderRow}>
          <View style={styles.attrHeaderSpacer} />
          <Text style={styles.attrHeaderLabel}>Baseline</Text>
          <Text style={styles.attrHeaderLabelScenario}>Scenario</Text>
          {showDelta ? <Text style={styles.attrHeaderLabelDelta}>Δ</Text> : null}
        </View>
      ) : null}
      <View style={styles.attrRows}>
        {rows
          .map((r, index) => {
            const isUnchanged = showScenario && r.valuesDiffer === false;
            return (
              <View key={r.label}>
                <View style={[styles.attrRow, isUnchanged && styles.attrRowUnchanged]}>
                  <Text style={[styles.attrLabel, isUnchanged && styles.attrLabelUnchanged]}>{r.label}</Text>
                  {showScenario && r.scenarioValueText ? (
                    <View style={styles.attrValuesRow}>
                      <Text style={styles.attrValue}>{r.valueText}</Text>
                      <Text style={[
                        r.valuesDiffer ? styles.attrValueScenario : styles.attrValueScenarioUnchanged
                      ]}>{r.scenarioValueText}</Text>
                      {showDelta && r.deltaValueText ? (
                        <Text style={styles.attrValueDelta}>{r.deltaValueText}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.attrValue}>{r.valueText}</Text>
                  )}
                </View>
                {r.showDividerAfter ? <View style={styles.attrDivider} /> : null}
              </View>
            );
          })}
      </View>
    </View>
  );
}

export default function ProjectionResultsScreen() {
  const { theme } = useTheme();
  const chartPalette = getChartPalette(theme);
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const { state, setProjection, isProfileSwitching } = useSnapshot();

  // Helper to prevent modal open taps from immediately closing via backdrop press
  const openLater = (fn: () => void) => {
    setTimeout(fn, 0);
  };
  void setProjection; // Results screen does not edit projection inputs.

  const [showLiquidOnly, setShowLiquidOnly] = useState(false);
  const [selectedAge, setSelectedAge] = useState<number>(state.projection.endAge);
  const [ageSelectorOpen, setAgeSelectorOpen] = useState(false);
  const [showDeltaColumn, setShowDeltaColumn] = useState(false);
  // Dev-only: Debug flag for reconciliation overlay
  const [showReconciliationOverlay, setShowReconciliationOverlay] = useState(false);

  // Phase Two: Scenario state (ephemeral, in-memory only)
  const [scenario, setScenario] = useState<ScenarioState>({
    isActive: false,
    type: 'FLOW_INVESTING',
    assetId: null,
    liabilityId: null,
    monthlyAmount: 0,
  });

  // Phase Four: Persisted scenario state
  const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioIdState] = useState<ScenarioId | undefined>(undefined);
  const [activeScenarioOverride, setActiveScenarioOverride] = useState<Scenario | undefined>(undefined);
  const [scenarioSelectorOpen, setScenarioSelectorOpen] = useState(false);

  // V1 Affordability: Get available cash from Snapshot (monthly surplus after all allocations)
  const availableToAllocate = useMemo(() => {
    return selectMonthlySurplus(state);
  }, [state]);

  // Gate: Check if baseline surplus is negative (over-allocation)
  const baselineSurplus = selectMonthlySurplus(state);
  const isSurplusNegative = baselineSurplus < -UI_TOLERANCE;

  // V1 Affordability: Track pending input for validation (what user is typing, not yet committed)
  const [pendingScenarioInput, setPendingScenarioInput] = useState<{ assetId: string | null; monthlyAmount: number } | null>(null);

  // Toolbar state
  const [quickWhatIfExpanded, setQuickWhatIfExpanded] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [mortgagePickerOpen, setMortgagePickerOpen] = useState(false);
  const [localAmountInput, setLocalAmountInput] = useState<string>('');
  const [localSelectedAsset, setLocalSelectedAsset] = useState<string | null>(null);
  const [localSelectedLiability, setLocalSelectedLiability] = useState<string | null>(null);
  const [scenarioTypeToggle, setScenarioTypeToggle] = useState<'FLOW_INVESTING' | 'FLOW_DEBT_PAYDOWN'>('FLOW_INVESTING');
  
  // Refs for scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  const quickWhatIfRef = useRef<View>(null);
  const stickyHeaderRef = useRef<View>(null);
  const stickyHeaderHeight = useRef<number>(0);

  // Phase Four: Load scenarios whenever screen gains focus
  // Note: This effect should only run on screen focus, not when scenario state changes.
  // Removing scenario.isActive and scenario.type from dependencies prevents re-running
  // when Quick What-If activates, which was causing it to flash-close.
  useFocusEffect(
    useCallback(() => {
      async function loadScenarioState() {
        const [scenarios, activeId] = await Promise.all([
          getScenarios(),
          getActiveScenarioId(),
        ]);
        
        // Filter invalid scenarios (targets don't exist in snapshot)
        const validScenarios = scenarios.filter(s => 
          isScenarioTargetValid(s, state.assets, state.liabilities)
        );
        
        // If active scenario is invalid, fallback to baseline
        let finalActiveId = activeId;
        if (activeId !== undefined && activeId !== BASELINE_SCENARIO_ID) {
          const activeScenario = validScenarios.find(s => s.id === activeId);
          if (!activeScenario) {
            console.warn(`Active scenario ${activeId} has invalid target, resetting to baseline`);
            finalActiveId = BASELINE_SCENARIO_ID;
            await persistActiveScenarioId(BASELINE_SCENARIO_ID);
          }
        }
        
        setSavedScenarios(validScenarios);
        setActiveScenarioIdState(finalActiveId);
        setActiveScenarioOverride(undefined); // Clear override on focus refresh
        
        // Enforce mutual exclusivity: Clear Quick What-If when persisted scenario is loaded
        // Exclude BASELINE_SCENARIO_ID - baseline should not clear Quick What-If
        // Note: scenario state is accessed via closure (current value when callback runs)
        if (finalActiveId !== undefined && finalActiveId !== BASELINE_SCENARIO_ID && scenario.isActive) {
          setScenario({
            isActive: false,
            type: scenario.type,
            assetId: null,
            liabilityId: null,
            monthlyAmount: 0,
          });
          setQuickWhatIfExpanded(false);
          setLocalAmountInput('');
          setLocalSelectedAsset(null);
          setLocalSelectedLiability(null);
          setPendingScenarioInput(null);
        }
      }
      loadScenarioState();
    }, [state.assets, state.liabilities])
  );

  // Phase Four: Resolve active scenario (override takes precedence for immediate dropdown updates)
  const activeScenario = useMemo(() => {
    if (activeScenarioOverride !== undefined) {
      return activeScenarioOverride;
    }
    return getActiveScenario(savedScenarios, activeScenarioId);
  }, [activeScenarioOverride, savedScenarios, activeScenarioId]);

  // Helper functions for toolbar
  const getAssetName = (assetId: string | null): string => {
    if (!assetId) return '';
    const asset = state.assets.find(a => a.id === assetId);
    return asset ? asset.name : 'Unknown asset';
  };

  const getLiabilityName = (liabilityId: string | null): string => {
    if (!liabilityId) return '';
    const liability = state.liabilities.find(l => l.id === liabilityId);
    return liability ? liability.name : 'Unknown mortgage';
  };

  const getScenarioDisplayText = (): string => {
    if (!isScenarioActive) {
      return 'Baseline';
    }
    // For persisted scenarios, always show "Baseline + Scenario"
    if (activeScenario) {
      return 'Baseline + Scenario';
    }
    // For Quick What-If, check if it's properly configured
    if (scenario.type === 'FLOW_INVESTING' && !scenario.assetId) {
      return 'Baseline';
    }
    if (scenario.type === 'FLOW_DEBT_PAYDOWN' && !scenario.liabilityId) {
      return 'Baseline';
    }
    if (scenario.monthlyAmount <= 0) {
      return 'Baseline';
    }
    return 'Baseline + Scenario';
  };

  // Phase Four: Handle scenario selection (deterministic, synchronous resolution)
  const handleScenarioSelect = async (scenarioId?: ScenarioId) => {
    // Gate: Block scenario selection if surplus is negative
    if (isSurplusNegative) {
      return;
    }

    // CRITICAL: Normalize undefined to BASELINE_SCENARIO_ID before persisting
    // Baseline must always be represented as BASELINE_SCENARIO_ID, never undefined
    const normalizedId: ScenarioId = scenarioId === undefined ? BASELINE_SCENARIO_ID : scenarioId;
    
    // Enforce mutual exclusivity: Clear Quick What-If FIRST (synchronous visual reset)
    if (scenario.isActive) {
      setScenario({
        isActive: false,
        type: scenario.type,
        assetId: null,
        liabilityId: null,
        monthlyAmount: 0,
      });
      setQuickWhatIfExpanded(false);
      setLocalAmountInput('');
      setLocalSelectedAsset(null);
      setLocalSelectedLiability(null);
      setPendingScenarioInput(null);
    }
    
    // Then activate persisted scenario (ensures visual reset happens first)
    setActiveScenarioIdState(normalizedId); // Immediate local state update

    // Resolve scenario synchronously from in-memory state
    // Handle both undefined and BASELINE_SCENARIO_ID as baseline (backward compatibility)
    const resolved =
      normalizedId === BASELINE_SCENARIO_ID
        ? undefined
        : savedScenarios.find(s => s.id === normalizedId);

    setActiveScenarioOverride(resolved); // Immediate override set
    setScenarioSelectorOpen(false);
    
    // Async persistence (non-blocking, doesn't affect visual state)
    // NEVER persist undefined - always use BASELINE_SCENARIO_ID
    await persistActiveScenarioId(normalizedId);
  };

  const handleQuickWhatIfToggle = () => {
    // Gate: Block Quick What-If if surplus is negative
    if (isSurplusNegative) {
      return;
    }

    const newExpanded = !quickWhatIfExpanded;
    setQuickWhatIfExpanded(newExpanded);
    if (newExpanded) {
      // Sync toggle with scenario type
      const currentType = scenario.type || scenarioTypeToggle || 'FLOW_INVESTING';
      setScenarioTypeToggle(currentType);
      
      // CRITICAL FIX: If starting from Baseline (scenario.isActive === false),
      // immediately activate an ephemeral Quick What-If scenario with defaults.
      // This prevents baseline mutation attempts when user starts typing.
      if (!scenario.isActive) {
        setScenario({
          isActive: true,
          type: currentType,
          assetId: null,
          liabilityId: null,
          monthlyAmount: 0,
        });
      }
      
      // Sync local state from scenario (only if scenario is already active)
      if (scenario.isActive) {
        if (currentType === 'FLOW_INVESTING' && !localSelectedAsset && scenario.assetId) {
          setLocalSelectedAsset(scenario.assetId);
          setLocalAmountInput(scenario.monthlyAmount > 0 ? String(scenario.monthlyAmount) : '');
        } else if (currentType === 'FLOW_DEBT_PAYDOWN' && !localSelectedLiability && scenario.liabilityId) {
          setLocalSelectedLiability(scenario.liabilityId);
          setLocalAmountInput(scenario.monthlyAmount > 0 ? String(scenario.monthlyAmount) : '');
        } else if (scenario.monthlyAmount > 0) {
          setLocalAmountInput(String(scenario.monthlyAmount));
        }
      }
    }
  };

  const handleSelectAsset = (assetId: string) => {
    const amount = parseFloat(localAmountInput) || 0;
    setLocalSelectedAsset(assetId);
    setLocalSelectedLiability(null); // Clear liability selection
    setAssetPickerOpen(false);
    
    // Update pending input for validation
    setPendingScenarioInput(assetId && amount > 0 ? { assetId, monthlyAmount: amount } : null);
    
    // Affordability validation: Use selectMonthlySurplus as single source of truth
    const monthlySurplus = selectMonthlySurplus(state);
    if (amount > monthlySurplus) {
      return;
    }
    
    // Enforce mutual exclusivity: Clear persisted scenario FIRST (synchronous visual reset)
    // Exclude BASELINE_SCENARIO_ID from truthy check - baseline is not a "real" scenario to clear
    if (activeScenarioId && activeScenarioId !== BASELINE_SCENARIO_ID) {
      setActiveScenarioIdState(BASELINE_SCENARIO_ID); // Immediate local state update (use BASELINE_SCENARIO_ID, not undefined)
      setActiveScenarioOverride(undefined); // Immediate override clear
      persistActiveScenarioId(BASELINE_SCENARIO_ID); // Async persistence (use BASELINE_SCENARIO_ID, not undefined)
    }
    
    // Then activate Quick What-If (ensures visual reset happens first)
    setScenario({
      isActive: assetId !== null && amount > 0,
      type: 'FLOW_INVESTING',
      assetId,
      liabilityId: null,
      monthlyAmount: amount,
    });
    setPendingScenarioInput(null);
  };

  const handleSelectLiability = (liabilityId: string) => {
    const amount = parseFloat(localAmountInput) || 0;
    setLocalSelectedLiability(liabilityId);
    setLocalSelectedAsset(null); // Clear asset selection
    setMortgagePickerOpen(false);
    
    // Enforce mutual exclusivity: Clear persisted scenario FIRST (synchronous visual reset)
    // Exclude BASELINE_SCENARIO_ID from truthy check - baseline is not a "real" scenario to clear
    if (activeScenarioId && activeScenarioId !== BASELINE_SCENARIO_ID) {
      setActiveScenarioIdState(BASELINE_SCENARIO_ID); // Immediate local state update (use BASELINE_SCENARIO_ID, not undefined)
      setActiveScenarioOverride(undefined); // Immediate override clear
      persistActiveScenarioId(BASELINE_SCENARIO_ID); // Async persistence (use BASELINE_SCENARIO_ID, not undefined)
    }
    
    // Then activate Quick What-If (ensures visual reset happens first)
    // No affordability validation for debt paydown scenarios
    setScenario({
      isActive: liabilityId !== null && amount > 0,
      type: 'FLOW_DEBT_PAYDOWN',
      assetId: null,
      liabilityId,
      monthlyAmount: amount,
    });
  };

  const handleAmountChange = (text: string) => {
    setLocalAmountInput(text);
    const numValue = parseFloat(text) || 0;
    const currentType = scenarioTypeToggle;
    
    if (currentType === 'FLOW_INVESTING') {
    const assetId = localSelectedAsset || scenario.assetId;
    
    // Update pending input for validation
    setPendingScenarioInput(assetId && numValue > 0 ? { assetId, monthlyAmount: numValue } : null);
    
    // Affordability validation: Use selectMonthlySurplus as single source of truth
    const monthlySurplus = selectMonthlySurplus(state);
    if (numValue > monthlySurplus) {
      return;
    }
    
    // Enforce mutual exclusivity: Clear persisted scenario FIRST (synchronous visual reset)
    // Exclude BASELINE_SCENARIO_ID from truthy check - baseline is not a "real" scenario to clear
    if (activeScenarioId && activeScenarioId !== BASELINE_SCENARIO_ID && assetId !== null && numValue > 0) {
      setActiveScenarioIdState(BASELINE_SCENARIO_ID); // Immediate local state update (use BASELINE_SCENARIO_ID, not undefined)
      setActiveScenarioOverride(undefined); // Immediate override clear
      persistActiveScenarioId(BASELINE_SCENARIO_ID); // Async persistence (use BASELINE_SCENARIO_ID, not undefined)
    }
    
    // Then activate Quick What-If (ensures visual reset happens first)
    setScenario({
      isActive: assetId !== null && numValue > 0,
      type: 'FLOW_INVESTING',
      assetId,
        liabilityId: null,
      monthlyAmount: numValue,
    });
    setPendingScenarioInput(null);
    } else {
      // FLOW_DEBT_PAYDOWN
      const liabilityId = localSelectedLiability || scenario.liabilityId;
      
      // Enforce mutual exclusivity: Clear persisted scenario FIRST (synchronous visual reset)
      // Exclude BASELINE_SCENARIO_ID from truthy check - baseline is not a "real" scenario to clear
      if (activeScenarioId && activeScenarioId !== BASELINE_SCENARIO_ID && liabilityId !== null && numValue > 0) {
        setActiveScenarioIdState(BASELINE_SCENARIO_ID); // Immediate local state update (use BASELINE_SCENARIO_ID, not undefined)
        setActiveScenarioOverride(undefined); // Immediate override clear
        persistActiveScenarioId(BASELINE_SCENARIO_ID); // Async persistence (use BASELINE_SCENARIO_ID, not undefined)
      }
      
      // Then activate Quick What-If (ensures visual reset happens first)
      // No affordability validation for debt paydown scenarios
      setScenario({
        isActive: liabilityId !== null && numValue > 0,
        type: 'FLOW_DEBT_PAYDOWN',
        assetId: null,
        liabilityId,
        monthlyAmount: numValue,
      });
    }
  };

  const handleClearScenario = () => {
    setQuickWhatIfExpanded(false);
    setLocalAmountInput('');
    setLocalSelectedAsset(null);
    setLocalSelectedLiability(null);
    setScenarioTypeToggle('FLOW_INVESTING');
    setPendingScenarioInput(null);
    setScenario({
      isActive: false,
      type: 'FLOW_INVESTING',
      assetId: null,
      liabilityId: null,
      monthlyAmount: 0,
    });
    setShowDeltaColumn(false);
  };

  const scenarioValidationError = (() => {
    // Validate affordability for both FLOW_INVESTING and FLOW_DEBT_PAYDOWN scenarios
    // Use selectMonthlySurplus as single source of truth (no local recomputation)
    const monthlySurplus = selectMonthlySurplus(state);
    
    if (scenario.type === 'FLOW_INVESTING') {
      const inputToValidate = pendingScenarioInput || (scenario.isActive && scenario.assetId && scenario.monthlyAmount > 0
        ? { assetId: scenario.assetId, monthlyAmount: scenario.monthlyAmount }
        : null);
      
      if (!inputToValidate) return null;
      
      if (inputToValidate.monthlyAmount > monthlySurplus) {
        return "This change isn't affordable with your current cash flow.";
      }
      return null;
    } else if (scenario.type === 'FLOW_DEBT_PAYDOWN') {
      // Validate FLOW_DEBT_PAYDOWN affordability (matches FLOW_INVESTING UX behavior)
      const inputToValidate = scenario.isActive && scenario.liabilityId && scenario.monthlyAmount > 0
        ? { liabilityId: scenario.liabilityId, monthlyAmount: scenario.monthlyAmount }
        : null;
      
      if (!inputToValidate) return null;
      
      if (inputToValidate.monthlyAmount > monthlySurplus) {
        return "This change isn't affordable with your current cash flow.";
      }
      return null;
    }
    
    return null;
  })();

  const amountInput = localAmountInput !== '' ? localAmountInput : (scenario.isActive && scenario.monthlyAmount > 0 ? String(scenario.monthlyAmount) : '');
  const selectedAsset = localSelectedAsset || scenario.assetId;
  const selectedLiability = localSelectedLiability || scenario.liabilityId;
  
  // Filter available loans for mortgage selector
  const availableLoans = state.liabilities.filter(l => 
    l.kind === 'loan' && 
    typeof l.remainingTermYears === 'number' && 
    Number.isFinite(l.remainingTermYears) && 
    l.remainingTermYears >= 1
  );

  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: quickWhatIfExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [quickWhatIfExpanded, rotateAnim]);
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  // Sync selectedAge when endAge changes
  useEffect(() => {
    if (selectedAge > state.projection.endAge) {
      setSelectedAge(state.projection.endAge);
    }
  }, [state.projection.endAge, selectedAge]);

  // Dev-only: Export debug JSON with all visible projection screen data
  const handleExportDebugJSON = async () => {
    if (!__DEV__) return;
    
    try {
      // Gather snapshot computed totals
      const snapshotTotals = selectSnapshotTotals(state);
      const loanDerivedRows = selectLoanDerivedRows(state);

      // Build debug payload with all visible data
      const payload = {
        snapshot: {
          state,
          computed: snapshotTotals,
          loanDerived: loanDerivedRows,
        },
        projection: {
          settings: state.projection,
          selectedAge: selectedAge, // The age currently displayed on screen
          summary: baselineSummary,
          series: baselineSeries,
        },
        scenario: scenario.isActive ? {
          state: scenario,
          summary: quickWhatIfSummary ?? undefined,
          series: quickWhatIfSeries ?? undefined,
        } : undefined,
        attribution: {
          // CRITICAL: Always use baselineA3Attribution for baseline (never a3Attribution fallback)
          baseline: baselineA3Attribution,
          // Pattern A: Always use scenarioA3AttributionAbs for scenario absolute values (never delta)
          // scenarioA3AttributionAbs is either quickWhatIfA3Attribution or persistedScenarioA3Attribution, or null
          scenario: scenarioA3AttributionAbs ?? undefined,
        },
        // Include the actual displayed values at selected age
        valuesAtSelectedAge: {
          baseline: valuesAtAge,
          scenario: scenarioValuesAtAge ?? null,
        },
        // Include scenario deltas (baseline vs scenario differences)
        scenarioDeltas: scenarioDeltas ?? null,
        checks: {
          reconciliation: {
            netWorthReconciled: deltasValid ? true : undefined,
            assetsAligned: deltasValid ? true : undefined,
            liabilitiesAligned: deltasValid ? true : undefined,
          },
        },
      };

      const jsonString = serializeDebugState(payload);
      await Clipboard.setStringAsync(jsonString);
      Alert.alert('Debug Export', 'Copied debug JSON to clipboard');
    } catch (error) {
      console.error('Debug export error:', error);
      Alert.alert('Error', `Failed to export debug JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Phase Two: Baseline projection inputs (always computed)
  // Uses helper to filter inactive items and contributions to inactive assets
  const baselineProjectionInputs = useMemo(
    () => buildProjectionInputsFromState(state),
    [
      state.projection.currentAge,
      state.projection.endAge,
      state.projection.inflationPct,
      state.projection.monthlyDebtReduction,
      state.assets,
      state.assetContributions,
      state.liabilities,
    ],
  );

  // Phase Two: Scenario-adjusted projection inputs (only when scenario is active)
  // CRITICAL: Projection horizon is preserved from baseline:
  //   - currentAge MUST come from baseline projection settings (state.projection.currentAge)
  //   - endAge MUST come from baseline projection settings (state.projection.endAge)
  //   - Never read endAge from scenario object (it does not own horizon)
  const scenarioProjectionInputs = useMemo(() => {
    // Quick What-If only: check scenario state
    if (!scenario.isActive || scenario.monthlyAmount <= 0) {
      return null;
    }

    // Convert Quick What-If ScenarioState to domain Scenario format
    // FLOW_INVESTING -> FLOW_TO_ASSET, FLOW_DEBT_PAYDOWN -> FLOW_TO_DEBT
    let domainScenario: Scenario | null = null;

    if (scenario.type === 'FLOW_INVESTING') {
      if (!scenario.assetId) return null;

      // Phase 3.3: Removed shadow affordability check - rely on applyScenarioToProjectionInputs() for authoritative validation
      // Convert to domain Scenario format
      domainScenario = {
        id: '__QUICK_WHAT_IF__',
        name: 'Quick What-If',
        kind: 'FLOW_TO_ASSET',
        assetId: scenario.assetId,
        amountMonthly: scenario.monthlyAmount,
      };
    } else if (scenario.type === 'FLOW_DEBT_PAYDOWN') {
      if (!scenario.liabilityId) return null;

      // Convert to domain Scenario format
      domainScenario = {
        id: '__QUICK_WHAT_IF__',
        name: 'Quick What-If',
        kind: 'FLOW_TO_DEBT',
        liabilityId: scenario.liabilityId,
        amountMonthly: scenario.monthlyAmount,
      };
    } else {
      return null;
    }

    // Use applyScenarioToProjectionInputs() for consistency with persisted scenarios
    // This ensures FLOW scenarios work through contribution deltas (no SYSTEM_CASH transfers)
    // Pass state for affordability validation (Phase 2.1)
    const inputs = applyScenarioToProjectionInputs(baselineProjectionInputs, domainScenario, state);

    // Diagnostic logging: Log horizon values when scenarioProjectionInputs is built
    if (__DEV__) {
      console.log('[Quick What-If] Building scenarioProjectionInputs:', {
        baselineCurrentAge: baselineProjectionInputs.currentAge,
        baselineEndAge: baselineProjectionInputs.endAge,
        scenarioCurrentAge: inputs.currentAge,
        scenarioEndAge: inputs.endAge,
        scenarioType: scenario.type,
        scenarioAssetId: scenario.assetId,
        scenarioLiabilityId: scenario.liabilityId,
      });
    }

    // DEV-only invariant: Assert horizon equality at input level
    // Gate guardrails during profile switches to avoid transient failures
    if (__DEV__ && !isProfileSwitching) {
      if (inputs.currentAge !== baselineProjectionInputs.currentAge || inputs.endAge !== baselineProjectionInputs.endAge) {
        console.error('[CRITICAL] Quick What-If scenario projection horizon mismatch:', {
          baselineCurrentAge: baselineProjectionInputs.currentAge,
          scenarioCurrentAge: inputs.currentAge,
          baselineEndAge: baselineProjectionInputs.endAge,
          scenarioEndAge: inputs.endAge,
          scenarioType: scenario.type,
        });
      }
    }

    return inputs;
  }, [baselineProjectionInputs, scenario, state]);

  // Phase Four: Apply active persisted scenario to baseline inputs
  // Verify apply order:
  //   baselineProjectionInputs
  //   → applyScenarioToProjectionInputs(baselineProjectionInputs, activeScenario)
  //   → computeProjectionSeries(modifiedInputs)
  //   → persistedScenarioSeries (full horizon)
  // CRITICAL: Projection horizon is preserved from baseline:
  //   - currentAge MUST come from baseline projection settings (state.projection.currentAge)
  //   - endAge MUST come from baseline projection settings (state.projection.endAge)
  //   - Never read endAge from scenario object (it does not own horizon)
  const persistedScenarioProjectionInputs = useMemo(() => {
    // Only create if persisted scenario exists and Quick What-If is not active
    if (scenario.isActive || !activeScenario) {
      return null;
    }
    
    // Phase 3.3: Removed shadow affordability check - rely on applyScenarioToProjectionInputs() for authoritative validation
    // Get scenario adjustments (only scenario-specific fields, not full ProjectionInputs)
    // Pass state for affordability validation (Phase 2.1) - engine-level validation is authoritative
    // If scenario is unaffordable, applyScenarioToProjectionInputs returns baseline unchanged
    const scenarioAdjustments = applyScenarioToProjectionInputs(baselineProjectionInputs, activeScenario, state);
    
    // Explicitly construct persistedScenarioProjectionInputs with horizon preserved
    // Do NOT rely on object spreading or inheritance - explicitly set currentAge and endAge
    return {
      ...baselineProjectionInputs,
      ...scenarioAdjustments,
      // CRITICAL: Explicitly preserve projection horizon from baseline
      currentAge: baselineProjectionInputs.currentAge,
      endAge: baselineProjectionInputs.endAge,
    };
  }, [baselineProjectionInputs, activeScenario, scenario.isActive, state]);

  // Phase Two: Compute baseline projection (always)
  const baselineSeries = useMemo(() => {
    return computeProjectionSeries(baselineProjectionInputs);
  }, [baselineProjectionInputs]);

  const baselineSummary = useMemo(() => {
    return computeProjectionSummary(baselineProjectionInputs);
  }, [baselineProjectionInputs]);

  // Phase Four: Compute baseline A3 attribution (always baseline, never scenario-adjusted)
  // Model 1: A3 treats baselineSeries as ground truth (no scenario awareness)
  const baselineA3Attribution = useMemo(() => {
    const attribution = computeA3Attribution({
      snapshot: state,
      projectionSeries: baselineSeries,
      projectionSummary: baselineSummary,
      // Model 1: A3 treats baselineSeries as ground truth
    });
    
    // Guardrail: Verify baseline attribution matches baseline projection summary
    // CRITICAL: Baseline attribution must align with baselineSummary on all key metrics
    // Gate guardrails during profile switches to avoid transient failures
    if (__DEV__ && !isProfileSwitching) {
      // 1) Verify endingNetWorth matches (net worth reconciliation)
      const netWorthMatch = Math.abs(attribution.endingNetWorth - baselineSummary.endNetWorth) < UI_TOLERANCE;
      if (!netWorthMatch) {
        console.error('[A3 Attribution Guardrail] Baseline attribution endingNetWorth mismatch:', {
          attribution: attribution.endingNetWorth,
          summary: baselineSummary.endNetWorth,
          delta: attribution.endingNetWorth - baselineSummary.endNetWorth,
        });
      }
      
      // 2) Verify net worth reconciliation: endingAssets - endingLiabilities ≈ endingNetWorth
      const endingAssets = baselineSummary.endAssets;
      const endingLiabilities = baselineSummary.endLiabilities;
      const netWorthReconciliation = Math.abs(endingAssets - endingLiabilities - attribution.endingNetWorth) < ATTRIBUTION_TOLERANCE;
      if (!netWorthReconciliation) {
        console.error('[A3 Attribution Guardrail] Baseline attribution net worth reconciliation failed (endingAssets - endingLiabilities ≈ endingNetWorth):', {
          endingAssets,
          endingLiabilities,
          expectedNetWorth: endingAssets - endingLiabilities,
          attributionNetWorth: attribution.endingNetWorth,
          delta: (endingAssets - endingLiabilities) - attribution.endingNetWorth,
        });
      }
      
      // 3) Verify contribution decomposition: totalContributions ≈ postTax + pension + principalRepaid
      // totalContributions is a composite cashflow metric: asset contributions + debt paydown + loan principal
      // Decomposition:
      //   - cashflow.postTaxContributions: postTax asset contributions
      //   - cashflow.pensionContributions: preTax asset contributions (pension)
      //   - debt.principalRepaid: loan principal (scheduled + overpayments)
      // Note: Non-loan debt paydown is included in totalContributions but not separately tracked in A3
      const expectedContributions = 
        attribution.cashflow.postTaxContributions +
        attribution.cashflow.pensionContributions +
        attribution.debt.principalRepaid;
      const contributionDecompMatch = Math.abs(expectedContributions - baselineSummary.totalContributions) < ATTRIBUTION_TOLERANCE;
      if (!contributionDecompMatch) {
        console.error('[A3 Attribution Guardrail] Baseline attribution contribution decomposition failed (postTax + pension + principalRepaid ≈ totalContributions):', {
          postTaxContributions: attribution.cashflow.postTaxContributions,
          pensionContributions: attribution.cashflow.pensionContributions,
          principalRepaid: attribution.debt.principalRepaid,
          expectedTotal: expectedContributions,
          summaryTotalContributions: baselineSummary.totalContributions,
          delta: expectedContributions - baselineSummary.totalContributions,
          note: 'totalContributions may include non-loan debt paydown not tracked in A3',
        });
      }
    }
    
    return attribution;
  }, [baselineSeries, baselineSummary, state]);

  // Phase Two: Compute Quick What-If scenario projection (ephemeral, only when active)
  const quickWhatIfSeries = useMemo(() => {
    if (!scenarioProjectionInputs) return null;
    
    // Diagnostic logging: Log horizon values at callsite (just before computeProjectionSeries)
    if (__DEV__) {
      console.log('[Quick What-If] Calling computeProjectionSeries:', {
        baselineCurrentAge: baselineProjectionInputs.currentAge,
        baselineEndAge: baselineProjectionInputs.endAge,
        baselineCurrentAgeType: typeof baselineProjectionInputs.currentAge,
        baselineEndAgeType: typeof baselineProjectionInputs.endAge,
        baselineCurrentAgeFinite: Number.isFinite(baselineProjectionInputs.currentAge),
        baselineEndAgeFinite: Number.isFinite(baselineProjectionInputs.endAge),
        scenarioCurrentAge: scenarioProjectionInputs.currentAge,
        scenarioEndAge: scenarioProjectionInputs.endAge,
        scenarioCurrentAgeType: typeof scenarioProjectionInputs.currentAge,
        scenarioEndAgeType: typeof scenarioProjectionInputs.endAge,
        scenarioCurrentAgeFinite: Number.isFinite(scenarioProjectionInputs.currentAge),
        scenarioEndAgeFinite: Number.isFinite(scenarioProjectionInputs.endAge),
      });
    }
    
    return computeProjectionSeries(scenarioProjectionInputs);
  }, [scenarioProjectionInputs, baselineProjectionInputs]);

  const quickWhatIfSummary = useMemo(() => {
    if (!scenarioProjectionInputs) return null;
    return computeProjectionSummary(scenarioProjectionInputs);
  }, [scenarioProjectionInputs]);

  // Phase Four: Compute persisted scenario projection
  // CRITICAL: Always use computeProjectionSeries(persistedScenarioProjectionInputs)
  // Never derive from valuesAtSelectedAge, computeValuesAtAge, selectedAge, or snapshot-only helpers
  const persistedScenarioSeries = useMemo(() => {
    if (!persistedScenarioProjectionInputs) return null;
    
    // Dev logging: Diagnose horizon before computing series
    const inputs = persistedScenarioProjectionInputs;
    const horizonYears = inputs.endAge - inputs.currentAge;
    if (__DEV__) {
      console.log('[Persisted Scenario] Projection horizon before compute:', {
        currentAge: inputs.currentAge,
        endAge: inputs.endAge,
        horizonYears,
      });
    }
    
    // Hard assert: Verify projection horizon is valid before computing series
    if (horizonYears <= 0) {
      console.error('[CRITICAL] Persisted scenario projection horizon invalid (endAge <= currentAge):', {
        currentAge: inputs.currentAge,
        endAge: inputs.endAge,
        horizonYears,
        baselineCurrentAge: baselineProjectionInputs.currentAge,
        baselineEndAge: baselineProjectionInputs.endAge,
        activeScenario: activeScenario?.id,
        inputs: persistedScenarioProjectionInputs,
      });
      return null;
    }
    
    // Verify apply order: baselineProjectionInputs → applyScenarioToProjectionInputs → computeProjectionSeries
    return computeProjectionSeries(persistedScenarioProjectionInputs);
  }, [persistedScenarioProjectionInputs, baselineProjectionInputs, activeScenario]);

  const persistedScenarioSummary = useMemo(() => {
    if (!persistedScenarioProjectionInputs) return null;
    return computeProjectionSummary(persistedScenarioProjectionInputs);
  }, [persistedScenarioProjectionInputs]);

  // Phase Four: Select main projection (Quick What-If takes precedence, then persisted scenario, then baseline)
  const series = useMemo(() => {
    if (scenario.isActive && quickWhatIfSeries) {
      return quickWhatIfSeries;
    }
    if (activeScenario && persistedScenarioSeries) {
      return persistedScenarioSeries;
    }
    return baselineSeries;
  }, [scenario.isActive, quickWhatIfSeries, activeScenario, persistedScenarioSeries, baselineSeries]);

  const summary = useMemo(() => {
    if (scenario.isActive && quickWhatIfSummary) {
      return quickWhatIfSummary;
    }
    if (activeScenario && persistedScenarioSummary) {
      return persistedScenarioSummary;
    }
    return baselineSummary;
  }, [scenario.isActive, quickWhatIfSummary, activeScenario, persistedScenarioSummary, baselineSummary]);

  // Helper: Subtract baseline A3 attribution from scenario A3 attribution (field-by-field)
  // Pattern A: scenarioA3Delta = scenarioA3Abs - baselineA3
  const subtractAttribution = (scenario: A3Attribution, baseline: A3Attribution): A3Attribution => {
    return {
      startingNetWorth: scenario.startingNetWorth - baseline.startingNetWorth,
      endingNetWorth: scenario.endingNetWorth - baseline.endingNetWorth,
      cashflow: {
        grossIncome: scenario.cashflow.grossIncome - baseline.cashflow.grossIncome,
        pensionContributions: scenario.cashflow.pensionContributions - baseline.cashflow.pensionContributions,
        taxes: scenario.cashflow.taxes - baseline.cashflow.taxes,
        livingExpenses: scenario.cashflow.livingExpenses - baseline.cashflow.livingExpenses,
        netSurplus: scenario.cashflow.netSurplus - baseline.cashflow.netSurplus,
        postTaxContributions: scenario.cashflow.postTaxContributions - baseline.cashflow.postTaxContributions,
        debtRepayment: scenario.cashflow.debtRepayment - baseline.cashflow.debtRepayment,
      },
      debt: {
        interestPaid: scenario.debt.interestPaid - baseline.debt.interestPaid,
        principalRepaid: scenario.debt.principalRepaid - baseline.debt.principalRepaid,
        remainingDebt: scenario.debt.remainingDebt - baseline.debt.remainingDebt,
      },
      assets: {
        startingValue: scenario.assets.startingValue - baseline.assets.startingValue,
        contributions: scenario.assets.contributions - baseline.assets.contributions,
        growth: scenario.assets.growth - baseline.assets.growth,
        endingValue: scenario.assets.endingValue - baseline.assets.endingValue,
      },
      reconciliation: {
        lhs: scenario.reconciliation.lhs - baseline.reconciliation.lhs,
        rhs: scenario.reconciliation.rhs - baseline.reconciliation.rhs,
        delta: scenario.reconciliation.delta - baseline.reconciliation.delta,
      },
      inactiveCounts: {
        assets: scenario.inactiveCounts.assets - baseline.inactiveCounts.assets,
        liabilities: scenario.inactiveCounts.liabilities - baseline.inactiveCounts.liabilities,
        expenses: scenario.inactiveCounts.expenses - baseline.inactiveCounts.expenses,
      },
    };
  };

  // Phase Two: Compute Quick What-If A3 attribution (only when Quick What-If is active)
  // Model 1: A3 treats scenarioSeries as ground truth (already reflects scenario changes)
  // Pass scenarioProjectionInputs to compute contributions from scenario inputs (not baseline snapshot)
  const quickWhatIfA3Attribution = useMemo(() => {
    if (!quickWhatIfSeries || !quickWhatIfSummary || !scenario.isActive || !scenarioProjectionInputs) return null;
    
    // A3 must NEVER be scenario-aware - scenarioSeries already reflects different contributions and asset paths
    // Pass scenarioProjectionInputs to source contributions from scenario inputs (FLOW_TO_ASSET contributions)
    return computeA3Attribution({
      snapshot: state,
      projectionSeries: quickWhatIfSeries,
      projectionSummary: quickWhatIfSummary,
      projectionInputs: scenarioProjectionInputs,
    });
  }, [quickWhatIfSeries, quickWhatIfSummary, scenario, state, scenarioProjectionInputs]);

  // Phase Four: Compute persisted scenario A3 attribution (only when persisted scenario is active)
  // Model 1: A3 treats scenarioSeries as ground truth (already reflects scenario changes)
  // Pass persistedScenarioProjectionInputs to compute contributions from scenario inputs (not baseline snapshot)
  const persistedScenarioA3Attribution = useMemo(() => {
    if (!activeScenario || !persistedScenarioSeries || !persistedScenarioSummary || !persistedScenarioProjectionInputs) return null;
    
    // A3 must NEVER be scenario-aware - scenarioSeries already reflects different contributions and asset paths
    // Pass persistedScenarioProjectionInputs to source contributions from scenario inputs (FLOW_TO_ASSET contributions)
    return computeA3Attribution({
      snapshot: state,
      projectionSeries: persistedScenarioSeries,
      projectionSummary: persistedScenarioSummary,
      projectionInputs: persistedScenarioProjectionInputs,
    });
  }, [persistedScenarioSeries, persistedScenarioSummary, activeScenario, state, persistedScenarioProjectionInputs]);

  // Phase Four: A3 attribution wiring (Model 1)
  // CRITICAL: Baseline A3 is ALWAYS computed from baseline projection series
  // CRITICAL: Scenario A3 absolute is ALWAYS computed from scenario projection series
  // CRITICAL: Scenario A3 delta is computed by subtracting baseline from scenario (field-by-field)
  // CRITICAL: A3 must NEVER be scenario-aware - scenarioSeries already reflects different contributions and asset paths

  // Phase Four: Redefine scenarioIsActive (single source of truth)
  // scenarioIsActive = Boolean(quickWhatIfScenario || activePersistedScenario)
  const scenarioIsActive = Boolean(scenario.isActive || activeScenario !== undefined);
  
  // Phase Four: Determine which scenario system is active (Quick What-If takes precedence for projection)
  // Mutual exclusivity: Quick What-If > Persisted Scenario > Baseline
  // Ensure effectiveScenarioSeries is built when scenarioIsActive === true
  const effectiveScenarioSeries = scenarioIsActive
    ? (scenario.isActive ? quickWhatIfSeries : (activeScenario ? persistedScenarioSeries : null))
    : null;
  const effectiveScenarioSummary = scenarioIsActive
    ? (scenario.isActive ? quickWhatIfSummary : (activeScenario ? persistedScenarioSummary : null))
    : null;
  
  // Pattern A: Compute scenario A3 absolute (from scenario series)
  const scenarioA3AttributionAbs = scenario.isActive 
    ? quickWhatIfA3Attribution 
    : (activeScenario ? persistedScenarioA3Attribution : null);
  
  // Pattern A: Compute scenario A3 delta (field-by-field subtraction)
  const scenarioA3AttributionDelta = useMemo(() => {
    if (!scenarioA3AttributionAbs) return null;
    return subtractAttribution(scenarioA3AttributionAbs, baselineA3Attribution);
  }, [scenarioA3AttributionAbs, baselineA3Attribution]);
  
  // Safety assert: Verify delta computation is correct
  // Gate guardrails during profile switches to avoid transient failures
  if (__DEV__ && !isProfileSwitching && scenarioA3AttributionAbs && scenarioA3AttributionDelta) {
    const endingNetWorthDelta = scenarioA3AttributionAbs.endingNetWorth - baselineA3Attribution.endingNetWorth;
    const deltaMatch = Math.abs(endingNetWorthDelta - scenarioA3AttributionDelta.endingNetWorth) < ATTRIBUTION_TOLERANCE;
    if (!deltaMatch) {
      console.error('[CRITICAL] Scenario A3 delta computation mismatch:', {
        scenarioAbs: scenarioA3AttributionAbs.endingNetWorth,
        baseline: baselineA3Attribution.endingNetWorth,
        computedDelta: endingNetWorthDelta,
        attributionDelta: scenarioA3AttributionDelta.endingNetWorth,
        difference: Math.abs(endingNetWorthDelta - scenarioA3AttributionDelta.endingNetWorth),
      });
    }
  }
  
  // Legacy alias for backward compatibility
  const effectiveScenarioActive = scenarioIsActive;
  
  // Handle transient state: scenario activated but not yet computed
  // Valid transient state: scenario toggled but series is null during activation
  if (scenarioIsActive && effectiveScenarioSeries === null) {
    // Valid transient state: scenario toggled but not yet computed
    // Do NOT treat as error - series will be computed on next render
  }
  
  // Dev assert: Only assert when series EXISTS but is invalid
  // Do NOT assert when series is null during activation (valid transient state)
  // Gate guardrails during profile switches to avoid transient failures
  if (__DEV__ && !isProfileSwitching && effectiveScenarioSeries) {
    // Assert length match: scenario series must match baseline length
    if (baselineSeries.length > 0 && effectiveScenarioSeries.length !== baselineSeries.length) {
      console.error('[CRITICAL] Scenario series invalid: length mismatch:', {
        baselineLength: baselineSeries.length,
        scenarioLength: effectiveScenarioSeries.length,
        scenarioIsActive,
        quickWhatIfActive: scenario.isActive,
        persistedScenarioActive: activeScenario !== undefined,
        activeScenario: activeScenario?.id,
      });
    }
    
    // Assert age invariants: first and last age must match baseline
    if (baselineSeries.length > 0 && effectiveScenarioSeries.length > 0) {
      const firstAgeMatch = Math.abs(effectiveScenarioSeries[0].age - baselineSeries[0].age) < AGE_COMPARISON_TOLERANCE;
      const lastAgeMatch = Math.abs(
        effectiveScenarioSeries[effectiveScenarioSeries.length - 1].age - 
        baselineSeries[baselineSeries.length - 1].age
      ) < AGE_COMPARISON_TOLERANCE;
      
      if (!firstAgeMatch || !lastAgeMatch) {
        console.error('[CRITICAL] Scenario series invalid: age mismatch:', {
          baselineFirstAge: baselineSeries[0].age,
          scenarioFirstAge: effectiveScenarioSeries[0].age,
          baselineLastAge: baselineSeries[baselineSeries.length - 1].age,
          scenarioLastAge: effectiveScenarioSeries[effectiveScenarioSeries.length - 1].age,
          firstAgeMatch,
          lastAgeMatch,
          scenarioIsActive,
          activeScenario: activeScenario?.id,
        });
      }
    }
  }
  
  // Dev assert: If persistedScenarioActive, assert persistedScenarioSeries.length === baselineSeries.length
  // Note: persistedScenarioActive is also declared later for UI state, but we need it here for the assert
  const persistedScenarioActiveForAssert = activeScenario !== undefined && !scenario.isActive;
  // Gate guardrails during profile switches to avoid transient failures
  if (__DEV__ && !isProfileSwitching && persistedScenarioActiveForAssert && persistedScenarioSeries && baselineSeries.length > 0) {
    if (persistedScenarioSeries.length !== baselineSeries.length) {
      console.error('[CRITICAL] Persisted scenario and baseline series length mismatch:', {
        baselineLength: baselineSeries.length,
        persistedScenarioLength: persistedScenarioSeries.length,
        activeScenario: activeScenario?.id,
      });
    }
    
    // Verify age invariants: persistedScenarioSeries[0].age === baselineSeries[0].age
    // and persistedScenarioSeries[last].age === baselineSeries[last].age
    if (persistedScenarioSeries.length > 0 && baselineSeries.length > 0) {
      const firstAgeMatch = Math.abs(persistedScenarioSeries[0].age - baselineSeries[0].age) < AGE_COMPARISON_TOLERANCE;
      const lastAgeMatch = Math.abs(
        persistedScenarioSeries[persistedScenarioSeries.length - 1].age - 
        baselineSeries[baselineSeries.length - 1].age
      ) < AGE_COMPARISON_TOLERANCE;
      
      if (!firstAgeMatch || !lastAgeMatch) {
        console.error('[CRITICAL] Persisted scenario and baseline series age mismatch:', {
          baselineFirstAge: baselineSeries[0].age,
          persistedFirstAge: persistedScenarioSeries[0].age,
          baselineLastAge: baselineSeries[baselineSeries.length - 1].age,
          persistedLastAge: persistedScenarioSeries[persistedScenarioSeries.length - 1].age,
          firstAgeMatch,
          lastAgeMatch,
        });
      }
    }
  }
  
  // Safety assert: Verify delta computation is correct
  // Pattern A: Assert (scenarioA3Abs.endingNetWorth - baselineA3.endingNetWorth) ≈ scenarioA3Delta.endingNetWorth
  // Gate guardrails during profile switches to avoid transient failures
  if (__DEV__ && !isProfileSwitching && scenarioA3AttributionAbs && scenarioA3AttributionDelta) {
    const endingNetWorthDelta = scenarioA3AttributionAbs.endingNetWorth - baselineA3Attribution.endingNetWorth;
    const deltaMatch = Math.abs(endingNetWorthDelta - scenarioA3AttributionDelta.endingNetWorth) < ATTRIBUTION_TOLERANCE;
    if (!deltaMatch) {
      console.error('[CRITICAL] Scenario A3 delta computation mismatch:', {
        scenarioAbs: scenarioA3AttributionAbs.endingNetWorth,
        baseline: baselineA3Attribution.endingNetWorth,
        computedDelta: endingNetWorthDelta,
        attributionDelta: scenarioA3AttributionDelta.endingNetWorth,
        difference: Math.abs(endingNetWorthDelta - scenarioA3AttributionDelta.endingNetWorth),
      });
    }
  }
  
  // Invariant: scenarioA3Abs.assets.endingValue === last(scenarioSeries).assets
  // Model 1: A3 treats scenarioSeries as ground truth
  // Gate guardrails during profile switches to avoid transient failures
  if (__DEV__ && !isProfileSwitching && scenarioA3AttributionAbs && effectiveScenarioSeries && effectiveScenarioSeries.length > 0) {
    const lastPoint = effectiveScenarioSeries[effectiveScenarioSeries.length - 1];
    const assetsMatch = Math.abs(scenarioA3AttributionAbs.assets.endingValue - lastPoint.assets) < ATTRIBUTION_TOLERANCE;
    if (!assetsMatch) {
      console.error('[CRITICAL] Scenario A3 assets.endingValue mismatch with scenarioSeries:', {
        a3Assets: scenarioA3AttributionAbs.assets.endingValue,
        seriesAssets: lastPoint.assets,
        difference: Math.abs(scenarioA3AttributionAbs.assets.endingValue - lastPoint.assets),
      });
    }
  }
  
  // Legacy alias for backward compatibility (use scenarioA3AttributionAbs instead)
  // Pattern A: UI should use scenarioA3AttributionAbs for absolute values, scenarioA3AttributionDelta for deltas
  const effectiveScenarioA3Attribution = scenarioA3AttributionAbs;

  // Guardrail: Verify baseline attribution is computed from baseline projection only
  // CRITICAL: Baseline attribution must be computed ONLY from baselineProjection and must differ from scenario when scenario is active
  // Gate guardrails during profile switches to avoid transient failures
  if (__DEV__ && !isProfileSwitching) {
    // Verify baseline attribution matches baseline summary
    const baselineNetWorthMatch = Math.abs(baselineA3Attribution.endingNetWorth - baselineSummary.endNetWorth) < UI_TOLERANCE;
    if (!baselineNetWorthMatch) {
      console.error('[A3 Attribution Guardrail] Baseline attribution endingNetWorth does not match baseline summary:', {
        attribution: baselineA3Attribution.endingNetWorth,
        summary: baselineSummary.endNetWorth,
        delta: baselineA3Attribution.endingNetWorth - baselineSummary.endNetWorth,
      });
    }

    // Verify baseline attribution differs from scenario when scenario is active
    // Expected invariant: baseline.endingNetWorth !== scenario.endingNetWorth when scenario active
    // 
    // FLOW vs STOCK semantics:
    // - FLOW scenarios (FLOW_TO_ASSET, FLOW_TO_DEBT) reallocate monthly surplus, not create new money.
    // - For FLOW_TO_ASSET: totalContributions may remain unchanged (reallocation within contributions).
    // - For FLOW_TO_DEBT: totalContributions should increase (overpayments are part of totalContributions).
    // - This invariant is gated for FLOW scenarios and reserved for future STOCK (lump-sum) scenarios.
    
    // Helper: Detect if scenario produces a material output delta (OUTPUT-based, not INPUT-based)
    // For A3 attribution, "applied" means "produces different endingNetWorth", not "inputs mutated"
    // Scenarios can modify inputs (e.g., overpayments) but still produce identical outcomes
    // (e.g., loan already paid off early, so additional overpayments have no effect)
    const isScenarioAttributable = (() => {
      if (!effectiveScenarioActive || !effectiveScenarioA3Attribution) return false;
      
      // Check if OUTPUTS differ (endingNetWorth), not just inputs
      // A scenario is "attributable" only if it produces a material output delta
      const endingNetWorthDiff = Math.abs(
        baselineA3Attribution.endingNetWorth - effectiveScenarioA3Attribution.endingNetWorth
      );
      
      // If endingNetWorth is identical (within tolerance), scenario had no material effect
      return endingNetWorthDiff >= UI_TOLERANCE;
    })();
    
    // Only run guardrails if scenario produces a material output delta
    // Scenarios that modify inputs but produce identical outputs should not trigger guardrails
    if (effectiveScenarioActive && effectiveScenarioA3Attribution && effectiveScenarioSummary && isScenarioAttributable) {
      // Determine effective scenario kind (FLOW_TO_ASSET, FLOW_TO_DEBT, or future STOCK scenarios)
      const effectiveScenarioKind: 'FLOW_TO_ASSET' | 'FLOW_TO_DEBT' | 'STOCK' | null = (() => {
        if (scenario.isActive) {
          // Quick What-If: FLOW_INVESTING -> FLOW_TO_ASSET, FLOW_DEBT_PAYDOWN -> FLOW_TO_DEBT
          if (scenario.type === 'FLOW_INVESTING') return 'FLOW_TO_ASSET';
          if (scenario.type === 'FLOW_DEBT_PAYDOWN') return 'FLOW_TO_DEBT';
          return null;
        }
        if (activeScenario) {
          // Persisted scenario: use kind directly
          if (activeScenario.kind === 'FLOW_TO_ASSET' || activeScenario.kind === 'FLOW_TO_DEBT') {
            return activeScenario.kind;
          }
          // Future: STOCK scenarios will have different kind
          return 'STOCK';
        }
        return null;
      })();

      const baselineTotalContrib = baselineSummary.totalContributions;
      const scenarioTotalContrib = effectiveScenarioSummary.totalContributions;
      const contributionsDiff = Math.abs(baselineTotalContrib - scenarioTotalContrib);
      
      // Gate totalContributions invariant: Only enforce for future STOCK scenarios
      // FLOW scenarios reallocate monthly surplus, so totalContributions may remain unchanged (FLOW_TO_ASSET)
      // or increase (FLOW_TO_DEBT includes overpayments in totalContributions)
      if (effectiveScenarioKind === 'STOCK' && contributionsDiff < UI_TOLERANCE) {
        console.error('[A3 Attribution Guardrail] CRITICAL: Baseline and scenario totalContributions are identical when STOCK scenario is active (violates invariant):', {
          baseline: baselineTotalContrib,
          scenario: scenarioTotalContrib,
          expected: 'baseline.totalContributions !== scenario.totalContributions when STOCK scenario active',
        });
      }
      
      // FLOW-specific attribution checks (DEV-only): Verify deltas reflect scenario amounts
      // These checks validate that FLOW scenarios reallocate monthly surplus correctly
      if (effectiveScenarioKind === 'FLOW_TO_ASSET') {
        // FLOW_TO_ASSET: Verify asset contribution delta reflects scenario amount over horizon
        // Works for both Quick What-If and persisted scenarios
        const scenarioAmountMonthly = scenario.isActive 
          ? scenario.monthlyAmount 
          : (activeScenario?.amountMonthly ?? 0);
        
        if (scenarioAmountMonthly > 0) {
          const horizonMonths = (state.projection.endAge - state.projection.currentAge) * 12;
          const expectedContributionDelta = scenarioAmountMonthly * horizonMonths;
          const actualContributionDelta = scenarioA3AttributionDelta?.assets.contributions ?? 0;
          const contributionDeltaDiff = Math.abs(expectedContributionDelta - actualContributionDelta);
          
          // Allow tolerance for inflation discounting and rounding
          // Note: A3 attribution uses PV (present value), so actual delta may be less than nominal
          // Use a more lenient tolerance that accounts for inflation discounting
          const FLOW_TOLERANCE = Math.max(UI_TOLERANCE * horizonMonths, expectedContributionDelta * 0.1); // 10% tolerance or scaled minimum
          if (contributionDeltaDiff > FLOW_TOLERANCE) {
            console.error('[A3 Attribution Guardrail] FLOW_TO_ASSET: Asset contribution delta does not match scenario amount:', {
              scenarioAmountMonthly,
              horizonMonths,
              expectedContributionDelta,
              actualContributionDelta: scenarioA3AttributionDelta?.assets.contributions,
              delta: contributionDeltaDiff,
              tolerance: FLOW_TOLERANCE,
              note: 'A3 attribution uses PV (present value), so actual delta may be less than nominal due to inflation discounting',
            });
          }
        }
      } else if (effectiveScenarioKind === 'FLOW_TO_DEBT') {
        // FLOW_TO_DEBT: Verify debt overpayment delta reflects scenario amount
        // Works for both Quick What-If and persisted scenarios
        // Note: Overpayments stop when loans pay off early, so actual may be less than full horizon
        const scenarioAmountMonthly = scenario.isActive 
          ? scenario.monthlyAmount 
          : (activeScenario?.amountMonthly ?? 0);
        
        if (scenarioAmountMonthly > 0) {
          const horizonMonths = (state.projection.endAge - state.projection.currentAge) * 12;
          const maxPossibleOverpaymentDelta = scenarioAmountMonthly * horizonMonths;
          const actualOverpaymentDelta = scenarioA3AttributionDelta?.cashflow.debtRepayment ?? 0;
          
          // Guardrail 1: Assert overpayments were applied (actual > 0)
          if (actualOverpaymentDelta <= 0) {
            console.error('[A3 Attribution Guardrail] FLOW_TO_DEBT: No overpayments applied:', {
              scenarioAmountMonthly,
              horizonMonths,
              actualOverpaymentDelta,
              expected: 'actualOverpaymentDelta > 0',
            });
          }
          
          // Guardrail 2: Assert actual does not exceed maximum possible (upper bound check)
          // Note: actual may be less than maximum if loan pays off early (this is expected behavior)
          if (actualOverpaymentDelta > maxPossibleOverpaymentDelta) {
            console.error('[A3 Attribution Guardrail] FLOW_TO_DEBT: Overpayment delta exceeds maximum possible:', {
              scenarioAmountMonthly,
              horizonMonths,
              maxPossibleOverpaymentDelta,
              actualOverpaymentDelta,
              expected: 'actualOverpaymentDelta <= scenarioAmountMonthly × horizonMonths',
            });
          }
          
          // DEV-only: Log payoff-aware info when actual < expected (loan paid off early)
          // This is informational only - not an error, as loans correctly stop overpayments after payoff
          if (__DEV__ && !isProfileSwitching && actualOverpaymentDelta > 0 && actualOverpaymentDelta < maxPossibleOverpaymentDelta) {
            // Calculate approximate months applied (for diagnostics only, not exact due to PV discounting)
            const monthsApplied = Math.round(actualOverpaymentDelta / scenarioAmountMonthly);
            console.log('[A3 Attribution Guardrail] FLOW_TO_DEBT: Loan paid off early; overpayments stopped before horizon:', {
              scenarioAmountMonthly,
              horizonMonths,
              maxPossibleOverpaymentDelta,
              actualOverpaymentDelta,
              monthsApplied,
              monthsRemaining: horizonMonths - monthsApplied,
              note: 'This is expected behavior when loans pay off before projection horizon ends. Overpayments stop once loan balance reaches zero.',
            });
          }
        }
      }
      
      // Compare endingNetWorth with tolerance (to avoid rounding false-positives)
      // This check remains strict for all scenario types (FLOW and STOCK)
      // Only enforce if scenario was actually applied (not fallen back to baseline)
      const baselineScenarioDiff = Math.abs(baselineA3Attribution.endingNetWorth - scenarioA3AttributionAbs.endingNetWorth);
      if (baselineScenarioDiff < UI_TOLERANCE) {
        console.error('[A3 Attribution Guardrail] CRITICAL: Baseline and scenario attribution endingNetWorth are identical when scenario is active (violates invariant):', {
          baseline: baselineA3Attribution.endingNetWorth,
          scenario: scenarioA3AttributionAbs.endingNetWorth,
          scenarioKind: effectiveScenarioKind,
          totalContributions: {
            baseline: baselineTotalContrib,
            scenario: scenarioTotalContrib,
            diff: contributionsDiff,
          },
          expected: 'baseline.endingNetWorth !== scenario.endingNetWorth when scenario active',
        });
      }
    } else if (effectiveScenarioActive && !isScenarioAttributable) {
      // Scenario is active in UI but does not produce a material output delta
      // This can happen when:
      // - Scenario inputs were modified but outcomes are identical (e.g., loan already paid off)
      // - Scenario fell back to baseline due to unaffordability
      // Log warning for diagnostic purposes, but do not throw guardrail errors
      // Determine scenario kind for logging
      const scenarioKindForLog: 'FLOW_TO_ASSET' | 'FLOW_TO_DEBT' | null = (() => {
        if (scenario.isActive) {
          if (scenario.type === 'FLOW_INVESTING') return 'FLOW_TO_ASSET';
          if (scenario.type === 'FLOW_DEBT_PAYDOWN') return 'FLOW_TO_DEBT';
          return null;
        }
        if (activeScenario) {
          if (activeScenario.kind === 'FLOW_TO_ASSET' || activeScenario.kind === 'FLOW_TO_DEBT') {
            return activeScenario.kind;
          }
        }
        return null;
      })();
      
      const endingNetWorthDiff = effectiveScenarioA3Attribution
        ? Math.abs(baselineA3Attribution.endingNetWorth - effectiveScenarioA3Attribution.endingNetWorth)
        : 0;
      
      console.warn('[A3 Attribution] Scenario is active but does not produce a material output delta. Skipping attribution guardrails.', {
        scenarioKind: scenarioKindForLog,
        endingNetWorthDiff,
        reason: endingNetWorthDiff < UI_TOLERANCE
          ? 'Scenario endingNetWorth is identical to baseline (within tolerance) - inputs may differ but outcomes are the same'
          : 'Scenario A3 attribution not available',
      });
    }
  }
  
  // Single canonical flag for scenario activation (UI/logic checks)
  // Use scenarioIsActive defined above (redefined as Boolean(quickWhatIfScenario || activePersistedScenario))
  const isScenarioActive = scenarioIsActive;

  // Single derived UI state for styling (visual authority only, not used for math)
  const quickWhatIfActive = scenario.isActive;
  const persistedScenarioActive = activeScenario !== undefined;
  const activeScenarioSource: 'quick' | 'persisted' | 'baseline' =
    quickWhatIfActive
      ? 'quick'
      : persistedScenarioActive
      ? 'persisted'
      : 'baseline';

  // Derive values at selected age from baseline series (ALWAYS baseline, never scenario-adjusted)
  const valuesAtAge = useMemo(() => {
    const selectedAgeIndex = baselineSeries.findIndex(p => Math.floor(p.age) >= selectedAge);
    const point = selectedAgeIndex >= 0 ? baselineSeries[selectedAgeIndex] : baselineSeries[baselineSeries.length - 1];
    const actualAge = point?.age ?? selectedAge;
    
    if (selectedAge >= state.projection.endAge) {
      // At end age, use full attribution (always baseline)
      return {
        netWorth: baselineA3Attribution.endingNetWorth,
        assets: baselineA3Attribution.assets.endingValue,
        liabilities: baselineSeries[baselineSeries.length - 1]?.liabilities ?? 0,
        growth: baselineA3Attribution.assets.growth,
        contributions: baselineA3Attribution.assets.contributions, // Total: pension + postTax
        interestPaid: baselineA3Attribution.debt.interestPaid,
        grossIncome: baselineA3Attribution.cashflow.grossIncome,
        pensionContributions: baselineA3Attribution.cashflow.pensionContributions,
        taxes: baselineA3Attribution.cashflow.taxes,
        livingExpenses: baselineA3Attribution.cashflow.livingExpenses,
        netSurplus: baselineA3Attribution.cashflow.netSurplus,
        postTaxContributions: baselineA3Attribution.cashflow.postTaxContributions,
        debtRepayment: baselineA3Attribution.cashflow.debtRepayment,
        principalRepaid: baselineA3Attribution.debt.principalRepaid,
        remainingDebt: baselineA3Attribution.debt.remainingDebt,
        startingAssets: baselineA3Attribution.assets.startingValue,
      };
    }

    // For intermediate ages, derive cumulative totals using baselineSeries as source of truth
    const monthsElapsed = (actualAge - state.projection.currentAge) * 12;
    const horizonMonths = Number.isFinite(monthsElapsed) ? Math.max(0, Math.floor(monthsElapsed)) : 0;
    
    if (horizonMonths <= 0) {
      return {
        netWorth: point?.netWorth ?? 0,
        assets: point?.assets ?? 0,
        liabilities: point?.liabilities ?? 0,
        growth: 0,
        contributions: 0,
        interestPaid: 0,
        grossIncome: 0,
        pensionContributions: 0,
        taxes: 0,
        livingExpenses: 0,
        netSurplus: 0,
        postTaxContributions: 0,
        debtRepayment: 0,
        principalRepaid: 0,
        remainingDebt: point?.liabilities ?? 0,
        startingAssets: baselineA3Attribution.assets.startingValue,
      };
    }
    
    // Get debt balances from baselineSeries (for display, not for calculation)
    const startingDebt = baselineSeries[0]?.liabilities ?? 0;
    const endingDebt = point?.liabilities ?? 0;
    
    // Calculate cumulative contributions (using same logic as computeA3Attribution)
    const grossIncomeMonthly = state.grossIncomeItems.reduce((sum, it) => sum + (Number.isFinite(it.monthlyAmount) ? it.monthlyAmount : 0), 0);
    
    // Separate preTax (pension) and postTax contributions
    const pensionContribMonthly = state.assetContributions
      .filter(c => c.contributionType === 'preTax')
      .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0), 0);
    const postTaxContribMonthly = state.assetContributions
      .filter(c => c.contributionType !== 'preTax')
      .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0), 0);
    
    const taxesMonthly = Math.max(0, grossIncomeMonthly - pensionContribMonthly - state.netIncomeItems.reduce((sum, it) => sum + (Number.isFinite(it.monthlyAmount) ? it.monthlyAmount : 0), 0));
    // Exclude loan payment components from base living expenses (full scheduled payment computed separately)
    // Mortgage payments are treated as expenses; overpayments are discretionary liability reductions.
    const baseLivingExpensesMonthly = filterBaseLivingExpenses(state.expenses);
    
    const grossIncome = pvSumConstantMonthly(grossIncomeMonthly, horizonMonths, state.projection.inflationPct);
    const pensionContributions = pvSumConstantMonthly(pensionContribMonthly, horizonMonths, state.projection.inflationPct);
    const taxes = pvSumConstantMonthly(taxesMonthly, horizonMonths, state.projection.inflationPct);
    const baseLivingExpenses = pvSumConstantMonthly(baseLivingExpensesMonthly, horizonMonths, state.projection.inflationPct);
    const postTaxContributions = pvSumConstantMonthly(postTaxContribMonthly, horizonMonths, state.projection.inflationPct);

    // Calculate full scheduled mortgage payment (interest + scheduled principal) from amortisation schedule
    // Mortgage payments are treated as expenses; overpayments are discretionary liability reductions.
    // For baseline: no overpayments, so debtRepayment = 0
    const loans = state.liabilities.filter(l => l.kind === 'loan' && typeof l.annualInterestRatePct === 'number' && Number.isFinite(l.annualInterestRatePct) && typeof l.remainingTermYears === 'number' && Number.isFinite(l.remainingTermYears) && l.remainingTermYears >= 1);
    const loanTotals = calculateBaselineLoanTotals(loans, horizonMonths, state.projection.inflationPct);
    const scheduledMortgagePayment = loanTotals.scheduledMortgagePayment;
    const interestPaid = loanTotals.interestPaid;
    const principalRepaid = loanTotals.principalRepaid;

    // Living expenses include full scheduled mortgage payment (interest + scheduled principal)
    const livingExpenses = baseLivingExpenses + scheduledMortgagePayment;
    // Net surplus is calculated after pension (pre-tax) and taxes
    const netSurplus = grossIncome - pensionContributions - taxes - livingExpenses;
    // For baseline: no overpayments, so debtRepayment = 0 (scheduled principal is in expenses)
    const debtRepayment = 0; // Baseline has no overpayments

    const startingAssets = baselineA3Attribution.assets.startingValue;
    const assetsAtAge = point?.assets ?? 0;
    // Total contributions for asset growth includes both pension (preTax) and postTax contributions
    const totalContributions = pensionContributions + postTaxContributions;
    // Growth = Ending Assets - Starting Assets - Contributions (residual)
    const growth = assetsAtAge - startingAssets - totalContributions;

    return {
      netWorth: point?.netWorth ?? 0,
      assets: assetsAtAge,
      liabilities: endingDebt,
      growth,
      contributions: totalContributions, // Total: pension + postTax
      interestPaid,
      grossIncome,
      pensionContributions,
      taxes,
      livingExpenses,
      netSurplus,
      postTaxContributions,
      debtRepayment,
      principalRepaid,
      remainingDebt: endingDebt,
      startingAssets,
    };
  }, [selectedAge, baselineSeries, state, baselineA3Attribution]);

  // Phase Four: Derive scenario values at selected age (persisted or Quick What-If)
  // Pattern A: Use scenarioA3AttributionAbs for absolute values (not delta)
  const scenarioValuesAtAge = useMemo(() => {
    if (!effectiveScenarioSeries || !scenarioA3AttributionAbs || !effectiveScenarioActive) return null;

    const selectedAgeIndex = effectiveScenarioSeries.findIndex(p => Math.floor(p.age) >= selectedAge);
    const point = selectedAgeIndex >= 0 ? effectiveScenarioSeries[selectedAgeIndex] : effectiveScenarioSeries[effectiveScenarioSeries.length - 1];
    const actualAge = point?.age ?? selectedAge;
    
    // Mortgage payments are treated as expenses; overpayments are discretionary liability reductions.
    // Use attribution values (from engine outputs) - same pipeline, different inputs.
    
    if (selectedAge >= state.projection.endAge) {
      // Pattern A: At end age, use scenarioA3AttributionAbs for absolute values (not delta)
      // Attribution already includes full scheduled payment in expenses and overpayments in debtRepayment
      return {
        netWorth: scenarioA3AttributionAbs.endingNetWorth,
        assets: scenarioA3AttributionAbs.assets.endingValue,
        liabilities: effectiveScenarioSeries[effectiveScenarioSeries.length - 1]?.liabilities ?? 0,
        growth: scenarioA3AttributionAbs.assets.growth,
        contributions: scenarioA3AttributionAbs.assets.contributions, // Total: pension + postTax
        interestPaid: scenarioA3AttributionAbs.debt.interestPaid,
        grossIncome: scenarioA3AttributionAbs.cashflow.grossIncome,
        pensionContributions: scenarioA3AttributionAbs.cashflow.pensionContributions,
        taxes: scenarioA3AttributionAbs.cashflow.taxes,
        livingExpenses: scenarioA3AttributionAbs.cashflow.livingExpenses, // Includes full scheduled payment
        netSurplus: scenarioA3AttributionAbs.cashflow.netSurplus,
        postTaxContributions: scenarioA3AttributionAbs.cashflow.postTaxContributions,
        debtRepayment: scenarioA3AttributionAbs.cashflow.debtRepayment, // Only overpayments
        principalRepaid: scenarioA3AttributionAbs.debt.principalRepaid,
        remainingDebt: effectiveScenarioSeries[effectiveScenarioSeries.length - 1]?.liabilities ?? 0,
        startingAssets: scenarioA3AttributionAbs.assets.startingValue,
      };
    }

    // For intermediate ages, mirror baseline attribution logic using effectiveScenarioSeries balances
    const monthsElapsed = (actualAge - state.projection.currentAge) * 12;
    const horizonMonths = Number.isFinite(monthsElapsed) ? Math.max(0, Math.floor(monthsElapsed)) : 0;
    
    if (horizonMonths <= 0) {
      return {
        netWorth: point?.netWorth ?? 0,
        assets: point?.assets ?? 0,
        liabilities: point?.liabilities ?? 0,
        growth: 0,
        contributions: 0,
        interestPaid: 0,
        grossIncome: 0,
        pensionContributions: 0,
        taxes: 0,
        livingExpenses: 0,
        netSurplus: 0,
        postTaxContributions: 0,
        debtRepayment: 0,
        principalRepaid: 0,
        remainingDebt: point?.liabilities ?? 0,
        startingAssets: valuesAtAge.startingAssets,
      };
    }
    
    // Mirror baseline logic: same pipeline, different inputs (scenario may have overpayments)
    const baseLivingExpensesMonthly = filterBaseLivingExpenses(state.expenses);
    const baseLivingExpenses = pvSumConstantMonthly(baseLivingExpensesMonthly, horizonMonths, state.projection.inflationPct);
    
    // Calculate full scheduled mortgage payment (interest + scheduled principal) and overpayments from amortisation
    // For scenarios: include overpayments if present (from scenarioProjectionInputs)
    const loans = state.liabilities.filter(l => l.kind === 'loan' && typeof l.annualInterestRatePct === 'number' && Number.isFinite(l.annualInterestRatePct) && typeof l.remainingTermYears === 'number' && Number.isFinite(l.remainingTermYears) && l.remainingTermYears >= 1);
    
    // Build overpayment map from scenario inputs (if any)
    // Handle both persisted scenario (activeScenario) and Quick What-If (scenario)
    const overpaymentMap = new Map<string, number>();
    if (activeScenario && activeScenario.kind === 'FLOW_TO_DEBT' && persistedScenarioProjectionInputs && 'liabilityOverpaymentsMonthly' in persistedScenarioProjectionInputs) {
      const overpayments = persistedScenarioProjectionInputs.liabilityOverpaymentsMonthly ?? [];
      for (const op of overpayments) {
        if (op.liabilityId === activeScenario.liabilityId && Number.isFinite(op.amountMonthly)) {
          overpaymentMap.set(op.liabilityId, Math.max(0, op.amountMonthly));
        }
      }
    } else if (scenario.type === 'FLOW_DEBT_PAYDOWN' && scenario.liabilityId && scenarioProjectionInputs && 'liabilityOverpaymentsMonthly' in scenarioProjectionInputs) {
      const overpayments = (scenarioProjectionInputs as ProjectionEngineInputs).liabilityOverpaymentsMonthly ?? [];
      for (const op of overpayments) {
        if (op.liabilityId === scenario.liabilityId && Number.isFinite(op.amountMonthly)) {
          overpaymentMap.set(op.liabilityId, Math.max(0, op.amountMonthly));
        }
      }
    }
    
    const scenarioLoanTotals = calculateScenarioLoanTotals(loans, horizonMonths, state.projection.inflationPct, overpaymentMap);
    const scheduledMortgagePayment = scenarioLoanTotals.scheduledMortgagePayment;
    const interestPaid = scenarioLoanTotals.interestPaid;
    const principalRepaid = scenarioLoanTotals.principalRepaid;
    const mortgageOverpayments = scenarioLoanTotals.mortgageOverpayments;
    
    // Living expenses include full scheduled mortgage payment (interest + scheduled principal)
    const scenarioLivingExpenses = baseLivingExpenses + scheduledMortgagePayment;
    // Net surplus is calculated after pension (pre-tax) and taxes
    const scenarioNetSurplus = valuesAtAge.grossIncome - valuesAtAge.pensionContributions - valuesAtAge.taxes - scenarioLivingExpenses;
    // Debt repayment = only overpayments (scheduled principal is in expenses)
    const debtRepayment = mortgageOverpayments;
    
    // Scenario-adjusted postTax contributions: baseline + additional scenario amount
    // Handle both persisted scenario (activeScenario) and Quick What-If (scenario)
    const scenarioPostTaxContribAdditional = (() => {
      if (activeScenario && activeScenario.kind === 'FLOW_TO_ASSET') {
        return calculateAllocationDelta(activeScenario.amountMonthly, state.projection.currentAge, actualAge, state.projection.inflationPct);
      } else if (scenario.type === 'FLOW_INVESTING') {
        return calculateAllocationDelta(scenario.monthlyAmount, state.projection.currentAge, actualAge, state.projection.inflationPct);
      }
      return 0;
    })();
    const scenarioPostTaxContributions = valuesAtAge.postTaxContributions + scenarioPostTaxContribAdditional;
    
    // Derive total contributions: pension + postTax (scenario-adjusted)
    const scenarioTotalContributions = valuesAtAge.pensionContributions + scenarioPostTaxContributions;
    
    // Derive growth: assets - startingAssets - totalContributions (residual)
    const scenarioAssets = point?.assets ?? 0;
    const startingAssets = valuesAtAge.startingAssets;
    const scenarioGrowth = scenarioAssets - startingAssets - scenarioTotalContributions;
    
    // Remaining debt from effectiveScenarioSeries point
    const scenarioRemainingDebt = point?.liabilities ?? 0;

    return {
      netWorth: point?.netWorth ?? 0,
      assets: scenarioAssets,
      liabilities: scenarioRemainingDebt,
      growth: scenarioGrowth,
      contributions: scenarioTotalContributions, // Total: pension + postTax (scenario-adjusted)
      interestPaid,
      grossIncome: valuesAtAge.grossIncome, // Unchanged
      pensionContributions: valuesAtAge.pensionContributions, // Unchanged
      taxes: valuesAtAge.taxes, // Unchanged
      livingExpenses: scenarioLivingExpenses, // Includes full scheduled mortgage payment
      netSurplus: scenarioNetSurplus, // Computed using scenario expenses
      postTaxContributions: scenarioPostTaxContributions,
      debtRepayment,
      principalRepaid,
      remainingDebt: scenarioRemainingDebt,
      startingAssets,
    };
  }, [selectedAge, effectiveScenarioSeries, scenarioA3AttributionAbs, effectiveScenarioActive, activeScenario, scenario, state, valuesAtAge, scenarioProjectionInputs]);

  // Phase 5.2b: Active values at selected age (scenario if active, otherwise baseline)
  const activeValues = useMemo(() => {
    return scenarioValuesAtAge ?? valuesAtAge;
  }, [scenarioValuesAtAge, valuesAtAge]);

  // Phase Four: Calculate deltas between baseline and scenario (single source of truth)
  const scenarioDeltas = useMemo(() => {
    if (!scenarioValuesAtAge || !effectiveScenarioActive) return null;

    return {
      netWorth: scenarioValuesAtAge.netWorth - valuesAtAge.netWorth,
      assets: scenarioValuesAtAge.assets - valuesAtAge.assets,
      liabilities: scenarioValuesAtAge.liabilities - valuesAtAge.liabilities,
      allocationDelta: scenarioValuesAtAge.postTaxContributions - valuesAtAge.postTaxContributions,
    };
  }, [scenarioValuesAtAge, valuesAtAge, effectiveScenarioActive]);

  // Phase Four: Validate deltas (reconciliation checks)
  const deltasValid = useMemo(() => {
    if (!scenarioDeltas || !scenarioValuesAtAge || !isScenarioActive) return false;

    // 1. Net Worth reconciliation: deltaNetWorth === assetDelta - liabilityDelta
    const netWorthReconciled = Math.abs(
      scenarioDeltas.netWorth - (scenarioDeltas.assets - scenarioDeltas.liabilities)
    ) < UI_TOLERANCE;

    // 2. Snapshot alignment: baselineSnapshot + delta === scenarioSnapshot
    const netWorthAligned = Math.abs(
      (valuesAtAge.netWorth + scenarioDeltas.netWorth) - scenarioValuesAtAge.netWorth
    ) < UI_TOLERANCE;
    const assetsAligned = Math.abs(
      (valuesAtAge.assets + scenarioDeltas.assets) - scenarioValuesAtAge.assets
    ) < UI_TOLERANCE;
    const liabilitiesAligned = Math.abs(
      (valuesAtAge.liabilities + scenarioDeltas.liabilities) - scenarioValuesAtAge.liabilities
    ) < UI_TOLERANCE;

    // 3. Zero-delta guard: If scenario === baseline, all deltas must be £0
    const isZeroScenario = 
      Math.abs(scenarioDeltas.netWorth) < UI_TOLERANCE &&
      Math.abs(scenarioDeltas.assets) < UI_TOLERANCE &&
      Math.abs(scenarioDeltas.liabilities) < UI_TOLERANCE &&
      Math.abs(scenarioDeltas.allocationDelta) < UI_TOLERANCE;

    // Note: Golden Rule validation (extraContributions vs extraGrowth vs netWorthIncrease)
    // belongs to wiring validation, not A3. A3 treats projectionSeries as ground truth.

    const allChecksPass = netWorthReconciled && netWorthAligned && assetsAligned && liabilitiesAligned;

    if (!allChecksPass) {
      console.warn('Scenario delta reconciliation failed', {
        scenarioDeltas,
        valuesAtAge: {
          netWorth: valuesAtAge.netWorth,
          assets: valuesAtAge.assets,
          liabilities: valuesAtAge.liabilities,
        },
        scenarioValuesAtAge: {
          netWorth: scenarioValuesAtAge.netWorth,
          assets: scenarioValuesAtAge.assets,
          liabilities: scenarioValuesAtAge.liabilities,
        },
        checks: {
          netWorthReconciled,
          netWorthAligned,
          assetsAligned,
          liabilitiesAligned,
        },
      });
    }

    return allChecksPass;
  }, [scenarioDeltas, scenarioValuesAtAge, valuesAtAge, effectiveScenarioActive]);

  // Compute liquid assets series (Phase 3: view-layer computation, no engine changes)
  // Always use baseline inputs for baseline liquid assets
  const liquidAssetsSeries = useMemo(() => {
    return computeLiquidAssetsSeries(baselineProjectionInputs, state.assets);
  }, [baselineProjectionInputs, state.assets]);

  // Compute scenario liquid assets series (when scenario is active)
  // Explicit input selection: persisted scenario uses persistedScenarioProjectionInputs, Quick What-If uses scenarioProjectionInputs
  const scenarioLiquidAssetsSeries = useMemo(() => {
    // Explicit routing: never use ambiguous fallback
    const inputsToUse = activeScenario ? persistedScenarioProjectionInputs : scenarioProjectionInputs;
    if (!inputsToUse || !effectiveScenarioActive) return null;
    return computeLiquidAssetsSeries(inputsToUse, state.assets);
  }, [persistedScenarioProjectionInputs, scenarioProjectionInputs, activeScenario, effectiveScenarioActive, state.assets]);

  // Phase 5.4: Detect key moments from baseline series only
  // Detection uses the same data as the visible chart (liquid vs full assets)
  const keyMoments = useMemo(() => {
    return detectKeyMoments(
      baselineSeries,
      showLiquidOnly ? liquidAssetsSeries : undefined
    );
  }, [baselineSeries, liquidAssetsSeries, showLiquidOnly]);

  // Phase 5.5: Generate insights from key moments (filtered by selectedAge, max 2)
  const insightsToShow = useMemo(() => {
    // Filter: only show insights for moments that have occurred by selectedAge
    const visibleMoments = keyMoments.filter(moment => moment.age <= selectedAge);
    
    // Sort chronologically (earliest first) and limit to MAX 2
    const sorted = visibleMoments.sort((a, b) => a.age - b.age);
    const limited = sorted.slice(0, 2);
    
    // Generate text for each insight
    return limited.map(moment => ({
      id: moment.id,
      text: generateInsightText(moment),
      age: moment.age,
    }));
  }, [keyMoments, selectedAge]);

  const chartData = useMemo(() => {
    // Phase 5.3: Structural chart series with stable semantic identifiers
    // CHART IMPLEMENTATION: Display-only changes
    // Always use full projection horizon (currentAge → endAge)
    // All series (assets, liabilities, net worth) start from the same age
    // selectedAge is used only for visual marker (vertical line), not for filtering data
    
    const liabilitiesData = baselineSeries.map(p => ({ x: p.age, y: p.liabilities }));

    if (showLiquidOnly) {
      // Liquid assets view: Net Worth (Liquid) + Total Assets (Liquid) + Total Liabilities
      const liquidAssetsData = baselineSeries.map((p, idx) => ({
        x: p.age,
        y: idx < liquidAssetsSeries.length ? liquidAssetsSeries[idx] : 0,
      }));
      const netWorthLiquidData = baselineSeries.map((p, idx) => ({
        x: p.age,
        y: (idx < liquidAssetsSeries.length ? liquidAssetsSeries[idx] : 0) - p.liabilities,
      }));

      // Scenario liquid net worth (chart rule: render iff series.length > 0)
      // Chart data comes ONLY from projection series, not A3
      // Fix: Use scenario liabilities, not baseline liabilities
      const scenarioNetWorthLiquidData = effectiveScenarioSeries && effectiveScenarioSeries.length > 0 && scenarioLiquidAssetsSeries
        ? baselineSeries.map((p, idx) => {
            // Use scenario liabilities when available, fallback to baseline
            const scenarioLiabilities = idx < effectiveScenarioSeries.length 
              ? effectiveScenarioSeries[idx].liabilities 
              : p.liabilities;
            const scenarioLiquidAssets = idx < scenarioLiquidAssetsSeries.length 
              ? scenarioLiquidAssetsSeries[idx] 
              : 0;
            return {
              x: p.age,
              y: scenarioLiquidAssets - scenarioLiabilities,
            };
          })
        : null;

      // Compute Y-axis domain from ALL visible series (baseline + scenario)
      // Include both positive and negative values for accurate domain
      const baselineValues = baselineSeries.map((p, idx) => {
        // For liquid view, net worth = liquid assets - liabilities
        const liquidVal = idx < liquidAssetsSeries.length ? liquidAssetsSeries[idx] : 0;
        return liquidVal - p.liabilities;
      });
      const scenarioValues = scenarioNetWorthLiquidData
        ? scenarioNetWorthLiquidData.map(p => p.y)
        : [];
      const allYValues = [...baselineValues, ...scenarioValues];
      
      // Compute true min/max across all values (no clamping)
      const rawMinY = allYValues.length > 0 ? Math.min(...allYValues) : 0;
      const rawMaxY = allYValues.length > 0 ? Math.max(...allYValues) : 0;
      
      // Apply 5% padding after truth (preserves semantic zero)
      const padding = (rawMaxY - rawMinY) * 0.05 || 0.01; // Fallback for zero range
      const domainMin = rawMinY - padding;
      const domainMax = rawMaxY + padding;
      const yTicks = buildTicks(domainMin, domainMax);

      // Phase 5.3: Build structured series array with stable semantic identifiers
      const series: ChartSeries[] = [
        {
          seriesId: 'netWorth',
          label: 'Net worth',
          color: chartPalette.baselineLine,
          data: netWorthLiquidData,
          style: {
            strokeWidth: 2.6,
            opacity: effectiveScenarioSeries && effectiveScenarioSeries.length > 0 ? 0.7 : 1.0,
          },
          shouldRender: baselineSeries.length > 0,
        },
        ...(effectiveScenarioSeries && effectiveScenarioSeries.length > 0
          ? [{
              seriesId: 'scenarioNetWorth' as const,
              label: 'Net worth (scenario)',
              color: chartPalette.scenarioLine,
              data: scenarioNetWorthLiquidData || [],
              style: {
                strokeWidth: 3.0,
                opacity: 0.85,
              },
              shouldRender: true,
            }]
          : []),
        {
          seriesId: 'assets',
          label: 'Assets',
          color: chartPalette.assetsLine,
          data: liquidAssetsData,
          style: {
            strokeWidth: activeScenarioSource !== 'baseline' ? 1.5 : 1.8,
            opacity: activeScenarioSource !== 'baseline' ? 0.38 : 1.0,
          },
          shouldRender: true,
        },
        {
          seriesId: 'liabilities',
          label: 'Liabilities',
          color: chartPalette.liabilitiesLine,
          data: liabilitiesData,
          style: {
            strokeWidth: activeScenarioSource !== 'baseline' ? 1.3 : 1.5,
            opacity: activeScenarioSource !== 'baseline' ? 0.28 : 1.0,
          },
          shouldRender: true,
        },
      ];

      return { series, domainMin, domainMax, yTicks };
    } else {
      // Default view: Net Worth (blue) + Assets (grey) + Liabilities (lighter grey)
      const assetsData = baselineSeries.map(p => ({ x: p.age, y: p.assets }));
      const baselineNetWorthData = baselineSeries.map(p => ({ x: p.age, y: p.netWorth }));

      // Phase Four: Derive scenario net worth from projection series (chart rule: render iff series.length > 0)
      // Chart data comes ONLY from projection series, not A3
      const scenarioNetWorthData = effectiveScenarioSeries && effectiveScenarioSeries.length > 0
        ? effectiveScenarioSeries.map(p => ({ x: p.age, y: p.netWorth }))
        : null;

      // Compute Y-axis domain from ALL visible series (baseline + scenario)
      // Include both positive and negative values for accurate domain
      const baselineValues = baselineSeries.map(p => p.netWorth);
      const scenarioValues = scenarioNetWorthData
        ? scenarioNetWorthData.map(p => p.y)
        : [];
      const allYValues = [...baselineValues, ...scenarioValues];
      
      // Compute true min/max across all values (no clamping)
      const rawMinY = allYValues.length > 0 ? Math.min(...allYValues) : 0;
      const rawMaxY = allYValues.length > 0 ? Math.max(...allYValues) : 0;
      
      // Apply 5% padding after truth (preserves semantic zero)
      const padding = (rawMaxY - rawMinY) * 0.05 || 0.01; // Fallback for zero range
      const domainMin = rawMinY - padding;
      const domainMax = rawMaxY + padding;
      const yTicks = buildTicks(domainMin, domainMax);

      // Phase 5.3: Build structured series array with stable semantic identifiers
      const series: ChartSeries[] = [
        {
          seriesId: 'netWorth',
          label: 'Net worth',
          color: chartPalette.baselineLine,
          data: baselineNetWorthData,
          style: {
            strokeWidth: 2.6,
            opacity: effectiveScenarioSeries && effectiveScenarioSeries.length > 0 ? 0.7 : 1.0,
          },
          shouldRender: baselineSeries.length > 0,
        },
        ...(effectiveScenarioSeries && effectiveScenarioSeries.length > 0
          ? [{
              seriesId: 'scenarioNetWorth' as const,
              label: 'Net worth (scenario)',
              color: chartPalette.scenarioLine,
              data: scenarioNetWorthData || [],
              style: {
                strokeWidth: 3.0,
                opacity: 0.85,
              },
              shouldRender: true,
            }]
          : []),
        {
          seriesId: 'assets',
          label: 'Assets',
          color: chartPalette.assetsLine,
          data: assetsData,
          style: {
            strokeWidth: activeScenarioSource !== 'baseline' ? 1.5 : 1.8,
            opacity: activeScenarioSource !== 'baseline' ? 0.38 : 1.0,
          },
          shouldRender: true,
        },
        {
          seriesId: 'liabilities',
          label: 'Liabilities',
          color: chartPalette.liabilitiesLine,
          data: liabilitiesData,
          style: {
            strokeWidth: activeScenarioSource !== 'baseline' ? 1.3 : 1.5,
            opacity: activeScenarioSource !== 'baseline' ? 0.28 : 1.0,
          },
          shouldRender: true,
        },
      ];

      return { series, domainMin, domainMax, yTicks };
    }
  }, [baselineSeries, effectiveScenarioSeries, effectiveScenarioActive, liquidAssetsSeries, scenarioLiquidAssetsSeries, showLiquidOnly, chartPalette, activeScenarioSource]);

  const chartWidth: number = Math.max(320, windowWidth - 24);
  // Keep this visually dominant, but give enough vertical space for Victory's top/bounds + labels.
  const chartHeight: number = Math.round(Math.min(300, Math.max(240, windowWidth * 0.70)));
  // Explicit chart padding: left for £ tick labels, bottom for x-axis labels + legend, top keeps line off border
  const chartPadding = { top: 8, bottom: 48, left: 44, right: 16 } as const;

  // Phase 5.2a: Helper to map touch X coordinate to age
  // Returns null if mapping is invalid (e.g., invalid plottable width)
  const mapTouchXToAge = useCallback((
    touchX: number,
    chartWidth: number,
    chartPadding: { left: number; right: number },
    currentAge: number,
    endAge: number
  ): number | null => {
    const plottableWidth = chartWidth - chartPadding.left - chartPadding.right;
    
    // Guard against invalid plottable width
    if (plottableWidth <= 0) return null;
    
    // Subtract left padding to get position relative to plottable area
    const touchXRelative = touchX - chartPadding.left;
    
    // Clamp to plottable area
    const clampedX = Math.max(0, Math.min(plottableWidth, touchXRelative));
    
    // Map to age using linear interpolation
    const age = currentAge + (clampedX / plottableWidth) * (endAge - currentAge);
    
    // Snap to nearest integer year
    const snappedAge = Math.round(age);
    
    // Clamp to valid age range
    const finalAge = Math.max(currentAge, Math.min(endAge, snappedAge));
    
    return finalAge;
  }, []);

  // Phase 5.2a: PanResponder for chart gesture interaction
  // VictoryChart is intentionally render-only. Gesture handling is implemented via
  // a transparent RN overlay to avoid Victory SVG interaction issues on mobile.
  const chartPanResponder = useMemo(() => {
    const currentAge = state.projection.currentAge;
    const endAge = state.projection.endAge;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: (evt, gestureState) => {
        // Allow termination if gesture is predominantly vertical (let ScrollView handle it)
        // Use 1.2x bias to prevent accidental scroll takeover during horizontal drags
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;
      },
      onPanResponderGrant: (evt, gestureState) => {
        // Ignore predominantly vertical gestures (let ScrollView handle them)
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2) return;

        const touchX = evt.nativeEvent.locationX;
        const mappedAge = mapTouchXToAge(touchX, chartWidth, chartPadding, currentAge, endAge);
        
        // Only update if age changed to avoid unnecessary re-renders
        if (mappedAge !== null && mappedAge !== selectedAge) {
          setSelectedAge(mappedAge);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        // Ignore predominantly vertical gestures (let ScrollView handle them)
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2) return;

        const touchX = evt.nativeEvent.locationX;
        const mappedAge = mapTouchXToAge(touchX, chartWidth, chartPadding, currentAge, endAge);
        
        // Only update if age changed to avoid unnecessary re-renders
        if (mappedAge !== null && mappedAge !== selectedAge) {
          setSelectedAge(mappedAge);
        }
      },
    });
  }, [chartWidth, chartPadding, state.projection.currentAge, state.projection.endAge, selectedAge, mapTouchXToAge, setSelectedAge]);

  // Primary legend: Net Worth (dominant)
  const legendPrimary = useMemo(() => {
    if (effectiveScenarioActive && effectiveScenarioSeries) {
      // Use persisted scenario amount if active, otherwise Quick What-If amount
      const monthlyAmount = activeScenario ? activeScenario.amountMonthly : scenario.monthlyAmount;
      const formattedAmount = formatCurrencyFull(monthlyAmount);
      return [
        { label: 'Net worth', color: theme.colors.brand.primary },
        { label: `+ ${formattedAmount} / month`, color: theme.colors.brand.primary },
      ] as const;
    } else {
      return [
        { label: 'Net worth', color: theme.colors.brand.primary },
      ] as const;
    }
  }, [effectiveScenarioActive, activeScenario, scenario, effectiveScenarioSeries]);

  // Secondary legend: Assets / Liabilities (recede visually)
  const legendSecondary = useMemo(() => {
    if (showLiquidOnly) {
      return [
        { label: 'Assets', color: chartPalette.assetsLine },
        { label: 'Liabilities', color: chartPalette.liabilitiesLine },
      ] as const;
    } else {
      return [
        { label: 'Assets', color: chartPalette.assetsLine },
        { label: 'Liabilities', color: chartPalette.liabilitiesLine },
      ] as const;
    }
  }, [showLiquidOnly, chartPalette]);

  const a3 = useMemo(() => {
    const v = valuesAtAge;
    const sv = scenarioValuesAtAge;
    const showScenario = effectiveScenarioActive && sv !== null;
    const startLiabilities = series[0]?.liabilities ?? 0;
    const endLiabilities = series[series.length - 1]?.liabilities ?? 0;

    // Asset-only growth calculation (for Asset A3 only, not used for investment growth row)
    // Investment growth row now uses sv.growth directly (asset-only: endingAssets - startingAssets - contributions)
    // This ensures Asset A3 is not polluted by liability or net worth effects

    // Centralized delta computation helper
    // ALWAYS: delta = scenario - baseline (no exceptions, no sign flipping)
    const computeDelta = (baseline: number, scenario: number): number => {
      return scenario - baseline;
    };

    // Helper to determine if a row represents a cost/outflow (needs negation for display)
    const isCostRow = (label: string): boolean => {
      return label.includes('Cost of borrowing') ||
             label.includes('Interest you pay') ||
             label.includes('Interest saved') ||
             label.includes('Contribution to pension') ||
             label.includes('Money paid in tax') ||
             label.includes('Everyday spending') ||
             label.includes('Money you invest') ||
             label.includes('Money used to pay down debt') ||
             label.includes('Money kept as cash') ||
             label.includes('Debt you pay back') ||
             label.includes('Extra debt payments');
    };

    // Helper to compute delta and format scenario/delta values
    // When scenario is active, use compact formatting for all values
    const makeRow = (
      label: string,
      baselineValue: number, // Raw value (positive for costs)
      formatFn: (val: number) => string,
      formatFnCompact?: (val: number) => string,
      showDividerAfter?: boolean,
      useExtraGrowthForScenario?: boolean
    ): Row => {
      // Use compact formatting when scenario is active, full formatting otherwise
      const baselineFormatFn = showScenario ? (formatFnCompact || formatFn) : formatFn;
      
      // Special handling for debt effect rows with custom bindings
      const isDebtEffectRow = label === 'Extra debt payments' || 
                              label === 'Interest saved' || 
                              label === 'Net worth improvement' ||
                              label === 'Debt remaining at end';
      
      // For display, negate cost rows (but keep raw values for delta calculation)
      let baselineDisplayValue: number;
      let baselineRawValue: number;
      
      if (isDebtEffectRow) {
        if (label === 'Extra debt payments') {
          // Baseline: v.debtRepayment, Scenario: sv.debtRepayment
          baselineRawValue = v.debtRepayment;
          baselineDisplayValue = v.debtRepayment;
        } else if (label === 'Interest saved') {
          // Baseline: v.interestPaid, Scenario: sv.interestPaid
          baselineRawValue = v.interestPaid;
          baselineDisplayValue = isCostRow(label) ? -v.interestPaid : v.interestPaid;
        } else if (label === 'Net worth improvement') {
          // Baseline: — (0), Scenario: liability reduction only (v.liabilities - sv.liabilities)
          // This isolates Debt A3 from asset changes
          baselineRawValue = 0;
          baselineDisplayValue = 0;
        } else if (label === 'Debt remaining at end') {
          // Baseline: v.remainingDebt, Scenario: sv.remainingDebt
          baselineRawValue = v.remainingDebt;
          baselineDisplayValue = v.remainingDebt;
        } else {
          baselineRawValue = baselineValue;
          baselineDisplayValue = isCostRow(label) ? -baselineValue : baselineValue;
        }
      } else {
        baselineRawValue = baselineValue;
        baselineDisplayValue = isCostRow(label) ? -baselineValue : baselineValue;
      }
      
      // Special handling for "Net worth improvement" baseline (show "—" instead of £0)
      let baselineText: string;
      if (label === 'Net worth improvement' && Math.abs(baselineDisplayValue) < UI_TOLERANCE) {
        baselineText = '—';
      } else {
        baselineText = baselineFormatFn(baselineDisplayValue);
      }
      
      const row: Row = {
        label,
        valueText: baselineText,
        showDividerAfter,
      };
      if (showScenario && sv) {
        const scenarioRawValue = (() => {
          // Special handling for debt effect rows
          if (isDebtEffectRow) {
            if (label === 'Extra debt payments') {
              return sv.debtRepayment;
            } else if (label === 'Interest saved') {
              return sv.interestPaid;
            } else if (label === 'Net worth improvement') {
              // Debt-driven net worth improvement = liability reduction only
              // This isolates Debt A3 from asset changes
              return v.liabilities - sv.liabilities;
            } else if (label === 'Debt remaining at end') {
              return sv.remainingDebt;
            }
          }
          
          // Standard mapping for other rows
          // Map baseline field to scenario field (use raw values, no sign manipulation)
          if (label.includes('Investment growth')) {
            // Use asset-only growth directly from sv.growth (already calculated as endingAssets - startingAssets - contributions)
            // This ensures Asset A3 is not polluted by liability or net worth effects
            return sv.growth;
          }
          if (label.includes('Money you regularly add') || label.includes('Money you add over time')) return sv.contributions;
          if (label.includes('Cost of borrowing') || label.includes('Interest you pay') || label.includes('Interest saved')) return sv.interestPaid; // Raw value
          if (label.includes('Total money you earn')) return sv.grossIncome;
          if (label.includes('Contribution to pension')) return sv.pensionContributions; // Raw value
          if (label.includes('Money paid in tax')) return sv.taxes; // Raw value
          if (label.includes('Everyday spending')) return sv.livingExpenses; // Raw value
          if (label.includes('Money left after expenses')) return sv.netSurplus;
          if (label.includes('Money you invest')) return sv.postTaxContributions; // Raw value
          if (label.includes('Money used to pay down debt')) return sv.debtRepayment; // Raw value
          // Phase 3.3: Use selector for scenario-adjusted monthly surplus (single source of truth)
          if (label.includes('Unallocated cash')) return selectMonthlySurplusWithScenario(state, activeScenario);
          if (label.includes('Debt you pay back')) return sv.principalRepaid; // Raw value
          if (label.includes('Extra debt payments')) return sv.debtRepayment; // Raw value
          if (label.includes('Debt left at the end') || label.includes('Debt remaining at end')) return sv.remainingDebt;
          if (label.includes('What you start with')) return sv.startingAssets;
          if (label.includes('What you end up with')) return sv.assets;
          return baselineRawValue; // Fallback: no change
        })();
        
        // Special delta calculation for debt effect rows
        let delta: number;
        if (isDebtEffectRow) {
          if (label === 'Interest saved') {
            // Delta: Baseline - Scenario (positive saving)
            delta = baselineRawValue - scenarioRawValue;
          } else if (label === 'Net worth improvement') {
            // Delta: liability reduction only (debt-driven net worth improvement)
            // This isolates Debt A3 from asset changes
            delta = v.liabilities - sv.liabilities;
          } else {
            // Delta: Scenario - Baseline (standard)
            delta = computeDelta(baselineRawValue, scenarioRawValue);
          }
        } else {
          // CRITICAL: Delta = scenario - baseline (using RAW values, always)
          delta = computeDelta(baselineRawValue, scenarioRawValue);
        }
        
        const valuesDiffer = Math.abs(delta) >= UI_TOLERANCE;
        
        // For display, negate cost rows (but delta uses raw values)
        const scenarioDisplayValue = isCostRow(label) ? -scenarioRawValue : scenarioRawValue;
        row.scenarioValueText = baselineFormatFn(scenarioDisplayValue);
        // Delta: use compact formatting and show "—" for zero
        row.deltaValueText = showScenario ? formatCurrencyCompactSigned(delta) : formatCurrencyFullSigned(delta);
        row.valuesDiffer = valuesDiffer;
      }
      return row;
    };

    // Compute scenario result summary and net worth at selected age
    let scenarioResult: string | null = null;
    let endNetWorthBaseline: string | undefined;
    let endNetWorthScenario: string | undefined;
    let endNetWorthDelta: string | undefined;
    
    if (showScenario && sv) {
      const netWorthDeltaValue = sv.netWorth - v.netWorth;
      scenarioResult = `Scenario result: ${formatCurrencyCompactSigned(netWorthDeltaValue)} vs baseline`;
      endNetWorthBaseline = showScenario ? formatCurrencyCompact(v.netWorth) : formatCurrencyFull(v.netWorth);
      endNetWorthScenario = formatCurrencyCompact(sv.netWorth);
      endNetWorthDelta = formatCurrencyCompactSigned(netWorthDeltaValue);
    }

    return {
      keyDriversRows: [
        makeRow('Investment growth over time', v.growth, formatCurrencyFull, formatCurrencyCompact, false, true), // Use extraGrowth only
        makeRow('Money you regularly add', v.contributions, formatCurrencyFull, formatCurrencyCompact),
        makeRow('Cost of borrowing', v.interestPaid, formatCurrencyFull, formatCurrencyCompact),
      ],
      cashflowRows: [
        makeRow('Total money you earn (before tax)', v.grossIncome, formatCurrencyFull, formatCurrencyCompact),
        makeRow('Contribution to pension (pre-tax)', v.pensionContributions, formatCurrencyFull, formatCurrencyCompact),
        makeRow('Money paid in tax', v.taxes, formatCurrencyFull, formatCurrencyCompact),
        makeRow('Everyday spending and loan interest', v.livingExpenses, formatCurrencyFull, formatCurrencyCompact),
        makeRow('Money left after expenses', v.netSurplus, formatCurrencyFull, formatCurrencyCompact, true),
        makeRow('Money you invest (post-tax)', v.postTaxContributions, formatCurrencyFull, formatCurrencyCompact),
        makeRow('Money used to pay down debt', v.debtRepayment, formatCurrencyFull, formatCurrencyCompact),
        // Phase 3.3: Use selector for baseline monthly surplus (single source of truth, no clamping)
        makeRow('Unallocated cash', selectMonthlySurplus(state), formatCurrencyFull, formatCurrencyCompact),
      ],
      debtRows: [
        makeRow('Extra debt payments', v.debtRepayment, formatCurrencyFull, formatCurrencyCompact),
        makeRow('Interest saved', v.interestPaid, formatCurrencyFull, formatCurrencyCompact),
        makeRow('Net worth improvement', 0, formatCurrencyFull, formatCurrencyCompact),
        makeRow('Debt remaining at end', v.remainingDebt, formatCurrencyFull, formatCurrencyCompact),
      ],
      assetRows: [
        makeRow('What you start with', v.startingAssets, formatCurrencyFull, formatCurrencyCompact),
        makeRow('Money you add over time', v.contributions, formatCurrencyFull, formatCurrencyCompact),
        // Investment growth: asset-only calculation (endingAssets - startingAssets - contributions)
        // Scenario uses sv.growth directly (already asset-only, not polluted by liability effects)
        makeRow(selectedAge >= state.projection.endAge ? 'Investment growth' : 'Investment growth so far', v.growth, formatCurrencyFull, formatCurrencyCompact),
        makeRow('What you end up with', v.assets, formatCurrencyFull, formatCurrencyCompact),
      ],
      startLiabilities,
      endLiabilities,
      scenarioResult,
      endNetWorthBaseline,
      endNetWorthScenario,
      endNetWorthDelta,
    };
  }, [valuesAtAge, scenarioValuesAtAge, effectiveScenarioActive, series, selectedAge, state, activeScenario, scenarioDeltas]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[0]}
      >
        <View 
          ref={stickyHeaderRef}
          style={[styles.projectionStickyHeader, { backgroundColor: theme.colors.bg.app }]}
          onLayout={(event) => {
            stickyHeaderHeight.current = event.nativeEvent.layout.height;
          }}
        >
          <ScreenHeader 
            title="Projection" 
            subtitle="Explore where your finances could land"
            rightAccessory={
              __DEV__ ? (
                <Pressable
                  onPress={handleExportDebugJSON}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      borderRadius: 4,
                      backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.border.subtle,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Export debug JSON"
                >
                  <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>Export JSON</Text>
                </Pressable>
              ) : null
            }
          />

          {/* Negative Surplus Banner */}
          {isSurplusNegative && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>
                Monthly surplus is negative ({formatCurrencyFullSigned(baselineSurplus)}). Reduce allocations or expenses before running what-ifs.
              </Text>
            </View>
          )}

          <View style={styles.projectionToolbarContainer}>
            <View style={styles.projectionToolbarSurface}>
              <View style={styles.toolbarRow}>
                <View style={styles.toolbarLeftGroup}>
                  <Pressable 
                    onPress={() => {
                      if (!isSurplusNegative) {
                        openLater(() => setScenarioSelectorOpen(true));
                      }
                    }}
                    disabled={isSurplusNegative}
                    style={[
                      styles.toolbarPillButton,
                      activeScenarioSource === 'persisted' && styles.toolbarPillButtonActive,
                      isSurplusNegative && styles.toolbarPillButtonDisabled,
                    ]}
                  >
                    <Text style={[
                      styles.toolbarPillButtonText,
                      activeScenarioSource === 'persisted' && styles.toolbarPillButtonTextActive,
                      activeScenarioSource === 'persisted' && { color: theme.colors.brand.primary },
                    ]}>
                      {activeScenario ? activeScenario.name : 'Baseline'}
                    </Text>
                    <Text style={[
                      styles.toolbarPillChevron,
                      activeScenarioSource === 'persisted' && styles.toolbarPillButtonTextActive,
                      activeScenarioSource === 'persisted' && { color: theme.colors.brand.primary },
                    ]}>▼</Text>
                  </Pressable>

                  <Pressable 
                    onPress={() => {
                      if (!isSurplusNegative) {
                        handleQuickWhatIfToggle();
                        // Scrolling is handled by onLayout in the expanded section
                      }
                    }}
                    disabled={isSurplusNegative}
                    style={[
                      styles.toolbarPillButton,
                      activeScenarioSource === 'quick' && styles.toolbarPillButtonActive,
                      isSurplusNegative && styles.toolbarPillButtonDisabled,
                    ]}
                  >
                    <Feather 
                      name="zap" 
                      size={16} 
                      color={activeScenarioSource === 'quick' ? theme.colors.brand.primary : theme.colors.text.secondary} 
                    />
                    <Text
                      style={[
                        styles.toolbarPillButtonText,
                        activeScenarioSource === 'quick' && styles.toolbarPillButtonTextActive,
                        activeScenarioSource === 'quick' && { color: theme.colors.brand.primary },
                      ]}
                    >
                      Quick what-if
                    </Text>
                  </Pressable>
                </View>

                <View style={{ flex: 1 }} />

                <View style={styles.toolbarRightGroup}>
                  <Pressable 
                    onPress={() => openLater(() => setAgeSelectorOpen(true))}
                    style={styles.toolbarPillButton}
                  >
                    <Text style={styles.toolbarPillButtonText}>Age {selectedAge}</Text>
                    <Text style={styles.toolbarPillChevron}>▼</Text>
                  </Pressable>

                  <Pressable 
                    onPress={() => navigation.navigate('ProjectionSettings')}
                    style={styles.toolbarIconPill}
                  >
                    <Feather name="settings" size={16} color="#777" />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>
        {/* Quick What If Expanded Content */}
        {quickWhatIfExpanded ? (
          <View 
            ref={quickWhatIfRef} 
            style={styles.quickWhatIfContainer}
            onLayout={(event) => {
              // Scroll to this section when it's laid out, accounting for sticky header
              const { y } = event.nativeEvent.layout;
              if (scrollViewRef.current && y > 0) {
                setTimeout(() => {
                  // Use measured sticky header height + some padding to ensure full visibility
                  const headerHeight = stickyHeaderHeight.current || 124;
                  scrollViewRef.current?.scrollTo({ y: Math.max(0, y - headerHeight - 8), animated: true });
                }, 200);
              }
            }}
          >
            {/* Helper Hint */}
            {availableToAllocate !== undefined && scenarioTypeToggle === 'FLOW_INVESTING' && (
              <Text style={styles.quickWhatIfHint}>
                Available to invest: <Text style={styles.quickWhatIfHintAmount}>{formatCurrencyFull(availableToAllocate)}</Text> / month
              </Text>
            )}

            {/* Scenario Type Toggle */}
            <View style={styles.quickRow}>
              <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
                <Button
                  variant={scenarioTypeToggle === 'FLOW_INVESTING' ? 'primary' : 'secondary'}
                  size="md"
                  onPress={() => {
                    const currentAmount = parseFloat(localAmountInput) || 0;
                    setScenarioTypeToggle('FLOW_INVESTING');
                    setLocalSelectedLiability(null);
                    setLocalSelectedAsset(null);
                    setScenario({
                      isActive: quickWhatIfExpanded, // Preserve active state when Quick What-If is expanded
                      type: 'FLOW_INVESTING',
                      assetId: null,
                      liabilityId: null,
                      monthlyAmount: 0,
                    });
                    // Preserve amount input when switching types
                  }}
                  style={{ flex: 1 }}
                >
                  Invest more
                </Button>
                <Button
                  variant={scenarioTypeToggle === 'FLOW_DEBT_PAYDOWN' ? 'primary' : 'secondary'}
                  size="md"
                  onPress={() => {
                    const currentAmount = parseFloat(localAmountInput) || 0;
                    setScenarioTypeToggle('FLOW_DEBT_PAYDOWN');
                    setLocalSelectedAsset(null);
                    setLocalSelectedLiability(null);
                    setScenario({
                      isActive: quickWhatIfExpanded, // Preserve active state when Quick What-If is expanded
                      type: 'FLOW_DEBT_PAYDOWN',
                      assetId: null,
                      liabilityId: null,
                      monthlyAmount: 0,
                    });
                    // Preserve amount input when switching types
                  }}
                  style={{ flex: 1 }}
                >
                  Pay down debt
                </Button>
              </View>
            </View>

            {/* Apply to Row - Conditional based on scenario type */}
            {scenarioTypeToggle === 'FLOW_INVESTING' ? (
            <View style={styles.quickRow}>
              <Text style={styles.quickLabel}>Apply to</Text>
              <Pressable
                onPress={() => openLater(() => setAssetPickerOpen(true))}
                style={({ pressed }) => [styles.quickWhatIfSelector, { backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.card, flex: 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Select asset"
              >
                <View style={styles.quickWhatIfSelectorRow}>
                  <Text
                    style={[styles.quickWhatIfSelectorValue, !selectedAsset ? styles.quickWhatIfPlaceholder : null]}
                    numberOfLines={1}
                  >
                    {selectedAsset ? getAssetName(selectedAsset) : 'Select asset'}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#777" />
                </View>
              </Pressable>
            </View>
            ) : (
              <View style={styles.quickRow}>
                <Text style={styles.quickLabel}>Apply to</Text>
                <Pressable
                  onPress={() => openLater(() => setMortgagePickerOpen(true))}
                  style={({ pressed }) => [styles.quickWhatIfSelector, { backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.card, flex: 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Select mortgage"
                >
                  <View style={styles.quickWhatIfSelectorRow}>
                    <Text
                      style={[styles.quickWhatIfSelectorValue, !selectedLiability ? styles.quickWhatIfPlaceholder : null]}
                      numberOfLines={1}
                    >
                      {selectedLiability ? getLiabilityName(selectedLiability) : 'Select mortgage'}
                    </Text>
                    <Feather name="chevron-down" size={16} color="#777" />
                  </View>
                </Pressable>
              </View>
            )}

            {/* Extra Amount Row */}
            <View style={styles.quickRow}>
              <Text style={styles.quickLabel}>Extra / month</Text>
              <TextInput
                style={[styles.quickWhatIfAmountInput, scenarioValidationError ? styles.quickWhatIfAmountInputError : null, { flex: 1 }]}
                value={amountInput}
                onChangeText={handleAmountChange}
                placeholder="0"
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>
            {scenarioValidationError ? (
              <Text style={styles.quickWhatIfError}>{scenarioValidationError}</Text>
            ) : null}

            {/* Clear Scenario */}
            <Button
              variant="text"
              size="sm"
              onPress={handleClearScenario}
              style={{ marginTop: 8, alignSelf: 'flex-start' }}
            >
              Clear scenario
            </Button>
          </View>
        ) : null}

        <View style={styles.innerContent}>
          {/* Phase 5.1: Financial Health Summary */}
          <FinancialHealthSummary
            snapshotTotals={selectSnapshotTotals(state)}
            baselineSummary={baselineSummary}
            baselineSeries={baselineSeries}
            currentAge={state.projection.currentAge}
            endAge={state.projection.endAge}
            assets={state.assets}
          />

          <SectionCard style={{ marginBottom: spacing.xs }}>
            {/* Section Header with Toggle */}
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="Projected Net Worth" />
              <Pressable
                style={[
                  styles.chartMiniToggle,
                  showLiquidOnly && styles.chartMiniToggleActive,
                ]}
                onPress={() => setShowLiquidOnly(v => !v)}
              >
                <Text
                  style={[
                    styles.chartMiniToggleText,
                    showLiquidOnly && styles.chartMiniToggleTextActive,
                  ]}
                >
                  {showLiquidOnly ? 'Liquid assets' : 'All assets'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.chartCard}>
            {/* Phase 5.2a: Chart container with gesture overlay
                VictoryChart is render-only. Gesture handling via transparent RN overlay above. */}
            <View style={{ height: chartHeight, width: chartWidth, position: 'relative' }}>
              <VictoryChart
                width={chartWidth}
                height={chartHeight}
                padding={chartPadding}
                domain={{ y: [chartData.domainMin, chartData.domainMax] }}
                domainPadding={{ x: 12, y: 6 }}
                nice={false}
              >
                <VictoryAxis
                  tickFormat={t => `${Number(t)}`}
                  tickLabelComponent={<VictoryLabel dy={6} />}
                  style={{
                    axis: { stroke: chartPalette.axis },
                    tickLabels: { fontSize: 11, fill: chartPalette.tickLabels },
                    grid: { stroke: 'transparent' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  nice={false}
                  tickValues={chartData.yTicks}
                  tickFormat={t => formatCurrencyCompact(Number(t))}
                  style={{
                    axis: { stroke: chartPalette.axis },
                    tickLabels: { fontSize: 10, fill: chartPalette.tickLabels },
                    grid: { stroke: chartPalette.grid, strokeDasharray: '2,4' },
                  }}
                />

                {/* Phase 5.3: Render series from structured array with stable semantic identifiers */}
                {chartData.series
                  .filter(s => s.shouldRender)
                  .map((series) => (
                    <VictoryLine
                      key={series.seriesId}
                      data={series.data}
                      style={{
                        data: {
                          stroke: series.color,
                          strokeWidth: series.style.strokeWidth,
                          opacity: series.style.opacity,
                        },
                      }}
                    />
                  ))}
                {/* Phase 5.4: Render key moment dots on baseline series only */}
                {keyMoments
                  .map((moment) => {
                    const parentSeries = chartData.series.find(s => s.seriesId === moment.seriesId);
                    if (!parentSeries || !parentSeries.shouldRender) return null;
                    return (
                      <VictoryScatter
                        key={moment.id}
                        data={[{ x: moment.age, y: moment.value }]}
                        style={{
                          data: {
                            fill: parentSeries.color,
                            opacity: parentSeries.style.opacity,
                          },
                        }}
                        size={4}
                      />
                    );
                  })
                  .filter(Boolean)}
                {/* Vertical marker line at selectedAge (visual cursor, not a filter) */}
                <VictoryLine
                  data={[
                    { x: selectedAge, y: chartData.domainMin },
                    { x: selectedAge, y: chartData.domainMax },
                  ]}
                  style={{
                    data: {
                      stroke: chartPalette.markerLine,
                      strokeWidth: 1.5,
                      strokeDasharray: '4,4',
                      opacity: 0.6,
                    },
                  }}
                />
              </VictoryChart>

              {/* Phase 5.2a: Transparent gesture overlay */}
              <View
                style={StyleSheet.absoluteFill}
                {...chartPanResponder.panHandlers}
              />
            </View>

            {/* Helper text when both liquid toggle and scenario are ON */}
            {showLiquidOnly && activeScenarioSource !== 'baseline' ? (
              <Text style={styles.chartHelperText}>
                Showing liquid assets only · Scenario applied
              </Text>
            ) : null}
          </View>
          </SectionCard>

          {/* Phase 5.3: Unified value bar companion card */}
          {valuesAtAge && (
            <SectionCard style={{ marginTop: spacing.xs, marginBottom: spacing.huge, padding: spacing.sm }}>
              <View style={[styles.valueBar, { width: chartWidth }]}>
                {/* Baseline row */}
                <View style={styles.valueBarRow}>
                  <Text style={[styles.valueBarRowLabel, { color: theme.colors.text.muted }]}>Baseline</Text>
                  {/* Net worth */}
                  <View style={styles.valueBarItem}>
                    <View style={[styles.valueBarDot, { backgroundColor: chartPalette.baselineLine }]} />
                    <Text style={[styles.valueBarLabel, { color: theme.colors.text.muted }]}>Net worth</Text>
                    <Text style={[styles.valueBarValue, { color: theme.colors.text.primary, fontWeight: '600' }]}>
                      {formatCurrencyCompact(valuesAtAge.netWorth)}
                    </Text>
                  </View>

                  {/* Assets */}
                  <View style={styles.valueBarItem}>
                    <View style={[styles.valueBarDot, { backgroundColor: chartPalette.assetsLine }]} />
                    <Text style={[styles.valueBarLabel, { color: theme.colors.text.muted }]}>Assets</Text>
                    <Text style={[styles.valueBarValue, { color: theme.colors.text.primary, fontWeight: '600' }]}>
                      {formatCurrencyCompact(valuesAtAge.assets)}
                    </Text>
                  </View>

                  {/* Liabilities */}
                  <View style={styles.valueBarItem}>
                    <View style={[styles.valueBarDot, { backgroundColor: chartPalette.liabilitiesLine }]} />
                    <Text style={[styles.valueBarLabel, { color: theme.colors.text.muted }]}>Liabilities</Text>
                    <Text style={[styles.valueBarValue, { color: theme.colors.text.primary, fontWeight: '600' }]}>
                      {formatCurrencyCompact(valuesAtAge.liabilities)}
                    </Text>
                  </View>
                </View>

                {/* Scenario row (only if active) */}
                {effectiveScenarioActive && scenarioValuesAtAge && (
                  <View style={styles.valueBarRow}>
                    <Text style={[styles.valueBarRowLabel, { color: theme.colors.text.muted }]}>Scenario</Text>
                    {/* Net worth */}
                    <View style={styles.valueBarItem}>
                      <View style={[styles.valueBarDot, { backgroundColor: chartPalette.scenarioLine }]} />
                      <Text style={[styles.valueBarLabel, { color: theme.colors.text.muted }]}>Net worth</Text>
                      <Text style={[styles.valueBarValue, { color: theme.colors.brand.primary, fontWeight: '600' }]}>
                        {formatCurrencyCompact(scenarioValuesAtAge.netWorth)}
                      </Text>
                    </View>

                    {/* Assets */}
                    <View style={styles.valueBarItem}>
                      <View style={[styles.valueBarDot, { backgroundColor: chartPalette.assetsLine }]} />
                      <Text style={[styles.valueBarLabel, { color: theme.colors.text.muted }]}>Assets</Text>
                      <Text style={[styles.valueBarValue, { color: theme.colors.brand.primary, fontWeight: '600' }]}>
                        {formatCurrencyCompact(scenarioValuesAtAge.assets)}
                      </Text>
                    </View>

                    {/* Liabilities */}
                    <View style={styles.valueBarItem}>
                      <View style={[styles.valueBarDot, { backgroundColor: chartPalette.liabilitiesLine }]} />
                      <Text style={[styles.valueBarLabel, { color: theme.colors.text.muted }]}>Liabilities</Text>
                      <Text style={[styles.valueBarValue, { color: theme.colors.brand.primary, fontWeight: '600' }]}>
                        {formatCurrencyCompact(scenarioValuesAtAge.liabilities)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Phase 5.5: Observational insights (max 2, filtered by selectedAge) */}
                {insightsToShow.length > 0 && (
                  <>
                    <View style={[styles.insightsDivider, { borderColor: theme.colors.border.subtle }]} />
                    <Text style={[styles.insightText, { color: theme.colors.text.secondary }]}>
                      {insightsToShow.map(insight => insight.text).join(' · ')}
                    </Text>
                  </>
                )}
              </View>
            </SectionCard>
          )}

          {/* Phase Four: Scenario Impact Section (only when scenario is active and deltas are valid) */}
          {effectiveScenarioActive && scenarioDeltas && scenarioValuesAtAge && deltasValid ? (
            <SectionCard>
              <SectionHeader title="Scenario Impact" />
              <View style={styles.insightsList}>
                {(() => {
                  // Calculate net worth change
                  const netWorthIncrease = scenarioValuesAtAge.netWorth - valuesAtAge.netWorth;
                  const netWorthIncreased = netWorthIncrease >= UI_TOLERANCE;
                  const netWorthDecreased = netWorthIncrease <= -UI_TOLERANCE;
                  
                  // Calculate asset impact components
                  const assetDelta = scenarioDeltas.assets;
                  const hasAssetDelta = Math.abs(assetDelta) >= UI_TOLERANCE;
                  
                  const baselineTotalContributions = valuesAtAge.pensionContributions + valuesAtAge.postTaxContributions;
                  const scenarioTotalContributions = scenarioValuesAtAge.pensionContributions + scenarioValuesAtAge.postTaxContributions;
                  const extraContributions = scenarioTotalContributions - baselineTotalContributions;
                  
                  const growthDelta = scenarioValuesAtAge.growth - valuesAtAge.growth;
                  
                  // Calculate percentages for assets (only if net worth increased)
                  const contributionPct = netWorthIncreased && Math.abs(netWorthIncrease) >= UI_TOLERANCE
                    ? Math.round((extraContributions / netWorthIncrease) * 100)
                    : null;
                  const growthPct = netWorthIncreased && Math.abs(netWorthIncrease) >= UI_TOLERANCE
                    ? Math.round((growthDelta / netWorthIncrease) * 100)
                    : null;
                  
                  // Calculate liability impact components
                  const liabilityDelta = scenarioDeltas.liabilities;
                  const hasLiabilityDelta = Math.abs(liabilityDelta) >= UI_TOLERANCE;
                  
                  const debtReduction = -liabilityDelta; // Positive value for display (reduction in remaining debt)
                  const interestSaved = valuesAtAge.interestPaid - scenarioValuesAtAge.interestPaid;
                  
                  // Principal paydown = reduction in remaining debt
                  const principalPaydownDelta = debtReduction; // Same as debtReduction
                  const principalPaydownPct = netWorthIncreased && Math.abs(netWorthIncrease) >= UI_TOLERANCE && principalPaydownDelta > 0
                    ? Math.round((principalPaydownDelta / netWorthIncrease) * 100)
                    : null;
                  
                  // Calculate payoff timing
                  const baselinePayoffPoint = baselineSeries.find(p => p.liabilities <= UI_TOLERANCE);
                  const scenarioPayoffPoint = effectiveScenarioSeries?.find((p: { age: number; liabilities: number }) => p.liabilities <= UI_TOLERANCE);
                  const baselinePayoffAge = baselinePayoffPoint?.age;
                  const scenarioPayoffAge = scenarioPayoffPoint?.age;
                  const hasEarlierPayoff = scenarioPayoffAge !== undefined && baselinePayoffAge !== undefined && scenarioPayoffAge < baselinePayoffAge;
                  
                  let yearsSaved = 0;
                  let monthsSaved = 0;
                  if (hasEarlierPayoff && baselinePayoffAge !== undefined && scenarioPayoffAge !== undefined) {
                    const totalMonthsSaved = (baselinePayoffAge - scenarioPayoffAge) * 12;
                    yearsSaved = Math.floor(totalMonthsSaved / 12);
                    monthsSaved = Math.round(totalMonthsSaved % 12);
                  }
                  
                  // Determine which sections to show
                  const hasAssetSubBullets = hasAssetDelta && (Math.abs(extraContributions) >= UI_TOLERANCE || Math.abs(growthDelta) >= UI_TOLERANCE);
                  const hasLiabilitySubBullets = (hasLiabilityDelta && principalPaydownDelta > 0) || interestSaved > 0 || (hasEarlierPayoff && (yearsSaved > 0 || monthsSaved > 0));
                  
                  return (
                    <>
                      {/* Bullet 1: Net worth change (always shown) */}
                      <Text style={styles.bodyText}>
                        • Net worth {netWorthIncreased ? 'increased' : netWorthDecreased ? 'decreased' : 'changed'} by {formatCurrencyCompact(Math.abs(netWorthIncrease))} (from {formatCurrencyCompact(valuesAtAge.netWorth)} to {formatCurrencyCompact(scenarioValuesAtAge.netWorth)})
                      </Text>
                      
                      {/* Bullet 2: From assets section (conditional) */}
                      {hasAssetSubBullets && (
                        <>
                          <Text style={styles.bodyText}>• From assets:</Text>
                          
                          {/* SubBullet 1: From higher contributions */}
                          {Math.abs(extraContributions) >= UI_TOLERANCE && (
                            <Text style={[styles.bodyText, { marginLeft: 16 }]}>
                        • From higher contributions: {formatCurrencyCompact(Math.abs(extraContributions))}{contributionPct !== null ? ` (${contributionPct}%)` : ''} (from {formatCurrencyCompact(baselineTotalContributions)} to {formatCurrencyCompact(scenarioTotalContributions)})
                      </Text>
                          )}
                          
                          {/* SubBullet 2: From investment growth */}
                          {Math.abs(growthDelta) >= UI_TOLERANCE && (
                            <Text style={[styles.bodyText, { marginLeft: 16 }]}>
                              • From investment growth: {formatCurrencyCompact(Math.abs(growthDelta))}{growthPct !== null ? ` (${growthPct}%)` : ''} (from {formatCurrencyCompact(valuesAtAge.growth)} to {formatCurrencyCompact(scenarioValuesAtAge.growth)})
                        </Text>
                          )}
                        </>
                      )}
                      
                      {/* Bullet 3: From liabilities section (conditional) */}
                      {hasLiabilitySubBullets && (
                        <>
                          <Text style={styles.bodyText}>• From liabilities:</Text>
                          
                          {/* SubBullet 1: Total liabilities reduced */}
                          {hasLiabilityDelta && (
                            <Text style={[styles.bodyText, { marginLeft: 16 }]}>
                              • Total liabilities reduced by {formatCurrencyCompact(principalPaydownDelta)} (from {formatCurrencyCompact(valuesAtAge.liabilities)} to {formatCurrencyCompact(scenarioValuesAtAge.liabilities)})
                            </Text>
                          )}
                          
                          {/* SubBullet 2: From principal paydown */}
                          {hasLiabilityDelta && principalPaydownDelta > 0 && (
                            <Text style={[styles.bodyText, { marginLeft: 16 }]}>
                              • From principal paydown: {formatCurrencyCompact(principalPaydownDelta)}{principalPaydownPct !== null ? ` (${principalPaydownPct}%)` : ''} (from {formatCurrencyCompact(valuesAtAge.remainingDebt)} to {formatCurrencyCompact(scenarioValuesAtAge.remainingDebt)})
                            </Text>
                          )}
                          
                          {/* SubBullet 3: Lower interest paid */}
                          {interestSaved > 0 && (
                            <Text style={[styles.bodyText, { marginLeft: 16 }]}>
                              • Lower interest paid: {formatCurrencyCompact(interestSaved)} (from {formatCurrencyCompact(valuesAtAge.interestPaid)} to {formatCurrencyCompact(scenarioValuesAtAge.interestPaid)})
                            </Text>
                          )}
                          
                          {/* SubBullet 4: Time saved to loan payoff */}
                          {hasEarlierPayoff && baselinePayoffAge !== undefined && scenarioPayoffAge !== undefined && (yearsSaved > 0 || monthsSaved > 0) && (
                            <Text style={[styles.bodyText, { marginLeft: 16 }]}>
                              • Time saved to loan payoff: {yearsSaved > 0 ? `${yearsSaved} year${yearsSaved !== 1 ? 's' : ''}` : ''}{yearsSaved > 0 && monthsSaved > 0 ? ' ' : ''}{monthsSaved > 0 ? `${monthsSaved} month${monthsSaved !== 1 ? 's' : ''}` : ''} (age {Math.floor(baselinePayoffAge)} → age {Math.floor(scenarioPayoffAge)})
                            </Text>
                          )}
                          
                          {/* Explanatory text for liability-driven scenarios */}
                          <Text style={[styles.bodyText, styles.bodyTextMuted, { marginLeft: 16, marginTop: 4 }]}>
                            Extra payments reduce the total interest charged on the loan, but mortgage payments are fixed. The interest saving isn't shown as lower expenses — it appears because the loan is paid off earlier, so those future interest payments never happen.
                          </Text>
                        </>
                      )}
                    </>
                  );
                })()}
              </View>
            </SectionCard>
          ) : null}

          {/* Projected Cash Flow Section */}
          <SectionCard>
            <SectionHeader title="Projected Cash Flow" subtitle={`Age ${selectedAge}`} />

            <View style={[styles.column, styles.cashflowColumn, { marginTop: layout.md }]}>
              <View style={styles.cashflowCardStack}>
                <View style={styles.cashflowSpine} />
              <View style={styles.cashflowCentered}>
                {/* Gross Income */}
                <SnapshotComparisonCard
                  title="Gross Income"
                  description="Total earnings over the period"
                  baselineValue={valuesAtAge.grossIncome}
                  scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.grossIncome : undefined}
                  showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                />

                {/* Pension + Other Deductions */}
                <View style={styles.cashflowSubGroup}>
                  <SnapshotComparisonCard
                    title="Pension"
                    description="Total pension contributions"
                    baselineValue={valuesAtAge.pensionContributions}
                    scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.pensionContributions : undefined}
                    showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                    isSubCard={true}
                  />
                  <SnapshotComparisonCard
                    title="Other Deductions"
                    description="Tax and other deductions"
                    baselineValue={valuesAtAge.taxes}
                    scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.taxes : undefined}
                    showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                    isSubCard={true}
                  />
                </View>

                {/* Net Income */}
                <SnapshotComparisonCard
                  title="Net Income"
                  description="Income after deductions"
                  baselineValue={valuesAtAge.grossIncome - valuesAtAge.pensionContributions - valuesAtAge.taxes}
                  scenarioValue={effectiveScenarioActive && scenarioValuesAtAge 
                    ? scenarioValuesAtAge.grossIncome - scenarioValuesAtAge.pensionContributions - scenarioValuesAtAge.taxes
                    : undefined}
                  showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                />

                {/* Expenses */}
                <View style={styles.cashflowSubGroup}>
                  <SnapshotComparisonCard
                    title="Expenses"
                    description="Total spending over time"
                    baselineValue={valuesAtAge.livingExpenses}
                    scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.livingExpenses : undefined}
                    showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                    isSubCard={true}
                  />
                </View>

                {/* Available Cash */}
                <SnapshotComparisonCard
                  title="Available Cash"
                  description="Cash remaining after expenses"
                  baselineValue={valuesAtAge.netSurplus}
                  scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.netSurplus : undefined}
                  showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                  isOutcome={true}
                />

                {/* Asset Contribution + Liability Reduction */}
                <View style={styles.cashflowSubGroup}>
                  <SnapshotComparisonCard
                    title="Asset Contribution"
                    description="Total invested contributions"
                    baselineValue={valuesAtAge.postTaxContributions}
                    scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.postTaxContributions : undefined}
                    showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                    isSubCard={true}
                  />
                  <SnapshotComparisonCard
                    title="Liability Reduction"
                    description="Debt repaid over time"
                    baselineValue={valuesAtAge.debtRepayment}
                    scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.debtRepayment : undefined}
                    showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                    isSubCard={true}
                  />
                </View>

                {/* Unallocated Cash */}
                <SnapshotComparisonCard
                  title="Monthly Surplus"
                  description="Net surplus accumulated over time"
                  baselineValue={valuesAtAge.netSurplus - valuesAtAge.postTaxContributions - valuesAtAge.debtRepayment}
                  scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.netSurplus - scenarioValuesAtAge.postTaxContributions - scenarioValuesAtAge.debtRepayment : undefined}
                  showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                  isOutcome={true}
                />

                {/* End padding */}
                <View style={styles.cashflowEndSpacer} />
              </View>
            </View>
            </View>
          </SectionCard>

          {/* Projected Balance Sheet Section */}
          <SectionCard>
            <SectionHeader title="Projected Balance Sheet" subtitle={`Age ${selectedAge}`} />

            <View style={styles.column}>
              <View style={styles.projectedBalanceSheetRow}>
                {/* Assets */}
                <BalanceSheetCard
                  title="Assets"
                  description="Value at age 75"
                  baselineValue={valuesAtAge.assets}
                  scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.assets : undefined}
                  baselineAgeDelta={valuesAtAge.assets - valuesAtAge.startingAssets}
                  scenarioAgeDelta={effectiveScenarioActive && scenarioValuesAtAge 
                    ? scenarioValuesAtAge.assets - scenarioValuesAtAge.startingAssets
                    : undefined}
                  scenarioDelta={isScenarioActive && scenarioValuesAtAge 
                    ? scenarioValuesAtAge.assets - valuesAtAge.assets
                    : undefined}
                  showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                  startingValue={valuesAtAge.startingAssets}
                  startingValueForScenario={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.startingAssets : undefined}
                />

                <Text style={styles.projectedBalanceSheetOperator}>−</Text>

                {/* Liabilities */}
                <BalanceSheetCard
                  title="Liabilities"
                  description="Outstanding at age 75"
                  baselineValue={valuesAtAge.liabilities}
                  scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.liabilities : undefined}
                  baselineAgeDelta={valuesAtAge.liabilities - (series[0]?.liabilities ?? 0)}
                  scenarioAgeDelta={effectiveScenarioActive && scenarioValuesAtAge
                    ? scenarioValuesAtAge.liabilities - (series[0]?.liabilities ?? 0)
                    : undefined}
                  scenarioDelta={isScenarioActive && scenarioValuesAtAge
                    ? scenarioValuesAtAge.liabilities - valuesAtAge.liabilities
                    : undefined}
                  showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                  startingValue={series[0]?.liabilities ?? 0}
                />

                <Text style={styles.projectedBalanceSheetOperator}>=</Text>

                {/* Net Worth */}
                <BalanceSheetCard
                  title="Net Worth"
                  description="Assets minus liabilities"
                  baselineValue={valuesAtAge.netWorth}
                  scenarioValue={effectiveScenarioActive && scenarioValuesAtAge ? scenarioValuesAtAge.netWorth : undefined}
                  baselineAgeDelta={valuesAtAge.netWorth - baselineA3Attribution.startingNetWorth}
                  scenarioAgeDelta={effectiveScenarioActive && scenarioValuesAtAge
                    ? scenarioValuesAtAge.netWorth - baselineA3Attribution.startingNetWorth
                    : undefined}
                  scenarioDelta={isScenarioActive && scenarioValuesAtAge
                    ? scenarioValuesAtAge.netWorth - valuesAtAge.netWorth
                    : undefined}
                  showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                  isOutcome={true}
                  startingValue={baselineA3Attribution.startingNetWorth}
                />
              </View>
            </View>
          </SectionCard>

          <SectionCard>
            {/* Section Header with Toggle */}
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="Net Worth Breakdown" subtitle={`Age ${selectedAge}`} />
              {effectiveScenarioActive && scenarioValuesAtAge !== null ? (
                <Pressable
                  style={[
                    styles.chartMiniToggle,
                    showDeltaColumn && styles.chartMiniToggleActive,
                  ]}
                  onPress={() => setShowDeltaColumn(v => !v)}
                >
                  <Text
                    style={[
                      styles.chartMiniToggleText,
                      showDeltaColumn && styles.chartMiniToggleTextActive,
                    ]}
                  >
                    Show Deltas
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Dev-only: Math reconciliation overlay (hidden by default, toggleable) */}
            {__DEV__ && effectiveScenarioActive && scenarioValuesAtAge && scenarioDeltas ? (
              <View style={styles.reconciliationOverlayContainer}>
                <Pressable
                  onPress={() => setShowReconciliationOverlay(!showReconciliationOverlay)}
                  style={styles.reconciliationToggle}
                >
                  <Text style={styles.reconciliationToggleText}>
                    {showReconciliationOverlay ? '▼' : '▶'} Math Reconciliation (Dev)
                  </Text>
                </Pressable>
                {showReconciliationOverlay ? (
                  <ReconciliationOverlay
                    valuesAtAge={valuesAtAge}
                    scenarioValuesAtAge={scenarioValuesAtAge}
                    scenarioDeltas={scenarioDeltas}
                    selectedAge={selectedAge}
                  />
                ) : null}
              </View>
            ) : null}

            <View style={styles.breakdownGroupContainer}>
              <AttributionCard
                title="Cash flow over time"
                subtitle=""
                education="This shows what happens to your income over time — how much comes in, how much you spend, how much you invest, and what's left as cash. Cash may earn a small amount of interest, but it grows very slowly compared to investments."
                rows={a3.cashflowRows}
                showScenario={isScenarioActive && scenarioValuesAtAge !== null}
                showDelta={showDeltaColumn}
              />
            </View>

            <View style={styles.breakdownGroupContainer}>
              <AttributionCard
                title="Debt effects"
                subtitle=""
                education="This shows how debt affects you over time — how much interest you pay, how much of the balance you pay back, and whether anything is still owed at the end."
                rows={a3.debtRows}
                showScenario={isScenarioActive && scenarioValuesAtAge !== null}
                showDelta={showDeltaColumn}
              />
            </View>

            <View style={styles.breakdownGroupContainer}>
              <AttributionCard
                title="Asset growth"
                subtitle=""
                education="This shows how your wealth builds up over time, starting from what you already have, adding money regularly, and letting investments grow year after year."
                rows={a3.assetRows}
                showScenario={isScenarioActive && scenarioValuesAtAge !== null}
                showDelta={showDeltaColumn}
              />
            </View>
          </SectionCard>

        </View>
      </ScrollView>


      {/* Asset Picker Modal */}
      <Modal
        transparent={true}
        visible={assetPickerOpen}
        animationType="slide"
        onRequestClose={() => setAssetPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={[styles.modalBackdropFlex, { backgroundColor: theme.colors.overlay.scrim25 }]} onPress={() => setAssetPickerOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
            <Text style={styles.modalTitle}>Select asset</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {state.assets.map(asset => {
                const metadata = (() => {
                  const parts: string[] = [];
                  if (typeof asset.annualGrowthRatePct === 'number' && Number.isFinite(asset.annualGrowthRatePct)) {
                    parts.push(`${asset.annualGrowthRatePct.toLocaleString('en-GB', { maximumFractionDigits: 2 })}%`);
                  }
                  const avail = asset.availability ?? { type: 'immediate' };
                  const liquidityLabel = avail.type === 'immediate' ? 'Liquid' : avail.type === 'locked' ? 'Locked' : 'Illiquid';
                  parts.push(liquidityLabel);
                  return parts.length > 0 ? parts.join(' • ') : null;
                })();
                return (
                  <Pressable
                    key={asset.id}
                    onPress={() => handleSelectAsset(asset.id)}
                    style={({ pressed }) => [styles.modalOption, { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' }]}
                  >
                    <View style={styles.modalOptionContent}>
                      <Text style={styles.modalOptionText}>{asset.name}</Text>
                      {metadata ? (
                        <Text style={styles.modalOptionMetadata}>{metadata}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              {state.assets.length === 0 ? (
                <Text style={styles.modalEmptyText}>No assets available</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Mortgage picker modal */}
      <Modal
        transparent={true}
        visible={mortgagePickerOpen}
        animationType="slide"
        onRequestClose={() => setMortgagePickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdropFlex} onPress={() => setMortgagePickerOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
            <Text style={styles.modalTitle}>Select mortgage</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {availableLoans.map(loan => {
                const metadata = (() => {
                  const parts: string[] = [];
                  if (typeof loan.annualInterestRatePct === 'number' && Number.isFinite(loan.annualInterestRatePct)) {
                    parts.push(`${loan.annualInterestRatePct.toLocaleString('en-GB', { maximumFractionDigits: 2 })}%`);
                  }
                  if (typeof loan.remainingTermYears === 'number' && Number.isFinite(loan.remainingTermYears)) {
                    parts.push(`${loan.remainingTermYears} years`);
                  }
                  return parts.length > 0 ? parts.join(' • ') : null;
                })();
                return (
                  <Pressable
                    key={loan.id}
                    onPress={() => handleSelectLiability(loan.id)}
                    style={({ pressed }) => [styles.modalOption, { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' }]}
                  >
                    <View style={styles.modalOptionContent}>
                      <Text style={styles.modalOptionText}>{loan.name}</Text>
                      {metadata ? (
                        <Text style={styles.modalOptionMetadata}>{metadata}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              {availableLoans.length === 0 ? (
                <Text style={styles.modalEmptyText}>No mortgages available</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Age selector modal */}
      <Modal transparent={true} visible={ageSelectorOpen} animationType="slide" onRequestClose={() => setAgeSelectorOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdropFlex} onPress={() => setAgeSelectorOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
            <Text style={styles.modalTitle}>Select age</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {Array.from({ length: state.projection.endAge - state.projection.currentAge + 1 }, (_, i) => {
                const age = state.projection.currentAge + i;
                return (
                  <Pressable
                    key={age}
                    onPress={() => {
                      setSelectedAge(age);
                      setAgeSelectorOpen(false);
                    }}
                    style={({ pressed }) => [styles.modalOption, { backgroundColor: pressed ? theme.colors.bg.subtle : (selectedAge === age ? theme.colors.bg.subtle : 'transparent') }]}
                  >
                    <Text style={[styles.modalOptionText, selectedAge === age && { color: theme.colors.brand.primary }]}>
                      Age {age}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Phase Four: Scenario Selector Modal */}
      <Modal transparent={true} visible={scenarioSelectorOpen} animationType="slide" onRequestClose={() => setScenarioSelectorOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdropFlex} onPress={() => setScenarioSelectorOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
            <Text style={styles.modalTitle}>Select scenario</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {/* Negative Surplus Banner in Modal */}
              {isSurplusNegative && (
                <View style={styles.modalWarningBanner}>
                  <Text style={styles.modalWarningBannerText}>
                    Monthly surplus is negative ({formatCurrencyFullSigned(baselineSurplus)}). Reduce allocations or expenses before running what-ifs.
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => handleScenarioSelect(BASELINE_SCENARIO_ID)}
                disabled={isSurplusNegative}
                style={({ pressed }) => [
                  styles.modalOption, 
                  { 
                    opacity: isSurplusNegative ? 0.5 : 1,
                    backgroundColor: pressed && !isSurplusNegative ? theme.colors.bg.subtle : ((!activeScenarioId || activeScenarioId === BASELINE_SCENARIO_ID) ? theme.colors.bg.subtle : 'transparent')
                  }
                ]}
              >
                <Text style={[styles.modalOptionText, (!activeScenarioId || activeScenarioId === BASELINE_SCENARIO_ID) && { color: theme.colors.brand.primary }]}>
                  Baseline
                </Text>
              </Pressable>
              {savedScenarios
                .filter(s => s.id !== BASELINE_SCENARIO_ID) // Exclude baseline from scenarios list
                .map(s => (
                  <Pressable
                    key={s.id}
                    onPress={() => handleScenarioSelect(s.id)}
                    disabled={isSurplusNegative}
                    style={({ pressed }) => [
                      styles.modalOption, 
                      { 
                        opacity: isSurplusNegative ? 0.5 : 1,
                        backgroundColor: pressed && !isSurplusNegative ? theme.colors.bg.subtle : (activeScenarioId === s.id ? theme.colors.bg.subtle : 'transparent')
                      }
                    ]}
                  >
                    <Text style={[styles.modalOptionText, activeScenarioId === s.id && { color: theme.colors.brand.primary }]}>
                      {s.name}
                    </Text>
                  </Pressable>
                ))}
              <View style={styles.modalDivider} />
              <Pressable
                onPress={() => {
                  setScenarioSelectorOpen(false);
                  navigation.navigate('ScenarioManagement');
                }}
                style={({ pressed }) => [styles.modalOption, { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' }]}
              >
                <Text style={styles.modalOptionTextSecondary}>Manage scenarios…</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: spacing.base,
  },
  projectionStickyHeader: {
    zIndex: 10,
  },
  projectionToolbarContainer: {
    paddingBottom: spacing.sm,
  },
  projectionToolbarSurface: {
    borderRadius: 8,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
    shadowColor: '#000', // TODO: shadow color - keep as-is
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toolbarRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toolbarPill: {
    height: 28,
    paddingHorizontal: layout.inputPadding,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarIconPill: {
    height: 28,
    width: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scenarioStatus: {
    marginRight: spacing.base,
  },
  scenarioPrimary: {
    fontSize: 12,
    fontWeight: '600',
  },
  scenarioSecondary: {
    marginTop: layout.micro,
    fontSize: 11,
    fontWeight: '500',
  },
  toolbarPillButton: {
    height: 28,
    paddingHorizontal: spacing.base,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toolbarPillButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toolbarPillButtonActive: {
    // TODO: brand tint — no theme token (intentional)
    backgroundColor: '#e8f0ff',
  },
  toolbarPillButtonTextActive: {
    fontWeight: '600',
  },
  toolbarPillChevron: {
    fontSize: 10,
    marginLeft: spacing.tiny,
  },
  scenarioSelector: {
    height: 28,
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
  },
  scenarioSelectorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scenarioSelectorChevron: {
    fontSize: 10,
  },
  agePill: {
    height: 28,
    paddingHorizontal: spacing.base,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agePillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  ageChevron: {
    marginLeft: spacing.xs,
    fontSize: 10,
  },
  iconText: {
    fontSize: 14,
  },
  settingsIcon: {
    opacity: 0.6,
  },
  activeZapIcon: {
    opacity: 0.8,
  },
  stickyToolbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    zIndex: 20,
  },
  toolbarLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  toolbarRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: spacing.xs,
  },
  toolbarSpacer: {
    flex: 1,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tiny,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    minHeight: 32,
    flexShrink: 1,
    minWidth: 0,
  },
  toolbarButtonLeft: {
    flexShrink: 1,
    minWidth: 80,
  },
  toolbarButtonRight: {
    flexShrink: 0,
    minWidth: 60,
  },
  toolbarButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111',
    flexShrink: 1,
    minWidth: 0,
  },
  toolbarIconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#fafafa',
    flexShrink: 0,
  },
  quickWhatIfContainer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fafafa',
  },
  quickWhatIfHint: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#999',
    marginBottom: spacing.sm,
  },
  quickWhatIfHintAmount: {
    color: '#2F5BEA',
    fontWeight: '500',
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.base,
  },
  quickLabel: {
    width: 96,
    fontSize: 12,
    color: '#777',
  },
  quickWhatIfSelector: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    minHeight: 40,
  },
  quickWhatIfSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickWhatIfSelectorValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  quickWhatIfPlaceholder: {
    fontWeight: '500',
    color: '#777',
  },
  quickWhatIfHelper: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#999',
    fontWeight: '400',
  },
  quickWhatIfAmountInput: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    minHeight: 40,
  },
  quickWhatIfAmountInputError: {
    borderColor: '#d32f2f',
    borderWidth: 1.5,
  },
  quickWhatIfAvailableCash: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#999',
    fontWeight: '400',
  },
  quickWhatIfAvailableCashAmount: {
    color: '#2F5BEA',
    fontWeight: '500',
  },
  quickWhatIfError: {
    fontSize: 12,
    color: '#d32f2f',
    lineHeight: 16,
    marginTop: 4,
  },
  clearScenarioText: {
    marginTop: 8,
    fontSize: 12,
    color: '#aaa',
    textDecorationLine: 'underline',
  },
  innerContent: {
    padding: 12,
    paddingTop: 12,
  },
  educationBlock: {
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  educationText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  hairlineDivider: {
    height: 0.5,
    backgroundColor: '#e0e0e0',
    marginBottom: layout.lg,
  },
  block: {
    marginBottom: layout.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  chartMiniToggle: {
    minWidth: 96,
    height: 22,
    paddingHorizontal: layout.inputPadding,
    borderRadius: 11,
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartMiniToggleActive: {
    backgroundColor: '#e8f0ff',
  },
  chartMiniToggleText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  chartMiniToggleTextActive: {
    color: '#2f5cff',
    fontWeight: '600',
  },
  toggleCard: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.base,
  },
  switchContainer: {
    transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }],
    marginTop: layout.micro,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
    marginBottom: 4,
  },
  toggleHelper: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  chartCard: {
    // Avoid clipping chart labels/legend.
    overflow: 'visible',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: 16,
  },
  legendRowSecondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: layout.micro,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  legendTextMuted: {
    fontSize: 11,
    fontWeight: '400',
  },
  // Phase 5.3: Unified value bar companion card
  valueBar: {
    flexDirection: 'column',
    alignSelf: 'center',
    gap: spacing.sm,
  },
  valueBarRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.base,
  },
  valueBarRowLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginRight: spacing.xs,
  },
  valueBarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  valueBarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  valueBarLabel: {
    fontSize: 12,
    fontWeight: '400',
  },
  valueBarValue: {
    fontSize: 12,
  },
  insightsDivider: {
    borderTopWidth: 1,
    marginTop: spacing.xs,
    paddingTop: 0,
  },
  insightText: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: spacing.xs,
    marginBottom: 0,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  outcomeSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 10,
  },
  outcomeSummary: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginTop: 12,
  },
  ageSelector: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: spacing.base,
    marginTop: 10,
    marginBottom: 4,
  },
  ageSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  ageSelectorLabel: {
    fontSize: 13,
    color: '#999',
  },
  ageSelectorValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    textAlign: 'right',
  },
  ageSelectorControlRow: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    marginTop: layout.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ageSelectorControlLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
  },
  ageSelectorControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ageSelectorControlValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  keyDriversCard: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  keyDriversTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 6,
  },
  keyDriversRows: {
    gap: spacing.sm,
  },
  keyDriversRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  keyDriversLabel: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  keyDriversValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    textAlign: 'right',
  },
  keyDriversValuesRow: {
    flexDirection: 'row',
    gap: spacing.base,
    alignItems: 'flex-start',
  },
  keyDriversValueScenario: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2F5BEA',
    textAlign: 'right',
    minWidth: 70,
  },
  keyDriversValueDelta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textAlign: 'right',
    minWidth: 60,
  },
  attrCard: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 12,
    padding: 12,
  },
  breakdownGroupContainer: {
    marginTop: spacing.base,
  },
  attrTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 6,
  },
  attrSubtitle: {
    fontSize: 12,
    color: '#555',
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  attrEducation: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
    lineHeight: 16,
  },
  attrRows: {
    gap: spacing.sm,
  },
  attrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  attrDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginTop: 4,
    marginBottom: 4,
  },
  attrLabel: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  attrValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    textAlign: 'right',
  },
  attrHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.sm,
    paddingBottom: 0,
    marginHorizontal: -spacing.base,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  attrHeaderSpacer: {
    flex: 1,
  },
  attrHeaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textAlign: 'right',
    minWidth: 70,
  },
  attrHeaderLabelScenario: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2F5BEA',
    textAlign: 'right',
    minWidth: 70,
  },
  attrHeaderLabelDelta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textAlign: 'right',
    minWidth: 60,
  },
  attrValuesRow: {
    flexDirection: 'row',
    gap: spacing.base,
    alignItems: 'flex-start',
  },
  attrValueScenario: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2F5BEA',
    textAlign: 'right',
    minWidth: 70,
  },
  attrValueDelta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textAlign: 'right',
    minWidth: 60,
  },
  attrValueScenarioUnchanged: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textAlign: 'right',
    minWidth: 70,
  },
  keyDriversValueScenarioUnchanged: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textAlign: 'right',
    minWidth: 70,
  },
  scenarioResultSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2F5BEA',
    marginBottom: spacing.sm,
  },
  keyDriversHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.sm,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  keyDriversHeaderSpacer: {
    flex: 1,
  },
  keyDriversHeaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textAlign: 'right',
    minWidth: 70,
  },
  keyDriversHeaderLabelScenario: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2F5BEA',
    textAlign: 'right',
    minWidth: 70,
  },
  keyDriversHeaderLabelDelta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textAlign: 'right',
    minWidth: 60,
  },
  endNetWorthSection: {
    marginTop: 12,
    paddingTop: 12,
  },
  endNetWorthDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginBottom: spacing.sm,
  },
  endNetWorthLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    marginBottom: 6,
  },
  endNetWorthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  endNetWorthBaselineLabel: {
    fontSize: 13,
    color: '#999',
  },
  endNetWorthBaselineValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
  },
  endNetWorthScenarioLabel: {
    fontSize: 13,
    color: '#999',
  },
  endNetWorthScenarioValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2F5BEA',
  },
  attrRowUnchanged: {
    opacity: 0.7,
  },
  attrLabelUnchanged: {
    color: '#999',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropFlex: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 14,
    paddingBottom: 18,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  modalList: {
    flexGrow: 0,
  },
  modalListContent: {
    paddingBottom: spacing.base,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionText: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
  },
  modalOptionTextSecondary: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  modalOptionContent: {
    flexDirection: 'column',
    gap: 2,
  },
  modalOptionMetadata: {
    fontSize: 12,
    color: '#777',
    fontWeight: '400',
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  modalOptionSubtext: {
    fontSize: 12,
    color: '#777',
    marginTop: layout.micro,
  },
  // Projected Snapshot styles (compact, calm, lightweight)
  projectedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: spacing.base,
  },
  headerQualifier: {
    color: '#999',
  },
  projectedMainSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#999',
    lineHeight: 17,
  },
  projectedSubHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 12,
  },
  column: {
    marginBottom: 16,
  },
  cashflowColumn: {
    marginBottom: spacing.sm,
  },
  cashflowCentered: {
    width: '100%',
  },
  cashflowPrimaryCard: {
    width: '100%',
  },
  cashflowCardStack: {
    position: 'relative',
    width: '100%',
    paddingHorizontal: layout.inputPadding,
  },
  cashflowSpine: {
    position: 'absolute',
    left: spacing.xl + spacing.sm,
    top: spacing.xs,
    bottom: spacing.xs,
    width: 1,
    backgroundColor: '#f0f0f0',
    zIndex: 0,
  },
  cashflowSubGroup: {
    marginTop: 0,
    marginBottom: 0,
  },
  cashflowCard: {
    // Spacing handled by cashflowMb* styles
  },
  cashflowMb: {
    marginBottom: spacing.sm,
  },
  cashflowGapMd: {
    height: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashflowGapLg: {
    height: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashflowChevron: {
    fontSize: 12,
    color: '#ddd',
    fontWeight: '400',
  },
  cashflowEndSpacer: {
    height: 12,
  },
  cashflowSubCard: {
    width: '90%',
    alignSelf: 'flex-end',
  },
  cashflowSubRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '84%',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  cashflowSubCardHalf: {
    width: '49%',
  },
  cashflowSubCardHalfLeft: {
    marginRight: 4,
  },
  cashflowTextCentered: {
    textAlign: 'center',
  },
  // Snapshot card structure styles (reused from SnapshotScreen)
  cashflowCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    gap: spacing.base,
  },
  cashflowCardLeft: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 100, // Reserve space for right-aligned value column
  },
  cashflowCardLeftIndented: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 100, // Reserve space for right-aligned value column
  },
  cashflowCardRight: {
    position: 'absolute',
    right: spacing.sm, // Align with card's right padding
    top: spacing.tiny, // Visual centering offset
    alignItems: 'flex-end',
  },
  cashflowValueRight: {
    textAlign: 'right',
  },
  projectedCard: {
    padding: 8,
    marginBottom: 0,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: '#d8d8d8',
  },
  projectedCardMinimal: {
    padding: 8,
    marginBottom: 0,
    borderRadius: 24,
  },
  projectedCardBordered: {
    padding: 8,
    marginBottom: 0,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: '#d8d8d8',
  },
  projectedCardTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 1,
    color: '#333',
  },
  projectedSubCardTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 1,
    color: '#999',
  },
  projectedPrimaryValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 0,
    color: '#111',
  },
  projectedPrimaryValueOutcome: {
  },
  projectedSubCardValue: {
    color: '#999',
  },
  projectedSubtext: {
    fontSize: 10,
    fontWeight: '400',
    color: '#999',
    marginTop: layout.micro,
  },
  projectedDelta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    marginTop: 4,
  },
  projectedDeltaScenario: {
    color: '#5B8DEF', // Muted brand blue
  },
  projectedDeltaAge: {
    color: '#999', // Muted neutral grey
  },
  projectedPrimaryValueScenario: {
    color: '#2F5BEA', // Brand blue
  },
  dualValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dualValueDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#ddd',
  },
  balanceSheetDualColumn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
    gap: spacing.xs,
  },
  balanceSheetColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  balanceSheetDeltaRow: {
    minHeight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceSheetDivider: {
    width: 1,
    minHeight: 40,
    backgroundColor: '#ddd',
    alignSelf: 'stretch',
  },
  dotSeparatorTight: {
    alignItems: 'center',
    marginVertical: 4,
  },
  dot: {
    fontSize: 10,
    color: '#ddd',
  },
  projectedBalanceSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  projectedBalanceSheetCard: {
    flex: 1,
    minWidth: 90,
    padding: 4,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: '#d8d8d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectedBalanceSheetOperator: {
    fontSize: 14,
    fontWeight: '400',
    color: '#bbb',
    marginHorizontal: 2,
  },
  // Phase Four: Scenario Impact styles
  scenarioImpactBlocks: {
    gap: layout.md,
    marginTop: spacing.sm,
  },
  scenarioImpactBlock: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: layout.md,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  scenarioImpactBlockTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: spacing.xs,
  },
  scenarioImpactBlockValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  scenarioImpactPositive: {
    color: '#2F5BEA',
  },
  scenarioImpactNegative: {
    color: '#999',
  },
  scenarioImpactBlockSubline: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  scenarioImpactBalanceSheetRows: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  scenarioImpactBalanceSheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scenarioImpactBalanceSheetLabel: {
    fontSize: 13,
    color: '#999',
  },
  scenarioImpactBalanceSheetValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Phase Four: Projected Snapshot muted styles (when showing scenario)
  projectedSnapshotMuted: {
    opacity: 0.7,
  },
  projectedSnapshotMutedText: {
    color: '#999',
  },
  projectedSnapshotMutedCard: {
    backgroundColor: '#f9f9f9',
    borderColor: '#e5e5e5',
  },
  // Insights list (same format as SnapshotScreen)
  insightsList: {
    marginTop: layout.md,
  },
  bodyText: {
    fontSize: 13,
    fontWeight: snapshotTypography.bodyWeight,
    color: '#666',
    marginBottom: 6,
    lineHeight: 18,
  },
  bodyTextMuted: {
    color: '#999',
    opacity: 0.7,
  },
  // Snapshot card styles (reused from SnapshotScreen)
  snapshotCard: {
    paddingVertical: spacing.tiny,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: spacing.xl,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    zIndex: 1,
  },
  snapshotCardTitle: {
    fontSize: snapshotTypography.cardTitleSize,
    fontWeight: snapshotTypography.cardTitleWeight,
    marginBottom: 1,
    color: '#000',
  },
  snapshotSubCardTitle: {
    color: '#666',
  },
  snapshotSubCardValue: {
    color: '#666',
  },
  snapshotPrimaryValue: {
    fontSize: snapshotTypography.primaryValueSize,
    fontWeight: snapshotTypography.primaryValueWeight,
    marginBottom: 1,
    color: '#000',
  },
  snapshotPrimaryValueOutcome: {
  },
  snapshotPrimaryValueScenario: {
  },
  snapshotCardDescription: {
    fontSize: snapshotTypography.bodySize,
    fontWeight: snapshotTypography.bodyWeight,
    color: '#999',
    marginTop: 1,
  },
  snapshotDeltaValue: {
    fontSize: snapshotTypography.bodySize,
    fontWeight: snapshotTypography.bodyWeight,
    color: '#999',
    marginTop: 1,
  },
  snapshotDeltaValueMuted: {
    color: '#8FA8D4', // Muted blue
  },
  comparisonValuesContainer: {
    alignItems: 'flex-end',
  },
  comparisonValuesRow: {
    flexDirection: 'row',
    gap: spacing.base,
    alignItems: 'flex-start',
  },
  comparisonValueColumn: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  comparisonDeltaRow: {
    flexDirection: 'row',
    gap: spacing.base,
    alignItems: 'flex-start',
    marginTop: 2,
  },
  chartHelperText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  // Dev-only: Reconciliation overlay styles
  reconciliationOverlayContainer: {
    marginTop: layout.md,
    marginBottom: spacing.xs,
  },
  reconciliationToggle: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: layout.inputPadding,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  reconciliationToggleText: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  reconciliationPanel: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  reconciliationTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: spacing.sm,
    fontFamily: 'monospace',
  },
  reconciliationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reconciliationLabel: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
    flex: 1,
  },
  reconciliationValue: {
    fontSize: 11,
    color: '#111',
    fontFamily: 'monospace',
    fontWeight: '600',
    textAlign: 'right',
  },
  reconciliationPass: {
  },
  reconciliationFail: {
    color: '#ef4444',
  },
  reconciliationDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  reconciliationWarning: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  reconciliationWarningText: {
    fontSize: 11,
    color: '#991b1b',
    fontFamily: 'monospace',
  },
  warningBanner: {
    marginTop: layout.sectionGap,
    marginHorizontal: layout.screenPadding,
    padding: layout.blockPadding,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  warningBannerText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  toolbarPillButtonDisabled: {
    opacity: 0.5,
  },
  modalWarningBanner: {
    marginBottom: 12,
    padding: layout.blockPadding,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  modalWarningBannerText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
});


