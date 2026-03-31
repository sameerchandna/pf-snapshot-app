import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing } from '../ui/spacing';
import { useTheme } from '../ui/theme/useTheme';
import { typography, radius } from '../ui/theme/theme';

type Props = {
  lines: string[];
  insight?: string;
  title?: string;
  variant?: 'default' | 'warning';
};

export default function EducationBox({ lines, insight, title, variant = 'default' }: Props) {
  const { theme } = useTheme();
  const trimmedLines = lines.map(l => l.trim()).filter(l => l.length > 0).slice(0, 2);
  const trimmedInsight = (insight ?? '').trim();
  const trimmedTitle = (title ?? '').trim();
  if (trimmedLines.length === 0 && trimmedInsight.length === 0 && trimmedTitle.length === 0) return null;

  const bodyText = trimmedLines.join(' ');
  const containerStyle = variant === 'warning' 
    ? [styles.containerWarning, { backgroundColor: theme.colors.semantic.warningBg }]
    : [styles.container, { backgroundColor: theme.colors.bg.subtle }];

  return (
    <View style={containerStyle}>
      {trimmedTitle.length > 0 ? (
        <Text style={[styles.title, { color: variant === 'warning' ? theme.colors.semantic.warningText : theme.colors.text.tertiary }]}>
          {trimmedTitle}
        </Text>
      ) : null}
      {bodyText.length > 0 ? <Text style={[styles.text, { color: theme.colors.text.tertiary }]}>{bodyText}</Text> : null}
      {trimmedInsight.length > 0 ? (
        <Text style={[styles.text, { color: theme.colors.text.tertiary }, bodyText.length > 0 ? styles.insightSpacing : null]}>{trimmedInsight}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.medium,
    // Slightly denser, token-based padding (applies consistently to all EducationBox instances).
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  containerWarning: {
    borderRadius: radius.medium,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  title: {
    ...typography.label,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  text: {
    ...typography.bodyMedium,
  },
  insightSpacing: {
    marginTop: spacing.xs,
  },
});


