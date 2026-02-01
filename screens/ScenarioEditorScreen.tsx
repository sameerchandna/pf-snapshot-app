import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import EducationBox from '../components/EducationBox';
import Button from '../components/Button';
import { useSnapshot } from '../SnapshotContext';
import { getUserEditableAssets } from '../systemAssets';
import { formatCurrencyFull, formatCurrencyFullSigned } from '../formatters';
import { layout } from '../layout';
import { UI_TOLERANCE } from '../constants';
import { selectMonthlySurplus } from '../selectors';
import type { Scenario, ScenarioId, ScenarioKind, FlowToAssetScenario, FlowToDebtScenario } from '../domain/scenario/types';
import { BASELINE_SCENARIO_ID } from '../domain/scenario/types';
import { validateScenario } from '../domain/scenario/validation';
import { getScenarios, saveScenario, setActiveScenarioId } from '../scenarioState';
import { useTheme } from '../ui/theme/useTheme';

type RouteParams = {
  scenarioId?: ScenarioId;
};

// Generate preview text for a scenario
function getScenarioPreviewText(
  kind: ScenarioKind | null,
  assetId: string | null,
  liabilityId: string | null,
  amountMonthly: number,
  assets: Array<{ id: string; name: string }>,
  liabilities: Array<{ id: string; name: string }>
): string {
  if (!kind || amountMonthly <= 0) return '';

  if (kind === 'FLOW_TO_ASSET' && assetId) {
    const asset = assets.find(a => a.id === assetId);
    const assetName = asset ? asset.name : 'Unknown asset';
    return `This scenario adds ${formatCurrencyFull(amountMonthly)} per month to your ${assetName} contributions.`;
  }

  if (kind === 'FLOW_TO_DEBT' && liabilityId) {
    const liability = liabilities.find(l => l.id === liabilityId);
    const liabilityName = liability ? liability.name : 'Unknown loan';
    return `This scenario pays an extra ${formatCurrencyFull(amountMonthly)} per month off your ${liabilityName}.`;
  }

  return '';
}

