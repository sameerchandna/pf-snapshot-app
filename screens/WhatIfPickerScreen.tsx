import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendUp,
  HouseSimple,
  Clock,
  Baby,
  Umbrella,
  CaretRight,
} from 'phosphor-react-native';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SectionCard from '../components/SectionCard';
import { SCENARIO_TEMPLATES } from '../domain/scenario/templates';
import type { ScenarioTemplate } from '../domain/scenario/templates';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { useTheme } from '../ui/theme/useTheme';

// Map icon name string to Phosphor component
function TemplateIcon({ name, color, size }: { name: string; color: string; size: number }) {
  switch (name) {
    case 'TrendUp': return <TrendUp size={size} color={color} weight="regular" />;
    case 'HouseSimple': return <HouseSimple size={size} color={color} weight="regular" />;
    case 'Clock': return <Clock size={size} color={color} weight="regular" />;
    case 'Baby': return <Baby size={size} color={color} weight="regular" />;
    case 'Umbrella': return <Umbrella size={size} color={color} weight="regular" />;
    default: return <TrendUp size={size} color={color} weight="regular" />;
  }
}

export default function WhatIfPickerScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const enabledTemplates = SCENARIO_TEMPLATES.filter(t => t.enabled);
  const disabledTemplates = SCENARIO_TEMPLATES.filter(t => !t.enabled);

  const handleTemplatePress = (template: ScenarioTemplate) => {
    if (!template.enabled) return;
    navigation.navigate('ScenarioExplorer', { templateId: template.id });
  };

  const renderCard = (template: ScenarioTemplate) => {
    const isEnabled = template.enabled;
    const iconColor = isEnabled ? theme.colors.brand.primary : theme.colors.text.disabled;
    const cardBg = isEnabled ? theme.colors.bg.card : theme.colors.bg.subtle;
    const borderColor = isEnabled ? theme.colors.border.subtle : theme.colors.border.default;

    return (
      <Pressable
        key={template.id}
        onPress={() => handleTemplatePress(template)}
        disabled={!isEnabled}
        style={({ pressed }) => [
          styles.templateCard,
          {
            backgroundColor: pressed && isEnabled ? theme.colors.bg.subtlePressed : cardBg,
            borderColor,
            borderRadius: theme.radius.card,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isEnabled }}
      >
        <View style={[styles.iconContainer, { backgroundColor: isEnabled ? theme.colors.brand.tint : theme.colors.bg.subtle, borderRadius: theme.radius.medium }]}>
          <TemplateIcon name={template.icon} color={iconColor} size={22} />
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.question, theme.typography.bodyLarge, { color: isEnabled ? theme.colors.text.primary : theme.colors.text.disabled }]}>
            {template.question}
          </Text>
          <Text style={[styles.description, theme.typography.body, { color: isEnabled ? theme.colors.text.secondary : theme.colors.text.disabled }]}>
            {template.description}
          </Text>
        </View>

        {isEnabled ? (
          <CaretRight size={16} color={theme.colors.text.secondary} weight="regular" />
        ) : (
          <View style={[styles.comingSoonBadge, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default, borderRadius: theme.radius.pill }]}>
            <Text style={[styles.comingSoonText, theme.typography.caption, { color: theme.colors.text.muted }]}>
              Soon
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScreenHeader title="What If" subtitle="Explore your financial scenarios" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <SectionCard>
          <SectionHeader title="Explore" />
          <View style={styles.cardList}>
            {enabledTemplates.map(renderCard)}
          </View>
        </SectionCard>

        {disabledTemplates.length > 0 ? (
          <SectionCard>
            <SectionHeader title="Coming Soon" />
            <View style={styles.cardList}>
              {disabledTemplates.map(renderCard)}
            </View>
          </SectionCard>
        ) : null}
      </ScrollView>
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
  },
  cardList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderWidth: 1,
    gap: spacing.base,
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  // Note: question and description use inline theme.typography spreads
  question: {
    // theme.typography.bodyLarge spread inline
  },
  description: {
    // theme.typography.body spread inline
  },
  comingSoonBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  comingSoonText: {
    // theme.typography.caption spread inline
  },
});
