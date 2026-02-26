import React, { useMemo } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { useSnapshot } from '../SnapshotContext';
import EditableCollectionScreen, { HelpContent } from './EditableCollectionScreen';
import { Group, LiabilityReductionItem } from '../types';
import { selectLoanDerivedRows, selectSnapshotLiabilityReduction } from '../selectors';
import { formatCurrencyFullSigned } from '../formatters';
import { StyleSheet } from 'react-native';
import CollectionRowWithActions from '../components/rows/CollectionRowWithActions';

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

  // Custom row renderer for v2 row architecture
  const renderLiabilityReductionRow = (
    item: LiabilityReductionItem,
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
    // For LiabilityReductions:
    // - allowGroups={false}, so groupsEnabled = false
    // - allowDeleteItems not set, so canDeleteItems = true (default)
    // - isItemLocked={item => item.id.startsWith('loan-overpayment:')}, so locked = true for loan-overpayment items
    // - Therefore: disableDelete = locked || false || false = locked
    const disableDelete = state.locked;

    return (
      <CollectionRowWithActions
        key={item.id}
        name={state.name}
        amountText={state.amountText}
        subtitle={state.metaText}
        locked={state.locked}
        isCurrentlyEditing={state.isCurrentlyEditing}
        dimRow={state.dimRow}
        isLastInGroup={isLastInGroup}
        pressEnabled={false}
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
    <EditableCollectionScreen<LiabilityReductionItem>
      title="Liability Reduction"
      totalText={totalText}
      subtextMain="Monthly payments that reduce debt balances"
      subtextFootnote={undefined}
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
      renderRow={renderLiabilityReductionRow}
    />
  );
}

const styles = StyleSheet.create({});

