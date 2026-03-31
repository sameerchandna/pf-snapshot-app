import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSnapshot } from '../context/SnapshotContext';
import DetailScreenShell from '../components/DetailScreenShell';
import { HelpContent } from './EditableCollectionScreen';
import { selectAssets, selectLiabilities, selectNetWorth } from '../engines/selectors';
import { formatCurrencyFull, formatCurrencyFullSigned } from '../ui/formatters';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { useTheme } from '../ui/theme/useTheme';

const netWorthHelpContent: HelpContent = {
  title: 'Net Worth',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Net Worth is the difference between assets and liabilities.',
      ],
    },
    {
      heading: 'What is Net Worth?',
      paragraphs: [
        'Net Worth represents your current financial position.',
        'It is calculated as assets minus liabilities.',
      ],
    },
    {
      heading: 'Why Net Worth matters',
      paragraphs: [
        'Net Worth summarises your financial system and tracks progress over time.',
      ],
    },
    {
      heading: 'What this screen does not do',
      paragraphs: [
        'This screen does not predict success.',
        'It does not compare you to others.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'Projection shows how net worth evolves over time based on cash flow, growth, and debt mechanics.',
      ],
    },
  ],
};

export default function NetWorthDetailScreen() {
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
  const totalAssetsValue: number = selectAssets(state);
  const totalLiabilitiesValue: number = selectLiabilities(state);
  const netWorthValue: number = selectNetWorth(state);
  const netWorthText: string = formatCurrencyFullSigned(netWorthValue);

  return (
    <DetailScreenShell
      title="Net Worth"
      totalText={netWorthText}
      subtextMain="Calculated from your assets and liabilities"
      helpContent={netWorthHelpContent}
    >
      <View style={styles.block}>
        <Text style={styles.blockTitle}>How it’s calculated</Text>
        <Text style={styles.text}>Net Worth = Total Assets − Total Liabilities</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Inputs</Text>
        <Text style={styles.text}>Total Assets: {formatCurrencyFull(totalAssetsValue)}</Text>
        <Text style={styles.text}>Total Liabilities: {formatCurrencyFull(totalLiabilitiesValue)}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Result</Text>
        <Text style={styles.result}>{netWorthText}</Text>
      </View>
    </DetailScreenShell>
  );
}



