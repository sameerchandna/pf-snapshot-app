import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { typography, radius } from '../ui/theme/theme';
import Icon, { type IconName } from './Icon';
import IconButton from './IconButton';

const SCREEN_BG = '#F7F6F2';
const HATCH_GAP = 14;

function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

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
  chevron?: 'down' | 'right'; // defaults to 'down'
  emphasis?: boolean; // larger, heavier text
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
  /** Col 1 (left-aligned) — typically the Scenario dropdown */
  col1?: ControlBarLeftItem;
  /** Col 2 (center-aligned) — typically the Age dropdown */
  col2?: ControlBarLeftItem;
  /** Col 3 (right-aligned) — typically action icon buttons */
  col3Items?: ControlBarRightItem[];
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
  col1,
  col2,
  col3Items = [],
  containerStyle,
}: ControlBarProps) {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const hatchLines: React.ReactNode[] = [];
  if (size.width > 0 && size.height > 0) {
    const { width, height } = size;
    const totalLines = Math.ceil((width + height) / HATCH_GAP) + 1;
    for (let i = 0; i < totalLines; i++) {
      const offset = i * HATCH_GAP;
      const op1 = 0.07 + rand(i) * 0.10;
      const sw1 = 0.4 + rand(i * 3 + 7) * 0.9;
      // `/` direction
      hatchLines.push(
        <Line key={`a${i}`} x1={offset} y1={0} x2={offset - height} y2={height}
          stroke={palette.accent} strokeWidth={sw1} strokeOpacity={op1} />
      );
      // `\` direction
      const op2 = 0.07 + rand(i * 5 + 13) * 0.10;
      const sw2 = 0.4 + rand(i * 7 + 3) * 0.9;
      hatchLines.push(
        <Line key={`b${i}`} x1={offset - height} y1={0} x2={offset} y2={height}
          stroke={palette.accent} strokeWidth={sw2} strokeOpacity={op2} />
      );
    }
  }

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
            item.emphasis && styles.pillButtonTextEmphasis,
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
          {item.chevron === 'right' ? '▸' : '▼'}
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
          name="chevron-down-outline"
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
            backgroundColor: SCREEN_BG,
            borderColor: theme.colors.border.subtle,
            borderRadius: theme.radius.medium,
            ...theme.shadows.medium,
          },
        ]}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          setSize({ width, height });
        }}
      >
        {size.width > 0 && size.height > 0 && (
          <Svg
            width={size.width}
            height={size.height}
            style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.medium }]}
            pointerEvents="none"
          >
            {hatchLines}
          </Svg>
        )}
        <View style={styles.row}>
          <View style={styles.col1}>
            {col1 && renderLeftItem(col1, 0)}
          </View>

          <View style={styles.col2}>
            {col2 && renderLeftItem(col2, 0)}
          </View>

          <View style={styles.col3}>
            {col3Items.map((item, index) => renderRightItem(item, index))}
          </View>
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
  col1: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  col2: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  col3: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
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
  pillButtonTextEmphasis: {
    ...typography.bodyLarge,
    fontWeight: '600',
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
