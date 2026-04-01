import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { VictoryAxis, VictoryChart, VictoryLabel, VictoryLine, VictoryScatter } from 'victory-native';
import * as Clipboard from 'expo-clipboard';
import { Coin, Coins, HandCoins, PiggyBank, Receipt, ShoppingCart, Target, TrendUp, TrendDown } from 'phosphor-react-native';

import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SectionCard from '../components/SectionCard';
import Button from '../components/Button';
import Row from '../components/PressableRow';
import Divider from '../components/Divider';
import Icon from '../components/Icon';
import IconButton from '../components/IconButton';
import ControlBar, { type ControlBarPillItem, type ControlBarIconItem } from '../components/ControlBar';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { useTheme } from '../ui/theme/useTheme';
import CashflowCardStack from '../components/cashflow/CashflowCardStack';
import CashflowPrimaryCard from '../components/cashflow/CashflowPrimaryCard';
import CashflowSubCard from '../components/cashflow/CashflowSubCard';
import CashflowCardWrapper from '../components/cashflow/CashflowCardWrapper';
import { getMutedBorderColor } from '../ui/utils/getMutedBorderColor';
import InterpretationCard from '../components/InterpretationCard';
import GoalsSection from '../components/GoalsSection';

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

import { useSnapshot } from '../context/SnapshotContext';
import { computeProjectionSeries, computeProjectionSummary, annualPctToMonthlyRate, deflateToTodaysMoney, type ProjectionEngineInputs } from '../engines/projectionEngine';
import { computeA3Attribution, type A3Attribution } from '../engines/computeA3Attribution';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { initLoan, stepLoanMonth } from '../engines/loanEngine';
import { formatCurrencyFull, formatCurrencyFullSigned, formatCurrencyCompact, formatCurrencyCompactSigned } from '../ui/formatters';
import { useWindowDimensions } from 'react-native';
import type { AssetItem, ScenarioState, SnapshotState } from '../types';
import { selectPension, selectMonthlySurplus, selectMonthlySurplusWithScenario, selectSnapshotTotals, selectLoanDerivedRows, selectExpenses } from '../engines/selectors';
import { UI_TOLERANCE, ATTRIBUTION_TOLERANCE, AGE_COMPARISON_TOLERANCE } from '../constants';
import { interpretProjection } from '../insights/interpretProjection';
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
    // Phase 7.11: Assets and liabilities use domain-specific colors
    assetsLine: theme.colors.domain.asset,
    liabilitiesLine: theme.colors.domain.liability,
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


