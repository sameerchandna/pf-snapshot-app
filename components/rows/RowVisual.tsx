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

import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../ui/theme/useTheme';
import { layout } from '../../layout';
import { spacing } from '../../spacing';

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
  showTopDivider?: boolean;
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
  showTopDivider = false,
}: Props) {
  const { theme } = useTheme();

  // Determine text colors based on visual states
  const titleColor = locked
    ? theme.colors.text.muted
    : theme.colors.text.primary;

  const subtitleColor = locked
    ? theme.colors.text.disabled
    : theme.colors.text.muted;

  const trailingColor = locked
    ? theme.colors.text.muted
    : theme.colors.text.primary;

  // Determine opacity based on visual states
  // Applied only to visual subcontainers, not the root row surface
  let opacity = 1;
  if (dimmed) opacity = 0.45;
  else if (locked) opacity = 0.7;
  else if (inactive) opacity = 0.5;

  return (
    <View
      style={[
        styles.rowWrapper,
        {
          backgroundColor: theme.colors.bg.card,
        },
        showTopDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border.muted,
        },
      ]}
    >
      <View style={styles.row}>
        {leading && (
          <View style={[styles.leading, { opacity }]}>
            {leading}
          </View>
        )}
        <View style={[styles.content, { opacity }]}>
          <View style={styles.primaryRow}>
            <Text
              style={[
                styles.title,
                theme.typography.bodyLarge,
                { color: titleColor },
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
                      theme.typography.valueSmall,
                      { color: trailingColor },
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
                theme.typography.bodySmall,
                { color: subtitleColor },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrapper: {
    // Wrapper for divider support
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
    marginTop: spacing.tiny,
  },
});
