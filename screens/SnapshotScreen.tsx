import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View, ScrollView, Pressable, Dimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSnapshot } from '../SnapshotContext';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SectionCard from '../components/SectionCard';
import { selectSnapshotTotals, selectMonthlySurplusWithScenario } from '../selectors';
import { spacing } from '../spacing';
import { layout } from '../layout';
import { formatCurrencyFull, formatCurrencyFullSigned, formatCurrencyFullAlwaysSigned, formatPercent } from '../formatters';
import { getActiveScenario } from '../scenarioState';
import type { Scenario } from '../domain/scenario/types';
import { UI_TOLERANCE } from '../constants';
import { useTheme } from '../ui/theme/useTheme';

export default function SnapshotScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { state } = useSnapshot();
  const [activeScenario, setActiveScenario] = useState<Scenario | undefined>(undefined);

  // Load active scenario whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      async function loadActiveScenario() {
        const scenario = await getActiveScenario();
        setActiveScenario(scenario);
      }
      loadActiveScenario();
    }, [])
  );

  const handlePress = (itemName: string) => {
    console.log(`${itemName} pressed`);
  };

  const screenWidth = Dimensions.get('window').width;
  const useHorizontalLayout = screenWidth > 350;
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

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <StatusBar style="auto" />
      <ScreenHeader
        title="Snapshot"
        subtitle="Your current financial position"
        rightAccessory={
          <Pressable
            onPress={() => navigation.navigate('Entry')}
            style={({ pressed }) => [
              {
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: 4,
                backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Explore"
          >
            <Text style={[theme.typography.button, { color: theme.colors.text.secondary }]}>Explore</Text>
          </Pressable>
        }
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* CASH FLOW SECTION */}
        <SectionCard>
          <SectionHeader title="Cash Flow" subtitle="Average monthly flow (annual costs smoothed)" />

          <View style={styles.cashflowCardStack}>
            <View style={[styles.cashflowSpine, { backgroundColor: theme.colors.border.subtle }]} />
            <View style={styles.cashflowCentered}>
            <Pressable
              onPress={() => navigation.navigate('GrossIncomeDetail')}
              style={[styles.cashflowRowContainer, styles.cashflowCard, styles.cashflowPrimaryCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle, borderLeftWidth: 1, borderLeftColor: theme.colors.border.subtle }]}
            >
              <View style={styles.cashflowBaseRow}>
                <View style={styles.cashflowCardLeft}>
                  <Text style={[styles.cardTitle, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Gross Income</Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.cashflowValueRight, theme.typography.value, { color: theme.colors.text.primary }]}>{grossIncomeText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('PensionDetail')}
              style={[styles.cashflowRowContainer, styles.cashflowCard, styles.cashflowSubCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle, borderLeftWidth: 2, borderLeftColor: theme.colors.semantic.successBorder }]}
            >
              <View style={styles.cashflowBaseRow}>
                <View style={styles.cashflowCardLeftIndented}>
                  <Text style={[styles.cardTitle, styles.subCardTitle, theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>Pension</Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.subCardValue, styles.cashflowValueRight, theme.typography.value, { color: Math.abs(totals.pension) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary }]}>{pensionText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('DeductionsDetail')}
              style={[styles.cashflowRowContainer, styles.cashflowCard, styles.cashflowSubCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle, borderLeftWidth: 2, borderLeftColor: theme.colors.semantic.errorBorder }]}
            >
              <View style={styles.cashflowBaseRow}>
                <View style={styles.cashflowCardLeftIndented}>
                  <Text style={[styles.cardTitle, styles.subCardTitle, theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>
                    Other Deductions
                  </Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.subCardValue, styles.cashflowValueRight, theme.typography.value, { color: Math.abs(totals.deductions) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary }]}>{deductionsText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('NetIncomeDetail')}
              style={[styles.cashflowRowContainer, styles.cashflowCard, styles.cashflowPrimaryCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle, borderLeftWidth: 1, borderLeftColor: theme.colors.border.subtle, marginTop: spacing.base }]}
            >
              <View style={styles.cashflowBaseRow}>
                <View style={styles.cashflowCardLeft}>
                  <Text style={[styles.cardTitle, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Net Income</Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.cashflowValueRight, theme.typography.value, { color: theme.colors.text.primary }]}>{netIncomeText}</Text>
                </View>
              </View>
              <Text style={[styles.cardDescription, theme.typography.body, { color: theme.colors.text.muted }]}>Money you actually take home</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('ExpensesDetail')}
              style={[styles.cashflowRowContainer, styles.cashflowCard, styles.cashflowSubCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle, borderLeftWidth: 2, borderLeftColor: theme.colors.semantic.errorBorder }]}
            >
              <View style={styles.cashflowBaseRow}>
                <View style={styles.cashflowCardLeftIndented}>
                  <Text style={[styles.cardTitle, styles.subCardTitle, theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>Expenses</Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.subCardValue, styles.cashflowValueRight, theme.typography.value, { color: Math.abs(totals.expenses) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary }]}>{expensesText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('AvailableCashDetail')}
              style={[styles.cashflowRowContainer, styles.cashflowCard, styles.cashflowPrimaryCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle, borderLeftWidth: 1, borderLeftColor: theme.colors.border.subtle, marginTop: spacing.base }]}
            >
              <View style={styles.cashflowBaseRow}>
                <View style={styles.cashflowCardLeft}>
                  <Text style={[styles.cardTitle, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Available Cash</Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.primaryValueOutcome, styles.cashflowValueRight, theme.typography.value, { color: theme.colors.brand.primary }]}>{availableCashText}</Text>
                </View>
              </View>
              <Text style={[styles.cardDescription, theme.typography.body, { color: theme.colors.text.muted }]}>
                Money left after expenses
              </Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('AssetContributionDetail')}
              style={[styles.cashflowRowContainer, styles.cashflowCard, styles.cashflowSubCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle, borderLeftWidth: 2, borderLeftColor: theme.colors.semantic.successBorder }]}
            >
              <View style={styles.cashflowBaseRow}>
                <View style={styles.cashflowCardLeftIndented}>
                  <Text style={[styles.cardTitle, styles.subCardTitle, theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>
                    Asset Contribution
                  </Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.subCardValue, styles.cashflowValueRight, theme.typography.value, { color: Math.abs(totals.assetContributions) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary }]}>{assetContributionText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('LiabilityReductionDetail')}
              style={[styles.cashflowRowContainer, styles.cashflowCard, styles.cashflowSubCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle, borderLeftWidth: 2, borderLeftColor: theme.colors.semantic.successBorder }]}
            >
              <View style={styles.cashflowBaseRow}>
                <View style={styles.cashflowCardLeftIndented}>
                  <Text style={[styles.cardTitle, styles.subCardTitle, theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>
                    Liability Reduction
                  </Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.subCardValue, styles.cashflowValueRight, theme.typography.value, { color: Math.abs(totals.liabilityReduction) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary }]}>{liabilityReductionText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('MonthlySurplusDetail')}
              style={[styles.cashflowRowContainer, styles.cashflowCard, styles.cashflowPrimaryCard, styles.cashflowLastCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle, borderLeftWidth: 1, borderLeftColor: theme.colors.border.subtle, marginTop: spacing.base }]}
            >
              <View style={styles.cashflowBaseRow}>
                <View style={styles.cashflowCardLeft}>
                  <Text style={[styles.cardTitle, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Remaining Free Cash</Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.primaryValueOutcome, styles.cashflowValueRight, theme.typography.value, { color: theme.colors.brand.primary }]}>{monthlySurplusText}</Text>
                </View>
              </View>
              <Text style={[styles.cardDescription, theme.typography.body, { color: theme.colors.text.muted }]}>
                Money left after all allocations
              </Text>
            </Pressable>

            {/* End padding for Cash Flow section */}
            <View style={styles.cashflowEndSpacer} />
            </View>
          </View>
        </SectionCard>

        {/* BALANCE SHEET SECTION */}
        <SectionCard>
          <SectionHeader title="Balance Sheet" subtitle="What you own vs what you owe today" />

          <View style={styles.balanceSheetCentered}>
            <Pressable onPress={() => navigation.navigate('AssetsDetail')} style={[styles.balanceSheetPrimaryCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle }]}>
              <Text style={[styles.cardTitle, styles.cashflowTextCentered, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Assets</Text>
              <Text style={[styles.primaryValue, styles.cashflowTextCentered, theme.typography.value, { color: theme.colors.domain.asset }]}>{totalAssetsText}</Text>
              <Text style={[styles.subtext, styles.cashflowTextCentered, theme.typography.body, { color: theme.colors.text.muted }]}>What you own</Text>
            </Pressable>

            <Text style={[styles.equationText, theme.typography.bodyLarge, { color: theme.colors.text.muted }]}>−</Text>

            <Pressable onPress={() => navigation.navigate('LiabilitiesDetail')} style={[styles.balanceSheetPrimaryCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle }]}>
              <Text style={[styles.cardTitle, styles.cashflowTextCentered, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Liabilities</Text>
              <Text style={[styles.primaryValue, styles.cashflowTextCentered, theme.typography.value, { color: theme.colors.domain.liability }]}>{totalLiabilitiesText}</Text>
              <Text style={[styles.subtext, styles.cashflowTextCentered, theme.typography.body, { color: theme.colors.text.muted }]}>What you owe</Text>
            </Pressable>

            <Text style={[styles.equationText, theme.typography.bodyLarge, { color: theme.colors.text.muted }]}>=</Text>

            <Pressable onPress={() => navigation.navigate('NetWorthDetail')} style={[styles.balanceSheetPrimaryCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle }]}>
              <Text style={[styles.cardTitle, styles.cashflowTextCentered, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Net Worth</Text>
              <Text style={[styles.primaryValue, styles.primaryValueOutcome, styles.cashflowTextCentered, theme.typography.value, { color: theme.colors.brand.primary }]}>{netWorthText}</Text>
            </Pressable>
          </View>
        </SectionCard>

        {/* INSIGHTS (Snapshot only) */}
        {insights.length > 0 ? (
          <SectionCard>
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
      </ScrollView>
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
  dotSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dotSeparatorTight: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dot: {
    // Typography moved to inline style with theme token
  },
  horizontalRow: {
    flexDirection: 'row',
  },
  equationText: {
    // Typography moved to inline style with theme token
    textAlign: 'center',
    marginHorizontal: layout.micro,
  },
  card: {
    paddingVertical: spacing.tiny,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: spacing.xl,
    borderWidth: 1,
    zIndex: 1,
  },
  cashflowRowContainer: {
    paddingVertical: spacing.tiny,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: spacing.xl,
    borderWidth: 1,
    zIndex: 1,
    minHeight: 28, // Ensures consistent base height for primary line (4px top + 20px lineHeight + 4px bottom)
    justifyContent: 'flex-start',
    alignItems: 'stretch',
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
  cashflowCentered: {
    width: '100%',
    zIndex: 1,
  },
  balanceSheetCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: layout.inputPadding,
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  cashflowPrimaryCard: {
    width: '100%',
  },
  cashflowLastCard: {
    marginBottom: 0,
  },
  balanceSheetPrimaryCard: {
    flex: 1,
    minWidth: 90,
    padding: spacing.sm,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    marginBottom: 0,
  },
  cashflowCard: {
    position: 'relative',
  },
  cashflowMb0: {
    marginBottom: 0,
  },
  cashflowMbXs: {
    marginBottom: spacing.xs,
  },
  cashflowMbSm: {
    marginBottom: spacing.sm,
  },
  cashflowMbMd: {
    marginBottom: spacing.md,
  },
  cashflowGapMd: {
    height: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashflowGapLg: {
    height: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashflowChevron: {
    // Typography moved to inline style with theme token
  },
  cashflowEndSpacer: {
    height: spacing.sm,
  },
  cashflowSubCard: {
    width: '90%',
    alignSelf: 'flex-end',
  },
  cashflowBaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: 20, // Fixed height matching primary line lineHeight (bodyLarge: 20px)
  },
  cashflowCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    gap: spacing.base,
    minHeight: 20, // Ensures primary line (title + value) has consistent baseline height
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
    alignItems: 'flex-end',
  },
  cashflowValueRight: {
    textAlign: 'right',
  },
  cashflowTextCentered: {
    textAlign: 'center',
  },
  cardTitle: {
    // Typography moved to inline style with theme token
    marginBottom: 1,
  },
  subCardTitle: {
    // Subtle cue on label only; values remain equally prominent.
  },
  subCardValue: {
  },
  primaryValue: {
    // Typography moved to inline style with theme token
    marginBottom: 1,
  },
  primaryValueOutcome: {
  },
  cardDescription: {
    // Typography moved to inline style with theme token
    marginTop: 1,
  },
  subtext: {
    // Typography moved to inline style with theme token
  },
  insightsList: {
    marginTop: layout.micro,
  },
  bodyText: {
    // Typography moved to inline style with theme token (13px → 12px via theme.typography.body)
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
});

