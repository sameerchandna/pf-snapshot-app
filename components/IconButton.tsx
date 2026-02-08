import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import Icon, { type IconName } from './Icon';

type IconButtonSize = 'sm' | 'md' | 'lg';
type IconButtonVariant = 'default' | 'primary' | 'neutral' | 'success' | 'destructive';
type IconButtonShape = 'circular' | 'rounded';

type Props = {
  icon: IconName;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  shape?: IconButtonShape;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  pressedBackgroundColor?: string; // Override default pressed background color
  backgroundColor?: string; // Override default background color
};

/**
 * Size configuration: maps IconButton size to visible circle size and icon size.
 * Tap target is always 44x44px (Apple HIG), but visible circle is smaller and centered.
 */
const SIZE_CONFIG: Record<IconButtonSize, { 
  circleSize: number; // Visible circle diameter
  iconSize: 'tiny' | 'small' | 'base' | 'large'; // Icon glyph size
}> = {
  sm: { circleSize: 24, iconSize: 'tiny' },  // 24px circle, 12px icon (smaller than md)
  md: { circleSize: 28, iconSize: 'small' },  // 28px circle, 14px icon (baseline)
  lg: { circleSize: 32, iconSize: 'base' }, // 32px circle, 16px icon (larger than md)
};

/**
 * IconButton component for interactive icon surfaces.
 * 
 * Provides consistent 44x44px hit area (Apple HIG) with smaller visible circle.
 * The visible circle is centered within the tap target for reduced visual weight.
 * 
 * Uses theme colors exclusively (no opacity hacks) for dark mode compatibility.
 * Defaults to circular shape for visual consistency.
 */
export default function IconButton({
  icon,
  size = 'md',
  variant = 'default',
  shape = 'circular',
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
  pressedBackgroundColor,
  backgroundColor,
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
      case 'neutral':
        return theme.colors.text.secondary;
      case 'success':
        return theme.colors.semantic.success;
      case 'destructive':
        return theme.colors.semantic.error;
      default:
        return theme.colors.text.secondary;
    }
  };

  // Get border radius for visible circle
  const getBorderRadius = (): number => {
    if (shape === 'circular') {
      return sizeConfig.circleSize / 2; // Full circle
    }
    return theme.radius.medium;
  };

  // For smaller sizes, use more subtle border or no border if background is provided
  const shouldShowBorder = size !== 'sm' || backgroundColor === undefined;
  const borderColor = shouldShowBorder ? theme.colors.border.subtle : 'transparent';

  const iconColor = getIconColor();
  const borderRadius = getBorderRadius();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
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
      {({ pressed }) => (
        <View
          style={[
            {
              width: sizeConfig.circleSize,
              height: sizeConfig.circleSize,
              borderRadius,
              borderWidth: shouldShowBorder ? 1 : 0,
              borderColor,
              backgroundColor: pressed
                ? (pressedBackgroundColor ?? 'transparent')
                : (backgroundColor ?? 'transparent'),
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Icon name={icon} size={sizeConfig.iconSize} color={iconColor} />
        </View>
      )}
    </Pressable>
  );
}
