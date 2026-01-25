import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  totalText?: string;
  subtitle?: string;
  subtitleFootnote?: string;
  rightAccessory?: React.ReactNode;
};

/**
 * Standard app-wide screen header.
 * Matches the existing "detail/card" header pattern: fixed header, iOS spacing, bottom divider.
 */
export default function ScreenHeader({ title, totalText, subtitle, subtitleFootnote, rightAccessory }: Props) {
  return (
    <View style={[styles.header, styles.safeHeader]}>
      <Text style={styles.title}>{title}</Text>
      {totalText ? <Text style={styles.headerTotal}>{totalText}</Text> : null}
      {subtitle ? <Text style={[styles.subtitle, totalText ? styles.subtitleAfterTotal : null]}>{subtitle}</Text> : null}
      {subtitleFootnote ? <Text style={styles.subtitleFootnote}>{subtitleFootnote}</Text> : null}
      {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  safeHeader: {
    marginTop: Platform.OS === 'ios' ? 10 : 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
  },
  subtitleAfterTotal: {
    marginTop: 8,
  },
  subtitleFootnote: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  headerTotal: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  rightAccessory: {
    position: 'absolute',
    right: 16,
    top: 18,
  },
});


