import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Group } from '../types';
import GroupedListDetailScreen from './GroupedListDetailScreen';
import { useSnapshot } from '../SnapshotContext';
import { formatPercent } from '../formatters';

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
const ID_HORIZON: string = 'horizonYears';

const ID_INFLATION: string = 'inflationPct';

const ID_MONTHLY_DEBT_REDUCTION: string = 'monthlyDebtReduction';

function formatGBPInt(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}£${Math.abs(Math.round(value)).toLocaleString('en-GB')}`;
}


export default function ProjectionSettingsScreen() {
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
    state.projection.inflationPct,
    state.projection.monthlyDebtReduction,
  ]);

  const setItems = (nextItems: ProjectionFieldItem[]) => {
    const byId = new Map(nextItems.map(it => [it.id, it.value] as const));

    setProjection({
      currentAge: byId.get(ID_CURRENT_AGE) ?? state.projection.currentAge,
      endAge: byId.get(ID_END_AGE) ?? state.projection.endAge,
      inflationPct: byId.get(ID_INFLATION) ?? state.projection.inflationPct,
      monthlyDebtReduction: byId.get(ID_MONTHLY_DEBT_REDUCTION) ?? state.projection.monthlyDebtReduction,
    });
  };

  const isLocked = (item: ProjectionFieldItem): boolean => {
    return item.id === ID_HORIZON;
  };

  const formatItemAmountText = (item: ProjectionFieldItem, value: number): string => {
    if (item.id === ID_HORIZON) return `${horizonYears} years`;

    if (item.id === ID_CURRENT_AGE || item.id === ID_END_AGE) {
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

    // Ages: integers only + End age > Current age
    if (itemId === ID_CURRENT_AGE || itemId === ID_END_AGE) {
      if (!Number.isInteger(amount)) return 'Please enter a whole number age.';
      const nextCurrent = itemId === ID_CURRENT_AGE ? amount : state.projection.currentAge;
      const nextEnd = itemId === ID_END_AGE ? amount : state.projection.endAge;
      if (nextEnd <= nextCurrent) return 'End age must be greater than current age.';
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

  return (
    <GroupedListDetailScreen<ProjectionFieldItem>
      title="Projection settings"
      totalText=""
      subtextMain="Adjust the assumptions behind the projection."
      educationLines={[
        'Projections extend today’s position forward using a few simple assumptions.',
        'They are directional, not precise.',
      ]}
      insightText="If nothing else changes, this can help you explore where your finances could land by a future age."
      hintExamples={undefined}
      headerRightAccessory={
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.doneButton, { opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneButtonText}>Done</Text>
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
    />
  );
}

const styles = StyleSheet.create({
  doneButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
});



