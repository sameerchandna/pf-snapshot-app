import React, { ReactNode, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { ScrollView, Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../ui/theme/useTheme';
import { spacing } from '../../ui/spacing';
import { layout } from '../../ui/layout';
import Row from './Row';
import Divider from '../Divider';

export type Group<TItem> = {
  id: string;
  name?: string; // Optional name for default header rendering
  header?: ReactNode; // Optional custom header (takes precedence over name)
  items: TItem[];
};

type ListProps<TItem> = {
  items: TItem[];
  renderRow: (item: TItem, index: number) => ReactNode; // Returns Row component or similar
  groups?: Group<TItem>[];
  renderSwipeActions?: (item: TItem) => ReactNode;
  getItemId: (item: TItem) => string;
  header?: ReactNode;
  footer?: ReactNode;
  emptyState?: ReactNode;
  showSeparators?: boolean;
  scrollEnabled?: boolean;
  onScrollBeginDrag?: () => void;
  renderGroupHeader?: (group: Group<TItem>) => ReactNode; // Optional custom group header renderer
};

/**
 * Canonical List component for rendering collections of Row components.
 * 
 * Owns list behavior:
 * - Separators between rows
 * - Optional static grouping (render-only, no interaction)
 * - Swipe behavior (if swipe actions provided)
 * - Header/footer support
 * - Empty state handling
 * 
 * Row components remain unaware of swipe/grouping - List handles all list-level behavior.
 * 
 * Grouping is static and render-only. All group items are always rendered.
 */
export default function List<TItem>({
  items,
  renderRow,
  groups,
  renderSwipeActions,
  getItemId,
  header,
  footer,
  emptyState,
  showSeparators = true,
  scrollEnabled = true,
  onScrollBeginDrag,
  renderGroupHeader,
}: ListProps<TItem>) {
  const { theme } = useTheme();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const [openSwipeableId, setOpenSwipeableId] = useState<string | null>(null);

  const closeAllSwipeables = (exceptId?: string) => {
    swipeableRefs.current.forEach((ref, id) => {
      if (id !== exceptId) {
        ref.close();
      }
    });
  };

  const handleSwipeableWillOpen = (id: string) => {
    closeAllSwipeables(id);
    setOpenSwipeableId(id);
    
    // Optional haptic feedback on iOS
    if (Platform.OS === 'ios') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Haptics not available, ignore
      }
    }
  };

  const handleSwipeableClose = (id: string) => {
    if (openSwipeableId === id) {
      setOpenSwipeableId(null);
    }
  };

  const handleScrollBeginDrag = () => {
    closeAllSwipeables();
    setOpenSwipeableId(null);
    if (onScrollBeginDrag) {
      onScrollBeginDrag();
    }
  };

  // Handle outside touches to close swipeables when one is open
  // Use capture phase to detect touches and close swipeables, but allow touch to continue to children
  const onStartShouldSetResponderCapture = () => {
    // Only handle if a swipeable is open
    if (openSwipeableId !== null) {
      // Close swipeables immediately on any touch
      closeAllSwipeables();
      setOpenSwipeableId(null);
    }
    // Always return false to allow touch to continue to children (rows, etc.)
    return false;
  };

  // Wrap row with swipe if swipe actions provided
  const wrapWithSwipe = (item: TItem, rowContent: ReactNode): ReactNode => {
    if (!renderSwipeActions) {
      return rowContent;
    }

    const id = getItemId(item);
    const swipeActions = renderSwipeActions(item);

    return (
      <Swipeable
        key={id}
        ref={(ref) => {
          if (ref) {
            swipeableRefs.current.set(id, ref);
          } else {
            swipeableRefs.current.delete(id);
          }
        }}
        renderRightActions={(progress) => {
          // Interpolate opacity based on swipe progress for smooth reveal
          // Progress goes from 0 (closed) to 1 (fully open)
          const opacity = progress.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0, 0.7, 1],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              style={[
                styles.swipeActionsContainer,
                {
                  opacity,
                },
              ]}
            >
              {swipeActions}
            </Animated.View>
          );
        }}
        overshootRight={false}
        friction={2}
        rightThreshold={30}
        overshootFriction={8}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-5, 5]}
        containerStyle={[
          styles.swipeableContainer,
          { backgroundColor: theme.colors.bg.card },
        ]}
        onSwipeableWillOpen={() => handleSwipeableWillOpen(id)}
        onSwipeableOpen={() => setOpenSwipeableId(id)}
        onSwipeableClose={() => handleSwipeableClose(id)}
      >
        {/* Wrap row content in a View with solid background to prevent transparency during swipe */}
        <View style={{ backgroundColor: theme.colors.bg.card }}>
          {rowContent}
        </View>
      </Swipeable>
    );
  };

  // Render flat list (no groups)
  const renderFlatList = (): ReactNode => {
    if (items.length === 0 && emptyState) {
      return emptyState;
    }

    return items.map((item, index) => {
      const rowContent = renderRow(item, index);
      const rowWithSeparator = showSeparators && index > 0 ? (
        <View key={`sep-${getItemId(item)}`}>
          <Divider variant="subtle" />
          {rowContent}
        </View>
      ) : (
        rowContent
      );

      return wrapWithSwipe(item, rowWithSeparator);
    });
  };

  // Render grouped list (static, render-only)
  const renderGroupedList = (): ReactNode => {
    if (!groups) {
      return renderFlatList();
    }

    return groups.map((group) => {
      const groupItems = group.items;

      return (
        <View key={group.id} style={styles.groupWrapper}>
          {/* Group header */}
          {renderGroupHeader ? (
            renderGroupHeader(group)
          ) : group.header ? (
            <View style={styles.groupHeader}>{group.header}</View>
          ) : group.name ? (
            <View style={styles.groupHeader}>
              <Row
                primary={group.name}
                showTopDivider={false}
                showBottomDivider={false}
              />
            </View>
          ) : null}

          {/* Group items (always rendered, no conditional) */}
          <View style={styles.groupBody}>
            {groupItems.length === 0 && emptyState ? (
              emptyState
            ) : (
              groupItems.map((item, index) => {
                const rowContent = renderRow(item, index);
                const rowWithSeparator = showSeparators && index > 0 ? (
                  <View key={`sep-${getItemId(item)}`}>
                    <Divider variant="subtle" />
                    {rowContent}
                  </View>
                ) : (
                  rowContent
                );

                return wrapWithSwipe(item, rowWithSeparator);
              })
            )}
          </View>
        </View>
      );
    });
  };

  const listContent = groups ? renderGroupedList() : renderFlatList();

  return (
    <ScrollView
      style={styles.scrollView}
      scrollEnabled={scrollEnabled && openSwipeableId === null}
      onScrollBeginDrag={handleScrollBeginDrag}
    >
      <View
        style={styles.contentWrapper}
        onStartShouldSetResponderCapture={onStartShouldSetResponderCapture}
      >
        {header && <View style={styles.header}>{header}</View>}
        {listContent}
        {footer && <View style={styles.footer}>{footer}</View>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    // Header spacing handled by caller
  },
  footer: {
    // Footer spacing handled by caller
  },
  groupWrapper: {
    marginBottom: spacing.base,
  },
  groupHeader: {
    // Group header styling
  },
  groupBody: {
    // Group body (items) styling
  },
  swipeableContainer: {
    // Swipeable container styling
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
});
