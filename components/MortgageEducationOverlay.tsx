/**
 * Mortgage Education Overlay
 * 
 * Phase 5.8: Educational overlay explaining mortgage/loan balance concepts.
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
 * - NO advice, NO optimisation framing, NO emotional language
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

export default function MortgageEducationOverlay({ onClose }: Props) {
  const { theme } = useTheme();

  return (
    <>
      <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border.subtle }]}>
        <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
          Understanding Mortgage Balances
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
        {/* Principal vs Interest */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Principal vs Interest
          </Text>
          <Text style={[styles.sectionText, { color: theme.colors.text.secondary }]}>
            Principal is the original loan amount that you borrowed. Interest is the cost of borrowing,
            calculated as a percentage of the remaining balance. Each payment includes both principal
            and interest, with principal reducing the balance and interest representing the cost of
            the loan.
          </Text>
        </View>

        {/* Amortisation over time */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Amortisation Over Time
          </Text>
          <Text style={[styles.sectionText, { color: theme.colors.text.secondary }]}>
            Amortisation is the process of paying off a loan over time through regular payments.
            The balance decreases gradually as principal is repaid. The chart shows the remaining
            balance declining over time, with the rate of decline accelerating as more principal
            is repaid and less interest is charged.
          </Text>
        </View>

        {/* Why early payments are interest-heavy */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Why Early Payments Are Interest-Heavy
          </Text>
          <Text style={[styles.sectionText, { color: theme.colors.text.secondary }]}>
            Early in the loan term, the balance is highest, so interest charges are largest. As the
            balance decreases over time, interest charges decrease and a larger portion of each
            payment goes toward principal. This is why the interest area in the chart is larger
            early in the loan term and decreases over time.
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
