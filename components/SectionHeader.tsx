import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { layout } from '../layout';

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
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtext}>{subtitle}</Text> : null}
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
    color: '#2F5BEA',
  },
  sectionSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: '#888',
    marginBottom: layout.sectionSubtextBottom, // 12 - matches SnapshotScreen pattern
  },
});


