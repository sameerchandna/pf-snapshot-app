import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import { layout } from '../layout';
import { spacing } from '../spacing';
import { useThemeContext, type ThemeOverride } from '../ui/theme/ThemeContext';
import { useTheme } from '../ui/theme/useTheme';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { themeOverride, setThemeOverride } = useThemeContext();
  const { theme } = useTheme();
  
  const handleThemeChange = (event: any) => {
    const index = event.nativeEvent.selectedSegmentIndex;
    const override: ThemeOverride = index === 0 ? 'light' : index === 1 ? 'dark' : 'system';
    setThemeOverride(override);
  };
  
  const themeSelectedIndex = themeOverride === 'light' ? 0 : themeOverride === 'dark' ? 1 : 2;
  
  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.card }]}>
      <ScreenHeader title="Settings" />
      <View style={styles.content}>
        <View style={styles.section}>
          <GroupHeader title="Profiles" />
          <Pressable
            onPress={() => navigation.navigate('Profiles')}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                borderColor: theme.colors.border.subtle,
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Profiles"
          >
            <View style={styles.rowLeft}>
              <Text style={[styles.rowTitle, { color: theme.colors.text.tertiary }]}>Profiles</Text>
              <Text style={[styles.rowSubtitle, { color: theme.colors.text.muted }]}>Manage local profiles</Text>
            </View>
            <Text style={[styles.rowChevron, { color: theme.colors.text.disabled }]} accessible={false}>
              {'\u203A'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.section}>
          <GroupHeader title="Appearance (Testing)" />
          <View style={styles.themeToggleContainer}>
            <Text style={[styles.themeToggleLabel, { color: theme.colors.text.secondary }]}>
              Theme override for testing dark mode
            </Text>
            <SegmentedControl
              values={['Light', 'Dark', 'System']}
              selectedIndex={themeSelectedIndex}
              onChange={handleThemeChange}
              style={styles.segmentedControl}
              fontStyle={{ color: theme.colors.text.disabled }}
              activeFontStyle={{ color: theme.colors.text.primary }}
            />
          </View>
        </View>
        <View style={styles.section}>
          <GroupHeader title="Advanced" />
          <Pressable
            onPress={() => navigation.navigate('A3Validation')}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                borderColor: theme.colors.border.subtle,
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="A3 validation"
          >
            <View style={styles.rowLeft}>
              <Text style={[styles.rowTitle, { color: theme.colors.text.tertiary }]}>A3 Validation</Text>
              <Text style={[styles.rowSubtitle, { color: theme.colors.text.muted }]}>Inspect attribution totals and reconciliation</Text>
            </View>
            <Text style={[styles.rowChevron, { color: theme.colors.text.disabled }]} accessible={false}>
              {'\u203A'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('ProjectionRefactorValidation')}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                borderColor: theme.colors.border.subtle,
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Projection refactor validation"
          >
            <View style={styles.rowLeft}>
              <Text style={[styles.rowTitle, { color: theme.colors.text.tertiary }]}>Refactor Validation</Text>
              <Text style={[styles.rowSubtitle, { color: theme.colors.text.muted }]}>Validate projection engine refactor</Text>
            </View>
            <Text style={[styles.rowChevron, { color: theme.colors.text.disabled }]} accessible={false}>
              {'\u203A'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('SnapshotDataSummary')}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                borderColor: theme.colors.border.subtle,
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Snapshot Data Summary"
          >
            <View style={styles.rowLeft}>
              <Text style={[styles.rowTitle, { color: theme.colors.text.tertiary }]}>Snapshot Data Summary</Text>
              <Text style={[styles.rowSubtitle, { color: theme.colors.text.muted }]}>View raw financial inputs (read-only)</Text>
            </View>
            <Text style={[styles.rowChevron, { color: theme.colors.text.disabled }]} accessible={false}>
              {'\u203A'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: layout.screenPadding,
  },
  section: {
    gap: layout.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.md,
  },
  rowLeft: {
    flex: 1,
    paddingRight: layout.md,
    gap: layout.micro,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
  },
  rowChevron: {
    fontSize: 18,
  },
  themeToggleContainer: {
    gap: spacing.sm,
  },
  themeToggleLabel: {
    fontSize: 12,
  },
  segmentedControl: {
    height: 32,
  },
});


