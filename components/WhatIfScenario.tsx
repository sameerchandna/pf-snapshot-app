import React, { useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { spacing } from '../spacing';

type Props = {
  assets: Array<{ id: string; name: string }>;
};

export default function WhatIfScenario({ assets }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedScenarioType, setSelectedScenarioType] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState<boolean>(false);
  const [scenarioTypePickerOpen, setScenarioTypePickerOpen] = useState<boolean>(false);

  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isExpanded, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    // Auto-set scenario type when expanding (for Phase One, only one option)
    if (newExpanded && !selectedScenarioType) {
      setSelectedScenarioType('Increase monthly investing');
    }
  };

  const handleClearScenario = () => {
    setIsExpanded(false);
    setSelectedScenarioType(null);
    setAmountInput('');
    setSelectedAsset(null);
  };

  const handleSelectAsset = (assetId: string) => {
    setSelectedAsset(assetId);
    setAssetPickerOpen(false);
  };

  const handleSelectScenarioType = (type: string) => {
    setSelectedScenarioType(type);
    setScenarioTypePickerOpen(false);
  };

  const getAssetName = (assetId: string | null): string => {
    if (!assetId) return '';
    const asset = assets.find(a => a.id === assetId);
    return asset ? asset.name : 'Unknown asset';
  };

  const scenarioTypes = ['Increase monthly investing'];

  return (
    <View style={styles.container}>
      {/* Collapsed state: AssumptionsPill-style affordance */}
      <Pressable
        onPress={handleToggle}
        hitSlop={8}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: pressed ? styles.pillPressed.backgroundColor : styles.pill.backgroundColor,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Try a what-if scenario"
      >
        <View style={styles.row}>
          <View style={styles.textBlock}>
            <Text style={styles.title} numberOfLines={1}>
              Try a what-if
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              Explore how one small change affects your future
            </Text>
          </View>
          <Animated.Text style={[styles.triangle, { transform: [{ rotate }] }]} accessible={false}>
            {'\u25B6'}
          </Animated.Text>
        </View>
      </Pressable>

      {/* Expanded state */}
      {isExpanded ? (
        <View style={styles.expandedContent}>
          {/* Scenario Type (static for Phase One) */}
          <Text style={styles.scenarioTypeLabel}>Increase monthly investing</Text>

          {/* Asset Selector */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Apply to</Text>
            <Pressable
              onPress={() => {
                if (assets.length === 0) {
                  // For Phase One, just open picker even if empty (no navigation)
                  setAssetPickerOpen(true);
                  return;
                }
                setAssetPickerOpen(true);
              }}
              style={({ pressed }) => [styles.selector, { opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Select asset"
            >
              <View style={styles.selectorRow}>
                <Text
                  style={[styles.selectorValue, !selectedAsset ? styles.selectorPlaceholder : null]}
                  numberOfLines={1}
                >
                  {selectedAsset ? getAssetName(selectedAsset) : 'Select asset'}
                </Text>
                <Feather name="chevron-down" size={16} color="#777" />
              </View>
            </Pressable>
          </View>

          {/* Amount Input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>+ £ per month</Text>
            <TextInput
              style={styles.amountInput}
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder="0"
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          {/* Helper Text */}
          <View style={styles.helperTextContainer}>
            <Text style={styles.helperText}>Uses this asset's growth assumptions.</Text>
            <Text style={styles.helperText}>Applies during your earning years only.</Text>
          </View>

          {/* Clear Scenario Button */}
          <Pressable
            onPress={handleClearScenario}
            style={({ pressed }) => [styles.clearButton, { opacity: pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Clear scenario"
          >
            <Text style={styles.clearButtonText}>Clear scenario</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Scenario Type Picker Modal (hidden for Phase One, kept for future use) */}
      {false && (
        <Modal
          transparent={true}
          visible={scenarioTypePickerOpen}
          animationType="slide"
          onRequestClose={() => setScenarioTypePickerOpen(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalBackdrop} onPress={() => setScenarioTypePickerOpen(false)} />
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Select change type</Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
                {scenarioTypes.map(type => (
                  <Pressable
                    key={type}
                    onPress={() => handleSelectScenarioType(type)}
                    style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Text style={styles.modalOptionText}>{type}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Asset Picker Modal */}
      <Modal
        transparent={true}
        visible={assetPickerOpen}
        animationType="slide"
        onRequestClose={() => setAssetPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAssetPickerOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select asset</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {assets.map(asset => (
                <Pressable
                  key={asset.id}
                  onPress={() => handleSelectAsset(asset.id)}
                  style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.modalOptionText}>{asset.name}</Text>
                </Pressable>
              ))}
              {assets.length === 0 ? (
                <Text style={styles.modalEmptyText}>No assets available</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  pill: {
    width: '100%',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pillPressed: {
    backgroundColor: '#f5f5f5',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  textBlock: {
    gap: 2,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    fontSize: 12,
    color: '#667085',
  },
  triangle: {
    fontSize: 12,
    color: '#6f7a8c',
  },
  expandedContent: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  scenarioTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: spacing.sm,
  },
  fieldContainer: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    marginBottom: 4,
  },
  selector: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectorValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  selectorPlaceholder: {
    fontWeight: '500',
    color: '#777',
  },
  amountInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  helperTextContainer: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  helperText: {
    fontSize: 11,
    color: '#777',
    lineHeight: 16,
    marginBottom: 2,
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667085',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  modalList: {
    flexGrow: 0,
  },
  modalListContent: {
    paddingBottom: 12,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionText: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});
