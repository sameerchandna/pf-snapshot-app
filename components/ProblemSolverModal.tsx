// ProblemSolverModal — Phase 13 redesign
//
// Modal overlay that shows a detected problem and its back-solved lever
// recommendations. Tapping a lever calls onSelectLever so the parent can
// navigate to the ScenarioExplorer with pre-filled values.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CalendarBlank,
  CaretRight,
  PiggyBank,
  Receipt,
  TrendUp,
  X,
} from 'phosphor-react-native';

import { useTheme } from '../ui/theme/useTheme';
import { formatCurrencyCompact, formatYearsMonths } from '../ui/formatters';
import { spacing } from '../ui/spacing';
import Divider from './Divider';
import { layout } from '../ui/layout';
import { typography, radius } from '../ui/theme/theme';
import type { DetectedProblem } from '../projection/detectProblems';
import type { LeverSolution } from '../projection/backSolve';

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProblemSolverModalProps {
  visible: boolean;
  problem: DetectedProblem | null;
  levers: LeverSolution[];
  onSelectLever: (lever: LeverSolution) => void;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function problemTitle(problem: DetectedProblem): string {
  return problem.kind === 'BRIDGE_GAP' ? 'Bridge Gap' : 'Longevity Gap';
}

function problemDescription(problem: DetectedProblem): string {
  if (problem.kind === 'BRIDGE_GAP') {
    return (
      `Savings run out at ${problem.liquidDepletionAge}, ` +
      `${problem.bridgeAssetName} unlocks at ${problem.lockedUnlockAge} — ` +
      `${formatYearsMonths(problem.gapYears)} gap.`
    );
  }
  return (
    `Portfolio depleted at age ${Math.round(problem.depletionAge)}, plan runs to ${problem.endAge} — ` +
    `${formatYearsMonths(problem.shortfallYears)} shortfall.`
  );
}

function leverIcon(kind: LeverSolution['kind'], color: string) {
  const size = 16;
  switch (kind) {
    case 'CHANGE_RETIREMENT_AGE':
      return <CalendarBlank size={size} color={color} weight="regular" />;
    case 'FLOW_TO_ASSET':
      return <PiggyBank size={size} color={color} weight="regular" />;
    case 'REDUCE_EXPENSES':
      return <Receipt size={size} color={color} weight="regular" />;
    case 'CHANGE_ASSET_GROWTH_RATE':
      return <TrendUp size={size} color={color} weight="regular" />;
  }
}

function formatLeverSummary(lever: LeverSolution): string {
  switch (lever.kind) {
    case 'CHANGE_RETIREMENT_AGE':
      return lever.solvedValue !== null
        ? `Retire at a later age of ${Math.round(lever.solvedValue)}`
        : `Retiring later alone can't close this gap`;
    case 'FLOW_TO_ASSET':
      return lever.solvedValue !== null
        ? `Invest ${formatCurrencyCompact(lever.solvedValue)}/pm more`
        : `Investing more alone can't close this gap`;
    case 'REDUCE_EXPENSES':
      return lever.solvedValue !== null
        ? `Spend ${formatCurrencyCompact(lever.solvedValue)}/pm less`
        : `Spending less alone can't close this gap`;
    case 'CHANGE_ASSET_GROWTH_RATE':
      return lever.solvedValue !== null
        ? `Grow ${lever.assetName} at ${lever.solvedValue.toFixed(1)}%/yr`
        : `Better growth alone can't close this gap`;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProblemSolverModal({
  visible,
  problem,
  levers,
  onSelectLever,
  onClose,
}: ProblemSolverModalProps) {
  const { theme } = useTheme();

  if (!problem) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay.scrim40 }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bg.app,
              borderTopLeftRadius: radius.modal,
              borderTopRightRadius: radius.modal,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
              Problem Solver
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color={theme.colors.text.muted} weight="bold" />
            </Pressable>
          </View>

          {/* Problem summary */}
          <View
            style={[
              styles.problemBlock,
              { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.subtle },
            ]}
          >
            <Text style={[styles.problemTitle, { color: theme.colors.semantic.error }]}>
              {problemTitle(problem)}
            </Text>
            <Text style={[styles.problemDescription, { color: theme.colors.text.secondary }]}>
              {problemDescription(problem)}
            </Text>
          </View>

          {/* Section label */}
          <Text style={[styles.sectionLabel, { color: theme.colors.text.muted }]}>
            Ways to fix it
          </Text>

          {/* Lever table */}
          <View
            style={[
              styles.table,
              {
                borderColor: theme.colors.border.subtle,
                backgroundColor: theme.colors.bg.card,
              },
            ]}
          >
            {levers.map((lever, index) => {
              const isSolvable = lever.solvedValue !== null;
              const iconColor = isSolvable
                ? theme.colors.brand.primary
                : theme.colors.text.disabled;
              const textColor = isSolvable
                ? theme.colors.text.primary
                : theme.colors.text.muted;
              const isLast = index === levers.length - 1;

              const row = (
                <View>
                <View
                  style={[
                    styles.tableRow,
                    !isSolvable && { opacity: 0.45 },
                  ]}
                >
                  {leverIcon(lever.kind, iconColor)}
                  <Text style={[styles.rowText, { color: textColor }]}>
                    {formatLeverSummary(lever)}
                  </Text>
                  {isSolvable && (
                    <CaretRight size={13} color={theme.colors.text.muted} weight="bold" />
                  )}
                </View>
                {!isLast && <Divider variant="subtle" />}
                </View>
              );

              if (!isSolvable) {
                return <View key={lever.kind}>{row}</View>;
              }

              return (
                <Pressable
                  key={lever.kind}
                  onPress={() => onSelectLever(lever)}
                  style={({ pressed }) => [{ backgroundColor: pressed ? theme.colors.bg.subtlePressed : 'transparent' }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Explore: ${formatLeverSummary(lever)}`}
                >
                  {row}
                </Pressable>
              );
            })}
          </View>

          {/* Disclaimer */}
          <Text style={[styles.disclaimer, { color: theme.colors.text.muted }]}>
            Minimum change needed to close the gap on its own. Tap to explore.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.sectionTitle,
  },

  // Problem block
  problemBlock: {
    marginHorizontal: layout.screenPadding,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.tiny,
  },
  problemTitle: {
    ...typography.label,
  },
  problemDescription: {
    ...typography.bodySmall,
  },

  sectionLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },

  // Lever table
  table: {
    marginHorizontal: layout.screenPadding,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  rowText: {
    ...typography.body,
    flex: 1,
  },

  // Disclaimer
  disclaimer: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: layout.screenPadding,
  },
});
