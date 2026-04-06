import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { spacing } from '../ui/spacing';
import SketchCircle from './SketchCircle';

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

const CIRCLE_SIZE = 30;

export default function EditorActionGroup({ onSave, onCancel, editingItemId }: EditorActionGroupProps) {
  const { theme } = useTheme();
  const palette = useScreenPalette();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onSave}
        style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
        accessibilityLabel={editingItemId ? 'Save' : 'Add'}
      >
        <SketchCircle
          size={CIRCLE_SIZE}
          fillColor={palette.sectionHeaderBg}
          borderColor={palette.accent}
        >
          <Text style={[theme.typography.button, { color: palette.accent }]}>✓</Text>
        </SketchCircle>
      </Pressable>

      <Pressable
        onPress={onCancel}
        style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
        accessibilityLabel={editingItemId ? 'Cancel' : 'Clear'}
      >
        <SketchCircle
          size={CIRCLE_SIZE}
          fillColor={theme.colors.bg.subtle}
          borderColor={palette.accent}
        >
          <Text style={[theme.typography.button, { color: palette.accent }]}>✕</Text>
        </SketchCircle>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
