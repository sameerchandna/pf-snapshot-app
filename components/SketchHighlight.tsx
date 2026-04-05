import React, { useState } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

let instanceCounter = 0;

function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return (x - Math.floor(x)) * 2 - 1;
}

function buildPath(w: number, h: number, seed: number): string {
  const mag = 1.5;

  // Four corners with slight wobble
  const tlx = rand(seed)      * mag, tly = rand(seed + 1)  * mag;
  const trx = w + rand(seed + 2) * mag, try_ = rand(seed + 3) * mag;
  const brx = w + rand(seed + 4) * mag, bry = h + rand(seed + 5) * mag;
  const blx = rand(seed + 6)  * mag, bly = h + rand(seed + 7)  * mag;

  // Top and bottom edges are bezier curves for a subtle hand-drawn wobble
  const tcp1x = w * 0.35 + rand(seed + 8)  * mag, tcp1y = rand(seed + 9)  * mag;
  const tcp2x = w * 0.65 + rand(seed + 10) * mag, tcp2y = rand(seed + 11) * mag;
  const bcp1x = w * 0.65 + rand(seed + 12) * mag, bcp1y = h + rand(seed + 13) * mag;
  const bcp2x = w * 0.35 + rand(seed + 14) * mag, bcp2y = h + rand(seed + 15) * mag;

  return [
    `M ${tlx} ${tly}`,
    `C ${tcp1x} ${tcp1y} ${tcp2x} ${tcp2y} ${trx} ${try_}`,
    `L ${brx} ${bry}`,
    `C ${bcp1x} ${bcp1y} ${bcp2x} ${bcp2y} ${blx} ${bly}`,
    'Z',
  ].join(' ');
}

interface SketchHighlightProps {
  /** Fill colour — should be semi-transparent. Defaults to a yellow highlighter. */
  color?: string;
  /** How far the highlight bleeds past the content on each horizontal side */
  paddingH?: number;
  /** How far the highlight bleeds past the content on each vertical side */
  paddingV?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export default function SketchHighlight({
  color = 'rgba(255, 214, 0, 0.38)',
  paddingH = 7,
  paddingV = 3,
  style,
  children,
}: SketchHighlightProps) {
  const [seed] = React.useState(() => ++instanceCounter * 13 + 5555);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  return (
    <View style={[{ alignSelf: 'center' }, style]}>
      {size && (
        <View
          style={{
            position: 'absolute',
            left: -paddingH,
            top: -paddingV,
            zIndex: 0,
          }}
          pointerEvents="none"
        >
          <Svg
            width={size.width + paddingH * 2}
            height={size.height + paddingV * 2}
          >
            <Path
              d={buildPath(size.width + paddingH * 2, size.height + paddingV * 2, seed)}
              fill={color}
            />
          </Svg>
        </View>
      )}
      <View
        style={{ zIndex: 1 }}
        onLayout={e =>
          setSize({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          })
        }
      >
        {children}
      </View>
    </View>
  );
}
