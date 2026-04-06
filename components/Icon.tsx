import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/theme/useTheme';

type IconSize = 'tiny' | 'small' | 'base' | 'medium' | 'large';
export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  name: IconName;
  size?: IconSize;
  color?: string;
  style?: StyleProp<TextStyle>;
};

const SIZE_MAP: Record<IconSize, number> = {
  tiny: 12,
  small: 14,
  base: 16,
  medium: 18,
  large: 24,
};

/**
 * Icon wrapper component for Feather icons with theme-aware defaults.
 * 
 * Provides consistent sizing and coloring across the app.
 * Defaults to base size (16px) and secondary text color from theme.
 * 
 * Feather icons are stroke-based (outline-only) by default - no fill.
 * For interactive icons, use IconButton component instead.
 */
export default function Icon({ name, size = 'base', color, style }: Props) {
  const { theme } = useTheme();
  
  const iconSize = SIZE_MAP[size];
  const iconColor = color ?? theme.colors.text.secondary;
  
  return (
    <Ionicons
      name={name}
      size={iconSize}
      color={iconColor}
      style={style}
    />
  );
}
