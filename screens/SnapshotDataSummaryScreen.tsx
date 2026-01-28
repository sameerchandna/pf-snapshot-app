import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import ScreenHeader from '../components/ScreenHeader';
import { useSnapshot } from '../SnapshotContext';
import { initLoan, stepLoanMonth } from '../loanEngine';
import { formatCurrencyFull, formatPercent } from '../formatters';
import { selectSnapshotTotals, selectLoanDerivedRows } from '../selectors';
import type { AssetItem } from '../types';
import { computeProjectionSummary, computeProjectionSeries, type ProjectionEngineInputs } from '../projectionEngine';
import { computeA3Attribution } from '../computeA3Attribution';
import { serializeDebugState } from '../debug/serializeDebugState';

function formatLiquidity(asset: AssetItem): string {
  if (!asset.availability) return 'immediate';
  return asset.availability.type;
}

function formatSnapshotDate(): string {
  return new Date().toISOString().split('T')[0];
}

export default function SnapshotDataSummaryScreen() {
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
        scenario: null, // Scenario state is only available in ProjectionResultsScreen
        attribution: {
          baseline: baselineA3,
          scenario: null,
        },
        checks: null,
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
      <ScreenHeader
        title="Snapshot Data Summary"
        subtitle="View raw financial inputs (read-only)"
        rightAccessory={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {__DEV__ && (
              <Pressable
                onPress={handleExportDebugJSON}
                style={({ pressed }) => [styles.copyButton, styles.debugButton, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Export debug JSON"
              >
                <Text style={[styles.copyButtonText, styles.debugButtonText]}>Export Debug JSON</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleCopyAll}
              style={({ pressed }) => [styles.copyButton, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Copy all"
            >
              <Text style={styles.copyButtonText}>Copy All</Text>
            </Pressable>
          </View>
        }
      />
      {showCopiedFeedback ? (
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackText}>Copied</Text>
        </View>
      ) : null}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Section 1: Meta */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Section 1: Meta</Text>
          <Text style={styles.monoText}>Current age: {state.projection.currentAge}</Text>
          <Text style={styles.monoText}>Snapshot date: {formatSnapshotDate()}</Text>
        </View>

        {/* Section 2: Assets */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Section 2: Assets</Text>
          {state.assets.length === 0 ? (
            <Text style={styles.monoText}>(no assets)</Text>
          ) : (
            state.assets.map((asset, index) => {
              const monthlyContribution = assetContributionsMap.get(asset.id) ?? 0;
              return (
                <View key={asset.id} style={styles.assetBlock}>
                  <Text style={styles.monoText}>Asset ID: {asset.id}</Text>
                  <Text style={styles.monoText}>Name: {asset.name}</Text>
                  <Text style={styles.monoText}>Balance: {formatCurrencyFull(asset.balance)}</Text>
                  <Text style={styles.monoText}>
                    Growth rate: {formatPercent(asset.annualGrowthRatePct, { decimals: 2 })} per year
                  </Text>
                  <Text style={styles.monoText}>Liquidity: {formatLiquidity(asset)}</Text>
                  <Text style={styles.monoText}>Monthly contribution: {formatCurrencyFull(monthlyContribution)}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Section 3: Liabilities / Loans */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Section 3: Liabilities / Loans</Text>
          {state.liabilities.length === 0 ? (
            <Text style={styles.monoText}>(no liabilities)</Text>
          ) : (
            state.liabilities.map(liability => {
              const derived = loanDerived.get(liability.id);
              const isLoan = liability.kind === 'loan';
              return (
                <View key={liability.id} style={styles.loanBlock}>
                  <Text style={styles.monoText}>Loan ID: {liability.id}</Text>
                  <Text style={styles.monoText}>Name: {liability.name}</Text>
                  <Text style={styles.monoText}>Outstanding balance: {formatCurrencyFull(liability.balance)}</Text>
                  <Text style={styles.monoText}>
                    Interest rate: {formatPercent(liability.annualInterestRatePct, { decimals: 2 })} per year
                  </Text>
                  {isLoan && typeof liability.remainingTermYears === 'number' ? (
                    <>
                      <Text style={styles.monoText}>Remaining term: {liability.remainingTermYears} years</Text>
                      <Text style={styles.monoText}>Loan start date: null</Text>
                      {derived ? (
                        <>
                          <Text style={styles.monoText}>Derived (monthly):</Text>
                          <Text style={styles.monoText}>- Monthly payment: {formatCurrencyFull(derived.monthlyPayment)}</Text>
                          <Text style={styles.monoText}>
                            - Monthly interest (initial): {formatCurrencyFull(derived.monthlyInterest)}
                          </Text>
                          <Text style={styles.monoText}>
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
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Section 4: Snapshot Cash Flow (Monthly Inputs)</Text>
          <Text style={styles.monoText}>Gross income: {formatCurrencyFull(totals.grossIncome)}</Text>
          <Text style={styles.monoText}>Pension deduction: {formatCurrencyFull(totals.pension)}</Text>
          <Text style={styles.monoText}>Other deductions: {formatCurrencyFull(totals.deductions)}</Text>
          <Text style={styles.monoText}>Net income: {formatCurrencyFull(totals.netIncome)}</Text>
          <Text style={styles.monoText}>Expenses: {formatCurrencyFull(totals.expenses)}</Text>
          <Text style={styles.monoText}>Available cash: {formatCurrencyFull(totals.availableCash)}</Text>
          <Text style={styles.monoText}>Asset contributions: {formatCurrencyFull(totals.assetContributions)}</Text>
          <Text style={styles.monoText}>Debt repayment: {formatCurrencyFull(totals.liabilityReduction)}</Text>
          <Text style={styles.monoText}>Monthly surplus: {formatCurrencyFull(totals.monthlySurplus)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  monoText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 18,
    marginBottom: 2,
  },
  assetBlock: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  loanBlock: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  copyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f2f3f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  feedbackContainer: {
    backgroundColor: '#4caf50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  feedbackText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  debugButton: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
  },
  debugButtonText: {
    color: '#856404',
  },
});
