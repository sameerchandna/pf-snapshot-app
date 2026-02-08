import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import IconButton from './IconButton';

type SwipeActionVariant = 'edit' | 'delete' | 'rename' | 'reset';

type Props = {
  variant: SwipeActionVariant;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * SwipeAction component for swipe-to-reveal action buttons.
 * 
 * Wraps IconButton with swipe-action-specific styling.
 * Uses transparent backgrounds for lighter visual weight (icons feel secondary, not button-like).
 * Enforces 44x44 minimum touch targets (Apple HIG).
 * 
 * Uses IconButton internally for consistency while preserving swipe-action visual treatment.
 * 
 * Note: This component is maintained for backwards compatibility. For new code,
 * consider using IconButton directly with custom backgroundColor/pressedBackgroundColor props.
 */
export default function SwipeAction({
  variant,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  const { theme } = useTheme();

  // Get icon name based on variant
  const getIconName = () => {
    switch (variant) {
      case 'edit':
      case 'rename':
        return 'edit-2' as const;
      case 'delete':
        return 'trash-2' as const;
      case 'reset':
        return 'refresh-cw' as const;
    }
  };

  // Get variant for IconButton
  const getIconButtonVariant = (): 'neutral' | 'destructive' => {
    switch (variant) {
      case 'edit':
      case 'rename':
      case 'reset':
        return 'neutral';
      case 'delete':
        return 'destructive';
    }
  };

  // Get background colors based on variant
  // Swipe actions use transparent backgrounds for lighter visual weight
  const getBackgroundColor = (): string => {
    switch (variant) {
      case 'edit':
        return 'transparent'; // No background for lighter feel
      case 'delete':
        return 'transparent'; // No background, icon color provides destructive signal
      case 'rename':
        return 'transparent'; // Consistent with edit
      case 'reset':
        return 'transparent'; // Consistent with other actions
    }
  };

  // Get pressed background color (subtle feedback on press)
  const getPressedBackgroundColor = (): string => {
    switch (variant) {
      case 'edit':
        return theme.colors.bg.subtle; // Subtle neutral feedback
      case 'delete':
        return theme.colors.semantic.errorBg; // Subtle error tint for destructive action
      case 'rename':
        return theme.colors.bg.subtle; // Consistent with edit
      case 'reset':
        return theme.colors.semantic.warningBg; // Subtle warning tint
    }
  };

  return (
    <IconButton
      icon={getIconName()}
      size="md"
      variant={getIconButtonVariant()}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      backgroundColor={getBackgroundColor()}
      pressedBackgroundColor={getPressedBackgroundColor()}
      style={style}
    />
  );
}
