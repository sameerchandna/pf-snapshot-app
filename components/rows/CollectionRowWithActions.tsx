/**
 * CollectionRowWithActions - Reusable v2 row component for editable collection screens.
 * 
 * Uses the canonical v2 stack: SemanticRow → SwipeRowContainer → RowVisual
 * 
 * Handles:
 * - Swipe actions (Edit, Delete) in consistent order
 * - Active/inactive toggle checkbox (when configured)
 * - Row press navigation (when configured)
 * - Swipe coordination via centralized callbacks
 * - Visual state management (locked, inactive, dimmed, swipe active)
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import SemanticRow from './SemanticRow';
import RowVisual from './RowVisual';
import SwipeAction from '../SwipeAction';
import ItemActiveCheckbox from '../ItemActiveCheckbox';
import { useScreenPalette } from '../../ui/theme/palettes';

type CollectionRowWithActionsProps = {
  name: string;
  amountText: string;
  subtitle?: string | null;
  subtitleVariant?: 'valueSmall' | 'caption';

  locked: boolean;
  isActive?: boolean;              // optional: if provided AND onToggleActive provided, show checkbox
  onToggleActive?: () => void;      // if present, render ItemActiveCheckbox (disabled if locked)

  isCurrentlyEditing: boolean;
  dimRow: boolean;
  isLastInGroup: boolean;

  pressEnabled: boolean;
  onPress?: () => void;

  onEdit: () => void;
  onDelete: () => void;
  disableDelete: boolean;
  disableEdit?: boolean;

  swipeableRef?: (ref: any | null) => void;
  onSwipeableWillOpen?: () => void;
  onSwipeableOpen?: () => void;
  onSwipeableClose?: () => void;
};

export default function CollectionRowWithActions({
  name,
  amountText,
  subtitle,
  subtitleVariant,
  locked,
  isActive,
  onToggleActive,
  isCurrentlyEditing,
  dimRow,
  isLastInGroup,
  pressEnabled,
  onPress,
  onEdit,
  onDelete,
  disableDelete,
  disableEdit = false,
  swipeableRef,
  onSwipeableWillOpen,
  onSwipeableOpen,
  onSwipeableClose,
}: CollectionRowWithActionsProps) {
  const palette = useScreenPalette();
  // Track swipe state for visual feedback
  const [isSwiping, setIsSwiping] = useState(false);

  // Handle swipe will open: set visual state and call coordination callback
  const handleSwipeableWillOpen = () => {
    setIsSwiping(true);
    onSwipeableWillOpen?.();
  };

  // Handle swipe close: clear visual state and call coordination callback
  const handleSwipeableClose = () => {
    setIsSwiping(false);
    onSwipeableClose?.();
  };

  // Compute effective press enabled: never allow press while editing or swiping
  const effectivePressEnabled = pressEnabled && !isCurrentlyEditing && !isSwiping;

  // Determine if checkbox should be rendered
  const shouldShowCheckbox = isActive !== undefined && onToggleActive !== undefined;

  // Determine inactive state from isActive
  const isInactive = isActive === false;

  // Right swipe actions: Edit then Delete (Edit hidden when disableEdit; Delete hidden when disableDelete)
  const rightActions = (
    <View style={{ flexDirection: 'row' }}>
      {!disableEdit && (
        <SwipeAction
          variant="edit"
          onPress={onEdit}
          accessibilityLabel="Edit"
        />
      )}
      {!disableDelete && (
        <SwipeAction
          variant="delete"
          onPress={onDelete}
          accessibilityLabel="Delete"
        />
      )}
    </View>
  );

  return (
    <SemanticRow
      onRevealRight={() => {
        // No-op: swipe only reveals actions, doesn't trigger any action
        // Actions are triggered by tapping the SwipeAction buttons
      }}
      swipeableRef={swipeableRef}
      onSwipeableWillOpen={handleSwipeableWillOpen}
      onSwipeableOpen={onSwipeableOpen}
      onSwipeableClose={handleSwipeableClose}
      rightActions={rightActions}
      swipeEnabled={!isCurrentlyEditing}
      pressEnabled={effectivePressEnabled}
      onPress={effectivePressEnabled ? onPress : undefined}
    >
      <RowVisual
        title={name}
        subtitle={subtitle}
        subtitleVariant={subtitleVariant}
        trailingText={amountText}
        leading={
          shouldShowCheckbox ? (
            <ItemActiveCheckbox
              isActive={isActive!}
              onToggle={onToggleActive!}
              disabled={locked}
            />
          ) : undefined
        }
        locked={locked}
        inactive={isInactive}
        dimmed={dimRow}
        swipeActive={isSwiping}
        isLastInGroup={isLastInGroup}
        highlightColor={isCurrentlyEditing ? palette.accent : undefined}
      />
    </SemanticRow>
  );
}
