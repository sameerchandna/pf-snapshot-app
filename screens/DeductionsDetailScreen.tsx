import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSnapshot } from '../SnapshotContext';
import DetailScreenShell from '../components/DetailScreenShell';
import { HelpContent } from './EditableCollectionScreen';
import { selectDeductions, selectGrossIncome, selectNetIncome, selectPension } from '../selectors';
import { formatCurrencyFull, formatCurrencyFullSigned } from '../formatters';
import { spacing } from '../spacing';
import { layout } from '../layout';

const otherDeductionsHelpContent: HelpContent = {
  title: 'Other Deductions',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Other Deductions capture non-discretionary reductions from income that are not expenses.',
      ],
    },
    {
      heading: 'What are Other Deductions?',
      paragraphs: [
        'These are amounts removed from income that are not taxes, pensions, or discretionary spending.',
      ],
    },
    {
      heading: 'Why Other Deductions matter',
      paragraphs: [
        'They explain why gross income differs from net income.',
        'They improve transparency in cash-flow attribution.',
      ],
    },
    {
      heading: 'How to use this screen',
      paragraphs: [
        'Enter deductions as monthly amounts.',
        'Include only deductions that reduce take-home pay.',
      ],
    },
    {
      heading: 'What this screen does not do',
      paragraphs: [
        'This screen does not categorise deductions.',
        'It does not judge their value.',
        'It does not optimise income structure.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'Deductions reduce net income and therefore reduce available cash downstream.',
      ],
    },
  ],
};

export default function DeductionsDetailScreen() {
  const { state } = useSnapshot();
  const grossIncomeValue: number = selectGrossIncome(state);
  const pensionValue: number = selectPension(state);
  const netIncomeValue: number = selectNetIncome(state);
  const deductionsValue: number = selectDeductions(state);
  const deductionsText: string = formatCurrencyFullSigned(-deductionsValue);

  return (
    <DetailScreenShell
      title="Other Deductions"
      totalText={deductionsText}
      subtextMain="Calculated gap between gross pay and take-home pay"
      helpContent={otherDeductionsHelpContent}
    >
      <View style={styles.block}>
        <Text style={styles.blockTitle}>How it’s calculated</Text>
        <Text style={styles.text}>Other Deductions = Gross Income − Pension − Net Income</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Inputs</Text>
        <Text style={styles.text}>Gross Income: {formatCurrencyFull(grossIncomeValue)}</Text>
        <Text style={styles.text}>Pension: {formatCurrencyFullSigned(-pensionValue)}</Text>
        <Text style={styles.text}>Net Income: {formatCurrencyFull(netIncomeValue)}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Result</Text>
        <Text style={styles.result}>{deductionsText}</Text>
        <Text style={styles.caption}>Clamped at 0 (never shows as positive “deductions”).</Text>
      </View>
    </DetailScreenShell>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: spacing.base,
    marginBottom: layout.inputPadding,
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    marginBottom: spacing.xs,
  },
  text: {
    fontSize: 14,
    color: '#333',
    marginBottom: layout.micro,
  },
  result: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  caption: {
    fontSize: 12,
    color: '#666',
    marginTop: spacing.tiny,
  },
});


