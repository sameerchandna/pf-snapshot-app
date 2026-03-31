import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../ui/theme/useTheme';
import { spacing } from '../../ui/spacing';
import AddEntry from './AddEntry';

export type Group<TItem> = {
  id: string;
  name: string;
  items: TItem[];
};

type GroupedListProps<TItem> = {
  // Data
  groups?: Group<TItem>[];
  items?: TItem[]; // For flat mode (when groups not provided)
  getItemId: (item: TItem) => string;

  // Group state (managed by parent)
  isGroupExpanded: (groupId: string) => boolean;
  canCollapseGroups?: boolean;

  // Rendering
  renderGroupHeader: (group: Group<TItem>) => ReactNode;
  renderRow: (
    item: TItem,
    index: number,
    groupId: string | undefined,
    isLastInGroup: boolean,
    swipeableCallbacks: {
      swipeableRef: (ref: Swipeable | null) => void;
      onSwipeableWillOpen: () => void;
      onSwipeableOpen: () => void;
      onSwipeableClose: () => void;
      swipeableEnabled: boolean;
    },
  ) => ReactNode;
  renderSwipeActions?: (item: TItem) => ReactNode;

  // Empty state
  emptyStateText?: string | null;

  // Add item trigger
  showAddItemTrigger?: boolean;
  onAddItemPress?: () => void;
  addItemTriggerLabel?: string;

  // Swipeable coordination (all decisions made by parent, GroupedList just wires through)
  swipeableRefs: React.MutableRefObject<Map<string, Swipeable | null>>;
  onSwipeableWillOpen: (itemId: string) => void;
  onSwipeableOpen: (itemId: string) => void;
  onSwipeableClose: (itemId: string) => void;
  swipeableEnabled: (itemId: string) => boolean;
};

/**
 * Pure list component for rendering grouped financial items.
 * 
 * Responsibilities:
 * - Render grouped sections (headers + grouped item blocks)
 * - Render rows via renderRow callback
 * - Empty states
 * - Dividers / separators
 * - Display "Add item" trigger via AddEntry (trigger only)
 * - Wire swipeable callbacks through to rows (no coordination decisions)
 * 
 * MUST be pure/stateless composition layer.
 * MUST NOT:
 * - Decide when swipeables open/close
 * - Contain coordination logic (e.g. "close all when X happens")
 * - Know about add/edit state
 * - Know about editor visibility
 * - Know about validation
 * - Know about Snapshot or Snapshot setters
 * - Know about navigation
 */
export default function GroupedList<TItem>({
  groups,
  items,
  getItemId,
  isGroupExpanded,
  canCollapseGroups = true,
  renderGroupHeader,
  renderRow,
  renderSwipeActions,
  emptyStateText,
  showAddItemTrigger = false,
  onAddItemPress,
  addItemTriggerLabel = '+ Add item',
  swipeableRefs,
  onSwipeableWillOpen,
  onSwipeableOpen,
  onSwipeableClose,
  swipeableEnabled,
}: GroupedListProps<TItem>) {
  const { theme } = useTheme();

  // Create swipeable callbacks for a row (pure wiring, no coordination decisions)
  const createSwipeableCallbacks = (itemId: string) => {
    return {
      swipeableRef: (ref: Swipeable | null) => {
        if (ref) {
          swipeableRefs.current.set(itemId, ref);
        } else {
          swipeableRefs.current.delete(itemId);
        }
      },
      onSwipeableWillOpen: () => onSwipeableWillOpen(itemId),
      onSwipeableOpen: () => onSwipeableOpen(itemId),
      onSwipeableClose: () => onSwipeableClose(itemId),
      swipeableEnabled: swipeableEnabled(itemId),
    };
  };

  // Render grouped list
  if (groups) {
    return (
      <View>
        {groups.map((group) => {
          const groupExpanded = isGroupExpanded(group.id);
          const shouldShowItems = groupExpanded || !canCollapseGroups;

          return (
            <View key={group.id} style={styles.groupWrapper}>
              {/* Group header (rendered by parent) */}
              {renderGroupHeader(group)}

              {/* Group body */}
              {shouldShowItems ? (
                <View style={styles.groupBody}>
                  {/* Empty state */}
                  {group.items.length === 0 ? (
                    emptyStateText === null ? null : (
                      <Text
                        style={[
                          styles.emptyText,
                          theme.typography.body,
                          { color: theme.colors.text.secondary },
                        ]}
                      >
                        {emptyStateText ?? 'No items yet.'}
                      </Text>
                    )
                  ) : null}

                  {/* Items */}
                  {group.items.map((item, index) => {
                    const itemId = getItemId(item);
                    const swipeableCallbacks = createSwipeableCallbacks(itemId);
                    // isLastInGroup: true if this is the last data item
                    const isLastInGroup = index === group.items.length - 1;
                    return <React.Fragment key={itemId}>{renderRow(item, index, group.id, isLastInGroup, swipeableCallbacks)}</React.Fragment>;
                  })}
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Add item trigger */}
        {showAddItemTrigger && onAddItemPress ? (
          <AddEntry
            onPress={onAddItemPress}
            label={addItemTriggerLabel}
            variant="button"
          />
        ) : null}
      </View>
    );
  }

  // Render flat list (no groups)
  return (
    <View>
      <View style={styles.groupWrapper}>
        <View style={styles.groupCard}>
          <View style={styles.groupBody}>
            {/* Empty state */}
            {items && items.length === 0 ? (
              emptyStateText === null ? null : (
                <Text
                  style={[
                    styles.emptyText,
                    theme.typography.body,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  {emptyStateText ?? 'No items yet.'}
                </Text>
              )
            ) : null}

            {/* Items */}
            {items?.map((item, index) => {
              const itemId = getItemId(item);
              const swipeableCallbacks = createSwipeableCallbacks(itemId);
              // isLastInGroup: true if this is the last data item
              const isLastInGroup = index === (items.length - 1);
              return <React.Fragment key={itemId}>{renderRow(item, index, undefined, isLastInGroup, swipeableCallbacks)}</React.Fragment>;
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupWrapper: {
    marginBottom: spacing.base,
  },
  groupCard: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  groupBody: {
    marginTop: spacing.tiny,
  },
  emptyText: {
    marginBottom: spacing.sm,
  },
  swipeableContainer: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
