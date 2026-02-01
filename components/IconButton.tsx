import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import Icon, { type IconName } from './Icon';

type IconButtonSize = 'small' | 'base' | 'large';
type IconButtonVariant = 'default' | 'primary' | 'destructive';

type Props = {
  icon: IconName;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Size configuration: maps IconButton size to Icon size and padding.
 * Padding ensures 44x44 minimum hit target (Apple HIG).
 */
const SIZE_CONFIG: Record<IconButtonSize, { iconSize: 'small' | 'base' | 'large'; padding: number }> = {
  small: { iconSize: 'small', padding: 15 },  // 14px icon + 30px padding = 44px
  base: { iconSize: 'base', padding: 14 },    // 16px icon + 28px padding = 44px
  large: { iconSize: 'large', padding: 10 },  // 24px icon + 20px padding = 44px
};

/**
 * IconButton component for interactive icon surfaces.
 * 
 * Provides consistent hit area, pressed feedback, and accessibility.
 * Wraps the Icon component with Pressable interaction.
 * 
 * Uses theme colors exclusively (no opacity hacks) for dark mode compatibility.
 */
export default function IconButton({
  icon,
  size = 'base',
  variant = 'default',
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: Props) {
  const { theme } = useTheme();
  const sizeConfig = SIZE_CONFIG[size];

  // Get icon color based on variant and disabled state
  const getIconColor = (): string => {
    if (disabled) {
      return theme.colors.text.disabled;
    }
    switch (variant) {
      case 'primary':
        return theme.colors.brand.primary;
      case 'destructive':
        return theme.colors.semantic.error;
      default:
        return theme.colors.text.secondary;
    }
  };

  const iconColor = getIconColor();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          padding: sizeConfig.padding,
          borderRadius: theme.radius.medium,
          backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Icon name={icon} size={sizeConfig.iconSize} color={iconColor} />
    </Pressable>
  );
}
