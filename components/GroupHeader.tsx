import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '../spacing';
import { useTheme } from '../ui/theme/useTheme';

type Props = {
  title: string;
};

/**
 * Group header for structural/grouping sections.
 * Used in Accounts, grouped lists, settings, validation screens.
 * 
 * Style: 12px, bold, gray, uppercase, letter-spaced
 * Matches existing styles in AccountsScreen, LoanDetailScreen, etc.
 */
export default function GroupHeader({ title }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text.secondary }]}>{title.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Container for potential future spacing needs
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: spacing.sm, // 8 - matches AccountsScreen pattern (most common for group headers)
  },
});
