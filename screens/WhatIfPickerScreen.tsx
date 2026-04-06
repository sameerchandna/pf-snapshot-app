import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendUp,
  HouseSimple,
  Clock,
  Baby,
  Hourglass,
  PiggyBank,
  ChartLineUp,
} from 'phosphor-react-native';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SketchBackground from '../components/SketchBackground';
import SketchCard from '../components/SketchCard';
import { SCENARIO_TEMPLATES } from '../domain/scenario/templates';
import type { ScenarioTemplate } from '../domain/scenario/templates';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';

// ── Find Out questions (back-solve analytical questions) ──────────────────────

type FindOutQuestionId = 'ASSETS_LONGEVITY';
type FindOutQuestion = {
  id: FindOutQuestionId;
  question: string;
  description: string;
  icon: string;
};

const FIND_OUT_QUESTIONS: FindOutQuestion[] = [
  {
    id: 'ASSETS_LONGEVITY',
    question: 'How long will my liquid assets last?',
    description: 'If you stopped working today, how long before the money runs out?',
    icon: 'Hourglass',
  },
];

const SHORT_LABELS: Record<string, string> = {
  'savings-what-if':  'Save & Grow',
  'mortgage-what-if': 'Overpay your mortgage',
  'retire-at-age':    'When can I retire?',
  'spend-less':       'Spend Less',
  'go-part-time':     'Part Time',
  'have-a-baby':      'Have a Baby',
  'increase-income':  'Increase Income',
  'income-reduces':   'Income stops or reduces',
};

const FIND_OUT_LABELS: Record<FindOutQuestionId, string> = {
  ASSETS_LONGEVITY: 'Asset Runway',
};

// ── Icon helper ───────────────────────────────────────────────────────────────

