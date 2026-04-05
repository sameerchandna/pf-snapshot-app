import React, { useMemo } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

let instanceCounter = 0;

function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * diverge — one source at top-center fans out to two endpoints at bottom-left and bottom-right (arrows at tips)
 * converge — two sources at top-left and top-right merge into one endpoint at bottom-center (arrow at tip)
 */
type BranchMode = 'diverge' | 'converge';

interface SketchBranchProps {
  /** Horizontal span of the V opening */
  width: number;
  /** Vertical span (stem height) */
  height: number;
  mode?: BranchMode;
  color?: string;
  strokeWidth?: number;
  arrowSize?: number;
  style?: StyleProp<ViewStyle>;
}

export default function SketchBranch({
  width,
  height,
  mode = 'diverge',
  color = '#1e1e1e',
  strokeWidth = 1.5,
  arrowSize = 7,
  style,
}: SketchBranchProps) {
  const [seed] = React.useState(() => ++instanceCounter * 17 + 7777);

  const paths = useMemo(() => {
    const result: string[] = [];
    const wobble = 2.0;
    const cx = width / 2;

    if (mode === 'diverge') {
      // Two arms from top-center (cx, 0) → bottom-left (0, height) and bottom-right (width, height)
      // Control points create a smooth outward curve (vertical near top, angled near bottom)
      for (let pass = 0; pass < 2; pass++) {
        const s = seed + pass * 37;

        // Left arm
        const lcp1x = cx     + rand(s)      * wobble;
        const lcp1y = height * 0.40 + rand(s + 1)  * wobble;
        const lcp2x = width  * 0.12 + rand(s + 2)  * wobble;
        const lcp2y = height * 0.82 + rand(s + 3)  * wobble;
        result.push(`M ${cx} 0 C ${lcp1x} ${lcp1y} ${lcp2x} ${lcp2y} 0 ${height}`);

        // Right arm
        const rcp1x = cx     + rand(s + 10) * wobble;
        const rcp1y = height * 0.40 + rand(s + 11) * wobble;
        const rcp2x = width  * 0.88 + rand(s + 12) * wobble;
        const rcp2y = height * 0.82 + rand(s + 13) * wobble;
        result.push(`M ${cx} 0 C ${rcp1x} ${rcp1y} ${rcp2x} ${rcp2y} ${width} ${height}`);
      }

      // Arrowheads — direction is tangent at t=1: (end - cp2)
      arrowHead(result, 0,     height, 0 - width * 0.12, height - height * 0.82, arrowSize, seed + 200, wobble);
      arrowHead(result, width, height, width - width * 0.88, height - height * 0.82, arrowSize, seed + 220, wobble);

    } else {
      // Two arms from top-left (0, 0) and top-right (width, 0) → bottom-center (cx, height)
      // Control points create a smooth inward curve (angled near top, vertical near bottom)
      for (let pass = 0; pass < 2; pass++) {
        const s = seed + pass * 37;

        // Left arm
        const lcp1x = width  * 0.12 + rand(s)      * wobble;
        const lcp1y = height * 0.18 + rand(s + 1)  * wobble;
        const lcp2x = cx     + rand(s + 2)          * wobble;
        const lcp2y = height * 0.60 + rand(s + 3)  * wobble;
        result.push(`M 0 0 C ${lcp1x} ${lcp1y} ${lcp2x} ${lcp2y} ${cx} ${height}`);

        // Right arm
        const rcp1x = width  * 0.88 + rand(s + 10) * wobble;
        const rcp1y = height * 0.18 + rand(s + 11) * wobble;
        const rcp2x = cx     + rand(s + 12)         * wobble;
        const rcp2y = height * 0.60 + rand(s + 13) * wobble;
        result.push(`M ${width} 0 C ${rcp1x} ${rcp1y} ${rcp2x} ${rcp2y} ${cx} ${height}`);
      }

      // Single arrowhead at bottom-center pointing down
      arrowHead(result, cx, height, 0, height * 0.40, arrowSize, seed + 200, wobble);
    }

    return result;
  }, [width, height, mode, arrowSize, seed]);

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

/** Draws two wobbly arrowhead wings at (ex, ey) pointing in direction (dx, dy). */
function arrowHead(
  result: string[],
  ex: number, ey: number,
  dx: number, dy: number,
  arrowSize: number,
  seed: number,
  wobble: number,
) {
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;   // unit: toward tip
  const nx = -uy,      ny = ux;         // perpendicular

  // Root of wings, back from tip
  const rx = ex - ux * arrowSize;
  const ry = ey - uy * arrowSize;
  const w  = arrowSize * 0.6;

  for (let wing = 0; wing < 2; wing++) {
    const sign = wing === 0 ? 1 : -1;
    // Slightly wobbly start point for the wing
    const sx = rx + nx * w * sign + rand(seed + wing * 7)     * wobble;
    const sy = ry + ny * w * sign + rand(seed + wing * 7 + 1) * wobble;
    // Slightly wobbly control points
    const cpx = (sx + ex) / 2 + rand(seed + wing * 7 + 2) * wobble * 0.5;
    const cpy = (sy + ey) / 2 + rand(seed + wing * 7 + 3) * wobble * 0.5;
    result.push(`M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`);
  }
}
