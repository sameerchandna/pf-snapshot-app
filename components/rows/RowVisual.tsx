/**
 * RowVisual - Pure visual row component with no interactivity.
 * 
 * NON-GOALS (what this component does NOT do):
 * - No gesture handling (no swipe, no drag)
 * - No press/tap interactions (no Pressable, no onPress callbacks)
 * - No state management (no useState, no state mutations)
 * - No business logic (no Snapshot mutations, no validation)
 * - No accessibility interactions (no button roles, no interactive states)
 * 
 * This component is purely presentational. It renders visual content only.
 * All interactivity must be handled by parent components wrapping this component.
 * 
 * Visual features:
 * - Fixed row height for consistent alignment
 * - Title text (max 2 lines, truncated)
 * - Optional subtitle text (single line, truncated)
 * - Optional leading content (icons, checkboxes, etc.)
 * - Optional trailing content (amounts, badges, etc.)
 * - Visual states (locked, inactive, dimmed) - appearance only, no behavior
 * - Optional top divider
 * - Theme-aware colors via useTheme() only
 */

import React, { ReactNode, useState } from 'react';
import { StyleSheet, Text, View, LayoutChangeEvent } from 'react-native';
import { useTheme } from '../../ui/theme/useTheme';
import { layout } from '../../ui/layout';
import { spacing } from '../../ui/spacing';

type Props = {
  title: string;
  subtitle?: string | null;
  trailingText?: string;
  trailingSlot?: ReactNode;
  leading?: ReactNode;
  locked?: boolean;
  inactive?: boolean;
  dimmed?: boolean;
  swipeActive?: boolean;
  isLastInGroup?: boolean;
};

// Fixed row height - a layout invariant, not a theme token.
// This ensures consistent alignment across all rows regardless of content.
const ROW_HEIGHT = 44;

export default function RowVisual({
  title,
  subtitle,
  trailingText,
  trailingSlot,
  leading,
  locked = false,
  inactive = false,
  dimmed = false,
  swipeActive = false,
  isLastInGroup = false,
}: Props) {
  const { theme } = useTheme();
  const [leadingWidth, setLeadingWidth] = useState(0);

  // Determine text colors based on visual states
  // Explicit color assignment - do not rely on inherited text color
  const titleColor = locked
    ? theme.colors.text.muted
    : theme.colors.text.primary;

  const subtitleColor = locked
    ? theme.colors.text.disabled
    : theme.colors.text.secondary;

  const trailingColor = locked
    ? theme.colors.text.muted
    : theme.colors.text.secondary;

  // Determine opacity based on visual states
  // Applied only to visual subcontainers, not the root row surface
  let opacity = 1;
  if (dimmed) opacity = 0.45;
  else if (locked) opacity = 0.7;
  else if (inactive) opacity = 0.5;

  // Compute separator left inset: rowPaddingHorizontal + leadingWidth + leadingSpacing
  // If no leading, contentStartX = rowPaddingHorizontal
  const contentStartX = layout.rowPaddingHorizontal + (leading ? leadingWidth + spacing.sm : 0);

  const handleLeadingLayout = (event: LayoutChangeEvent) => {
    setLeadingWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      style={[
        styles.rowWrapper,
        {
          backgroundColor: theme.colors.bg.card,
        },
      ]}
    >
      <View style={styles.row}>
        {leading && (
          <View
            style={[styles.leading, { opacity }]}
            onLayout={handleLeadingLayout}
          >
            {leading}
          </View>
        )}
        <View style={[styles.content, { opacity }]}>
          <View style={styles.primaryRow}>
            <Text
              style={[
                styles.title,
                {
                  fontSize: 16,
                  lineHeight: 20,
                  fontWeight: '400',
                  color: titleColor,
                },
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {(trailingText || trailingSlot) && (
              <View style={styles.trailing}>
                {trailingText ? (
                  <Text
                    style={[
                      styles.trailingText,
                      {
                        fontSize: 15,
                        lineHeight: 19,
                        fontWeight: '500',
                        color: trailingColor,
                      },
                    ]}
                  >
                    {trailingText}
                  </Text>
                ) : (
                  trailingSlot
                )}
              </View>
            )}
          </View>
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                {
                  fontSize: 14,
                  lineHeight: 18,
                  fontWeight: '400',
                  color: subtitleColor,
                },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {/* Bottom separator - Apple Settings style */}
      {!isLastInGroup && (
        <View
          style={[
            styles.separator,
            {
              backgroundColor: theme.colors.border.separator,
              left: contentStartX,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrapper: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT, // Fixed layout invariant, not a theme token
    paddingVertical: 0,
    paddingHorizontal: layout.rowPaddingHorizontal,
  },
  leading: {
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    flexShrink: 1,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
  },
  trailing: {
    marginLeft: spacing.sm,
  },
  trailingText: {
    textAlign: 'right',
  },
  subtitle: {
    marginTop: 2,
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});
