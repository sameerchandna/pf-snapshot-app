/**
 * Savings Education Overlay
 * 
 * Phase 5.8: Educational overlay explaining savings balance concepts.
 * 
 * Architectural separation:
 * - Educational overlays explain CONCEPTS (static, optional, informational)
 * - Insights explain DATA (dynamic, conditional, observational)
 * - These must remain fully decoupled - overlays do not depend on insights
 * 
 * Read-only guarantees:
 * - Overlay is purely informational, no state mutation
 * - No Snapshot, Projection, or Scenario interaction
 * - Passive and optional - user controls visibility
 * 
 * Language rules:
 * - Neutral, descriptive, observational
 * - NO advice, NO optimisation framing, NO motivational language
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { spacing } from '../spacing';
import { layout } from '../layout';
import { useTheme } from '../ui/theme/useTheme';
import IconButton from './IconButton';

type Props = {
  onClose: () => void;
};

export default function SavingsEducationOverlay({ onClose }: Props) {
  const { theme } = useTheme();

  return (
    <>
      <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border.subtle }]}>
        <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
          Understanding Savings Balances
        </Text>
        <IconButton
          icon="x"
          size="md"
          variant="default"
          onPress={onClose}
          accessibilityLabel="Close"
        />
      </View>

      <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
        {/* Contributions vs Growth */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Contributions vs Growth
          </Text>
          <Text style={[styles.sectionText, { color: theme.colors.text.secondary }]}>
            Contributions are money you add to the balance over time. Growth is the increase in value
            that comes from interest or investment returns. The chart shows both layers stacked together,
            with contributions forming the base and growth building on top.
          </Text>
        </View>

        {/* Compounding over time */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Compounding Over Time
          </Text>
          <Text style={[styles.sectionText, { color: theme.colors.text.secondary }]}>
            Growth compounds over time, meaning each period's growth builds on the previous balance
            including both the starting amount and prior growth. This creates an accelerating curve
            visible in the chart as the growth layer becomes steeper over time.
          </Text>
        </View>

        {/* Reading the stacked chart */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Reading the Stacked Chart
          </Text>
          <Text style={[styles.sectionText, { color: theme.colors.text.secondary }]}>
            The stacked areas show how contributions and growth combine to form the total balance.
            The bottom layer represents contributions, and the top layer represents growth. The total
            height at any point shows the complete balance. You can see how each component changes
            over time by observing the relative sizes of the layers.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  modalBody: {
    maxHeight: 400,
  },
  modalBodyContent: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.base,
  },
  section: {
    marginBottom: spacing.base,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
