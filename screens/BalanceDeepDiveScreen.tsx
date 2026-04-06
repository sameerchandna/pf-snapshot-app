import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { VictoryArea, VictoryAxis, VictoryChart, VictoryLabel, VictoryLine, VictoryScatter, VictoryStack } from 'victory-native';

import ScreenHeader from '../components/ScreenHeader';
import SketchBackground from '../components/SketchBackground';
import SectionHeader from '../components/SectionHeader';
import SectionCard from '../components/SectionCard';
import Icon from '../components/Icon';
import IconButton from '../components/IconButton';
import ControlBar from '../components/ControlBar';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { useSnapshot } from '../context/SnapshotContext';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { applyScenarioToProjectionInputs } from '../projection/applyScenarioToInputs';
import { computeSingleAssetTimeSeries, computeSingleLiabilityTimeSeries } from '../engines/projectionEngine';
import { getActiveScenario, getScenarios, getActiveScenarioId } from '../scenarioState';
import { ATTRIBUTION_TOLERANCE } from '../constants';
import { formatCurrencyFull, formatCurrencyCompact, formatPercent } from '../ui/formatters';
import type { Theme } from '../ui/theme/theme';
import { radius, typography } from '../ui/theme/theme';
import { generateSavingsInsights, generateMortgageInsights, type BalanceInsight } from '../engines/balanceInsights';
import SavingsEducationOverlay from '../components/SavingsEducationOverlay';
import MortgageEducationOverlay from '../components/MortgageEducationOverlay';
import Divider from '../components/Divider';

type RouteParams = {
  itemId?: string;
};

// Phase 5.9: Highlight state for insight ↔ chart linking
type HighlightSeries =
  | 'contributions'
  | 'growth'
  | 'balance'
  | 'principal'
  | 'interest';

type ActiveHighlight = {
  insightId: string;
  series: HighlightSeries;
  ageStart: number;
  ageEnd: number;
} | null;

// Chart color palette helper (matches ProjectionResultsScreen pattern)
function getChartPalette(theme: Theme) {
  return {
    contributions: theme.colors.brand.primary,
    growth: theme.colors.brand.primary,
    // Mortgage/liability colors (distinct from savings)
    balance: theme.colors.text.muted,
    principal: theme.colors.text.tertiary,
    interest: theme.colors.semantic.warning,
    markerLine: theme.colors.brand.primary,
    axis: theme.colors.border.default,
    grid: theme.colors.border.subtle,
    tickLabels: theme.colors.text.secondary,
  };
}

