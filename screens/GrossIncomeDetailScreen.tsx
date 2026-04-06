import React, { useMemo } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { useSnapshot } from '../context/SnapshotContext';
import EditableCollectionScreen, { HelpContent } from './EditableCollectionScreen';
import { Group, IncomeItem } from '../types';
import { selectGrossIncome } from '../engines/selectors';
import { formatCurrencyFull } from '../ui/formatters';
import CollectionRowWithActions from '../components/rows/CollectionRowWithActions';
import InlineRowEditor from '../components/rows/InlineRowEditor';

const grossIncomeHelpContent: HelpContent = {
  title: 'Gross Income',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Gross Income represents money earned before any deductions are applied.',
        'It sits at the very start of the cash-flow chain.',
      ],
    },
    {
      heading: 'What is Gross Income?',
      paragraphs: [
        'Gross Income is income earned prior to tax, pension contributions, and other deductions.',
      ],
      bullets: [
        'salary or wages',
        'gross bonus amounts',
        'other pre-deduction earnings',
      ],
    },
    {
      heading: 'Why Gross Income matters',
      paragraphs: [
        'Gross Income provides context for how income is structured and how much is lost to deductions.',
        'It is primarily used for explanation, not optimisation.',
      ],
    },
    {
      heading: 'How to use this screen',
      paragraphs: [
        'Enter amounts as monthly values.',
        'If income is annual or irregular, convert it to a monthly average.',
        'Separate sources if that improves clarity.',
      ],
    },
    {
      heading: 'What this screen does not do',
      paragraphs: [
        'This screen does not calculate tax bands.',
        'It does not optimise pension strategy.',
        'It does not assume income growth.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'Gross Income contributes to explaining cash flow, but Projection primarily operates on net income.',
      ],
    },
  ],
};

export default function GrossIncomeDetailScreen() {
  const { state, setGrossIncomeItems } = useSnapshot();

  const totalValue: number = useMemo(() => {
    return selectGrossIncome(state);
  }, [state.grossIncomeItems]);

  const totalText: string = useMemo(() => formatCurrencyFull(totalValue), [totalValue]);

  const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const dummyGroups: Group[] = [];
  const noopSetGroups = (_groups: Group[]) => {};

  // Custom row renderer for v2 row architecture
  const renderGrossIncomeRow = (
    item: IncomeItem,
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
      inline?: {
        draftName: string;
        draftAmount: string;
        errorMessage: string;
        onDraftNameChange: (v: string) => void;
        onDraftAmountChange: (v: string) => void;
        onSave: () => void;
        onCancel: () => void;
      };
    },
  ) => {
    if (state.inline) {
      return (
        <InlineRowEditor
          key={item.id}
          isLastInGroup={isLastInGroup}
          draftName={state.inline.draftName}
          draftAmount={state.inline.draftAmount}
          errorMessage={state.inline.errorMessage}
          onDraftNameChange={state.inline.onDraftNameChange}
          onDraftAmountChange={state.inline.onDraftAmountChange}
          onSave={state.inline.onSave}
          onCancel={state.inline.onCancel}
        />
      );
    }

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
        pressEnabled={!state.locked}
        onPress={callbacks.onEdit}
        onEdit={callbacks.onEdit}
        onDelete={callbacks.onDelete}
        disableDelete={disableDelete}
        disableEdit={true}
        swipeableRef={callbacks.swipeableRef}
        onSwipeableWillOpen={callbacks.onSwipeableWillOpen}
        onSwipeableOpen={callbacks.onSwipeableOpen}
        onSwipeableClose={callbacks.onSwipeableClose}
      />
    );
  };

  return (
    <EditableCollectionScreen<IncomeItem>
      title="Gross Income"
      totalText={totalText}
      subtextMain="Monthly income before deductions"
      subtextFootnote={undefined}
      helpContent={grossIncomeHelpContent}
      emptyStateText="No income items yet."
      allowGroups={false}
      groups={dummyGroups}
      setGroups={noopSetGroups}
      items={state.grossIncomeItems}
      setItems={setGrossIncomeItems}
      getItemId={item => item.id}
      getItemName={item => item.name}
      getItemAmount={item => item.monthlyAmount}
      getItemGroupId={_item => 'general'}
      makeNewItem={(_groupId, name, amount) => ({
        id: createId('gross-income'),
        name,
        monthlyAmount: amount,
      })}
      updateItem={(item, name, amount) => ({
        ...item,
        name,
        monthlyAmount: amount,
      })}
      formatAmountText={amount => formatCurrencyFull(amount)}
      formatGroupTotalText={total => formatCurrencyFull(total)}
      createNewGroup={() => ({ id: createId('group'), name: 'New Group' })}
      autoExpandSingleGroup={true}
      inlineEditorMode={true}
      renderRow={renderGrossIncomeRow}
    />
  );
}


