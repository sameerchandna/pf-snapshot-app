import React, { ReactNode } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../ui/theme/useTheme';
import { layout } from '../../ui/layout';
import { spacing } from '../../ui/spacing';
import Divider from '../Divider';

type Props = {
  leading?: ReactNode;
  primary: string | ReactNode;
  secondary?: string | ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Canonical Row component for list items.
 * 
 * Presentational only - no swipe, no grouping, no business logic.
 * 
 * Features:
 * - Leading slot (icon, checkbox, etc.)
 * - Primary text (required)
 * - Optional secondary text (below primary)
 * - Trailing slot (aligned to primary text baseline, not vertical center)
 * - Optional pressable behavior
 * - Optional dividers
 * 
 * Trailing alignment: Uses flexbox baseline alignment to align trailing
 * content to the primary text baseline, even when secondary text is present.
 */
export default function Row({
  leading,
  primary,
  secondary,
  trailing,
  onPress,
  disabled = false,
  showTopDivider = false,
  showBottomDivider = true,
  style,
}: Props) {
  const { theme } = useTheme();

  const isPressable = onPress !== undefined;

  // Container style
  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center', // Center alignment for vertical centering feel
    minHeight: 44, // Apple HIG minimum
    paddingHorizontal: layout.rowPaddingHorizontal,
    paddingVertical: spacing.tiny, // Reduced from xs (6px) to tiny (4px) for tighter visual density
  };

  // Primary text - establishes baseline for trailing
  const primaryContent = typeof primary === 'string' ? (
    <Text
      style={[
        theme.typography.value,
        { color: theme.colors.text.primary, fontWeight: '400', lineHeight: 19 },
      ]}
    >
      {primary}
    </Text>
  ) : (
    primary
  );

  // Secondary text (if present)
  const secondaryContent = secondary ? (
    typeof secondary === 'string' ? (
      <Text
        style={[
          theme.typography.bodySmall,
          { color: theme.colors.text.muted, marginTop: spacing.zero },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {secondary}
      </Text>
    ) : (
      secondary
    )
  ) : null;

  // Primary line: primary text and trailing aligned to same baseline
  // Note: primaryLine does NOT have flex: 1 - it's just a row container
  const primaryLine = (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <View style={{ flex: 1 }}>{primaryContent}</View>
      {trailing && (
        <View style={{ marginLeft: spacing.sm }}>{trailing}</View>
      )}
    </View>
  );

  // Content wrapper: vertically centers the entire text block (primary + secondary)
  // This is the "content" node in the required structure
  const contentWrapper = (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      {primaryLine}
      {secondaryContent}
    </View>
  );

  // Row content structure
  const rowContent = (
    <>
      {leading && (
        <View
          style={{
            marginRight: spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {leading}
        </View>
      )}
      {contentWrapper}
    </>
  );

  if (isPressable) {
    return (
      <>
        {showTopDivider && <Divider />}
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={({ pressed }) => [
            containerStyle,
            {
              backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
            },
            style,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
        >
          {rowContent}
        </Pressable>
        {showBottomDivider && <Divider />}
      </>
    );
  }

  return (
    <>
      {showTopDivider && <Divider />}
      <View style={[containerStyle, style]}>{rowContent}</View>
      {showBottomDivider && <Divider />}
    </>
  );
}
