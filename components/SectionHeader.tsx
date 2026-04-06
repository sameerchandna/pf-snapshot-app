import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography } from '../ui/theme/theme';
import { useScreenPalette } from '../ui/theme/palettes';
import { layout } from '../ui/layout';
import SketchCard from './SketchCard';

type Props = {
  title: string;
  subtitle?: string;
  rightAccessory?: React.ReactNode;
};

export default function SectionHeader({ title, rightAccessory }: Props) {
  const palette = useScreenPalette();
  return (
    <SketchCard
      fillColor={palette.sectionHeaderBg}
      borderColor={palette.sectionHeaderBg}
      fillOpacity={0.5}
      strokeOpacity={0.1}
      borderRadius={4}
      style={styles.bar}
    >
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {rightAccessory ? (
        <View style={styles.rightAccessory}>{rightAccessory}</View>
      ) : null}
    </SketchCard>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: layout.sectionTitleBottom,
  },
  title: {
    ...typography.medium,
  },
  rightAccessory: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
