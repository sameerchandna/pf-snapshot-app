import React from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../ui/theme/useTheme';

interface GroupedListSectionProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * GroupedListSection - Container for grouped list sections matching Apple Settings style.
 * 
 * Features:
 * - borderRadius: 10 (Apple standard for grouped lists)
 * - backgroundColor: bg.card (white group surface)
 * - overflow: 'hidden' (clips content to rounded corners)
 * - NO internal padding (rows handle their own padding)
 * 
 * Used specifically for EditableCollectionScreen grouped lists to match iOS Settings appearance.
 */
export default function GroupedListSection({ children, style }: GroupedListSectionProps) {
  const { theme } = useTheme();
  
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg.card,
          borderRadius: theme.radius.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    // No padding - rows handle their own 16pt horizontal padding
  },
});
