import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../spacing';
import DemoModeBanner from './DemoModeBanner';

type Props = {
  title: string;
  totalText?: string;
  subtitle?: string;
  subtitleFootnote?: string;
  rightAccessory?: React.ReactNode;
};

/**
 * Standard app-wide screen header.
 * Matches the existing "detail/card" header pattern: fixed header, iOS spacing, bottom divider.
 * Phase 6.7: Includes demo mode banner when active.
 */
export default function ScreenHeader({ title, totalText, subtitle, subtitleFootnote, rightAccessory }: Props) {
  const { theme } = useTheme();
  return (
    <View>
      <View style={[styles.header, styles.safeHeader, { borderBottomColor: theme.colors.border.default }]}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>{title}</Text>
        {totalText ? <Text style={[styles.headerTotal, { color: theme.colors.text.primary }]}>{totalText}</Text> : null}
        {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.text.muted }, totalText ? styles.subtitleAfterTotal : null]}>{subtitle}</Text> : null}
        {subtitleFootnote ? <Text style={[styles.subtitleFootnote, { color: theme.colors.text.disabled }]}>{subtitleFootnote}</Text> : null}
        {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
      </View>
      <DemoModeBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.xl,
    borderBottomWidth: 1,
  },
  safeHeader: {
    marginTop: Platform.OS === 'ios' ? 10 : 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: spacing.tiny,
  },
  subtitle: {
    fontSize: 12,
  },
  subtitleAfterTotal: {
    marginTop: spacing.sm,
  },
  subtitleFootnote: {
    fontSize: 12,
    marginTop: 2,
  },
  headerTotal: {
    fontSize: 18,
    fontWeight: '600',
  },
  rightAccessory: {
    position: 'absolute',
    right: 16,
    top: 18,
  },
});


