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
import { spacing } from '../spacing';
import { layout } from '../layout';
import { Swipeable } from 'react-native-gesture-handler';
import CollectionRowWithActions from '../components/rows/CollectionRowWithActions';

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

  // Custom row renderer for v2 row architecture
  // This override bypasses FinancialItemRow and uses EditableCollectionScreen's swipe coordination.
  // Uses CollectionRowWithActions → SemanticRow → SwipeRowContainer → RowVisual stack.
  // Preserves external edit behavior: loans navigate to LoanDetail, other liabilities use inline editor.
  const renderLiabilityRow = (
    item: LiabilityItem,
    index: number,
    groupId: string | undefined,
    isLastInGroup: boolean,
    callbacks: {
      onEdit: () => void;
      onDelete: () => void;
      onToggleActive?: () => void;
      swipeableRef?: (ref: Swipeable | null) => void;
      onSwipeableWillOpen?: () => void;
      onSwipeableOpen?: () => void;
      onSwipeableClose?: () => void;
    },
    state: {
      locked: boolean;
      isActive: boolean;
      isInactive: boolean;
      isCurrentlyEditing: boolean;
      dimRow: boolean;
      showTopDivider: boolean;
      name: string;
      amountText: string;
      metaText: string | null;
    },
  ) => {
    // Compute disableDelete using exact legacy conditions from EditableCollectionScreen line 772:
    // deleteDisabled = locked || !canDeleteItems || (groupsEnabled && canCollapseGroups && groupId && !isExpanded(groupId))
    // For LiabilitiesDetailScreen:
    // - allowGroups={false}, so groupsEnabled = false
    // - allowDeleteItems not set, so canDeleteItems = true (default)
    // - Therefore: disableDelete = locked || false || false = locked
    const disableDelete = state.locked;

    return (
      <CollectionRowWithActions
        key={item.id}
        name={state.name}
        amountText={state.amountText}
        subtitle={state.metaText}
        locked={state.locked}
        isActive={state.isActive}
        onToggleActive={callbacks.onToggleActive}
        isCurrentlyEditing={state.isCurrentlyEditing}
        dimRow={state.dimRow}
        isLastInGroup={isLastInGroup}
        pressEnabled={true}
        onPress={() => {
          navigation.navigate('BalanceDeepDive', { itemId: item.id });
        }}
        onEdit={callbacks.onEdit}
        onDelete={callbacks.onDelete}
        disableDelete={disableDelete}
        swipeableRef={callbacks.swipeableRef}
        onSwipeableWillOpen={callbacks.onSwipeableWillOpen}
        onSwipeableOpen={callbacks.onSwipeableOpen}
        onSwipeableClose={callbacks.onSwipeableClose}
      />
    );
  };

  return (
    <EditableCollectionScreen<LiabilityItem>
      title="Liabilities"
      totalText={totalText}
      subtextMain="Grouped liabilities"
      subtextFootnote={undefined}
      allowGroups={false}
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
              style={({ pressed }) => [
                styles.templateCard,
                {
                  backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.card,
                  borderColor: theme.colors.border.default,
                },
              ]}
            >
              <Text style={[styles.templateTitle, { color: theme.colors.text.primary }]}>Mortgage</Text>
              <Text style={[styles.templateSub, { color: theme.colors.text.secondary }]}>Balance, rate, term</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('LoanDetail', { template: 'loan', groupId: ensureGroup('Loans') })}
              style={({ pressed }) => [
                styles.templateCard,
                {
                  backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.card,
                  borderColor: theme.colors.border.default,
                },
              ]}
            >
              <Text style={[styles.templateTitle, { color: theme.colors.text.primary }]}>Loan</Text>
              <Text style={[styles.templateSub, { color: theme.colors.text.secondary }]}>Balance, rate, term</Text>
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
      renderRow={renderLiabilityRow}
    />
  );
}

const styles = StyleSheet.create({
  templateRow: {
    flexDirection: 'row',
    gap: layout.inputPadding,
    marginTop: spacing.base,
  },
  templateCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.tiny,
  },
  templateSub: {
    fontSize: 12,
  },
});

