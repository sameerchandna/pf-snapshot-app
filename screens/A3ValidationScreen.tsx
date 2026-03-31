import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import { useSnapshot } from '../context/SnapshotContext';
import { computeProjectionSeries, computeProjectionSummary } from '../engines/projectionEngine';
import { computeA3Attribution } from '../engines/computeA3Attribution';
import { formatCurrencyFull, formatCurrencyFullSigned } from '../ui/formatters';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { ATTRIBUTION_TOLERANCE } from '../constants';
import { selectMonthlySurplus } from '../engines/selectors';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';

// Phase 3.3: Removed local computeMonthlySurplus() - use selectMonthlySurplus() instead
// Monthly surplus is now single-sourced from selector (no manual computation, no clamping)

function fmtBalance(v: number): string {
  return formatCurrencyFull(v);
}

function fmtInflow(v: number): string {
  return v >= 0 ? `+${formatCurrencyFull(v)}` : formatCurrencyFullSigned(v);
}

function fmtOutflow(v: number): string {
  // Expect positive magnitudes; render as negative cash out.
  return formatCurrencyFullSigned(-Math.abs(v));
}

function Row({ label, value, valueStyle, theme }: { label: string; value: string; valueStyle?: any; theme: any }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, theme.typography.body, { color: theme.colors.text.tertiary }]}>{label}</Text>
      <Text style={[styles.rowValue, theme.typography.label, { color: theme.colors.text.primary }, valueStyle]}>{value}</Text>
    </View>
  );
}

