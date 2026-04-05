import React, { useState, useCallback, useMemo } from 'react';
import { View, ViewStyle, StyleProp, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

type Props = {
  children: React.ReactNode;
  borderColor?: string;
  fillColor?: string;
  fillOpacity?: number;
  strokeOpacity?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

// Deterministic pseudo-random in [-1, 1]
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return (x - Math.floor(x)) * 2 - 1;
}

// Bezier approximation factor for a 90° arc
const K = 0.5523;

// Open wobbly straight edge: M x1 y1 C ... x2 y2
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

// Open wobbly corner arc: cubic bezier with slight noise on ideal control points
function wobblyCornerArc(
  x0: number, y0: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x3: number, y3: number,
  seed: number,
  magnitude: number,
): string {
  const cm = magnitude * 0.3;
  return `M ${x0} ${y0} C ${cp1x + rand(seed) * cm} ${cp1y + rand(seed + 1) * cm} ${cp2x + rand(seed + 2) * cm} ${cp2y + rand(seed + 3) * cm} ${x3} ${y3}`;
}

// Returns all segment paths for 2 passes: 4 edges + 4 corner arcs, each as a separate open path
function buildSegmentPaths(w: number, h: number, r: number, seed: number): string[] {
  const magnitude = 2.0;
  const paths: string[] = [];

  for (let pass = 0; pass < 2; pass++) {
    const s = seed + pass * 53;

    // Straight edges
    paths.push(wobblyEdge(r,     0,     w - r, 0,     s + 1,  magnitude)); // top
    paths.push(wobblyEdge(w,     r,     w,     h - r, s + 2,  magnitude)); // right
    paths.push(wobblyEdge(w - r, h,     r,     h,     s + 3,  magnitude)); // bottom
    paths.push(wobblyEdge(0,     h - r, 0,     r,     s + 4,  magnitude)); // left

    // Corner arcs (ideal CP1/CP2 from 90° cubic bezier approximation)
    // TR: (w-r, 0) → (w, r)
    paths.push(wobblyCornerArc(w - r, 0,     w - r + r * K, 0,         w,         r - r * K, w,   r,   s + 10, magnitude));
    // BR: (w, h-r) → (w-r, h)
    paths.push(wobblyCornerArc(w,     h - r, w,             h - r + r * K, w - r + r * K, h, w-r, h,   s + 20, magnitude));
    // BL: (r, h) → (0, h-r)
    paths.push(wobblyCornerArc(r,     h,     r - r * K,     h,         0,         h - r + r * K, 0, h-r, s + 30, magnitude));
    // TL: (0, r) → (r, 0)
    paths.push(wobblyCornerArc(0,     r,     0,             r - r * K, r - r * K, 0,         r,   0,   s + 40, magnitude));
  }

  return paths;
}

let instanceCounter = 0;

export default function SketchCard({
  children,
  borderColor = '#1e1e1e',
  fillColor = '#ffffff',
  fillOpacity = 1,
  strokeOpacity = 1,
  borderRadius = 12,
  style,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [seed] = useState(() => ++instanceCounter * 17);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const BLEED = 6; // px of SVG overflow on each side — prevents edge clipping

  const render = useMemo(() => {
    const { width: w, height: h } = size;
    if (w === 0 || h === 0) return null;
    const r = Math.min(borderRadius, w * 0.45, h * 0.45);
    return { r, segments: buildSegmentPaths(w, h, r, seed) };
  }, [size.width, size.height, seed, borderRadius]);

  return (
    <View style={style} onLayout={onLayout}>
      {render ? (
        <Svg
          width={size.width + BLEED * 2}
          height={size.height + BLEED * 2}
          style={{ position: 'absolute', top: -BLEED, left: -BLEED }}
          pointerEvents="none"
          viewBox={`${-BLEED} ${-BLEED} ${size.width + BLEED * 2} ${size.height + BLEED * 2}`}
        >
          {/* Clean fill — coordinates match the card, not the expanded SVG */}
          <Rect
            x={0} y={0}
            width={size.width} height={size.height}
            rx={render.r} ry={render.r}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke="none"
          />
          {/* Double-stroke wobbly border — each segment its own Path */}
          {render.segments.map((d, i) => (
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
      ) : null}
      {children}
    </View>
  );
}
