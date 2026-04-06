// ProblemOptionsScreen
//
// Full-screen replacement for ProblemSolverModal. Shows all detected problems,
// each in its own section with back-solved lever options underneath.
// Tapping a solvable lever navigates to ScenarioExplorer with pre-filled values.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  CalendarBlank,
  CaretRight,
  PiggyBank,
  Receipt,
  TrendUp,
} from 'phosphor-react-native';

import ScreenHeader from '../components/ScreenHeader';
import SketchBackground from '../components/SketchBackground';
import Divider from '../components/Divider';
import SectionHeader from '../components/SectionHeader';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { typography } from '../ui/theme/theme';
import { formatCurrencyCompact, formatYearsMonths } from '../ui/formatters';
import type { DetectedProblem } from '../projection/detectProblems';
import type { LeverSolution } from '../projection/backSolve';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavParams = {
  templateId: string;
  initialValue?: number;
  initialGrowthRate?: number;
  initialTargetId?: string;
  returnToTab: string;
};

export type LeverWithNav = LeverSolution & {
  navParams: NavParams | null;
};

export type ProblemSection = {
  problem: DetectedProblem;
  levers: LeverWithNav[];
};

type RouteParams = {
  problemSections: ProblemSection[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function problemTitle(problem: DetectedProblem): string {
  return problem.kind === 'BRIDGE_GAP' ? 'Bridge Gap' : 'Longevity Gap';
}

function problemDescription(problem: DetectedProblem): string {
  if (problem.kind === 'BRIDGE_GAP') {
    return (
      `Your savings run out at age ${problem.liquidDepletionAge}, but your ` +
      `${problem.bridgeAssetName} doesn't unlock until age ${problem.lockedUnlockAge} — ` +
      `that's a ${formatYearsMonths(problem.gapYears)} gap. The ways you could fix this are:`
    );
  }
  return (
    `Your assets run out at age ${Math.round(problem.depletionAge)}, but your plan runs to ` +
    `age ${problem.endAge} — that's a ${formatYearsMonths(problem.shortfallYears)} shortfall. ` +
    `The ways you could fix this are:`
  );
}

function leverIcon(kind: LeverSolution['kind'], color: string) {
  const size = 18;
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
        ? `Retire a bit later, at age ${Math.round(lever.solvedValue)}`
        : `Retiring later alone won't close this gap`;
    case 'FLOW_TO_ASSET':
      return lever.solvedValue !== null
        ? `Invest ${formatCurrencyCompact(lever.solvedValue)} more per month`
        : `Investing more alone won't close this gap`;
    case 'REDUCE_EXPENSES':
      return lever.solvedValue !== null
        ? `Spend ${formatCurrencyCompact(lever.solvedValue)} less per month`
        : `Spending less alone won't close this gap`;
    case 'CHANGE_ASSET_GROWTH_RATE':
      return lever.solvedValue !== null
        ? `${lever.assetName} would need to grow at ${lever.solvedValue.toFixed(1)}% per year`
        : `Better growth alone won't close this gap`;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProblemOptionsScreen() {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { problemSections } = route.params as RouteParams;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: palette.bg }]}>
      <SketchBackground color={palette.accent} style={styles.container}>
        <ScreenHeader title="Fix My Plan" />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {problemSections.map((section, sectionIndex) => {
            const { problem, levers } = section;
            const isLast = sectionIndex === problemSections.length - 1;

            return (
              <View
                key={`${problem.kind}-${sectionIndex}`}
                style={[styles.section, !isLast && styles.sectionGap]}
              >
                <SectionHeader title={problemTitle(problem)} />

                {/* Conversational problem description */}
                <Text style={[styles.description, { color: theme.colors.text.secondary }]}>
                  {problemDescription(problem)}
                </Text>

                {/* Lever rows — plain list, no card wrapper */}
                <View style={styles.levers}>
                  {levers.map((lever, index) => {
                    const isSolvable = lever.solvedValue !== null;
                    const iconColor = isSolvable
                      ? palette.accent
                      : theme.colors.text.disabled;
                    const textColor = isSolvable
                      ? theme.colors.text.primary
                      : theme.colors.text.muted;
                    const isLastRow = index === levers.length - 1;

                    const rowContent = (
                      <View
                        style={[
                          styles.leverRow,
                          !isSolvable && styles.rowDisabled,
                        ]}
                      >
                        {leverIcon(lever.kind, iconColor)}
                        <Text style={[styles.leverText, { color: textColor }]}>
                          {formatLeverSummary(lever)}
                        </Text>
                        {isSolvable && (
                          <CaretRight size={13} color={theme.colors.text.muted} weight="bold" />
                        )}
                      </View>
                    );

                    if (!isSolvable || lever.navParams === null) {
                      return (
                        <React.Fragment key={lever.kind}>
                          <View>{rowContent}</View>
                          {!isLastRow && <Divider variant="subtle" />}
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={lever.kind}>
                        <Pressable
                          onPress={() =>
                            navigation.navigate('WhatIfTab', {
                              screen: 'ScenarioExplorer',
                              params: lever.navParams,
                            })
                          }
                          style={({ pressed }) => ({
                            backgroundColor: pressed
                              ? theme.colors.bg.subtlePressed
                              : 'transparent',
                          })}
                          accessibilityRole="button"
                          accessibilityLabel={`Explore: ${formatLeverSummary(lever)}`}
                        >
                          {rowContent}
                        </Pressable>
                        {!isLastRow && <Divider variant="subtle" />}
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Disclaimer */}
          <Text style={[styles.disclaimer, { color: theme.colors.text.muted }]}>
            These are the minimum changes needed to close each gap on their own. Tap one to explore.
          </Text>
        </ScrollView>
      </SketchBackground>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.screenPaddingTop,
    paddingBottom: spacing.xl,
  },

  section: {},
  sectionGap: {
    marginBottom: layout.sectionGap,
  },

  description: {
    ...typography.body,
    marginBottom: spacing.base,
    lineHeight: 22,
  },

  // Lever list
  levers: {},
  leverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  leverText: {
    ...typography.body,
    flex: 1,
  },

  // Disclaimer
  disclaimer: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.base,
  },
});
