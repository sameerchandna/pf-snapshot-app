import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '../spacing';
import { layout } from '../layout';
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
    paddingHorizontal: layout.rowPaddingHorizontal,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
