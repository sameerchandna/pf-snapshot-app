import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View, ScrollView, Pressable, Dimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Coin, Coins, HandCoins, PiggyBank, Receipt, ShoppingCart, Target, TrendUp, TrendDown } from 'phosphor-react-native';
import { useSnapshot } from '../SnapshotContext';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SectionCard from '../components/SectionCard';
import Icon from '../components/Icon';
import IconButton from '../components/IconButton';
import { selectSnapshotTotals, selectMonthlySurplusWithScenario } from '../selectors';
import { spacing } from '../spacing';
import { layout } from '../layout';
import { formatCurrencyFull, formatCurrencyFullSigned, formatCurrencyFullAlwaysSigned, formatPercent } from '../formatters';
import { getActiveScenario, getScenarios, getActiveScenarioId } from '../scenarioState';
import type { Scenario } from '../domain/scenario/types';
import { UI_TOLERANCE } from '../constants';
import { useTheme } from '../ui/theme/useTheme';
import CashflowHeroValue from '../components/cashflow/CashflowHeroValue';
import CashflowCardStack from '../components/cashflow/CashflowCardStack';
import CashflowPrimaryCard from '../components/cashflow/CashflowPrimaryCard';
import CashflowSubCard from '../components/cashflow/CashflowSubCard';
import CashflowCardWrapper from '../components/cashflow/CashflowCardWrapper';
import { getMutedBorderColor } from '../ui/utils/getMutedBorderColor';

