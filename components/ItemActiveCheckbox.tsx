/**
 * ItemActiveCheckbox - Active/inactive toggle checkbox for financial items.
 * 
 * Extracted from FinancialItemRow for reuse in new row architecture.
 * Preserves exact styling and hit area from original implementation.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';

type Props = {
  isActive: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export default function ItemActiveCheckbox({
  isActive,
  onToggle,
  disabled = false,
}: Props) {
  const { theme } = useTheme();

  // Propagation guard: ensure checkbox press never triggers parent row press
  const handlePress = (e?: any) => {
    // Stop propagation if available (for web compatibility)
    if (e?.stopPropagation) {
      e.stopPropagation();
    }
    // Prevent default if available
    if (e?.preventDefault) {
      e.preventDefault();
    }
    onToggle();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [
        styles.checkbox,
        { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isActive }}
      accessibilityLabel={isActive ? 'Active' : 'Inactive'}
    >
      <View
        style={[
          styles.checkboxCircle,
          { borderColor: theme.colors.border.default },
          isActive
            ? { backgroundColor: theme.colors.brand.primary, borderColor: theme.colors.brand.primary }
            : null,
        ]}
      >
        {isActive ? (
          <Text
            style={[
              styles.checkboxCheckmark,
              theme.typography.caption,
              { fontWeight: '700', color: theme.colors.brand.onPrimary },
            ]}
          >
            ✓
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  checkbox: {
    marginLeft: 0,
    marginRight: spacing.tiny,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCheckmark: {
    // Typography via theme.typography.caption with fontWeight override
  },
});
