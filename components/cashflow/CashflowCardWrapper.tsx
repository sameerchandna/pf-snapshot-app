import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../ui/spacing';

interface CashflowCardWrapperProps {
  children: React.ReactNode;
  marginTop?: number;
  isLast?: boolean;
}

export default function CashflowCardWrapper({
  children,
  marginTop,
  isLast = false,
}: CashflowCardWrapperProps) {
  return (
    <View style={[styles.cashflowCardWrapper, isLast && styles.cashflowLastCard, marginTop !== undefined && { marginTop }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cashflowCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  cashflowLastCard: {
    marginBottom: 0,
  },
});
