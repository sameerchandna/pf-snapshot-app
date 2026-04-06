import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import Icon, { type IconName } from './Icon';

type RowActionIconVariant = 'save' | 'cancel' | 'add' | 'edit' | 'delete';

type Props = {
  variant: RowActionIconVariant;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  size?: 'small' | 'base';
  showBorder?: boolean; // For add variant only
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<ViewStyle>; // For save variant text checkmark typography
};

/**
 * @deprecated Use IconButton instead. This component is maintained for backwards compatibility
 * but all new code should use IconButton with appropriate variant and size.
 * 
 * RowActionIcon component for standardized row-level action buttons.
 * 
 * Enforces 44x44 minimum touch targets (Apple HIG) and provides
 * consistent icon sizing and colors for inline actions.
 * 
 * Supports text checkmark for save variant and optional border circle
 * for add variant to preserve existing visual treatments.
 */
export default function RowActionIcon({
  variant,
  onPress,
  disabled = false,
  accessibilityLabel,
  size = 'base',
  showBorder = false,
  style,
  textStyle,
}: Props) {
  const { theme } = useTheme();

  // Get icon name based on variant
  const getIconName = (): IconName | null => {
    switch (variant) {
      case 'save':
        return null; // Uses text checkmark instead
      case 'cancel':
        return 'close-outline';
      case 'add':
        return 'add-outline';
      case 'edit':
        return 'create-outline';
      case 'delete':
        return 'trash-outline';
    }
  };

  // Get icon color based on variant
  const getIconColor = (): string => {
    switch (variant) {
      case 'save':
        return theme.colors.semantic.successText; // For text checkmark
      case 'cancel':
        return theme.colors.text.tertiary;
      case 'add':
        return theme.colors.text.muted;
      case 'edit':
        return theme.colors.text.tertiary;
      case 'delete':
        return theme.colors.text.primary;
    }
  };

  // Get background color based on variant and pressed state
  const getBackgroundColor = (pressed: boolean): string => {
    switch (variant) {
      case 'save':
        return pressed ? theme.colors.semantic.successBorder : theme.colors.semantic.successBg;
      case 'cancel':
        return pressed ? theme.colors.border.default : theme.colors.bg.subtle;
      case 'add':
        return pressed ? theme.colors.bg.subtlePressed : 'transparent';
      case 'edit':
      case 'delete':
        return 'transparent';
    }
  };

  // Get typography style for save checkmark
  const getSaveTypography = () => {
    // Use sectionTitle for top editor, valueLarge for inline editor
    // Default to sectionTitle (can be overridden via style prop)
    return theme.typography.sectionTitle;
  };

  const iconName = getIconName();
  const iconColor = getIconColor();
  const iconSize = size === 'small' ? 'small' : 'base';

  const content = variant === 'save' ? (
    <Text style={[getSaveTypography(), { fontWeight: '700', color: iconColor }, textStyle]}>✓</Text>
  ) : (
    <Icon name={iconName!} size={iconSize} color={iconColor} />
  );

  // For add variant with border, wrap icon in border circle
  const wrappedContent = variant === 'add' && showBorder ? (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: theme.radius.large,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }}
    >
      {content}
    </View>
  ) : (
    content
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => {
        const baseStyle = {
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          backgroundColor: getBackgroundColor(pressed),
        };
        // If style prop provides backgroundColor, it will override baseStyle
        return [baseStyle, style];
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      {wrappedContent}
    </Pressable>
  );
}
