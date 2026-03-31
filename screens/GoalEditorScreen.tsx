/**
 * Phase 10.7: Goal Editor Screen
 *
 * Allows editing the active profile's goals.
 * Accessible from the Goals section "Edit" button on the Projection screen.
 *
 * Each goal has a type, a target amount (£), and an optional target age.
 * "Reset to defaults" clears the stored goals so that computed defaults take over.
 */

import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash } from 'phosphor-react-native';

import ScreenHeader from '../components/ScreenHeader';
import SectionCard from '../components/SectionCard';
import GroupHeader from '../components/GroupHeader';
import Divider from '../components/Divider';
import Button from '../components/Button';
import { useSnapshot } from '../context/SnapshotContext';
import { selectExpenses } from '../engines/selectors';
import { formatCurrencyFull } from '../ui/formatters';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { useTheme } from '../ui/theme/useTheme';
import { radius, typography } from '../ui/theme/theme';
import type { GoalConfig } from '../types';

// ─── Goal type labels ─────────────────────────────────────────────────────────

const GOAL_TYPE_LABELS: Record<GoalConfig['type'], string> = {
  fi: 'Financial Independence',
  netWorthMilestone: 'Net Worth Target',
  retirementIncome: 'Retirement Income',
};

const GOAL_TYPE_HINTS: Record<GoalConfig['type'], string> = {
  fi: 'Target net worth needed to cover expenses without working (expenses × 25).',
  netWorthMilestone: 'Reach a specific net worth target, optionally by a given age.',
  retirementIncome: 'Have enough invested to generate a target annual income in retirement.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDefaultGoals(monthlyExpenses: number): GoalConfig[] {
  return [
    { type: 'fi', target: Math.round(monthlyExpenses * 12 * 25) },
    { type: 'retirementIncome', target: Math.round(monthlyExpenses * 12), targetAge: 67 },
  ];
}

function goalLabel(goal: GoalConfig): string {
  return GOAL_TYPE_LABELS[goal.type];
}

function targetAgeOf(goal: GoalConfig): number | undefined {
  if (goal.type === 'netWorthMilestone' || goal.type === 'retirementIncome') {
    return goal.targetAge;
  }
  return undefined;
}

// ─── Editable goal row ────────────────────────────────────────────────────────

interface GoalRowProps {
  goal: GoalConfig;
  index: number;
  onChangeTarget: (index: number, value: string) => void;
  onChangeTargetAge: (index: number, value: string) => void;
  onDelete: (index: number) => void;
  isLast: boolean;
}

function GoalRow({ goal, index, onChangeTarget, onChangeTargetAge, onDelete, isLast }: GoalRowProps) {
  const { theme } = useTheme();
  const hasTargetAge = goal.type === 'netWorthMilestone' || goal.type === 'retirementIncome';
  const targetAge = targetAgeOf(goal);

  return (
    <View>
      <View style={styles.goalRow}>
        {/* Goal type label */}
        <View style={styles.goalRowHeader}>
          <Text style={[styles.goalTypeLabel, { color: theme.colors.text.primary }]}>
            {goalLabel(goal)}
          </Text>
          <Pressable
            onPress={() => onDelete(index)}
            hitSlop={8}
            style={styles.deleteButton}
          >
            <Trash size={18} color={theme.colors.semantic.warning} />
          </Pressable>
        </View>

        <Text style={[styles.goalHint, { color: theme.colors.text.muted }]}>
          {GOAL_TYPE_HINTS[goal.type]}
        </Text>

        {/* Target amount input */}
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>
            Target (£)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.bg.subtle,
                borderColor: theme.colors.border.default,
                borderRadius: radius.base,
              },
            ]}
            value={String(goal.target)}
            onChangeText={v => onChangeTarget(index, v)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={theme.colors.text.muted}
            returnKeyType="done"
          />
        </View>

        {/* Optional target age input */}
        {hasTargetAge ? (
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>
              By age (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.bg.subtle,
                  borderColor: theme.colors.border.default,
                  borderRadius: radius.base,
                },
              ]}
              value={targetAge != null ? String(targetAge) : ''}
              onChangeText={v => onChangeTargetAge(index, v)}
              keyboardType="numeric"
              placeholder="e.g. 67"
              placeholderTextColor={theme.colors.text.muted}
              returnKeyType="done"
            />
          </View>
        ) : null}
      </View>
      {!isLast && <Divider />}
    </View>
  );
}

