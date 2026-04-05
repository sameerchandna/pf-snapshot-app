import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import SketchBackground from '../components/SketchBackground';
import SectionCard from '../components/SectionCard';
import Button from '../components/Button';
import { useSnapshot } from '../context/SnapshotContext';
import { buildProjectionInputsFromState } from '../projection/buildProjectionInputs';
import { computeProjectionSummary } from '../engines/projectionEngine';
import { backSolveEarliestRetirement } from '../projection/backSolve';
import {
  generateEarliestRetirementExplanation,
  generateAssetsLongevityExplanation,
} from '../projection/generateQuestionExplanation';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';

type QuestionId = 'EARLIEST_RETIREMENT' | 'ASSETS_LONGEVITY';

type RouteParams = {
  questionId: QuestionId;
};

const QUESTION_META: Record<QuestionId, { title: string; subtitle: string }> = {
  EARLIEST_RETIREMENT: {
    title: 'Earliest retirement',
    subtitle: "What's the earliest age I can retire?",
  },
  ASSETS_LONGEVITY: {
    title: 'Asset longevity',
    subtitle: 'How long will my liquid assets last?',
  },
};

export default function QuestionAnswerScreen() {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { questionId } = route.params as RouteParams;
  const { state } = useSnapshot();

  const meta = QUESTION_META[questionId];

  const { heroAnswer, heroLabel, paragraphs, ctaLabel, ctaParams } = useMemo(() => {
    const inputs = buildProjectionInputsFromState(state);
    const summary = computeProjectionSummary(inputs);
    const assetsWithAvailability = state.assets.filter(a => a.isActive !== false);

    if (questionId === 'EARLIEST_RETIREMENT') {
      const retirementResult = backSolveEarliestRetirement(inputs, assetsWithAvailability);
      const { earliestAge, currentProblems } = retirementResult;

      // Hero shows the earliest viable age, or a placeholder if unsolvable
      const hero = earliestAge !== null ? `Age ${earliestAge}` : 'Not achievable';
      // If current plan has gaps and earliestAge > planned, clarify it's a minimum, not earlier
      const heroLabel =
        currentProblems.length > 0 && earliestAge !== null && earliestAge > inputs.retirementAge
          ? 'Minimum viable retirement age'
          : 'Earliest retirement age';

      const paras = generateEarliestRetirementExplanation(inputs, assetsWithAvailability, retirementResult);

      const hasExploreCta = earliestAge !== null;

      return {
        heroAnswer: hero,
        heroLabel,
        paragraphs: paras,
        ctaLabel: hasExploreCta ? `Explore retiring at age ${earliestAge}` : null,
        ctaParams: hasExploreCta
          ? {
              templateId: 'retire-at-age',
              initialValue: earliestAge,
              returnToTab: 'WhatIfTab',
            }
          : null,
      };
    }

    // ASSETS_LONGEVITY
    const depAge = summary.depletionAge;
    const hero =
      depAge !== undefined
        ? `Age ${Math.round(depAge)}`
        : `Beyond age ${inputs.endAge}`;

    const paras = generateAssetsLongevityExplanation(inputs, assetsWithAvailability, summary);

    const hasExploreCta = depAge !== undefined;

    return {
      heroAnswer: hero,
      heroLabel: 'Assets last until',
      paragraphs: paras,
      ctaLabel: hasExploreCta ? 'Explore investing more' : null,
      ctaParams: hasExploreCta
        ? {
            templateId: 'savings-what-if',
            returnToTab: 'WhatIfTab',
          }
        : null,
    };
  }, [questionId, state]);

  const handleExploreCta = () => {
    if (!ctaParams) return;
    navigation.navigate('ScenarioExplorer', ctaParams);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.bg} style={{flex:1}}>
      <ScreenHeader title={meta.title} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Hero answer */}
        <SectionCard>
          <View style={styles.heroRow}>
            <Text style={[theme.typography.label, { color: theme.colors.text.secondary }]}>
              {heroLabel}
            </Text>
            <Text style={[theme.typography.valueLarge, { color: theme.colors.text.primary }]}>
              {heroAnswer}
            </Text>
          </View>
        </SectionCard>

        {/* Explanation paragraphs */}
        {paragraphs.length > 0 && (
          <SectionCard>
            <View style={styles.paragraphList}>
              {paragraphs.map((para, i) => (
                <View key={i} style={styles.paragraph}>
                  <Text
                    style={[
                      theme.typography.label,
                      {
                        color:
                          para.kind === 'warning'
                            ? theme.colors.semantic.warning
                            : theme.colors.text.secondary,
                      },
                    ]}
                  >
                    {para.heading}
                  </Text>
                  <Text
                    style={[
                      theme.typography.bodyLarge,
                      {
                        color:
                          para.kind === 'warning'
                            ? theme.colors.semantic.warningText
                            : theme.colors.text.muted,
                      },
                    ]}
                  >
                    {para.body.trim()}
                  </Text>
                </View>
              ))}
            </View>
          </SectionCard>
        )}

        {/* CTA */}
        {ctaLabel && ctaParams && (
          <View style={styles.ctaContainer}>
            <Button variant="primary" size="md" onPress={handleExploreCta}>{ctaLabel}</Button>
          </View>
        )}
      </ScrollView>
      </SketchBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: layout.screenPadding,
    paddingTop: layout.screenPaddingTop,
    paddingBottom: layout.screenPaddingBottom,
    gap: layout.sectionGap,
  },
  heroRow: {
    gap: spacing.xs,
  },
  paragraphList: {
    gap: layout.lg,
  },
  paragraph: {
    gap: spacing.xs,
  },
  ctaContainer: {
    marginTop: spacing.sm,
  },
});
