import React, { ReactNode, useRef, useEffect } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../ui/theme/useTheme';
import { layout } from '../../layout';
import { spacing } from '../../spacing';

type Props<TItem> = {
  item: TItem;
  itemId: string;
  name: string;
  amountText: string;
  metaText?: string | null;
  locked: boolean;
  isActive?: boolean;
  isCurrentlyEditing: boolean;
  dimRow: boolean;
  isInactive: boolean;
  showTopDivider: boolean;
  onPress?: () => void;
  onToggleActive?: () => void;
  renderSwipeActions: () => ReactNode;
  swipeableEnabled: boolean;
  onSwipeableWillOpen: () => void;
  onSwipeableOpen: () => void;
  onSwipeableClose: () => void;
  swipeableRef: (ref: Swipeable | null) => void;
  swipeRevealMode?: 'replace' | 'overlay';
};

/**
 * Pure row component for financial items (expenses, income, assets, etc.).
 * 
 * Handles all visual states:
 * - Locked state (reduced opacity)
 * - Inactive state (reduced opacity)
 * - Editing state (dimmed when another item is being edited)
 * - Active/inactive checkbox (when provided)
 * - Swipe actions
 * - Dividers
 * 
 * MUST NOT:
 * - Manage state
 * - Mutate Snapshot
 * - Know about editors or validation
 */
export default function FinancialItemRow<TItem>({
  item,
  itemId,
  name,
  amountText,
  metaText,
  locked,
  isActive = true,
  isCurrentlyEditing,
  dimRow,
  isInactive,
  showTopDivider,
  onPress,
  onToggleActive,
  renderSwipeActions,
  swipeableEnabled,
  onSwipeableWillOpen,
  onSwipeableOpen,
  onSwipeableClose,
  swipeableRef,
  swipeRevealMode = 'replace',
}: Props<TItem>) {
  const { theme } = useTheme();

  const handleSwipeableWillOpen = () => {
    onSwipeableWillOpen();
    if (Platform.OS === 'ios') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Haptics not available, ignore
      }
    }
  };

  const isOverlayMode = swipeRevealMode === 'overlay';
  // For overlay mode, track the swipe progress to counter-translate the row
  const progressValue = useRef(new Animated.Value(0)).current;
  const progressRef = useRef<Animated.Value | null>(null);
  const listenerIdRef = useRef<string | null>(null);
  const actionWidth = 70; // Approximate width of swipe actions (2 actions at ~35px each)

  // Counter-translate the row content in overlay mode to keep it visually fixed
  const counterTranslateX = isOverlayMode
    ? progressValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -actionWidth],
        extrapolate: 'clamp',
      })
    : 0;

  // Clean up listener on unmount
  useEffect(() => {
    return () => {
      if (listenerIdRef.current && progressRef.current) {
        progressRef.current.removeListener(listenerIdRef.current);
        listenerIdRef.current = null;
      }
    };
  }, []);

  return (
    <View
      style={[
        styles.itemRowWrapper,
        showTopDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border.muted,
        },
      ]}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={(progress) => {
          // For overlay mode, sync the progress value to drive counter-translation
          if (isOverlayMode) {
            // Only set up listener once
            if (progressRef.current !== progress) {
              // Clean up old listener if exists
              if (listenerIdRef.current && progressRef.current) {
                progressRef.current.removeListener(listenerIdRef.current);
              }
              progressRef.current = progress;
              // Set up new listener to sync progress values
              listenerIdRef.current = progress.addListener(({ value }) => {
                progressValue.setValue(value);
              });
            }
          }
          return renderSwipeActions();
        }}
        overshootRight={false}
        friction={2}
        rightThreshold={30}
        overshootFriction={8}
        enabled={swipeableEnabled}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-5, 5]}
        containerStyle={styles.swipeableContainer}
        onSwipeableWillOpen={handleSwipeableWillOpen}
        onSwipeableOpen={onSwipeableOpen}
        onSwipeableClose={() => {
          if (isOverlayMode) {
            progressValue.setValue(0);
          }
          onSwipeableClose();
        }}
      >
        <Animated.View
          style={[
            isOverlayMode && {
              transform: [{ translateX: counterTranslateX }],
            },
            isOverlayMode && styles.itemRowOverlayContainer,
          ]}
        >
          <Pressable
            onPress={onPress}
            disabled={isCurrentlyEditing || !onPress}
            style={({ pressed }) => [
              styles.itemRow,
              {
                backgroundColor: pressed ? theme.colors.bg.subtle : (isOverlayMode ? theme.colors.bg.card : 'transparent'),
              },
              dimRow ? styles.itemRowDim : null,
              locked ? styles.itemRowLocked : null,
              isInactive ? styles.itemRowInactive : null,
            ]}
          >
          {/* Active/Inactive checkbox */}
          {onToggleActive ? (
            <Pressable
              onPress={onToggleActive}
              style={({ pressed }) => [
                styles.activeCheckbox,
                { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={isActive ? 'Active' : 'Inactive'}
            >
              <View
                style={[
                  styles.checkboxCircle,
                  { borderColor: theme.colors.border.default },
                  isActive
                    ? { backgroundColor: theme.colors.brand.primary, borderColor: theme.colors.brand.primary }
                    : null,
                ]}
              >
                {isActive ? (
                  <Text
                    style={[
                      styles.checkboxCheckmark,
                      theme.typography.caption,
                      { fontWeight: '700', color: theme.colors.text.primary },
                    ]}
                  >
                    ✓
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ) : null}
          <View
            style={[
              styles.itemMain,
              isCurrentlyEditing ? styles.itemMainActive : null,
              locked ? styles.itemMainLocked : null,
            ]}
          >
            <View style={styles.itemLeft}>
              <View style={styles.primaryRow}>
                <Text
                  style={[
                    styles.itemName,
                    theme.typography.bodyLarge,
                    { color: locked ? theme.colors.text.muted : theme.colors.text.primary },
                  ]}
                >
                  {name}
                </Text>
                <Text
                  style={[
                    styles.itemAmount,
                    { color: locked ? theme.colors.text.muted : theme.colors.text.primary },
                  ]}
                >
                  {amountText}
                </Text>
              </View>
              {metaText ? (
                <Text
                  style={[
                    styles.itemMeta,
                    theme.typography.bodySmall,
                    { color: locked ? theme.colors.text.disabled : theme.colors.text.muted },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {metaText}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
        </Animated.View>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  itemRowWrapper: {
    // Wrapper kept for structure, but no margin (dividers provide separation)
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: layout.rowPaddingHorizontal,
    position: 'relative',
  },
  itemRowDim: {
    opacity: 0.45,
  },
  itemRowLocked: {
    opacity: 0.7,
  },
  itemRowInactive: {
    opacity: 0.5,
  },
  activeCheckbox: {
    marginLeft: 0,
    marginRight: spacing.tiny,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCheckmark: {
    // Typography via theme.typography.caption with fontWeight override
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemMainActive: {
    opacity: 0.95,
  },
  itemMainLocked: {
    opacity: 0.7,
  },
  itemLeft: {
    flex: 1,
    flexShrink: 1,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    marginBottom: 1,
  },
  itemAmount: {
    // Typography via theme.typography.valueSmall
    marginLeft: 'auto',
    textAlign: 'right',
  },
  itemMeta: {
    marginTop: spacing.tiny,
    // Single-line truncation enforced via numberOfLines prop
  },
  swipeableContainer: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  itemRowOverlayContainer: {
    position: 'relative',
    zIndex: 1,
  },
});
