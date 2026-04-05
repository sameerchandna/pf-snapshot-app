import React, { useMemo } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

let instanceCounter = 0;

function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return (x - Math.floor(x)) * 2 - 1;
}

function arrowHead(
  result: string[],
  ex: number, ey: number,
  dx: number, dy: number,
  arrowSize: number,
  seed: number,
  wobble: number,
) {
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;

  const rx = ex - ux * arrowSize;
  const ry = ey - uy * arrowSize;
  const w = arrowSize * 0.6;

  for (let wing = 0; wing < 2; wing++) {
    const sign = wing === 0 ? 1 : -1;
    const sx = rx + nx * w * sign + rand(seed + wing * 7) * wobble;
    const sy = ry + ny * w * sign + rand(seed + wing * 7 + 1) * wobble;
    const cpx = (sx + ex) / 2 + rand(seed + wing * 7 + 2) * wobble * 0.5;
    const cpy = (sy + ey) / 2 + rand(seed + wing * 7 + 3) * wobble * 0.5;
    result.push(`M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`);
  }
}

interface SketchCurvedArrowProps {
  /** Width of the SVG container */
  width: number;
  /** Height of the SVG container */
  height: number;
  /** Start point [x, y] in SVG coordinates. Defaults to [width/2, 0] (top-center). */
  from?: [number, number];
  /** End point [x, y] in SVG coordinates. Defaults to [width/2, height] (bottom-center). */
  to?: [number, number];
  /**
   * How much the arc bows sideways, relative to the from→to direction.
   * Positive = bows to the right of the direction of travel (convex from left).
   * Negative = bows to the left (concave from left).
   * Suggested range: ±0.2 (gentle) to ±0.6 (pronounced). Default: 0.35.
   */
  curvature?: number;
  color?: string;
  strokeWidth?: number;
  arrowSize?: number;
  style?: StyleProp<ViewStyle>;
}

export default function SketchCurvedArrow({
  width,
  height,
  from,
  to,
  curvature = 0.35,
  color = '#1e1e1e',
  strokeWidth = 1.5,
  arrowSize = 7,
  style,
}: SketchCurvedArrowProps) {
  const [seed] = React.useState(() => ++instanceCounter * 17 + 8888);

  const fromX = from ? from[0] : width / 2;
  const fromY = from ? from[1] : 0;
  const toX   = to   ? to[0]   : width / 2;
  const toY   = to   ? to[1]   : height;

  const paths = useMemo(() => {
    const dx = toX - fromX, dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // Perpendicular unit vector — right of the from→to direction
    const px = -dy / len, py = dx / len;
    const bend = curvature * len;

    // Single control point at the arc midpoint, bowed perpendicularly
    const cpx = fromX + dx * 0.5 + px * bend;
    const cpy = fromY + dy * 0.5 + py * bend;

    // Tangent at t=1 for quadratic bezier: direction from cp → tip
    const tdx = toX - cpx, tdy = toY - cpy;
    const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;

    // Shorten the body endpoint so the arrowhead tip lands exactly on (toX, toY)
    const ex = toX - (tdx / tlen) * arrowSize;
    const ey = toY - (tdy / tlen) * arrowSize;

    const wobble = 2.0;
    const result: string[] = [];

    // Two wobbly passes for the body
    for (let pass = 0; pass < 2; pass++) {
      const s = seed + pass * 53;
      const wcpx = cpx + rand(s) * wobble;
      const wcpy = cpy + rand(s + 1) * wobble;
      result.push(`M ${fromX} ${fromY} Q ${wcpx} ${wcpy} ${ex} ${ey}`);
    }

    // Arrowhead at tip, oriented along the arc tangent
    arrowHead(result, toX, toY, tdx, tdy, arrowSize, seed + 200, wobble);

    return result;
  }, [fromX, fromY, toX, toY, curvature, arrowSize, seed]);

  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
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