function TemplateIcon({ name, color, size }: { name: string; color: string; size: number }) {
  switch (name) {
    case 'TrendUp':     return <TrendUp     size={size} color={color} weight="regular" />;
    case 'HouseSimple': return <HouseSimple size={size} color={color} weight="regular" />;
    case 'Hourglass':   return <Hourglass   size={size} color={color} weight="regular" />;
    case 'PiggyBank':   return <PiggyBank   size={size} color={color} weight="regular" />;
    case 'ChartLineUp': return <ChartLineUp size={size} color={color} weight="regular" />;
    case 'Clock':       return <Clock       size={size} color={color} weight="regular" />;
    case 'Baby':        return <Baby        size={size} color={color} weight="regular" />;
    default:            return <TrendUp     size={size} color={color} weight="regular" />;
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WhatIfPickerScreen() {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const navigation = useNavigation<any>();

  const displayGroups = [
    {
      label: 'What you can do...',
      templates: SCENARIO_TEMPLATES.filter(
        t => t.category === 'assets' || t.category === 'liabilities',
      ),
    },
    {
      label: 'What can happen to you...',
      templates: SCENARIO_TEMPLATES.filter(t => t.category === 'events'),
    },
  ].filter(g => g.templates.length > 0);

  const wonderTemplates = SCENARIO_TEMPLATES.filter(t => t.category === 'wonder');

  // ── Grid tile card (scenario templates) ──

  const renderTile = (template: ScenarioTemplate) => {
    const isEnabled = template.enabled;
    const label = SHORT_LABELS[template.id] ?? template.question;
    const accentColor = isEnabled ? palette.accent : theme.colors.text.muted;
    const bodyColor = isEnabled ? theme.colors.text.secondary : theme.colors.text.disabled;

    return (
      <Pressable
        key={template.id}
        onPress={() => { if (isEnabled) navigation.navigate('ScenarioExplorer', { templateId: template.id }); }}
        disabled={!isEnabled}
        style={{ flex: 1 }}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isEnabled }}
      >
        {({ pressed }) => (
          <SketchCard
            borderColor={accentColor}
            fillColor={pressed && isEnabled ? accentColor : theme.colors.bg.default}
            fillOpacity={pressed && isEnabled ? 0.15 : 1}
            borderRadius={theme.radius.rounded}
            style={styles.tile}
          >
            <View style={styles.tileHeader}>
              <SketchCard
                fillColor={isEnabled ? palette.sectionHeaderBg : theme.colors.bg.subtle}
                borderColor={isEnabled ? palette.sectionHeaderBg : theme.colors.bg.subtle}
                fillOpacity={isEnabled ? 0.7 : 0.5}
                strokeOpacity={0.1}
                borderRadius={theme.radius.large}
                style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}
              >
                <TemplateIcon name={template.icon} color={isEnabled ? theme.colors.bg.default : theme.colors.text.disabled} size={22} />
              </SketchCard>
              <Text style={[theme.typography.bodyLarge, { color: isEnabled ? theme.colors.bg.default : theme.colors.text.disabled, fontWeight: '700', flex: 1 }]} numberOfLines={2}>
                {label}
              </Text>
            </View>
            <Text style={[theme.typography.body, { color: bodyColor }]} numberOfLines={3}>
              {template.description}
            </Text>
          </SketchCard>
        )}
      </Pressable>
    );
  };

  const renderTilePairs = (templates: ScenarioTemplate[]) => {
    const rows = [];
    for (let i = 0; i < templates.length; i += 2) {
      rows.push(
        <View key={i} style={styles.gridRow}>
          {renderTile(templates[i])}
          {templates[i + 1] ? renderTile(templates[i + 1]) : <View style={styles.gridSpacer} />}
        </View>,
      );
    }
    return rows;
  };

  // ── Grid tile (Find Out analytical questions) ──

  const renderQuestionTile = (question: FindOutQuestion) => {
    const label = FIND_OUT_LABELS[question.id];
    return (
      <Pressable
        key={question.id}
        onPress={() => navigation.navigate('QuestionAnswer', { questionId: question.id })}
        style={{ flex: 1 }}
        accessibilityRole="button"
      >
        {({ pressed }) => (
          <SketchCard
            borderColor={palette.accent}
            fillColor={palette.accent}
            fillOpacity={pressed ? 0.15 : 0}
            borderRadius={theme.radius.rounded}
            style={styles.tile}
          >
            <View style={styles.tileHeader}>
              <SketchCard
                fillColor={palette.sectionHeaderBg}
                borderColor={palette.sectionHeaderBg}
                fillOpacity={0.7}
                strokeOpacity={0.1}
                borderRadius={theme.radius.large}
                style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}
              >
                <TemplateIcon name={question.icon} color={theme.colors.bg.default} size={22} />
              </SketchCard>
              <Text style={[theme.typography.bodyLarge, { color: theme.colors.bg.default, fontWeight: '700', flex: 1 }]} numberOfLines={2}>
                {label}
              </Text>
            </View>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]} numberOfLines={3}>
              {question.description}
            </Text>
          </SketchCard>
        )}
      </Pressable>
    );
  };

  const renderQuestionPairs = () => {
    const rows = [];
    for (let i = 0; i < FIND_OUT_QUESTIONS.length; i += 2) {
      rows.push(
        <View key={i} style={styles.gridRow}>
          {renderQuestionTile(FIND_OUT_QUESTIONS[i])}
          {FIND_OUT_QUESTIONS[i + 1]
            ? renderQuestionTile(FIND_OUT_QUESTIONS[i + 1])
            : <View style={styles.gridSpacer} />}
        </View>,
      );
    }
    return rows;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.accent} style={{flex:1}}>
      <ScreenHeader title="What If... ?" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {displayGroups.map(group => (
          <View key={group.label} style={styles.section}>
            <SectionHeader title={group.label} />
            <View style={styles.grid}>
              {renderTilePairs(group.templates)}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <SectionHeader title="You might wonder..." />
          <View style={styles.grid}>
            {renderQuestionPairs()}
            {renderTilePairs(wonderTemplates)}
          </View>
        </View>
      </ScrollView>
      </SketchBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scrollView:    { flex: 1 },
  scrollContent: {
    padding: layout.screenPadding,
    paddingTop: layout.screenPaddingTop,
    paddingBottom: layout.screenPaddingBottom,
  },
  section:     { marginBottom: spacing.xl },
  // Grid (scenario tiles)
  grid:        { gap: spacing.sm },
  gridRow:     { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    padding: spacing.base,
    gap: spacing.sm,
    minHeight: 150,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gridSpacer: { flex: 1 },
});
