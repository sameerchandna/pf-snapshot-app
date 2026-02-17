/**
 * SemanticRow - Gesture-to-meaning adapter for row interactions.
 * 
 * NON-GOALS (what this component does NOT do):
 * - No business logic (no Snapshot mutations, no Scenario logic)
 * - No state management (no useState, no state mutations)
 * - No visual rendering (no action buttons, no placeholders)
 * - No navigation or modal logic
 * - No domain-specific terminology or behavior
 * 
 * This component maps gestures to semantic meaning:
 * - Tap gestures → onPress / onLongPress
 * - Swipe gestures → onRevealLeft / onRevealRight
 * 
 * It does NOT render visuals or perform business operations.
 * It only wires gesture events to semantic callbacks.
 * 
 * Composition order:
 *   Pressable (tap/long-press handling)
 *     └─ SwipeRowContainer (horizontal swipe handling)
 *         └─ children (RowVisual - pure visual)
 */

import React, { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import SwipeRowContainer from './SwipeRowContainer';

type SemanticRowProps = {
  children: ReactNode; // expects RowVisual

  // Tap semantics
  onPress?: () => void;
  onLongPress?: () => void;

  // Swipe semantics (meaning, not direction)
  onRevealLeft?: () => void;
  onRevealRight?: () => void;

  // Swipe action visuals (supplied by domain adapters)
  leftActions?: ReactNode;
  rightActions?: ReactNode;

  // Swipeable ref callback
  swipeableRef?: (ref: Swipeable | null) => void;

  // Swipeable coordination callbacks (for swipe coordination)
  onSwipeableWillOpen?: () => void;
  onSwipeableOpen?: () => void;
  onSwipeableClose?: () => void;

  // Controls
  swipeEnabled?: boolean;
  pressEnabled?: boolean;
};

export default function SemanticRow({
  children,
  onPress,
  onLongPress,
  onRevealLeft,
  onRevealRight,
  leftActions,
  rightActions,
  swipeableRef,
  onSwipeableWillOpen,
  onSwipeableOpen,
  onSwipeableClose,
  swipeEnabled = true,
  pressEnabled = true,
}: SemanticRowProps) {
  // Guard: Only wire gestures when semantic meaning exists
  const hasPressMeaning = !!(onPress || onLongPress);
  const hasSwipeMeaning = !!(onRevealLeft || onRevealRight);
  const hasSwipeActions = !!(leftActions || rightActions);

  // Map SwipeRowContainer's direction-based callback to semantic callbacks
  // This mapping occurs ONLY in SemanticRow
  // Only wire swipe intent if semantic meaning exists
  const handleSwipeIntent = hasSwipeMeaning
    ? (direction: 'left' | 'right') => {
        if (direction === 'left') {
          onRevealLeft?.();
        } else {
          onRevealRight?.();
        }
      }
    : undefined;

  return (
    <Pressable
      onPress={pressEnabled && hasPressMeaning ? onPress : undefined}
      onLongPress={pressEnabled && hasPressMeaning ? onLongPress : undefined}
      disabled={!pressEnabled}
    >
      <SwipeRowContainer
        onSwipeIntent={handleSwipeIntent}
        swipeableRef={swipeableRef}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableOpen={onSwipeableOpen}
        onSwipeableClose={onSwipeableClose}
        enabled={swipeEnabled && hasSwipeMeaning && hasSwipeActions}
        leftActions={leftActions}
        rightActions={rightActions}
      >
        {children}
      </SwipeRowContainer>
    </Pressable>
  );
}
