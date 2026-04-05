import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import ScreenHeader from '../components/ScreenHeader';
import SketchBackground from '../components/SketchBackground';
import SectionHeader from '../components/SectionHeader';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { useThemeContext, type ThemeOverride } from '../ui/theme/ThemeContext';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { radius, typography } from '../ui/theme/theme';
import { useSnapshot } from '../context/SnapshotContext';
import { exportData, importData } from '../persistence/exportImport';
import { saveProfilesState } from '../persistence/profileStorage';
import { testProfile } from '../fixtures/testProfile';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { themeOverride, setThemeOverride } = useThemeContext();
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const { profilesState, reloadFromStorage } = useSnapshot();

  const handleExport = async () => {
    if (!profilesState) return;
    try {
      await exportData(profilesState);
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  const handleImport = () => {
    Alert.alert(
      'Import Profile Data',
      'This will replace all current data with the contents of the backup file. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: async () => {
            try {
              const imported = await importData();
              if (!imported) return;
              await saveProfilesState(imported);
              await reloadFromStorage();
            } catch (e) {
              Alert.alert('Import failed', String(e));
            }
          },
        },
      ]
    );
  };
  
  const handleLoadTestProfile = () => {
    Alert.alert(
      'Load Test Profile',
      'This will replace all current data with the test profile. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
          style: 'destructive',
          onPress: async () => {
            try {
              await saveProfilesState(testProfile);
              await reloadFromStorage();
            } catch (e) {
              Alert.alert('Load failed', String(e));
            }
          },
        },
      ]
    );
  };

  const handleThemeChange = (event: any) => {
    const index = event.nativeEvent.selectedSegmentIndex;
    const override: ThemeOverride = index === 0 ? 'light' : index === 1 ? 'dark' : 'system';
    setThemeOverride(override);
  };
  
  const themeSelectedIndex = themeOverride === 'light' ? 0 : themeOverride === 'dark' ? 1 : 2;
  
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.bg} style={styles.container}>
      <ScreenHeader title="Settings" />
      <View style={styles.content}>
        <View style={styles.section}>
          <SectionHeader title="Appearance (Testing)" />
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
          <SectionHeader title="Data" />
          <Pressable
            onPress={handleExport}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                borderColor: theme.colors.border.subtle,
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Export profile data"
          >
            <View style={styles.rowLeft}>
              <Text style={[styles.rowTitle, { color: theme.colors.text.tertiary }]}>Export Profile Data</Text>
              <Text style={[styles.rowSubtitle, { color: theme.colors.text.muted }]}>Save a backup file you can import on another device</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={handleImport}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                borderColor: theme.colors.border.subtle,
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Import profile data"
          >
            <View style={styles.rowLeft}>
              <Text style={[styles.rowTitle, { color: theme.colors.text.tertiary }]}>Import Profile Data</Text>
              <Text style={[styles.rowSubtitle, { color: theme.colors.text.muted }]}>Restore from a backup file (replaces current data)</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={handleLoadTestProfile}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                borderColor: theme.colors.border.subtle,
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Load test profile"
          >
            <View style={styles.rowLeft}>
              <Text style={[styles.rowTitle, { color: theme.colors.text.tertiary }]}>Load Test Profile</Text>
              <Text style={[styles.rowSubtitle, { color: theme.colors.text.muted }]}>Replace all data with the shared fixture (for testing)</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.section}>
          <SectionHeader title="Advanced" />
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
      </SketchBackground>
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
    gap: layout.sectionGap,
  },
  section: {
    gap: layout.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.md,
  },
  rowLeft: {
    flex: 1,
    paddingRight: layout.md,
    gap: layout.micro,
  },
  rowTitle: {
    ...typography.button,
  },
  rowSubtitle: {
    ...typography.body,
  },
  rowChevron: {
    ...typography.valueLarge,
  },
  themeToggleContainer: {
    gap: spacing.sm,
  },
  themeToggleLabel: {
    ...typography.body,
  },
  segmentedControl: {
    height: 32,
  },
});


