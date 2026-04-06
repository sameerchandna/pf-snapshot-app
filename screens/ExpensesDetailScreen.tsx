import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSnapshot } from '../context/SnapshotContext';
import { ExpenseItem, Group } from '../types';
import { selectSnapshotExpenses, selectLoanDerivedRows } from '../engines/selectors';
import { formatCurrencyFull, formatCurrencyFullSigned } from '../ui/formatters';
import { parseItemName, parseMoney } from '../domain/domainValidation';
import EditableCollectionScreen, { HelpContent } from './EditableCollectionScreen';
import SemanticRow from '../components/rows/SemanticRow';
import RowVisual from '../components/rows/RowVisual';
import ItemActiveCheckbox from '../components/ItemActiveCheckbox';
import SwipeAction from '../components/SwipeAction';
import InlineRowEditor from '../components/rows/InlineRowEditor';

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

/**
 * ExpensesDetailScreen - v2 prototype screen using Semantic row architecture.
 * 
 * Uses a screen-local semantic row built from SemanticRow primitives.
 * 
 * Behavior differences from legacy (FinancialItemRow):
 * - Replace-mode swipe (no overlay reveal)
 * - No open-row coordination (multiple rows can have swipe actions open)
 * - Swipe reveals Edit + Delete actions (no row press)
 * 
 * All other behavior (editing, validation, groups, Snapshot mutations) remains unchanged.
 */
