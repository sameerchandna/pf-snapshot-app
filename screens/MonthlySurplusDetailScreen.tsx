import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSnapshot } from '../context/SnapshotContext';
import { useTheme } from '../ui/theme/useTheme';
import DetailScreenShell from '../components/DetailScreenShell';
import { HelpContent } from './EditableCollectionScreen';
import {
  selectAssetContributions,
  selectAvailableCash,
  selectSnapshotLiabilityReduction,
  selectMonthlySurplus,
} from '../engines/selectors';
import { formatCurrencyFullSigned } from '../ui/formatters';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';

const monthlySurplusHelpContent: HelpContent = {
  title: 'Monthly Surplus',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Monthly Surplus is what is left after all allocations are applied.',
      ],
    },
    {
      heading: 'What is Monthly Surplus?',
      paragraphs: [
        'It represents cash that is not spent, invested, or used to reduce debt.',
        'Monthly Surplus is a FLOW signal — it shows money movement per month, not an asset balance.',
      ],
    },
    {
      heading: 'Why Monthly Surplus matters',
      paragraphs: [
        'It reflects slack, optionality, and resilience in the system.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'Monthly Surplus does not automatically accumulate into your cash balance.',
        'It represents available cashflow that can be allocated to assets or debt reduction through scenarios.',
        'Your cash balance (shown in Assets) only changes if you explicitly choose to save or transfer money.',
      ],
    },
  ],
};

export default function MonthlySurplusDetailScreen() {
  const { theme } = useTheme();
  const styles = StyleSheet.create({
    block: {
      backgroundColor: theme.colors.bg.cardGradientBottom,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: theme.radius.medium,
      padding: spacing.base,
      marginBottom: layout.inputPadding,
    },
    blockTitle: {
      ...theme.typography.body,
      fontWeight: '600' as const,
      color: theme.colors.text.tertiary,
      marginBottom: spacing.xs,
    },
    text: {
      ...theme.typography.bodyLarge,
      color: theme.colors.text.tertiary,
      marginBottom: layout.micro,
    },
    result: {
      ...theme.typography.valueHero,
      color: theme.colors.text.primary,
    },
  });

  const { state } = useSnapshot();
  const totalAssetContributionsValue: number = selectAssetContributions(state);
  const totalLiabilityReductionsValue: number = selectSnapshotLiabilityReduction(state);
  const availableCashValue: number = selectAvailableCash(state);
  const monthlySurplusValue: number = selectMonthlySurplus(state);
  const monthlySurplusText: string = formatCurrencyFullSigned(monthlySurplusValue);

  const availableCashText: string = formatCurrencyFullSigned(availableCashValue);
  const liabilityReductionText: string = formatCurrencyFullSigned(-totalLiabilityReductionsValue);
  const assetContributionText: string = formatCurrencyFullSigned(-totalAssetContributionsValue);

  return (
    <DetailScreenShell
      title="Monthly Surplus"
      totalText={monthlySurplusText}
      subtextMain="Calculated from available cash and planned outflows"
      helpContent={monthlySurplusHelpContent}
    >
      <View style={styles.block}>
        <Text style={styles.blockTitle}>How it's calculated</Text>
        <Text style={styles.text}>
          Monthly Surplus = Available Cash − Liability Reduction − Asset Contribution
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Inputs</Text>
        <Text style={styles.text}>Available Cash: {availableCashText}</Text>
        <Text style={styles.text}>Liability Reduction: {liabilityReductionText}</Text>
        <Text style={styles.text}>Asset Contribution: {assetContributionText}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Result</Text>
        <Text style={styles.result}>{monthlySurplusText}</Text>
      </View>
    </DetailScreenShell>
  );
}


