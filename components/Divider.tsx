import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';

type DividerVariant = 'default' | 'subtle' | 'thick';

type Props = {
  variant?: DividerVariant;
  style?: StyleProp<ViewStyle>;
};

/**
 * Divider component for horizontal visual separators.
 * 
 * Provides consistent, theme-aware dividers with variant thickness options.
 * Spacing (margins/padding) is the caller's responsibility.
 * 
 * Uses border-based implementation (borderTopWidth) rather than fixed height
 * for more semantic and flexible rendering.
 */
export default function Divider({ variant = 'default', style }: Props) {
  const { theme } = useTheme();

  // Get border width and color based on variant
  const getDividerConfig = (): { width: number; color: string } => {
    switch (variant) {
      case 'subtle':
        return {
          width: 0.5,
          color: theme.colors.border.subtle,
        };
      case 'thick':
        return {
          width: 2,
          color: theme.colors.border.default,
        };
      default:
        return {
          width: 1,
          color: theme.colors.border.default,
        };
    }
  };

  const config = getDividerConfig();

  return (
    <View
      style={[
        {
          alignSelf: 'stretch',
          borderTopWidth: config.width,
          borderTopColor: config.color,
        },
        style,
      ]}
    />
  );
}
