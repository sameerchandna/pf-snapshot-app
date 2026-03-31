import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useSnapshot } from '../context/SnapshotContext';
import { useTheme } from '../ui/theme/useTheme';
import DetailScreenShell from '../components/DetailScreenShell';
import { HelpContent } from './EditableCollectionScreen';
import { selectAvailableCash, selectNetIncome, selectSnapshotExpenses } from '../engines/selectors';
import { formatCurrencyFull, formatCurrencyFullSigned } from '../ui/formatters';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';

const availableCashHelpContent: HelpContent = {
  title: 'Available Cash',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Available Cash is what remains after income and expenses are accounted for.',
        'It represents the monthly cash that can be directed toward assets, liabilities, or held as cash.',
      ],
    },
    {
      heading: 'What is Available Cash?',
      paragraphs: [
        'Available Cash is the portion of your income that has not yet been allocated.',
        'It sits between money you earn and decisions about what to do with that money.',
      ],
    },
    {
      heading: 'Why Available Cash matters',
      paragraphs: [
        'Available Cash determines how much flexibility your system has.',
        'It affects how much you can invest, how quickly you can reduce debt, and how resilient your finances are to change.',
      ],
    },
    {
      heading: 'How this value is derived',
      paragraphs: [
        'Available Cash is calculated as total income minus total expenses.',
        'No assumptions or optimisation are applied.',
        'This value updates automatically as income or expenses change.',
      ],
    },
    {
      heading: 'What this screen does not do',
      paragraphs: [
        'This screen does not suggest how Available Cash should be used.',
        'It does not allocate cash automatically.',
        'It does not assume unused cash is wasted.',
      ],
    },
    {
      heading: 'Common surprises',
      paragraphs: [
        'High income does not guarantee high Available Cash.',
        'Small recurring expenses can materially reduce Available Cash.',
        'Available Cash can be negative if expenses exceed income.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'In Projection, Available Cash is the source for asset contributions, liability reduction, and remaining cash accumulation.',
        'How Available Cash is used determines how net worth evolves over time.',
      ],
    },
  ],
};

export default function AvailableCashDetailScreen() {
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
  const totalExpensesValue: number = selectSnapshotExpenses(state);
  const netIncomeValue: number = selectNetIncome(state);
  const availableCashValue: number = selectAvailableCash(state);
  const availableCashText: string = formatCurrencyFullSigned(availableCashValue);
  const netIncomeText: string = formatCurrencyFull(netIncomeValue);
  const expensesText: string = formatCurrencyFullSigned(-totalExpensesValue);

  return (
    <DetailScreenShell
      title="Available Cash"
      totalText={availableCashText}
      subtextMain="Calculated from your take-home income and expenses"
      helpContent={availableCashHelpContent}
    >
      <View style={styles.block}>
        <Text style={styles.blockTitle}>How it’s calculated</Text>
        <Text style={styles.text}>Available Cash = Net Income − Expenses</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Inputs</Text>
        <Text style={styles.text}>Net Income: {netIncomeText}</Text>
        <Text style={styles.text}>Expenses: {expensesText}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Result</Text>
        <Text style={styles.result}>{availableCashText}</Text>
      </View>
    </DetailScreenShell>
  );
}



