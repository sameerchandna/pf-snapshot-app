import React, { useMemo } from 'react';
import { useSnapshot } from '../SnapshotContext';
import EditableCollectionScreen, { HelpContent } from './EditableCollectionScreen';
import { Group, LiabilityItem } from '../types';
import { selectLiabilities } from '../selectors';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { formatCurrencyFull } from '../formatters';
import EducationBox from '../components/EducationBox';
import { useTheme } from '../ui/theme/useTheme';

const liabilitiesHelpContent: HelpContent = {
  title: 'Liabilities',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Liabilities represent what you owe today.',
      ],
    },
    {
      heading: 'What are Liabilities?',
      paragraphs: [
        'Liabilities include loans, credit cards, overdrafts, and other debts.',
      ],
    },
    {
      heading: 'Why Liabilities matter',
      paragraphs: [
        'Liabilities accrue interest, reduce net worth, and constrain flexibility.',
      ],
    },
    {
      heading: 'How to use this screen',
      paragraphs: [
        'Enter current balances.',
        'Assign interest rates where relevant.',
        'Loans can be configured in detail separately.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'Liabilities accrue interest and are reduced over time through repayments.',
      ],
    },
  ],
};

export default function LiabilitiesDetailScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { state, setExpenses, setLiabilityGroups, setLiabilities, setLiabilityReductions } = useSnapshot();

  const totalValue: number = useMemo(() => {
    return selectLiabilities(state);
  }, [state.liabilities]);

  const totalText: string = useMemo(() => formatCurrencyFull(totalValue), [totalValue]);

  const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const createNewGroup = (): Group => ({ id: createId('liability-group'), name: 'New Group' });

  const ensureGroup = (name: 'Mortgages' | 'Loans'): string => {
    const existing = state.liabilityGroups.find(g => g.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    const id = createId('liability-group');
    setLiabilityGroups([...state.liabilityGroups, { id, name }]);
    return id;
  };

  const isLoan = (item: LiabilityItem): boolean => item.kind === 'loan';

  const setLiabilitiesWithCleanup = (nextLiabs: LiabilityItem[]) => {
    const prevLoanIds = new Set(state.liabilities.filter(l => isLoan(l)).map(l => l.id));
    const nextLoanIds = new Set(nextLiabs.filter(l => isLoan(l)).map(l => l.id));
    const removed: string[] = [];
    for (const id of prevLoanIds) {
      if (!nextLoanIds.has(id)) removed.push(id);
    }

    if (removed.length > 0) {
      // Mortgage payments (interest + scheduled principal) are in expenses
      const removedInterestIds = new Set(removed.map(id => `loan-interest:${id}`));
      const removedPrincipalIds = new Set(removed.map(id => `loan-principal:${id}`));
      // Remove both interest and principal from expenses (full scheduled payment)
      setExpenses(state.expenses.filter(e => !removedInterestIds.has(e.id) && !removedPrincipalIds.has(e.id)));
      // Remove any legacy loan-principal items from liabilityReductions (defensive cleanup)
      setLiabilityReductions(state.liabilityReductions.filter(r => !removedPrincipalIds.has(r.id)));
    }

    setLiabilities(nextLiabs);
  };

  return (
    <EditableCollectionScreen<LiabilityItem>
      title="Liabilities"
      totalText={totalText}
      subtextMain="Grouped liabilities"
      subtextFootnote={undefined}
      allowGroups={false}
      editorPlacement="top"
      secondaryNumberField={{
        label: 'Interest Rate (%)',
        placeholder: 'APR %',
        getItemValue: item => (isLoan(item) ? null : item.annualInterestRatePct),
        min: 0,
        max: 100,
      }}
      formatItemMetaText={item =>
        !isLoan(item) && typeof item.annualInterestRatePct === 'number' && Number.isFinite(item.annualInterestRatePct)
          ? `${item.annualInterestRatePct.toLocaleString('en-GB', { maximumFractionDigits: 2 })}%`
          : null
      }
      canInlineEditItem={item => !isLoan(item)}
      onExternalEditItem={item => {
        if (!isLoan(item)) return;
        const template = item.loanTemplate === 'mortgage' ? 'mortgage' : 'loan';
        navigation.navigate('LoanDetail', { template, groupId: item.groupId, liabilityId: item.id });
      }}
      renderIntro={
        <View>
          <EducationBox lines={['Only active items are used in your Snapshot and projections. Inactive items are kept for reference.']} />
          <View style={styles.templateRow}>
            <Pressable
              onPress={() => navigation.navigate('LoanDetail', { template: 'mortgage', groupId: ensureGroup('Mortgages') })}
              style={({ pressed }) => [styles.templateCard, { backgroundColor: pressed ? theme.colors.bg.subtle : undefined }]}
            >
              <Text style={styles.templateTitle}>Mortgage</Text>
              <Text style={styles.templateSub}>Balance, rate, term</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('LoanDetail', { template: 'loan', groupId: ensureGroup('Loans') })}
              style={({ pressed }) => [styles.templateCard, { backgroundColor: pressed ? theme.colors.bg.subtle : undefined }]}
            >
              <Text style={styles.templateTitle}>Loan</Text>
              <Text style={styles.templateSub}>Balance, rate, term</Text>
            </Pressable>
          </View>
        </View>
      }
      helpContent={liabilitiesHelpContent}
      emptyStateText="No liabilities yet."
      groups={state.liabilityGroups}
      setGroups={setLiabilityGroups}
      items={state.liabilities}
      setItems={setLiabilitiesWithCleanup}
      getItemId={item => item.id}
      getItemName={item => item.name}
      getItemAmount={item => item.balance}
      getItemGroupId={item => item.groupId}
      makeNewItem={(groupId, name, amount, extra) => ({
        id: createId('liability'),
        name,
        balance: amount,
        annualInterestRatePct: typeof extra?.secondaryNumber === 'number' ? extra.secondaryNumber : undefined,
        groupId,
        isActive: true,
      })}
      updateItem={(item, name, amount, extra) =>
        isLoan(item)
          ? item
          : {
              ...item,
              name,
              balance: amount,
              annualInterestRatePct: typeof extra?.secondaryNumber === 'number' ? extra.secondaryNumber : undefined,
            }
      }
      formatAmountText={amount => formatCurrencyFull(amount)}
      formatGroupTotalText={total => formatCurrencyFull(total)}
      createNewGroup={createNewGroup}
      getItemIsActive={item => item.isActive !== false}
      setItemIsActive={(item, isActive) => ({ ...item, isActive })}
      onItemPress={(item) => {
        navigation.navigate('BalanceDeepDive', { itemId: item.id });
      }}
    />
  );
}

const styles = StyleSheet.create({
  templateRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  templateCard: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  templateSub: {
    fontSize: 12,
    color: '#666',
  },
});

