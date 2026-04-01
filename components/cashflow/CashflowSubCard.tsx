import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { IconWeight, CaretRight } from 'phosphor-react-native';
import { useTheme } from '../../ui/theme/useTheme';
import { spacing } from '../../ui/spacing';
import { layout } from '../../ui/layout';
import { radius } from '../../ui/theme/theme';

interface CashflowSubCardProps {
  title: string;
  description: string;
  valueText: string;
  icon: React.ComponentType<{ size: number; color: string; weight: IconWeight; style?: any }>;
  iconColor: string;
  borderColor: string;
  valueColor: string;
  scenarioValueText?: string;
  deltaValueText?: string;
  iconOpacity?: number;
  onPress?: () => void;
}

export default function CashflowSubCard({
  title,
  description,
  valueText,
  icon: Icon,
  iconColor,
  borderColor,
  valueColor,
  scenarioValueText,
  deltaValueText,
  iconOpacity = 0.9,
  onPress,
}: CashflowSubCardProps) {
  const { theme } = useTheme();
  const hasScenario = scenarioValueText !== undefined;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.cashflowRowContainer,
        styles.cashflowCard,
        styles.cashflowSubCard,
        { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.muted, borderLeftWidth: 2, borderLeftColor: borderColor },
      ]}
    >
      <View style={{ position: 'absolute', left: spacing.sm, top: 0, bottom: 0, justifyContent: 'center', paddingRight: spacing.sm, zIndex: 1 }}>
        <Icon size={18} color={iconColor} weight="regular" style={{ opacity: iconOpacity }} />
      </View>
      <View style={styles.cashflowRowInner}>
        <View style={[styles.cashflowLabelStack, { paddingLeft: 18 + spacing.sm }]}>
          <Text style={[styles.cardTitle, styles.subCardTitle, theme.typography.value, { color: theme.colors.text.secondary, fontWeight: '400' }]}>
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
                    styles.subCardValue,
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
                    styles.subCardValue,
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
                styles.subCardValue,
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
  cashflowSubCard: {
    marginLeft: spacing.xl + spacing.sm - layout.inputPadding + 16, // Increased by 16px for stronger indent
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
    marginTop: 2,
  },
  cardTitle: {
    // Typography moved to inline style with theme token
    marginBottom: 1,
  },
  subCardTitle: {
    // Subtle cue on label only; values remain equally prominent.
  },
  subCardValue: {
  },
  primaryValue: {
    // Typography moved to inline style with theme token
    marginBottom: 1,
  },
  cardDescription: {
    // Typography moved to inline style with theme token
    marginTop: 1,
  },
});
