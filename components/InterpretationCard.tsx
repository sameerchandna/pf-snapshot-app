/**
 * Phase 10.4: Interpretation Card
 *
 * Hero card displayed above the projection chart.
 * Shows the projection headline, key metrics, and net worth milestone pills.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import SectionCard from './SectionCard';
import SectionHeader from './SectionHeader';
import { formatCurrencyCompact } from '../ui/formatters';
import { typography, radius } from '../ui/theme/theme';
import type { InterpretationResult, InterpretationKeyMoment } from '../insights/interpretProjection';

interface InterpretationCardProps {
  interpretation: InterpretationResult;
  /** Whether liabilities exist (controls whether debt-free metric is shown) */
  hasLiabilities: boolean;
  style?: object;
}

const MILESTONE_TYPES = new Set([
  'NET_WORTH_100K',
  'NET_WORTH_250K',
  'NET_WORTH_500K',
  'NET_WORTH_1M',
]);

function milestoneLabel(moment: InterpretationKeyMoment): string {
  const age = Math.round(moment.age);
  const value = formatCurrencyCompact(moment.value >= 100_000 ? moment.value : getMilestoneThreshold(moment.type as any));
  return `${value} @ ${age}`;
}

function getMilestoneThreshold(type: string): number {
  switch (type) {
    case 'NET_WORTH_100K': return 100_000;
    case 'NET_WORTH_250K': return 250_000;
    case 'NET_WORTH_500K': return 500_000;
    case 'NET_WORTH_1M':   return 1_000_000;
    default:               return 0;
  }
}

export default function InterpretationCard({
  interpretation,
  hasLiabilities,
  style,
}: InterpretationCardProps) {
  const { theme } = useTheme();

  const milestoneMoments = interpretation.keyMoments
    .filter(m => MILESTONE_TYPES.has(m.type))
    .slice(0, 4);

  const debtFreeMoment = interpretation.keyMoments.find(m => m.type === 'DEBT_FREE');
  const debtFreeAge = debtFreeMoment ? Math.round(debtFreeMoment.age) : null;

  const fiProgressPct = Math.round(interpretation.fiProgress * 100);

  return (
    <SectionCard style={[styles.card, style]}>
      <SectionHeader title="Your Projection" />

      {/* Headline */}
      <Text style={[styles.headline, { color: theme.colors.text.primary }]}>
        {interpretation.headline}
      </Text>

      {/* Subline */}
      {interpretation.subline ? (
        <Text style={[styles.subline, { color: theme.colors.text.secondary }]}>
          {interpretation.subline}
        </Text>
      ) : null}

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        {/* End net worth */}
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: theme.colors.text.primary }]}>
            {formatCurrencyCompact(interpretation.endNetWorth)}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.colors.text.muted }]}>
            End net worth
          </Text>
        </View>

        {/* Debt-free age (conditional) */}
        {hasLiabilities ? (
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: theme.colors.text.primary }]}>
              {debtFreeAge !== null ? `Age ${debtFreeAge}` : '—'}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.text.muted }]}>
              Debt-free
            </Text>
          </View>
        ) : null}

        {/* FI progress */}
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: theme.colors.text.primary }]}>
            {`${fiProgressPct}%`}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.colors.text.muted }]}>
            FI progress
          </Text>
        </View>
      </View>

      {/* Milestone pills */}
      {milestoneMoments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={styles.pillsContent}
        >
          {milestoneMoments.map(moment => (
            <View
              key={moment.type}
              style={[
                styles.pill,
                {
                  backgroundColor: theme.colors.brand.tint,
                  borderRadius: radius.pill,
                },
              ]}
            >
              <Text style={[styles.pillText, { color: theme.colors.brand.primary }]}>
                {milestoneLabel(moment)}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.xs,
  },
  headline: {
    ...typography.sectionTitle,
    marginTop: spacing.sm,
  },
  subline: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: spacing.base,
    gap: spacing.xl,
  },
  metricItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  metricValue: {
    ...typography.valueLarge,
  },
  metricLabel: {
    ...typography.caption,
    marginTop: spacing.tiny,
  },
  pillsScroll: {
    marginTop: spacing.sm,
  },
  pillsContent: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.tiny,
  },
  pillText: {
    ...typography.caption,
  },
});
