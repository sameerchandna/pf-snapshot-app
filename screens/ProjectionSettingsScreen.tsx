import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Group } from '../types';
import EditableCollectionScreen from './EditableCollectionScreen';
import { useSnapshot } from '../context/SnapshotContext';
import { formatPercent, formatCurrencyFull } from '../ui/formatters';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { spacing } from '../ui/spacing';
import { typography } from '../ui/theme/theme';
import { Swipeable } from 'react-native-gesture-handler';
import CollectionRowWithActions from '../components/rows/CollectionRowWithActions';
import SketchCard from '../components/SketchCard';
import Divider from '../components/Divider';
import SketchCircle from '../components/SketchCircle';

type ProjectionFieldItem = {
  id: string;
  name: string;
  groupId: string;
  value: number;
};

const GROUP_TIME: string = 'projection-time';
const GROUP_ASSUMPTIONS: string = 'projection-assumptions';
const GROUP_CONTRIBUTIONS: string = 'projection-contributions';

const ID_CURRENT_AGE: string = 'currentAge';
const ID_END_AGE: string = 'endAge';
const ID_RETIREMENT_AGE: string = 'retirementAge';
const ID_HORIZON: string = 'horizonYears';

const ID_INFLATION: string = 'inflationPct';

const ID_MONTHLY_DEBT_REDUCTION: string = 'monthlyDebtReduction';

function formatGBPInt(value: number): string {
  return formatCurrencyFull(Math.round(value));
}


