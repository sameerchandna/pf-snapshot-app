import React from 'react';
import { View, ViewStyle, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Line } from 'react-native-svg';

type Props = {
  color?: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

// Deterministic pseudo-random from seed — no state, stable across renders
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export default function SketchBackground({ color = '#C8DCF0', children, style }: Props) {
  const { width, height } = useWindowDimensions();

  const lines = [];
  const gap = 14;
  const totalLines = Math.ceil((width + height) / gap) + 1;

  for (let i = 0; i < totalLines; i++) {
    const offset = i * gap;
    const opacity = 0.05 + rand(i) * 0.10;         // range 0.05–0.15
    const strokeWidth = 0.4 + rand(i * 3 + 7) * 0.9; // range 0.4–1.3

    // / direction (flipped from \)
    lines.push(
      <Line
        key={i}
        x1={offset}
        y1={0}
        x2={offset - height}
        y2={height}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#F7F6F2' }, style]}>
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {lines}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
