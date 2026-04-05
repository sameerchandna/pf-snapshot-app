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

type Direction = 'down' | 'up' | 'right' | 'left';

interface SketchArrowProps {
  length: number;
  direction?: Direction;
  color?: string;
  strokeWidth?: number;
  arrowSize?: number;
  style?: StyleProp<ViewStyle>;
}

export default function SketchArrow({
  length,
  direction = 'down',
  color = '#1e1e1e',
  strokeWidth = 1.5,
  arrowSize = 7,
  style,
}: SketchArrowProps) {
  const [seed] = React.useState(() => ++instanceCounter * 17 + 6666);
  const cx = CROSS / 2;
  const isVertical = direction === 'down' || direction === 'up';

  const paths = useMemo(() => {
    const magnitude = 2.0;
    const headMag = 0.8;
    const result: string[] = [];

    // Body — two wobbly passes, stopping short of the tip
    if (direction === 'down') {
      result.push(wobblyEdge(cx, 0,      cx, length - arrowSize, seed,      magnitude));
      result.push(wobblyEdge(cx, 0,      cx, length - arrowSize, seed + 53, magnitude));
      // Arrowhead wings
      result.push(wobblyEdge(cx - arrowSize * 0.6, length - arrowSize, cx, length, seed + 100, headMag));
      result.push(wobblyEdge(cx + arrowSize * 0.6, length - arrowSize, cx, length, seed + 110, headMag));
    } else if (direction === 'up') {
      result.push(wobblyEdge(cx, length, cx, arrowSize,           seed,      magnitude));
      result.push(wobblyEdge(cx, length, cx, arrowSize,           seed + 53, magnitude));
      result.push(wobblyEdge(cx - arrowSize * 0.6, arrowSize, cx, 0,         seed + 100, headMag));
      result.push(wobblyEdge(cx + arrowSize * 0.6, arrowSize, cx, 0,         seed + 110, headMag));
    } else if (direction === 'right') {
      result.push(wobblyEdge(0, cx,      length - arrowSize, cx, seed,      magnitude));
      result.push(wobblyEdge(0, cx,      length - arrowSize, cx, seed + 53, magnitude));
      result.push(wobblyEdge(length - arrowSize, cx - arrowSize * 0.6, length, cx, seed + 100, headMag));
      result.push(wobblyEdge(length - arrowSize, cx + arrowSize * 0.6, length, cx, seed + 110, headMag));
    } else {
      // left
      result.push(wobblyEdge(length, cx, arrowSize, cx,           seed,      magnitude));
      result.push(wobblyEdge(length, cx, arrowSize, cx,           seed + 53, magnitude));
      result.push(wobblyEdge(arrowSize, cx - arrowSize * 0.6, 0, cx,         seed + 100, headMag));
      result.push(wobblyEdge(arrowSize, cx + arrowSize * 0.6, 0, cx,         seed + 110, headMag));
    }

    return result;
  }, [length, direction, arrowSize, seed, cx]);

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
