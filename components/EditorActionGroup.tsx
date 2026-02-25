import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../spacing';

/**
 * Compact EditorActionGroup component for editor ADD/EDIT modes.
 * Replaces separate IconButtons with a segmented control-style container.
 * 
 * Provides a unified, bordered action group with save and cancel buttons.
 * Visual height: 36px (85-90% of input height ~40px)
 * Tap target height: 44pt (Apple HIG minimum)
 */
type EditorActionGroupProps = {
  onSave: () => void;
  onCancel: () => void;
  editingItemId: string | null;
};

export default function EditorActionGroup({ onSave, onCancel, editingItemId }: EditorActionGroupProps) {
  const { theme } = useTheme();
  
  // Visual control height: 36px (85-90% of input height ~40px)
  const visualHeight = 36;
  // Tap target height: 44pt (Apple HIG minimum)
  const tapTargetHeight = 44;
  
  return (
    <View
      style={[
        styles.outerWrapper,
        {
          height: tapTargetHeight,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <View
        style={[
          styles.innerControl,
          {
            height: visualHeight,
            minWidth: 72,
            borderWidth: 1,
            borderColor: theme.colors.border.subtle,
            borderRadius: theme.radius.base,
            flexDirection: 'row',
            overflow: 'hidden',
          },
        ]}
      >
        <Pressable
          onPress={onSave}
          style={({ pressed }) => [
            styles.confirmButton,
            {
              height: visualHeight,
              backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
              borderTopLeftRadius: theme.radius.base,
              borderBottomLeftRadius: theme.radius.base,
            },
          ]}
          accessibilityLabel={editingItemId ? 'Save' : 'Add'}
        >
          <Feather name="check" size={16} color={theme.colors.semantic.success} />
        </Pressable>
        
        <View style={[styles.divider, { backgroundColor: theme.colors.border.default, height: visualHeight }]} />
        
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.confirmButton,
            {
              height: visualHeight,
              backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
              borderTopRightRadius: theme.radius.base,
              borderBottomRightRadius: theme.radius.base,
            },
          ]}
          accessibilityLabel={editingItemId ? 'Cancel' : 'Clear'}
        >
          <Feather name="x" size={16} color={theme.colors.text.secondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    // 44pt tap target wrapper - centers the 36px visual control
  },
  innerControl: {
    // 36px visual segmented control
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  divider: {
    width: 1,
  },
});
