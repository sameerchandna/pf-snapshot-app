import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconWeight, CaretRight } from 'phosphor-react-native';
import { useTheme } from '../../ui/theme/useTheme';
import { spacing } from '../../ui/spacing';
import { layout } from '../../ui/layout';
import { radius } from '../../ui/theme/theme';

interface CashflowPrimaryCardProps {
  title: string;
  description: string;
  valueText: string;
  icon: React.ComponentType<{ size: number; color: string; weight: IconWeight; style?: any }>;
  iconColor: string;
  valueColor: string;
  isOutcome?: boolean;
  hasTint?: boolean;
  tintColor?: string;
  scenarioValueText?: string;
  deltaValueText?: string;
  iconOpacity?: number;
  onPress?: () => void;
}

export default function CashflowPrimaryCard({
  title,
  description,
  valueText,
  icon: Icon,
  iconColor,
  valueColor,
  isOutcome = false,
  hasTint = false,
  tintColor,
  scenarioValueText,
  deltaValueText,
  iconOpacity = 0.9,
  onPress,
}: CashflowPrimaryCardProps) {
  const { theme } = useTheme();
  const hasScenario = scenarioValueText !== undefined;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.cashflowRowContainer,
        styles.cashflowCard,
        styles.cashflowPrimaryCard,
        { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.muted, borderLeftWidth: 1, borderLeftColor: theme.colors.border.muted },
      ]}
    >
      {/* Subtle semantic tint overlay for visual emphasis (only for Remaining Free Cash) */}
      {hasTint && tintColor && (
        <View style={[styles.remainingFreeCashTint, { backgroundColor: tintColor, opacity: 0.06 }]} />
      )}
      <View style={{ position: 'absolute', left: spacing.sm, top: 0, bottom: 0, justifyContent: 'center', paddingRight: spacing.sm, zIndex: 1 }}>
        <Icon size={18} color={iconColor} weight="regular" style={{ opacity: iconOpacity }} />
      </View>
      <View style={styles.cashflowRowInner}>
        <View style={[styles.cashflowLabelStack, { paddingLeft: 18 + spacing.sm }]}>
          <Text style={[styles.cardTitle, theme.typography.value, { color: theme.colors.text.primary, fontWeight: '400' }]}>
            {title}
          </Text>
          <Text style={[styles.cardDescription, theme.typography.bodyLarge, { color: theme.colors.text.muted }]} numberOfLines={1} ellipsizeMode="tail">
            {description}
          </Text>
        </View>
        <View style={[styles.cashflowValueCol, hasScenario && styles.cashflowValueColWithScenario]}>
          {hasScenario ? (
            <View style={styles.cashflowValueRow}>
              {/* Baseline column (left) */}
              <View style={styles.cashflowValueBaselineCol}>
                <Text
                  style={[
                    styles.primaryValue,
                    isOutcome && styles.primaryValueOutcome,
                    styles.cashflowValueRight,
                    theme.typography.value,
                    { color: hasScenario ? theme.colors.text.muted : valueColor },
                  ]}
                >
                  {valueText}
                </Text>
              </View>
              {/* Scenario column (right) */}
              <View style={styles.cashflowValueScenarioCol}>
                <Text
                  style={[
                    styles.primaryValue,
                    styles.cashflowValueRight,
                    theme.typography.value,
                    { color: theme.colors.brand.primary },
                  ]}
                >
                  {scenarioValueText}
                </Text>
                {deltaValueText !== undefined && (
                  <Text
                    style={[
                      styles.deltaValue,
                      styles.cashflowValueRight,
                      theme.typography.body,
                      { color: theme.colors.semantic.infoText },
                    ]}
                  >
                    {deltaValueText}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <Text
              style={[
                styles.primaryValue,
                isOutcome && styles.primaryValueOutcome,
                styles.cashflowValueRight,
                theme.typography.value,
                { color: valueColor },
              ]}
            >
              {valueText}
            </Text>
          )}
        </View>
        <CaretRight size={14} color={onPress ? theme.colors.text.secondary : theme.colors.bg.card} weight="bold" style={{ marginLeft: spacing.xs }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cashflowRowContainer: {
    flex: 1,
    flexShrink: 1,
    paddingVertical: spacing.tiny,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.rounded,
    borderWidth: 1,
    zIndex: 1,
    minHeight: 28, // Ensures consistent base height for primary line (4px top + 20px lineHeight + 4px bottom)
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  cashflowCard: {
    position: 'relative',
  },
  cashflowPrimaryCard: {
    width: '100%',
  },
  remainingFreeCashTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.rounded,
    zIndex: 0,
  },
  cashflowRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: spacing.base,
  },
  cashflowLabelStack: {
    flex: 1,
    flexShrink: 1,
  },
  cashflowValueCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: spacing.base,
  },
  cashflowValueColWithScenario: {
    alignItems: 'flex-start',
  },
  cashflowValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  cashflowValueBaselineCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cashflowValueScenarioCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 80,
  },
  cashflowValueRight: {
    textAlign: 'right',
  },
  deltaValue: {
    marginTop: layout.componentGapTiny,
  },
  cardTitle: {
    // Typography moved to inline style with theme token
    marginBottom: layout.componentGapTiny,
  },
  primaryValue: {
    // Typography moved to inline style with theme token
    marginBottom: layout.componentGapTiny,
  },
  primaryValueOutcome: {
  },
  cardDescription: {
    // Typography moved to inline style with theme token
    marginTop: layout.componentGapTiny,
  },
});
