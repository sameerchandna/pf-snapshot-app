import React, { useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { spacing } from '../spacing';
import type { AssetItem } from '../types';
import { formatCurrencyFull } from '../formatters';

type Props = {
  title: string;
  subtitle: string;
  onPress: () => void;
  assets: AssetItem[];
  // Phase Two: scenario state callbacks
  scenarioState?: {
    assetId: string | null;
    monthlyAmount: number;
  };
  onScenarioChange?: (assetId: string | null, monthlyAmount: number) => void;
  onClearScenario?: () => void;
  // V1 Affordability: available cash from Snapshot
  availableToAllocate?: number;
  scenarioValidationError?: string | null;
};

export default function AssumptionsPill({ title, subtitle, onPress, assets, scenarioState, onScenarioChange, onClearScenario, availableToAllocate, scenarioValidationError }: Props) {
  const [whatIfExpanded, setWhatIfExpanded] = useState(false);
  const [selectedScenarioType, setSelectedScenarioType] = useState<string | null>(null);
  // Phase Two: use controlled state from parent if provided, otherwise local state
  const [localAmountInput, setLocalAmountInput] = useState<string>('');
  const [localSelectedAsset, setLocalSelectedAsset] = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState<boolean>(false);

  // Use controlled state if provided, otherwise use local state
  // For amountInput: prefer local state if user is typing (to show what they typed even if invalid)
  // Only use scenarioState if there's no local input and scenario is committed
  const amountInput = localAmountInput !== '' ? localAmountInput : (scenarioState ? String(scenarioState.monthlyAmount || '') : '');
  const selectedAsset = scenarioState ? scenarioState.assetId : localSelectedAsset;

  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: whatIfExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [whatIfExpanded, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const handleWhatIfToggle = () => {
    const newExpanded = !whatIfExpanded;
    setWhatIfExpanded(newExpanded);
    // Auto-set scenario type when expanding (for Phase One, only one option)
    if (newExpanded && !selectedScenarioType) {
      setSelectedScenarioType('Increase monthly investing');
    }
  };

  const handleClearScenario = () => {
    setWhatIfExpanded(false);
    setSelectedScenarioType(null);
    setLocalAmountInput(''); // Always clear local input
    if (onClearScenario) {
      onClearScenario();
    } else {
      setLocalSelectedAsset(null);
    }
  };

  const handleSelectAsset = (assetId: string) => {
    if (onScenarioChange) {
      const amount = parseFloat(amountInput) || 0;
      onScenarioChange(assetId, amount);
    } else {
      setLocalSelectedAsset(assetId);
    }
    setAssetPickerOpen(false);
  };

  const handleAmountChange = (text: string) => {
    const numValue = parseFloat(text) || 0;
    // Always update local input for immediate UI feedback (even if scenarioState exists)
    setLocalAmountInput(text);
    // Call onScenarioChange - parent will validate before committing
    if (onScenarioChange) {
      onScenarioChange(selectedAsset, numValue);
    }
  };

  const getAssetName = (assetId: string | null): string => {
    if (!assetId) return '';
    const asset = assets.find(a => a.id === assetId);
    return asset ? asset.name : 'Unknown asset';
  };

  const formatAssetMetadata = (asset: AssetItem): string | null => {
    const parts: string[] = [];
    
    // Growth rate
    if (typeof asset.annualGrowthRatePct === 'number' && Number.isFinite(asset.annualGrowthRatePct)) {
      parts.push(`${asset.annualGrowthRatePct.toLocaleString('en-GB', { maximumFractionDigits: 2 })}%`);
    }
    
    // Liquidity
    const avail = asset.availability ?? { type: 'immediate' };
    const liquidityLabel = avail.type === 'immediate' ? 'Liquid' : avail.type === 'locked' ? 'Locked' : 'Illiquid';
    parts.push(liquidityLabel);
    
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  return (
    <View>
      {/* View Assumptions Section (separate card) */}
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: pressed ? styles.pillPressed.backgroundColor : styles.pill.backgroundColor,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Projection assumptions"
      >
        <View style={styles.row}>
          <View style={styles.textBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Text style={styles.triangle} accessible={false}>
            {'\u25B6'}
          </Text>
        </View>
      </Pressable>

      {/* Try a what-if Section (separate card, expandable) */}
      <View style={[styles.pill, styles.whatIfPill]}>
        <Pressable
          onPress={handleWhatIfToggle}
          hitSlop={8}
          style={({ pressed }) => [
            styles.whatIfButton,
            {
              backgroundColor: pressed ? styles.pillPressed.backgroundColor : 'transparent',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Try a what-if scenario"
        >
          <View style={styles.row}>
            <View style={styles.textBlock}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  Try a what-if
                </Text>
                {scenarioState && scenarioState.assetId && scenarioState.monthlyAmount > 0 && (
                  <View style={styles.activeDot} />
                )}
              </View>
              <Text style={styles.subtitle} numberOfLines={1}>
                Explore how a small monthly change affects your future
              </Text>
            </View>
            <Animated.Text style={[styles.triangle, { transform: [{ rotate }] }]} accessible={false}>
              {'\u25B6'}
            </Animated.Text>
          </View>
        </Pressable>

        {/* Expanded what-if content (inside the what-if card) */}
        {whatIfExpanded ? (
          <View style={styles.expandedContent}>
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
              {/* Helper Text - moved here with minimal spacing */}
              <Text style={styles.helperText}>
                Uses this asset's growth assumptions and applies during your earning years only.
              </Text>
            </View>

            {/* Amount Input */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Extra amount per month</Text>
              <TextInput
                style={[styles.amountInput, scenarioValidationError ? styles.amountInputError : null]}
                value={amountInput}
                onChangeText={handleAmountChange}
                placeholder="0"
                keyboardType="numeric"
                returnKeyType="done"
              />
              {/* Available to Allocate Display - muted, italic, minimal spacing */}
              {availableToAllocate !== undefined && (
                <Text style={styles.availableCashText}>
                  Available to invest: {formatCurrencyFull(availableToAllocate)} / month
                </Text>
              )}
              {/* Conditional: Show validation error */}
              {scenarioValidationError ? (
                <View style={styles.validationErrorContainer}>
                  <Text style={styles.validationErrorText}>{scenarioValidationError}</Text>
                </View>
              ) : null}
            </View>

            {/* Divider above Clear Scenario */}
            <View style={styles.divider} />

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
      </View>

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
              {assets.map(asset => {
                const metadata = formatAssetMetadata(asset);
                return (
                  <Pressable
                    key={asset.id}
                    onPress={() => handleSelectAsset(asset.id)}
                    style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <View style={styles.modalOptionContent}>
                      <Text style={styles.modalOptionText}>{asset.name}</Text>
                      {metadata ? (
                        <Text style={styles.modalOptionMetadata}>{metadata}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
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
  pill: {
    width: '100%',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: spacing.sm,
  },
  pillPressed: {
    backgroundColor: '#f5f5f5',
  },
  whatIfPill: {
    marginTop: spacing.xs,
  },
  whatIfButton: {
    borderRadius: 8,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2F5BEA',
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
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  fieldContainer: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    marginBottom: spacing.xs,
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
  availableCashText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#666',
    marginTop: spacing.xs,
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
  amountInputError: {
    borderColor: '#d32f2f',
    borderWidth: 1.5,
  },
  validationErrorContainer: {
    marginTop: spacing.xs,
  },
  validationErrorText: {
    fontSize: 12,
    color: '#d32f2f',
    lineHeight: 16,
  },
  helperTextContainer: {
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#666',
    marginTop: spacing.xs,
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginTop: spacing.xs,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667085',
    textAlign: 'left',
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
  modalOptionContent: {
    flexDirection: 'column',
    gap: 2,
  },
  modalOptionText: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
  },
  modalOptionMetadata: {
    fontSize: 12,
    color: '#777',
    fontWeight: '400',
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});
