import React, { useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import type { AssetItem } from '../types';
import { formatCurrencyFull } from '../ui/formatters';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { radius, typography } from '../ui/theme/theme';
import SketchCard from './SketchCard';
import Icon from './Icon';
import Divider from './Divider';

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
  const palette = useScreenPalette();
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
              <SketchCard
                borderColor={palette.accent}
                fillColor={theme.colors.bg.card}
                borderRadius={radius.medium}
              >
                <Pressable
                  onPress={() => setAssetPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.selectorInner,
                    { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' },
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
                    <Icon name="chevron-down-outline" size="small" color={theme.colors.text.muted} />
                  </View>
                </Pressable>
              </SketchCard>
              {/* Helper Text - moved here with minimal spacing */}
              <Text style={[styles.helperText, { color: theme.colors.text.secondary }]}>
                Uses this asset's growth assumptions and applies during your earning years only.
              </Text>
            </View>

            {/* Amount Input */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text.tertiary }]}>Extra amount per month</Text>
              <SketchCard
                borderColor={scenarioValidationError ? theme.colors.semantic.error : palette.accent}
                fillColor={theme.colors.bg.card}
                borderRadius={radius.medium}
                style={styles.amountInputWrapper}
              >
                <TextInput
                  style={[styles.amountInputInner, { color: theme.colors.text.primary }]}
                  value={amountInput}
                  onChangeText={handleAmountChange}
                  placeholder="0"
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </SketchCard>
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
              {assets.map((asset, index) => {
                const metadata = formatAssetMetadata(asset);
                const isLast = index === assets.length - 1;
                return (
                  <React.Fragment key={asset.id}>
                    <Pressable
                      onPress={() => handleSelectAsset(asset.id)}
                      style={({ pressed }) => [
                        styles.modalOption,
                        { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' },
                      ]}
                    >
                      <View style={styles.modalOptionContent}>
                        <Text style={[styles.modalOptionText, { color: theme.colors.text.primary }]}>{asset.name}</Text>
                        {metadata ? (
                          <Text style={[styles.modalOptionMetadata, { color: theme.colors.text.muted }]}>{metadata}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                    {!isLast && <Divider variant="subtle" />}
                  </React.Fragment>
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
    borderRadius: radius.large,
    padding: spacing.sm,
  },
  whatIfPill: {
    marginTop: spacing.xs,
  },
  whatIfButton: {
    borderRadius: radius.medium,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  textBlock: {
    gap: layout.componentGapTiny,
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
    borderRadius: radius.small,
  },
  title: {
    ...typography.button,
  },
  subtitle: {
    ...typography.body,
  },
  triangle: {
    ...typography.body,
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
    ...typography.label,
    marginBottom: spacing.xs,
  },
  selectorInner: {
    paddingVertical: layout.inputPadding,
    paddingHorizontal: spacing.base,
    alignSelf: 'stretch',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: layout.inputPadding,
  },
  selectorValue: {
    flex: 1,
    ...typography.valueSmall,
  },
  selectorPlaceholder: {
    fontWeight: '400',
  },
  availableCashText: {
    ...typography.bodySmall,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  amountInputWrapper: {
    // layout only — border drawn by SketchCard
  },
  amountInputInner: {
    padding: layout.inputPadding,
    ...typography.valueSmall,
    alignSelf: 'stretch',
  },
  validationErrorContainer: {
    marginTop: spacing.xs,
  },
  validationErrorText: {
    ...typography.body,
  },
  helperTextContainer: {
    marginTop: spacing.xs,
  },
  helperText: {
    ...typography.bodySmall,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  clearButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.zero,
    marginTop: spacing.xs,
  },
  clearButtonText: {
    ...typography.valueSmall,
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
    borderTopLeftRadius: radius.modal,
    borderTopRightRadius: radius.modal,
    paddingHorizontal: spacing.xl,
    paddingTop: layout.modalPaddingTop,
    paddingBottom: layout.modalPaddingBottom,
    maxHeight: '70%',
  },
  modalTitle: {
    ...typography.sectionTitle,
    marginBottom: layout.inputPadding,
  },
  modalList: {
    flexGrow: 0,
  },
  modalListContent: {
    paddingBottom: spacing.base,
  },
  modalOption: {
    paddingVertical: spacing.base,
  },
  modalOptionContent: {
    flexDirection: 'column',
    gap: layout.componentGapTiny,
  },
  modalOptionText: {
    ...typography.valueSmall,
  },
  modalOptionMetadata: {
    ...typography.body,
  },
  modalEmptyText: {
    ...typography.bodyLarge,
    fontStyle: 'italic',
    paddingVertical: spacing.base,
  },
});
