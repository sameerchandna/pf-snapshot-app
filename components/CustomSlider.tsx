// CustomSlider — extracted from ScenarioExplorerScreen (Phase 13.3)
//
// Simple custom slider using PanResponder (no external package needed).
// Renders a track + fill + thumb, with optional stepper buttons.
// Caller supplies all colours.
//
// All props are stored in refs so the PanResponder is created exactly once
// (empty deps). This avoids mid-gesture recreation which causes jitter.

import React, { useRef, useMemo, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing } from '../ui/spacing';
import { typography } from '../ui/theme/theme';
import SketchCircle from './SketchCircle';
import SketchLine from './SketchLine';

const PADDING_H = 11;  // half of thumb width — geometric alignment
const THUMB_SIZE = 22;
const TRACK_H = 16;    // SketchLine perpendicular height (CROSS constant)

export type CustomSliderProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (value: number) => void;
  trackColor: string;
  thumbColor: string;
  trackBgColor: string;
  /** Show − / + step buttons on either side of the slider */
  showSteppers?: boolean;
  /** Color for the stepper button symbols and border — defaults to trackColor */
  stepperColor?: string;
};

export default function CustomSlider({
  min,
  max,
  step,
  value,
  onValueChange,
  trackColor,
  thumbColor,
  trackBgColor,
  showSteppers = false,
  stepperColor,
}: CustomSliderProps) {
  const trackWidthRef = useRef<number>(0);
  const [trackWidth, setTrackWidth] = useState<number>(0);

  // --- Refs for all props so PanResponder never needs to be recreated ---
  const minRef = useRef(min);
  const maxRef = useRef(max);
  const stepRef = useRef(step);
  const onValueChangeRef = useRef(onValueChange);
  minRef.current = min;
  maxRef.current = max;
  stepRef.current = step;
  onValueChangeRef.current = onValueChange;

  // Live ref for current value — used in onPanResponderGrant to detect thumb tap
  const valueRef = useRef<number>(value);
  valueRef.current = value;

  // Value at gesture start — onPanResponderMove adds dx relative to this.
  const startValueRef = useRef<number>(value);

  const clampAndSnap = (rawValue: number): number => {
    const s = stepRef.current;
    const lo = minRef.current;
    const hi = maxRef.current;
    const snapped = Math.round((rawValue - lo) / s) * s + lo;
    return Math.max(lo, Math.min(hi, snapped));
  };

  const thumbPos = trackWidth === 0 ? 0 : ((value - min) / (max - min)) * trackWidth;
  const fillWidth = thumbPos; // same as thumbPos in px

  // Created once — all mutable state accessed via refs.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: evt => {
          const tw = trackWidthRef.current;
          const lo = minRef.current;
          const hi = maxRef.current;
          const range = hi - lo;

          // Where the current thumb sits (px from container left)
          const currentThumbCenter =
            tw > 0 ? PADDING_H + ((valueRef.current - lo) / range) * tw : 0;

          const touchX = evt.nativeEvent.locationX;

          // If touch is near the thumb, just start dragging from current value
          // (avoids jump when locationX is relative to the thumb, not container)
          if (Math.abs(touchX - currentThumbCenter) < 22) {
            startValueRef.current = valueRef.current;
            return;
          }

          // Tap elsewhere on track — jump to that position
          const x = touchX - PADDING_H;
          const clamped = Math.max(0, Math.min(tw, x));
          const rawValue = tw > 0 ? lo + (clamped / tw) * range : lo;
          const snapped = clampAndSnap(rawValue);
          startValueRef.current = snapped;
          onValueChangeRef.current(snapped);
        },
        onPanResponderMove: (_, gestureState) => {
          const tw = trackWidthRef.current;
          if (tw === 0) return;
          const range = maxRef.current - minRef.current;
          const rawValue = startValueRef.current + (gestureState.dx / tw) * range;
          onValueChangeRef.current(clampAndSnap(rawValue));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // stable — never recreated
  );

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidthRef.current = w;
    setTrackWidth(w);
  };

  const handleDecrement = () => onValueChange(clampAndSnap(value - step));
  const handleIncrement = () => onValueChange(clampAndSnap(value + step));

  const activeStepperColor = stepperColor ?? trackColor;

  const track = (
    <View
      style={[styles.container, showSteppers && styles.containerFlex]}
      {...panResponder.panHandlers}
    >
      <View style={styles.trackArea} onLayout={handleTrackLayout}>
        {trackWidth > 0 && (
          <>
            <SketchLine length={trackWidth} color={trackBgColor} strokeWidth={2} orientation="horizontal" />
            {fillWidth > 2 && (
              <SketchLine
                length={fillWidth}
                color={trackColor}
                strokeWidth={2.5}
                orientation="horizontal"
                style={styles.trackFill}
              />
            )}
            <SketchCircle
              size={THUMB_SIZE}
              borderColor={trackColor}
              fillColor={thumbColor}
              style={[styles.thumbSketch, { left: thumbPos - THUMB_SIZE / 2 }]}
            />
          </>
        )}
      </View>
    </View>
  );

  if (!showSteppers) return track;

  return (
    <View style={styles.stepperRow}>
      <Pressable onPress={handleDecrement} disabled={value <= min} hitSlop={8}>
        <SketchCircle
          size={24}
          borderColor={activeStepperColor}
          fillColor="transparent"
          strokeOpacity={value <= min ? 0.2 : 1}
        >
          <Text style={[styles.stepperSymbol, { color: value <= min ? trackBgColor : activeStepperColor }]}>
            −
          </Text>
        </SketchCircle>
      </Pressable>

      {track}

      <Pressable onPress={handleIncrement} disabled={value >= max} hitSlop={8}>
        <SketchCircle
          size={24}
          borderColor={activeStepperColor}
          fillColor="transparent"
          strokeOpacity={value >= max ? 0.2 : 1}
        >
          <Text style={[styles.stepperSymbol, { color: value >= max ? trackBgColor : activeStepperColor }]}>
            +
          </Text>
        </SketchCircle>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: PADDING_H,
  },
  containerFlex: {
    flex: 1,
  },
  trackArea: {
    height: TRACK_H,
    position: 'relative',
  },
  trackFill: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  thumbSketch: {
    position: 'absolute',
    top: -(THUMB_SIZE - TRACK_H) / 2, // = -3, centres thumb on line
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepperSymbol: {
    ...typography.value,
    lineHeight: typography.value.fontSize,
    includeFontPadding: false,
  },
});
