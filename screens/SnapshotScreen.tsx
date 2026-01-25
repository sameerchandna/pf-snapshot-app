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
import { formatCurrencyFull, formatCurrencyFullSigned, formatPercent } from '../formatters';
import { getActiveScenario } from '../scenarioState';
import type { Scenario } from '../domain/scenario/types';
import { UI_TOLERANCE } from '../constants';

const snapshotTypography = {
  headerTitleSize: 20,
  sectionTitleSize: 16,
  cardTitleSize: 14,
  primaryValueSize: 15,
  bodySize: 12,
  headerTitleWeight: '600' as const, // semibold
  sectionTitleWeight: '700' as const, // bold
  cardTitleWeight: '500' as const, // medium
  primaryValueWeight: '600' as const, // semibold
  bodyWeight: '400' as const, // regular
  equationWeight: '500' as const, // medium
};

const snapshotColors = {
  focusBlue: '#2F5BEA',
};

export default function SnapshotScreen() {
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

  const grossIncomeText: string = formatCurrencyFull(totals.grossIncome);
  const pensionText: string = formatCurrencyFullSigned(-totals.pension);
  const netIncomeText: string = formatCurrencyFull(totals.netIncome);
  const expensesText: string = formatCurrencyFullSigned(-totals.expenses);
  const liabilityReductionText: string = formatCurrencyFullSigned(-totals.liabilityReduction);
  const assetContributionText: string = formatCurrencyFullSigned(-totals.assetContributions);
  const totalAssetsText: string = formatCurrencyFull(totals.assets);
  const totalLiabilitiesText: string = formatCurrencyFull(totals.liabilities);
  const deductionsText: string = formatCurrencyFullSigned(-totals.deductions);

  const availableCashText: string = formatCurrencyFullSigned(totals.availableCash);
  const monthlySurplusText: string = formatCurrencyFullSigned(monthlySurplusValue);
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
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar style="auto" />
      <ScreenHeader title="Snapshot" subtitle="Your current financial position" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* CASH FLOW SECTION */}
        <SectionCard>
          <SectionHeader title="Cash Flow" subtitle="Average monthly flow (annual costs smoothed)" />

          <View style={styles.cashflowCardStack}>
            <View style={styles.cashflowSpine} />
            <View style={styles.cashflowCentered}>
            <Pressable
              onPress={() => navigation.navigate('GrossIncomeDetail')}
              style={[styles.card, styles.cashflowCard, styles.cashflowPrimaryCard]}
            >
              <View style={styles.cashflowCardRow}>
                <View style={styles.cashflowCardLeft}>
                  <Text style={styles.cardTitle}>Gross Income</Text>
                  <Text style={styles.cardDescription}>
                    Money you earn before Tax & Deductions
                  </Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.cashflowValueRight]}>{grossIncomeText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('PensionDetail')}
              style={[styles.card, styles.cashflowCard, styles.cashflowSubCard]}
            >
              <View style={styles.cashflowCardRow}>
                <View style={styles.cashflowCardLeftIndented}>
                  <Text style={[styles.cardTitle, styles.subCardTitle]}>Pension</Text>
                  <Text style={styles.cardDescription}>
                    Money towards pension
                  </Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.subCardValue, styles.cashflowValueRight]}>{pensionText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('DeductionsDetail')}
              style={[styles.card, styles.cashflowCard, styles.cashflowSubCard]}
            >
              <View style={styles.cashflowCardRow}>
                <View style={styles.cashflowCardLeftIndented}>
                  <Text style={[styles.cardTitle, styles.subCardTitle]}>
                    Other Deductions
                  </Text>
                  <Text style={styles.cardDescription}>
                    Money taken off pay
                  </Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.subCardValue, styles.cashflowValueRight]}>{deductionsText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('NetIncomeDetail')}
              style={[styles.card, styles.cashflowCard, styles.cashflowPrimaryCard]}
            >
              <View style={styles.cashflowCardRow}>
                <View style={styles.cashflowCardLeft}>
                  <Text style={styles.cardTitle}>Net Income</Text>
                  <Text style={styles.cardDescription}>Money you actually take home</Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.cashflowValueRight]}>{netIncomeText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('ExpensesDetail')}
              style={[styles.card, styles.cashflowCard, styles.cashflowSubCard]}
            >
              <View style={styles.cashflowCardRow}>
                <View style={styles.cashflowCardLeftIndented}>
                  <Text style={[styles.cardTitle, styles.subCardTitle]}>Expenses</Text>
                  <Text style={styles.cardDescription}>Money you spend each month</Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.subCardValue, styles.cashflowValueRight]}>{expensesText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('AvailableCashDetail')}
              style={[styles.card, styles.cashflowCard, styles.cashflowPrimaryCard]}
            >
              <View style={styles.cashflowCardRow}>
                <View style={styles.cashflowCardLeft}>
                  <Text style={styles.cardTitle}>Available Cash</Text>
                  <Text style={styles.cardDescription}>
                    Money left after expenses
                  </Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.primaryValueOutcome, styles.cashflowValueRight]}>{availableCashText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('AssetContributionDetail')}
              style={[styles.card, styles.cashflowCard, styles.cashflowSubCard]}
            >
              <View style={styles.cashflowCardRow}>
                <View style={styles.cashflowCardLeftIndented}>
                  <Text style={[styles.cardTitle, styles.subCardTitle]}>
                    Asset Contribution
                  </Text>
                  <Text style={styles.cardDescription}>
                    Savings & Investments
                  </Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.subCardValue, styles.cashflowValueRight]}>{assetContributionText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('LiabilityReductionDetail')}
              style={[styles.card, styles.cashflowCard, styles.cashflowSubCard]}
            >
              <View style={styles.cashflowCardRow}>
                <View style={styles.cashflowCardLeftIndented}>
                  <Text style={[styles.cardTitle, styles.subCardTitle]}>
                    Liability Reduction
                  </Text>
                  <Text style={styles.cardDescription}>
                    Debts & Loans
                  </Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.subCardValue, styles.cashflowValueRight]}>{liabilityReductionText}</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('MonthlySurplusDetail')}
              style={[styles.card, styles.cashflowCard, styles.cashflowPrimaryCard, styles.cashflowLastCard]}
            >
              <View style={styles.cashflowCardRow}>
                <View style={styles.cashflowCardLeft}>
                  <Text style={styles.cardTitle}>Monthly Surplus</Text>
                  <Text style={styles.cardDescription}>
                    Money left after all allocations
                  </Text>
                </View>
                <View style={styles.cashflowCardRight}>
                  <Text style={[styles.primaryValue, styles.primaryValueOutcome, styles.cashflowValueRight]}>{monthlySurplusText}</Text>
                </View>
              </View>
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
            <Pressable onPress={() => navigation.navigate('AssetsDetail')} style={styles.balanceSheetPrimaryCard}>
              <Text style={[styles.cardTitle, styles.cashflowTextCentered]}>Assets</Text>
              <Text style={[styles.primaryValue, styles.cashflowTextCentered]}>{totalAssetsText}</Text>
              <Text style={[styles.subtext, styles.cashflowTextCentered]}>What you own</Text>
            </Pressable>

            <Text style={styles.equationText}>−</Text>

            <Pressable onPress={() => navigation.navigate('LiabilitiesDetail')} style={styles.balanceSheetPrimaryCard}>
              <Text style={[styles.cardTitle, styles.cashflowTextCentered]}>Liabilities</Text>
              <Text style={[styles.primaryValue, styles.cashflowTextCentered]}>{totalLiabilitiesText}</Text>
              <Text style={[styles.subtext, styles.cashflowTextCentered]}>What you owe</Text>
            </Pressable>

            <Text style={styles.equationText}>=</Text>

            <Pressable onPress={() => navigation.navigate('NetWorthDetail')} style={styles.balanceSheetPrimaryCard}>
              <Text style={[styles.cardTitle, styles.cashflowTextCentered]}>Net Worth</Text>
              <Text style={[styles.primaryValue, styles.primaryValueOutcome, styles.cashflowTextCentered]}>{netWorthText}</Text>
            </Pressable>
          </View>
        </SectionCard>

        {/* INSIGHTS (Snapshot only) */}
        {insights.length > 0 ? (
          <SectionCard>
            <SectionHeader title="Insights" />
            <View style={styles.insightsList}>
              {insights.map((line, idx) => (
                <Text key={`${idx}-${line}`} style={styles.bodyText}>
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
    backgroundColor: layout.screenBackground,
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
    fontSize: snapshotTypography.bodySize,
    color: '#ccc',
  },
  horizontalRow: {
    flexDirection: 'row',
  },
  equationText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#bbb',
    textAlign: 'center',
    marginHorizontal: layout.micro,
  },
  card: {
    backgroundColor: '#fff',
    paddingVertical: spacing.tiny,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: spacing.xl,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    zIndex: 1,
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
    backgroundColor: '#fff',
    padding: spacing.sm,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f0f0f0',
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
    fontSize: 16,
    color: '#bbb',
    fontWeight: '400',
  },
  cashflowEndSpacer: {
    height: spacing.sm,
  },
  cashflowSubCard: {
    width: '90%',
    alignSelf: 'flex-end',
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
  cashflowTextCentered: {
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: snapshotTypography.cardTitleSize,
    fontWeight: snapshotTypography.cardTitleWeight,
    marginBottom: 1,
    color: '#000',
  },
  subCardTitle: {
    // Subtle cue on label only; values remain equally prominent.
    color: '#666',
  },
  subCardValue: {
    color: '#666',
  },
  primaryValue: {
    fontSize: snapshotTypography.primaryValueSize,
    fontWeight: snapshotTypography.primaryValueWeight,
    marginBottom: 1,
    color: '#000',
  },
  primaryValueOutcome: {
    color: snapshotColors.focusBlue,
  },
  cardDescription: {
    fontSize: snapshotTypography.bodySize,
    fontWeight: snapshotTypography.bodyWeight,
    color: '#999',
    marginTop: 1,
  },
  subtext: {
    fontSize: snapshotTypography.bodySize,
    fontWeight: snapshotTypography.bodyWeight,
    color: '#999',
  },
  insightsList: {
    marginTop: layout.micro,
  },
  bodyText: {
    fontSize: 13,
    fontWeight: snapshotTypography.bodyWeight,
    color: '#666',
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
});

