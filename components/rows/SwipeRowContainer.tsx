/**
 * SwipeRowContainer - Gesture container for horizontal swipe interactions.
 * 
 * NON-GOALS (what this component does NOT do):
 * - No business logic (no Snapshot mutations, no Scenario logic)
 * - No state management (no useState, no state mutations)
 * - No visual styling beyond layout and translation
 * - No opacity, scale, or visual mutation of children
 * - No vertical gesture handling (vertical scroll must not be blocked)
 * 
 * This component owns horizontal swipe gestures only.
 * It wraps children (expects RowVisual) and reveals optional action buttons
 * behind the row when swiped horizontally.
 * 
 * Behavior:
 * - Foreground (children) translates on X-axis during swipe
 * - Background (actions) remains static and is revealed as foreground moves
 * - Emits semantic intent only: onSwipeIntent('left' | 'right')
 * - Does not mutate state or perform business operations
 */

import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { spacing } from '../../spacing';

// Swipe gesture configuration constants
const SWIPE_ACTIVE_OFFSET_X = 10; // Minimum horizontal movement to activate swipe (px)
const SWIPE_FAIL_OFFSET_Y = 5; // Maximum vertical movement before swipe fails (px)
const SWIPE_OPEN_THRESHOLD = 30; // Distance to trigger swipe reveal (px)
const SWIPE_FRICTION = 2; // Friction coefficient for swipe animation
const SWIPE_OVERSHOOT_FRICTION = 8; // Friction when overshooting bounds

type Props = {
  children: ReactNode;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  onSwipeIntent?: (direction: 'left' | 'right') => void;
  swipeableRef?: (ref: Swipeable | null) => void;
  onSwipeableWillOpen?: () => void;
  onSwipeableOpen?: () => void;
  onSwipeableClose?: () => void;
  enabled?: boolean;
};

export default function SwipeRowContainer({
  children,
  leftActions,
  rightActions,
  onSwipeIntent,
  swipeableRef,
  onSwipeableWillOpen,
  onSwipeableOpen,
  onSwipeableClose,
  enabled = true,
}: Props) {

  // Map Swipeable's direction to semantic direction
  // Swipeable's direction indicates which side opened ('left' or 'right')
  // This maps directly to our semantic direction
  const handleSwipeableOpen = (direction: 'left' | 'right') => {
    if (onSwipeIntent) {
      // Swipeable's direction directly maps to semantic direction
      // 'left' means left actions opened, 'right' means right actions opened
      onSwipeIntent(direction);
    }
    // Also call coordination callback if provided
    onSwipeableOpen?.();
  };

  const handleSwipeableWillOpen = () => {
    // Coordination callback (for swipe coordination)
    onSwipeableWillOpen?.();
  };

  const handleSwipeableClose = () => {
    // Coordination callback (for swipe coordination)
    onSwipeableClose?.();
  };

  // Only enable swipe if actions are provided
  const hasActions = !!(leftActions || rightActions);
  const swipeEnabled = enabled && hasActions;

  return (
    <Swipeable
      ref={swipeableRef}
      {...(leftActions && {
        renderLeftActions: () => (
          <View style={styles.actionsContainer}>{leftActions}</View>
        ),
      })}
      {...(rightActions && {
        renderRightActions: () => (
          <View style={styles.actionsContainer}>{rightActions}</View>
        ),
      })}
      overshootRight={false}
      overshootLeft={false}
      friction={SWIPE_FRICTION}
      rightThreshold={SWIPE_OPEN_THRESHOLD}
      leftThreshold={SWIPE_OPEN_THRESHOLD}
      overshootFriction={SWIPE_OVERSHOOT_FRICTION}
      enabled={swipeEnabled}
      activeOffsetX={[-SWIPE_ACTIVE_OFFSET_X, SWIPE_ACTIVE_OFFSET_X] as [number, number]}
      failOffsetY={[-SWIPE_FAIL_OFFSET_Y, SWIPE_FAIL_OFFSET_Y] as [number, number]}
      containerStyle={styles.swipeableContainer}
      onSwipeableOpen={handleSwipeableOpen}
      onSwipeableWillOpen={handleSwipeableWillOpen}
      onSwipeableClose={handleSwipeableClose}
    >
      <View style={styles.foregroundContainer}>
        {children}
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  swipeableContainer: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  foregroundContainer: {
    // Container for children - no styling beyond layout
    // Translation is handled by Swipeable
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    gap: spacing.tiny,
    zIndex: 1,
    // Background actions remain static, revealed as foreground translates
  },
});
