import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { spacing } from '../spacing';
import { useTheme } from '../ui/theme/useTheme';

interface SectionCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function SectionCard({ children, style }: SectionCardProps) {
  const { theme } = useTheme();
  return <View style={[styles.container, { backgroundColor: theme.colors.bg.card }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: spacing.base,
    marginBottom: spacing.huge,
  },
});
