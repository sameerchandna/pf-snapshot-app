import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import SketchCircle from './SketchCircle';

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
  const palette = useScreenPalette();

  const getIconName = (): React.ComponentProps<typeof Ionicons>['name'] => {
    switch (variant) {
      case 'edit':
      case 'rename':
        return 'create-outline';
      case 'delete':
        return 'trash-outline';
      case 'reset':
        return 'refresh-outline';
    }
  };

  // Determine if this is a delete action
  const isDelete = variant === 'delete';

  // Delete stays destructive red; edit uses the screen's accent colour
  const iconColor = isDelete
    ? theme.colors.actions.delete.icon
    : palette.accent;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.container,
        { opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <SketchCircle
        size={34}
        borderColor={iconColor}
        fillColor="transparent"
        fillOpacity={0}
        strokeOpacity={0.7}
      >
        <Ionicons name={getIconName()} size={16} color={iconColor} />
      </SketchCircle>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    width: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },

});
