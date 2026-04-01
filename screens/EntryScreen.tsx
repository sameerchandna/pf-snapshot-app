// Phase 6.3: Entry / Launch Screen (Skeleton Only)
// Chart-first entry screen with CTAs to navigate to Snapshot and Projection

import React, { useMemo, useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';
import { VictoryAxis, VictoryChart, VictoryLabel, VictoryLine } from 'victory-native';
import { useMode } from '../context/ModeContext';

import Button from '../components/Button';
import DemoModeBanner from '../components/DemoModeBanner';
import SectionCard from '../components/SectionCard';
import SectionHeader from '../components/SectionHeader';
import Icon from '../components/Icon';
import { useTheme } from '../ui/theme/useTheme';
import { typography } from '../ui/theme/theme';
import { useSnapshot } from '../context/SnapshotContext';
import { computeProjectionSeries } from '../engines/projectionEngine';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { formatCurrencyCompact } from '../ui/formatters';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { DEMO_PROFILES, DEFAULT_DEMO_PROFILE_ID, type DemoProfileId } from '../demo/demoProfiles';
import { interpretProjection } from '../insights/interpretProjection';
import { selectExpenses } from '../engines/selectors';

// Chart color palette (reused from ProjectionResultsScreen)
function getChartPalette(theme: any) {
  return {
    baselineLine: theme.colors.brand.primary,
    // Phase 7.11: Assets and liabilities use domain-specific colors
    assetsLine: theme.colors.domain.asset,
    liabilitiesLine: theme.colors.domain.liability,
    axis: theme.colors.border.default,
    grid: theme.colors.border.subtle,
    tickLabels: theme.colors.text.secondary,
  };
}

export default function EntryScreen() {
  const { theme } = useTheme();
  const chartPalette = getChartPalette(theme);
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const { state, resetDemoProfile } = useSnapshot();
  const { mode, setMode, hasUserData, hasMeaningfulUserData } = useMode();
  
  // Phase 6.4: Maintain selected demo profile ID locally
  const [selectedDemoProfileId, setSelectedDemoProfileId] = useState<DemoProfileId>(DEFAULT_DEMO_PROFILE_ID);
  
  // Phase 6.4: Handle demo profile selection
  const handleProfileSelect = (demoProfileId: DemoProfileId) => {
    setSelectedDemoProfileId(demoProfileId);
    if (resetDemoProfile) {
      resetDemoProfile(demoProfileId);
    }
  };
  
  // Phase 6.5: Handle mode toggle
  const handleModeToggle = (newMode: 'user' | 'demo') => {
    if (newMode === 'user' && !hasUserData) {
      return; // Cannot switch to user mode if no user data exists
    }
    setMode(newMode);
  };

  // Build projection inputs from state
  const projectionInputs = useMemo(
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

  // Compute baseline projection series
  const baselineSeries = useMemo(() => {
    return computeProjectionSeries(projectionInputs);
  }, [projectionInputs]);

  // Build chart data (baseline only, simplified)
  const chartData = useMemo(() => {
    if (baselineSeries.length === 0) {
      return { series: [], domainMin: 0, domainMax: 0 };
    }

    // Default view: Net Worth (blue) + Assets (grey) + Liabilities (lighter grey)
    const assetsData = baselineSeries.map(p => ({ x: p.age, y: p.assets }));
    const baselineNetWorthData = baselineSeries.map(p => ({ x: p.age, y: p.netWorth }));
    const liabilitiesData = baselineSeries.map(p => ({ x: p.age, y: p.liabilities }));

    // Compute Y-axis domain from baseline values
    const baselineValues = baselineSeries.map(p => p.netWorth);
    const allYValues = [
      ...baselineValues,
      ...baselineSeries.map(p => p.assets),
      ...baselineSeries.map(p => p.liabilities),
    ];
    
    // Compute true min/max across all values
    const rawMinY = allYValues.length > 0 ? Math.min(...allYValues) : 0;
    const rawMaxY = allYValues.length > 0 ? Math.max(...allYValues) : 0;
    
    // Apply 5% padding after truth (preserves semantic zero)
    const padding = (rawMaxY - rawMinY) * 0.05 || 0.01;
    const domainMin = rawMinY - padding;
    const domainMax = rawMaxY + padding;

    // Build structured series array (baseline only)
    const series = [
      {
        seriesId: 'netWorth' as const,
        label: 'Net worth',
        color: theme.colors.text.primary, // Phase 7.11: Baseline net worth uses text.primary (charcoal/white)
        data: baselineNetWorthData,
        style: {
          strokeWidth: 2.6,
          opacity: 1.0,
        },
        shouldRender: baselineSeries.length > 0,
      },
      {
        seriesId: 'assets' as const,
        label: 'Assets',
        color: chartPalette.assetsLine,
        data: assetsData,
        style: {
          strokeWidth: 1.8,
          opacity: 1.0,
        },
        shouldRender: true,
      },
      {
        seriesId: 'liabilities' as const,
        label: 'Liabilities',
        color: chartPalette.liabilitiesLine,
        data: liabilitiesData,
        style: {
          strokeWidth: 1.5,
          opacity: 1.0,
        },
        shouldRender: true,
      },
    ];

    return { series, domainMin, domainMax };
  }, [baselineSeries, chartPalette]);

  // Chart dimensions (reused from ProjectionResultsScreen)
  const chartWidth: number = Math.max(320, windowWidth - 24);
  const chartHeight: number = Math.round(Math.min(300, Math.max(240, windowWidth * 0.70)));
  const chartPadding = { top: 8, bottom: 48, left: 44, right: 16 } as const;

  // Phase 10.1: Interpretation engine (replaces Phase 6.8 key moment text)
  const interpretation = useMemo(() => {
    if (baselineSeries.length === 0) return null;
    return interpretProjection(
      baselineSeries,
      { endAssets: 0, endLiabilities: 0, endNetWorth: 0,
        totalContributions: 0, totalPrincipalRepaid: 0,
        totalScheduledMortgagePayment: 0, totalMortgageOverpayments: 0 },
      selectExpenses(state),
      state.projection.currentAge,
      state.projection.endAge,
      [], // no goals on entry screen — use computed defaults internally
      undefined, // liquidAssetsSeries
      state.projection.retirementAge,
    );
  }, [baselineSeries, state]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <View style={styles.content}>
        {/* Phase 6.5: Mode toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => handleModeToggle('user')}
            disabled={!hasUserData}
            style={[
              styles.toggleOption,
              { borderRadius: theme.radius.base },
              mode === 'user' && styles.toggleOptionActive,
              !hasUserData && styles.toggleOptionDisabled,
              { borderColor: theme.colors.border.subtle },
              mode === 'user' && { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.brand.primary },
            ]}
            accessibilityRole="button"
            accessibilityLabel="User Data"
            accessibilityState={{ disabled: !hasUserData, selected: mode === 'user' }}
          >
            <Text
              style={[
                styles.toggleOptionText,
                { color: theme.colors.text.muted },
                !hasUserData && { color: theme.colors.text.disabled },
                mode === 'user' && { color: theme.colors.brand.primary, fontWeight: '600' },
              ]}
            >
              User Data
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleModeToggle('demo')}
            style={[
              styles.toggleOption,
              { borderRadius: theme.radius.base },
              mode === 'demo' && styles.toggleOptionActive,
              { borderColor: theme.colors.border.subtle },
              mode === 'demo' && { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.brand.primary },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Demo / Explore"
            accessibilityState={{ selected: mode === 'demo' }}
          >
            <Text
              style={[
                styles.toggleOptionText,
                { color: theme.colors.text.muted },
                mode === 'demo' && { color: theme.colors.brand.primary, fontWeight: '600' },
              ]}
            >
              Demo / Explore
            </Text>
          </Pressable>
        </View>
        
        {/* Phase 6.10.3: Demo profile selector (persistent container) */}
        <View style={styles.profileSelectorContainer}>
          {mode === 'demo' && resetDemoProfile ? (
            <View style={styles.profileSelector}>
              {Object.values(DEMO_PROFILES).map((profile) => {
                const isSelected = selectedDemoProfileId === profile.id;
                return (
                  <Pressable
                    key={profile.id}
                    onPress={() => handleProfileSelect(profile.id)}
                    style={[
                      styles.profileIcon,
                      { borderRadius: theme.radius.pill },
                      isSelected && {
                        backgroundColor: theme.colors.bg.subtle,
                        borderColor: theme.colors.brand.primary,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={profile.name}
                  >
                    <Icon
                      name={profile.icon as any}
                      size="medium"
                      color={isSelected ? theme.colors.brand.primary : theme.colors.text.secondary}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.profileSelectorSpacer} />
          )}
        </View>
        
        {/* Phase 6.10.5: Demo mode indicator (wrapped for subtle presentation) */}
        {mode === 'demo' ? (
          <View style={styles.demoBannerWrapper}>
            <DemoModeBanner />
          </View>
        ) : null}
        
        {/* Phase 6.10.1: Hero card with title, subtitle, and chart */}
        <SectionCard style={[styles.heroCard, theme.shadows.medium]}>
          <SectionHeader
            title="Projection"
            subtitle="Assets, liabilities, and net worth over time"
          />
          {/* Phase 7.1: Inline legend */}
          {chartData.series.length > 0 && (
            <View style={styles.legendRow}>
              {chartData.series
                .filter(s => s.shouldRender)
                .map((series) => (
                  <View key={series.seriesId} style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: series.color, borderRadius: theme.radius.small }]} />
                    <Text style={[styles.legendText, { color: theme.colors.text.muted }]}>
                      {series.label}
                    </Text>
                  </View>
                ))}
            </View>
          )}
          <View style={[styles.chartContainer, { minHeight: chartHeight }]}>
            {chartData.series.length > 0 ? (
              <View style={{ height: chartHeight, width: chartWidth }}>
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
                    label="Age"
                    axisLabelComponent={<VictoryLabel dy={24} style={{ fontSize: 10, fill: chartPalette.tickLabels }} />}
                    style={{
                      axis: { stroke: chartPalette.axis },
                      tickLabels: { fontSize: 11, fill: chartPalette.tickLabels },
                      grid: { stroke: 'transparent' },
                    }}
                  />
                  <VictoryAxis
                    dependentAxis
                    tickFormat={t => formatCurrencyCompact(Number(t))}
                    style={{
                      axis: { stroke: chartPalette.axis },
                      tickLabels: { fontSize: 10, fill: chartPalette.tickLabels },
                      grid: { stroke: chartPalette.grid, strokeDasharray: '2,4' },
                    }}
                  />

                  {/* Render series */}
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
                </VictoryChart>
              </View>
            ) : (
              <View style={[styles.placeholderContainer, { height: chartHeight }]}>
                {/* Placeholder for empty state - will be handled by demo profiles */}
              </View>
            )}
          </View>
        </SectionCard>

        {/* Phase 6.10.3: Bottom zone (persistent containers) */}
        {/* Empty state message (only shown in user mode without meaningful data) */}
        {mode === 'user' && !hasMeaningfulUserData && (
          <View style={styles.emptyStateContainer}>
            <Text style={[styles.emptyStateText, { color: theme.colors.text.muted }]}>
              Add your data to view your projection.
            </Text>
          </View>
        )}

        {/* Phase 10.1: Interpretation headline (replaces Phase 6.8 key moment text) */}
        <View style={styles.insightsContainer}>
          {interpretation && (
            <Text style={[styles.insightText, { color: theme.colors.text.muted }]}>
              {interpretation.headline}
            </Text>
          )}
        </View>

        {/* Flex spacer to anchor CTAs to bottom */}
        <View style={{ flexGrow: 1 }} />

        {/* CTA buttons (persistent container with space for two buttons) */}
        <View style={styles.ctaContainer}>
          <Button
            variant="secondary"
            size="md"
            onPress={() => navigation.navigate('MainTabs', { screen: 'SnapshotTab' })}
            style={styles.ctaButton}
          >
            Go to Snapshot
          </Button>
          <View style={mode === 'user' && !hasMeaningfulUserData ? styles.ctaButtonSpacer : null}>
            {!(mode === 'user' && !hasMeaningfulUserData) && (
              <Button
                variant="text"
                size="md"
                onPress={() => navigation.navigate('MainTabs', { screen: 'ProjectionTab' })}
                style={styles.ctaButton}
              >
                Go to Projection
              </Button>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: layout.screenPadding,
    paddingTop: layout.screenPaddingTop,
  },
  heroCard: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    // Shadow applied inline with theme.shadows.medium
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.base,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.base,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tiny,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    // borderRadius applied inline with theme.radius.small
  },
  legendText: {
    ...typography.bodySmall,
  },
  chartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaContainer: {
    gap: layout.md,
    paddingTop: spacing.base,
  },
  ctaButton: {
    width: '100%',
  },
  ctaButtonSpacer: {
    width: '100%',
    // Match button height: paddingVertical (10*2) + line height (~14) + gap (layout.md)
    minHeight: 34,
  },
  profileSelectorContainer: {
    minHeight: 58,
  },
  profileSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: layout.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  profileSelectorSpacer: {
    minHeight: 58,
  },
  demoBannerWrapper: {
    marginTop: spacing.tiny,
    marginBottom: spacing.tiny,
  },
  profileIcon: {
    width: 44,
    height: 44,
    // borderRadius applied inline with theme.radius.pill
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'transparent',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: spacing.tiny,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: spacing.tiny,
    paddingHorizontal: spacing.sm,
    // borderRadius applied inline with theme.radius.base
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  toggleOptionActive: {
    // Active state handled via inline styles
  },
  toggleOptionDisabled: {
    // Disabled state handled via inline styles
  },
  toggleOptionText: {
    ...typography.label,
  },
  insightsContainer: {
    paddingTop: spacing.base,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
    minHeight: 0,
  },
  insightText: {
    ...typography.body,
    textAlign: 'center',
  },
  emptyStateContainer: {
    paddingTop: spacing.base,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.base,
  },
  emptyStateText: {
    ...typography.body,
    textAlign: 'center',
  },
});
