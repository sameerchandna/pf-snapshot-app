/**
 * Phase 10.4: Goals Section
 *
 * Displays goal assessments below the interpretation card.
 * Each goal shows on-track / off-track / achieved status.
 * Tapping "Edit" navigates to the goal editing screen.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import SectionCard from './SectionCard';
import SectionHeader from './SectionHeader';
import Divider from './Divider';
import { formatCurrencyCompact } from '../ui/formatters';
import { typography, radius } from '../ui/theme/theme';
import type { GoalAssessment } from '../insights/interpretProjection';

interface GoalsSectionProps {
  goals: GoalAssessment[];
  onEditPress?: () => void;
  style?: object;
}

function statusColor(status: GoalAssessment['status'], theme: any): string {
  switch (status) {
    case 'achieved':  return theme.colors.brand.primary;
    case 'on_track':  return theme.colors.semantic.success;
    case 'off_track': return theme.colors.semantic.warning;
  }
}

function statusText(goal: GoalAssessment): string {
  if (goal.status === 'achieved') {
    return goal.achievedAge !== null ? `Achieved at age ${Math.round(goal.achievedAge)}` : 'Achieved';
  }
  if (goal.status === 'on_track') {
    return goal.achievedAge !== null ? `On track — age ${Math.round(goal.achievedAge)}` : 'On track';
  }
  // off_track
  if (goal.gap !== null && goal.targetAge !== null) {
    return `Off track — ${formatCurrencyCompact(goal.gap)} gap at ${goal.targetAge}`;
  }
  if (goal.gap !== null) {
    return `Off track — ${formatCurrencyCompact(goal.gap)} gap`;
  }
  return 'Off track';
}

export default function GoalsSection({ goals, onEditPress, style }: GoalsSectionProps) {
  const { theme } = useTheme();

  if (goals.length === 0) return null;

  return (
    <SectionCard style={[styles.card, style]}>
      {/* Header row with Edit affordance */}
      <View style={styles.headerRow}>
        <SectionHeader title="Goals" />
        {onEditPress ? (
          <Pressable onPress={onEditPress} hitSlop={8}>
            <Text style={[styles.editText, { color: theme.colors.brand.primary }]}>
              Edit
            </Text>
          </Pressable>
        ) : null}
      </View>

      {goals.map((goal, index) => (
        <View key={`${goal.goalType}-${index}`}>
          {index > 0 && <Divider />}
          <View style={styles.goalRow}>
            {/* Status dot */}
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: statusColor(goal.status, theme),
                  borderRadius: radius.pill,
                },
              ]}
            />
            {/* Label + status text */}
            <View style={styles.goalContent}>
              <Text style={[styles.goalLabel, { color: theme.colors.text.primary }]}>
                {goal.label}
              </Text>
              <Text
                style={[
                  styles.statusText,
                  { color: statusColor(goal.status, theme) },
                ]}
              >
                {statusText(goal)}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  card: {
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editText: {
    ...typography.label,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    marginTop: 4, // Align with first line of text
  },
  goalContent: {
    flex: 1,
    gap: spacing.tiny,
  },
  goalLabel: {
    ...typography.body,
  },
  statusText: {
    ...typography.bodySmall,
  },
});
