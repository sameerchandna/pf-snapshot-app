import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import { useMode } from '../context/ModeContext';

/**
 * Phase 6.7: Global demo mode indicator
 * 
 * Displays a subtle banner when demo mode is active.
 * Renders directly under the ScreenHeader divider.
 * UI-only component - no state or logic changes.
 */
export default function DemoModeBanner() {
  const { theme } = useTheme();
  const { mode } = useMode();

  if (mode !== 'demo') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.banner, { backgroundColor: theme.colors.semantic.warningBg }]}>
        <Text style={[styles.bannerText, { color: theme.colors.semantic.warningText }]}>
          Demo mode — changes won't be saved
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 26,
  },
  banner: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  bannerText: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
  },
});
