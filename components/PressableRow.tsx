import React, { ReactNode } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import Divider from './Divider';

type Props = {
  onPress?: () => void;
  disabled?: boolean;
  leading?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Row component for pressable list-row layout primitives.
 * 
 * Provides consistent hit target, flexible height (1-line or 2-line content),
 * and leading/content/trailing layout slots with optional dividers.
 * 
 * Uses Pressable when onPress is provided, otherwise View (non-interactive).
 * Spacing (margins) is the caller's responsibility.
 */
export default function Row({
  onPress,
  disabled = false,
  leading,
  children,
  trailing,
  showTopDivider = false,
  showBottomDivider = true,
  style,
}: Props) {
  const { theme } = useTheme();

  const isPressable = onPress !== undefined;

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: layout.rowPaddingHorizontal,
    paddingVertical: layout.rowPaddingVertical,
  };

  const content = (
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
      <View style={{ flex: 1 }}>{children}</View>
      {trailing && (
        <View
          style={{
            marginLeft: spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {trailing}
        </View>
      )}
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
          {content}
        </Pressable>
        {showBottomDivider && <Divider />}
      </>
    );
  }

  return (
    <>
      {showTopDivider && <Divider />}
      <View style={[containerStyle, style]}>{content}</View>
      {showBottomDivider && <Divider />}
    </>
  );
}
