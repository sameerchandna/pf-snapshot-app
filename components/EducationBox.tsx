import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing } from '../spacing';

type Props = {
  lines: string[];
  insight?: string;
  title?: string;
  variant?: 'default' | 'warning';
};

export default function EducationBox({ lines, insight, title, variant = 'default' }: Props) {
  const trimmedLines = lines.map(l => l.trim()).filter(l => l.length > 0).slice(0, 2);
  const trimmedInsight = (insight ?? '').trim();
  const trimmedTitle = (title ?? '').trim();
  if (trimmedLines.length === 0 && trimmedInsight.length === 0 && trimmedTitle.length === 0) return null;

  const bodyText = trimmedLines.join(' ');
  const containerStyle = variant === 'warning' ? styles.containerWarning : styles.container;

  return (
    <View style={containerStyle}>
      {trimmedTitle.length > 0 ? <Text style={styles.title}>{trimmedTitle}</Text> : null}
      {bodyText.length > 0 ? <Text style={styles.text}>{bodyText}</Text> : null}
      {trimmedInsight.length > 0 ? (
        <Text style={[styles.text, bodyText.length > 0 ? styles.insightSpacing : null]}>{trimmedInsight}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    // Slightly denser, token-based padding (applies consistently to all EducationBox instances).
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  containerWarning: {
    backgroundColor: '#fff7db',
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5a4b1b',
    marginBottom: 6,
  },
  text: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  insightSpacing: {
    marginTop: 6,
  },
});


