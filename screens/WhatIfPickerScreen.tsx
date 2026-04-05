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
import { SCENARIO_TEMPLATES } from '../domain/scenario/templates';
import type { ScenarioCategory, ScenarioTemplate } from '../domain/scenario/templates';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';

// ── Find Out questions (back-solve analytical questions) ──────────────────────

type FindOutQuestionId = 'EARLIEST_RETIREMENT' | 'ASSETS_LONGEVITY';
type FindOutQuestion = {
  id: FindOutQuestionId;
  question: string;
  description: string;
  icon: string;
};

const FIND_OUT_QUESTIONS: FindOutQuestion[] = [
  {
    id: 'EARLIEST_RETIREMENT',
    question: "What's the earliest age I can retire?",
    description: 'Find the earliest age you could stop working based on your current finances.',
    icon: 'Clock',
  },
  {
    id: 'ASSETS_LONGEVITY',
    question: 'How long will my liquid assets last?',
    description: 'See how long your savings and investments would last if you stopped earning today.',
    icon: 'Hourglass',
  },
];

// ── Category-derived colour logic ─────────────────────────────────────────────

type WhatifColorKey = 'sage' | 'teal' | 'rose' | 'amber' | 'periwinkle' | 'lavender' | 'mint' | 'grey';

const CATEGORY_PALETTES: Record<ScenarioCategory, WhatifColorKey[]> = {
  assets:      ['sage', 'teal'],
  liabilities: ['rose', 'amber'],
  events:      ['periwinkle', 'lavender', 'mint'],
};

// Derived once at module level — no runtime cost, zero config for new templates
const COLOR_MAP: Map<string, WhatifColorKey> = (() => {
  const counters: Partial<Record<ScenarioCategory, number>> = {};
  const map = new Map<string, WhatifColorKey>();
  for (const t of SCENARIO_TEMPLATES) {
    if (!t.enabled) { map.set(t.id, 'grey'); continue; }
    const idx = counters[t.category] ?? 0;
    counters[t.category] = idx + 1;
    const palette = CATEGORY_PALETTES[t.category];
    map.set(t.id, palette[idx % palette.length]);
  }
  return map;
})();

const SHORT_LABELS: Record<string, string> = {
  'savings-what-if':  'Save & Grow',
  'mortgage-what-if': 'My Mortgage',
  'retire-at-age':    'Retire Age',
  'spend-less':       'Spend Less',
  'go-part-time':     'Part Time',
  'have-a-baby':      'Have a Baby',
};

const FIND_OUT_COLORS: Record<FindOutQuestionId, WhatifColorKey> = {
  EARLIEST_RETIREMENT: 'mint',
  ASSETS_LONGEVITY:    'amber',
};

const FIND_OUT_LABELS: Record<FindOutQuestionId, string> = {
  EARLIEST_RETIREMENT: 'Retire Early',
  ASSETS_LONGEVITY:    'Asset Runway',
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
      label: 'Assets & Liabilities',
      templates: SCENARIO_TEMPLATES.filter(
        t => t.enabled && (t.category === 'assets' || t.category === 'liabilities'),
      ),
    },
    {
      label: 'Events',
      templates: SCENARIO_TEMPLATES.filter(t => t.enabled && t.category === 'events'),
    },
    {
      label: 'Coming Soon',
      templates: SCENARIO_TEMPLATES.filter(t => !t.enabled),
    },
  ].filter(g => g.templates.length > 0);

  // ── Grid tile card (scenario templates) ──

  const renderTile = (template: ScenarioTemplate) => {
    const colorKey = COLOR_MAP.get(template.id) ?? 'grey';
    const colors = theme.colors.whatif[colorKey];
    const isEnabled = template.enabled;
    const label = SHORT_LABELS[template.id] ?? template.question;

    return (
      <Pressable
        key={template.id}
        onPress={() => { if (isEnabled) navigation.navigate('ScenarioExplorer', { templateId: template.id }); }}
        disabled={!isEnabled}
        style={({ pressed }) => [
          styles.tile,
          {
            backgroundColor: pressed && isEnabled ? colors.cardBgPressed : colors.cardBg,
            borderRadius: theme.radius.rounded,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isEnabled }}
      >
        <View style={[styles.tileIcon, { backgroundColor: colors.iconBg, borderRadius: theme.radius.large }]}>
          <TemplateIcon name={template.icon} color={colors.title} size={22} />
        </View>

        <Text style={[theme.typography.label, { color: colors.title }]} numberOfLines={2}>
          {label}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: colors.body }]} numberOfLines={3}>
          {template.description}
        </Text>

        {!isEnabled && (
          <View style={[
            styles.soonBadge,
            {
              backgroundColor: theme.colors.bg.subtle,
              borderColor: theme.colors.border.default,
              borderRadius: theme.radius.pill,
            },
          ]}>
            <Text style={[theme.typography.caption, { color: theme.colors.text.muted }]}>Soon</Text>
          </View>
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
    const colors = theme.colors.whatif[FIND_OUT_COLORS[question.id]];
    const label = FIND_OUT_LABELS[question.id];
    return (
      <Pressable
        key={question.id}
        onPress={() => navigation.navigate('QuestionAnswer', { questionId: question.id })}
        style={({ pressed }) => [
          styles.tile,
          {
            backgroundColor: pressed ? colors.cardBgPressed : colors.cardBg,
            borderRadius: theme.radius.rounded,
          },
        ]}
        accessibilityRole="button"
      >
        <View style={[styles.tileIcon, { backgroundColor: colors.iconBg, borderRadius: theme.radius.large }]}>
          <TemplateIcon name={question.icon} color={colors.title} size={22} />
        </View>

        <Text style={[theme.typography.label, { color: colors.title }]} numberOfLines={2}>
          {label}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: colors.body }]} numberOfLines={3}>
          {question.description}
        </Text>
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
      <SketchBackground color={palette.bg} style={{flex:1}}>
      <ScreenHeader title="What If... ?" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {displayGroups.filter(g => g.label !== 'Coming Soon').map(group => (
          <View key={group.label} style={styles.section}>
            <SectionHeader title={group.label} />
            <View style={styles.grid}>
              {renderTilePairs(group.templates)}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <SectionHeader title="Questions" />
          <View style={styles.grid}>
            {renderQuestionPairs()}
          </View>
        </View>

        {displayGroups.filter(g => g.label === 'Coming Soon').map(group => (
          <View key={group.label} style={styles.section}>
            <SectionHeader title={group.label} />
            <View style={styles.grid}>
              {renderTilePairs(group.templates)}
            </View>
          </View>
        ))}
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
  tileIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  gridSpacer: { flex: 1 },
});
