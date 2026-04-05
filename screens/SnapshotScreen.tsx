import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSnapshot } from '../context/SnapshotContext';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SectionCard from '../components/SectionCard';
import SketchBackground from '../components/SketchBackground';
import SketchCard from '../components/SketchCard';
import { selectSnapshotTotals, selectMonthlySurplusWithScenario } from '../engines/selectors';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { formatCurrencyFull, formatCurrencyFullSigned, formatCurrencyFullAlwaysSigned, formatPercent } from '../ui/formatters';
import { getActiveScenario, getScenarios, getActiveScenarioId } from '../scenarioState';
import type { Scenario } from '../domain/scenario/types';
import { UI_TOLERANCE } from '../constants';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import CashflowFlowchart from '../components/cashflow/CashflowFlowchart';
import SketchBranch from '../components/SketchBranch';
import Button from '../components/Button';

export default function SnapshotScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { state } = useSnapshot();
  const [activeScenario, setActiveScenario] = useState<Scenario | undefined>(undefined);
  const [balanceContainerWidth, setBalanceContainerWidth] = useState(0);
  const [assetsRowCenterY, setAssetsRowCenterY] = useState(0);
  const [netWorthRowTop, setNetWorthRowTop] = useState(0);

  // Load active scenario whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      async function loadActiveScenario() {
        const scenarios = await getScenarios();
        const activeId = await getActiveScenarioId();
        const scenario = getActiveScenario(scenarios, activeId);
        setActiveScenario(scenario);
      }
      loadActiveScenario();
    }, [])
  );

  const totals = selectSnapshotTotals(state);
  
  // Use scenario-adjusted monthly surplus for display
  const monthlySurplusValue = selectMonthlySurplusWithScenario(state, activeScenario);

  const grossIncomeText: string = formatCurrencyFullAlwaysSigned(totals.grossIncome);
  const pensionText: string = formatCurrencyFullAlwaysSigned(-totals.pension);
  const netIncomeText: string = formatCurrencyFullAlwaysSigned(totals.netIncome);
  const expensesText: string = formatCurrencyFullAlwaysSigned(-totals.expenses);
  const liabilityReductionText: string = formatCurrencyFullAlwaysSigned(-totals.liabilityReduction);
  const assetContributionText: string = formatCurrencyFullAlwaysSigned(-totals.assetContributions);
  const totalAssetsText: string = formatCurrencyFull(totals.assets);
  const totalLiabilitiesText: string = formatCurrencyFull(totals.liabilities);
  const deductionsText: string = formatCurrencyFullAlwaysSigned(-totals.deductions);

  const availableCashText: string = formatCurrencyFullAlwaysSigned(totals.availableCash);
  const monthlySurplusText: string = formatCurrencyFullAlwaysSigned(monthlySurplusValue);
  const netWorthText: string = formatCurrencyFullSigned(totals.netWorth);

  // Insights (Snapshot-only): calm, observational, optional.
  const isMeaningful = (value: number): boolean => Math.abs(value) >= UI_TOLERANCE;

  const insights: string[] = (() => {
    const lines: string[] = [];
    const pctOfNetIncome = (amount: number): string | null => {
      if (totals.netIncome > UI_TOLERANCE) {
        const pct = Math.round((Math.abs(amount) / totals.netIncome) * 100);
        return `${formatPercent(pct, { decimals: 0 })} of net income`;
      }
      return null;
    };

    // 1) Expense share
    if (isMeaningful(totals.expenses)) {
      const expensesAmt = formatCurrencyFull(totals.expenses);
      const pctText = pctOfNetIncome(totals.expenses);
      lines.push(pctText ? `Expenses account for ${expensesAmt} per month (${pctText})` : `Expenses account for ${expensesAmt} per month`);
    }

    // 2) Contribution flow (assets + debt reduction)
    const contributionFlow = totals.assetContributions + totals.liabilityReduction;
    if (isMeaningful(contributionFlow)) {
      const pctText = pctOfNetIncome(contributionFlow);
      lines.push(
        pctText
          ? `${formatCurrencyFull(contributionFlow)} per month goes to assets and debt reduction (${pctText})`
          : `${formatCurrencyFull(contributionFlow)} per month goes to assets and debt reduction`
      );
    }

    // 3) Monthly surplus (unallocated or gap) - use scenario-adjusted value
    if (isMeaningful(monthlySurplusValue)) {
      const amt = formatCurrencyFull(Math.abs(monthlySurplusValue));
      const pctText = pctOfNetIncome(monthlySurplusValue);
      if (monthlySurplusValue >= 0) {
        lines.push(
          pctText ? `After all flows, ${amt} remains unallocated each month (${pctText})` : `After all flows, ${amt} remains unallocated each month`
        );
      } else {
        lines.push(pctText ? `After all flows, there is a ${amt} gap each month (${pctText})` : `After all flows, there is a ${amt} gap each month`);
      }
    }

    return lines;
  })();

  const palette = useScreenPalette();
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.accent} style={styles.container}>
      <StatusBar style="auto" />
      <ScreenHeader
        title="Where am I now?"
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* CASH FLOW SECTION */}
        <SectionCard style={{ marginTop: layout.sectionGap }} fillColor="transparent">
          <SectionHeader title="Your Monthly Cashflow" />
          <CashflowFlowchart
            grossIncome={grossIncomeText}
            deductions={deductionsText}
            pension={pensionText}
            netIncome={netIncomeText}
            expenses={expensesText}
            availableCash={availableCashText}
            liabilityReduction={liabilityReductionText}
            assetContribution={assetContributionText}
            remainingCash={monthlySurplusText}
            onPressGrossIncome={() => navigation.navigate('GrossIncomeDetail')}
            onPressPension={() => navigation.navigate('PensionDetail')}
            onPressNetIncome={() => navigation.navigate('NetIncomeDetail')}
            onPressExpenses={() => navigation.navigate('ExpensesDetail')}
            onPressAssetContribution={() => navigation.navigate('AssetContributionDetail')}
            onPressLiabilityReduction={() => navigation.navigate('LiabilityReductionDetail')}
          />
        </SectionCard>

        {/* BALANCE SHEET SECTION */}
        <SectionCard fillColor="transparent">
          <SectionHeader title="Your Balance Sheet" />

          <View style={styles.balanceFlowContainer} onLayout={e => setBalanceContainerWidth(e.nativeEvent.layout.width)}>
            {/* Converging V: Assets + Liabilities → Net Worth */}
            {assetsRowCenterY > 0 && netWorthRowTop > 0 && balanceContainerWidth > 0 && (
              <View style={{
                position: 'absolute',
                left: balanceContainerWidth * 0.44,
                top: assetsRowCenterY + spacing.xs,
                zIndex: 1,
              }}>
                <SketchBranch
                  mode="converge"
                  width={balanceContainerWidth * 0.12}
                  height={netWorthRowTop - assetsRowCenterY - 2 * spacing.xs}
                  color={theme.colors.text.muted}
                  strokeWidth={1.5}
                />
              </View>
            )}

            {/* Assets | Liabilities — mirrors Deductions/Pension row layout */}
            <View style={styles.balanceThreeColRow} onLayout={e => setAssetsRowCenterY(e.nativeEvent.layout.y + e.nativeEvent.layout.height / 2)}>
              <View style={styles.balanceThreeColSide}>
                <Pressable onPress={() => navigation.navigate('AssetsDetail')} style={({ pressed }) => pressed && { opacity: 0.7 }}>
                  <SketchCard
                    borderColor={theme.colors.semantic.success}
                    fillColor={theme.colors.bg.card}
                    style={styles.balanceNode}
                  >
                    <Text style={[theme.typography.value, { color: theme.colors.domain.asset, textAlign: 'center' }]}>{totalAssetsText}</Text>
                    <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary, textAlign: 'center' }]}>Assets</Text>
                  </SketchCard>
                </Pressable>
              </View>
              <View style={styles.balanceThreeColMiddle} />
              <View style={styles.balanceThreeColSide}>
                <Pressable onPress={() => navigation.navigate('LiabilitiesDetail')} style={({ pressed }) => pressed && { opacity: 0.7 }}>
                  <SketchCard
                    borderColor={theme.colors.semantic.error}
                    fillColor={theme.colors.bg.card}
                    style={styles.balanceNode}
                  >
                    <Text style={[theme.typography.value, { color: theme.colors.domain.liability, textAlign: 'center' }]}>{totalLiabilitiesText}</Text>
                    <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary, textAlign: 'center' }]}>Liabilities</Text>
                  </SketchCard>
                </Pressable>
              </View>
            </View>

            {/* Net Worth — mirrors Remaining Cash node */}
            <View style={styles.balanceNetWorthRow} onLayout={e => setNetWorthRowTop(e.nativeEvent.layout.y)}>
              <SketchCard
                borderColor={theme.colors.brand.primary}
                fillColor={theme.colors.bg.card}
                style={styles.balanceNetWorthNode}
              >
                <Text style={[theme.typography.value, { color: theme.colors.brand.primary, textAlign: 'center' }]}>{netWorthText}</Text>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary, textAlign: 'center' }]}>Net Worth</Text>
              </SketchCard>
            </View>
          </View>
        </SectionCard>

        {/* INSIGHTS (Snapshot only) */}
        {insights.length > 0 ? (
          <SectionCard fillColor="transparent">
            <SectionHeader title="Insights" />
            <View style={styles.insightsList}>
              {insights.map((line, idx) => (
                <Text key={`${idx}-${line}`} style={[styles.bodyText, theme.typography.body, { color: theme.colors.text.secondary }]}>
                  • {line}
                </Text>
              ))}
            </View>
          </SectionCard>
        ) : null}

        {/* VIEW REPORT */}
        <Button
          variant="secondary"
          size="md"
          onPress={() => navigation.navigate('Report')}
          style={styles.viewReportButton}
        >
          View full report
        </Button>
      </ScrollView>
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
    padding: spacing.base,
    paddingTop: layout.screenPaddingTop,
  },
  balanceFlowContainer: {
    position: 'relative',
    width: '90%',
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingBottom: spacing.base,
  },
  balanceThreeColRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: spacing.huge,
  },
  balanceThreeColSide: {
    width: '42.5%',
  },
  balanceThreeColMiddle: {
    width: '15%',
  },
  balanceNode: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  balanceNetWorthRow: {
    alignItems: 'center',
  },
  balanceNetWorthNode: {
    width: '75%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  insightsList: {
    marginTop: layout.micro,
  },
  viewReportButton: {
    marginBottom: spacing.huge,
  },
  bodyText: {
    marginBottom: spacing.xs,
  },
});

