import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VictoryChart, VictoryLine, VictoryAxis } from 'victory-native';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SectionCard from '../components/SectionCard';
import Button from '../components/Button';
import { useSnapshot } from '../context/SnapshotContext';
import { getTemplateById } from '../domain/scenario/templates';
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

// Simple custom slider using PanResponder (no external package needed)
type SliderProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (value: number) => void;
  trackColor: string;
  thumbColor: string;
  trackBgColor: string;
};

function CustomSlider({ min, max, step, value, onValueChange, trackColor, thumbColor, trackBgColor }: SliderProps) {
  const trackWidthRef = useRef<number>(0);

  const clampAndSnap = (rawValue: number): number => {
    const snapped = Math.round((rawValue - min) / step) * step + min;
    return Math.max(min, Math.min(max, snapped));
  };

  const positionFromValue = (v: number): number => {
    if (trackWidthRef.current === 0) return 0;
    return ((v - min) / (max - min)) * trackWidthRef.current;
  };

  const thumbPos = positionFromValue(value);
  const fillPct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const rawValue = min + (x / trackWidthRef.current) * (max - min);
      onValueChange(clampAndSnap(rawValue));
    },
    onPanResponderMove: (_, gestureState) => {
      if (trackWidthRef.current === 0) return;
      // Use accumulated dx relative to start position
      const startValue = value;
      const dx = gestureState.dx;
      const rawValue = startValue + (dx / trackWidthRef.current) * (max - min);
      onValueChange(clampAndSnap(rawValue));
    },
  }), [min, max, step, value, onValueChange]);

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
  };

  return (
    <View style={sliderStyles.container} {...panResponder.panHandlers}>
      <View style={[sliderStyles.track, { backgroundColor: trackBgColor }]} onLayout={handleTrackLayout}>
        <View style={[sliderStyles.fill, { width: `${fillPct}%` as any, backgroundColor: trackColor }]} />
        <View
          style={[
            sliderStyles.thumb,
            { left: thumbPos - 11, backgroundColor: thumbColor, borderColor: trackColor },
          ]}
        />
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 11, // half of thumb width for edge alignment
  },
  track: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: -9,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});

type RouteParams = {
  templateId: string;
  scenarioId?: string;
};

type TargetItem = {
  id: string;
  name: string;
};

