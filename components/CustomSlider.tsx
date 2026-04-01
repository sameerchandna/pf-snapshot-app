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
import { useTheme } from '../ui/theme/useTheme';

const PADDING_H = 11; // half of thumb width — geometric alignment

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
  const { theme } = useTheme();
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
  const fillPct = max > min ? ((value - min) / (max - min)) * 100 : 0;

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
      <View
        style={[styles.track, { backgroundColor: trackBgColor }]}
        onLayout={handleTrackLayout}
      >
        <View
          style={[
            styles.fill,
            { width: `${fillPct}%` as any, backgroundColor: trackColor },
          ]}
        />
        <View
          style={[
            styles.thumb,
            { left: thumbPos - PADDING_H, backgroundColor: thumbColor, borderColor: trackColor, shadowColor: theme.colors.shadow.color, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 },
          ]}
        />
      </View>
    </View>
  );

  if (!showSteppers) return track;

  return (
    <View style={styles.stepperRow}>
      <Pressable
        onPress={handleDecrement}
        disabled={value <= min}
        style={[
          styles.stepperBtn,
          { borderColor: trackBgColor },
        ]}
        hitSlop={8}
      >
        <Text style={[styles.stepperSymbol, { color: value <= min ? trackBgColor : activeStepperColor }]}>
          −
        </Text>
      </Pressable>

      {track}

      <Pressable
        onPress={handleIncrement}
        disabled={value >= max}
        style={[
          styles.stepperBtn,
          { borderColor: trackBgColor },
        ]}
        hitSlop={8}
      >
        <Text style={[styles.stepperSymbol, { color: value >= max ? trackBgColor : activeStepperColor }]}>
          +
        </Text>
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
  track: {
    height: 4,
    borderRadius: 2, // geometric: height / 2
    position: 'relative',
  },
  fill: {
    height: 4,
    borderRadius: 2, // geometric: height / 2
  },
  thumb: {
    position: 'absolute',
    top: -9,
    width: 22,
    height: 22,
    borderRadius: 11, // geometric: width / 2
    borderWidth: 2,
    // Shadow applied dynamically via inline style (needs theme token)
    elevation: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16, // geometric: width / 2
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: {
    ...typography.valueLarge,
    fontWeight: '400',
    includeFontPadding: false,
  },
});
