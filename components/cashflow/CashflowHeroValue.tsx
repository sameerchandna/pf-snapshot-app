import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../ui/theme/useTheme';
import { spacing } from '../../spacing';
import { layout } from '../../layout';

interface CashflowHeroValueProps {
  valueText: string;
  subtext: string;
}

export default function CashflowHeroValue({ valueText, subtext }: CashflowHeroValueProps) {
  const { theme } = useTheme();

  // Extract RGB from heroNumberGlow rgba string for shadowColor
  const glowColor = theme.colors.overlay.heroNumberGlow;
  // Parse rgba string to get RGB values (format: 'rgba(r, g, b, a)')
  const rgbMatch = glowColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  const shadowColor = rgbMatch ? `rgb(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]})` : glowColor;

  return (
    <View style={styles.cashFlowHero}>
      <Text
        style={[
          styles.cashFlowHeroValue,
          theme.typography.valueLarge,
          { color: theme.colors.text.primary },
          {
            shadowColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 8,
            elevation: 0, // Android shadow
          },
        ]}
      >
        {valueText}
      </Text>
      <Text style={[styles.cashFlowHeroSubtext, theme.typography.body, { color: theme.colors.text.muted }]}>
        {subtext}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cashFlowHero: {
    alignItems: 'center',
    marginTop: layout.sectionTitleBottom,
    marginBottom: spacing.base,
  },
  cashFlowHeroValue: {
    textAlign: 'center',
  },
  cashFlowHeroSubtext: {
    textAlign: 'center',
    marginTop: spacing.tiny,
  },
});
