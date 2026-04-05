import React from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import SketchCard from './SketchCard';

interface SectionCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  useGradient?: boolean;
  borderColor?: string;
  fillColor?: string;
}

export default function SectionCard({ children, style, borderColor, fillColor }: SectionCardProps) {
  const flatStyle = StyleSheet.flatten([styles.container, style]);
  return (
    <SketchCard
      borderColor={borderColor || 'transparent'}
      fillColor={fillColor}
      style={flatStyle}
    >
      {children}
    </SketchCard>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.rowPaddingHorizontal,
    paddingTop: 0,
    paddingBottom: spacing.xl,
    marginBottom: spacing.huge,
  },
});