export default function ExpensesDetailScreen() {
  const { state, setExpenses, setExpenseGroups } = useSnapshot();

  const totalExpensesValue: number = useMemo(() => {
    return selectSnapshotExpenses(state);
  }, [state.expenses]);

  const totalExpensesText: string = useMemo(() => {
    return formatCurrencyFullSigned(-totalExpensesValue);
  }, [totalExpensesValue]);

  // Inject virtual locked expense items for loan-derived P&I rows not yet materialised in state.expenses.
  // Keeps the display list in sync with what selectSnapshotExpenses counts in the total.
  const displayItems: ExpenseItem[] = useMemo(() => {
    const materializedIds = new Set(state.expenses.map(e => e.id));
    const fallbackGroupId = state.expenseGroups[0]?.id ?? 'general';
    const virtual: ExpenseItem[] = [];
    for (const row of selectLoanDerivedRows(state)) {
      const interestId = `loan-interest:${row.liabilityId}`;
      const principalId = `loan-principal:${row.liabilityId}`;
      if (!materializedIds.has(interestId)) {
        virtual.push({ id: interestId, name: `${row.name} – Interest`, monthlyAmount: row.monthlyInterest, groupId: fallbackGroupId });
      }
      if (!materializedIds.has(principalId)) {
        virtual.push({ id: principalId, name: `${row.name} – Principal`, monthlyAmount: row.monthlyPrincipal, groupId: fallbackGroupId });
      }
    }
    return [...virtual, ...state.expenses];
  }, [state.expenses, state.liabilities, state.expenseGroups]);

  const maxValue: number = 1_000_000_000;

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
      return `That value is too large. Max allowed is ${formatCurrencyFull(maxValue)}.`;
    }

    return null;
  };

  // Local component: ExpenseRowWithActions
  // Uses SemanticRow directly to control row interactions:
  // - Tap row opens inline editor (pressEnabled, non-locked rows only)
  // - Swipe reveals Delete action only
  // - Tapping Delete button opens confirmation modal (SwipeAction onPress)
  // - Swipe coordination handled by EditableCollectionScreen
  type ExpenseRowWithActionsProps = {
    item: ExpenseItem;
    itemId: string;
    onEdit: () => void;
    onRequestDelete: () => void;
    onToggleActive?: () => void;
    swipeableRef?: (ref: Swipeable | null) => void;
    onSwipeableWillOpen?: () => void;
    onSwipeableOpen?: () => void;
    onSwipeableClose?: () => void;
    locked: boolean;
    isActive: boolean;
    isInactive: boolean;
    isCurrentlyEditing: boolean;
    dimRow: boolean;
    isLastInGroup: boolean;
    name: string;
    amountText: string;
    metaText: string | null;
  };

  const ExpenseRowWithActions = ({
    item,
    itemId,
    onEdit,
    onRequestDelete,
    onToggleActive,
    swipeableRef,
    onSwipeableWillOpen,
    onSwipeableOpen,
    onSwipeableClose,
    locked,
    isActive,
    isInactive,
    isCurrentlyEditing,
    dimRow,
    isLastInGroup,
    name,
    amountText,
    metaText,
  }: ExpenseRowWithActionsProps) => {
    // Track swipe state for visual feedback
    const [isSwiping, setIsSwiping] = useState(false);

    // Handle swipe will open: set visual state and call coordination callback
    const handleSwipeableWillOpen = () => {
      setIsSwiping(true);
      onSwipeableWillOpen?.();
    };

    // Handle swipe close: clear visual state and call coordination callback
    const handleSwipeableClose = () => {
      setIsSwiping(false);
      onSwipeableClose?.();
    };

    // Swipe action: Delete only (edit is via tap)
    const rightActions = (
      <View style={{ flexDirection: 'row' }}>
        <SwipeAction
          variant="delete"
          onPress={onRequestDelete}
          accessibilityLabel="Delete"
        />
      </View>
    );

    return (
      <SemanticRow
        onRevealRight={() => {}}
        swipeableRef={swipeableRef}
        onSwipeableWillOpen={handleSwipeableWillOpen}
        onSwipeableOpen={onSwipeableOpen}
        onSwipeableClose={handleSwipeableClose}
        rightActions={rightActions}
        swipeEnabled={!isCurrentlyEditing}
        pressEnabled={!locked}
        onPress={onEdit}
      >
        <RowVisual
          title={name}
          subtitle={metaText}
          trailingText={amountText}
          leading={
            onToggleActive ? (
              <ItemActiveCheckbox
                isActive={isActive}
                onToggle={onToggleActive}
                disabled={locked}
              />
            ) : undefined
          }
          locked={locked}
          inactive={isInactive}
          dimmed={dimRow}
          swipeActive={isSwiping}
          isLastInGroup={isLastInGroup}
        />
      </SemanticRow>
    );
  };

  // Custom row renderer for v2 row architecture
  // This override bypasses FinancialItemRow and uses EditableCollectionScreen's swipe coordination.
  // Uses ExpenseRowWithActions → SemanticRow → SwipeRowContainer → RowVisual stack.
  const renderExpenseRow = (
    item: ExpenseItem,
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
          key={getItemId(item)}
          isLastInGroup={isLastInGroup}
          draftName={state.inline.draftName}
          draftAmount={state.inline.draftAmount}
          errorMessage={state.inline.errorMessage}
          onDraftNameChange={state.inline.onDraftNameChange}
          onDraftAmountChange={state.inline.onDraftAmountChange}
          onSave={state.inline.onSave}
          onCancel={state.inline.onCancel}
          leadingSlot={
            callbacks.onToggleActive ? (
              <ItemActiveCheckbox
                isActive={state.isActive}
                onToggle={callbacks.onToggleActive}
                disabled={state.locked}
              />
            ) : undefined
          }
        />
      );
    }

    return (
      <ExpenseRowWithActions
        key={getItemId(item)}
        item={item}
        itemId={getItemId(item)}
        onEdit={callbacks.onEdit}
        onRequestDelete={callbacks.onDelete}
        onToggleActive={callbacks.onToggleActive}
        swipeableRef={callbacks.swipeableRef}
        onSwipeableWillOpen={callbacks.onSwipeableWillOpen}
        onSwipeableOpen={callbacks.onSwipeableOpen}
        onSwipeableClose={callbacks.onSwipeableClose}
        locked={state.locked}
        isActive={state.isActive}
        isInactive={state.isInactive}
        isCurrentlyEditing={state.isCurrentlyEditing}
        dimRow={state.dimRow}
        isLastInGroup={isLastInGroup}
        name={state.name}
        amountText={state.amountText}
        metaText={state.metaText}
      />
    );
  };

  return (
    <EditableCollectionScreen<ExpenseItem>
      title="Expenses"
      totalText={totalExpensesText}
      subtextMain="Grouped monthly expenses"
      subtextFootnote="If a bill isn't monthly, estimate its monthly equivalent."
      editorSubtext="Uncheck any item to exclude it from your cash flow and projections — they'll stay here but won't affect your numbers."
      helpContent={expensesHelpContent}
      groups={state.expenseGroups}
      setGroups={setExpenseGroups}
      items={displayItems}
      setItems={(items) => setExpenses(items.filter(e => !e.id.startsWith('loan-interest:') && !e.id.startsWith('loan-principal:')))}
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
      inlineEditorMode={true}
      renderRow={renderExpenseRow} // v2: Custom row renderer using ExpenseRowWithActions with EditableCollectionScreen swipe coordination
    />
  );
}
