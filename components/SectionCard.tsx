import React from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { useTheme } from '../ui/theme/useTheme';

interface SectionCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  useGradient?: boolean;
}

export default function SectionCard({ children, style, useGradient = false }: SectionCardProps) {
  const { theme } = useTheme();
  
  const containerStyle = [
    styles.container,
    { borderRadius: theme.radius.large },
    style,
  ];
  
  if (useGradient) {
    return (
      <LinearGradient
        colors={[theme.colors.bg.cardGradientTop, theme.colors.bg.cardGradientBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={containerStyle}
      >
        {children}
      </LinearGradient>
    );
  }
  
  return <View style={[containerStyle, { backgroundColor: theme.colors.bg.card }]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.rowPaddingHorizontal,
    paddingVertical: spacing.xl,
    marginBottom: spacing.huge,
  },
});
