import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { spacing } from '../spacing';

interface SectionCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function SectionCard({ children, style }: SectionCardProps) {
  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.base,
    marginBottom: spacing.huge,
  },
});
