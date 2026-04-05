import React, { useState, useMemo } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

type Props = {
  size: number;
  children?: React.ReactNode;
  borderColor?: string;
  fillColor?: string;
  fillOpacity?: number;
  strokeOpacity?: number;
  style?: StyleProp<ViewStyle>;
};

// Deterministic pseudo-random in [-1, 1]
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return (x - Math.floor(x)) * 2 - 1;
}

// Bezier approximation factor for a 90° arc
const K = 0.5523;

// Wobbly cubic bezier arc: adds noise to the ideal control points
function wobblyArc(
  x0: number, y0: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x3: number, y3: number,
  seed: number,
  magnitude: number,
): string {
  const cm = magnitude * 0.5;
  return (
    `M ${x0} ${y0} C ` +
    `${cp1x + rand(seed) * cm} ${cp1y + rand(seed + 1) * cm} ` +
    `${cp2x + rand(seed + 2) * cm} ${cp2y + rand(seed + 3) * cm} ` +
    `${x3} ${y3}`
  );
}

// Returns 4 open arc paths (one per quadrant) for one pass around the circle
function buildCircleSegments(cx: number, cy: number, R: number, seed: number): string[] {
  const magnitude = 2.0;
  const paths: string[] = [];

  // Top-right: (cx, cy-R) → (cx+R, cy)
  paths.push(wobblyArc(
    cx,       cy - R,
    cx + K*R, cy - R,
    cx + R,   cy - K*R,
    cx + R,   cy,
    seed + 10, magnitude,
  ));
  // Bottom-right: (cx+R, cy) → (cx, cy+R)
  paths.push(wobblyArc(
    cx + R, cy,
    cx + R, cy + K*R,
    cx + K*R, cy + R,
    cx,     cy + R,
    seed + 20, magnitude,
  ));
  // Bottom-left: (cx, cy+R) → (cx-R, cy)
  paths.push(wobblyArc(
    cx,       cy + R,
    cx - K*R, cy + R,
    cx - R,   cy + K*R,
    cx - R,   cy,
    seed + 30, magnitude,
  ));
  // Top-left: (cx-R, cy) → (cx, cy-R)
  paths.push(wobblyArc(
    cx - R, cy,
    cx - R, cy - K*R,
    cx - K*R, cy - R,
    cx,     cy - R,
    seed + 40, magnitude,
  ));

  return paths;
}

let instanceCounter = 0;

export default function SketchCircle({
  size,
  children,
  borderColor = '#1e1e1e',
  fillColor = '#ffffff',
  fillOpacity = 1,
  strokeOpacity = 1,
  style,
}: Props) {
  const [seed] = useState(() => ++instanceCounter * 17);

  const BLEED = 6;
  const R = size / 2;
  const cx = R;
  const cy = R;

  const segments = useMemo(() => {
    // Two passes for a double-stroke hand-drawn feel
    return [
      ...buildCircleSegments(cx, cy, R, seed),
      ...buildCircleSegments(cx, cy, R, seed + 53),
    ];
  }, [cx, cy, R, seed]);

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Svg
        width={size + BLEED * 2}
        height={size + BLEED * 2}
        style={{ position: 'absolute', top: -BLEED, left: -BLEED }}
        pointerEvents="none"
        viewBox={`${-BLEED} ${-BLEED} ${size + BLEED * 2} ${size + BLEED * 2}`}
      >
        {/* Clean fill */}
        <Circle
          cx={cx} cy={cy} r={R}
          fill={fillColor}
          fillOpacity={fillOpacity}
          stroke="none"
        />
        {/* Double-stroke wobbly border */}
        {segments.map((d, i) => (
          <Path
            key={i}
            d={d}
            fill="none"
            stroke={borderColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        ))}
      </Svg>
      {children}
    </View>
  );
}
