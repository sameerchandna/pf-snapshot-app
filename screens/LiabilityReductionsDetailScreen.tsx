import React, { useMemo } from 'react';
import { useSnapshot } from '../SnapshotContext';
import GroupedListDetailScreen, { HelpContent } from './GroupedListDetailScreen';
import { Group, LiabilityReductionItem } from '../types';
import { selectLoanDerivedRows, selectSnapshotLiabilityReduction } from '../selectors';
import { formatCurrencyFullSigned } from '../formatters';
import { StyleSheet } from 'react-native';

const liabilityReductionHelpContent: HelpContent = {
  title: 'Liability Reduction',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Liability Reduction represents cash used to reduce debt balances.',
      ],
    },
    {
      heading: 'What is Liability Reduction?',
      paragraphs: [
        'It includes discretionary overpayments on loans and extra payments toward non-loan liabilities.',
        'Scheduled mortgage principal payments are treated as expenses, not liability reduction.',
      ],
    },
    {
      heading: 'Why Liability Reduction matters',
      paragraphs: [
        'Reducing liabilities lowers future interest costs and increases net worth directly.',
      ],
    },
    {
      heading: 'How this works in the system',
      paragraphs: [
        'Loan repayments are handled by the loan engine.',
        'Non-loan debt reduction is applied proportionally by balance.',
      ],
    },
    {
      heading: 'What this screen does not do',
      paragraphs: [
        'This screen does not optimise which debt to pay first.',
        'It does not compare strategies.',
        'It does not provide advice.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'Liability Reduction lowers outstanding debt over time and improves net worth.',
      ],
    },
  ],
};

export default function LiabilityReductionsDetailScreen() {
  const { state, setLiabilityReductions } = useSnapshot();

  const totalValue: number = useMemo(() => {
    return selectSnapshotLiabilityReduction(state);
  }, [state.liabilityReductions]);

  const totalText: string = useMemo(() => formatCurrencyFullSigned(-totalValue), [totalValue]);

  const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const dummyGroups: Group[] = [];
  const noopSetGroups = (_groups: Group[]) => {};

  // Filter out loan-principal items (scheduled principal belongs in expenses, not liability reduction)
  // This is defensive - they shouldn't be in liabilityReductions anymore, but protects against legacy state
  const filteredLiabilityReductions = useMemo(() => {
    return state.liabilityReductions.filter(item => !item.id.startsWith('loan-principal:'));
  }, [state.liabilityReductions]);

  const showEmptyState: boolean = filteredLiabilityReductions.length === 0;

  return (
    <GroupedListDetailScreen<LiabilityReductionItem>
      title="Liability Reduction"
      totalText={totalText}
      subtextMain="Monthly payments that reduce debt balances"
      subtextFootnote={undefined}
      editorPlacement="top"
      isItemLocked={item => item.id.startsWith('loan-overpayment:')}
      helpContent={liabilityReductionHelpContent}
      emptyStateText={showEmptyState ? "No liability reductions yet." : null}
      allowGroups={false}
      groups={dummyGroups}
      setGroups={noopSetGroups}
      items={filteredLiabilityReductions}
      setItems={(items) => {
        // When setting items, ensure we never add loan-principal items
        const cleaned = items.filter(item => !item.id.startsWith('loan-principal:'));
        setLiabilityReductions(cleaned);
      }}
      getItemId={item => item.id}
      getItemName={item => item.name}
      getItemAmount={item => item.monthlyAmount}
      getItemGroupId={_item => 'general'}
      makeNewItem={(_groupId, name, amount) => ({
        id: createId('liab-reduction'),
        name,
        monthlyAmount: amount,
      })}
      updateItem={(item, name, amount) => ({
        ...item,
        name,
        monthlyAmount: amount,
      })}
      formatAmountText={amount => formatCurrencyFullSigned(-amount)}
      formatGroupTotalText={total => formatCurrencyFullSigned(-total)}
      createNewGroup={() => ({ id: createId('group'), name: 'New Group' })}
      autoExpandSingleGroup={true}
    />
  );
}

const styles = StyleSheet.create({});

