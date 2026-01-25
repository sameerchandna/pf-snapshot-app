import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { useSnapshot } from '../SnapshotContext';
import { getUserEditableAssets } from '../systemAssets';
import GroupedListDetailScreen, { HelpContent } from './GroupedListDetailScreen';
import { ContributionItem } from '../types';
import { selectPension } from '../selectors';
import { formatCurrencyFullSigned } from '../formatters';
import { parseMoney } from '../domainValidation';

type RouteParams = {
  preselectAssetId?: string;
};

const pensionHelpContent: HelpContent = {
  title: 'Pension',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Pension contributions are pre-tax allocations taken from gross income.',
        'They reduce take-home pay but build long-term assets.',
      ],
    },
    {
      heading: 'What are Pension contributions?',
      paragraphs: [
        'Pension contributions are amounts set aside for retirement before income becomes spendable.',
      ],
    },
    {
      heading: 'Why Pension matters',
      paragraphs: [
        'Pension contributions reduce net income today and increase assets over time.',
        'They affect tax explanations and long-term outcomes.',
      ],
    },
    {
      heading: 'How to use this screen',
      paragraphs: [
        'Select the asset you are contributing to.',
        'Enter a monthly amount.',
        'Each asset can have at most one pension contribution.',
      ],
    },
    {
      heading: 'What this screen does not do',
      paragraphs: [
        'This screen does not recommend contribution levels.',
        'It does not assess tax efficiency.',
        'It does not project pension rules.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'Pension contributions increase assets over time and reduce available cash today.',
      ],
    },
  ],
};