export default function A3ValidationScreen() {
  const { theme } = useTheme();
  const { state, isSwitching } = useSnapshot();

  const projection = useMemo(() => {
    // Use helper to filter inactive items and contributions to inactive assets
    const inputs = buildProjectionInputsFromState(state);

    const projectionSeries = computeProjectionSeries(inputs);
    const projectionSummary = computeProjectionSummary(inputs);
    return { projectionSeries, projectionSummary, inputs };
  }, [state]);

  const a3 = useMemo(() => {
    // Gate: Prevent attribution computation during profile/mode switches
    if (isSwitching) {
      // Return a placeholder attribution during switching to avoid errors
      // This will be recomputed once switching completes
      return {
        startingNetWorth: 0,
        endingNetWorth: 0,
        cashflow: {
          grossIncome: 0,
          pensionContributions: 0,
          taxes: 0,
          livingExpenses: 0,
          netSurplus: 0,
          postTaxContributions: 0,
          debtRepayment: 0,
        },
        debt: {
          interestPaid: 0,
          principalRepaid: 0,
          remainingDebt: 0,
        },
        assets: {
          startingValue: 0,
          contributions: 0,
          growth: 0,
          endingValue: 0,
        },
        reconciliation: {
          lhs: 0,
          rhs: 0,
          delta: 0,
        },
        inactiveCounts: {
          assets: 0,
          liabilities: 0,
          expenses: 0,
        },
      };
    }
    
    return computeA3Attribution({
      snapshot: state,
      projectionSeries: projection.projectionSeries,
      projectionSummary: projection.projectionSummary,
      projectionInputs: projection.inputs, // Use actual simulation inputs to match summary contributions
    });
  }, [projection.projectionSeries, projection.projectionSummary, projection.inputs, state, isSwitching]);

  const deltaBad: boolean = Math.abs(a3.reconciliation.delta) > ATTRIBUTION_TOLERANCE;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.card }]}>
      <ScreenHeader title="A3 Validation" subtitle="Internal inspection surface" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.section, { borderColor: theme.colors.border.subtle, backgroundColor: theme.colors.bg.subtle }]}>
          <GroupHeader title="A3 Validation" />
          <Row label="Starting Net Worth" value={fmtBalance(a3.startingNetWorth)} theme={theme} />
          <Row label="Ending Net Worth" value={fmtBalance(a3.endingNetWorth)} theme={theme} />
        </View>

        <View style={[styles.section, { borderColor: theme.colors.border.subtle, backgroundColor: theme.colors.bg.subtle }]}>
          <GroupHeader title="Cashflow" />
          <Row label="Gross income" value={fmtInflow(a3.cashflow.grossIncome)} theme={theme} />
          <Row label="Taxes" value={fmtOutflow(a3.cashflow.taxes)} theme={theme} />
          <Row label="Living expenses" value={fmtOutflow(a3.cashflow.livingExpenses)} theme={theme} />
          <Row label="Net surplus" value={fmtInflow(a3.cashflow.netSurplus)} theme={theme} />
          <Row label="Post-tax contributions" value={fmtOutflow(a3.cashflow.postTaxContributions)} theme={theme} />
          <Row label="Debt repayment (loan principal)" value={fmtOutflow(a3.cashflow.debtRepayment)} theme={theme} />
          {/* Phase 3.3: Use selector for monthly surplus (single source of truth, no clamping) */}
          <Row label="Unallocated cash" value={fmtOutflow(selectMonthlySurplus(state))} theme={theme} />
        </View>

        <View style={[styles.section, { borderColor: theme.colors.border.subtle, backgroundColor: theme.colors.bg.subtle }]}>
          <GroupHeader title="Debt" />
          <Row label="Interest paid" value={fmtOutflow(a3.debt.interestPaid)} theme={theme} />
          <Row label="Principal repaid" value={fmtOutflow(a3.debt.principalRepaid)} theme={theme} />
          <Row label="Remaining debt" value={fmtBalance(a3.debt.remainingDebt)} theme={theme} />
        </View>

        <View style={[styles.section, { borderColor: theme.colors.border.subtle, backgroundColor: theme.colors.bg.subtle }]}>
          <GroupHeader title="Assets" />
          <Row label="Starting value" value={fmtBalance(a3.assets.startingValue)} theme={theme} />
          <Row label="Contributions" value={fmtBalance(a3.assets.contributions)} theme={theme} />
          <Row label="Growth" value={fmtInflow(a3.assets.growth)} theme={theme} />
          <Row label="Ending value" value={fmtBalance(a3.assets.endingValue)} theme={theme} />
        </View>

        <View style={[styles.section, { borderColor: theme.colors.border.subtle, backgroundColor: theme.colors.bg.subtle }]}>
          <GroupHeader title="Reconciliation" />
          <Row label="LHS (ending net worth)" value={fmtBalance(a3.reconciliation.lhs)} theme={theme} />
          <Row label="RHS (reconstructed)" value={fmtBalance(a3.reconciliation.rhs)} theme={theme} />
          <Row
            label="Delta (lhs - rhs)"
            value={formatCurrencyFullSigned(a3.reconciliation.delta)}
            valueStyle={deltaBad ? [styles.deltaBad, { color: theme.colors.semantic.errorText }] : null}
            theme={theme}
          />
          {deltaBad ? <Text style={[styles.deltaHint, theme.typography.body, { color: theme.colors.semantic.errorText }]}>Delta is outside tolerance (|delta| &gt; £1).</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor moved to inline style
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.huge,
  },
  section: {
    marginBottom: spacing.xl,
    borderWidth: 1,
    // borderColor moved to inline style
    borderRadius: 8,
    padding: spacing.base,
    // backgroundColor moved to inline style
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.base,
    marginBottom: spacing.sm,
  },
  rowLabel: {
    flex: 1,
    // Typography moved to inline style with theme token (13px → 12px via theme.typography.body)
    // color moved to inline style
  },
  rowValue: {
    // Typography moved to inline style with theme token (13px/600 → 12px/600 via theme.typography.label)
    // color moved to inline style
    textAlign: 'right',
  },
  deltaBad: {
    // color moved to inline style
  },
  deltaHint: {
    marginTop: spacing.sm,
    // Typography moved to inline style with theme token
    // color moved to inline style
  },
});


