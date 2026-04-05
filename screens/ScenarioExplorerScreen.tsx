import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VictoryChart, VictoryLine, VictoryAxis } from 'victory-native';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SketchBackground from '../components/SketchBackground';
import SectionCard from '../components/SectionCard';
import Button from '../components/Button';
import { useSnapshot } from '../context/SnapshotContext';
import { getTemplateById } from '../domain/scenario/templates';
import type { SliderConfig } from '../domain/scenario/templates';
import type { Scenario } from '../domain/scenario/types';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { applyScenarioToProjectionInputs } from '../projection/applyScenarioToInputs';
import { computeProjectionSeries, computeProjectionSummary } from '../engines/projectionEngine';
import type { ProjectionSeriesPoint, ProjectionSummary } from '../engines/projectionEngine';
import { selectMonthlySurplus } from '../engines/selectors';
import { saveScenario, setActiveScenarioId } from '../scenarioState';
import { formatCurrencyCompact, formatCurrencyCompactSigned } from '../ui/formatters';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import CustomSlider from '../components/CustomSlider';

type RouteParams = {
  templateId: string;
  scenarioId?: string;
  /** Pre-fill slider with a specific value (e.g. from Problem Solver back-solve) */
  initialValue?: number;
  /** Pre-fill growth rate slider (SAVINGS_WHAT_IF) */
  initialGrowthRate?: number;
  /** Pre-select a specific target asset/loan */
  initialTargetId?: string;
  /** When navigated from another tab, back/discard returns here instead of goBack */
  returnToTab?: string;
};

function formatSliderValue(scenarioKind: string | null, value: number): string {
  if (scenarioKind === 'CHANGE_RETIREMENT_AGE') return `Age ${Math.round(value)}`;
  if (scenarioKind === 'CHANGE_ASSET_GROWTH_RATE') return `${value}%`;
  return `${formatCurrencyCompact(value)}/mo`;
}

function formatSliderConfigValue(format: SliderConfig['format'], value: number): string {
  if (format === 'age') return `Age ${Math.round(value)}`;
  if (format === 'percent') return `${value}%`;
  if (format === 'years') return `${Math.round(value)} yr`;
  return `${formatCurrencyCompact(value)}/mo`;
}

function getSliderSectionTitle(scenarioKind: string | null): string {
  if (scenarioKind === 'CHANGE_RETIREMENT_AGE') return 'Retire at age';
  if (scenarioKind === 'CHANGE_ASSET_GROWTH_RATE') return 'Annual growth rate';
  if (scenarioKind === 'REDUCE_EXPENSES') return 'Monthly reduction';
  return 'Monthly amount';
}

type TargetItem = {
  id: string;
  name: string;
};

