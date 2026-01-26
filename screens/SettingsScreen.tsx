import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import { layout } from '../layout';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader title="Settings" />
      <View style={styles.content}>
        <View style={styles.section}>
          <GroupHeader title="Profiles" />
          <Pressable
            onPress={() => navigation.navigate('Profiles')}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Profiles"
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>Profiles</Text>
              <Text style={styles.rowSubtitle}>Manage local profiles</Text>
            </View>
            <Text style={styles.rowChevron} accessible={false}>
              {'\u203A'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.section}>
          <GroupHeader title="Advanced" />
          <Pressable
            onPress={() => navigation.navigate('A3Validation')}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="A3 validation"
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>A3 Validation</Text>
              <Text style={styles.rowSubtitle}>Inspect attribution totals and reconciliation</Text>
            </View>
            <Text style={styles.rowChevron} accessible={false}>
              {'\u203A'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('ProjectionRefactorValidation')}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Projection refactor validation"
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>Refactor Validation</Text>
              <Text style={styles.rowSubtitle}>Validate projection engine refactor</Text>
            </View>
            <Text style={styles.rowChevron} accessible={false}>
              {'\u203A'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('SnapshotDataSummary')}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Snapshot Data Summary"
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>Snapshot Data Summary</Text>
              <Text style={styles.rowSubtitle}>View raw financial inputs (read-only)</Text>
            </View>
            <Text style={styles.rowChevron} accessible={false}>
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
    backgroundColor: '#fff',
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
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#f0f0f0',
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
    color: '#333',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  rowChevron: {
    fontSize: 18,
    color: '#bbb',
  },
});