export default function ProjectionSettingsScreen() {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const navigation = useNavigation<any>();
  const { state, setProjection } = useSnapshot();

  const groups: Group[] = useMemo(
    () => [
      { id: GROUP_TIME, name: 'Time Horizon' },
      { id: GROUP_ASSUMPTIONS, name: 'Assumptions' },
      { id: GROUP_CONTRIBUTIONS, name: 'Contributions' },
    ],
    [],
  );

  const horizonYears: number = Math.max(0, Math.round(state.projection.endAge - state.projection.currentAge));

  const items: ProjectionFieldItem[] = useMemo(() => {
    return [
      // Time Horizon
      { id: ID_CURRENT_AGE, name: 'Current age', groupId: GROUP_TIME, value: state.projection.currentAge },
      { id: ID_END_AGE, name: 'End age', groupId: GROUP_TIME, value: state.projection.endAge },
      { id: ID_RETIREMENT_AGE, name: 'Retirement age', groupId: GROUP_TIME, value: state.projection.retirementAge },
      { id: ID_HORIZON, name: 'Horizon', groupId: GROUP_TIME, value: horizonYears },

      // Assumptions
      { id: ID_INFLATION, name: 'Inflation', groupId: GROUP_ASSUMPTIONS, value: state.projection.inflationPct },

      // Contributions
      { id: ID_MONTHLY_DEBT_REDUCTION, name: 'Monthly debt reduction', groupId: GROUP_CONTRIBUTIONS, value: state.projection.monthlyDebtReduction },
    ];
  }, [
    horizonYears,
    state.projection.currentAge,
    state.projection.endAge,
    state.projection.retirementAge,
    state.projection.inflationPct,
    state.projection.monthlyDebtReduction,
  ]);

  const setItems = (nextItems: ProjectionFieldItem[]) => {
    const byId = new Map(nextItems.map(it => [it.id, it.value] as const));

    setProjection({
      currentAge: byId.get(ID_CURRENT_AGE) ?? state.projection.currentAge,
      endAge: byId.get(ID_END_AGE) ?? state.projection.endAge,
      retirementAge: byId.get(ID_RETIREMENT_AGE) ?? state.projection.retirementAge,
      inflationPct: byId.get(ID_INFLATION) ?? state.projection.inflationPct,
      monthlyDebtReduction: byId.get(ID_MONTHLY_DEBT_REDUCTION) ?? state.projection.monthlyDebtReduction,
    });
  };

  const isLocked = (item: ProjectionFieldItem): boolean => {
    return item.id === ID_HORIZON;
  };

  const formatItemAmountText = (item: ProjectionFieldItem, value: number): string => {
    if (item.id === ID_HORIZON) return `${horizonYears} years`;

    if (item.id === ID_CURRENT_AGE || item.id === ID_END_AGE || item.id === ID_RETIREMENT_AGE) {
      return `${Math.round(value)}`;
    }

    if (item.id === ID_MONTHLY_DEBT_REDUCTION) {
      return formatGBPInt(value);
    }

    // Rates
    return formatPercent(value);
  };

  const validateEditedItem = ({ itemId, amount }: { itemId: string | null; name: string; amount: number }): string | null => {
    if (!itemId) return null;

    // Ages: integers only + End age > Current age, Retirement age between current and end
    if (itemId === ID_CURRENT_AGE || itemId === ID_END_AGE || itemId === ID_RETIREMENT_AGE) {
      if (!Number.isInteger(amount)) return 'Please enter a whole number age.';
      const nextCurrent = itemId === ID_CURRENT_AGE ? amount : state.projection.currentAge;
      const nextEnd = itemId === ID_END_AGE ? amount : state.projection.endAge;
      const nextRetirement = itemId === ID_RETIREMENT_AGE ? amount : state.projection.retirementAge;
      if (nextEnd <= nextCurrent) return 'End age must be greater than current age.';
      if (nextRetirement <= nextCurrent) return 'Retirement age must be greater than current age.';
      if (nextRetirement >= nextEnd) return 'Retirement age must be less than end age.';
      return null;
    }

    // Currency (monthly): integers only
    if (itemId === ID_MONTHLY_DEBT_REDUCTION) {
      if (!Number.isInteger(amount)) return 'Please enter a whole number.';
      return null;
    }

    // Rates: decimals allowed (stored as percent values)
    return null;
  };

  // Custom row renderer for v2 row architecture
  // This override bypasses FinancialItemRow and uses EditableCollectionScreen's swipe coordination.
  // Uses CollectionRowWithActions → SemanticRow → SwipeRowContainer → RowVisual stack.
  const renderProjectionSettingsRow = (
    item: ProjectionFieldItem,
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
      const CIRCLE_SIZE = 30;
      return (
        <>
        <View
          key={item.id}
          style={inlineStyles.container}
        >
          {state.inline.errorMessage.length > 0 ? (
            <View
              style={[
                inlineStyles.errorBanner,
                {
                  backgroundColor: theme.colors.semantic.errorBg,
                  borderColor: theme.colors.semantic.errorBorder,
                  borderRadius: theme.radius.small,
                },
              ]}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.semantic.errorText }]}>
                {state.inline.errorMessage}
              </Text>
            </View>
          ) : null}
          <View style={inlineStyles.inputRow}>
            <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]} numberOfLines={1}>
              {state.name}
            </Text>
            <SketchCard
              borderColor={palette.accent}
              fillColor={theme.colors.bg.input}
              borderRadius={theme.radius.base}
              style={inlineStyles.amountInputWrapper}
            >
              <TextInput
                style={[theme.typography.body, inlineStyles.inputInner, { color: theme.colors.text.primary, textAlign: 'right' }]}
                value={state.inline.draftAmount}
                onChangeText={state.inline.onDraftAmountChange}
                placeholder="0"
                placeholderTextColor={theme.colors.text.disabled}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={state.inline.onSave}
                autoFocus
              />
            </SketchCard>
            <Pressable
              onPress={state.inline.onSave}
              style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
              accessibilityLabel="Save"
            >
              <SketchCircle size={CIRCLE_SIZE} fillColor={palette.sectionHeaderBg} borderColor={palette.accent}>
                <Text style={[theme.typography.button, { color: palette.accent }]}>✓</Text>
              </SketchCircle>
            </Pressable>
            <Pressable
              onPress={state.inline.onCancel}
              style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
              accessibilityLabel="Cancel"
            >
              <SketchCircle size={CIRCLE_SIZE} fillColor={theme.colors.bg.subtle} borderColor={palette.accent}>
                <Text style={[theme.typography.button, { color: palette.accent }]}>✕</Text>
              </SketchCircle>
            </Pressable>
          </View>
        </View>
        {!isLastInGroup && <Divider variant="subtle" />}
        </>
      );
    }

    // Compute disableDelete using exact legacy conditions from EditableCollectionScreen line 772:
    // deleteDisabled = locked || !canDeleteItems || (groupsEnabled && canCollapseGroups && groupId && !isExpanded(groupId))
    // For ProjectionSettingsScreen:
    // - allowGroups={true}, so groupsEnabled = true
    // - allowDeleteItems={false}, so canDeleteItems = false
    // - groupsCollapsible={false}, so canCollapseGroups = false
    // - Therefore: disableDelete = locked || true || false = true (always disabled)
    const disableDelete = true;

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
    <EditableCollectionScreen<ProjectionFieldItem>
      title="Projection settings"
      totalText=""
      subtextMain="Adjust the assumptions behind the projection."
      educationLines={[
        'Projections extend today\'s position forward using a few simple assumptions.',
        'They are directional, not precise.',
      ]}
      insightText="If nothing else changes, this can help you explore where your finances could land by a future age."
      hintExamples={undefined}
      headerRightAccessory={
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.doneButton, { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' }]}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={[styles.doneButtonText, { color: theme.colors.text.primary }]}>Done</Text>
        </Pressable>
      }
      groups={groups}
      setGroups={() => {}}
      items={items}
      setItems={setItems}
      getItemId={it => it.id}
      getItemName={it => it.name}
      getItemAmount={it => it.value}
      getItemGroupId={it => it.groupId}
      makeNewItem={() => {
        // Not used (add disabled).
        return { id: 'noop', name: 'noop', groupId: GROUP_TIME, value: 0 };
      }}
      updateItem={(item, _name, amount) => ({ ...item, value: amount })}
      formatAmountText={amount => amount.toString()}
      formatItemAmountText={formatItemAmountText}
      formatGroupTotalText={() => ''}
      createNewGroup={() => ({ id: 'noop', name: 'noop' })}
      autoExpandSingleGroup={false}
      emptyStateText=""
      allowGroups={true}
      // Fixed-field mode toggles
      allowAddItems={false}
      allowDeleteItems={false}
      allowEditItemName={false}
      allowEditGroups={false}
      allowAddGroups={false}
      groupsCollapsible={false}
      isItemLocked={isLocked}
      validateEditedItem={validateEditedItem}
      inlineEditorMode={true}
      renderRow={renderProjectionSettingsRow}
    />
  );
}

const styles = StyleSheet.create({
  doneButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  doneButtonText: {
    ...typography.button,
  },
});

const inlineStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  errorBanner: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    gap: spacing.sm,
  },
  amountInputWrapper: {
    width: 90,
    height: 36,
  },
  inputInner: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.sm,
  },
});