export default function BalanceDeepDiveScreen() {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { state } = useSnapshot();
  const { itemId } = (route.params ?? {}) as RouteParams;

  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(itemId ?? null);
  
  // Age selection state (matching ProjectionResultsScreen pattern)
  const [selectedAge, setSelectedAge] = useState<number>(state.projection.currentAge ?? 30);
  const [ageSelectorOpen, setAgeSelectorOpen] = useState(false);

  // Phase 5.8: Educational overlay state (session-only, no persistence)
  // Overlays are separate from insights: overlays explain concepts, insights explain data
  // Only one overlay can be open at a time, and overlays close when item type changes
  const [savingsEducationOpen, setSavingsEducationOpen] = useState(false);
  const [mortgageEducationOpen, setMortgageEducationOpen] = useState(false);

  // Phase 5.9: Transient highlight state for insight ↔ chart linking
  // UI-only, no persistence, no state mutation
  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlight>(null);

  // Filter to savings assets only (exclude SYSTEM_CASH and inactive assets)
  const savingsAssets = useMemo(() => {
    if (!Array.isArray(state.assets)) return [];
    return state.assets.filter(a => a.isActive !== false);
  }, [state.assets]);

  // Resolve item name from itemId (gracefully handle missing/invalid)
  const itemName = useMemo(() => {
    if (!selectedItemId) return 'Select item';
    
    // Try to find in assets (guard against undefined)
    if (Array.isArray(state.assets)) {
      const asset = state.assets.find(a => a.id === selectedItemId);
      if (asset) return asset.name;
    }
    
    // Try to find in liabilities (guard against undefined)
    if (Array.isArray(state.liabilities)) {
      const liability = state.liabilities.find(l => l.id === selectedItemId);
      if (liability) return liability.name;
    }
    
    return 'Unknown item';
  }, [selectedItemId, state.assets, state.liabilities]);

  // Build metadata subtitle for selected item
  const itemMetadata = useMemo(() => {
    if (!selectedItemId) return null;
    
    // Check if it's a savings asset
    const asset = savingsAssets.find(a => a.id === selectedItemId);
    if (asset) {
      const parts: string[] = [];
      
      // 1. Asset type from group
      const group = Array.isArray(state.assetGroups) 
        ? state.assetGroups.find(g => g.id === asset.groupId)
        : null;
      if (group) {
        parts.push(group.name);
      }
      
      // 2. Interest rate
      if (typeof asset.annualGrowthRatePct === 'number' && Number.isFinite(asset.annualGrowthRatePct) && asset.annualGrowthRatePct > 0) {
        parts.push(formatPercent(asset.annualGrowthRatePct));
      }
      
      // 3. Contribution cadence (if applicable)
      const hasContribution = Array.isArray(state.assetContributions) 
        && state.assetContributions.some(c => c.assetId === asset.id && c.amountMonthly > 0);
      if (hasContribution) {
        parts.push('Monthly');
      }
      
      // 4. Current balance
      parts.push(formatCurrencyCompact(asset.balance));
      
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    
    // Check if it's a mortgage/loan liability
    if (Array.isArray(state.liabilities)) {
      const liability = state.liabilities.find(l => l.id === selectedItemId);
      if (liability && liability.kind === 'loan') {
        const parts: string[] = [];
        
        // 1. Liability type
        if (liability.loanTemplate === 'mortgage') {
          parts.push('Mortgage');
        } else {
          parts.push('Loan');
        }
        
        // 2. Interest rate
        if (typeof liability.annualInterestRatePct === 'number' && Number.isFinite(liability.annualInterestRatePct)) {
          parts.push(formatPercent(liability.annualInterestRatePct));
        }
        
        // 3. Remaining term
        if (typeof liability.remainingTermYears === 'number' && Number.isFinite(liability.remainingTermYears)) {
          parts.push(`${liability.remainingTermYears}y`);
        }
        
        // 4. Remaining balance
        parts.push(formatCurrencyCompact(liability.balance));
        
        return parts.length > 0 ? parts.join(' · ') : null;
      }
    }
    
    return null;
  }, [selectedItemId, savingsAssets, state.assetGroups, state.assetContributions, state.liabilities]);

  // Determine item subtype (fallback for display)
  const itemSubtype = useMemo(() => {
    if (!selectedItemId) return 'Select an item to view details';
    
    const asset = savingsAssets.find(a => a.id === selectedItemId);
    if (asset) return 'Savings Asset';
    
    if (Array.isArray(state.liabilities)) {
      const liability = state.liabilities.find(l => l.id === selectedItemId);
      if (liability) {
        if (liability.kind === 'loan') return 'Mortgage / Loan';
        return 'Liability';
      }
    }
    
    return 'Unknown type';
  }, [selectedItemId, savingsAssets, state.liabilities]);

  // Check if selected item is a savings asset
  const isSavingsAsset = useMemo(() => {
    if (!selectedItemId) return false;
    return savingsAssets.some(a => a.id === selectedItemId);
  }, [selectedItemId, savingsAssets]);

  // Check if selected item is a mortgage/loan liability
  const isMortgageLiability = useMemo(() => {
    if (!selectedItemId) return false;
    if (!Array.isArray(state.liabilities)) return false;
    const liability = state.liabilities.find(l => l.id === selectedItemId);
    return liability?.kind === 'loan';
  }, [selectedItemId, state.liabilities]);

  // Load scenario state (match ProjectionResultsScreen pattern)
  const [savedScenarios, setSavedScenarios] = useState<import('../domain/scenario/types').Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<import('../domain/scenario/types').ScenarioId | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    
    const loadScenarioState = async () => {
      try {
        const scenarios = await getScenarios();
        const activeId = await getActiveScenarioId();
        if (mounted) {
          // Ensure scenarios is always an array
          setSavedScenarios(Array.isArray(scenarios) ? scenarios : []);
          setActiveScenarioId(activeId);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[BalanceDeepDive] Error loading scenario state:', error);
        }
        if (mounted) {
          // On error, ensure we have an empty array
          setSavedScenarios([]);
          setActiveScenarioId(undefined);
        }
      }
    };
    
    loadScenarioState();
    
    return () => {
      mounted = false;
    };
  }, [state.assets, state.liabilities]);

  // Resolve active scenario (ensure savedScenarios is always an array)
  const activeScenario = useMemo(() => {
    const scenarios = Array.isArray(savedScenarios) ? savedScenarios : [];
    return getActiveScenario(scenarios, activeScenarioId);
  }, [savedScenarios, activeScenarioId]);

  // Build projection inputs and compute time series for selected savings asset
  const assetTimeSeries = useMemo(() => {
    if (!isSavingsAsset || !selectedItemId) return null;

    try {
      // Build baseline projection inputs
      const baselineInputs = buildProjectionInputsFromState(state);
      
      // Apply active scenario to inputs
      const scenarioInputs = applyScenarioToProjectionInputs(baselineInputs, activeScenario, state);
      
      // Compute time series for selected asset
      const series = computeSingleAssetTimeSeries(scenarioInputs, selectedItemId);
      
      return series.length > 0 ? series : null;
    } catch (error) {
      if (__DEV__) {
        console.error('[BalanceDeepDive] Error computing asset time series:', error);
      }
      return null;
    }
  }, [isSavingsAsset, selectedItemId, state, activeScenario]);

  // Build projection inputs and compute time series for selected mortgage/loan liability
  const liabilityTimeSeries = useMemo(() => {
    if (!isMortgageLiability || !selectedItemId) return null;

    try {
      // Build baseline projection inputs
      const baselineInputs = buildProjectionInputsFromState(state);
      
      // Apply active scenario to inputs
      const scenarioInputs = applyScenarioToProjectionInputs(baselineInputs, activeScenario, state);
      
      // Compute time series for selected liability
      const series = computeSingleLiabilityTimeSeries(scenarioInputs, selectedItemId);
      
      return series.length > 0 ? series : null;
    } catch (error) {
      if (__DEV__) {
        console.error('[BalanceDeepDive] Error computing liability time series:', error);
      }
      return null;
    }
  }, [isMortgageLiability, selectedItemId, state, activeScenario]);

  // Validate reconciliation
  const reconciliationValid = useMemo(() => {
    if (!assetTimeSeries || assetTimeSeries.length === 0) return true; // No data to validate
    
    const firstPoint = assetTimeSeries[0];
    const lastPoint = assetTimeSeries[assetTimeSeries.length - 1];
    
    const startingBalance = firstPoint.balance;
    const totalContributions = lastPoint.cumulativeContributions;
    const totalGrowth = lastPoint.cumulativeGrowth;
    const endingBalance = lastPoint.balance;
    
    // Reconciliation: endingBalance ≈ startingBalance + totalContributions + totalGrowth
    const expectedEndingBalance = startingBalance + totalContributions + totalGrowth;
    const delta = Math.abs(endingBalance - expectedEndingBalance);
    
    if (delta > ATTRIBUTION_TOLERANCE) {
      if (__DEV__) {
        console.error(
          '[BalanceDeepDive] Reconciliation failed:',
          {
            endingBalance,
            expectedEndingBalance,
            delta,
            tolerance: ATTRIBUTION_TOLERANCE,
            startingBalance,
            totalContributions,
            totalGrowth,
          }
        );
      }
      return false;
    }
    
    return true;
  }, [assetTimeSeries]);

  // Build balance breakdown for savings asset (at selected age)
  const savingsBreakdown = useMemo(() => {
    if (!assetTimeSeries || assetTimeSeries.length === 0) return null;
    
    // Find point at selected age
    const selectedAgeIndex = assetTimeSeries.findIndex(p => Math.floor(p.age) >= selectedAge);
    const point = selectedAgeIndex >= 0 
      ? assetTimeSeries[selectedAgeIndex] 
      : assetTimeSeries[assetTimeSeries.length - 1];
    
    const firstPoint = assetTimeSeries[0];
    
    const initialBalance = firstPoint.balance;
    const contributions = point.cumulativeContributions;
    const growth = point.cumulativeGrowth;
    const totalBalance = point.balance; // Absolute balance at selected age
    
    // Calculate percentages relative to total balance
    const calculatePercent = (value: number, total: number): string => {
      if (Math.abs(total) < 0.01) return '—';
      return formatPercent((value / total) * 100);
    };
    
    const palette = getChartPalette(theme);
    
    return {
      headline: totalBalance,
      rows: [
        {
          label: 'Initial balance',
          value: initialBalance,
          percent: calculatePercent(initialBalance, totalBalance),
          color: theme.colors.text.secondary, // Neutral styling
        },
        {
          label: 'Additional contributions',
          value: contributions,
          percent: calculatePercent(contributions, totalBalance),
          color: palette.contributions,
        },
        {
          label: 'Growth',
          value: growth,
          percent: calculatePercent(growth, totalBalance),
          color: palette.growth,
        },
      ],
    };
  }, [assetTimeSeries, selectedAge, theme]);

  // Detect payoff moment for mortgage/loan liability
  const payoffMoment = useMemo(() => {
    if (!liabilityTimeSeries || liabilityTimeSeries.length === 0) return null;
    
    const payoffPoint = liabilityTimeSeries.find(p => p.balance <= ATTRIBUTION_TOLERANCE);
    if (payoffPoint) {
      return {
        age: payoffPoint.age,
        balance: payoffPoint.balance,
      };
    }
    return null;
  }, [liabilityTimeSeries]);

  // Validate reconciliation for mortgage/loan liability
  const liabilityReconciliationValid = useMemo(() => {
    if (!liabilityTimeSeries || liabilityTimeSeries.length === 0) return true; // No data to validate
    
    const firstPoint = liabilityTimeSeries[0];
    const lastPoint = liabilityTimeSeries[liabilityTimeSeries.length - 1];
    
    const startingBalance = firstPoint.balance;
    const remainingBalance = lastPoint.balance;
    const totalPrincipalPaid = lastPoint.cumulativePrincipalPaid;
    
    // Reconciliation: startingBalance ≈ remainingBalance + cumulativePrincipalPaid
    const expectedStartingBalance = remainingBalance + totalPrincipalPaid;
    const delta = Math.abs(startingBalance - expectedStartingBalance);
    
    if (delta > ATTRIBUTION_TOLERANCE) {
      if (__DEV__) {
        console.error(
          '[BalanceDeepDive] Liability reconciliation failed:',
          {
            startingBalance,
            remainingBalance,
            totalPrincipalPaid,
            expectedStartingBalance,
            delta,
            tolerance: ATTRIBUTION_TOLERANCE,
          }
        );
      }
      return false;
    }
    
    return true;
  }, [liabilityTimeSeries]);

  // Build balance breakdown for mortgage/loan liability (at selected age)
  const mortgageBreakdown = useMemo(() => {
    if (!liabilityTimeSeries || liabilityTimeSeries.length === 0) return null;
    
    // Find point at selected age
    const selectedAgeIndex = liabilityTimeSeries.findIndex(p => Math.floor(p.age) >= selectedAge);
    const point = selectedAgeIndex >= 0 
      ? liabilityTimeSeries[selectedAgeIndex] 
      : liabilityTimeSeries[liabilityTimeSeries.length - 1];
    
    const firstPoint = liabilityTimeSeries[0];
    
    const originalBalance = firstPoint.balance;
    const principalPaid = point.cumulativePrincipalPaid;
    const interestPaid = point.cumulativeInterestPaid;
    const remainingBalance = point.balance;
    
    // Calculate percentages relative to original balance
    const calculatePercent = (value: number, total: number): string => {
      if (Math.abs(total) < 0.01) return '—';
      return formatPercent((value / total) * 100);
    };
    
    const palette = getChartPalette(theme);
    
    return {
      headline: remainingBalance,
      rows: [
        {
          label: 'Initial balance',
          value: remainingBalance,
          percent: calculatePercent(remainingBalance, originalBalance),
          color: theme.colors.text.secondary, // Neutral styling
        },
        {
          label: 'Principal repaid',
          value: principalPaid,
          percent: calculatePercent(principalPaid, originalBalance),
          color: palette.principal,
        },
        {
          label: 'Interest paid',
          value: interestPaid,
          percent: calculatePercent(interestPaid, originalBalance),
          color: palette.interest,
        },
      ],
    };
  }, [liabilityTimeSeries, selectedAge, theme]);

  // Generate balance insights for savings asset
  const savingsInsights = useMemo(() => {
    if (!assetTimeSeries || assetTimeSeries.length === 0) return [];
    return generateSavingsInsights(assetTimeSeries, selectedAge);
  }, [assetTimeSeries, selectedAge]);

  // Generate balance insights for mortgage/loan liability
  const mortgageInsights = useMemo(() => {
    if (!liabilityTimeSeries || liabilityTimeSeries.length === 0) return [];
    return generateMortgageInsights(liabilityTimeSeries, selectedAge);
  }, [liabilityTimeSeries, selectedAge]);

  // Phase 5.9: Handle insight press to set highlight state
  // Derives age range from chartRef without recomputing projection
  const handleInsightPress = useCallback((insight: BalanceInsight) => {
    // If same insight is already active, clear highlight
    if (activeHighlight?.insightId === insight.id) {
      setActiveHighlight(null);
      return;
    }

    // Derive ageStart and ageEnd from chartRef
    let ageStart: number;
    let ageEnd: number;

    const chartRef = insight.chartRef;
    const timeSeries = isSavingsAsset ? assetTimeSeries : liabilityTimeSeries;

    if (!timeSeries || timeSeries.length === 0) {
      // Fallback to insight.age if no time series available
      ageStart = insight.age;
      ageEnd = insight.age;
    } else if (
      chartRef.rangeStartIndex !== undefined &&
      chartRef.rangeEndIndex !== undefined &&
      chartRef.rangeStartIndex >= 0 &&
      chartRef.rangeEndIndex < timeSeries.length
    ) {
      // Use explicit range from chartRef
      ageStart = timeSeries[chartRef.rangeStartIndex].age;
      ageEnd = timeSeries[chartRef.rangeEndIndex].age;
    } else if (
      chartRef.pointIndex !== undefined &&
      chartRef.pointIndex >= 0 &&
      chartRef.pointIndex < timeSeries.length
    ) {
      // Create narrow window (±1 year) around pointIndex
      const pointAge = timeSeries[chartRef.pointIndex].age;
      ageStart = Math.max(timeSeries[0].age, pointAge - 1);
      ageEnd = Math.min(timeSeries[timeSeries.length - 1].age, pointAge + 1);
    } else {
      // Fallback to insight.age
      ageStart = insight.age;
      ageEnd = insight.age;
    }

    setActiveHighlight({
      insightId: insight.id,
      series: chartRef.series as HighlightSeries,
      ageStart,
      ageEnd,
    });
  }, [activeHighlight, isSavingsAsset, assetTimeSeries, liabilityTimeSeries]);

  // Prepare chart data for stacked area chart (savings asset)
  const chartData = useMemo(() => {
    if (!assetTimeSeries || assetTimeSeries.length === 0 || !reconciliationValid) return null;
    
    // Get starting balance as baseline offset
    const startingBalance = assetTimeSeries[0].balance;
    
    // Prepare data for VictoryArea (contributions and growth stacked on top of starting balance)
    // VictoryStack automatically stacks areas, so:
    // - Bottom layer: contributions (y = startingBalance + cumulativeContributions)
    // - Top layer: growth (y = cumulativeGrowth, stacked on top of contributions)
    // The top of the stack represents absolute balance: startingBalance + contributions + growth
    const contributionsData = assetTimeSeries.map(point => ({
      x: point.age,
      y: startingBalance + point.cumulativeContributions,
    }));
    
    const growthData = assetTimeSeries.map(point => ({
      x: point.age,
      y: point.cumulativeGrowth,
    }));
    
    // Calculate domain for Y axis (include absolute balance values)
    // Top of stack = startingBalance + contributions + growth = absolute balance
    const allYValues = assetTimeSeries.flatMap(p => [
      startingBalance, // Baseline
      startingBalance + p.cumulativeContributions, // Contributions layer top
      startingBalance + p.cumulativeContributions + p.cumulativeGrowth, // Absolute balance (top of stack)
      p.balance, // Explicit balance value for domain calculation
    ]);
    const yMin = Math.min(0, ...allYValues);
    const yMax = Math.max(...allYValues);
    
    return {
      contributionsData,
      growthData,
      yMin,
      yMax,
    };
  }, [assetTimeSeries, reconciliationValid]);

  // Prepare chart data for mortgage/loan liability (balance line + stacked areas)
  const mortgageChartData = useMemo(() => {
    if (!liabilityTimeSeries || liabilityTimeSeries.length === 0 || !liabilityReconciliationValid) return null;
    
    // Truncate at payoff if detected
    const truncatedSeries = payoffMoment
      ? liabilityTimeSeries.filter(p => p.age <= payoffMoment.age)
      : liabilityTimeSeries;
    
    const balanceData = truncatedSeries.map(p => ({ x: p.age, y: p.balance }));
    const principalData = truncatedSeries.map(p => ({ x: p.age, y: p.cumulativePrincipalPaid }));
    const interestData = truncatedSeries.map(p => ({ x: p.age, y: p.cumulativeInterestPaid }));
    
    // Calculate Y domain
    const allYValues = truncatedSeries.flatMap(p => [
      p.balance,
      p.cumulativePrincipalPaid,
      p.cumulativePrincipalPaid + p.cumulativeInterestPaid,
    ]);
    const yMin = 0;
    const yMax = Math.max(...allYValues, 0);
    
    return {
      balanceData,
      principalData,
      interestData,
      yMin,
      yMax,
    };
  }, [liabilityTimeSeries, liabilityReconciliationValid, payoffMoment]);

  const windowWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(320, windowWidth - 24);
  const chartHeight = 240;
  const chartPadding = { left: 50, top: 20, right: 20, bottom: 40 };
  const chartPalette = getChartPalette(theme);

  // Phase 5.9: Helper to compute opacity for chart series based on activeHighlight
  const getSeriesOpacity = useCallback((series: HighlightSeries, baseOpacity: number): number => {
    if (!activeHighlight) return baseOpacity;
    // Emphasize matching series (full opacity), de-emphasize others (reduced opacity)
    return activeHighlight.series === series ? baseOpacity : baseOpacity * 0.3;
  }, [activeHighlight]);

  // Phase 5.9: Helper to compute stroke width for lines based on activeHighlight
  const getSeriesStrokeWidth = useCallback((series: HighlightSeries, baseStrokeWidth: number): number => {
    if (!activeHighlight) return baseStrokeWidth;
    // Emphasize matching series (thicker stroke), de-emphasize others (thinner stroke)
    return activeHighlight.series === series ? baseStrokeWidth * 1.5 : baseStrokeWidth * 0.5;
  }, [activeHighlight]);

  // Touch-to-age mapping helper (reused from ProjectionResultsScreen)
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

  // PanResponder for chart gesture interaction (reused from ProjectionResultsScreen)
  const chartPanResponder = useMemo(() => {
    const currentAge = state.projection.currentAge ?? 30;
    const endAge = state.projection.endAge ?? 100;

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

        // Phase 5.9: Clear highlight on chart interaction
        if (activeHighlight) {
          setActiveHighlight(null);
        }

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

        // Phase 5.9: Clear highlight on chart interaction
        if (activeHighlight) {
          setActiveHighlight(null);
        }

        const touchX = evt.nativeEvent.locationX;
        const mappedAge = mapTouchXToAge(touchX, chartWidth, chartPadding, currentAge, endAge);
        
        // Only update if age changed to avoid unnecessary re-renders
        if (mappedAge !== null && mappedAge !== selectedAge) {
          setSelectedAge(mappedAge);
        }
      },
    });
  }, [chartWidth, chartPadding, state.projection.currentAge, state.projection.endAge, selectedAge, mapTouchXToAge, setSelectedAge, activeHighlight]);

  // Get current age from projection settings
  const currentAge = useMemo(() => {
    return state.projection.currentAge ?? 30;
  }, [state.projection.currentAge]);

  // Sync selectedAge when endAge changes (matching ProjectionResultsScreen pattern)
  useEffect(() => {
    if (selectedAge > (state.projection.endAge ?? 100)) {
      setSelectedAge(state.projection.endAge ?? 100);
    }
  }, [state.projection.endAge, selectedAge]);

  // Combined list of savings assets and mortgage/loan liabilities for dropdown
  const allItems = useMemo(() => {
    const savingsAssetItems = savingsAssets.map(a => ({ id: a.id, name: a.name, type: 'asset' as const }));
    const realLiabilities = Array.isArray(state.liabilities)
      ? state.liabilities
          .filter(l => l.isActive !== false && l.kind === 'loan')
          .map(l => ({ id: l.id, name: l.name, type: 'liability' as const }))
      : [];
    return [...savingsAssetItems, ...realLiabilities];
  }, [savingsAssets, state.liabilities]);

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    setItemPickerOpen(false);
    // Phase 5.8: Close any open educational overlay when item type changes
    // This ensures only one overlay is open and overlays match the selected item type
    setSavingsEducationOpen(false);
    setMortgageEducationOpen(false);
    // Phase 5.9: Clear highlight on item selection change
    setActiveHighlight(null);
  };

  // Phase 5.8: Handle educational overlay toggles
  // Overlays are passive and optional - user controls visibility
  // No state mutation, no Snapshot/Projection/Scenario interaction
  const handleToggleSavingsEducation = () => {
    setSavingsEducationOpen(!savingsEducationOpen);
    // Ensure only one overlay is open at a time
    if (!savingsEducationOpen) {
      setMortgageEducationOpen(false);
    }
  };

  const handleToggleMortgageEducation = () => {
    setMortgageEducationOpen(!mortgageEducationOpen);
    // Ensure only one overlay is open at a time
    if (!mortgageEducationOpen) {
      setSavingsEducationOpen(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.accent} style={{flex:1}}>
      <ScreenHeader title="Balance Deep Dive" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Toolbar */}
        <ControlBar
          col1={{
            type: 'itemButton',
            title: itemName,
            subtitle: itemMetadata ?? undefined,
            onPress: () => setItemPickerOpen(true),
          }}
          col2={{
            type: 'pill',
            title: `Age ${selectedAge}`,
            onPress: () => setAgeSelectorOpen(true),
            emphasis: true,
          }}
          col3Items={[
            ...(isSavingsAsset
              ? [
                  {
                    type: 'icon' as const,
                    icon: 'info' as const,
                    onPress: handleToggleSavingsEducation,
                    accessibilityLabel: 'Savings information',
                    active: savingsEducationOpen,
                  },
                ]
              : []),
            ...(isMortgageLiability
              ? [
                  {
                    type: 'icon' as const,
                    icon: 'info' as const,
                    onPress: handleToggleMortgageEducation,
                    accessibilityLabel: 'Mortgage information',
                    active: mortgageEducationOpen,
                  },
                ]
              : []),
          ]}
        />

        <View style={styles.innerContent}>
          {/* Chart */}
          {isSavingsAsset && (
          <SectionCard style={{ marginTop: layout.sectionGap, marginBottom: spacing.xs }}>
            <SectionHeader title="Savings Balance Over Time" />
            {!reconciliationValid ? (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
                  Data reconciliation failed. Please refresh or contact support.
                </Text>
              </View>
            ) : chartData ? (
              <View style={styles.chartContainer}>
                <View style={{ height: chartHeight, width: chartWidth, position: 'relative' }}>
                  <VictoryChart
                    width={chartWidth}
                    height={chartHeight}
                    padding={chartPadding}
                    domain={{ y: [chartData.yMin, chartData.yMax] }}
                    domainPadding={{ x: 12, y: 6 }}
                  >
                    <VictoryAxis
                      tickFormat={t => `${Number(t)}`}
                      tickLabelComponent={<VictoryLabel dy={6} />}
                      style={{
                        axis: { stroke: chartPalette.axis },
                        tickLabels: { fontSize: 11, fill: chartPalette.tickLabels, fontFamily: 'Virgil' },
                        grid: { stroke: 'transparent' },
                      }}
                    />
                    <VictoryAxis
                      dependentAxis
                      tickFormat={t => formatCurrencyCompact(Number(t))}
                      style={{
                        axis: { stroke: chartPalette.axis },
                        tickLabels: { fontSize: 10, fill: chartPalette.tickLabels, fontFamily: 'Virgil' },
                        grid: { stroke: chartPalette.grid, strokeDasharray: '2,4' },
                      }}
                    />
                    <VictoryStack>
                      {/* Phase 5.9: Conditional opacity based on activeHighlight */}
                      <VictoryArea
                        data={chartData.contributionsData}
                        style={{
                          data: {
                            fill: chartPalette.contributions,
                            fillOpacity: getSeriesOpacity('contributions', 0.6),
                          },
                        }}
                      />
                      <VictoryArea
                        data={chartData.growthData}
                        style={{
                          data: {
                            fill: chartPalette.growth,
                            fillOpacity: getSeriesOpacity('growth', 0.4),
                          },
                        }}
                      />
                    </VictoryStack>
                    {/* Vertical marker line at selectedAge (visual cursor, not a filter) */}
                    <VictoryLine
                      data={[
                        { x: selectedAge, y: chartData.yMin },
                        { x: selectedAge, y: chartData.yMax },
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

                  {/* Transparent gesture overlay */}
                  <View
                    style={StyleSheet.absoluteFill}
                    {...chartPanResponder.panHandlers}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={[styles.placeholderText, { color: theme.colors.text.disabled }]}>
                  No projection data available
                </Text>
              </View>
            )}
          </SectionCard>
        )}

        {/* Chart for Mortgage/Loan Liability */}
        {isMortgageLiability && (
          <SectionCard style={{ marginBottom: spacing.xs }}>
            <SectionHeader title="Mortgage Balance and Payments Over Time" />
            {!liabilityReconciliationValid ? (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
                  Data reconciliation failed. Please refresh or contact support.
                </Text>
              </View>
            ) : mortgageChartData ? (
              <View style={styles.chartContainer}>
                <View style={{ height: chartHeight, width: chartWidth, position: 'relative' }}>
                  <VictoryChart
                    width={chartWidth}
                    height={chartHeight}
                    padding={chartPadding}
                    domain={{ y: [mortgageChartData.yMin, mortgageChartData.yMax] }}
                    domainPadding={{ x: 12, y: 6 }}
                  >
                    <VictoryAxis
                      tickFormat={t => `${Number(t)}`}
                      tickLabelComponent={<VictoryLabel dy={6} />}
                      style={{
                        axis: { stroke: chartPalette.axis },
                        tickLabels: { fontSize: 11, fill: chartPalette.tickLabels, fontFamily: 'Virgil' },
                        grid: { stroke: 'transparent' },
                      }}
                    />
                    <VictoryAxis
                      dependentAxis
                      tickFormat={t => formatCurrencyCompact(Number(t))}
                      style={{
                        axis: { stroke: chartPalette.axis },
                        tickLabels: { fontSize: 10, fill: chartPalette.tickLabels, fontFamily: 'Virgil' },
                        grid: { stroke: chartPalette.grid, strokeDasharray: '2,4' },
                      }}
                    />
                    {/* Balance line */}
                    {/* Phase 5.9: Conditional stroke width based on activeHighlight */}
                    <VictoryLine
                      data={mortgageChartData.balanceData}
                      style={{
                        data: {
                          stroke: chartPalette.balance,
                          strokeWidth: getSeriesStrokeWidth('balance', 2),
                          opacity: getSeriesOpacity('balance', 1),
                        },
                      }}
                    />
                    {/* Stacked areas: principal (bottom), interest (top) */}
                    {/* Phase 5.9: Conditional opacity based on activeHighlight */}
                    <VictoryStack>
                      <VictoryArea
                        data={mortgageChartData.principalData}
                        style={{
                          data: {
                            fill: chartPalette.principal,
                            fillOpacity: getSeriesOpacity('principal', 0.6),
                          },
                        }}
                      />
                      <VictoryArea
                        data={mortgageChartData.interestData}
                        style={{
                          data: {
                            fill: chartPalette.interest,
                            fillOpacity: getSeriesOpacity('interest', 0.4),
                          },
                        }}
                      />
                    </VictoryStack>
                    {/* Payoff moment annotation */}
                    {payoffMoment && (
                      <VictoryScatter
                        data={[{ x: payoffMoment.age, y: payoffMoment.balance }]}
                        style={{
                          data: {
                            fill: chartPalette.balance,
                            opacity: 1,
                          },
                        }}
                        size={4}
                      />
                    )}
                    {/* Vertical marker line at selectedAge (visual cursor, not a filter) */}
                    <VictoryLine
                      data={[
                        { x: selectedAge, y: mortgageChartData.yMin },
                        { x: selectedAge, y: mortgageChartData.yMax },
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

                  {/* Transparent gesture overlay */}
                  <View
                    style={StyleSheet.absoluteFill}
                    {...chartPanResponder.panHandlers}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={[styles.placeholderText, { color: theme.colors.text.disabled }]}>
                  No projection data available
                </Text>
              </View>
            )}
          </SectionCard>
        )}

        {/* Compact Values Card for Savings Asset */}
        {isSavingsAsset && savingsBreakdown && savingsBreakdown.rows.length >= 3 && (
          <SectionCard style={{ marginTop: spacing.xs, padding: spacing.sm }}>
            <View style={[styles.valueBar, { width: chartWidth }]}>
              {/* Row 1: Total Balance */}
              <View style={styles.valueBarRow}>
                <View style={styles.valueBarItem}>
                  <Text style={[styles.valueBarLabel, styles.valueBarLabelLarge, { color: theme.colors.text.muted }]}>Total balance</Text>
                  <Text style={[styles.valueBarValue, styles.valueBarValueLarge, { color: theme.colors.text.primary }]}>
                    {formatCurrencyCompact(savingsBreakdown.headline)}
                  </Text>
                </View>
              </View>

              {/* Row 2: Contributions and Growth */}
              <View style={styles.valueBarRow}>
                {/* Contributions */}
                <View style={styles.valueBarItem}>
                  <View style={[styles.valueBarDot, { backgroundColor: chartPalette.contributions, borderRadius: theme.radius.small }]} />
                  <Text style={[styles.valueBarLabel, { color: theme.colors.text.muted }]}>Contributions</Text>
                  <View style={styles.valueBarValueContainer}>
                    <Text style={[styles.valueBarValue, { color: theme.colors.text.primary }]}>
                      {formatCurrencyCompact(savingsBreakdown.rows[1].value)}
                    </Text>
                    {savingsBreakdown.rows[1].percent && savingsBreakdown.rows[1].percent !== '—' && (
                      <Text style={[styles.valueBarPercent, { color: theme.colors.text.muted }]}>
                        {' '}({savingsBreakdown.rows[1].percent})
                      </Text>
                    )}
                  </View>
                </View>

                {/* Growth */}
                <View style={styles.valueBarItem}>
                  <View style={[styles.valueBarDot, { backgroundColor: chartPalette.growth, borderRadius: theme.radius.small }]} />
                  <Text style={[styles.valueBarLabel, { color: theme.colors.text.muted }]}>Growth</Text>
                  <View style={styles.valueBarValueContainer}>
                    <Text style={[styles.valueBarValue, { color: theme.colors.text.primary }]}>
                      {formatCurrencyCompact(savingsBreakdown.rows[2].value)}
                    </Text>
                    {savingsBreakdown.rows[2].percent && savingsBreakdown.rows[2].percent !== '—' && (
                      <Text style={[styles.valueBarPercent, { color: theme.colors.text.muted }]}>
                        {' '}({savingsBreakdown.rows[2].percent})
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Balance Insights (below numeric values) */}
              {/* Phase 5.9: Individual insight elements for tap-to-highlight */}
              {savingsInsights.length > 0 && (
                <>
                  <Divider variant="subtle" />
                  <View style={styles.insightsContainer}>
                    {savingsInsights.map((insight, idx) => (
                      <Pressable
                        key={insight.id}
                        onPress={() => handleInsightPress(insight)}
                        style={({ pressed }) => [
                          styles.insightPressable,
                          activeHighlight?.insightId === insight.id && styles.insightPressableActive,
                          pressed && styles.insightPressablePressed,
                        ]}
                      >
                        <Text style={[
                          styles.insightText,
                          { color: theme.colors.text.secondary },
                          activeHighlight?.insightId === insight.id && { color: theme.colors.brand.primary },
                        ]}>
                          {insight.sentence}
                          {idx < savingsInsights.length - 1 && ' · '}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          </SectionCard>
        )}

        {/* Compact Values Card for Mortgage/Loan Liability */}
        {isMortgageLiability && mortgageBreakdown && mortgageBreakdown.rows.length >= 3 && (
          <SectionCard style={{ marginTop: spacing.xs, padding: spacing.sm }}>
            <View style={[styles.valueBar, { width: chartWidth }]}>
              {/* Row 1: Remaining Balance */}
              <View style={styles.valueBarRow}>
                <View style={styles.valueBarItem}>
                  <Text style={[styles.valueBarLabel, styles.valueBarLabelLarge, { color: theme.colors.text.muted }]}>Remaining balance</Text>
                  <Text style={[styles.valueBarValue, styles.valueBarValueLarge, { color: theme.colors.text.primary }]}>
                    {formatCurrencyCompact(mortgageBreakdown.headline)}
                  </Text>
                </View>
              </View>

              {/* Row 2: Principal Paid and Interest Paid */}
              <View style={styles.valueBarRow}>
                {/* Principal Paid */}
                <View style={styles.valueBarItem}>
                  <View style={[styles.valueBarDot, { backgroundColor: chartPalette.principal, borderRadius: theme.radius.small }]} />
                  <Text style={[styles.valueBarLabel, { color: theme.colors.text.muted }]}>Principal paid</Text>
                  <Text style={[styles.valueBarValue, { color: theme.colors.text.primary }]}>
                    {formatCurrencyCompact(mortgageBreakdown.rows[1].value)}
                  </Text>
                </View>

                {/* Interest Paid */}
                <View style={styles.valueBarItem}>
                  <View style={[styles.valueBarDot, { backgroundColor: chartPalette.interest, borderRadius: theme.radius.small }]} />
                  <Text style={[styles.valueBarLabel, { color: theme.colors.text.muted }]}>Interest paid</Text>
                  <Text style={[styles.valueBarValue, { color: theme.colors.text.primary }]}>
                    {formatCurrencyCompact(mortgageBreakdown.rows[2].value)}
                  </Text>
                </View>
              </View>

              {/* Balance Insights (below numeric values) */}
              {/* Phase 5.9: Individual insight elements for tap-to-highlight */}
              {mortgageInsights.length > 0 && (
                <>
                  <Divider variant="subtle" />
                  <View style={styles.insightsContainer}>
                    {mortgageInsights.map((insight, idx) => (
                      <Pressable
                        key={insight.id}
                        onPress={() => handleInsightPress(insight)}
                        style={({ pressed }) => [
                          styles.insightPressable,
                          activeHighlight?.insightId === insight.id && styles.insightPressableActive,
                          pressed && styles.insightPressablePressed,
                        ]}
                      >
                        <Text style={[
                          styles.insightText,
                          { color: theme.colors.text.secondary },
                          activeHighlight?.insightId === insight.id && { color: theme.colors.brand.primary },
                        ]}>
                          {insight.sentence}
                          {idx < mortgageInsights.length - 1 && ' · '}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          </SectionCard>
        )}
        </View>
      </ScrollView>

      {/* Item Picker Modal */}
      <Modal
        transparent={true}
        visible={itemPickerOpen}
        animationType="slide"
        onRequestClose={() => setItemPickerOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay.scrim50 }]}
          onPress={() => setItemPickerOpen(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.bg.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>Select Item</Text>
              <IconButton
                icon="close-outline"
                size="md"
                onPress={() => setItemPickerOpen(false)}
                accessibilityLabel="Close"
              />
            </View>
            <Divider variant="subtle" />
            
            <ScrollView style={styles.modalList}>
              {allItems.map((item, index) => {
                const isLast = index === allItems.length - 1;
                return (
                  <React.Fragment key={item.id}>
                    <Pressable
                      onPress={() => handleSelectItem(item.id)}
                      style={({ pressed }) => [
                        styles.modalItem,
                        {
                          backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
                        },
                        selectedItemId === item.id && { backgroundColor: theme.colors.bg.subtle },
                      ]}
                    >
                      <Text style={[styles.modalItemText, { color: theme.colors.text.primary }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.modalItemType, { color: theme.colors.text.muted }]}>
                        {item.type === 'asset' ? 'Asset' : 'Liability'}
                      </Text>
                    </Pressable>
                    {!isLast && <Divider variant="subtle" />}
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Age Selector Modal */}
      <Modal
        transparent={true}
        visible={ageSelectorOpen}
        animationType="slide"
        onRequestClose={() => setAgeSelectorOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdropFlex} onPress={() => setAgeSelectorOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>Select age</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {Array.from({ length: (state.projection.endAge ?? 100) - (state.projection.currentAge ?? 30) + 1 }, (_, i) => {
                const age = (state.projection.currentAge ?? 30) + i;
                const totalAges = (state.projection.endAge ?? 100) - (state.projection.currentAge ?? 30) + 1;
                const isLast = i === totalAges - 1;
                return (
                  <React.Fragment key={age}>
                    <Pressable
                      onPress={() => {
                        setSelectedAge(age);
                        setAgeSelectorOpen(false);
                        // Phase 5.9: Clear highlight on age selector change
                        setActiveHighlight(null);
                      }}
                      style={({ pressed }) => [
                        styles.modalOption,
                        {
                          backgroundColor: pressed ? theme.colors.bg.subtle : (selectedAge === age ? theme.colors.bg.subtle : 'transparent'),
                        },
                      ]}
                    >
                      <Text style={[styles.modalOptionText, { color: selectedAge === age ? theme.colors.brand.primary : theme.colors.text.primary }]}>
                        Age {age}
                      </Text>
                    </Pressable>
                    {!isLast && <Divider variant="subtle" />}
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Phase 5.8: Savings Education Overlay Modal */}
      {/* Educational overlays are separate from insights: overlays explain concepts, insights explain data */}
      {/* Overlays are passive, optional, and read-only - no state mutation */}
      {/* Uses bottom-sheet modal pattern (same as Item Picker) for visual consistency */}
      <Modal
        transparent={true}
        visible={savingsEducationOpen}
        animationType="slide"
        onRequestClose={() => setSavingsEducationOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay.scrim50 }]}
          onPress={() => setSavingsEducationOpen(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.bg.card }]}>
            <SavingsEducationOverlay onClose={() => setSavingsEducationOpen(false)} />
          </View>
        </Pressable>
      </Modal>

      {/* Phase 5.8: Mortgage Education Overlay Modal */}
      {/* Educational overlays are separate from insights: overlays explain concepts, insights explain data */}
      {/* Overlays are passive, optional, and read-only - no state mutation */}
      {/* Uses bottom-sheet modal pattern (same as Item Picker) for visual consistency */}
      <Modal
        transparent={true}
        visible={mortgageEducationOpen}
        animationType="slide"
        onRequestClose={() => setMortgageEducationOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay.scrim50 }]}
          onPress={() => setMortgageEducationOpen(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.bg.card }]}>
            <MortgageEducationOverlay onClose={() => setMortgageEducationOpen(false)} />
          </View>
        </Pressable>
      </Modal>
      </SketchBackground>
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
    paddingTop: spacing.zero,
    paddingBottom: spacing.base,
  },
  innerContent: {
    padding: spacing.base,
    paddingTop: spacing.base,
  },
  placeholderContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  placeholderText: {
    ...typography.body,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.modal,
    borderTopRightRadius: radius.modal,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.base,
  },
  modalTitle: {
    ...typography.valueLarge,
  },
  modalList: {
    maxHeight: 400,
  },
  modalListContent: {
    paddingBottom: spacing.base,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropFlex: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: radius.modal,
    borderTopRightRadius: radius.modal,
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.modalPaddingTop,
    paddingBottom: layout.modalPaddingBottom,
    maxHeight: '80%',
  },
  modalOption: {
    paddingVertical: spacing.base,
  },
  modalOptionText: {
    ...typography.button,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.base,
  },
  modalItemText: {
    ...typography.valueSmall,
    flex: 1,
  },
  modalItemType: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  errorContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
  },
  errorText: {
    ...typography.label,
    textAlign: 'center',
  },
  // Compact values card (matches ProjectionResultsScreen pattern)
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
  valueBarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  valueBarDot: {
    width: 8,
    height: 8,
    // borderRadius applied inline with theme.radius.small
  },
  valueBarLabel: {
    ...typography.body,
  },
  valueBarLabelLarge: {
    ...typography.bodyLarge,
  },
  valueBarValue: {
    ...typography.label,
  },
  valueBarValueLarge: {
    ...typography.valueSmall,
  },
  valueBarValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueBarPercent: {
    ...typography.body,
  },
  // Balance insights styles (matching ProjectionResultsScreen pattern)
  insightsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.zero,
  },
  insightPressable: {
    // Inline style preserved - no visual change when not active
  },
  insightPressableActive: {
    // Visual feedback handled via text color change
  },
  insightPressablePressed: {
    opacity: 0.7,
  },
  insightText: {
    ...typography.bodySmall,
    textAlign: 'center',
  },
  // Phase 5.8: Educational overlay styles
  toolbarEducationButton: {
    width: 32,
    height: 32,
    // borderRadius applied inline with theme.radius.base
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
});
