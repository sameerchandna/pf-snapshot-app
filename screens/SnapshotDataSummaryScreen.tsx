import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import ScreenHeader from '../components/ScreenHeader';
import SketchBackground from '../components/SketchBackground';
import { useSnapshot } from '../context/SnapshotContext';
import { initLoan, stepLoanMonth } from '../engines/loanEngine';
import { formatCurrencyFull, formatPercent } from '../ui/formatters';
import { selectSnapshotTotals, selectLoanDerivedRows } from '../engines/selectors';
import type { AssetItem } from '../types';
import { computeProjectionSummary, computeProjectionSeries, type ProjectionEngineInputs } from '../engines/projectionEngine';
import { computeA3Attribution } from '../engines/computeA3Attribution';
import { serializeDebugState } from '../debug/serializeDebugState';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { typography } from '../ui/theme/theme';

function formatLiquidity(asset: AssetItem): string {
  if (!asset.availability) return 'immediate';
  return asset.availability.type;
}

function formatSnapshotDate(): string {
  return new Date().toISOString().split('T')[0];
}

export default function SnapshotDataSummaryScreen() {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const { state, isSwitching } = useSnapshot();
  const [showCopiedFeedback, setShowCopiedFeedback] = useState(false);

  const totals = useMemo(() => selectSnapshotTotals(state), [state]);
  const loanDerivedRows = useMemo(() => selectLoanDerivedRows(state), [state]);

  // Calculate monthly contribution per asset
  const assetContributionsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const contrib of state.assetContributions) {
      map.set(contrib.assetId, contrib.amountMonthly);
    }
    return map;
  }, [state.assetContributions]);

  // Calculate loan derived values
  const loanDerived = useMemo(() => {
    const derived = new Map<
      string,
      {
        monthlyPayment: number;
        monthlyInterest: number;
        monthlyPrincipal: number;
      }
    >();

    for (const liability of state.liabilities) {
      if (liability.kind !== 'loan') continue;
      if (
        typeof liability.annualInterestRatePct !== 'number' ||
        !Number.isFinite(liability.annualInterestRatePct) ||
        typeof liability.remainingTermYears !== 'number' ||
        !Number.isFinite(liability.remainingTermYears)
      ) {
        continue;
      }

      const init = initLoan({
        balance: liability.balance,
        annualInterestRatePct: liability.annualInterestRatePct,
        remainingTermYears: liability.remainingTermYears,
      });
      const month1 = stepLoanMonth({
        balance: liability.balance,
        monthlyPayment: init.monthlyPayment,
        monthlyRate: init.monthlyRate,
      });

      derived.set(liability.id, {
        monthlyPayment: init.monthlyPayment,
        monthlyInterest: month1.interest,
        monthlyPrincipal: month1.principal,
      });
    }

    return derived;
  }, [state.liabilities]);

  // Generate text content for copying
  const generateTextContent = useMemo(() => {
    const lines: string[] = [];

    // Section 1: Meta
    lines.push('Section 1: Meta');
    lines.push(`Current age: ${state.projection.currentAge}`);
    lines.push(`Snapshot date: ${formatSnapshotDate()}`);
    lines.push('');

    // Section 2: Assets
    lines.push('Section 2: Assets');
    if (state.assets.length === 0) {
      lines.push('(no assets)');
    } else {
      for (const asset of state.assets) {
        const monthlyContribution = assetContributionsMap.get(asset.id) ?? 0;
        lines.push(`Asset ID: ${asset.id}`);
        lines.push(`Name: ${asset.name}`);
        lines.push(`Balance: ${formatCurrencyFull(asset.balance)}`);
        lines.push(`Growth rate: ${formatPercent(asset.annualGrowthRatePct, { decimals: 2 })} per year`);
        lines.push(`Liquidity: ${formatLiquidity(asset)}`);
        lines.push(`Monthly contribution: ${formatCurrencyFull(monthlyContribution)}`);
        lines.push('');
      }
    }
    lines.push('');

    // Section 3: Liabilities / Loans
    lines.push('Section 3: Liabilities / Loans');
    if (state.liabilities.length === 0) {
      lines.push('(no liabilities)');
    } else {
      for (const liability of state.liabilities) {
        const derived = loanDerived.get(liability.id);
        const isLoan = liability.kind === 'loan';
        lines.push(`Loan ID: ${liability.id}`);
        lines.push(`Name: ${liability.name}`);
        lines.push(`Outstanding balance: ${formatCurrencyFull(liability.balance)}`);
        lines.push(`Interest rate: ${formatPercent(liability.annualInterestRatePct, { decimals: 2 })} per year`);
        if (isLoan && typeof liability.remainingTermYears === 'number') {
          lines.push(`Remaining term: ${liability.remainingTermYears} years`);
          lines.push('Loan start date: null');
          if (derived) {
            lines.push('Derived (monthly):');
            lines.push(`- Monthly payment: ${formatCurrencyFull(derived.monthlyPayment)}`);
            lines.push(`- Monthly interest (initial): ${formatCurrencyFull(derived.monthlyInterest)}`);
            lines.push(`- Monthly principal (initial): ${formatCurrencyFull(derived.monthlyPrincipal)}`);
          }
        }
        lines.push('');
      }
    }
    lines.push('');

    // Section 4: Snapshot Cash Flow
    lines.push('Section 4: Snapshot Cash Flow (Monthly Inputs)');
    lines.push(`Gross income: ${formatCurrencyFull(totals.grossIncome)}`);
    lines.push(`Pension deduction: ${formatCurrencyFull(totals.pension)}`);
    lines.push(`Other deductions: ${formatCurrencyFull(totals.deductions)}`);
    lines.push(`Net income: ${formatCurrencyFull(totals.netIncome)}`);
    lines.push(`Expenses: ${formatCurrencyFull(totals.expenses)}`);
    lines.push(`Available cash: ${formatCurrencyFull(totals.availableCash)}`);
    lines.push(`Asset contributions: ${formatCurrencyFull(totals.assetContributions)}`);
    lines.push(`Debt repayment: ${formatCurrencyFull(totals.liabilityReduction)}`);
    lines.push(`Monthly surplus: ${formatCurrencyFull(totals.monthlySurplus)}`);

    return lines.join('\n');
  }, [state, totals, assetContributionsMap, loanDerived]);

  const handleCopyAll = async () => {
    try {
      await Clipboard.setStringAsync(generateTextContent);
      setShowCopiedFeedback(true);
      setTimeout(() => setShowCopiedFeedback(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  // Dev-only: Export debug JSON
  const handleExportDebugJSON = async () => {
    if (!__DEV__) return;

    // Gate: Prevent attribution computation during profile/mode switches
    if (isSwitching) {
      Alert.alert('Export Disabled', 'Cannot export debug data while switching profiles or modes.');
      return;
    }

    try {
      // Build projection inputs (baseline)
      const baselineProjectionInputs: ProjectionEngineInputs = {
        assetsToday: state.assets.map(a => ({
          id: a.id,
          name: a.name,
          balance: Number.isFinite(a.balance) ? Math.max(0, a.balance) : 0,
          annualGrowthRatePct: typeof a.annualGrowthRatePct === 'number' && Number.isFinite(a.annualGrowthRatePct) ? a.annualGrowthRatePct : undefined,
        })),
        liabilitiesToday: state.liabilities.map(l => ({
          id: l.id,
          name: l.name,
          balance: Number.isFinite(l.balance) ? Math.max(0, l.balance) : 0,
          annualInterestRatePct: typeof l.annualInterestRatePct === 'number' && Number.isFinite(l.annualInterestRatePct) ? l.annualInterestRatePct : undefined,
          kind: l.kind,
          remainingTermYears: typeof l.remainingTermYears === 'number' && Number.isFinite(l.remainingTermYears) ? l.remainingTermYears : undefined,
        })),
        currentAge: state.projection.currentAge,
        endAge: state.projection.endAge,
        inflationRatePct: state.projection.inflationPct,
        assetContributionsMonthly: state.assetContributions.map(c => ({
          assetId: c.assetId,
          amountMonthly: Number.isFinite(c.amountMonthly) ? Math.max(0, c.amountMonthly) : 0,
        })),
        monthlyDebtReduction: state.projection.monthlyDebtReduction,
      };

      // Compute projection results
      const baselineSummary = computeProjectionSummary(baselineProjectionInputs);
      const baselineSeries = computeProjectionSeries(baselineProjectionInputs);
      const baselineA3 = computeA3Attribution({
        snapshot: state,
        projectionSeries: baselineSeries,
        projectionSummary: baselineSummary,
        projectionInputs: baselineProjectionInputs, // Use actual simulation inputs to match summary contributions
      });

      // Build debug payload
      const payload = {
        snapshot: {
          state,
          computed: totals,
          loanDerived: loanDerivedRows,
        },
        projection: {
          settings: state.projection,
          selectedAge: state.projection.endAge, // Default to end age
          summary: baselineSummary,
          series: baselineSeries,
        },
        scenario: undefined, // Scenario state is only available in ProjectionResultsScreen
        attribution: {
          baseline: baselineA3,
          scenario: undefined,
        },
        checks: undefined,
      };

      const jsonString = serializeDebugState(payload);
      await Clipboard.setStringAsync(jsonString);
      Alert.alert('Debug Export', 'Copied debug JSON to clipboard');
    } catch (error) {
      console.error('Debug export error:', error);
      Alert.alert('Error', `Failed to export debug JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.bg} style={{flex:1}}>
      <ScreenHeader
        title="Snapshot Data Summary"
        rightAccessory={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {__DEV__ && (
              <Pressable
                onPress={handleExportDebugJSON}
                style={({ pressed }) => [
                  styles.copyButton,
                  styles.debugButton,
                  {
                    borderRadius: theme.radius.base,
                    backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.semantic.warningBg,
                    borderColor: theme.colors.semantic.warning,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Export debug JSON"
              >
                <Text style={[styles.copyButtonText, { color: theme.colors.semantic.warningText }]}>Export Debug JSON</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleCopyAll}
              style={({ pressed }) => [
                styles.copyButton,
                {
                  borderRadius: theme.radius.base,
                  backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                  borderColor: theme.colors.border.default,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Copy all"
            >
              <Text style={[styles.copyButtonText, { color: theme.colors.text.tertiary }]}>Copy All</Text>
            </Pressable>
          </View>
        }
      />
      {showCopiedFeedback ? (
        <View style={[styles.feedbackContainer, { backgroundColor: theme.colors.semantic.successBg }]}>
          <Text style={[styles.feedbackText, { color: theme.colors.semantic.successText }]}>Copied</Text>
        </View>
      ) : null}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Section 1: Meta */}
        <View style={[styles.section, { borderRadius: theme.radius.medium, borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.subtle }]}>
          <Text style={[styles.sectionHeader, { color: theme.colors.text.primary }]}>Section 1: Meta</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Current age: {state.projection.currentAge}</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Snapshot date: {formatSnapshotDate()}</Text>
        </View>

        {/* Section 2: Assets */}
        <View style={[styles.section, { borderRadius: theme.radius.medium, borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.subtle }]}>
          <Text style={[styles.sectionHeader, { color: theme.colors.text.primary }]}>Section 2: Assets</Text>
          {state.assets.length === 0 ? (
            <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>(no assets)</Text>
          ) : (
            state.assets.map((asset, index) => {
              const monthlyContribution = assetContributionsMap.get(asset.id) ?? 0;
              return (
                <View key={asset.id} style={[styles.assetBlock, { borderBottomColor: theme.colors.border.default }]}>
                  <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Asset ID: {asset.id}</Text>
                  <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Name: {asset.name}</Text>
                  <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Balance: {formatCurrencyFull(asset.balance)}</Text>
                  <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>
                    Growth rate: {formatPercent(asset.annualGrowthRatePct, { decimals: 2 })} per year
                  </Text>
                  <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Liquidity: {formatLiquidity(asset)}</Text>
                  <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Monthly contribution: {formatCurrencyFull(monthlyContribution)}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Section 3: Liabilities / Loans */}
        <View style={[styles.section, { borderRadius: theme.radius.medium, borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.subtle }]}>
          <Text style={[styles.sectionHeader, { color: theme.colors.text.primary }]}>Section 3: Liabilities / Loans</Text>
          {state.liabilities.length === 0 ? (
            <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>(no liabilities)</Text>
          ) : (
            state.liabilities.map(liability => {
              const derived = loanDerived.get(liability.id);
              const isLoan = liability.kind === 'loan';
              return (
                <View key={liability.id} style={[styles.loanBlock, { borderBottomColor: theme.colors.border.default }]}>
                  <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Loan ID: {liability.id}</Text>
                  <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Name: {liability.name}</Text>
                  <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Outstanding balance: {formatCurrencyFull(liability.balance)}</Text>
                  <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>
                    Interest rate: {formatPercent(liability.annualInterestRatePct, { decimals: 2 })} per year
                  </Text>
                  {isLoan && typeof liability.remainingTermYears === 'number' ? (
                    <>
                      <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Remaining term: {liability.remainingTermYears} years</Text>
                      <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Loan start date: null</Text>
                      {derived ? (
                        <>
                          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Derived (monthly):</Text>
                          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>- Monthly payment: {formatCurrencyFull(derived.monthlyPayment)}</Text>
                          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>
                            - Monthly interest (initial): {formatCurrencyFull(derived.monthlyInterest)}
                          </Text>
                          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>
                            - Monthly principal (initial): {formatCurrencyFull(derived.monthlyPrincipal)}
                          </Text>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* Section 4: Snapshot Cash Flow (Monthly Inputs) */}
        <View style={[styles.section, { borderRadius: theme.radius.medium, borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.subtle }]}>
          <Text style={[styles.sectionHeader, { color: theme.colors.text.primary }]}>Section 4: Snapshot Cash Flow (Monthly Inputs)</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Gross income: {formatCurrencyFull(totals.grossIncome)}</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Pension deduction: {formatCurrencyFull(totals.pension)}</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Other deductions: {formatCurrencyFull(totals.deductions)}</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Net income: {formatCurrencyFull(totals.netIncome)}</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Expenses: {formatCurrencyFull(totals.expenses)}</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Available cash: {formatCurrencyFull(totals.availableCash)}</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Asset contributions: {formatCurrencyFull(totals.assetContributions)}</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Debt repayment: {formatCurrencyFull(totals.liabilityReduction)}</Text>
          <Text style={[styles.monoText, { color: theme.colors.text.tertiary }]}>Monthly surplus: {formatCurrencyFull(totals.monthlySurplus)}</Text>
        </View>
      </ScrollView>
      </SketchBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor moved to inline style with theme.colors.bg.card
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.huge,
  },
  section: {
    marginBottom: layout.sectionGap,
    borderWidth: 1,
    // borderColor moved to inline style with theme.colors.border.default
    // borderRadius applied inline with theme.radius.medium
    padding: spacing.base,
    // backgroundColor moved to inline style with theme.colors.bg.subtle
  },
  sectionHeader: {
    ...typography.valueSmall,
    // color moved to inline style with theme.colors.text.primary
    marginBottom: layout.inputPadding,
  },
  monoText: {
    ...typography.body,
    fontFamily: 'monospace',
    // color moved to inline style with theme.colors.text.tertiary
    marginBottom: layout.componentGapTiny,
  },
  assetBlock: {
    marginBottom: spacing.base,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    // borderBottomColor moved to inline style with theme.colors.border.default
  },
  loanBlock: {
    marginBottom: spacing.base,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    // borderBottomColor moved to inline style with theme.colors.border.default
  },
  copyButton: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    // borderRadius applied inline with theme.radius.base
    // backgroundColor moved to inline style with theme.colors.bg.subtle
    borderWidth: 1,
    // borderColor moved to inline style with theme.colors.border.default
  },
  copyButtonText: {
    ...typography.valueSmall,
    // color moved to inline style with theme.colors.text.tertiary
  },
  feedbackContainer: {
    // backgroundColor moved to inline style with theme.colors.semantic.successBg
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  feedbackText: {
    // color moved to inline style with theme.colors.semantic.successText
    ...typography.valueSmall,
  },
  debugButton: {
    // backgroundColor moved to inline style with theme.colors.semantic.warningBg
    // borderColor moved to inline style with theme.colors.semantic.warning
  },
  debugButtonText: {
    // color moved to inline style with theme.colors.semantic.warningText
  },
});