export default function SnapshotScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { state } = useSnapshot();
  const [activeScenario, setActiveScenario] = useState<Scenario | undefined>(undefined);

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

  const handlePress = (itemName: string) => {
    console.log(`${itemName} pressed`);
  };

  // Helper to determine if a card is editable (should show ➕ icon)
  const isEditableCard = (screenName: string): boolean => {
    const editableScreens = [
      'GrossIncomeDetail',
      'PensionDetail',
      'NetIncomeDetail',
      'ExpensesDetail',
      'AssetContributionDetail',
      'LiabilityReductionDetail',
      'AssetsDetail',
      'LiabilitiesDetail',
    ];
    return editableScreens.includes(screenName);
  };


  const screenWidth = Dimensions.get('window').width;
  const useHorizontalLayout = screenWidth > 350;
  const totals = selectSnapshotTotals(state);
  
  // Use scenario-adjusted monthly surplus for display
  const monthlySurplusValue = selectMonthlySurplusWithScenario(state, activeScenario);

  // Extract RGB from heroNumberGlow rgba string for shadowColor (for glow effect)
  const glowColor = theme.colors.overlay.heroNumberGlow;
  const rgbMatch = glowColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  const heroGlowShadowColor = rgbMatch ? `rgb(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]})` : glowColor;
  const heroGlowStyle = {
    shadowColor: heroGlowShadowColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 0, // Android shadow
  };

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
        {/* Phase 9.4 — Currency Formatting Strategy
             Snapshot cashflow uses full currency with explicit signs
             (formatCurrencyFullAlwaysSigned) to represent the current
             financial state precisely. */}
        <SectionCard useGradient={true} style={{ marginTop: layout.sectionGap }}>
          <SectionHeader title="Cash Flow" />

          {/* Cash Flow Hero Value */}
          <CashflowHeroValue valueText={monthlySurplusText} subtext="Remaining Free Cash per month" />

          <CashflowCardStack>
            {/* Gross Income */}
            <CashflowCardWrapper
              showAddIcon={isEditableCard('GrossIncomeDetail')}
              onAddPress={() => navigation.navigate('GrossIncomeDetail')}
            >
              <CashflowPrimaryCard
                title="Gross Income"
                description="Income before deductions"
                valueText={grossIncomeText}
                icon={Coins}
                iconColor={theme.colors.text.secondary}
                valueColor={theme.colors.text.primary}
              />
            </CashflowCardWrapper>

            {/* Pension */}
            <CashflowCardWrapper
              showAddIcon={isEditableCard('PensionDetail')}
              onAddPress={() => navigation.navigate('PensionDetail')}
            >
              <CashflowSubCard
                title="Pension"
                description="Pre-tax savings"
                valueText={pensionText}
                icon={PiggyBank}
                iconColor={theme.colors.domain.asset}
                borderColor={getMutedBorderColor(theme.colors.semantic.successBorder, theme)}
                valueColor={Math.abs(totals.pension) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary}
              />
            </CashflowCardWrapper>

            {/* Other Deductions */}
            <CashflowCardWrapper>
              <CashflowSubCard
                title="Other Deductions"
                description="Tax and payroll deductions"
                valueText={deductionsText}
                icon={Receipt}
                iconColor={theme.colors.semantic.error}
                borderColor={getMutedBorderColor(theme.colors.semantic.errorBorder, theme)}
                valueColor={Math.abs(totals.deductions) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary}
              />
            </CashflowCardWrapper>

            {/* Net Income */}
            <CashflowCardWrapper
              marginTop={spacing.base}
              showAddIcon={isEditableCard('NetIncomeDetail')}
              onAddPress={() => navigation.navigate('NetIncomeDetail')}
            >
              <CashflowPrimaryCard
                title="Net Income"
                description="Take-home pay"
                valueText={netIncomeText}
                icon={Coin}
                iconColor={theme.colors.text.secondary}
                valueColor={theme.colors.text.primary}
              />
            </CashflowCardWrapper>

            {/* Expenses */}
            <CashflowCardWrapper
              showAddIcon={isEditableCard('ExpensesDetail')}
              onAddPress={() => navigation.navigate('ExpensesDetail')}
            >
              <CashflowSubCard
                title="Expenses"
                description="Monthly spending"
                valueText={expensesText}
                icon={ShoppingCart}
                iconColor={theme.colors.semantic.error}
                borderColor={getMutedBorderColor(theme.colors.semantic.errorBorder, theme)}
                valueColor={Math.abs(totals.expenses) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary}
              />
            </CashflowCardWrapper>

            {/* Available Cash */}
            <CashflowCardWrapper marginTop={spacing.base}>
              <CashflowPrimaryCard
                title="Available Cash"
                description="After expenses"
                valueText={availableCashText}
                icon={HandCoins}
                iconColor={theme.colors.text.secondary}
                valueColor={theme.colors.brand.primary}
                isOutcome={true}
              />
            </CashflowCardWrapper>

            {/* Asset Contribution */}
            <CashflowCardWrapper
              showAddIcon={isEditableCard('AssetContributionDetail')}
              onAddPress={() => navigation.navigate('AssetContributionDetail')}
            >
              <CashflowSubCard
                title="Asset Contribution"
                description="Saved or invested"
                valueText={assetContributionText}
                icon={TrendUp}
                iconColor={theme.colors.semantic.success}
                borderColor={getMutedBorderColor(theme.colors.semantic.successBorder, theme)}
                valueColor={Math.abs(totals.assetContributions) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary}
              />
            </CashflowCardWrapper>

            {/* Liability Reduction */}
            <CashflowCardWrapper
              showAddIcon={isEditableCard('LiabilityReductionDetail')}
              onAddPress={() => navigation.navigate('LiabilityReductionDetail')}
            >
              <CashflowSubCard
                title="Liability Reduction"
                description="Debt repayments"
                valueText={liabilityReductionText}
                icon={TrendDown}
                iconColor={theme.colors.semantic.success}
                borderColor={getMutedBorderColor(theme.colors.semantic.successBorder, theme)}
                valueColor={Math.abs(totals.liabilityReduction) < UI_TOLERANCE ? theme.colors.text.muted : theme.colors.text.secondary}
              />
            </CashflowCardWrapper>

            {/* Remaining Free Cash */}
            <CashflowCardWrapper marginTop={spacing.base} isLast={true}>
              <CashflowPrimaryCard
                title="Remaining Free Cash"
                description="Unallocated cash"
                valueText={monthlySurplusText}
                icon={Target}
                iconColor={theme.colors.brand.primary}
                valueColor={theme.colors.brand.primary}
                isOutcome={true}
                hasTint={true}
                tintColor={theme.colors.semantic.info}
              />
            </CashflowCardWrapper>
          </CashflowCardStack>
        </SectionCard>

        {/* BALANCE SHEET SECTION */}
        <SectionCard>
          <SectionHeader title="Balance Sheet" />

          {/* Net Worth Hero Value */}
          <View style={styles.netWorthHero}>
            <Text style={[styles.netWorthHeroValue, theme.typography.valueLarge, { color: theme.colors.text.primary }, heroGlowStyle]}>
              {netWorthText}
            </Text>
            <Text style={[styles.netWorthHeroLabel, theme.typography.body, { color: theme.colors.text.muted }]}>Net Worth</Text>
          </View>

          {/* Assets and Liabilities Cards */}
          <View style={styles.balanceSheetCardsRow}>
            <View style={styles.balanceSheetCardWrapper}>
              <View style={[styles.balanceSheetCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle }]}>
                <View style={styles.balanceSheetRow}>
                  <View style={styles.balanceSheetIconColumn}>
                    <TrendUp size={20} color={theme.colors.domain.asset} weight="regular" />
                  </View>
                  <View style={styles.balanceSheetContentColumn}>
                    <Text style={[styles.cardTitle, styles.cashflowTextCentered, theme.typography.bodyLarge, { color: theme.colors.text.primary, fontSize: 15 }]}>Assets</Text>
                    <Text style={[styles.primaryValue, styles.cashflowTextCentered, theme.typography.value, { color: theme.colors.domain.asset }]}>{totalAssetsText}</Text>
                    <Text style={[styles.subtext, styles.cashflowTextCentered, theme.typography.body, { color: theme.colors.text.muted, fontSize: 13 }]}>What you own</Text>
                  </View>
                  <View style={styles.balanceSheetActionColumn}>
                    {isEditableCard('AssetsDetail') ? (
                      <IconButton
                        icon="plus"
                        size="md"
                        variant="default"
                        onPress={() => navigation.navigate('AssetsDetail')}
                        accessibilityLabel="Add asset"
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.balanceSheetCardWrapper}>
              <View style={[styles.balanceSheetCard, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle }]}>
                <View style={styles.balanceSheetRow}>
                  <View style={styles.balanceSheetIconColumn}>
                    <TrendDown size={20} color={theme.colors.domain.liability} weight="regular" />
                  </View>
                  <View style={styles.balanceSheetContentColumn}>
                    <Text style={[styles.cardTitle, styles.cashflowTextCentered, theme.typography.bodyLarge, { color: theme.colors.text.primary, fontSize: 15 }]}>Liabilities</Text>
                    <Text style={[styles.primaryValue, styles.cashflowTextCentered, theme.typography.value, { color: theme.colors.domain.liability }]}>{totalLiabilitiesText}</Text>
                    <Text style={[styles.subtext, styles.cashflowTextCentered, theme.typography.body, { color: theme.colors.text.muted, fontSize: 13 }]}>What you owe</Text>
                  </View>
                  <View style={styles.balanceSheetActionColumn}>
                    {isEditableCard('LiabilitiesDetail') ? (
                      <IconButton
                        icon="plus"
                        size="md"
                        variant="default"
                        onPress={() => navigation.navigate('LiabilitiesDetail')}
                        accessibilityLabel="Add liability"
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
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
    flex: 1,
    flexShrink: 1,
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
  remainingFreeCashTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: spacing.xl,
    zIndex: 0,
  },
  cashflowCardStack: {
    position: 'relative',
    width: '100%',
    paddingLeft: layout.inputPadding - 4, // 6px - shifted right
    paddingRight: 0, // Eliminated to reclaim space and anchor cards to right edge
  },
  cashflowCardsWrapper: {
    position: 'relative',
    width: '100%',
  },
  cashflowSpine: {
    position: 'absolute',
    left: spacing.xl,
    top: spacing.xs,
    bottom: spacing.sm,
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
  cashFlowHero: {
    alignItems: 'center',
    marginTop: layout.sectionTitleBottom,
    marginBottom: spacing.base,
  },
  cashFlowHeroValue: {
    textAlign: 'center',
  },
  cashFlowHeroSubtext: {
    textAlign: 'center',
    marginTop: spacing.tiny,
  },
  netWorthHero: {
    alignItems: 'center',
    marginTop: layout.sectionTitleBottom,
    marginBottom: spacing.base,
  },
  netWorthHeroValue: {
    textAlign: 'center',
  },
  netWorthHeroLabel: {
    textAlign: 'center',
    marginTop: spacing.tiny,
  },
  netWorthHeroSubtext: {
    textAlign: 'center',
    marginTop: spacing.tiny,
  },
  balanceSheetCardsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: layout.inputPadding,
    gap: spacing.sm,
  },
  balanceSheetCard: {
    flex: 1,
    minWidth: 0,
    padding: spacing.sm,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  balanceSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  balanceSheetIconColumn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceSheetContentColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  balanceSheetActionColumn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceSheetPrimaryCard: {
    flex: 1,
    minWidth: 0,
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
    marginBottom: spacing.base,
  },
  cashflowGapMd: {
    height: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashflowGapLg: {
    height: spacing.xl,
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
    marginLeft: spacing.xl + spacing.sm - layout.inputPadding + 16, // Increased by 16px for stronger indent
  },
  cashflowRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: spacing.base,
  },
  cashflowLabelStack: {
    flex: 1,
    flexShrink: 1,
  },
  cashflowValueCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: spacing.base,
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
    justifyContent: 'center',
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
  // Wrapper styles for card + ➕ icon layout
  cashflowCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.tiny, // Reduced from spacing.xs (6px) to spacing.tiny (4px)
  },
  balanceSheetCardWrapper: {
    flex: 1,
    minWidth: 90,
    flexShrink: 1,
  },
  addIconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    transform: [{ translateY: -4 }],
  },
  addIconVisualCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionColumnSpacer: {
    width: 44,
    height: 44,
  },
  cashflowIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
});

