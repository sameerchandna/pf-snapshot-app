import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../ui/theme/useTheme';

type SwipeActionVariant = 'edit' | 'delete' | 'rename' | 'reset';

type Props = {
  variant: SwipeActionVariant;
  onPress: () => void;
  accessibilityLabel: string;
  style?: any;
};

/**
 * SwipeAction component for swipe-to-reveal action buttons.
 * 
 * Premium filled full-height buttons with theme-aware colors.
 * - Full row height (44pt) for intentional feel
 * - Filled backgrounds (no transparent)
 * - Theme tokens only (no hardcoded colors)
 * - Pressed state feedback via opacity adjustment
 */
export default function SwipeAction({
  variant,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  const { theme } = useTheme();

  // Get icon name based on variant
  const getIconName = (): React.ComponentProps<typeof Feather>['name'] => {
    switch (variant) {
      case 'edit':
      case 'rename':
        return 'edit-2';
      case 'delete':
        return 'trash-2';
      case 'reset':
        return 'refresh-cw';
    }
  };

  // Determine if this is a delete action
  const isDelete = variant === 'delete';

  // Get background color from theme
  const backgroundColor = isDelete
    ? theme.colors.actions.delete.bg
    : theme.colors.actions.edit.bg;

  // Get icon color from theme
  const iconColor = isDelete
    ? theme.colors.actions.delete.icon
    : theme.colors.actions.edit.icon;

  // Pressed background from theme tokens
  const pressedBackground = isDelete
    ? theme.colors.actions.delete.bgPressed
    : theme.colors.actions.edit.bgPressed;

  const getPressedBackground = (pressed: boolean): string => {
    return pressed ? pressedBackground : backgroundColor;
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: getPressedBackground(pressed),
        },
        style,
      ]}
    >
      <Feather
        name={getIconName()}
        size={18}
        color={iconColor}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
