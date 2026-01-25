import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import { useSnapshot } from '../SnapshotContext';
import { computeProjectionSeries, computeProjectionSummary } from '../projectionEngine';
import { computeA3Attribution } from '../computeA3Attribution';
import { formatCurrencyFull, formatCurrencyFullSigned } from '../formatters';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { ATTRIBUTION_TOLERANCE } from '../constants';

/**
 * Computes monthlySurplus as a pure residual (display-only, NOT part of asset roll-forward).
 * 
 * FLOW semantics: monthlySurplus = netSurplus - postTaxContributions - debtOverpayments
 * This matches user intuition: money left after all allocations (FLOW concept).
 */
function computeMonthlySurplus(netSurplus: number, postTaxContributions: number, debtOverpayments: number): number {
  return Math.max(0, netSurplus - postTaxContributions - debtOverpayments);
}

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

function Row({ label, value, valueStyle }: { label: string; value: string; valueStyle?: any }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueStyle]}>{value}</Text>
    </View>
  );
}

export default function A3ValidationScreen() {
  const { state } = useSnapshot();

  const projection = useMemo(() => {
    // Use helper to filter inactive items and contributions to inactive assets
    const inputs = buildProjectionInputsFromState(state);

    const projectionSeries = computeProjectionSeries(inputs);
    const projectionSummary = computeProjectionSummary(inputs);
    return { projectionSeries, projectionSummary };
  }, [state]);

  const a3 = useMemo(() => {
    return computeA3Attribution({
      snapshot: state,
      projectionSeries: projection.projectionSeries,
      projectionSummary: projection.projectionSummary,
    });
  }, [projection.projectionSeries, projection.projectionSummary, state]);

  const deltaBad: boolean = Math.abs(a3.reconciliation.delta) > ATTRIBUTION_TOLERANCE;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader title="A3 Validation" subtitle="Internal inspection surface" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <GroupHeader title="A3 Validation" />
          <Row label="Starting Net Worth" value={fmtBalance(a3.startingNetWorth)} />
          <Row label="Ending Net Worth" value={fmtBalance(a3.endingNetWorth)} />
        </View>

        <View style={styles.section}>
          <GroupHeader title="Cashflow" />
          <Row label="Gross income" value={fmtInflow(a3.cashflow.grossIncome)} />
          <Row label="Taxes" value={fmtOutflow(a3.cashflow.taxes)} />
          <Row label="Living expenses" value={fmtOutflow(a3.cashflow.livingExpenses)} />
          <Row label="Net surplus" value={fmtInflow(a3.cashflow.netSurplus)} />
          <Row label="Post-tax contributions" value={fmtOutflow(a3.cashflow.postTaxContributions)} />
          <Row label="Debt repayment (loan principal)" value={fmtOutflow(a3.cashflow.debtRepayment)} />
          <Row label="Unallocated cash" value={fmtOutflow(computeMonthlySurplus(a3.cashflow.netSurplus, a3.cashflow.postTaxContributions, a3.cashflow.debtRepayment))} />
        </View>

        <View style={styles.section}>
          <GroupHeader title="Debt" />
          <Row label="Interest paid" value={fmtOutflow(a3.debt.interestPaid)} />
          <Row label="Principal repaid" value={fmtOutflow(a3.debt.principalRepaid)} />
          <Row label="Remaining debt" value={fmtBalance(a3.debt.remainingDebt)} />
        </View>

        <View style={styles.section}>
          <GroupHeader title="Assets" />
          <Row label="Starting value" value={fmtBalance(a3.assets.startingValue)} />
          <Row label="Contributions" value={fmtBalance(a3.assets.contributions)} />
          <Row label="Growth" value={fmtInflow(a3.assets.growth)} />
          <Row label="Ending value" value={fmtBalance(a3.assets.endingValue)} />
        </View>

        <View style={styles.section}>
          <GroupHeader title="Reconciliation" />
          <Row label="LHS (ending net worth)" value={fmtBalance(a3.reconciliation.lhs)} />
          <Row label="RHS (reconstructed)" value={fmtBalance(a3.reconciliation.rhs)} />
          <Row
            label="Delta (lhs - rhs)"
            value={formatCurrencyFullSigned(a3.reconciliation.delta)}
            valueStyle={deltaBad ? styles.deltaBad : null}
          />
          {deltaBad ? <Text style={styles.deltaHint}>Delta is outside tolerance (|delta| &gt; £1).</Text> : null}
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
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    textAlign: 'right',
  },
  deltaBad: {
    color: '#b42318',
  },
  deltaHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#b42318',
  },
});


