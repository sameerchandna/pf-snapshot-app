import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { layout } from '../layout';
import { useTheme } from '../ui/theme/useTheme';

type Props = {
  title: string;
  subtitle?: string;
};

/**
 * Section header for primary financial sections.
 * Used in Snapshot and Projection-style screens for main content sections.
 * 
 * Style: 16px, bold, blue (#2F5BEA)
 * Matches existing styles in SnapshotScreen, ProjectionResultsScreen.
 */
export default function SectionHeader({ title, subtitle }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: theme.colors.brand.primary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtext, { color: theme.colors.text.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Snapshot uses tight vertical rhythm: a little separation before blocks.
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: layout.sectionTitleBottom, // 4 - matches SnapshotScreen pattern
  },
  sectionSubtext: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: layout.sectionSubtextBottom, // 12 - matches SnapshotScreen pattern
  },
});


