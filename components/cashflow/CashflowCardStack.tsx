import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../ui/theme/useTheme';
import { spacing } from '../../spacing';
import { layout } from '../../layout';

interface CashflowCardStackProps {
  children: React.ReactNode;
}

export default function CashflowCardStack({ children }: CashflowCardStackProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.cashflowCardStack}>
      <View style={styles.cashflowCardsWrapper}>
        <View style={[styles.cashflowSpine, { backgroundColor: theme.colors.border.subtle, opacity: 0.3 }]} />
        <View style={styles.cashflowCentered}>{children}</View>
      </View>
      {/* End padding for Cash Flow section */}
      <View style={styles.cashflowEndSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  cashflowCardStack: {
    position: 'relative',
    width: '100%',
    paddingLeft: layout.inputPadding - 4, // 6px - shifted right
    paddingRight: 0, // Eliminated to reclaim space and anchor cards to right edge
  },
  cashflowCardsWrapper: {
    position: 'relative',
    width: '100%',
  },
  cashflowSpine: {
    position: 'absolute',
    left: spacing.xl,
    top: spacing.xs,
    bottom: spacing.sm,
    width: 1,
    zIndex: 0,
  },
  cashflowCentered: {
    width: '100%',
    zIndex: 1,
  },
  cashflowEndSpacer: {
    height: spacing.sm,
  },
});
