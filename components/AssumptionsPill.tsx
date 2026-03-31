import React, { useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import type { AssetItem } from '../types';
import { formatCurrencyFull } from '../ui/formatters';
import { useTheme } from '../ui/theme/useTheme';
import Icon from './Icon';

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
  const { theme } = useTheme();
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
            backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Projection assumptions"
      >
        <View style={styles.row}>
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: theme.colors.text.primary }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Text style={[styles.triangle, { color: theme.colors.text.tertiary }]} accessible={false}>
            {'\u25B6'}
          </Text>
        </View>
      </Pressable>

      {/* Try a what-if Section (separate card, expandable) */}
      <View style={[styles.pill, styles.whatIfPill, { backgroundColor: theme.colors.bg.subtle }]}>
        <Pressable
          onPress={handleWhatIfToggle}
          hitSlop={8}
          style={({ pressed }) => [
            styles.whatIfButton,
            {
              backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Try a what-if scenario"
        >
          <View style={styles.row}>
            <View style={styles.textBlock}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: theme.colors.text.primary }]} numberOfLines={1}>
                  Try a what-if
                </Text>
                {scenarioState && scenarioState.assetId && scenarioState.monthlyAmount > 0 && (
                  <View style={[styles.activeDot, { backgroundColor: theme.colors.brand.primary }]} />
                )}
              </View>
              <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]} numberOfLines={1}>
                Explore how a small monthly change affects your future
              </Text>
            </View>
            <Animated.Text style={[styles.triangle, { color: theme.colors.text.tertiary, transform: [{ rotate }] }]} accessible={false}>
              {'\u25B6'}
            </Animated.Text>
          </View>
        </Pressable>

        {/* Expanded what-if content (inside the what-if card) */}
        {whatIfExpanded ? (
          <View style={styles.expandedContent}>
            {/* Asset Selector */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text.tertiary }]}>Apply to</Text>
              <Pressable
                onPress={() => {
                  if (assets.length === 0) {
                    // For Phase One, just open picker even if empty (no navigation)
                    setAssetPickerOpen(true);
                    return;
                  }
                  setAssetPickerOpen(true);
                }}
                style={({ pressed }) => [
                  styles.selector,
                  {
                    backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.card,
                    borderColor: theme.colors.border.default,
                  }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Select asset"
              >
                <View style={styles.selectorRow}>
                  <Text
                    style={[
                      styles.selectorValue,
                      { color: theme.colors.text.primary },
                      !selectedAsset ? [styles.selectorPlaceholder, { color: theme.colors.text.muted }] : null
                    ]}
                    numberOfLines={1}
                  >
                    {selectedAsset ? getAssetName(selectedAsset) : 'Select asset'}
                  </Text>
                  <Icon name="chevron-down" size="small" color={theme.colors.text.muted} />
                </View>
              </Pressable>
              {/* Helper Text - moved here with minimal spacing */}
              <Text style={[styles.helperText, { color: theme.colors.text.secondary }]}>
                Uses this asset's growth assumptions and applies during your earning years only.
              </Text>
            </View>

            {/* Amount Input */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text.tertiary }]}>Extra amount per month</Text>
              <TextInput
                style={[
                  styles.amountInput,
                  {
                    backgroundColor: theme.colors.bg.card,
                    borderColor: theme.colors.border.default,
                    color: theme.colors.text.primary,
                  },
                  scenarioValidationError ? [styles.amountInputError, { borderColor: theme.colors.semantic.error }] : null
                ]}
                value={amountInput}
                onChangeText={handleAmountChange}
                placeholder="0"
                keyboardType="numeric"
                returnKeyType="done"
              />
              {/* Available to Allocate Display - muted, italic, minimal spacing */}
              {availableToAllocate !== undefined && (
                <Text style={[styles.availableCashText, { color: theme.colors.text.secondary }]}>
                  Available to invest: {formatCurrencyFull(availableToAllocate)} / month
                </Text>
              )}
              {/* Conditional: Show validation error */}
              {scenarioValidationError ? (
                <View style={styles.validationErrorContainer}>
                  <Text style={[styles.validationErrorText, { color: theme.colors.semantic.errorText }]}>{scenarioValidationError}</Text>
                </View>
              ) : null}
            </View>

            {/* Divider above Clear Scenario */}
            <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />

            {/* Clear Scenario Button */}
            <Pressable
              onPress={handleClearScenario}
              style={({ pressed }) => [
                styles.clearButton,
                { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Clear scenario"
            >
              <Text style={[styles.clearButtonText, { color: theme.colors.text.secondary }]}>Clear scenario</Text>
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
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay.scrim25 }]} onPress={() => setAssetPickerOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>Select asset</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {assets.map(asset => {
                const metadata = formatAssetMetadata(asset);
                return (
                  <Pressable
                    key={asset.id}
                    onPress={() => handleSelectAsset(asset.id)}
                    style={({ pressed }) => [
                      styles.modalOption,
                      {
                        backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
                        borderBottomColor: theme.colors.border.subtle,
                      }
                    ]}
                  >
                    <View style={styles.modalOptionContent}>
                      <Text style={[styles.modalOptionText, { color: theme.colors.text.primary }]}>{asset.name}</Text>
                      {metadata ? (
                        <Text style={[styles.modalOptionMetadata, { color: theme.colors.text.muted }]}>{metadata}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              {assets.length === 0 ? (
                <Text style={[styles.modalEmptyText, { color: theme.colors.text.muted }]}>No assets available</Text>
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
    borderRadius: 12,
    padding: spacing.sm,
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
    gap: spacing.xs,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  triangle: {
    fontSize: 12,
  },
  expandedContent: {
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  fieldContainer: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  selector: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: layout.inputPadding,
    paddingHorizontal: spacing.base,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: layout.inputPadding,
  },
  selectorValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  selectorPlaceholder: {
    fontWeight: '500',
  },
  availableCashText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  amountInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: layout.inputPadding,
    fontSize: 14,
    fontWeight: '600',
  },
  amountInputError: {
    borderWidth: 1.5,
  },
  validationErrorContainer: {
    marginTop: spacing.xs,
  },
  validationErrorText: {
    fontSize: 12,
    lineHeight: 16,
  },
  helperTextContainer: {
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  clearButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    marginTop: spacing.xs,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'left',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
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
    marginBottom: layout.inputPadding,
  },
  modalList: {
    flexGrow: 0,
  },
  modalListContent: {
    paddingBottom: 12,
  },
  modalOption: {
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
  },
  modalOptionContent: {
    flexDirection: 'column',
    gap: 2,
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOptionMetadata: {
    fontSize: 12,
    fontWeight: '400',
  },
  modalEmptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: spacing.base,
  },
});
