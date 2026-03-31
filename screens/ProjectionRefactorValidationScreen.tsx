/**
 * Runtime validation screen for projection refactor.
 * 
 * Runs validation tests and displays results.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import { useSnapshot } from '../context/SnapshotContext';
import { 
  computeProjectionSeries, 
  computeProjectionSummary, 
  assertProjectionDeterminism,
  computeSingleAssetTimeSeries,
  computeSingleLiabilityTimeSeries,
} from '../engines/projectionEngine';
import { computeA3Attribution } from '../engines/computeA3Attribution';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { UI_TOLERANCE, ATTRIBUTION_TOLERANCE, SYSTEM_CASH_ID } from '../constants';
import { formatCurrencyFull, formatCurrencyFullSigned } from '../ui/formatters';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';

type ValidationResult = {
  aggregateDeterminism: 'PASS' | 'FAIL' | 'PENDING';
  attributionReconciliation: 'PASS' | 'FAIL' | 'PENDING';
  assetHelperSanity: 'PASS' | 'FAIL' | 'PENDING';
  liabilityHelperSanity: 'PASS' | 'FAIL' | 'PENDING';
  errors: Array<{
    test: string;
    cause: string;
    details?: string;
  }>;
};

function Row({ label, value, valueStyle, theme }: { label: string; value: string; valueStyle?: any; theme: any }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, theme.typography.body, { color: theme.colors.text.tertiary }]}>{label}</Text>
      <Text style={[styles.rowValue, theme.typography.label, { color: theme.colors.text.primary }, valueStyle]}>{value}</Text>
    </View>
  );
}

export default function ProjectionRefactorValidationScreen() {
  const { theme } = useTheme();
  const { state, isSwitching } = useSnapshot();
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    aggregateDeterminism: 'PENDING',
    attributionReconciliation: 'PENDING',
    assetHelperSanity: 'PENDING',
    liabilityHelperSanity: 'PENDING',
    errors: [],
  });

  const inputs = useMemo(() => {
    return buildProjectionInputsFromState(state);
  }, [state]);

  useEffect(() => {
    // Gate: Skip validation during profile/mode switches
    if (isSwitching) {
      return;
    }

    const errors: ValidationResult['errors'] = [];
    let aggregateDeterminism: 'PASS' | 'FAIL' = 'PASS';
    let attributionReconciliation: 'PASS' | 'FAIL' = 'PASS';
    let assetHelperSanity: 'PASS' | 'FAIL' = 'PASS';
    let liabilityHelperSanity: 'PASS' | 'FAIL' = 'PASS';

    try {
      // Step 1: Aggregate determinism
      const isDeterministic = assertProjectionDeterminism(inputs, UI_TOLERANCE);
      if (!isDeterministic) {
        aggregateDeterminism = 'FAIL';
        errors.push({
          test: 'Aggregate Determinism',
          cause: 'Projection outputs differ between runs (non-deterministic)',
        });
      }

      // Step 2: Attribution reconciliation
      const projectionSeries = computeProjectionSeries(inputs);
      const projectionSummary = computeProjectionSummary(inputs);
      const attribution = computeA3Attribution({
        snapshot: state,
        projectionSeries,
        projectionSummary,
        projectionInputs: inputs, // Use actual simulation inputs to match summary contributions
      });

      const attributionDelta = Math.abs(attribution.reconciliation.delta);
      if (attributionDelta > ATTRIBUTION_TOLERANCE) {
        attributionReconciliation = 'FAIL';
        errors.push({
          test: 'Attribution Reconciliation',
          cause: `Delta ${formatCurrencyFull(attributionDelta)} exceeds tolerance ${formatCurrencyFull(ATTRIBUTION_TOLERANCE)}`,
          details: `LHS: ${formatCurrencyFull(attribution.reconciliation.lhs)}, RHS: ${formatCurrencyFull(attribution.reconciliation.rhs)}`,
        });
      }

      // Step 3: Single-asset helper sanity
      const activeAssets = state.assets.filter(a => a.isActive !== false && a.id !== SYSTEM_CASH_ID);
      if (activeAssets.length > 0) {
        const testAsset = activeAssets[0];
        let assetSeries: Array<{ age: number; balance: number; cumulativeContributions: number; cumulativeGrowth: number }>;
        try {
          assetSeries = computeSingleAssetTimeSeries(inputs, testAsset.id);
          
          if (assetSeries.length === 0) {
            assetHelperSanity = 'FAIL';
            errors.push({
              test: 'Asset Helper Sanity',
              cause: 'Asset series is empty',
              details: `Asset: ${testAsset.name} (${testAsset.id})`,
            });
          } else {
            const startingBalance = assetSeries[0].balance;
            let prevContributions = assetSeries[0].cumulativeContributions;
            let prevBalance = assetSeries[0].balance;

            for (let i = 1; i < assetSeries.length; i++) {
              const point = assetSeries[i];

              // Check balances are non-negative
              if (point.balance < 0) {
                assetHelperSanity = 'FAIL';
                errors.push({
                  test: 'Asset Helper Sanity',
                  cause: `Negative balance at age ${point.age.toFixed(2)}: ${formatCurrencyFull(point.balance)}`,
                  details: `Asset: ${testAsset.name} (${testAsset.id})`,
                });
                break;
              }

              // Check contributions are monotonically increasing
              if (point.cumulativeContributions < prevContributions - UI_TOLERANCE) {
                assetHelperSanity = 'FAIL';
                errors.push({
                  test: 'Asset Helper Sanity',
                  cause: `Contributions decreased at age ${point.age.toFixed(2)}: ${formatCurrencyFull(prevContributions)} -> ${formatCurrencyFull(point.cumulativeContributions)}`,
                  details: `Asset: ${testAsset.name} (${testAsset.id})`,
                });
                break;
              }

              // Check growth reconciliation
              const expectedBalance = startingBalance + point.cumulativeContributions + point.cumulativeGrowth;
              const balanceDiff = Math.abs(point.balance - expectedBalance);
              if (balanceDiff > UI_TOLERANCE) {
                assetHelperSanity = 'FAIL';
                errors.push({
                  test: 'Asset Helper Sanity',
                  cause: `Growth reconciliation failed at age ${point.age.toFixed(2)}: diff ${formatCurrencyFull(balanceDiff)}`,
                  details: `Balance: ${formatCurrencyFull(point.balance)}, Expected: ${formatCurrencyFull(expectedBalance)} (starting ${formatCurrencyFull(startingBalance)} + contributions ${formatCurrencyFull(point.cumulativeContributions)} + growth ${formatCurrencyFull(point.cumulativeGrowth)})`,
                });
                break;
              }

              prevContributions = point.cumulativeContributions;
              prevBalance = point.balance;
            }
          }
        } catch (error) {
          assetHelperSanity = 'FAIL';
          errors.push({
            test: 'Asset Helper Sanity',
            cause: `Error: ${error instanceof Error ? error.message : String(error)}`,
            details: `Asset: ${testAsset.name} (${testAsset.id})`,
          });
        }
      } else {
        assetHelperSanity = 'PASS'; // No assets to test, skip
      }

      // Step 4: Single-liability helper sanity
      const activeLiabilities = state.liabilities.filter(l => l.isActive !== false);
      const loanLiabilities = activeLiabilities.filter(l => {
        // Check if it's a loan-like liability (has remainingTermYears)
        return typeof (l as any).remainingTermYears === 'number';
      });

      if (loanLiabilities.length > 0) {
        const testLiability = loanLiabilities[0];
        let liabilitySeries: Array<{ age: number; balance: number; cumulativePrincipalPaid: number; cumulativeInterestPaid: number }>;
        try {
          liabilitySeries = computeSingleLiabilityTimeSeries(inputs, testLiability.id);
          
          if (liabilitySeries.length === 0) {
            liabilityHelperSanity = 'FAIL';
            errors.push({
              test: 'Liability Helper Sanity',
              cause: 'Liability series is empty',
              details: `Liability: ${testLiability.name} (${testLiability.id})`,
            });
          } else {
            let prevBalance = liabilitySeries[0].balance;
            let prevPrincipal = liabilitySeries[0].cumulativePrincipalPaid;
            let prevInterest = liabilitySeries[0].cumulativeInterestPaid;
            let payoffReached = false;

            for (let i = 1; i < liabilitySeries.length; i++) {
              const point = liabilitySeries[i];

              // Check balance is non-negative
              if (point.balance < 0) {
                liabilityHelperSanity = 'FAIL';
                errors.push({
                  test: 'Liability Helper Sanity',
                  cause: `Negative balance at age ${point.age.toFixed(2)}: ${formatCurrencyFull(point.balance)}`,
                  details: `Liability: ${testLiability.name} (${testLiability.id})`,
                });
                break;
              }

              // Check balance monotonically decreases (or stays same after payoff)
              if (point.balance > prevBalance + UI_TOLERANCE) {
                liabilityHelperSanity = 'FAIL';
                errors.push({
                  test: 'Liability Helper Sanity',
                  cause: `Balance increased at age ${point.age.toFixed(2)}: ${formatCurrencyFull(prevBalance)} -> ${formatCurrencyFull(point.balance)}`,
                  details: `Liability: ${testLiability.name} (${testLiability.id})`,
                });
                break;
              }

              // Track payoff
              if (prevBalance <= UI_TOLERANCE) {
                payoffReached = true;
              }

              // Check interest stops after payoff
              if (payoffReached && point.cumulativeInterestPaid > prevInterest + UI_TOLERANCE) {
                liabilityHelperSanity = 'FAIL';
                errors.push({
                  test: 'Liability Helper Sanity',
                  cause: `Interest accrued after payoff at age ${point.age.toFixed(2)}`,
                  details: `Liability: ${testLiability.name} (${testLiability.id}), Previous interest: ${formatCurrencyFull(prevInterest)}, Current interest: ${formatCurrencyFull(point.cumulativeInterestPaid)}`,
                });
                break;
              }

              // Check principal and interest are monotonically increasing
              if (point.cumulativePrincipalPaid < prevPrincipal - UI_TOLERANCE) {
                liabilityHelperSanity = 'FAIL';
                errors.push({
                  test: 'Liability Helper Sanity',
                  cause: `Principal paid decreased at age ${point.age.toFixed(2)}: ${formatCurrencyFull(prevPrincipal)} -> ${formatCurrencyFull(point.cumulativePrincipalPaid)}`,
                  details: `Liability: ${testLiability.name} (${testLiability.id})`,
                });
                break;
              }

              if (point.cumulativeInterestPaid < prevInterest - UI_TOLERANCE) {
                liabilityHelperSanity = 'FAIL';
                errors.push({
                  test: 'Liability Helper Sanity',
                  cause: `Interest paid decreased at age ${point.age.toFixed(2)}: ${formatCurrencyFull(prevInterest)} -> ${formatCurrencyFull(point.cumulativeInterestPaid)}`,
                  details: `Liability: ${testLiability.name} (${testLiability.id})`,
                });
                break;
              }

              prevBalance = point.balance;
              prevPrincipal = point.cumulativePrincipalPaid;
              prevInterest = point.cumulativeInterestPaid;
            }
          }
        } catch (error) {
          liabilityHelperSanity = 'FAIL';
          errors.push({
            test: 'Liability Helper Sanity',
            cause: `Error: ${error instanceof Error ? error.message : String(error)}`,
            details: `Liability: ${testLiability.name} (${testLiability.id})`,
          });
        }
      } else {
        liabilityHelperSanity = 'PASS'; // No loans to test, skip
      }

      const result = {
        aggregateDeterminism,
        attributionReconciliation,
        assetHelperSanity,
        liabilityHelperSanity,
        errors,
      };

      setValidationResult(result);

      // Log results to console for easy inspection
      console.log('=== PROJECTION REFACTOR VALIDATION RESULTS ===');
      console.log('Aggregate Determinism:', aggregateDeterminism);
      console.log('Attribution Reconciliation:', attributionReconciliation);
      console.log('Asset Helper Sanity:', assetHelperSanity);
      console.log('Liability Helper Sanity:', liabilityHelperSanity);
      if (errors.length > 0) {
        console.log('Errors:', errors);
      }
      console.log('===============================================');
    } catch (error) {
      setValidationResult({
        aggregateDeterminism: 'FAIL',
        attributionReconciliation: 'FAIL',
        assetHelperSanity: 'FAIL',
        liabilityHelperSanity: 'FAIL',
        errors: [{
          test: 'Validation Error',
          cause: `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
        }],
      });
    }
  }, [inputs, state, isSwitching]);

  const getStatusStyle = (status: 'PASS' | 'FAIL' | 'PENDING') => {
    if (status === 'PASS') return [styles.statusPass, { color: theme.colors.semantic.success }];
    if (status === 'FAIL') return [styles.statusFail, { color: theme.colors.semantic.error }];
    return [styles.statusPending, { color: theme.colors.text.muted }];
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.card }]}>
      <ScreenHeader title="Refactor Validation" subtitle="Projection engine refactor validation" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.section, { borderColor: theme.colors.border.subtle, backgroundColor: theme.colors.bg.subtle }]}>
          <GroupHeader title="Validation Results" />
          <Row 
            label="Aggregate Determinism" 
            value={validationResult.aggregateDeterminism}
            valueStyle={getStatusStyle(validationResult.aggregateDeterminism)}
            theme={theme}
          />
          <Row 
            label="Attribution Reconciliation" 
            value={validationResult.attributionReconciliation}
            valueStyle={getStatusStyle(validationResult.attributionReconciliation)}
            theme={theme}
          />
          <Row 
            label="Asset Helper Sanity" 
            value={validationResult.assetHelperSanity}
            valueStyle={getStatusStyle(validationResult.assetHelperSanity)}
            theme={theme}
          />
          <Row 
            label="Liability Helper Sanity" 
            value={validationResult.liabilityHelperSanity}
            valueStyle={getStatusStyle(validationResult.liabilityHelperSanity)}
            theme={theme}
          />
        </View>

        {validationResult.errors.length > 0 && (
          <View style={[styles.section, { borderColor: theme.colors.border.subtle, backgroundColor: theme.colors.bg.subtle }]}>
            <GroupHeader title="Errors" />
            {validationResult.errors.map((error, idx) => (
              <View key={idx} style={[styles.errorItem, { backgroundColor: theme.colors.semantic.errorBg }]}>
                <Text style={[styles.errorTest, theme.typography.button, { color: theme.colors.semantic.errorText }]}>{error.test}</Text>
                <Text style={[styles.errorCause, theme.typography.body, { color: theme.colors.semantic.errorText }]}>{error.cause}</Text>
                {error.details && <Text style={[styles.errorDetails, theme.typography.body, { color: theme.colors.semantic.errorText }]}>{error.details}</Text>}
              </View>
            ))}
          </View>
        )}
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
  statusPass: {
    // color moved to inline style
  },
  statusFail: {
    // color moved to inline style
  },
  statusPending: {
    // color moved to inline style
  },
  errorItem: {
    marginBottom: spacing.base,
    padding: spacing.sm,
    // backgroundColor moved to inline style
    borderRadius: spacing.tiny,
  },
  errorTest: {
    // Typography moved to inline style with theme token
    // color moved to inline style
    marginBottom: spacing.tiny,
  },
  errorCause: {
    // Typography moved to inline style with theme token (13px → 12px via theme.typography.body)
    // color moved to inline style
    marginBottom: 2,
  },
  errorDetails: {
    // Typography moved to inline style with theme token
    // color moved to inline style
    fontStyle: 'italic',
  },
});