export default function ScenarioEditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { state } = useSnapshot();
  const { theme } = useTheme();
  const params = (route.params as RouteParams) || {};
  const isEdit = params.scenarioId !== undefined;

  // Load existing scenario if editing
  const [existingScenario, setExistingScenario] = useState<Scenario | null>(null);
  const [scenarioKind, setScenarioKind] = useState<ScenarioKind | null>(null);
  const [name, setName] = useState<string>('');
  const [assetId, setAssetId] = useState<string | null>(null);
  const [liabilityId, setLiabilityId] = useState<string | null>(null);
  const [amountMonthly, setAmountMonthly] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Modal states
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [liabilityPickerOpen, setLiabilityPickerOpen] = useState(false);

  // Load scenario if editing
  useEffect(() => {
    async function loadScenario() {
      if (isEdit && params.scenarioId) {
        // Guard: baseline cannot be edited
        if (params.scenarioId === BASELINE_SCENARIO_ID) {
          navigation.goBack();
          return;
        }
        const scenarios = await getScenarios();
        const scenario = scenarios.find(s => s.id === params.scenarioId);
        if (scenario) {
          setExistingScenario(scenario);
          setScenarioKind(scenario.kind);
          setName(scenario.name);
          if (scenario.kind === 'FLOW_TO_ASSET') {
            setAssetId(scenario.assetId);
            setAmountMonthly(String(scenario.amountMonthly));
          } else {
            setLiabilityId(scenario.liabilityId);
            setAmountMonthly(String(scenario.amountMonthly));
          }
        }
      }
    }
    loadScenario();
  }, [isEdit, params.scenarioId, navigation]);

  // Lock kind after initial selection (for edit mode)
  const kindLocked = isEdit && existingScenario !== null;

  // Gate: Check if baseline surplus is negative (over-allocation)
  const baselineSurplus = selectMonthlySurplus(state);
  const isSurplusNegative = baselineSurplus < -UI_TOLERANCE;

  // Filter to only loan liabilities
  const loanLiabilities = useMemo(() => {
    return state.liabilities.filter(l => l.kind === 'loan');
  }, [state.liabilities]);

  // Preview text
  const previewText = useMemo(() => {
    return getScenarioPreviewText(scenarioKind, assetId, liabilityId, parseFloat(amountMonthly) || 0, getUserEditableAssets(state.assets), loanLiabilities);
  }, [scenarioKind, assetId, liabilityId, amountMonthly, state.assets, loanLiabilities]);

  // Handle save
  const handleSave = async () => {
    setErrorMessage('');

    // Validate kind is selected
    if (!scenarioKind) {
      setErrorMessage('Please select a scenario type');
      return;
    }

    // Validate name
    if (!name.trim()) {
      setErrorMessage('Please enter a scenario name');
      return;
    }

    // Validate asset/liability selection
    if (scenarioKind === 'FLOW_TO_ASSET' && !assetId) {
      setErrorMessage('Please select an asset');
      return;
    }
    if (scenarioKind === 'FLOW_TO_DEBT' && !liabilityId) {
      setErrorMessage('Please select a loan');
      return;
    }

    // Validate amount
    const amount = parseFloat(amountMonthly);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage('Please enter a valid monthly amount greater than 0');
      return;
    }

    // Create scenario object
    const scenarioId = isEdit && existingScenario ? existingScenario.id : `scenario_${Date.now()}`;
    let scenario: Scenario;

    if (scenarioKind === 'FLOW_TO_ASSET') {
      scenario = {
        id: scenarioId,
        name: name.trim(),
        kind: 'FLOW_TO_ASSET',
        assetId: assetId!,
        amountMonthly: amount,
      } as FlowToAssetScenario;
    } else {
      scenario = {
        id: scenarioId,
        name: name.trim(),
        kind: 'FLOW_TO_DEBT',
        liabilityId: liabilityId!,
        amountMonthly: amount,
      } as FlowToDebtScenario;
    }

    // Validate using domain validation
    const validation = validateScenario(scenario);
    if (!validation.ok) {
      setErrorMessage(validation.errors.join(', '));
      return;
    }

    // Save scenario
    try {
      await saveScenario(scenario);
      // Auto-activate and navigate back (only on create, preserve active on edit)
      // Gate: Do not auto-activate if baseline surplus is negative
      if (!isEdit && !isSurplusNegative) {
        await setActiveScenarioId(scenario.id);
      }
      navigation.navigate('ProjectionResults');
    } catch (error) {
      console.error('Failed to save scenario:', error);
      setErrorMessage('Failed to save scenario. Please try again.');
    }
  };

  // Handle cancel
  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.card }]}>
      <ScreenHeader title={isEdit ? 'Edit Scenario' : 'New Scenario'} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <EducationBox
          lines={[
            'Scenarios let you explore "what if" changes to your financial plan.',
            'They modify how you allocate available cash each month.',
          ]}
        />

        {/* Negative Surplus Banner */}
        {isSurplusNegative && (
          <View style={[styles.warningBanner, { backgroundColor: theme.colors.semantic.warningBg, borderColor: theme.colors.semantic.warning, borderRadius: theme.radius.medium }]}>
            <Text style={[styles.warningBannerText, { color: theme.colors.semantic.warningText, fontSize: theme.typography.bodyLarge.fontSize, lineHeight: theme.typography.bodyLarge.lineHeight }]}>
              Monthly surplus is negative ({formatCurrencyFullSigned(baselineSurplus)}). Reduce allocations or expenses before running what-ifs.
            </Text>
          </View>
        )}

        {/* Scenario Type Selection */}
        <View style={styles.section}>
          <GroupHeader title="Scenario Type" />
          {kindLocked ? (
            <View style={styles.lockedTypeRow}>
              <Text style={[styles.lockedTypeText, { color: theme.colors.text.secondary, fontSize: theme.typography.value.fontSize }]}>
                {existingScenario?.kind === 'FLOW_TO_ASSET' ? 'Invest more in an asset' : 'Pay down debt faster'}
              </Text>
            </View>
          ) : (
            <View style={styles.radioGroup}>
              <Pressable
                onPress={() => {
                  setScenarioKind('FLOW_TO_ASSET');
                  setLiabilityId(null);
                }}
                style={({ pressed }) => [
                  styles.radioOption,
                  { borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.medium },
                  pressed ? { backgroundColor: theme.colors.bg.subtle } : null,
                  scenarioKind === 'FLOW_TO_ASSET' ? { borderColor: theme.colors.brand.primary, backgroundColor: theme.colors.bg.subtle } : null
                ]}
              >
                <View style={[styles.radioCircle, { borderColor: theme.colors.text.secondary }]}>
                  {scenarioKind === 'FLOW_TO_ASSET' ? <View style={[styles.radioCircleInner, { backgroundColor: theme.colors.brand.primary }]} /> : null}
                </View>
                <Text style={[
                  styles.radioText,
                  { color: theme.colors.text.primary },
                  scenarioKind === 'FLOW_TO_ASSET' ? { color: theme.colors.brand.primary, fontWeight: '600' } : null
                ]}>
                  Invest more in an asset
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setScenarioKind('FLOW_TO_DEBT');
                  setAssetId(null);
                }}
                style={({ pressed }) => [
                  styles.radioOption,
                  { borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.medium },
                  pressed ? { backgroundColor: theme.colors.bg.subtle } : null,
                  scenarioKind === 'FLOW_TO_DEBT' ? { borderColor: theme.colors.brand.primary, backgroundColor: theme.colors.bg.subtle } : null
                ]}
              >
                <View style={[styles.radioCircle, { borderColor: theme.colors.text.secondary }]}>
                  {scenarioKind === 'FLOW_TO_DEBT' ? <View style={[styles.radioCircleInner, { backgroundColor: theme.colors.brand.primary }]} /> : null}
                </View>
                <Text style={[
                  styles.radioText,
                  { color: theme.colors.text.primary },
                  scenarioKind === 'FLOW_TO_DEBT' ? { color: theme.colors.brand.primary, fontWeight: '600' } : null
                ]}>
                  Pay down debt faster
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Scenario Details */}
        {scenarioKind && (
          <View style={styles.section}>
            <GroupHeader title="Scenario Details" />

            {/* Error Message */}
            {errorMessage ? (
              <View style={[styles.errorCard, { backgroundColor: theme.colors.semantic.errorBg, borderColor: theme.colors.semantic.errorBorder, borderRadius: theme.radius.medium }]}>
                <Text style={[styles.errorTitle, { color: theme.colors.semantic.errorText, fontSize: theme.typography.bodyLarge.fontSize, fontWeight: '700' }]}>Can't save</Text>
                <Text style={[styles.errorText, { color: theme.colors.semantic.errorText }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Name Input */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.colors.text.primary, fontSize: theme.typography.label.fontSize, fontWeight: theme.typography.label.fontWeight }]}>Name</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text.primary, borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.medium, fontSize: theme.typography.input.fontSize }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Extra investing"
                placeholderTextColor={theme.colors.text.muted}
                autoCapitalize="sentences"
                autoCorrect={false}
              />
            </View>

            {/* Asset/Liability Selector */}
            {scenarioKind === 'FLOW_TO_ASSET' ? (
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.colors.text.primary, fontSize: theme.typography.label.fontSize, fontWeight: theme.typography.label.fontWeight }]}>Asset</Text>
                <Pressable
                  onPress={() => setAssetPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.selector,
                    { borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.medium },
                    pressed ? { backgroundColor: theme.colors.bg.subtle } : null
                  ]}
                >
                  <View style={styles.selectorRow}>
                    <Text style={[
                      styles.selectorValue,
                      { color: theme.colors.text.primary, fontSize: theme.typography.input.fontSize },
                      !assetId ? { color: theme.colors.text.muted, fontWeight: '400' } : { fontWeight: '500' }
                    ]} numberOfLines={1}>
                      {assetId ? state.assets.find(a => a.id === assetId)?.name || 'Unknown asset' : 'Select asset'}
                    </Text>
                    <Text style={[styles.selectorChevron, { color: theme.colors.text.muted, fontSize: theme.typography.body.fontSize }]}>▼</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.colors.text.primary, fontSize: theme.typography.label.fontSize, fontWeight: theme.typography.label.fontWeight }]}>Loan</Text>
                <Pressable
                  onPress={() => setLiabilityPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.selector,
                    { borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.medium },
                    pressed ? { backgroundColor: theme.colors.bg.subtle } : null
                  ]}
                >
                  <View style={styles.selectorRow}>
                    <Text style={[
                      styles.selectorValue,
                      { color: theme.colors.text.primary, fontSize: theme.typography.input.fontSize },
                      !liabilityId ? { color: theme.colors.text.muted, fontWeight: '400' } : { fontWeight: '500' }
                    ]} numberOfLines={1}>
                      {liabilityId ? loanLiabilities.find(l => l.id === liabilityId)?.name || 'Unknown loan' : 'Select loan'}
                    </Text>
                    <Text style={[styles.selectorChevron, { color: theme.colors.text.muted, fontSize: theme.typography.body.fontSize }]}>▼</Text>
                  </View>
                </Pressable>
              </View>
            )}

            {/* Monthly Amount Input */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.colors.text.primary, fontSize: theme.typography.label.fontSize, fontWeight: theme.typography.label.fontWeight }]}>
                {scenarioKind === 'FLOW_TO_ASSET' ? 'Monthly amount (£)' : 'Monthly overpayment (£)'}
              </Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text.primary, borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.medium, fontSize: theme.typography.input.fontSize }]}
                value={amountMonthly}
                onChangeText={setAmountMonthly}
                placeholder="0"
                placeholderTextColor={theme.colors.text.muted}
                keyboardType="numeric"
              />
            </View>

            {/* Preview Text */}
            {previewText ? (
              <View style={[styles.previewCard, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium }]}>
                <Text style={[styles.previewText, { color: theme.colors.text.tertiary }]}>{previewText}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Button variant="secondary" size="md" onPress={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onPress={handleSave}>
            Save
          </Button>
        </View>
      </ScrollView>

      {/* Asset Picker Modal */}
      <Modal transparent={true} visible={assetPickerOpen} animationType="slide" onRequestClose={() => setAssetPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={[styles.modalBackdropFlex, { backgroundColor: theme.colors.overlay.scrim25 }]} onPress={() => setAssetPickerOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text.primary, fontSize: theme.typography.sectionTitle.fontSize, fontWeight: '700' }]}>Select asset</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {state.assets.map(asset => (
                <Pressable
                  key={asset.id}
                  onPress={() => {
                    setAssetId(asset.id);
                    setAssetPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.modalOption,
                    { borderBottomColor: theme.colors.border.subtle },
                    pressed ? { backgroundColor: theme.colors.bg.subtle } : null
                  ]}
                >
                  <Text style={[styles.modalOptionText, { color: theme.colors.text.primary, fontSize: theme.typography.bodyLarge.fontSize, fontWeight: '600' }]}>{asset.name}</Text>
                </Pressable>
              ))}
              {getUserEditableAssets(state.assets).length === 0 ? <Text style={[styles.modalEmptyText, { color: theme.colors.text.muted, fontSize: theme.typography.bodyLarge.fontSize }]}>No assets available</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Liability Picker Modal */}
      <Modal transparent={true} visible={liabilityPickerOpen} animationType="slide" onRequestClose={() => setLiabilityPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={[styles.modalBackdropFlex, { backgroundColor: theme.colors.overlay.scrim25 }]} onPress={() => setLiabilityPickerOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text.primary, fontSize: theme.typography.sectionTitle.fontSize, fontWeight: '700' }]}>Select loan</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {loanLiabilities.map(liability => (
                <Pressable
                  key={liability.id}
                  onPress={() => {
                    setLiabilityId(liability.id);
                    setLiabilityPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.modalOption,
                    { borderBottomColor: theme.colors.border.subtle },
                    pressed ? { backgroundColor: theme.colors.bg.subtle } : null
                  ]}
                >
                  <Text style={[styles.modalOptionText, { color: theme.colors.text.primary, fontSize: theme.typography.bodyLarge.fontSize, fontWeight: '600' }]}>{liability.name}</Text>
                </Pressable>
              ))}
              {loanLiabilities.length === 0 ? <Text style={[styles.modalEmptyText, { color: theme.colors.text.muted, fontSize: theme.typography.bodyLarge.fontSize }]}>No loans available</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: layout.screenPaddingBottom,
  },
  section: {
    marginTop: layout.sectionGap,
    paddingHorizontal: layout.screenPadding,
  },
  radioGroup: {
    gap: layout.componentGap,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.inputPaddingVertical,
    paddingHorizontal: layout.inputPaddingHorizontal,
    borderWidth: 1,
    // borderColor, backgroundColor, borderRadius set inline
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    // borderColor set inline
    marginRight: layout.componentGap,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    // backgroundColor set inline
  },
  radioText: {
    fontSize: 15,
    // color, fontWeight set inline
  },
  lockedTypeRow: {
    paddingVertical: layout.inputPaddingVertical,
    paddingHorizontal: layout.inputPaddingHorizontal,
  },
  lockedTypeText: {
    fontSize: 15,
    fontStyle: 'italic',
    // color set inline
  },
  field: {
    marginTop: layout.inputMarginBottom,
  },
  label: {
    fontSize: 14,
    marginBottom: layout.componentGapSmall,
    // color, fontWeight set inline
  },
  input: {
    paddingVertical: layout.inputPaddingVertical,
    paddingHorizontal: layout.inputPaddingHorizontal,
    borderWidth: 1,
    // color, borderColor, backgroundColor, borderRadius, fontSize set inline
  },
  selector: {
    borderWidth: 1,
    // borderColor, backgroundColor, borderRadius set inline
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.inputPaddingVertical,
    paddingHorizontal: layout.inputPaddingHorizontal,
  },
  selectorValue: {
    flex: 1,
    // color, fontSize, fontWeight set inline
  },
  selectorChevron: {
    marginLeft: layout.componentGap,
    // color, fontSize set inline
  },
  previewCard: {
    marginTop: layout.inputMarginBottom,
    padding: layout.blockPadding,
    borderWidth: 1,
    // backgroundColor, borderColor, borderRadius set inline
  },
  previewText: {
    fontSize: 13,
    lineHeight: 18,
    // color set inline
  },
  errorCard: {
    marginTop: layout.inputMarginBottom,
    padding: layout.blockPadding,
    borderWidth: 1,
    // backgroundColor, borderColor, borderRadius set inline
  },
  errorTitle: {
    marginBottom: 4,
    // color, fontSize, fontWeight set inline
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    // color set inline
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: layout.componentGap,
    marginTop: layout.sectionGap,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.screenPaddingBottom,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropFlex: {
    flex: 1,
    // backgroundColor set inline
  },
  modalSheet: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: layout.modalPadding,
    paddingTop: layout.modalPaddingTop,
    paddingBottom: layout.modalPaddingBottom,
    maxHeight: '70%',
    // backgroundColor set inline
  },
  modalTitle: {
    marginBottom: layout.modalTitleBottom,
    // color, fontSize, fontWeight set inline
  },
  modalList: {
    flexGrow: 0,
  },
  modalListContent: {
    paddingBottom: layout.modalListBottom,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    // borderBottomColor, backgroundColor set inline
  },
  modalOptionText: {
    // color, fontSize, fontWeight set inline
  },
  modalEmptyText: {
    fontStyle: 'italic',
    paddingVertical: 12,
    // color, fontSize set inline
  },
  warningBanner: {
    marginTop: layout.sectionGap,
    marginHorizontal: layout.screenPadding,
    padding: layout.blockPadding,
    borderWidth: 1,
    // backgroundColor, borderColor, borderRadius set inline
  },
  warningBannerText: {
    // color, fontSize, lineHeight set inline
  },
});
