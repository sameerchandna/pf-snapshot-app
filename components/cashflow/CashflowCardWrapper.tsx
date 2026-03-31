import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../ui/theme/useTheme';
import IconButton from '../IconButton';
import { spacing } from '../../ui/spacing';

interface CashflowCardWrapperProps {
  children: React.ReactNode;
  showAddIcon?: boolean;
  onAddPress?: () => void;
  marginTop?: number;
  isLast?: boolean;
  reserveActionSpace?: boolean;
}

export default function CashflowCardWrapper({
  children,
  showAddIcon = false,
  onAddPress,
  marginTop,
  isLast = false,
  reserveActionSpace = true,
}: CashflowCardWrapperProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.cashflowCardWrapper, isLast && styles.cashflowLastCard, marginTop !== undefined && { marginTop }]}>
      {children}
      {showAddIcon && onAddPress ? (
        <IconButton
          icon="plus"
          size="md"
          variant="default"
          onPress={onAddPress}
          accessibilityLabel="Add"
          style={styles.addIconContainer}
        />
      ) : reserveActionSpace ? (
        <View style={styles.actionColumnSpacer} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cashflowCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.tiny, // Reduced from spacing.xs (6px) to spacing.tiny (4px)
  },
  cashflowLastCard: {
    marginBottom: 0,
  },
  addIconContainer: {
    alignSelf: 'center',
    transform: [{ translateY: -4 }],
  },
  actionColumnSpacer: {
    width: 32,
    height: 44,
  },
});
