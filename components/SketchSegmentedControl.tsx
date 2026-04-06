import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import SketchCard from './SketchCard';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { radius, typography } from '../ui/theme/theme';

type Props = {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};

export default function SketchSegmentedControl({ values, selectedIndex, onChange, style }: Props) {
  const { theme } = useTheme();
  const palette = useScreenPalette();

  return (
    <SketchCard
      borderColor={palette.accent}
      fillColor={theme.colors.bg.card}
      borderRadius={radius.large}
      style={[styles.card, style]}
    >
      <View style={styles.row}>
        {values.map((value, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Pressable key={value} onPress={() => onChange(index)} style={styles.segment}>
              <Text
                style={[
                  typography.body,
                  {
                    color: isSelected ? palette.accent : theme.colors.text.disabled,
                    textAlign: 'center',
                  },
                ]}
              >
                {value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SketchCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 0,
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: layout.inputPadding,
    paddingHorizontal: spacing.xs,
  },
});
