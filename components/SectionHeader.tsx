import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { typography } from '../ui/theme/theme';
import { useScreenPalette } from '../ui/theme/palettes';
import { layout } from '../ui/layout';
import SketchCard from './SketchCard';

type Props = {
  title: string;
  subtitle?: string;
};

export default function SectionHeader({ title }: Props) {
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
});