function generateId(): string {
  return `scenario_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export default function ScenarioExplorerScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { templateId } = route.params as RouteParams;
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

  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => targets[0]?.id ?? '');

  // Auto-select first target when targets load
  useEffect(() => {
    if (targets.length > 0 && !selectedTargetId) {
      setSelectedTargetId(targets[0].id);
    }
  }, [targets]);

  // --- Slider ---
  const defaults = template?.defaults;
  const [sliderValue, setSliderValue] = useState<number>(defaults?.amountMonthly ?? 100);

  // Affordability clamp: slider max is min(template.max, monthly surplus)
  const monthlySurplus = useMemo(() => selectMonthlySurplus(state), [state]);
  const effectiveMax = useMemo(() => {
    if (!defaults) return 1000;
    return Math.max(defaults.min, Math.min(defaults.max, Math.floor(monthlySurplus / (defaults.step)) * defaults.step));
  }, [defaults, monthlySurplus]);
  const isClamped = defaults ? effectiveMax < defaults.max : false;

  // --- Scenario projection (debounced) ---
  const [scenarioSeries, setScenarioSeries] = useState<ProjectionSeriesPoint[]>([]);
  const [scenarioSummary, setScenarioSummary] = useState<ProjectionSummary | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recomputeScenario = useCallback(
    (amount: number, targetId: string) => {
      if (!template || !targetId) return;

      const scenario: Scenario =
        template.scenarioKind === 'FLOW_TO_ASSET'
          ? { id: '__preview__', name: 'Preview', kind: 'FLOW_TO_ASSET', assetId: targetId, amountMonthly: amount }
          : { id: '__preview__', name: 'Preview', kind: 'FLOW_TO_DEBT', liabilityId: targetId, amountMonthly: amount };

      const scenarioInputs = applyScenarioToProjectionInputs(baselineInputs, scenario, state);
      setScenarioSeries(computeProjectionSeries(scenarioInputs));
      setScenarioSummary(computeProjectionSummary(scenarioInputs));
    },
    [template, baselineInputs, state]
  );

  // Trigger on mount
  useEffect(() => {
    if (selectedTargetId) {
      recomputeScenario(sliderValue, selectedTargetId);
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

  // --- Chart data ---
  const chartWidth = 320;
  const chartHeight = 160;

  // --- Save ---
  const handleSave = async () => {
    if (!template || !selectedTargetId) return;

    const newScenario: Scenario =
      template.scenarioKind === 'FLOW_TO_ASSET'
        ? {
            id: generateId(),
            name: `${formatCurrencyCompact(sliderValue)}/mo to ${targets.find(t => t.id === selectedTargetId)?.name ?? 'asset'}`,
            kind: 'FLOW_TO_ASSET',
            assetId: selectedTargetId,
            amountMonthly: sliderValue,
          }
        : {
            id: generateId(),
            name: `${formatCurrencyCompact(sliderValue)}/mo off ${targets.find(t => t.id === selectedTargetId)?.name ?? 'loan'}`,
            kind: 'FLOW_TO_DEBT',
            liabilityId: selectedTargetId,
            amountMonthly: sliderValue,
          };

    await saveScenario(newScenario);
    await setActiveScenarioId(newScenario.id);
    navigation.goBack();
  };

  const handleDiscard = () => {
    navigation.goBack();
  };

  if (!template) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
        <ScreenHeader title="What If" />
        <View style={styles.errorState}>
          <Text style={[theme.typography.body, { color: theme.colors.text.muted }]}>Template not found.</Text>
        </View>
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
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
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

        {/* Slider */}
        {!hasNoTargets ? (
          <SectionCard>
          <SectionHeader title="Monthly amount" />

          <View style={styles.sliderValueRow}>
            <Text style={[theme.typography.valueLarge, { color: theme.colors.brand.primary }]}>
              {formatCurrencyCompact(sliderValue)}/mo
            </Text>
            {selectedTargetName ? (
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                → {selectedTargetName}
              </Text>
            ) : null}
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
          />

          <View style={styles.sliderRangeRow}>
            <Text style={[theme.typography.caption, { color: theme.colors.text.muted }]}>
              {formatCurrencyCompact(defaults?.min ?? 50)}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.text.muted }]}>
              {formatCurrencyCompact(effectiveMax)}
            </Text>
          </View>

          {isClamped ? (
            <Text style={[styles.clampWarning, theme.typography.caption, { color: theme.colors.semantic.warning }]}>
              Limited by your available surplus of {formatCurrencyCompact(monthlySurplus)}/month
            </Text>
          ) : null}
        </SectionCard>
        ) : null}

        {/* Mini projection chart */}
        {scenarioSeries.length > 0 ? (
          <SectionCard>
            <SectionHeader title="Projected net worth" />
            <Text style={[styles.chartSubtext, theme.typography.caption, { color: theme.colors.text.muted }]}>
              Baseline vs this scenario — in today's money
            </Text>

            <View style={styles.chartContainer}>
              <VictoryChart
                width={chartWidth}
                height={chartHeight}
                padding={layout.chartInsetPadding}
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

            {/* Chart legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: theme.colors.text.disabled }]} />
                <Text style={[theme.typography.caption, { color: theme.colors.text.muted }]}>Baseline</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: theme.colors.brand.primary }]} />
                <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>This scenario</Text>
              </View>
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
          disabled={!selectedTargetId || sliderValue <= 0}
          style={styles.actionButton}
        >
          Save scenario
        </Button>
      </View>
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
    borderRadius: 5,
    borderWidth: 1.5,
  },
  sliderValueRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.base,
    gap: spacing.xs,
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
  chartSubtext: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.sm,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
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
    gap: 0,
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
