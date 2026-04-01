import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { typography, radius } from '../ui/theme/theme';
import Icon, { type IconName } from './Icon';
import IconButton from './IconButton';

/**
 * Control item types - explicitly typed, not unioned.
 */

export type ControlBarPillItem = {
  type: 'pill';
  title: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  icon?: IconName; // Optional icon before text (e.g., "zap" for Quick what-if)
};

export type ControlBarItemButton = {
  type: 'itemButton';
  title: string;
  subtitle?: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
};

export type ControlBarIconItem = {
  type: 'icon';
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  variant?: 'default' | 'primary';
};

export type ControlBarLeftItem = ControlBarPillItem | ControlBarItemButton;
export type ControlBarRightItem = ControlBarPillItem | ControlBarIconItem;

type ControlBarProps = {
  leftItems?: ControlBarLeftItem[];
  rightItems?: ControlBarRightItem[];
  containerStyle?: object;
};

/**
 * ControlBar - Reusable toolbar component with card surface.
 * 
 * Renders a card-style surface containing a horizontal row with:
 * - leftItems: ordered list of control items (pills or item buttons)
 * - spacer
 * - rightItems: ordered list of control items (pills or icon buttons)
 * 
 * All behavior (onPress, active, disabled) is injected via props.
 * Active styling is fixed: brand tint background, primary text color.
 * Uses theme tokens exclusively (no hardcoded colors, spacing, radius).
 */
export default function ControlBar({
  leftItems = [],
  rightItems = [],
  containerStyle,
}: ControlBarProps) {
  const { theme } = useTheme();

  const renderPillItem = (item: ControlBarPillItem, index: number) => {
    const isActive = item.active ?? false;
    const isDisabled = item.disabled ?? false;

    return (
      <Pressable
        key={index}
        onPress={item.onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.pillButton,
          isActive && { backgroundColor: theme.colors.brand.tint },
          isDisabled && styles.pillButtonDisabled,
          pressed && !isActive && !isDisabled && { backgroundColor: theme.colors.bg.subtle },
        ]}
      >
        {item.icon && (
          <Icon
            name={item.icon}
            size="md"
            color={isActive ? theme.colors.brand.primary : theme.colors.text.secondary}
          />
        )}
        <Text
          style={[
            styles.pillButtonText,
            isActive && [styles.pillButtonTextActive, { color: theme.colors.brand.primary }],
            isDisabled && { color: theme.colors.text.disabled },
          ]}
        >
          {item.title}
        </Text>
        <Text
          style={[
            styles.pillChevron,
            isActive && { color: theme.colors.brand.primary },
            isDisabled && { color: theme.colors.text.disabled },
          ]}
        >
          ▼
        </Text>
      </Pressable>
    );
  };

  const renderItemButton = (item: ControlBarItemButton, index: number) => {
    const isActive = item.active ?? false;
    const isDisabled = item.disabled ?? false;

    return (
      <Pressable
        key={index}
        onPress={item.onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.itemButton,
          { borderRadius: theme.radius.base },
          isActive && { backgroundColor: theme.colors.brand.tint },
          isDisabled && styles.itemButtonDisabled,
          pressed && !isActive && !isDisabled && { backgroundColor: theme.colors.bg.subtle },
        ]}
      >
        <View style={styles.itemButtonContent}>
          <Text
            style={[
              styles.itemButtonTitle,
              { color: theme.colors.text.primary },
              isActive && { color: theme.colors.brand.primary },
              isDisabled && { color: theme.colors.text.disabled },
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.subtitle && (
            <Text
              style={[
                styles.itemButtonSubtitle,
                { color: theme.colors.text.muted },
                isDisabled && { color: theme.colors.text.disabled },
              ]}
              numberOfLines={1}
            >
              {item.subtitle}
            </Text>
          )}
        </View>
        <Icon
          name="chevron-down"
          size="md"
          color={isActive ? theme.colors.brand.primary : theme.colors.text.secondary}
          style={styles.itemButtonChevron}
        />
      </Pressable>
    );
  };

  const renderIconItem = (item: ControlBarIconItem, index: number) => {
    return (
      <IconButton
        key={index}
        icon={item.icon}
        size="md"
        variant={item.variant ?? 'default'}
        onPress={item.onPress}
        accessibilityLabel={item.accessibilityLabel}
        style={item.active ? { backgroundColor: theme.colors.brand.primary } : undefined}
      />
    );
  };

  const renderLeftItem = (item: ControlBarLeftItem, index: number) => {
    if (item.type === 'pill') {
      return renderPillItem(item, index);
    } else if (item.type === 'itemButton') {
      return renderItemButton(item, index);
    }
    return null;
  };

  const renderRightItem = (item: ControlBarRightItem, index: number) => {
    if (item.type === 'pill') {
      return renderPillItem(item, index);
    } else if (item.type === 'icon') {
      return renderIconItem(item, index);
    }
    return null;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View
        style={[
          styles.surface,
          {
            backgroundColor: theme.colors.bg.card,
            borderColor: theme.colors.border.subtle,
            borderRadius: theme.radius.medium,
            ...theme.shadows.medium,
          },
        ]}
      >
        <View style={styles.row}>
          {leftItems.length > 0 && (
            <View style={styles.leftGroup}>
              {leftItems.map((item, index) => renderLeftItem(item, index))}
            </View>
          )}

          <View style={styles.spacer} />

          {rightItems.length > 0 && (
            <View style={styles.rightGroup}>
              {rightItems.map((item, index) => renderRightItem(item, index))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.sm,
  },
  surface: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
  },
  spacer: {
    flex: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  pillButton: {
    height: 28,
    paddingHorizontal: spacing.base,
    borderRadius: radius.modal,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pillButtonText: {
    ...typography.body,
  },
  pillButtonTextActive: {
    fontWeight: '600',
  },
  pillButtonDisabled: {
    opacity: 0.5,
  },
  pillChevron: {
    ...typography.caption,
    marginLeft: spacing.tiny,
  },
  itemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 0,
    flexShrink: 1,
  },
  itemButtonContent: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.xs,
  },
  itemButtonTitle: {
    ...typography.button,
    marginBottom: layout.componentGapTiny,
  },
  itemButtonSubtitle: {
    ...typography.bodySmall,
  },
  itemButtonChevron: {
    marginLeft: spacing.xs,
    flexShrink: 0,
  },
  itemButtonDisabled: {
    opacity: 0.5,
  },
});
