import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import EducationBox from '../components/EducationBox';
import { useSnapshot } from '../SnapshotContext';
import { getUserEditableAssets } from '../systemAssets';
import { formatCurrencyFull } from '../formatters';
import { layout } from '../layout';
import type { Scenario, ScenarioId, ScenarioKind, FlowToAssetScenario, FlowToDebtScenario } from '../domain/scenario/types';
import { BASELINE_SCENARIO_ID } from '../domain/scenario/types';
import { validateScenario } from '../domain/scenario/validation';
import { getScenarios, saveScenario, setActiveScenarioId } from '../scenarioState';

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
      if (!isEdit) {
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
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader title={isEdit ? 'Edit Scenario' : 'New Scenario'} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <EducationBox
          lines={[
            'Scenarios let you explore "what if" changes to your financial plan.',
            'They modify how you allocate available cash each month.',
          ]}
        />

        {/* Scenario Type Selection */}
        <View style={styles.section}>
          <GroupHeader title="Scenario Type" />
          {kindLocked ? (
            <View style={styles.lockedTypeRow}>
              <Text style={styles.lockedTypeText}>
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
                style={({ pressed }) => [styles.radioOption, pressed ? styles.radioOptionPressed : null, scenarioKind === 'FLOW_TO_ASSET' ? styles.radioOptionSelected : null]}
              >
                <View style={styles.radioCircle}>
                  {scenarioKind === 'FLOW_TO_ASSET' ? <View style={styles.radioCircleInner} /> : null}
                </View>
                <Text style={[styles.radioText, scenarioKind === 'FLOW_TO_ASSET' ? styles.radioTextSelected : null]}>
                  Invest more in an asset
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setScenarioKind('FLOW_TO_DEBT');
                  setAssetId(null);
                }}
                style={({ pressed }) => [styles.radioOption, pressed ? styles.radioOptionPressed : null, scenarioKind === 'FLOW_TO_DEBT' ? styles.radioOptionSelected : null]}
              >
                <View style={styles.radioCircle}>
                  {scenarioKind === 'FLOW_TO_DEBT' ? <View style={styles.radioCircleInner} /> : null}
                </View>
                <Text style={[styles.radioText, scenarioKind === 'FLOW_TO_DEBT' ? styles.radioTextSelected : null]}>
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
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Can't save</Text>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Name Input */}
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Extra investing"
                autoCapitalize="sentences"
                autoCorrect={false}
              />
            </View>

            {/* Asset/Liability Selector */}
            {scenarioKind === 'FLOW_TO_ASSET' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Asset</Text>
                <Pressable
                  onPress={() => setAssetPickerOpen(true)}
                  style={({ pressed }) => [styles.selector, pressed ? styles.selectorPressed : null]}
                >
                  <View style={styles.selectorRow}>
                    <Text style={[styles.selectorValue, !assetId ? styles.selectorPlaceholder : null]} numberOfLines={1}>
                      {assetId ? state.assets.find(a => a.id === assetId)?.name || 'Unknown asset' : 'Select asset'}
                    </Text>
                    <Text style={styles.selectorChevron}>▼</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={styles.field}>
                <Text style={styles.label}>Loan</Text>
                <Pressable
                  onPress={() => setLiabilityPickerOpen(true)}
                  style={({ pressed }) => [styles.selector, pressed ? styles.selectorPressed : null]}
                >
                  <View style={styles.selectorRow}>
                    <Text style={[styles.selectorValue, !liabilityId ? styles.selectorPlaceholder : null]} numberOfLines={1}>
                      {liabilityId ? loanLiabilities.find(l => l.id === liabilityId)?.name || 'Unknown loan' : 'Select loan'}
                    </Text>
                    <Text style={styles.selectorChevron}>▼</Text>
                  </View>
                </Pressable>
              </View>
            )}

            {/* Monthly Amount Input */}
            <View style={styles.field}>
              <Text style={styles.label}>
                {scenarioKind === 'FLOW_TO_ASSET' ? 'Monthly amount (£)' : 'Monthly overpayment (£)'}
              </Text>
              <TextInput
                style={styles.input}
                value={amountMonthly}
                onChangeText={setAmountMonthly}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>

            {/* Preview Text */}
            {previewText ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewText}>{previewText}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable onPress={handleCancel} style={({ pressed }) => [styles.cancelButton, pressed ? styles.buttonPressed : null]}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveButton, pressed ? styles.buttonPressed : null]}>
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Asset Picker Modal */}
      <Modal transparent={true} visible={assetPickerOpen} animationType="slide" onRequestClose={() => setAssetPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdropFlex} onPress={() => setAssetPickerOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select asset</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {state.assets.map(asset => (
                <Pressable
                  key={asset.id}
                  onPress={() => {
                    setAssetId(asset.id);
                    setAssetPickerOpen(false);
                  }}
                  style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.modalOptionText}>{asset.name}</Text>
                </Pressable>
              ))}
              {getUserEditableAssets(state.assets).length === 0 ? <Text style={styles.modalEmptyText}>No assets available</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Liability Picker Modal */}
      <Modal transparent={true} visible={liabilityPickerOpen} animationType="slide" onRequestClose={() => setLiabilityPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdropFlex} onPress={() => setLiabilityPickerOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select loan</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
              {loanLiabilities.map(liability => (
                <Pressable
                  key={liability.id}
                  onPress={() => {
                    setLiabilityId(liability.id);
                    setLiabilityPickerOpen(false);
                  }}
                  style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.modalOptionText}>{liability.name}</Text>
                </Pressable>
              ))}
              {loanLiabilities.length === 0 ? <Text style={styles.modalEmptyText}>No loans available</Text> : null}
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
    backgroundColor: '#fff',
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  radioOptionPressed: {
    opacity: 0.7,
  },
  radioOptionSelected: {
    borderColor: '#2F5BEA',
    backgroundColor: '#f5f7ff',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: layout.componentGap,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2F5BEA',
  },
  radioText: {
    fontSize: 15,
    color: '#111',
    fontWeight: '500',
  },
  radioTextSelected: {
    color: '#2F5BEA',
    fontWeight: '600',
  },
  lockedTypeRow: {
    paddingVertical: layout.inputPaddingVertical,
    paddingHorizontal: layout.inputPaddingHorizontal,
  },
  lockedTypeText: {
    fontSize: 15,
    color: '#666',
    fontStyle: 'italic',
  },
  field: {
    marginTop: layout.inputMarginBottom,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: layout.componentGapSmall,
  },
  input: {
    fontSize: 15,
    color: '#111',
    paddingVertical: layout.inputPaddingVertical,
    paddingHorizontal: layout.inputPaddingHorizontal,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  selector: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  selectorPressed: {
    opacity: 0.7,
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
    fontSize: 15,
    color: '#111',
    fontWeight: '500',
  },
  selectorPlaceholder: {
    color: '#777',
    fontWeight: '400',
  },
  selectorChevron: {
    fontSize: 12,
    color: '#777',
    marginLeft: layout.componentGap,
  },
  previewCard: {
    marginTop: layout.inputMarginBottom,
    padding: layout.blockPadding,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  previewText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  errorCard: {
    marginTop: layout.inputMarginBottom,
    padding: layout.blockPadding,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: layout.componentGap,
    marginTop: layout.sectionGap,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.screenPaddingBottom,
  },
  cancelButton: {
    paddingVertical: layout.buttonPaddingVertical,
    paddingHorizontal: layout.buttonPaddingHorizontal,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    paddingVertical: layout.buttonPaddingVertical,
    paddingHorizontal: layout.buttonPaddingHorizontal,
    borderRadius: 8,
    backgroundColor: '#2F5BEA',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropFlex: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: layout.modalPadding,
    paddingTop: layout.modalPaddingTop,
    paddingBottom: layout.modalPaddingBottom,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: layout.modalTitleBottom,
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