function generateId(): string {
  return `scenario_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export default function ScenarioExplorerScreen() {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { templateId, initialValue, initialGrowthRate, initialTargetId, returnToTab } = route.params as RouteParams;
  const { state } = useSnapshot();

  const template = getTemplateById(templateId);

  // --- Baseline state ---
  const baselineInputs = useMemo(() => buildProjectionInputsFromState(state), [state]);
  const baselineSeries = useMemo(() => computeProjectionSeries(baselineInputs), [baselineInputs]);
  const baselineSummary = useMemo(() => computeProjectionSummary(baselineInputs), [baselineInputs]);

  // --- Target selection ---
  const targets: TargetItem[] = useMemo(() => {
    if (!template) return [];
    if (template.targetSelector === 'asset') {
      return state.assets
        .filter(a => a.isActive !== false)
        .map(a => ({ id: a.id, name: a.name }));
    }
    if (template.targetSelector === 'loan') {
      return state.liabilities
        .filter(l => l.isActive !== false)
        .map(l => ({ id: l.id, name: l.name }));
    }
    return [];
  }, [template, state]);

  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => initialTargetId ?? targets[0]?.id ?? '');

  // Auto-select first target when targets load
  useEffect(() => {
    if (targets.length > 0 && !selectedTargetId) {
      setSelectedTargetId(targets[0].id);
    }
  }, [targets]);

  // Sync target when navigated with a new initialTargetId (screen may not remount)
  useEffect(() => {
    if (initialTargetId) {
      setSelectedTargetId(initialTargetId);
    }
  }, [initialTargetId]);

  // --- Slider ---
  const defaults = template?.defaults;
  const isMultiSlider = !!(template?.sliders && template.sliders.length > 0);

  // Single-slider state (legacy templates)
  const [sliderValue, setSliderValue] = useState<number>(initialValue ?? defaults?.amountMonthly ?? 100);

  // Multi-slider state (keyed by slider id)
  const [sliderValues, setSliderValues] = useState<Record<string, number>>(() => {
    if (!template?.sliders) return {};
    const init: Record<string, number> = {};
    for (const sc of template.sliders) {
      if (sc.id === 'contribution' && initialValue !== undefined) {
        init[sc.id] = initialValue;
      } else if (sc.id === 'growthRate' && initialGrowthRate !== undefined) {
        init[sc.id] = initialGrowthRate;
      } else {
        init[sc.id] = sc.defaultValue;
      }
    }
    return init;
  });

  // Sync slider when navigated with a new initialValue (screen may not remount)
  useEffect(() => {
    if (initialValue !== undefined) {
      setSliderValue(initialValue);
      if (isMultiSlider) {
        setSliderValues(prev => ({ ...prev, contribution: initialValue }));
      }
    }
  }, [initialValue]);

  useEffect(() => {
    if (initialGrowthRate !== undefined && isMultiSlider) {
      setSliderValues(prev => ({ ...prev, growthRate: initialGrowthRate }));
    }
  }, [initialGrowthRate]);

  // Dynamic defaults for MORTGAGE_WHAT_IF: sync rate/term sliders to selected liability
  useEffect(() => {
    if (template?.scenarioKind !== 'MORTGAGE_WHAT_IF' || !selectedTargetId) return;
    const liability = state.liabilities.find(l => l.id === selectedTargetId);
    if (!liability) return;
    setSliderValues(prev => ({
      ...prev,
      interestRate: liability.annualInterestRatePct ?? prev.interestRate ?? 4.5,
      remainingTerm: liability.remainingTermYears ?? prev.remainingTerm ?? 25,
    }));
  }, [selectedTargetId, template?.scenarioKind]);

  // Affordability clamp: only for flow-type scenarios (FLOW_TO_ASSET / FLOW_TO_DEBT / SAVINGS_WHAT_IF contribution)
  const needsAffordabilityClamp = template?.scenarioKind === 'FLOW_TO_ASSET' || template?.scenarioKind === 'FLOW_TO_DEBT';
  const monthlySurplus = useMemo(() => selectMonthlySurplus(state), [state]);
  const effectiveMax = useMemo(() => {
    if (!defaults) return 1000;
    if (!needsAffordabilityClamp) return defaults.max;
    return Math.max(defaults.min, Math.min(defaults.max, Math.floor(monthlySurplus / (defaults.step)) * defaults.step));
  }, [defaults, monthlySurplus, needsAffordabilityClamp]);
  const isClamped = needsAffordabilityClamp && defaults ? effectiveMax < defaults.max : false;

  // Per-slider effective max (for multi-slider affordability clamping)
  const sliderEffectiveMax = useMemo(() => {
    if (!template?.sliders) return {};
    const result: Record<string, number> = {};
    for (const sc of template.sliders) {
      if (sc.affordabilityClamped) {
        result[sc.id] = Math.max(sc.min, Math.min(sc.max, Math.floor(monthlySurplus / sc.step) * sc.step));
      } else {
        result[sc.id] = sc.max;
      }
    }
    return result;
  }, [template?.sliders, monthlySurplus]);

  // --- Scenario projection (debounced) ---
  const [scenarioSeries, setScenarioSeries] = useState<ProjectionSeriesPoint[]>([]);
  const [scenarioSummary, setScenarioSummary] = useState<ProjectionSummary | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recomputeScenario = useCallback(
    (amount: number, targetId: string, multiValues?: Record<string, number>) => {
      if (!template) return;

      let scenario: Scenario;
      switch (template.scenarioKind) {
        case 'FLOW_TO_ASSET':
          if (!targetId) return;
          scenario = { id: '__preview__', name: 'Preview', kind: 'FLOW_TO_ASSET', assetId: targetId, amountMonthly: amount };
          break;
        case 'FLOW_TO_DEBT':
          if (!targetId) return;
          scenario = { id: '__preview__', name: 'Preview', kind: 'FLOW_TO_DEBT', liabilityId: targetId, amountMonthly: amount };
          break;
        case 'CHANGE_RETIREMENT_AGE':
          scenario = { id: '__preview__', name: 'Preview', kind: 'CHANGE_RETIREMENT_AGE', retirementAge: Math.round(amount) };
          break;
        case 'REDUCE_EXPENSES':
          scenario = { id: '__preview__', name: 'Preview', kind: 'REDUCE_EXPENSES', reductionMonthly: amount };
          break;
        case 'CHANGE_ASSET_GROWTH_RATE':
          if (!targetId) return;
          scenario = { id: '__preview__', name: 'Preview', kind: 'CHANGE_ASSET_GROWTH_RATE', assetId: targetId, newAnnualGrowthRatePct: amount };
          break;
        case 'SAVINGS_WHAT_IF': {
          if (!targetId || !multiValues) return;
          scenario = {
            id: '__preview__', name: 'Preview', kind: 'SAVINGS_WHAT_IF',
            assetId: targetId,
            contributionMonthly: multiValues.contribution ?? 100,
            newAnnualGrowthRatePct: multiValues.growthRate ?? 8,
          };
          break;
        }
        case 'MORTGAGE_WHAT_IF': {
          if (!targetId || !multiValues) return;
          scenario = {
            id: '__preview__', name: 'Preview', kind: 'MORTGAGE_WHAT_IF',
            liabilityId: targetId,
            overpaymentMonthly: multiValues.overpayment ?? 0,
            newAnnualInterestRatePct: multiValues.interestRate ?? 4.5,
            newRemainingTermYears: Math.round(multiValues.remainingTerm ?? 25),
          };
          break;
        }
        default:
          return;
      }

      const scenarioInputs = applyScenarioToProjectionInputs(baselineInputs, scenario, state);
      setScenarioSeries(computeProjectionSeries(scenarioInputs));
      setScenarioSummary(computeProjectionSummary(scenarioInputs));
    },
    [template, baselineInputs, state]
  );

  // Trigger on mount / target change
  useEffect(() => {
    const needsTarget = template?.targetSelector !== null;
    if (!needsTarget || selectedTargetId) {
      recomputeScenario(sliderValue, selectedTargetId, isMultiSlider ? sliderValues : undefined);
    }
  }, [selectedTargetId]);

  const handleSliderChange = (value: number) => {
    const snapped = Math.round(value / (defaults?.step ?? 50)) * (defaults?.step ?? 50);
    setSliderValue(snapped);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      recomputeScenario(snapped, selectedTargetId);
    }, 300);
  };

  const handleMultiSliderChange = (sliderId: string, value: number, step: number) => {
    const snapped = Math.round(value / step) * step;
    const updated = { ...sliderValues, [sliderId]: snapped };
    setSliderValues(updated);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      recomputeScenario(0, selectedTargetId, updated);
    }, 300);
  };

  // --- Chart data ---
  const chartWidth = 380;
  const chartHeight = 210;

  // --- Save ---
  const handleSave = async () => {
    if (!template) return;

    const targetName = targets.find(t => t.id === selectedTargetId)?.name ?? '';
    let newScenario: Scenario;

    switch (template.scenarioKind) {
      case 'FLOW_TO_ASSET':
        if (!selectedTargetId) return;
        newScenario = { id: generateId(), name: `${formatCurrencyCompact(sliderValue)}/mo to ${targetName}`, kind: 'FLOW_TO_ASSET', assetId: selectedTargetId, amountMonthly: sliderValue };
        break;
      case 'FLOW_TO_DEBT':
        if (!selectedTargetId) return;
        newScenario = { id: generateId(), name: `${formatCurrencyCompact(sliderValue)}/mo off ${targetName}`, kind: 'FLOW_TO_DEBT', liabilityId: selectedTargetId, amountMonthly: sliderValue };
        break;
      case 'CHANGE_RETIREMENT_AGE':
        newScenario = { id: generateId(), name: `Retire at ${Math.round(sliderValue)}`, kind: 'CHANGE_RETIREMENT_AGE', retirementAge: Math.round(sliderValue) };
        break;
      case 'REDUCE_EXPENSES':
        newScenario = { id: generateId(), name: `Spend ${formatCurrencyCompact(sliderValue)}/mo less`, kind: 'REDUCE_EXPENSES', reductionMonthly: sliderValue };
        break;
      case 'CHANGE_ASSET_GROWTH_RATE':
        if (!selectedTargetId) return;
        newScenario = { id: generateId(), name: `${targetName} at ${sliderValue}%`, kind: 'CHANGE_ASSET_GROWTH_RATE', assetId: selectedTargetId, newAnnualGrowthRatePct: sliderValue };
        break;
      case 'SAVINGS_WHAT_IF': {
        if (!selectedTargetId) return;
        const contrib = sliderValues.contribution ?? 100;
        const rate = sliderValues.growthRate ?? 8;
        newScenario = {
          id: generateId(),
          name: `${formatCurrencyCompact(contrib)}/mo to ${targetName} at ${rate}%`,
          kind: 'SAVINGS_WHAT_IF',
          assetId: selectedTargetId,
          contributionMonthly: contrib,
          newAnnualGrowthRatePct: rate,
        };
        break;
      }
      case 'MORTGAGE_WHAT_IF': {
        if (!selectedTargetId) return;
        const overpay = sliderValues.overpayment ?? 0;
        const rate = sliderValues.interestRate ?? 4.5;
        const term = Math.round(sliderValues.remainingTerm ?? 25);
        const parts: string[] = [];
        if (overpay > 0) parts.push(`${formatCurrencyCompact(overpay)}/mo`);
        parts.push(`${rate}%`);
        parts.push(`${term}yr`);
        newScenario = {
          id: generateId(),
          name: `${targetName} ${parts.join(', ')}`,
          kind: 'MORTGAGE_WHAT_IF',
          liabilityId: selectedTargetId,
          overpaymentMonthly: overpay,
          newAnnualInterestRatePct: rate,
          newRemainingTermYears: term,
        };
        break;
      }
      default:
        return;
    }

    await saveScenario(newScenario);
    await setActiveScenarioId(newScenario.id);
    if (returnToTab) {
      navigation.navigate(returnToTab);
    } else {
      navigation.goBack();
    }
  };

  const handleDiscard = () => {
    if (returnToTab) {
      navigation.navigate(returnToTab);
    } else {
      navigation.goBack();
    }
  };

  if (!template) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <SketchBackground color={palette.bg} style={{flex:1}}>
        <ScreenHeader title="What If" />
        <View style={styles.errorState}>
          <Text style={[theme.typography.body, { color: theme.colors.text.muted }]}>Template not found.</Text>
        </View>
        </SketchBackground>
      </SafeAreaView>
    );
  }

  // --- Delta display ---
  const netWorthDelta = scenarioSummary ? scenarioSummary.endNetWorth - baselineSummary.endNetWorth : 0;
  const assetsDelta = scenarioSummary ? scenarioSummary.endAssets - baselineSummary.endAssets : 0;
  const liabilitiesDelta = scenarioSummary ? scenarioSummary.endLiabilities - baselineSummary.endLiabilities : 0;

  const deltaColor = (delta: number, higherIsBetter: boolean) => {
    if (Math.abs(delta) < 1) return theme.colors.text.muted;
    const isGood = higherIsBetter ? delta > 0 : delta < 0;
    return isGood ? theme.colors.semantic.success : theme.colors.semantic.error;
  };

  const selectedTargetName = targets.find(t => t.id === selectedTargetId)?.name ?? '';
  const hasNoTargets = template.targetSelector !== null && targets.length === 0;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.bg} style={{flex:1}}>
      <ScreenHeader title={template.question} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Empty state: no targets set up */}
        {hasNoTargets ? (
          <SectionCard>
            {template.targetSelector === 'asset' ? (
              <>
                <Text style={[theme.typography.bodyLarge, { color: theme.colors.text.primary, marginBottom: spacing.sm }]}>
                  No assets found
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginBottom: spacing.base }]}>
                  This scenario needs an investment or savings asset set up in your Snapshot. Add one to see how extra contributions would affect your net worth.
                </Text>
                <Button
                  variant="secondary"
                  size="md"
                  onPress={() => navigation.navigate('SnapshotTab', { screen: 'AssetsDetail' })}
                >
                  Set up an asset
                </Button>
              </>
            ) : (
              <>
                <Text style={[theme.typography.bodyLarge, { color: theme.colors.text.primary, marginBottom: spacing.sm }]}>
                  No liabilities found
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginBottom: spacing.base }]}>
                  This scenario needs a mortgage or loan set up in your Snapshot. Add one to see how overpayments would affect your net worth.
                </Text>
                <Button
                  variant="secondary"
                  size="md"
                  onPress={() => navigation.navigate('SnapshotTab', { screen: 'LiabilitiesDetail' })}
                >
                  Set up a liability
                </Button>
              </>
            )}
          </SectionCard>
        ) : null}

        {/* Target picker (only shown if multiple targets) */}
        {!hasNoTargets && targets.length > 1 ? (
          <SectionCard>
            <SectionHeader title={template.targetSelector === 'asset' ? 'Which asset?' : 'Which loan?'} />
            <View style={styles.targetList}>
              {targets.map(target => {
                const isSelected = target.id === selectedTargetId;
                return (
                  <Pressable
                    key={target.id}
                    onPress={() => {
                      setSelectedTargetId(target.id);
                      recomputeScenario(sliderValue, target.id);
                    }}
                    style={({ pressed }) => [
                      styles.targetRow,
                      {
                        backgroundColor: pressed
                          ? theme.colors.bg.subtlePressed
                          : isSelected
                          ? theme.colors.brand.tint
                          : theme.colors.bg.card,
                        borderColor: isSelected ? theme.colors.brand.primary : theme.colors.border.subtle,
                        borderRadius: theme.radius.medium,
                      },
                    ]}
                  >
                    <View style={[styles.targetDot, { borderColor: isSelected ? theme.colors.brand.primary : theme.colors.border.default, backgroundColor: isSelected ? theme.colors.brand.primary : 'transparent' }]} />
                    <Text style={[theme.typography.body, { color: isSelected ? theme.colors.brand.primary : theme.colors.text.primary }]}>
                      {target.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>
        ) : null}

        {/* Slider(s) */}
        {!hasNoTargets && !isMultiSlider ? (
          <SectionCard>
            <View style={styles.sliderLabelRow}>
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                {getSliderSectionTitle(template.scenarioKind)}
                {selectedTargetName ? ` → ${selectedTargetName}` : ''}
              </Text>
              <Text style={[theme.typography.value, { color: theme.colors.brand.primary }]}>
                {formatSliderValue(template.scenarioKind, sliderValue)}
              </Text>
            </View>

            <CustomSlider
              min={defaults?.min ?? 50}
              max={effectiveMax}
              step={defaults?.step ?? 50}
              value={sliderValue}
              onValueChange={handleSliderChange}
              trackColor={theme.colors.brand.primary}
              thumbColor={theme.colors.bg.card}
              trackBgColor={theme.colors.border.default}
              showSteppers
              stepperColor={theme.colors.brand.primary}
            />

            <View style={styles.sliderRangeRow}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.muted }]}>
                {formatSliderValue(template.scenarioKind, defaults?.min ?? 50)}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.text.muted }]}>
                {formatSliderValue(template.scenarioKind, effectiveMax)}
              </Text>
            </View>

            {isClamped ? (
              <Text style={[styles.clampWarning, theme.typography.caption, { color: theme.colors.semantic.warning }]}>
                Limited by your available surplus of {formatCurrencyCompact(monthlySurplus)}/month
              </Text>
            ) : null}
          </SectionCard>
        ) : null}

        {/* Multi-slider mode */}
        {!hasNoTargets && isMultiSlider ? (
          <SectionCard>
            {template.sliders!.map((sc, index) => {
              const val = sliderValues[sc.id] ?? sc.defaultValue;
              const max = sliderEffectiveMax[sc.id] ?? sc.max;
              const isSliderClamped = sc.affordabilityClamped && max < sc.max;
              return (
                <View key={sc.id}>
                  {index > 0 && (
                    <View style={[styles.sliderDivider, { backgroundColor: theme.colors.border.subtle }]} />
                  )}
                  <View style={styles.sliderLabelRow}>
                    <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                      {sc.label}
                      {selectedTargetName ? ` → ${selectedTargetName}` : ''}
                    </Text>
                    <Text style={[theme.typography.value, { color: theme.colors.brand.primary }]}>
                      {formatSliderConfigValue(sc.format, val)}
                    </Text>
                  </View>

                  <CustomSlider
                    min={sc.min}
                    max={max}
                    step={sc.step}
                    value={val}
                    onValueChange={(v: number) => handleMultiSliderChange(sc.id, v, sc.step)}
                    trackColor={theme.colors.brand.primary}
                    thumbColor={theme.colors.bg.card}
                    trackBgColor={theme.colors.border.default}
                    showSteppers
                    stepperColor={theme.colors.brand.primary}
                  />

                  <View style={styles.sliderRangeRow}>
                    <Text style={[theme.typography.caption, { color: theme.colors.text.muted }]}>
                      {formatSliderConfigValue(sc.format, sc.min)}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.text.muted }]}>
                      {formatSliderConfigValue(sc.format, max)}
                    </Text>
                  </View>

                  {isSliderClamped ? (
                    <Text style={[styles.clampWarning, theme.typography.caption, { color: theme.colors.semantic.warning }]}>
                      Limited by your available surplus of {formatCurrencyCompact(monthlySurplus)}/month
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </SectionCard>
        ) : null}

        {/* Mini projection chart */}
        {scenarioSeries.length > 0 ? (
          <SectionCard>
            <View style={styles.chartHeaderRow}>
              <SectionHeader title="Projected net worth" />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine, { backgroundColor: theme.colors.text.disabled }]} />
                  <Text style={[theme.typography.caption, { color: theme.colors.text.muted }]}>Baseline</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine, { backgroundColor: theme.colors.brand.primary }]} />
                  <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>Scenario</Text>
                </View>
              </View>
            </View>

            <View style={styles.chartContainer}>
              <VictoryChart
                width={chartWidth}
                height={chartHeight}
                padding={layout.chartInsetPadding}
                domainPadding={{ y: [0, 40] }}
              >
                <VictoryAxis
                  tickFormat={(age: number) => `${age}`}
                  style={{
                    axis: { stroke: theme.colors.border.default },
                    tickLabels: { fontSize: theme.typography.caption.fontSize, fill: theme.colors.text.muted },
                    grid: { stroke: 'transparent' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickFormat={(v: number) => formatCurrencyCompact(v)}
                  style={{
                    axis: { stroke: theme.colors.border.default },
                    tickLabels: { fontSize: theme.typography.caption.fontSize, fill: theme.colors.text.muted },
                    grid: { stroke: theme.colors.border.subtle, strokeDasharray: '4,4' },
                  }}
                />
                {/* Baseline (muted) */}
                <VictoryLine
                  data={baselineSeries.map(p => ({ x: p.age, y: p.netWorth }))}
                  style={{ data: { stroke: theme.colors.text.disabled, strokeWidth: 1.5 } }}
                />
                {/* Scenario (brand primary) */}
                <VictoryLine
                  data={scenarioSeries.map(p => ({ x: p.age, y: p.netWorth }))}
                  style={{ data: { stroke: theme.colors.brand.primary, strokeWidth: 2 } }}
                />
              </VictoryChart>
            </View>
          </SectionCard>
        ) : null}

        {/* Comparison panel */}
        {scenarioSummary ? (
          <SectionCard>
            <SectionHeader title="Projected outcome" />
            <Text style={[styles.comparisonSubtext, theme.typography.caption, { color: theme.colors.text.muted }]}>
              At age {baselineInputs.endAge} — projected, in today's money
            </Text>

            <View style={styles.comparisonTable}>
              {/* Net worth row */}
              <View style={[styles.comparisonRow, { borderBottomColor: theme.colors.border.subtle }]}>
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary, flex: 1 }]}>Net worth</Text>
                <Text style={[theme.typography.value, { color: theme.colors.text.muted, marginRight: spacing.sm }]}>
                  {formatCurrencyCompact(baselineSummary.endNetWorth)}
                </Text>
                <Text style={[theme.typography.value, { color: theme.colors.text.primary, marginRight: spacing.sm }]}>
                  {formatCurrencyCompact(scenarioSummary.endNetWorth)}
                </Text>
                <Text style={[theme.typography.value, { color: deltaColor(netWorthDelta, true), minWidth: 60, textAlign: 'right' }]}>
                  {formatCurrencyCompactSigned(netWorthDelta)}
                </Text>
              </View>

              {/* Assets row */}
              <View style={[styles.comparisonRow, { borderBottomColor: theme.colors.border.subtle }]}>
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary, flex: 1 }]}>Assets</Text>
                <Text style={[theme.typography.value, { color: theme.colors.text.muted, marginRight: spacing.sm }]}>
                  {formatCurrencyCompact(baselineSummary.endAssets)}
                </Text>
                <Text style={[theme.typography.value, { color: theme.colors.text.primary, marginRight: spacing.sm }]}>
                  {formatCurrencyCompact(scenarioSummary.endAssets)}
                </Text>
                <Text style={[theme.typography.value, { color: deltaColor(assetsDelta, true), minWidth: 60, textAlign: 'right' }]}>
                  {formatCurrencyCompactSigned(assetsDelta)}
                </Text>
              </View>

              {/* Liabilities row */}
              <View style={[styles.comparisonRow, { borderBottomColor: 'transparent' }]}>
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary, flex: 1 }]}>Liabilities</Text>
                <Text style={[theme.typography.value, { color: theme.colors.text.muted, marginRight: spacing.sm }]}>
                  {formatCurrencyCompact(baselineSummary.endLiabilities)}
                </Text>
                <Text style={[theme.typography.value, { color: theme.colors.text.primary, marginRight: spacing.sm }]}>
                  {formatCurrencyCompact(scenarioSummary.endLiabilities)}
                </Text>
                <Text style={[theme.typography.value, { color: deltaColor(liabilitiesDelta, false), minWidth: 60, textAlign: 'right' }]}>
                  {formatCurrencyCompactSigned(liabilitiesDelta)}
                </Text>
              </View>
            </View>

            {/* Column labels */}
            <View style={styles.comparisonLabels}>
              <View style={{ flex: 1 }} />
              <Text style={[theme.typography.caption, { color: theme.colors.text.muted, marginRight: spacing.sm }]}>Baseline</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginRight: spacing.sm }]}>Scenario</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.text.muted, minWidth: 60, textAlign: 'right' }]}>Change</Text>
            </View>
          </SectionCard>
        ) : null}

        {/* Bottom spacer for action bar */}
        <View style={styles.actionBarSpacer} />
      </ScrollView>

      {/* Fixed action bar */}
      <View style={[styles.actionBar, { backgroundColor: theme.colors.bg.card, borderTopColor: theme.colors.border.default }]}>
        <Button
          variant="secondary"
          size="md"
          onPress={handleDiscard}
          style={styles.actionButton}
        >
          Discard
        </Button>
        <Button
          variant="primary"
          size="md"
          onPress={handleSave}
          disabled={(template?.targetSelector !== null && !selectedTargetId) || (isMultiSlider ? (template?.scenarioKind === 'MORTGAGE_WHAT_IF' ? false : (sliderValues.contribution ?? 0) <= 0) : sliderValue <= 0)}
          style={styles.actionButton}
        >
          Save scenario
        </Button>
      </View>
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
    padding: layout.screenPadding,
    paddingTop: layout.screenPaddingTop,
    paddingBottom: layout.screenPaddingBottom,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    gap: spacing.sm,
  },
  targetDot: {
    width: 10,
    height: 10,
    borderRadius: 5, // geometric: width / 2
    borderWidth: 1.5,
  },
  sliderDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.base,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sliderRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  clampWarning: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: spacing.base,
    marginHorizontal: -spacing.xl,
    marginBottom: -spacing.xl,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1, // geometric: height / 2
  },
  comparisonSubtext: {
    marginTop: spacing.xs,
    marginBottom: spacing.base,
  },
  comparisonLabels: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  comparisonTable: {
    gap: spacing.zero,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  actionBarSpacer: {
    height: 80,
  },
  actionBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: layout.screenPadding,
    borderTopWidth: 1,
    ...Platform.select({
      ios: {
        paddingBottom: spacing.xl,
      },
    }),
  },
  actionButton: {
    flex: 1,
  },
});