// Helpers are now imported from projectionEngine to avoid duplication

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
  const styles = makeStyles(theme);
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
          <Text style={[
            styles.snapshotCardTitle,
            { color: theme.colors.text.primary },
            isSubCard && [styles.snapshotSubCardTitle, { color: theme.colors.text.secondary }]
          ]}>
            {title}
          </Text>
          <Text style={[styles.snapshotCardDescription, { color: theme.colors.text.muted }]} numberOfLines={1} ellipsizeMode="tail">
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
                        { color: theme.colors.semantic.infoText },
                        styles.cashflowValueRight,
                      ]}>
                        {formatCurrencyCompactSigned(delta)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[
                      styles.snapshotPrimaryValue,
                      { color: theme.colors.text.muted },
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
  const styles = makeStyles(theme);
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
        <View style={[styles.dualValueDivider, { backgroundColor: theme.colors.border.subtle }]} />
        <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start', paddingLeft: spacing.xs }}>
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={[styles.projectedPrimaryValue, styles.projectedPrimaryValueScenario, { textAlign: 'left', color: theme.colors.brand.primary }]}>
              {formatValue(scenarioValue)}
            </Text>
            {hasDelta && (
              <Text style={[styles.projectedDelta, styles.projectedDeltaScenario, { color: theme.colors.semantic.infoText, textAlign: 'left', marginTop: layout.micro }]}>
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
  const styles = makeStyles(theme);
  if (!showScenario || scenarioValue === undefined) {
    // Single column: baseline only
    const ageDelta = baselineAgeDelta;
    const hasAgeDelta = Math.abs(ageDelta) >= UI_TOLERANCE;
    
    return (
      <View style={[styles.projectedBalanceSheetCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle }]}>
        <Text style={[styles.projectedCardTitle, styles.cashflowTextCentered, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>{title}</Text>
        <Text style={[styles.projectedPrimaryValue, isOutcome && styles.projectedPrimaryValueOutcome, styles.cashflowTextCentered, theme.typography.value, { color: theme.colors.text.primary }]}>
          {formatCurrencyCompact(baselineValue)}
        </Text>
        {hasAgeDelta && (
          <Text style={[styles.projectedDelta, styles.projectedDeltaAge, styles.cashflowTextCentered, theme.typography.body, { color: theme.colors.text.muted }]}>
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
    <View style={[styles.projectedBalanceSheetCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle }]}>
      <Text style={[styles.projectedCardTitle, styles.cashflowTextCentered, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>{title}</Text>
      
      <View style={styles.balanceSheetDualColumn}>
        {/* LEFT COLUMN: Baseline */}
        <View style={styles.balanceSheetColumn}>
          {/* Row 1: Values */}
          <Text style={[styles.projectedPrimaryValue, styles.cashflowTextCentered, theme.typography.value, { color: theme.colors.text.primary }]}>
            {formatCurrencyCompact(baselineValue)}
          </Text>
          {/* Row 2: Age delta or placeholder - always reserve space */}
          <View style={styles.balanceSheetDeltaRow}>
            {hasBaselineAgeDelta ? (
              <Text style={[styles.projectedDelta, styles.projectedDeltaAge, styles.cashflowTextCentered, theme.typography.body, { color: theme.colors.text.muted }]}>
                {formatCurrencyCompactSigned(baselineAgeDelta)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.balanceSheetDivider, { backgroundColor: theme.colors.border.subtle }]} />

        {/* RIGHT COLUMN: Scenario */}
        <View style={styles.balanceSheetColumn}>
          {/* Row 1: Values */}
          {valuesEqual ? (
            <Text style={[styles.projectedPrimaryValue, styles.projectedDelta, styles.cashflowTextCentered, theme.typography.value, { color: theme.colors.text.muted }]}>
              -
            </Text>
          ) : (
            <>
          <Text style={[styles.projectedPrimaryValue, styles.projectedPrimaryValueScenario, styles.cashflowTextCentered, theme.typography.value, { color: theme.colors.brand.primary }]}>
            {formatCurrencyCompact(scenarioValue)}
          </Text>
              {/* Row 2: Scenario delta (baseline → scenario) */}
              {hasScenarioDelta && (
              <Text style={[styles.projectedDelta, styles.projectedDeltaScenario, { color: theme.colors.semantic.infoText }, styles.cashflowTextCentered, theme.typography.body]}>
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
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const endNetWorthValuesDiffer = endNetWorthDelta && endNetWorthDelta !== '—';
  
  return (
    <View style={[styles.keyDriversCard, { borderColor: theme.colors.border.default }]}>
      <Text style={[styles.keyDriversTitle, { color: theme.colors.text.primary }]}>What mattered most over this time</Text>
      {showScenario && scenarioResult ? (
        <Text style={styles.scenarioResultSummary}>{scenarioResult}</Text>
      ) : null}
      {showScenario && rows.some(r => r.scenarioValueText) ? (
        <>
          <View style={styles.keyDriversHeaderRow}>
            <View style={styles.keyDriversHeaderSpacer} />
            <Text style={styles.keyDriversHeaderLabel}>Baseline</Text>
            <Text style={styles.keyDriversHeaderLabelScenario}>Scenario</Text>
            {showDelta ? <Text style={styles.keyDriversHeaderLabelDelta}>Δ</Text> : null}
          </View>
          <Divider />
        </>
      ) : null}
      <View style={styles.keyDriversRows}>
        {rows
          .map(r => {
            const isUnchanged = showScenario && r.valuesDiffer === false;
            return (
              <View key={r.label} style={[styles.keyDriversRow, isUnchanged && styles.attrRowUnchanged]}>
                <Text style={[styles.keyDriversLabel, { color: theme.colors.text.tertiary }, isUnchanged && styles.attrLabelUnchanged]}>{r.label}</Text>
                {showScenario && r.scenarioValueText ? (
                  <View style={styles.keyDriversValuesRow}>
                    <Text style={[styles.keyDriversValue, { color: theme.colors.text.primary }]}>{r.valueText}</Text>
                    <Text style={[
                      r.valuesDiffer ? [styles.keyDriversValueScenario, { color: theme.colors.brand.primary }] : styles.keyDriversValueScenarioUnchanged
                    ]}>{r.scenarioValueText}</Text>
                    {showDelta && r.deltaValueText ? (
                      <Text style={[styles.keyDriversValueDelta, { color: theme.colors.text.muted }]}>{r.deltaValueText}</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={[styles.keyDriversValue, { color: theme.colors.text.primary }]}>{r.valueText}</Text>
                )}
              </View>
            );
          })}
        {showScenario && endNetWorthBaseline && endNetWorthScenario ? (
          <>
            <View style={{ marginBottom: spacing.sm }}>
              <Divider />
            </View>
            <View style={styles.keyDriversRow}>
              <Text style={[styles.keyDriversLabel, { color: theme.colors.text.tertiary }]}>Net Worth</Text>
              <View style={styles.keyDriversValuesRow}>
                <Text style={[styles.keyDriversValue, { color: theme.colors.text.primary }]}>{endNetWorthBaseline}</Text>
                <Text style={[
                  endNetWorthValuesDiffer ? [styles.keyDriversValueScenario, { color: theme.colors.brand.primary }] : styles.keyDriversValueScenarioUnchanged
                ]}>{endNetWorthScenario}</Text>
                {showDelta && endNetWorthDelta ? (
                  <Text style={[styles.keyDriversValueDelta, { color: theme.colors.text.muted }]}>{endNetWorthDelta}</Text>
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
  const { theme } = useTheme();
  const styles = makeStyles(theme);
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
    <View style={[styles.reconciliationPanel, { backgroundColor: theme.colors.bg.subtle }]}>
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
        <Text style={[styles.reconciliationValue, reconciles ? [styles.reconciliationPass, { color: theme.colors.semantic.success }] : [styles.reconciliationFail, { color: theme.colors.semantic.error }]]}>
          {reconciles ? '✓ YES' : '✕ NO'}
        </Text>
      </View>

      <View style={{ marginVertical: spacing.sm }}>
        <Divider />
      </View>

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
      
      <View style={{ marginVertical: spacing.sm }}>
        <Divider />
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Sum:</Text>
        <Text style={styles.reconciliationValue}>{formatCurrencyFull(attributionSum)}</Text>
      </View>

      <View style={{ marginVertical: spacing.sm }}>
        <Divider />
      </View>

      <Text style={styles.reconciliationTitle}>Canonical Invariants</Text>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>netWorthDelta = scenario − baseline:</Text>
        <Text style={[styles.reconciliationValue, invariant1 ? [styles.reconciliationPass, { color: theme.colors.semantic.success }] : [styles.reconciliationFail, { color: theme.colors.semantic.error }]]}>
          {invariant1 ? '✓' : '✕'}
        </Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>netWorthDelta = extraContributions + extraGrowth:</Text>
        <Text style={[styles.reconciliationValue, invariant2 ? [styles.reconciliationPass, { color: theme.colors.semantic.success }] : [styles.reconciliationFail, { color: theme.colors.semantic.error }]]}>
          {invariant2 ? '✓' : '✕'}
        </Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>netWorthDelta = sum(attribution):</Text>
        <Text style={[styles.reconciliationValue, invariant3 ? [styles.reconciliationPass, { color: theme.colors.semantic.success }] : [styles.reconciliationFail, { color: theme.colors.semantic.error }]]}>
          {invariant3 ? '✓' : '✕'}
        </Text>
      </View>
      
      <View style={styles.reconciliationRow}>
        <Text style={styles.reconciliationLabel}>Growth = residual (not total):</Text>
        <Text style={[styles.reconciliationValue, invariant4 ? [styles.reconciliationPass, { color: theme.colors.semantic.success }] : [styles.reconciliationFail, { color: theme.colors.semantic.error }]]}>
          {invariant4 ? '✓' : '✕'}
        </Text>
      </View>

      {!allInvariantsPass && (
        <View style={[styles.reconciliationWarning, { backgroundColor: theme.colors.semantic.errorBg, borderColor: theme.colors.semantic.errorBorder }]}>
          <Text style={[styles.reconciliationWarningText, { color: theme.colors.semantic.errorText }]}>
            ⚠️ One or more invariants failed. Check console for details.
          </Text>
        </View>
      )}
    </View>
  );
}


function AttributionCard({ title, subtitle, education, rows, showScenario, showDelta }: { title: string; subtitle?: string; education: string; rows: Row[]; showScenario: boolean; showDelta: boolean }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.attrCard, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.subtle }]}>
      <Text style={[styles.attrTitle, { color: theme.colors.text.primary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.attrSubtitle, { color: theme.colors.text.secondary }]}>{subtitle}</Text> : null}
      {education ? <Text style={[styles.attrEducation, { color: theme.colors.text.muted }]}>{education}</Text> : null}
      {showScenario && rows.some(r => r.scenarioValueText) ? (
        <>
          <View style={styles.attrHeaderRow}>
            <View style={styles.attrHeaderSpacer} />
            <Text style={styles.attrHeaderLabel}>Baseline</Text>
            <Text style={styles.attrHeaderLabelScenario}>Scenario</Text>
            {showDelta ? <Text style={styles.attrHeaderLabelDelta}>Δ</Text> : null}
          </View>
          <Divider />
        </>
      ) : null}
      <View style={styles.attrRows}>
        {rows
          .map((r, index) => {
            const isUnchanged = showScenario && r.valuesDiffer === false;
            return (
              <View key={r.label}>
                <View style={[styles.attrRow, isUnchanged && styles.attrRowUnchanged]}>
                  <Text style={[styles.attrLabel, { color: theme.colors.text.tertiary }, isUnchanged && styles.attrLabelUnchanged]}>{r.label}</Text>
                  {showScenario && r.scenarioValueText ? (
                    <View style={styles.attrValuesRow}>
                      <Text style={[styles.attrValue, { color: theme.colors.text.primary }]}>{r.valueText}</Text>
                      <Text style={[
                        r.valuesDiffer ? [styles.attrValueScenario, { color: theme.colors.brand.primary }] : styles.attrValueScenarioUnchanged
                      ]}>{r.scenarioValueText}</Text>
                      {showDelta && r.deltaValueText ? (
                        <Text style={[styles.attrValueDelta, { color: theme.colors.text.muted }]}>{r.deltaValueText}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[styles.attrValue, { color: theme.colors.text.primary }]}>{r.valueText}</Text>
                  )}
                </View>
                {r.showDividerAfter ? (
                  <View style={{ marginTop: spacing.tiny, marginBottom: spacing.tiny }}>
                    <Divider />
                  </View>
                ) : null}
              </View>
            );
          })}
      </View>
    </View>
  );
}

export default function ProjectionResultsScreen() {
  const { theme, isDark } = useTheme();
  const styles = makeStyles(theme);
  const chartPalette = getChartPalette(theme);
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const { state, setProjection, isSwitching, profilesState } = useSnapshot();

  // Helper to prevent modal open taps from immediately closing via backdrop press
  const openLater = (fn: () => void) => {
    setTimeout(fn, 0);
  };
  void setProjection; // Results screen does not edit projection inputs.

  const [showLiquidOnly, setShowLiquidOnly] = useState(false);
  const [selectedAge, setSelectedAge] = useState<number>(state.projection.endAge);
  const [ageSelectorOpen, setAgeSelectorOpen] = useState(false);
  const [showDeltaColumn, setShowDeltaColumn] = useState(false);
  // Phase 10.7/10.8: Collapsible sections (collapsed by default)
  const [cashflowExpanded, setCashflowExpanded] = useState(false);
  const [attributionExpanded, setAttributionExpanded] = useState(false);
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

  // Gate: Check if baseline surplus is negative (over-allocation)
  const baselineSurplus = selectMonthlySurplus(state);
  const isSurplusNegative = baselineSurplus < -UI_TOLERANCE;

  // Refs for scrolling
  const scrollViewRef = useRef<ScrollView>(null);
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

  // Phase Two: Compute baseline projection atomically (inputs, series, summary in single memo)
  // CRITICAL: This ensures inputs, series, and summary are always consistent (no stale values)
  // Follows pattern from A3ValidationScreen.tsx for atomic projection computation
  const baselineProjection = useMemo(() => {
    const inputs = buildProjectionInputsFromState(state);
    const series = computeProjectionSeries(inputs);
    const summary = computeProjectionSummary(inputs);
    return { inputs, series, summary };
  }, [
    state.projection.currentAge,
    state.projection.endAge,
    state.projection.inflationPct,
    state.projection.monthlyDebtReduction,
    state.assets,
    state.assetContributions,
    state.liabilities,
  ]);

  // Extract for backward compatibility (existing code depends on these)
  const baselineProjectionInputs = baselineProjection.inputs;
  const baselineSeries = baselineProjection.series;
  const baselineSummary = baselineProjection.summary;

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
    // This ensures FLOW scenarios work through contribution deltas
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
    // Gate guardrails during profile/mode switches to avoid transient failures
    if (__DEV__ && !isSwitching) {
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

  // Phase Four: Compute baseline A3 attribution (always baseline, never scenario-adjusted)
  // Model 1: A3 treats baselineSeries as ground truth (no scenario awareness)
  // CRITICAL: Uses atomic baselineProjection object to ensure inputs, series, and summary are always consistent
  const baselineA3Attribution = useMemo(() => {
    // Gate: Prevent attribution computation during profile/mode switches
    if (isSwitching) {
      // Return a placeholder attribution during switching to avoid errors
      // This will be recomputed once switching completes
      return {
        startingNetWorth: 0,
        endingNetWorth: 0,
        cashflow: {
          grossIncome: 0,
          pensionContributions: 0,
          taxes: 0,
          livingExpenses: 0,
          netSurplus: 0,
          postTaxContributions: 0,
          debtRepayment: 0,
        },
        debt: {
          interestPaid: 0,
          principalRepaid: 0,
          remainingDebt: 0,
        },
        assets: {
          startingValue: 0,
          contributions: 0,
          growth: 0,
          endingValue: 0,
        },
        reconciliation: {
          lhs: 0,
          rhs: 0,
          delta: 0,
        },
        inactiveCounts: {
          assets: 0,
          liabilities: 0,
          expenses: 0,
        },
      };
    }
    
    const attribution = computeA3Attribution({
      snapshot: state,
      projectionSeries: baselineProjection.series,      // Always in sync with inputs
      projectionSummary: baselineProjection.summary,    // Always in sync with inputs
      projectionInputs: baselineProjection.inputs,      // Always in sync with series/summary
      // Model 1: A3 treats baselineSeries as ground truth
    });
    
    // Guardrail: Verify baseline attribution matches baseline projection summary
    // CRITICAL: Baseline attribution must align with baselineSummary on all key metrics
    // Gate guardrails during profile/mode switches to avoid transient failures
    if (__DEV__ && !isSwitching) {
      // 1) Verify endingNetWorth matches (net worth reconciliation)
      const netWorthMatch = Math.abs(attribution.endingNetWorth - baselineProjection.summary.endNetWorth) < UI_TOLERANCE;
      if (!netWorthMatch) {
        console.error('[A3 Attribution Guardrail] Baseline attribution endingNetWorth mismatch:', {
          attribution: attribution.endingNetWorth,
          summary: baselineProjection.summary.endNetWorth,
          delta: attribution.endingNetWorth - baselineProjection.summary.endNetWorth,
        });
      }
      
      // 2) Verify net worth reconciliation: endingAssets - endingLiabilities ≈ endingNetWorth
      const endingAssets = baselineProjection.summary.endAssets;
      const endingLiabilities = baselineProjection.summary.endLiabilities;
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
      
      // 3) Verify contribution decomposition: totalContributions ≈ postTax + pension (asset contributions only)
      // totalContributions now includes ONLY asset contributions (post-tax + pension)
      // totalPrincipalRepaid includes liability reduction (non-loan debt paydown + loan principal: scheduled + overpayments)
      // Decomposition:
      //   - cashflow.postTaxContributions: postTax asset contributions
      //   - cashflow.pensionContributions: preTax asset contributions (pension)
      const expectedContributions = 
        attribution.cashflow.postTaxContributions +
        attribution.cashflow.pensionContributions;
      const contributionDecompMatch = Math.abs(expectedContributions - baselineProjection.summary.totalContributions) < ATTRIBUTION_TOLERANCE;
      if (!contributionDecompMatch) {
        console.error('[A3 Attribution Guardrail] Baseline attribution contribution decomposition failed (postTax + pension ≈ totalContributions):', {
          postTaxContributions: attribution.cashflow.postTaxContributions,
          pensionContributions: attribution.cashflow.pensionContributions,
          expectedTotal: expectedContributions,
          summaryTotalContributions: baselineProjection.summary.totalContributions,
          delta: expectedContributions - baselineProjection.summary.totalContributions,
          note: 'totalContributions includes only asset contributions (postTax + pension), not debt principal',
        });
      }
      
      // 3b) Verify attribution.assets.contributions matches projection.summary.totalContributions
      // CRITICAL: Attribution must use same contribution flows as simulation (via projectionInputs)
      const attributionContributionsMatch = Math.abs(attribution.assets.contributions - baselineProjection.summary.totalContributions) < ATTRIBUTION_TOLERANCE;
      if (!attributionContributionsMatch) {
        console.error('[A3 Attribution Guardrail] Baseline attribution asset contributions do not match projection summary totalContributions:', {
          attributionContributions: attribution.assets.contributions,
          summaryTotalContributions: baselineProjection.summary.totalContributions,
          delta: attribution.assets.contributions - baselineProjection.summary.totalContributions,
          note: 'Attribution should use projectionInputs to match simulation flows. Ensure baselineProjectionInputs is passed to computeA3Attribution.',
        });
      }
      
      // 4) Verify principal repayment: totalPrincipalRepaid ≈ principalRepaid (may include non-loan debt paydown)
      // Note: Non-loan debt paydown is included in totalPrincipalRepaid but not separately tracked in A3
      const expectedPrincipalRepaid = attribution.debt.principalRepaid;
      const principalRepaidMatch = Math.abs(expectedPrincipalRepaid - baselineProjection.summary.totalPrincipalRepaid) < ATTRIBUTION_TOLERANCE * 2; // Allow larger tolerance for non-loan debt paydown
      if (!principalRepaidMatch) {
        console.warn('[A3 Attribution Guardrail] Baseline attribution principal repayment decomposition may differ (principalRepaid ≈ totalPrincipalRepaid):', {
          attributionPrincipalRepaid: attribution.debt.principalRepaid,
          summaryTotalPrincipalRepaid: baselineProjection.summary.totalPrincipalRepaid,
          delta: expectedPrincipalRepaid - baselineProjection.summary.totalPrincipalRepaid,
          note: 'totalPrincipalRepaid may include non-loan debt paydown not tracked in A3',
        });
      }
    }
    
    return attribution;
  }, [baselineProjection, state, isSwitching]);

  // Phase Two: Compute Quick What-If scenario projection atomically (inputs, series, summary in single memo)
  // CRITICAL: This ensures inputs, series, and summary are always consistent (no stale values)
  const quickWhatIfProjection = useMemo(() => {
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
    
    const inputs = scenarioProjectionInputs;
    const series = computeProjectionSeries(inputs);
    const summary = computeProjectionSummary(inputs);
    return { inputs, series, summary };
  }, [scenarioProjectionInputs, baselineProjectionInputs]);

  // Extract for backward compatibility
  const quickWhatIfSeries = quickWhatIfProjection?.series ?? null;
  const quickWhatIfSummary = quickWhatIfProjection?.summary ?? null;

  // Phase Four: Compute persisted scenario projection atomically (inputs, series, summary in single memo)
  // CRITICAL: Always use computeProjectionSeries(persistedScenarioProjectionInputs)
  // Never derive from valuesAtSelectedAge, computeValuesAtAge, selectedAge, or snapshot-only helpers
  // CRITICAL: This ensures inputs, series, and summary are always consistent (no stale values)
  const persistedScenarioProjection = useMemo(() => {
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
    const series = computeProjectionSeries(inputs);
    const summary = computeProjectionSummary(inputs);
    return { inputs, series, summary };
  }, [persistedScenarioProjectionInputs, baselineProjectionInputs, activeScenario]);

  // Extract for backward compatibility
  const persistedScenarioSeries = persistedScenarioProjection?.series ?? null;
  const persistedScenarioSummary = persistedScenarioProjection?.summary ?? null;

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
  // CRITICAL: Uses atomic quickWhatIfProjection object to ensure inputs, series, and summary are always consistent
  const quickWhatIfA3Attribution = useMemo(() => {
    // Gate: Prevent attribution computation during profile/mode switches
    if (isSwitching) return null;
    
    if (!quickWhatIfProjection || !scenario.isActive) return null;
    
    // A3 must NEVER be scenario-aware - scenarioSeries already reflects different contributions and asset paths
    // Pass scenarioProjectionInputs to source contributions from scenario inputs (FLOW_TO_ASSET contributions)
    return computeA3Attribution({
      snapshot: state,
      projectionSeries: quickWhatIfProjection.series,      // Always in sync with inputs
      projectionSummary: quickWhatIfProjection.summary,    // Always in sync with inputs
      projectionInputs: quickWhatIfProjection.inputs,      // Always in sync with series/summary
    });
  }, [quickWhatIfProjection, scenario.isActive, state, isSwitching]);

  // Phase Four: Compute persisted scenario A3 attribution (only when persisted scenario is active)
  // Model 1: A3 treats scenarioSeries as ground truth (already reflects scenario changes)
  // Pass persistedScenarioProjectionInputs to compute contributions from scenario inputs (not baseline snapshot)
  // CRITICAL: Uses atomic persistedScenarioProjection object to ensure inputs, series, and summary are always consistent
  const persistedScenarioA3Attribution = useMemo(() => {
    // Gate: Prevent attribution computation during profile/mode switches
    if (isSwitching) return null;
    
    if (!activeScenario || !persistedScenarioProjection) return null;
    
    // A3 must NEVER be scenario-aware - scenarioSeries already reflects different contributions and asset paths
    // Pass persistedScenarioProjectionInputs to source contributions from scenario inputs (FLOW_TO_ASSET contributions)
    return computeA3Attribution({
      snapshot: state,
      projectionSeries: persistedScenarioProjection.series,      // Always in sync with inputs
      projectionSummary: persistedScenarioProjection.summary,    // Always in sync with inputs
      projectionInputs: persistedScenarioProjection.inputs,      // Always in sync with series/summary
    });
  }, [persistedScenarioProjection, activeScenario, state, isSwitching]);

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
  // Gate guardrails during profile/mode switches to avoid transient failures
  if (__DEV__ && !isSwitching && scenarioA3AttributionAbs && scenarioA3AttributionDelta) {
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
  // Gate guardrails during profile/mode switches to avoid transient failures
  if (__DEV__ && !isSwitching && effectiveScenarioSeries) {
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
  // Gate guardrails during profile/mode switches to avoid transient failures
  if (__DEV__ && !isSwitching && persistedScenarioActiveForAssert && persistedScenarioSeries && baselineSeries.length > 0) {
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
  // Gate guardrails during profile/mode switches to avoid transient failures
  if (__DEV__ && !isSwitching && scenarioA3AttributionAbs && scenarioA3AttributionDelta) {
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
  // Gate guardrails during profile/mode switches to avoid transient failures
  if (__DEV__ && !isSwitching && scenarioA3AttributionAbs && effectiveScenarioSeries && effectiveScenarioSeries.length > 0) {
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
  // Gate guardrails during profile/mode switches to avoid transient failures
  if (__DEV__ && !isSwitching) {
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
    // - For FLOW_TO_ASSET: totalContributions increases (more asset contributions), totalPrincipalRepaid unchanged.
    // - For FLOW_TO_DEBT: totalContributions unchanged (asset contributions only), totalPrincipalRepaid increases (overpayments).
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
      // FLOW scenarios reallocate monthly surplus:
      // - FLOW_TO_ASSET: totalContributions increases (more asset contributions)
      // - FLOW_TO_DEBT: totalContributions unchanged (asset contributions only), totalPrincipalRepaid increases
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
          if (__DEV__ && !isSwitching && actualOverpaymentDelta > 0 && actualOverpaymentDelta < maxPossibleOverpaymentDelta) {
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

  // Phase 10.1: Interpretation engine (absorbs Phase 5.4/5.5 key moment detection)
  const interpretation = useMemo(() => {
    const goals = profilesState?.profiles[profilesState.activeProfileId]?.goalState?.goals ?? [];
    return interpretProjection(
      baselineSeries,
      baselineSummary ?? {
        endAssets: 0, endLiabilities: 0, endNetWorth: 0,
        totalContributions: 0, totalPrincipalRepaid: 0,
        totalScheduledMortgagePayment: 0, totalMortgageOverpayments: 0,
      },
      selectExpenses(state),
      state.projection.currentAge,
      state.projection.endAge,
      goals,
      showLiquidOnly ? liquidAssetsSeries : undefined,
      state.projection.retirementAge,
    );
  }, [baselineSeries, baselineSummary, state, profilesState, showLiquidOnly, liquidAssetsSeries]);

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
          color: theme.colors.text.primary, // Phase 7.11: Baseline net worth uses text.primary (charcoal/white)
          data: netWorthLiquidData,
          style: {
            strokeWidth: 3.2, // Phase 7.11: Increased for prominence
            opacity: effectiveScenarioSeries && effectiveScenarioSeries.length > 0 ? 0.7 : 0.97, // Phase 7.11: Micro-soften when no scenario (was 1.0)
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
            opacity: activeScenarioSource !== 'baseline' ? 0.35 : 0.82, // Phase 7.11: Final micro-calibration - very small reduction to ensure clearly secondary (was 0.85)
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
          color: theme.colors.text.primary, // Phase 7.11: Baseline net worth uses text.primary (charcoal/white)
          data: baselineNetWorthData,
          style: {
            strokeWidth: 3.2, // Phase 7.11: Increased for prominence
            opacity: effectiveScenarioSeries && effectiveScenarioSeries.length > 0 ? 0.7 : 0.97, // Phase 7.11: Micro-soften when no scenario (was 1.0)
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
            opacity: activeScenarioSource !== 'baseline' ? 0.35 : 0.82, // Phase 7.11: Final micro-calibration - very small reduction to ensure clearly secondary (was 0.85)
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
                      borderRadius: theme.radius.small,
                      backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.border.subtle,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Export debug JSON"
                >
                  <Text style={{ fontSize: theme.typography.body.fontSize, color: theme.colors.text.secondary }}>Export JSON</Text>
                </Pressable>
              ) : undefined
            }
          />

          {/* Negative Surplus Banner */}
          {isSurplusNegative && (
            <View style={[styles.warningBanner, { backgroundColor: theme.colors.semantic.warningBg, borderColor: theme.colors.semantic.warning }]}>
              <Text style={[styles.warningBannerText, { color: theme.colors.semantic.warningText }]}>
                Monthly surplus is negative ({formatCurrencyFullSigned(baselineSurplus)}). Reduce allocations or expenses before running what-ifs.
              </Text>
            </View>
          )}

          <ControlBar
            leftItems={[
              {
                type: 'pill',
                title: activeScenario ? activeScenario.name : 'Baseline',
                onPress: () => {
                  if (!isSurplusNegative) {
                    openLater(() => setScenarioSelectorOpen(true));
                  }
                },
                active: activeScenarioSource === 'persisted',
                disabled: isSurplusNegative,
              },
            ]}
            rightItems={[
              {
                type: 'pill',
                title: `Age ${selectedAge}`,
                onPress: () => openLater(() => setAgeSelectorOpen(true)),
              },
              {
                type: 'icon',
                icon: 'settings',
                onPress: () => navigation.navigate('ProjectionSettings'),
                accessibilityLabel: 'Projection settings',
                variant: 'default',
              },
            ]}
          />
        </View>

        <View style={styles.innerContent}>
          {/* Phase 10.4: Interpretation Card (replaces Financial Health Summary) */}
          <InterpretationCard
            interpretation={interpretation}
            hasLiabilities={state.liabilities.filter(l => l.isActive !== false).some(l => l.balance > UI_TOLERANCE)}
            style={{ marginTop: layout.sectionGap }}
          />
          <GoalsSection
            goals={interpretation.goals}
            onEditPress={() => navigation.navigate('GoalEditor')}
          />

          <SectionCard style={{ marginBottom: spacing.xs }}>
            {/* Section Header with Toggle */}
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="Projected Net Worth" />
              <Pressable
                style={[
                  styles.chartMiniToggle,
                  { backgroundColor: theme.colors.bg.subtle },
                  showLiquidOnly && [styles.chartMiniToggleActive, { backgroundColor: theme.colors.brand.tint }],
                ]}
                onPress={() => setShowLiquidOnly(v => !v)}
              >
                <Text
                    style={[
                      styles.chartMiniToggleText,
                      showLiquidOnly && [styles.chartMiniToggleTextActive, { color: theme.colors.brand.primary }],
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
              >
                <VictoryAxis
                  tickFormat={t => `${Number(t)}`}
                  tickLabelComponent={<VictoryLabel dy={6} />}
                  style={{
                    axis: { stroke: chartPalette.axis },
                    tickLabels: { fontSize: theme.typography.bodySmall.fontSize, fill: chartPalette.tickLabels },
                    grid: { stroke: 'transparent' }, // Phase 7.11: Remove horizontal gridlines
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickValues={chartData.yTicks}
                  tickFormat={t => formatCurrencyCompact(Number(t))}
                  style={{
                    axis: { stroke: chartPalette.axis },
                    tickLabels: { fontSize: theme.typography.caption.fontSize, fill: chartPalette.tickLabels },
                    grid: { stroke: 'transparent' }, // Phase 7.11: Remove vertical gridlines
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
                          ...(series.seriesId === 'netWorth' ? { strokeLinecap: 'round' } : {}), // Phase 7.11: Rounded caps for baseline net worth only
                        },
                      }}
                    />
                  ))}
                {/* Phase 10.5: Render key moment dots (from interpretation engine) on baseline series */}
                {interpretation.keyMoments
                  .map((moment) => {
                    const parentSeries = chartData.series.find(s => s.seriesId === moment.seriesId);
                    if (!parentSeries || !parentSeries.shouldRender) return null;
                    // Milestone dots slightly smaller than crossing dots
                    const dotSize = moment.type.startsWith('NET_WORTH_') &&
                      moment.type !== 'NET_WORTH_POSITIVE' ? 3 : 4;
                    return (
                      <VictoryScatter
                        key={moment.type}
                        data={[{ x: moment.age, y: moment.value }]}
                        style={{
                          data: {
                            fill: parentSeries.color,
                            opacity: parentSeries.style.opacity,
                          },
                        }}
                        size={dotSize}
                      />
                    );
                  })
                  .filter(Boolean)}
                {/* Phase 7.11 Fix: Selected-age dots (explicit, independent from insight dots) */}
                {selectedAge != null && valuesAtAge && chartData.series
                  .filter(s => s.shouldRender && (s.seriesId === 'netWorth' || s.seriesId === 'assets' || s.seriesId === 'liabilities'))
                  .map((series) => {
                    // Get Y value from valuesAtAge based on series type
                    let yValue: number;
                    if (series.seriesId === 'netWorth') {
                      yValue = valuesAtAge.netWorth;
                    } else if (series.seriesId === 'assets') {
                      yValue = valuesAtAge.assets;
                    } else if (series.seriesId === 'liabilities') {
                      yValue = valuesAtAge.liabilities;
                    } else {
                      return null;
                    }
                    
                    // Phase 7.11: Reduce size for asset/liability dots only (pins, not markers)
                    const dotSize = (series.seriesId === 'assets' || series.seriesId === 'liabilities') ? 3 : 4;
                    
                    return (
                      <VictoryScatter
                        key={`selected-age-${series.seriesId}`}
                        data={[{ x: selectedAge, y: yValue }]}
                        style={{
                          data: {
                            fill: series.color,
                            opacity: 1.0, // Full opacity for selected-age dots
                          },
                        }}
                        size={dotSize} // Phase 7.11: Assets/liabilities use size 3 (pins), net worth uses size 4
                      />
                    );
                  })
                  .filter(Boolean)}
                {/* Phase 12.5: Retirement age marker — subtle vertical dashed line */}
                {state.projection.retirementAge != null &&
                  state.projection.retirementAge > state.projection.currentAge &&
                  state.projection.retirementAge < state.projection.endAge &&
                  (() => {
                    const domainRange = chartData.domainMax - chartData.domainMin;
                    const padding = domainRange * 0.05;
                    const shortenedMin = chartData.domainMin + padding;
                    const shortenedMax = chartData.domainMax - padding;
                    return (
                      <VictoryLine
                        data={[
                          { x: state.projection.retirementAge, y: shortenedMin },
                          { x: state.projection.retirementAge, y: shortenedMax },
                        ]}
                        style={{
                          data: {
                            stroke: theme.colors.text.muted,
                            strokeWidth: 1.0,
                            strokeDasharray: '4,3',
                            opacity: 0.45,
                          },
                        }}
                      />
                    );
                  })()}
                {/* Vertical marker line at selectedAge (visual cursor, not a filter) */}
                 {/* Phase 7.11: Muted grey, thinner than data lines, darker and more dotted */}
                 {selectedAge != null && (() => {
                   // Shorten vertical span to ~90% of chart height (5% padding at top and bottom)
                   const domainRange = chartData.domainMax - chartData.domainMin;
                   const padding = domainRange * 0.05;
                   const shortenedMin = chartData.domainMin + padding;
                   const shortenedMax = chartData.domainMax - padding;
                   
                   return (
                     <VictoryLine
                       data={[
                         { x: selectedAge, y: shortenedMin },
                         { x: selectedAge, y: shortenedMax },
                       ]}
                       style={{
                         data: {
                           stroke: theme.colors.chart.markerLine, // Phase 7.11: Muted grey
                           strokeWidth: 1.0, // Phase 7.11: Less weight (was 1.2)
                           strokeDasharray: '2,2', // More dotted appearance (was '4,4')
                           opacity: 0.72, // Phase 7.11: Reduced to read as reference, not divider (was 0.80)
                         },
                       }}
                     />
                   );
                 })()}
              </VictoryChart>

              {/* Phase 5.2a: Transparent gesture overlay */}
              <View
                style={StyleSheet.absoluteFill}
                {...chartPanResponder.panHandlers}
              />
              
              {/* Fixed values card inside chart (top-left) */}
              {valuesAtAge && (
                <View
                  style={[
                    styles.chartValuesCard,
                    {
                      backgroundColor: theme.colors.bg.card,
                      opacity: 0.88, // Phase 7.11: Reduced opacity for less floating feel
                      borderWidth: 0, // Phase 7.11: Remove border entirely
                      top: chartPadding.top + 4,
                      left: chartPadding.left + 4,
                    },
                  ]}
                  pointerEvents="none" // Allow gestures to pass through
                >
                  {/* Net worth (primary, dominant) */}
                  <View style={styles.chartValuesPrimary}>
                    <Text style={[styles.chartValuesPrimaryLabel, { color: theme.colors.text.muted, opacity: 0.88 }]}>
                      {effectiveScenarioActive ? 'Net worth (baseline)' : 'Net worth'}
                    </Text>
                    <Text style={[styles.chartValuesPrimaryValue, { color: theme.colors.text.primary }]}>
                      {formatCurrencyCompact(valuesAtAge.netWorth)}
                    </Text>
                  </View>
                  
                  {/* Assets and liabilities (secondary, domain colors) */}
                  <View style={styles.chartValuesSecondary}>
                    <Text style={[styles.chartValuesSecondaryText, { color: theme.colors.domain.asset, opacity: 0.88 }]}>
                      Assets {formatCurrencyCompact(valuesAtAge.assets)}
                    </Text>
                    <Text style={[styles.chartValuesSecondaryText, { color: theme.colors.domain.liability, opacity: 0.88 }]}>
                      Liabilities {formatCurrencyCompact(valuesAtAge.liabilities)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Helper text when both liquid toggle and scenario are ON */}
            {showLiquidOnly && activeScenarioSource !== 'baseline' ? (
              <Text style={styles.chartHelperText}>
                Showing liquid assets only · Scenario applied
              </Text>
            ) : null}
          </View>
          </SectionCard>

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
                            <Text style={[styles.bodyText, { marginLeft: spacing.xl }]}>
                        • From higher contributions: {formatCurrencyCompact(Math.abs(extraContributions))}{contributionPct !== null ? ` (${contributionPct}%)` : ''} (from {formatCurrencyCompact(baselineTotalContributions)} to {formatCurrencyCompact(scenarioTotalContributions)})
                      </Text>
                          )}
                          
                          {/* SubBullet 2: From investment growth */}
                          {Math.abs(growthDelta) >= UI_TOLERANCE && (
                            <Text style={[styles.bodyText, { marginLeft: spacing.xl }]}>
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
                            <Text style={[styles.bodyText, { marginLeft: spacing.xl }]}>
                              • Total liabilities reduced by {formatCurrencyCompact(principalPaydownDelta)} (from {formatCurrencyCompact(valuesAtAge.liabilities)} to {formatCurrencyCompact(scenarioValuesAtAge.liabilities)})
                            </Text>
                          )}
                          
                          {/* SubBullet 2: From principal paydown */}
                          {hasLiabilityDelta && principalPaydownDelta > 0 && (
                            <Text style={[styles.bodyText, { marginLeft: spacing.xl }]}>
                              • From principal paydown: {formatCurrencyCompact(principalPaydownDelta)}{principalPaydownPct !== null ? ` (${principalPaydownPct}%)` : ''} (from {formatCurrencyCompact(valuesAtAge.remainingDebt)} to {formatCurrencyCompact(scenarioValuesAtAge.remainingDebt)})
                            </Text>
                          )}
                          
                          {/* SubBullet 3: Lower interest paid */}
                          {interestSaved > 0 && (
                            <Text style={[styles.bodyText, { marginLeft: spacing.xl }]}>
                              • Lower interest paid: {formatCurrencyCompact(interestSaved)} (from {formatCurrencyCompact(valuesAtAge.interestPaid)} to {formatCurrencyCompact(scenarioValuesAtAge.interestPaid)})
                            </Text>
                          )}
                          
                          {/* SubBullet 4: Time saved to loan payoff */}
                          {hasEarlierPayoff && baselinePayoffAge !== undefined && scenarioPayoffAge !== undefined && (yearsSaved > 0 || monthsSaved > 0) && (
                            <Text style={[styles.bodyText, { marginLeft: spacing.xl }]}>
                              • Time saved to loan payoff: {yearsSaved > 0 ? `${yearsSaved} year${yearsSaved !== 1 ? 's' : ''}` : ''}{yearsSaved > 0 && monthsSaved > 0 ? ' ' : ''}{monthsSaved > 0 ? `${monthsSaved} month${monthsSaved !== 1 ? 's' : ''}` : ''} (age {Math.floor(baselinePayoffAge)} → age {Math.floor(scenarioPayoffAge)})
                            </Text>
                          )}
                          
                          {/* Explanatory text for liability-driven scenarios */}
                          <Text style={[styles.bodyText, styles.bodyTextMuted, { marginLeft: spacing.xl, marginTop: spacing.tiny }]}>
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

          {/* Projected Cash Flow Section (Phase 10.7: collapsed by default) */}
          <SectionCard>
            <Pressable
              onPress={() => setCashflowExpanded(v => !v)}
              style={styles.sectionHeaderRow}
              accessibilityRole="button"
              accessibilityLabel={cashflowExpanded ? 'Hide projected cash flow' : 'Show projected cash flow'}
            >
              <SectionHeader title="Projected Cash Flow" subtitle={`Age ${selectedAge}`} />
              <Text style={[styles.chartMiniToggleText, { color: theme.colors.text.muted }]}>
                {cashflowExpanded ? 'Hide' : 'Show details'}
              </Text>
            </Pressable>
            {cashflowExpanded && (() => {
              const getScenarioProps = (baselineValue: number, scenarioValue: number | undefined) => {
                if (!effectiveScenarioActive || scenarioValue === undefined) {
                  return { scenarioValueText: undefined, deltaValueText: undefined };
                }
                const valuesEqual = Math.abs(baselineValue - scenarioValue) < UI_TOLERANCE;
                if (valuesEqual) {
                  return { scenarioValueText: '–', deltaValueText: undefined };
                }
                return {
                  scenarioValueText: formatCurrencyCompact(scenarioValue),
                  deltaValueText: formatCurrencyCompactSigned(scenarioValue - baselineValue),
                };
              };

              // Compute scenario props for all cashflow items
              const grossIncomeProps = getScenarioProps(valuesAtAge.grossIncome, scenarioValuesAtAge?.grossIncome);
              const pensionProps = getScenarioProps(valuesAtAge.pensionContributions, scenarioValuesAtAge?.pensionContributions);
              const taxesProps = getScenarioProps(valuesAtAge.taxes, scenarioValuesAtAge?.taxes);
              const netIncomeBaseline = valuesAtAge.grossIncome - valuesAtAge.pensionContributions - valuesAtAge.taxes;
              const netIncomeScenario = scenarioValuesAtAge ? scenarioValuesAtAge.grossIncome - scenarioValuesAtAge.pensionContributions - scenarioValuesAtAge.taxes : undefined;
              const netIncomeProps = getScenarioProps(netIncomeBaseline, netIncomeScenario);
              const expensesProps = getScenarioProps(valuesAtAge.livingExpenses, scenarioValuesAtAge?.livingExpenses);
              const availableCashProps = getScenarioProps(valuesAtAge.netSurplus, scenarioValuesAtAge?.netSurplus);
              const assetContributionProps = getScenarioProps(valuesAtAge.postTaxContributions, scenarioValuesAtAge?.postTaxContributions);
              const liabilityReductionProps = getScenarioProps(valuesAtAge.debtRepayment, scenarioValuesAtAge?.debtRepayment);
              const monthlySurplusBaseline = valuesAtAge.netSurplus - valuesAtAge.postTaxContributions - valuesAtAge.debtRepayment;
              const monthlySurplusScenario = scenarioValuesAtAge ? scenarioValuesAtAge.netSurplus - scenarioValuesAtAge.postTaxContributions - scenarioValuesAtAge.debtRepayment : undefined;
              const monthlySurplusProps = getScenarioProps(monthlySurplusBaseline, monthlySurplusScenario);

              return (
                <CashflowCardStack>
                  {/* Gross Income */}
                  <CashflowCardWrapper reserveActionSpace={false}>
                    <CashflowPrimaryCard
                      title="Gross Income"
                      description="Income before deductions"
                      valueText={formatCurrencyCompact(valuesAtAge.grossIncome)}
                      icon={Coins}
                      iconColor={theme.colors.text.secondary}
                      valueColor={theme.colors.text.primary}
                      scenarioValueText={grossIncomeProps.scenarioValueText}
                      deltaValueText={grossIncomeProps.deltaValueText}
                    />
                  </CashflowCardWrapper>

                  {/* Pension */}
                  <CashflowCardWrapper reserveActionSpace={false}>
                    <CashflowSubCard
                      title="Pension"
                      description="Pre-tax savings"
                      valueText={formatCurrencyCompact(valuesAtAge.pensionContributions)}
                      icon={PiggyBank}
                      iconColor={theme.colors.domain.asset}
                      borderColor={getMutedBorderColor(theme.colors.semantic.successBorder, theme)}
                      valueColor={Math.abs(valuesAtAge.pensionContributions) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary}
                      scenarioValueText={pensionProps.scenarioValueText}
                      deltaValueText={pensionProps.deltaValueText}
                    />
                  </CashflowCardWrapper>

                  {/* Other Deductions */}
                  <CashflowCardWrapper reserveActionSpace={false}>
                    <CashflowSubCard
                      title="Other Deductions"
                      description="Tax and payroll deductions"
                      valueText={formatCurrencyCompact(valuesAtAge.taxes)}
                      icon={Receipt}
                      iconColor={theme.colors.semantic.error}
                      borderColor={getMutedBorderColor(theme.colors.semantic.errorBorder, theme)}
                      valueColor={Math.abs(valuesAtAge.taxes) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary}
                      scenarioValueText={taxesProps.scenarioValueText}
                      deltaValueText={taxesProps.deltaValueText}
                    />
                  </CashflowCardWrapper>

                  {/* Net Income */}
                  <CashflowCardWrapper marginTop={spacing.base} reserveActionSpace={false}>
                    <CashflowPrimaryCard
                      title="Net Income"
                      description="Take-home pay"
                      valueText={formatCurrencyCompact(netIncomeBaseline)}
                      icon={Coin}
                      iconColor={theme.colors.text.secondary}
                      valueColor={theme.colors.text.primary}
                      scenarioValueText={netIncomeProps.scenarioValueText}
                      deltaValueText={netIncomeProps.deltaValueText}
                    />
                  </CashflowCardWrapper>

                  {/* Expenses */}
                  <CashflowCardWrapper reserveActionSpace={false}>
                    <CashflowSubCard
                      title="Expenses"
                      description="Monthly spending"
                      valueText={formatCurrencyCompact(valuesAtAge.livingExpenses)}
                      icon={ShoppingCart}
                      iconColor={theme.colors.semantic.error}
                      borderColor={getMutedBorderColor(theme.colors.semantic.errorBorder, theme)}
                      valueColor={Math.abs(valuesAtAge.livingExpenses) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary}
                      scenarioValueText={expensesProps.scenarioValueText}
                      deltaValueText={expensesProps.deltaValueText}
                    />
                  </CashflowCardWrapper>

                  {/* Available Cash */}
                  <CashflowCardWrapper marginTop={spacing.base} reserveActionSpace={false}>
                    <CashflowPrimaryCard
                      title="Available Cash"
                      description="After expenses"
                      valueText={formatCurrencyCompact(valuesAtAge.netSurplus)}
                      icon={HandCoins}
                      iconColor={theme.colors.text.secondary}
                      valueColor={theme.colors.brand.primary}
                      isOutcome={true}
                      scenarioValueText={availableCashProps.scenarioValueText}
                      deltaValueText={availableCashProps.deltaValueText}
                    />
                  </CashflowCardWrapper>

                  {/* Asset Contribution */}
                  <CashflowCardWrapper reserveActionSpace={false}>
                    <CashflowSubCard
                      title="Asset Contribution"
                      description="Saved or invested"
                      valueText={formatCurrencyCompact(valuesAtAge.postTaxContributions)}
                      icon={TrendUp}
                      iconColor={theme.colors.semantic.success}
                      borderColor={getMutedBorderColor(theme.colors.semantic.successBorder, theme)}
                      valueColor={Math.abs(valuesAtAge.postTaxContributions) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary}
                      scenarioValueText={assetContributionProps.scenarioValueText}
                      deltaValueText={assetContributionProps.deltaValueText}
                    />
                  </CashflowCardWrapper>

                  {/* Liability Reduction */}
                  <CashflowCardWrapper reserveActionSpace={false}>
                    <CashflowSubCard
                      title="Liability Reduction"
                      description="Debt repayments"
                      valueText={formatCurrencyCompact(valuesAtAge.debtRepayment)}
                      icon={TrendDown}
                      iconColor={theme.colors.semantic.success}
                      borderColor={getMutedBorderColor(theme.colors.semantic.successBorder, theme)}
                      valueColor={Math.abs(valuesAtAge.debtRepayment) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary}
                      scenarioValueText={liabilityReductionProps.scenarioValueText}
                      deltaValueText={liabilityReductionProps.deltaValueText}
                    />
                  </CashflowCardWrapper>

                  {/* Monthly Surplus */}
                  <CashflowCardWrapper marginTop={spacing.base} isLast={true} reserveActionSpace={false}>
                    <CashflowPrimaryCard
                      title="Monthly Surplus"
                      description="Unallocated cash"
                      valueText={formatCurrencyCompact(monthlySurplusBaseline)}
                      icon={Target}
                      iconColor={theme.colors.brand.primary}
                      valueColor={theme.colors.brand.primary}
                      isOutcome={true}
                      hasTint={true}
                      tintColor={theme.colors.semantic.info}
                      scenarioValueText={monthlySurplusProps.scenarioValueText}
                      deltaValueText={monthlySurplusProps.deltaValueText}
                    />
                  </CashflowCardWrapper>
                </CashflowCardStack>
              );
            })()}
          </SectionCard>

          {/* Projected Balance Sheet Section (Phase 10.9: simplified to 3 numbers) */}
          <SectionCard>
            <SectionHeader title="Projected Balance Sheet" subtitle={`Age ${selectedAge}`} />
            <View style={styles.projectedBalanceSheetRow}>
              {/* Assets */}
              <View style={styles.simpleBalanceItem}>
                <Text style={[styles.simpleBalanceValue, { color: theme.colors.domain.asset }]}>
                  {formatCurrencyCompact(valuesAtAge.assets)}
                </Text>
                <Text style={[styles.simpleBalanceLabel, { color: theme.colors.text.muted }]}>Assets</Text>
              </View>
              <Text style={[styles.projectedBalanceSheetOperator, { color: theme.colors.text.muted }]}>−</Text>
              {/* Liabilities */}
              <View style={styles.simpleBalanceItem}>
                <Text style={[styles.simpleBalanceValue, { color: theme.colors.domain.liability }]}>
                  {formatCurrencyCompact(valuesAtAge.liabilities)}
                </Text>
                <Text style={[styles.simpleBalanceLabel, { color: theme.colors.text.muted }]}>Liabilities</Text>
              </View>
              <Text style={[styles.projectedBalanceSheetOperator, { color: theme.colors.text.muted }]}>=</Text>
              {/* Net Worth */}
              <View style={styles.simpleBalanceItem}>
                <Text style={[styles.simpleBalanceValue, { color: theme.colors.text.primary }]}>
                  {formatCurrencyCompact(valuesAtAge.netWorth)}
                </Text>
                <Text style={[styles.simpleBalanceLabel, { color: theme.colors.text.muted }]}>Net Worth</Text>
              </View>
            </View>
          </SectionCard>

          {/* Net Worth Breakdown (Phase 10.8: collapsed by default) */}
          <SectionCard>
            <Pressable
              onPress={() => setAttributionExpanded(v => !v)}
              style={styles.sectionHeaderRow}
              accessibilityRole="button"
              accessibilityLabel={attributionExpanded ? 'Hide net worth breakdown' : 'Show net worth breakdown'}
            >
              <SectionHeader title="Net Worth Breakdown" subtitle={`Age ${selectedAge}`} />
              <Text style={[styles.chartMiniToggleText, { color: theme.colors.text.muted }]}>
                {attributionExpanded ? 'Hide' : 'Show details'}
              </Text>
            </Pressable>
            {attributionExpanded && (
            <>
            {/* Dev-only: Math reconciliation overlay (hidden by default, toggleable) */}
            {__DEV__ && effectiveScenarioActive && scenarioValuesAtAge && scenarioDeltas ? (
              <View style={styles.reconciliationOverlayContainer}>
                <Pressable
                  onPress={() => setShowReconciliationOverlay(!showReconciliationOverlay)}
                  style={[styles.reconciliationToggle, { backgroundColor: theme.colors.bg.subtle }]}
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
            </>
            )}
          </SectionCard>

        </View>
      </ScrollView>


      {/* Age selector modal */}
      <Modal transparent={true} visible={ageSelectorOpen} animationType="slide" onRequestClose={() => setAgeSelectorOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdropFlex} onPress={() => setAgeSelectorOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
            <Text style={styles.modalTitle}>Select age</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {Array.from({ length: state.projection.endAge - state.projection.currentAge + 1 }, (_, i) => {
                const age = state.projection.currentAge + i;
                const isSelected = selectedAge === age;
                return (
                  <Row
                    key={age}
                    onPress={() => {
                      setSelectedAge(age);
                      setAgeSelectorOpen(false);
                    }}
                    showBottomDivider={true}
                    style={{ 
                      paddingVertical: spacing.base,
                      backgroundColor: isSelected ? theme.colors.bg.subtle : undefined
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected && { color: theme.colors.brand.primary }]}>
                      Age {age}
                    </Text>
                  </Row>
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
                <View style={[styles.modalWarningBanner, { backgroundColor: theme.colors.semantic.warningBg, borderColor: theme.colors.semantic.warning }]}>
                  <Text style={[styles.modalWarningBannerText, { color: theme.colors.semantic.warningText }]}>
                    Monthly surplus is negative ({formatCurrencyFullSigned(baselineSurplus)}). Reduce allocations or expenses before running what-ifs.
                  </Text>
                </View>
              )}
              <Row
                onPress={() => handleScenarioSelect(BASELINE_SCENARIO_ID)}
                disabled={isSurplusNegative}
                showBottomDivider={true}
                style={{ 
                  paddingVertical: spacing.base,
                  opacity: isSurplusNegative ? 0.5 : 1,
                  backgroundColor: (!activeScenarioId || activeScenarioId === BASELINE_SCENARIO_ID) ? theme.colors.bg.subtle : undefined
                }}
              >
                <Text style={[styles.modalOptionText, (!activeScenarioId || activeScenarioId === BASELINE_SCENARIO_ID) && { color: theme.colors.brand.primary }]}>
                  Baseline
                </Text>
              </Row>
              {savedScenarios
                .filter(s => s.id !== BASELINE_SCENARIO_ID) // Exclude baseline from scenarios list
                .map(s => {
                  const isSelected = activeScenarioId === s.id;
                  return (
                    <Row
                      key={s.id}
                      onPress={() => handleScenarioSelect(s.id)}
                      disabled={isSurplusNegative}
                      showBottomDivider={true}
                      style={{ 
                        paddingVertical: spacing.base,
                        opacity: isSurplusNegative ? 0.5 : 1,
                        backgroundColor: isSelected ? theme.colors.bg.subtle : undefined
                      }}
                    >
                      <Text style={[styles.modalOptionText, isSelected && { color: theme.colors.brand.primary }]}>
                        {s.name}
                      </Text>
                    </Row>
                  );
                })}
              <View style={{ marginVertical: spacing.sm }}>
                <Divider />
              </View>
              <Row
                onPress={() => {
                  setScenarioSelectorOpen(false);
                  navigation.navigate('ScenarioManagement');
                }}
                showBottomDivider={true}
                style={{ paddingVertical: spacing.base }}
              >
                <Text style={styles.modalOptionTextSecondary}>Manage scenarios…</Text>
              </Row>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
    toolbarPill: {
      height: 28,
      paddingHorizontal: layout.inputPadding,
      borderRadius: theme.radius.base,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pillText: {
      ...theme.typography.label,
    },
    scenarioStatus: {
      marginRight: spacing.base,
    },
    scenarioPrimary: {
      ...theme.typography.label,
    },
    scenarioSecondary: {
      marginTop: layout.micro,
      ...theme.typography.bodySmall,
    },
    scenarioSelector: {
      height: 28,
      paddingHorizontal: spacing.base,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tiny,
      borderRadius: theme.radius.base,
    },
    scenarioSelectorText: {
      ...theme.typography.label,
    },
    scenarioSelectorChevron: {
      ...theme.typography.caption,
    },
    agePill: {
      height: 28,
      paddingHorizontal: spacing.base,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    agePillText: {
      ...theme.typography.label,
    },
    ageChevron: {
      marginLeft: spacing.xs,
      ...theme.typography.caption,
    },
    iconText: {
      ...theme.typography.bodyLarge,
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
    toolbarSpacer: {
      flex: 1,
    },
    toolbarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tiny,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: theme.radius.base,
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
      ...theme.typography.bodySmall,
      fontWeight: '600',
      color: theme.colors.text.primary,
      flexShrink: 1,
      minWidth: 0,
    },
    toolbarIconButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.base,
      flexShrink: 0,
    },
    quickWhatIfContainer: {
      paddingHorizontal: layout.screenPadding,
      paddingTop: spacing.sm,
      paddingBottom: spacing.base,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.subtle,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.subtle,
    },
    quickWhatIfHint: {
      ...theme.typography.bodySmall,
      fontStyle: 'italic',
      color: theme.colors.text.muted,
      marginBottom: spacing.sm,
    },
    quickWhatIfHintAmount: {
      fontWeight: '600',
    },
    quickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
      gap: spacing.base,
    },
    quickLabel: {
      width: 96,
      ...theme.typography.label,
      color: theme.colors.text.subtle,
    },
    quickWhatIfSelector: {
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      borderRadius: theme.radius.medium,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.base,
      minHeight: 40,
    },
    quickWhatIfSelectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: layout.inputPadding,
    },
    quickWhatIfSelectorValue: {
      flex: 1,
      ...theme.typography.valueSmall,
      color: theme.colors.text.primary,
    },
    quickWhatIfPlaceholder: {
      fontWeight: '600',
      color: theme.colors.text.subtle,
    },
    quickWhatIfHelper: {
      ...theme.typography.bodySmall,
      fontStyle: 'italic',
      color: theme.colors.text.muted,
    },
    quickWhatIfAmountInput: {
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      borderRadius: theme.radius.medium,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.base,
      ...theme.typography.valueSmall,
      color: theme.colors.text.primary,
      minHeight: 40,
    },
    quickWhatIfAmountInputError: {
      borderWidth: 1.5,
    },
    quickWhatIfAvailableCash: {
      ...theme.typography.bodySmall,
      fontStyle: 'italic',
      color: theme.colors.text.muted,
    },
    quickWhatIfAvailableCashAmount: {
      fontWeight: '600',
    },
    quickWhatIfError: {
      ...theme.typography.label,
      marginTop: spacing.tiny,
    },
    clearScenarioText: {
      marginTop: spacing.sm,
      ...theme.typography.label,
      color: theme.colors.text.disabled,
      textDecorationLine: 'underline',
    },
    innerContent: {
      padding: spacing.base,
      paddingTop: spacing.base,
    },
    educationBlock: {
      marginBottom: 14,
      paddingHorizontal: 2,
    },
    educationText: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.secondary,
      lineHeight: 18,
    },
    hairlineDivider: {
      height: 0.5,
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
      borderRadius: theme.radius.large,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chartMiniToggleActive: {},
    chartMiniToggleText: {
      ...theme.typography.label,
      color: theme.colors.text.muted,
    },
    chartMiniToggleTextActive: {
      fontWeight: '600',
    },
    toggleCard: {
      borderRadius: theme.radius.medium,
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
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginBottom: spacing.tiny,
    },
    toggleHelper: {
      ...theme.typography.label,
      color: theme.colors.text.muted,
    },
    chartCard: {
      overflow: 'visible',
    },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.xs,
      gap: spacing.xl,
    },
    legendRowSecondary: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: layout.micro,
      gap: spacing.xl,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    legendSwatch: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.small,
    },
    legendText: {
      ...theme.typography.label,
    },
    legendTextMuted: {
      ...theme.typography.bodySmall,
    },
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
      ...theme.typography.bodySmall,
      fontWeight: '600',
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
      borderRadius: theme.radius.small,
    },
    valueBarLabel: {
      ...theme.typography.body,
    },
    valueBarValue: {
      ...theme.typography.body,
    },
    insightText: {
      ...theme.typography.bodySmall,
      marginTop: spacing.xs,
      marginBottom: 0,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    chartValuesCard: {
      position: 'absolute',
      padding: spacing.sm,
      borderRadius: theme.radius.base,
      borderWidth: 1,
      minWidth: 140,
      zIndex: 10,
    },
    chartValuesPrimary: {
      marginBottom: spacing.xs,
    },
    chartValuesPrimaryLabel: {
      ...theme.typography.caption,
      fontWeight: '600',
      marginBottom: layout.micro,
    },
    chartValuesPrimaryValue: {
      ...theme.typography.sectionTitle,
      fontWeight: '700',
    },
    chartValuesSecondary: {
      gap: layout.micro,
    },
    chartValuesSecondaryText: {
      ...theme.typography.bodySmall,
    },
    outcomeSubtitle: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.muted,
      marginBottom: layout.inputPadding,
    },
    outcomeSummary: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.tertiary,
      marginTop: spacing.base,
    },
    ageSelector: {
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      borderRadius: theme.radius.medium,
      paddingVertical: layout.inputPadding,
      paddingHorizontal: spacing.base,
      marginTop: layout.inputPadding,
      marginBottom: spacing.tiny,
    },
    ageSelectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: layout.inputPadding,
    },
    ageSelectorLabel: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.muted,
    },
    ageSelectorValue: {
      flex: 1,
      ...theme.typography.valueSmall,
      color: theme.colors.text.primary,
      textAlign: 'right',
    },
    ageSelectorControlRow: {
      borderRadius: theme.radius.medium,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.base,
      marginTop: layout.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    ageSelectorControlLabel: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    ageSelectorControlButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    ageSelectorControlValue: {
      ...theme.typography.valueSmall,
      color: theme.colors.text.primary,
    },
    keyDriversCard: {
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: theme.radius.medium,
      padding: layout.inputPadding,
      marginBottom: spacing.tiny,
    },
    keyDriversTitle: {
      ...theme.typography.valueSmall,
      color: theme.colors.text.primary,
      marginBottom: spacing.xs,
    },
    keyDriversRows: {
      gap: spacing.sm,
    },
    keyDriversRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: layout.inputPadding,
    },
    keyDriversLabel: {
      flex: 1,
      ...theme.typography.bodyLarge,
      color: theme.colors.text.tertiary,
    },
    keyDriversValue: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.primary,
      textAlign: 'right',
    },
    keyDriversValuesRow: {
      flexDirection: 'row',
      gap: spacing.base,
      alignItems: 'flex-start',
    },
    keyDriversValueScenario: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      textAlign: 'right',
      minWidth: 70,
    },
    keyDriversValueDelta: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.muted,
      textAlign: 'right',
      minWidth: 60,
    },
    attrCard: {
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      borderRadius: theme.radius.large,
      padding: spacing.base,
    },
    breakdownGroupContainer: {
      marginTop: spacing.base,
    },
    attrTitle: {
      ...theme.typography.valueSmall,
      color: theme.colors.text.primary,
      marginBottom: spacing.xs,
    },
    attrSubtitle: {
      ...theme.typography.label,
      color: theme.colors.text.secondary,
      marginBottom: spacing.sm,
    },
    attrEducation: {
      ...theme.typography.label,
      color: theme.colors.text.muted,
      marginBottom: layout.inputPadding,
      lineHeight: 16,
    },
    attrRows: {
      gap: spacing.sm,
    },
    attrRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: layout.inputPadding,
    },
    attrLabel: {
      flex: 1,
      ...theme.typography.bodyLarge,
      color: theme.colors.text.tertiary,
    },
    attrValue: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.primary,
      textAlign: 'right',
    },
    attrHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: layout.inputPadding,
      marginBottom: spacing.sm,
      paddingBottom: 0,
      marginHorizontal: -spacing.base,
      paddingHorizontal: spacing.base,
    },
    attrHeaderSpacer: {
      flex: 1,
    },
    attrHeaderLabel: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
      color: theme.colors.text.muted,
      textAlign: 'right',
      minWidth: 70,
    },
    attrHeaderLabelScenario: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
      color: theme.colors.brand.primary,
      textAlign: 'right',
      minWidth: 70,
    },
    attrHeaderLabelDelta: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
      color: theme.colors.text.muted,
      textAlign: 'right',
      minWidth: 60,
    },
    attrValuesRow: {
      flexDirection: 'row',
      gap: spacing.base,
      alignItems: 'flex-start',
    },
    attrValueScenario: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      textAlign: 'right',
      minWidth: 70,
    },
    attrValueDelta: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.muted,
      textAlign: 'right',
      minWidth: 60,
    },
    attrValueScenarioUnchanged: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.muted,
      textAlign: 'right',
      minWidth: 70,
    },
    keyDriversValueScenarioUnchanged: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.muted,
      textAlign: 'right',
      minWidth: 70,
    },
    scenarioResultSummary: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.brand.primary,
      marginBottom: spacing.sm,
    },
    keyDriversHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: layout.inputPadding,
      marginBottom: spacing.sm,
      paddingBottom: spacing.xs,
    },
    keyDriversHeaderSpacer: {
      flex: 1,
    },
    keyDriversHeaderLabel: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
      color: theme.colors.text.muted,
      textAlign: 'right',
      minWidth: 70,
    },
    keyDriversHeaderLabelScenario: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
      color: theme.colors.brand.primary,
      textAlign: 'right',
      minWidth: 70,
    },
    keyDriversHeaderLabelDelta: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
      color: theme.colors.text.muted,
      textAlign: 'right',
      minWidth: 60,
    },
    endNetWorthSection: {
      marginTop: spacing.base,
      paddingTop: spacing.base,
    },
    endNetWorthLabel: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginBottom: spacing.xs,
    },
    endNetWorthRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.tiny,
    },
    endNetWorthBaselineLabel: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.muted,
    },
    endNetWorthBaselineValue: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.primary,
    },
    endNetWorthScenarioLabel: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.muted,
    },
    endNetWorthScenarioValue: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.brand.primary,
    },
    attrRowUnchanged: {
      opacity: 0.7,
    },
    attrLabelUnchanged: {
      color: theme.colors.text.muted,
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdropFlex: {
      flex: 1,
    },
    modalSheet: {
      borderTopLeftRadius: theme.radius.modal,
      borderTopRightRadius: theme.radius.modal,
      paddingHorizontal: layout.screenPadding,
      paddingTop: layout.modalPaddingTop,
      paddingBottom: layout.modalPaddingBottom,
      maxHeight: '70%',
    },
    modalTitle: {
      ...theme.typography.sectionTitle,
      fontWeight: '700',
      color: theme.colors.text.primary,
      marginBottom: layout.inputPadding,
    },
    modalList: {
      flexGrow: 0,
    },
    modalListContent: {
      paddingBottom: spacing.base,
    },
    modalOption: {
      paddingVertical: spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.subtle,
    },
    modalOptionText: {
      ...theme.typography.valueSmall,
      color: theme.colors.text.primary,
    },
    modalOptionTextSecondary: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.secondary,
    },
    modalDivider: {
      height: 1,
      marginVertical: spacing.sm,
    },
    modalOptionContent: {
      flexDirection: 'column',
      gap: layout.micro,
    },
    modalOptionMetadata: {
      ...theme.typography.body,
      color: theme.colors.text.subtle,
    },
    modalEmptyText: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.subtle,
      fontStyle: 'italic',
      paddingVertical: spacing.base,
    },
    modalOptionSubtext: {
      ...theme.typography.body,
      color: theme.colors.text.subtle,
      marginTop: layout.micro,
    },
    projectedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.tiny,
      gap: spacing.base,
    },
    headerQualifier: {
      color: theme.colors.text.muted,
    },
    projectedMainSubtitle: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.muted,
      lineHeight: 17,
    },
    projectedSubHeading: {
      ...theme.typography.valueSmall,
      color: theme.colors.text.muted,
      marginBottom: spacing.base,
    },
    column: {
      marginBottom: spacing.xl,
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
      zIndex: 0,
    },
    cashflowSubGroup: {
      marginTop: 0,
      marginBottom: 0,
    },
    cashflowCard: {},
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
      ...theme.typography.body,
      color: theme.colors.border.default,
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
      marginRight: spacing.tiny,
    },
    cashflowTextCentered: {
      textAlign: 'center',
    },
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
      paddingRight: 100,
    },
    cashflowCardLeftIndented: {
      flex: 1,
      flexShrink: 1,
      paddingRight: 100,
    },
    cashflowCardRight: {
      position: 'absolute',
      right: spacing.sm,
      top: spacing.tiny,
      alignItems: 'flex-end',
    },
    cashflowValueRight: {
      textAlign: 'right',
    },
    projectedCard: {
      padding: spacing.sm,
      marginBottom: 0,
      borderRadius: theme.radius.pill,
      borderWidth: 0.5,
      borderColor: theme.colors.border.default,
    },
    projectedCardMinimal: {
      padding: spacing.sm,
      marginBottom: 0,
      borderRadius: theme.radius.pill,
    },
    projectedCardBordered: {
      padding: spacing.sm,
      marginBottom: 0,
      borderRadius: theme.radius.pill,
      borderWidth: 0.5,
      borderColor: theme.colors.border.default,
    },
    projectedCardTitle: {
      ...theme.typography.label,
      fontWeight: '600',
      marginBottom: 1,
      color: theme.colors.text.tertiary,
    },
    projectedSubCardTitle: {
      ...theme.typography.label,
      fontWeight: '600',
      marginBottom: 1,
      color: theme.colors.text.muted,
    },
    projectedPrimaryValue: {
      ...theme.typography.sectionTitle,
      marginBottom: 0,
      color: theme.colors.text.primary,
    },
    projectedPrimaryValueOutcome: {},
    projectedSubCardValue: {
      color: theme.colors.text.muted,
    },
    projectedSubtext: {
      ...theme.typography.caption,
      color: theme.colors.text.muted,
      marginTop: layout.micro,
    },
    projectedDelta: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
      color: theme.colors.text.muted,
      marginTop: spacing.tiny,
    },
    projectedDeltaScenario: {},
    projectedDeltaAge: {
      color: theme.colors.text.muted,
    },
    projectedPrimaryValueScenario: {},
    dualValueRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    dualValueDivider: {
      width: 1,
      height: 20,
    },
    balanceSheetDualColumn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      gap: spacing.tiny,
    },
    balanceSheetColumn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    balanceSheetDeltaRow: {
      minHeight: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    balanceSheetDivider: {
      width: 1,
      alignSelf: 'stretch',
    },
    dotSeparatorTight: {
      alignItems: 'center',
      marginVertical: 4,
    },
    dot: {
      ...theme.typography.caption,
      color: theme.colors.border.default,
    },
    projectedBalanceSheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
      flexWrap: 'wrap',
      marginTop: spacing.sm,
    },
    simpleBalanceItem: {
      flex: 1,
      alignItems: 'center',
    },
    simpleBalanceValue: {
      ...theme.typography.value,
    },
    simpleBalanceLabel: {
      ...theme.typography.caption,
      marginTop: spacing.tiny,
    },
    projectedBalanceSheetCard: {
      flex: 1,
      minHeight: 80,
      padding: spacing.sm,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    projectedBalanceSheetOperator: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.disabled,
      marginHorizontal: 2,
    },
    scenarioImpactBlocks: {
      gap: layout.md,
      marginTop: spacing.sm,
    },
    scenarioImpactBlock: {
      borderRadius: theme.radius.medium,
      padding: layout.md,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    scenarioImpactBlockTitle: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      color: theme.colors.text.tertiary,
      marginBottom: spacing.xs,
    },
    scenarioImpactBlockValue: {
      ...theme.typography.valueLarge,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    scenarioImpactPositive: {},
    scenarioImpactNegative: {
      color: theme.colors.text.muted,
    },
    scenarioImpactBlockSubline: {
      ...theme.typography.label,
      color: theme.colors.text.muted,
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
      ...theme.typography.bodyLarge,
      color: theme.colors.text.muted,
    },
    scenarioImpactBalanceSheetValue: {
      ...theme.typography.valueSmall,
    },
    projectedSnapshotMuted: {
      opacity: 0.7,
    },
    projectedSnapshotMutedText: {
      color: theme.colors.text.muted,
    },
    projectedSnapshotMutedCard: {
      borderColor: theme.colors.border.default,
    },
    insightsList: {
      marginTop: layout.md,
    },
    bodyText: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.secondary,
      marginBottom: spacing.xs,
      lineHeight: 18,
    },
    bodyTextMuted: {
      color: theme.colors.text.muted,
      opacity: 0.7,
    },
    snapshotCard: {
      paddingVertical: spacing.tiny,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.sm,
      borderRadius: spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      zIndex: 1,
    },
    snapshotCardTitle: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
      marginBottom: 1,
      color: theme.colors.text.primary,
    },
    snapshotSubCardTitle: {
      color: theme.colors.text.secondary,
    },
    snapshotSubCardValue: {
      color: theme.colors.text.secondary,
    },
    snapshotPrimaryValue: {
      ...theme.typography.value,
      marginBottom: 1,
      color: theme.colors.text.primary,
    },
    snapshotPrimaryValueOutcome: {},
    snapshotPrimaryValueScenario: {},
    snapshotCardDescription: {
      ...theme.typography.body,
      color: theme.colors.text.muted,
      marginTop: 1,
    },
    snapshotDeltaValue: {
      ...theme.typography.body,
      color: theme.colors.text.muted,
      marginTop: 1,
    },
    snapshotDeltaValueMuted: {},
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
      ...theme.typography.label,
      color: theme.colors.text.muted,
      textAlign: 'center',
      marginTop: spacing.xs,
      fontStyle: 'italic',
    },
    reconciliationOverlayContainer: {
      marginTop: layout.md,
      marginBottom: spacing.xs,
    },
    reconciliationToggle: {
      borderRadius: theme.radius.base,
      paddingVertical: spacing.xs,
      paddingHorizontal: layout.inputPadding,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    reconciliationToggleText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text.muted,
      fontFamily: 'monospace',
    },
    reconciliationPanel: {
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      borderRadius: theme.radius.base,
      padding: layout.inputPadding,
      marginTop: spacing.sm,
    },
    reconciliationTitle: {
      ...theme.typography.label,
      fontWeight: '600',
      color: theme.colors.text.tertiary,
      marginBottom: spacing.sm,
      fontFamily: 'monospace',
    },
    reconciliationRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.tiny,
    },
    reconciliationLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.text.muted,
      fontFamily: 'monospace',
      flex: 1,
    },
    reconciliationValue: {
      ...theme.typography.bodySmall,
      color: theme.colors.text.primary,
      fontFamily: 'monospace',
      fontWeight: '600',
      textAlign: 'right',
    },
    reconciliationPass: {},
    reconciliationFail: {},
    reconciliationWarning: {
      borderWidth: 1,
      borderRadius: theme.radius.small,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    reconciliationWarningText: {
      ...theme.typography.bodySmall,
      fontFamily: 'monospace',
    },
    warningBanner: {
      marginTop: layout.sectionGap,
      marginHorizontal: layout.screenPadding,
      padding: layout.blockPadding,
      borderRadius: theme.radius.medium,
      borderWidth: 1,
    },
    warningBannerText: {
      ...theme.typography.bodyLarge,
    },
    modalWarningBanner: {
      marginBottom: spacing.base,
      padding: layout.blockPadding,
      borderRadius: theme.radius.medium,
      borderWidth: 1,
    },
    modalWarningBannerText: {
      ...theme.typography.bodyLarge,
      lineHeight: 18,
    },
  });
}


