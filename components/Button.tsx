import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';

type ButtonVariant = 'primary' | 'secondary' | 'text';
type ButtonSize = 'sm' | 'md';

type Props = {
  variant: ButtonVariant;
  size: ButtonSize;
  disabled?: boolean;
  onPress: () => void;
  children: string; // TEXT ONLY
  style?: ViewStyle;
};

/**
 * Shared Button component for consistent button styling across the app.
 * 
 * Uses theme colors and implements pressed states via background color changes
 * (not opacity) for better dark mode support.
 */
export default function Button({ variant, size, disabled = false, onPress, children, style }: Props) {
  const { theme } = useTheme();

  // Get base colors for variant
  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: theme.colors.brand.primary,
          pressedBg: '#254EDB',
          text: theme.colors.brand.onPrimary,
        };
      case 'secondary':
        return {
          bg: theme.colors.bg.subtle,
          pressedBg: '#eaeaea',
          text: theme.colors.text.secondary,
        };
      case 'text':
        return {
          bg: 'transparent',
          pressedBg: theme.colors.bg.subtle,
          text: theme.colors.brand.primary,
        };
    }
  };

  const colors = getVariantColors();

  // Get size styles
  const getSizeStyles = () => {
    switch (size) {
      case 'md':
        return {
          paddingVertical: layout.inputPadding,
          paddingHorizontal: spacing.xl,
          fontSize: 14,
          borderRadius: 8,
        };
      case 'sm':
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: layout.inputPadding,
          fontSize: 12,
          borderRadius: 14,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  // Text color when disabled
  const textColor = disabled ? theme.colors.text.disabled : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          borderRadius: sizeStyles.borderRadius,
          backgroundColor: pressed ? colors.pressedBg : colors.bg,
        },
        style,
      ]}
      accessibilityRole="button"
    >
      <Text
        style={{
          color: textColor,
          fontSize: sizeStyles.fontSize,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