export default function PensionDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { state, setAssetContributions } = useSnapshot();
  const params = (route.params as RouteParams) || {};

  const [assetPickerOpen, setAssetPickerOpen] = useState<boolean>(false);
  const [preselectedAssetId, setPreselectedAssetId] = useState<string | null>(null);

  // Refs to store the onChange function and editor state from renderAssetPicker
  // These are updated during render but only used in effects (no setState during render)
  const onChangeRef = useRef<((value: string) => void) | null>(null);
  const editorValueRef = useRef<string>('');
  const editingItemIdRef = useRef<string | null>(null);

  // If we returned from AssetsDetail with a newly created assetId, auto-select it.
  // Read the param once and manage clearing via local state only.
  useEffect(() => {
    const preselectAssetId = params.preselectAssetId;
    if (typeof preselectAssetId === 'string' && preselectAssetId.length > 0) {
      setPreselectedAssetId(preselectAssetId);
    }
  }, [params.preselectAssetId]);

  // Apply preselection when preselectedAssetId is set and editor is ready
  // This runs in an effect to avoid setState during render
  // Refs are updated synchronously during render, so they're current when this effect runs
  useEffect(() => {
    if (preselectedAssetId && onChangeRef.current) {
      // Only apply if we're in "add new" mode (not editing) and value is empty
      if (editingItemIdRef.current === null && !editorValueRef.current) {
        onChangeRef.current(preselectedAssetId);
        setPreselectedAssetId(null);
      }
    }
  }, [preselectedAssetId]);

  // Filter to only show preTax contributions (pension contributions)
  const pensionContributions = useMemo(() => {
    return state.assetContributions.filter(c => c.contributionType === 'preTax');
  }, [state.assetContributions]);

  const totalValue: number = useMemo(() => {
    return selectPension(state);
  }, [state.assetContributions]);

  const totalText: string = useMemo(() => formatCurrencyFullSigned(-totalValue), [totalValue]);

  const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  // Helper to get asset name from assetId
  const getAssetName = (assetId: string): string => {
    if (!assetId) return '';
    const a = state.assets.find(x => x.id === assetId);
    return a ? a.name : 'Unknown asset';
  };

  // Custom name field renderer: asset picker dropdown
  // NOTE: This function is pure (JSX only). No setState or parent callbacks during render.
  // Preselection logic is handled in useEffect above.
  const renderAssetPicker = (props: { value: string; onChange: (value: string) => void; editingItemId: string | null }) => {
    // Store refs for use in useEffect (no state updates during render)
    onChangeRef.current = props.onChange;
    editorValueRef.current = props.value;
    editingItemIdRef.current = props.editingItemId;

    const handleSelectAsset = (assetId: string) => {
      props.onChange(assetId);
      setAssetPickerOpen(false);
      // Note: If this asset already has a pension contribution, the upsert logic will handle it on save.
      // The GroupedListDetailScreen will automatically switch to edit mode if findExistingByKey returns a match.
    };

    return (
      <>
        <Pressable
          onPress={() => {
            if (state.assets.length === 0) {
              navigation.navigate('AssetsDetail', { createForContribution: true, returnRouteKey: route.key, returnRouteName: 'PensionDetail' });
              return;
            }
            setAssetPickerOpen(true);
          }}
          style={({ pressed }) => [styles.selector, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Select asset to contribute to"
        >
          <View style={styles.selectorRow}>
            <Text
              style={[styles.selectorValue, !props.value ? styles.selectorPlaceholder : null]}
              numberOfLines={1}
            >
              {props.value ? getAssetName(props.value) : 'Select asset to contribute to'}
            </Text>
            <Feather name="chevron-down" size={16} color="#777" />
          </View>
        </Pressable>

        {/* Asset picker modal */}
        <Modal transparent={true} visible={assetPickerOpen} animationType="slide" onRequestClose={() => setAssetPickerOpen(false)}>
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalBackdropFlex} onPress={() => setAssetPickerOpen(false)} />
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Select asset</Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
                {getUserEditableAssets(state.assets).map(a => (
                  <Pressable
                    key={a.id}
                    onPress={() => handleSelectAsset(a.id)}
                    style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Text style={styles.modalOptionText}>{a.name}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => {
                    setAssetPickerOpen(false);
                    navigation.navigate('AssetsDetail', { createForContribution: true, returnRouteKey: route.key, returnRouteName: 'PensionDetail' });
                  }}
                  style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.modalOptionText}>+ Create new asset</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </>
    );
  };

  // Update assetContributions, preserving non-pension contributions
  const setPensionContributions = (items: ContributionItem[]) => {
    // Merge: keep all non-pension contributions, replace pension contributions
    const nonPensionContributions = state.assetContributions.filter(c => c.contributionType !== 'preTax');
    setAssetContributions([...nonPensionContributions, ...items]);
  };

  return (
    <GroupedListDetailScreen<ContributionItem>
      title="Pension"
      totalText={totalText}
      subtextMain="Monthly pension contributions"
      helpContent={pensionHelpContent}
      emptyStateText="No pension contributions yet."
      allowGroups={false}
      editorPlacement="top"
      groups={[]} // No groups for contributions
      setGroups={() => {}} // No-op
      items={pensionContributions}
      setItems={setPensionContributions}
      getItemId={item => item.id}
      getItemName={item => {
        // Return assetId as the "name" value (for internal use in editor)
        return item.assetId;
      }}
      getItemDisplayName={item => {
        // Return asset name for display in the list
        const a = state.assets.find(x => x.id === item.assetId);
        return a ? a.name : 'Unknown asset';
      }}
      formatItemAmountText={(item, amount) => {
        return formatCurrencyFullSigned(-amount);
      }}
      getItemAmount={item => item.amountMonthly}
      getItemGroupId={() => 'general'} // No groups
      makeNewItem={(groupId, name, amount) => {
        // name is actually assetId here
        return {
          id: createId('pension-contrib'),
          assetId: name, // name parameter contains assetId
          amountMonthly: amount,
          contributionType: 'preTax' as const,
        };
      }}
      updateItem={(item, name, amount) => {
        // name is actually assetId here
        return {
          ...item,
          assetId: name, // name parameter contains assetId
          amountMonthly: amount,
          contributionType: 'preTax' as const, // Ensure it stays preTax
        };
      }}
      formatAmountText={amount => formatCurrencyFullSigned(-amount)}
      formatGroupTotalText={total => formatCurrencyFullSigned(-total)}
      createNewGroup={() => ({ id: '', name: '' })} // Not used
      validateEditedItem={({ name, amount }) => {
        // name is actually assetId
        const assetId = name.trim();
        if (!assetId) return 'Select an asset.';
        const parsed = parseMoney(amount.toString());
        if (parsed === null) return 'Enter a valid monthly amount.';
        if (parsed <= 0) return 'Amount must be greater than 0.';
        return null;
      }}
      renderCustomNameField={renderAssetPicker}
      upsertKey={(name) => name} // assetId is the key
      findExistingByKey={(key) => {
        // Only look for preTax contributions with this assetId
        return pensionContributions.find(c => c.assetId === key) || null;
      }}
    />
  );
}

const styles = StyleSheet.create({
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
});
