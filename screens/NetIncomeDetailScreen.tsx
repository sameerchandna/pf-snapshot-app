import React, { useMemo } from 'react';
import { useSnapshot } from '../SnapshotContext';
import GroupedListDetailScreen, { HelpContent } from './GroupedListDetailScreen';
import { Group, IncomeItem } from '../types';
import { selectNetIncome } from '../selectors';
import { formatCurrencyFull } from '../formatters';

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

  const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const dummyGroups: Group[] = [];
  const noopSetGroups = (_groups: Group[]) => {};

  return (
    <GroupedListDetailScreen<IncomeItem>
      title="Net Income"
      totalText={totalText}
      subtextMain="Monthly take-home income after deductions"
      subtextFootnote={undefined}
      editorPlacement="top"
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
    />
  );
}


