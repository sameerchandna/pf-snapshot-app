import React, { useMemo } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { useSnapshot } from '../context/SnapshotContext';
import EditableCollectionScreen, { HelpContent } from './EditableCollectionScreen';
import { Group, IncomeItem } from '../types';
import { selectNetIncome } from '../engines/selectors';
import { formatCurrencyFull } from '../ui/formatters';
import { parseItemName, parseMoney } from '../domain/domainValidation';
import CollectionRowWithActions from '../components/rows/CollectionRowWithActions';
import InlineRowEditor from '../components/rows/InlineRowEditor';

const netIncomeHelpContent: HelpContent = {
  title: 'Net Income',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Net Income is the money that actually reaches you each month.',
      ],
    },
    {
      heading: 'What is Net Income?',
      paragraphs: [
        'Net Income is income after tax, pension contributions, and other deductions.',
        'It represents spendable cash.',
      ],
    },
    {
      heading: 'Why Net Income matters',
      paragraphs: [
        'Net Income defines what you can spend, allocate, and save.',
        'It is often more operationally important than gross income.',
      ],
    },
    {
      heading: 'How to use this screen',
      paragraphs: [
        'Enter monthly take-home amounts.',
        'If pay varies, use a reasonable monthly average.',
      ],
    },
    {
      heading: 'What this screen does not do',
      paragraphs: [
        'This screen does not validate tax accuracy.',
        'It does not forecast income changes.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'Net Income is the starting point for expenses and available cash in Projection.',
      ],
    },
  ],
};

export default function NetIncomeDetailScreen() {
  const { state, setNetIncomeItems } = useSnapshot();

  const totalValue: number = useMemo(() => {
    return selectNetIncome(state);
  }, [state.netIncomeItems]);

  const totalText: string = useMemo(() => formatCurrencyFull(totalValue), [totalValue]);

  const maxValue: number = 1_000_000_000;

  const validateEditedItem = (ctx: { itemId: string | null; name: string; amount: number }): string | null => {
    const name = parseItemName(ctx.name);
    if (!name) return 'Name is required.';
    const parsed = parseMoney(String(ctx.amount));
    if (parsed === null) return 'Please enter a valid number for the amount.';
    if (parsed > maxValue) return `That value is too large. Max allowed is ${formatCurrencyFull(maxValue)}.`;
    return null;
  };

  const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const dummyGroups: Group[] = [];
  const noopSetGroups = (_groups: Group[]) => {};

  // Custom row renderer for v2 row architecture
  const renderNetIncomeRow = (
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
      title="Net Income"
      totalText={totalText}
      subtextMain="Monthly take-home income after deductions"
      subtextFootnote={undefined}
      helpContent={netIncomeHelpContent}
      emptyStateText="No net income items yet."
      allowGroups={false}
      groups={dummyGroups}
      setGroups={noopSetGroups}
      items={state.netIncomeItems}
      setItems={setNetIncomeItems}
      getItemId={item => item.id}
      getItemName={item => item.name}
      getItemAmount={item => item.monthlyAmount}
      getItemGroupId={_item => 'general'}
      makeNewItem={(_groupId, name, amount) => ({
        id: createId('net-income'),
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
      validateEditedItem={validateEditedItem}
      inlineEditorMode={true}
      renderRow={renderNetIncomeRow}
    />
  );
}


