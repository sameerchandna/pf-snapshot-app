import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../ui/theme/useTheme';
import { layout } from '../../layout';
import { spacing } from '../../spacing';
import IconButton from '../IconButton';

type AddEntryVariant = 'icon' | 'row' | 'button';

type Props = {
  onPress: () => void;
  label?: string; // e.g., "+ Add new profile", "+ Add group"
  variant?: AddEntryVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Canonical "add item" affordance component.
 * 
 * Emits intent only via onPress callback - no mutation logic.
 * 
 * Variants:
 * - icon: Header-style plus icon (matches CashflowCardWrapper pattern)
 * - row: Footer-style text row with border-top (matches Profiles/Scenarios pattern)
 * - button: Footer-style button with border (matches EditableCollectionScreen "Add group" pattern)
 * 
 * All variants use theme tokens exclusively and match existing visual patterns.
 */
export default function AddEntry({
  onPress,
  label = '+ Add',
  variant = 'row',
  disabled = false,
  style,
  accessibilityLabel,
}: Props) {
  const { theme } = useTheme();

  if (variant === 'icon') {
    // Header icon variant (matches CashflowCardWrapper)
    return (
      <IconButton
        icon="plus"
        size="md"
        variant="default"
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel || 'Add'}
        style={[
          {
            alignSelf: 'center',
            transform: [{ translateY: -4 }],
          },
          style,
        ]}
      />
    );
  }

  if (variant === 'button') {
    // Button variant (matches EditableCollectionScreen "Add group")
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          {
            alignSelf: 'flex-start',
            paddingHorizontal: layout.buttonPaddingHorizontal,
            paddingVertical: layout.buttonPadding,
            borderWidth: 1,
            borderColor: theme.colors.border.default,
            borderRadius: theme.radius.medium,
            backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
          },
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{ disabled }}
      >
        <Text
          style={[
            theme.typography.button,
            { color: disabled ? theme.colors.text.disabled : theme.colors.text.secondary },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  // Row variant (default, matches Profiles/Scenarios pattern)
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingHorizontal: layout.rowPaddingHorizontal,
          paddingVertical: layout.rowPaddingVertical,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.subtle,
          marginTop: spacing.base,
          backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled }}
    >
      <Text
        style={[
          theme.typography.value,
          { color: disabled ? theme.colors.text.disabled : theme.colors.brand.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
