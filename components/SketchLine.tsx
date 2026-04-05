import React, { useMemo } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Perpendicular extent of the SVG — accommodates wobbly variation
const CROSS = 16;

let instanceCounter = 0;

function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return (x - Math.floor(x)) * 2 - 1;
}

function wobblyEdge(
  x1: number, y1: number,
  x2: number, y2: number,
  seed: number,
  magnitude: number,
): string {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const cp1x = x1 + dx * 0.33 + nx * rand(seed) * magnitude;
  const cp1y = y1 + dy * 0.33 + ny * rand(seed) * magnitude;
  const cp2x = x1 + dx * 0.66 + nx * rand(seed + 1) * magnitude;
  const cp2y = y1 + dy * 0.66 + ny * rand(seed + 1) * magnitude;
  return `M ${x1} ${y1} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x2} ${y2}`;
}

interface SketchLineProps {
  length: number;
  color?: string;
  strokeWidth?: number;
  orientation?: 'horizontal' | 'vertical';
  style?: StyleProp<ViewStyle>;
}

export default function SketchLine({
  length,
  color = '#1e1e1e',
  strokeWidth = 1.5,
  orientation = 'vertical',
  style,
}: SketchLineProps) {
  const [seed] = React.useState(() => ++instanceCounter * 17 + 3333);
  const isVertical = orientation === 'vertical';
  const cx = CROSS / 2;

  const paths = useMemo(() => {
    const magnitude = 2.0;
    return [0, 1].map(pass => {
      const s = seed + pass * 53;
      return isVertical
        ? wobblyEdge(cx, 0, cx, length, s, magnitude)
        : wobblyEdge(0, cx, length, cx, s, magnitude);
    });
  }, [length, seed, isVertical, cx]);

  const svgWidth = isVertical ? CROSS : length;
  const svgHeight = isVertical ? length : CROSS;

  return (
    <View style={[{ width: svgWidth, height: svgHeight }, style]}>
      <Svg width={svgWidth} height={svgHeight}>
        {paths.map((d, i) => (
          <Path
            key={i}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </View>
  );
}