// ─── Add goal sheet ───────────────────────────────────────────────────────────

const ADDABLE_TYPES: GoalConfig['type'][] = ['fi', 'netWorthMilestone', 'retirementIncome'];

interface AddGoalPickerProps {
  onSelect: (type: GoalConfig['type']) => void;
  onCancel: () => void;
  existingTypes: Set<GoalConfig['type']>;
}

function AddGoalPicker({ onSelect, onCancel, existingTypes }: AddGoalPickerProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.pickerContainer,
        {
          backgroundColor: theme.colors.bg.card,
          borderColor: theme.colors.border.default,
          borderRadius: radius.card,
        },
      ]}
    >
      {ADDABLE_TYPES.map((type, index) => {
        const alreadyAdded = existingTypes.has(type);
        return (
          <View key={type}>
            {index > 0 && <Divider />}
            <Pressable
              onPress={() => !alreadyAdded && onSelect(type)}
              style={[
                styles.pickerRow,
                alreadyAdded && styles.pickerRowDisabled,
              ]}
            >
              <Text
                style={[
                  styles.pickerLabel,
                  { color: alreadyAdded ? theme.colors.text.muted : theme.colors.text.primary },
                ]}
              >
                {GOAL_TYPE_LABELS[type]}
              </Text>
              {alreadyAdded && (
                <Text style={[styles.pickerAdded, { color: theme.colors.text.muted }]}>
                  Added
                </Text>
              )}
            </Pressable>
          </View>
        );
      })}
      <Divider />
      <Pressable onPress={onCancel} style={styles.pickerRow}>
        <Text style={[styles.pickerCancel, { color: theme.colors.semantic.warning }]}>
          Cancel
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GoalEditorScreen() {
  const navigation = useNavigation<any>();
  const { state, profilesState, setGoals } = useSnapshot();
  const { theme } = useTheme();

  const monthlyExpenses = selectExpenses(state);
  const defaultGoals = computeDefaultGoals(monthlyExpenses);

  // Load current stored goals (or fall back to defaults for editing)
  const storedGoals: GoalConfig[] =
    profilesState?.profiles[profilesState.activeProfileId]?.goalState?.goals ?? [];

  const initialGoals: GoalConfig[] =
    storedGoals.length > 0 ? storedGoals : defaultGoals;

  const [goals, setLocalGoals] = useState<GoalConfig[]>(initialGoals);
  const [showAddPicker, setShowAddPicker] = useState(false);

  // ─── Mutators ───────────────────────────────────────────────────────────────

  const handleChangeTarget = (index: number, value: string) => {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
    const target = isNaN(parsed) ? 0 : parsed;
    setLocalGoals(prev => {
      const next = [...prev];
      const goal = next[index];
      if (!goal) return prev;
      next[index] = { ...goal, target } as GoalConfig;
      return next;
    });
  };

  const handleChangeTargetAge = (index: number, value: string) => {
    const trimmed = value.trim();
    const parsed = trimmed === '' ? undefined : parseInt(trimmed, 10);
    const targetAge = parsed != null && !isNaN(parsed) ? parsed : undefined;
    setLocalGoals(prev => {
      const next = [...prev];
      const goal = next[index];
      if (!goal) return prev;
      if (goal.type === 'netWorthMilestone' || goal.type === 'retirementIncome') {
        next[index] = { ...goal, targetAge } as GoalConfig;
      }
      return next;
    });
  };

  const handleDelete = (index: number) => {
    setLocalGoals(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddGoalType = (type: GoalConfig['type']) => {
    setShowAddPicker(false);
    let newGoal: GoalConfig;
    if (type === 'fi') {
      newGoal = { type: 'fi', target: Math.round(monthlyExpenses * 12 * 25) };
    } else if (type === 'netWorthMilestone') {
      newGoal = { type: 'netWorthMilestone', target: 500_000 };
    } else {
      newGoal = { type: 'retirementIncome', target: Math.round(monthlyExpenses * 12), targetAge: 67 };
    }
    setLocalGoals(prev => [...prev, newGoal]);
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset to defaults',
      'This will restore the default FI and retirement income goals based on your current expenses.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => setLocalGoals(defaultGoals),
        },
      ],
    );
  };

  const handleSave = () => {
    setGoals(goals);
    navigation.goBack();
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const existingTypes = new Set(goals.map(g => g.type));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg.screen }]} edges={['top']}>
      <ScreenHeader
        title="Edit Goals"
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Current goals */}
        {goals.length > 0 ? (
          <SectionCard style={styles.card}>
            <GroupHeader title="Your goals" />
            {goals.map((goal, index) => (
              <GoalRow
                key={`${goal.type}-${index}`}
                goal={goal}
                index={index}
                onChangeTarget={handleChangeTarget}
                onChangeTargetAge={handleChangeTargetAge}
                onDelete={handleDelete}
                isLast={index === goals.length - 1}
              />
            ))}
          </SectionCard>
        ) : (
          <SectionCard style={styles.card}>
            <Text style={[styles.emptyText, { color: theme.colors.text.muted }]}>
              No goals set. Add a goal below, or reset to defaults.
            </Text>
          </SectionCard>
        )}

        {/* Add goal / reset */}
        <View style={styles.addRow}>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => setShowAddPicker(v => !v)}
          >Add goal</Button>
          <Button
            variant="secondary"
            size="sm"
            onPress={handleResetToDefaults}
          >Reset to defaults</Button>
        </View>

        {/* Inline type picker */}
        {showAddPicker ? (
          <AddGoalPicker
            onSelect={handleAddGoalType}
            onCancel={() => setShowAddPicker(false)}
            existingTypes={existingTypes}
          />
        ) : null}

        {/* Default goals explanation */}
        <SectionCard style={styles.card}>
          <GroupHeader title="About defaults" />
          <Text style={[styles.hintText, { color: theme.colors.text.secondary }]}>
            Default goals are based on your current monthly expenses ({formatCurrencyFull(monthlyExpenses)}/mo):
          </Text>
          <Text style={[styles.hintBullet, { color: theme.colors.text.secondary }]}>
            • FI target: {formatCurrencyFull(Math.round(monthlyExpenses * 12 * 25))} (expenses × 300)
          </Text>
          <Text style={[styles.hintBullet, { color: theme.colors.text.secondary }]}>
            • Retirement income: {formatCurrencyFull(Math.round(monthlyExpenses * 12))}/yr at age 67
          </Text>
          <Text style={[styles.hintNote, { color: theme.colors.text.muted }]}>
            Storing no goals reverts to these defaults automatically.
          </Text>
        </SectionCard>
      </ScrollView>

      {/* Save */}
      <View style={[styles.footer, { borderTopColor: theme.colors.border.default }]}>
        <Button variant="primary" size="md" onPress={handleSave}>Save</Button>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.sectionGap,
    paddingBottom: spacing.huge,
    gap: spacing.base,
  },
  card: {
    marginBottom: spacing.xs,
  },
  goalRow: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  goalRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalTypeLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  deleteButton: {
    padding: spacing.tiny,
  },
  goalHint: {
    ...typography.caption,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.bodySmall,
    flex: 1,
  },
  input: {
    ...typography.body,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    minWidth: 100,
    textAlign: 'right',
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  pickerContainer: {
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  pickerRowDisabled: {
    opacity: 0.5,
  },
  pickerLabel: {
    ...typography.body,
  },
  pickerAdded: {
    ...typography.caption,
  },
  pickerCancel: {
    ...typography.body,
  },
  emptyText: {
    ...typography.body,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  hintText: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  hintBullet: {
    ...typography.bodySmall,
    marginBottom: spacing.tiny,
  },
  hintNote: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
