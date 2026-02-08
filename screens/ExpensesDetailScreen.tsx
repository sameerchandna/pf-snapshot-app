import React, { useMemo } from 'react';
import { useSnapshot } from '../SnapshotContext';
import { ExpenseItem, Group } from '../types';
import { selectSnapshotExpenses } from '../selectors';
import { formatCurrencyFullSigned } from '../formatters';
import { parseItemName, parseMoney } from '../domainValidation';
import EducationBox from '../components/EducationBox';
import EditableCollectionScreen, { HelpContent } from './EditableCollectionScreen';

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

const expensesHelpContent: HelpContent = {
  title: 'Expenses',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Expenses are ongoing monthly cash outflows.',
        'They reduce how much money is available to grow assets or reduce liabilities.',
        'Expenses are recorded in Snapshot and carried unchanged into Projection.',
      ],
    },
    {
      heading: 'What are Expenses?',
      paragraphs: [
        'Expenses are money you spend that does not come back.',
        'They include recurring costs such as:',
      ],
      bullets: [
        'housing and property costs',
        'transport and insurance',
        'subscriptions and lifestyle spending',
      ],
      paragraphsAfter: [
        'Whether discretionary or essential, all expenses permanently leave your system.',
      ],
    },
    {
      heading: 'Expenses and interest',
      paragraphs: [
        'Interest paid on loans is also treated as an expense.',
        'This is because interest:',
      ],
      bullets: [
        'leaves your system permanently',
        'does not build assets',
        'does not reduce the original debt balance',
      ],
      paragraphsAfter: [
        'For this reason, loan interest appears alongside other expenses.',
      ],
    },
    {
      heading: 'Why Expenses matter',
      paragraphs: [
        'Expenses directly shape your financial trajectory.',
        'They determine:',
      ],
      bullets: [
        'how much cash is available each month',
        'how quickly assets can grow',
        'how quickly liabilities can fall',
      ],
      paragraphsAfter: [
        'Small differences in monthly expenses can lead to large differences over time when projected forward.',
      ],
    },
    {
      heading: 'How to use this screen',
      paragraphs: [
        'Enter all recurring expenses you want reflected in your finances.',
        'Amounts should be entered as monthly values.',
        'If you pay something annually or irregularly, convert it to a monthly amount.',
      ],
      example: {
        text: 'Council Tax of £2,400 per year → enter ',
        boldValue: '£200 per month',
      },
      paragraphsAfter: [
        'You can group expenses in any way that helps you understand where money is going (for example: Property, Transport, Lifestyle).',
      ],
    },
    {
      heading: 'What this screen does not do',
      paragraphs: [
        'This screen:',
      ],
      bullets: [
        'does not judge expenses as good or bad',
        'does not suggest reductions or optimisations',
        'does not assume expenses will change over time',
      ],
      paragraphsAfter: [
        'It is observational, not advisory.',
      ],
    },
    {
      heading: 'Common surprises',
      bullets: [
        'Reducing expenses often has a larger long-term impact than increasing investment returns',
        'Loan interest can be one of the largest hidden expenses',
        'Annual costs matter more once averaged monthly',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'In Projection, expenses are assumed to continue each month unless changed.',
        'Lower expenses increase available cash every month, which compounds over time through:',
      ],
      bullets: [
        'higher asset contributions',
        'faster debt reduction',
        'greater cash accumulation',
      ],
    },
  ],
};

export default function ExpensesDetailScreen() {
  const { state, setExpenses, setExpenseGroups } = useSnapshot();

  const totalExpensesValue: number = useMemo(() => {
    return selectSnapshotExpenses(state);
  }, [state.expenses]);

  const totalExpensesText: string = useMemo(() => {
    return formatCurrencyFullSigned(-totalExpensesValue);
  }, [totalExpensesValue]);

  const maxValue: number = 1_000_000_000;
  const implicitGroupId: string = 'general';

  const isItemLocked = (item: ExpenseItem): boolean => {
    return item.id.startsWith('loan-interest:') || item.id.startsWith('loan-principal:');
  };

  const getItemId = (item: ExpenseItem): string => item.id;
  const getItemName = (item: ExpenseItem): string => item.name;
  const getItemAmount = (item: ExpenseItem): number => item.monthlyAmount;
  const getItemGroupId = (item: ExpenseItem): string => item.groupId;
  const getItemIsActive = (item: ExpenseItem): boolean => item.isActive !== false;
  const setItemIsActive = (item: ExpenseItem, isActive: boolean): ExpenseItem => ({ ...item, isActive });

  // Port validation logic verbatim from original validateAndParse
  const validateEditedItem = (ctx: { itemId: string | null; name: string; amount: number }): string | null => {
    const name = parseItemName(ctx.name);
    if (!name) return 'Name is required.';

    const parsed = parseMoney(String(ctx.amount));
    if (parsed === null) {
      return 'Please enter a valid number for the amount.';
    }

    if (parsed > maxValue) {
      return `That value is too large. Max allowed is ${maxValue.toLocaleString('en-GB')}.`;
    }

    return null;
  };

  return (
    <EditableCollectionScreen<ExpenseItem>
      title="Expenses"
      totalText={totalExpensesText}
      subtextMain="Grouped monthly expenses"
      subtextFootnote="If a bill isn't monthly, estimate its monthly equivalent."
      helpContent={expensesHelpContent}
      renderIntro={
        <EducationBox lines={['Only active items are used in your Snapshot and projections. Inactive items are kept for reference.']} />
      }
      groups={state.expenseGroups}
      setGroups={setExpenseGroups}
      items={state.expenses}
      setItems={setExpenses}
      getItemId={getItemId}
      getItemName={getItemName}
      getItemAmount={getItemAmount}
      getItemGroupId={getItemGroupId}
      makeNewItem={(groupId, name, amount) => ({
        id: createId('expense'),
        name,
        monthlyAmount: amount,
        groupId,
        isActive: true,
      })}
      updateItem={(item, name, amount) => ({
        ...item,
        name,
        monthlyAmount: amount,
      })}
      formatAmountText={(amount) => formatCurrencyFullSigned(-amount)}
      formatGroupTotalText={(total) => formatCurrencyFullSigned(-total)}
      createNewGroup={() => ({ id: createId('group'), name: 'New Group' })}
      autoExpandSingleGroup={true}
      emptyStateText="No expenses yet."
      allowGroups={false}
      editorPlacement="top"
      allowAddItems={true}
      allowDeleteItems={true}
      allowEditItemName={true}
      allowEditGroups={true}
      allowAddGroups={true}
      groupsCollapsible={true}
      isItemLocked={isItemLocked}
      getItemIsActive={getItemIsActive}
      setItemIsActive={setItemIsActive}
      validateEditedItem={validateEditedItem}
      swipeRevealMode="overlay"
    />
  );
}
