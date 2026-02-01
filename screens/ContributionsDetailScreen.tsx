import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { useSnapshot } from '../SnapshotContext';
import { getUserEditableAssets } from '../systemAssets';
import GroupedListDetailScreen from './GroupedListDetailScreen';
import { ContributionItem } from '../types';
import { formatCurrencyFullSigned } from '../formatters';
import { parseMoney } from '../domainValidation';
import { useTheme } from '../ui/theme/useTheme';
import Icon from '../components/Icon';

type RouteParams = {
  preselectAssetId?: string;
};

const assetContributionsHelpContent = {
  title: 'Asset Contributions',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Asset Contributions represent intentional allocations of available cash into assets.',
      ],
    },
    {
      heading: 'What are Asset Contributions?',
      paragraphs: [
        'These are regular monthly amounts directed into specific assets such as investments, savings, or pensions.',
      ],
    },
    {
      heading: 'Why Asset Contributions matter',
      paragraphs: [
        'They determine how assets grow beyond market returns.',
        'They shape long-term outcomes.',
      ],
    },
    {
      heading: 'How to use this screen',
      paragraphs: [
        'Select the asset you are contributing to.',
        'Enter a monthly amount.',
        'Each asset can have at most one contribution.',
      ],
    },
    {
      heading: 'What this screen does not do',
      paragraphs: [
        'This screen does not rebalance contributions.',
        'It does not optimise allocations.',
        'It does not assume contributions change.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'Asset Contributions are applied monthly in Projection and compound over time.',
      ],
    },
  ],
};

export default function ContributionsDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { state, setAssetContributions } = useSnapshot();
  const params = (route.params as RouteParams) || {};

  const [assetPickerOpen, setAssetPickerOpen] = useState<boolean>(false);
  const [preselectedAssetId, setPreselectedAssetId] = useState<string | null>(null);

  // If we returned from AssetsDetail with a newly created assetId, auto-select it.
  // Read the param once and manage clearing via local state only.
  useEffect(() => {
    const preselectAssetId = params.preselectAssetId;
    if (typeof preselectAssetId === 'string' && preselectAssetId.length > 0) {
      setPreselectedAssetId(preselectAssetId);
    }
  }, [params.preselectAssetId]);

  // Filter to only show postTax contributions (exclude pension/preTax contributions)
  const postTaxContributions = useMemo(() => {
    return state.assetContributions.filter(c => c.contributionType !== 'preTax');
  }, [state.assetContributions]);

  const totalValue: number = useMemo(() => {
    // Sum only postTax contributions for this screen
    return postTaxContributions.reduce((sum, c) => sum + c.amountMonthly, 0);
  }, [postTaxContributions]);

  const totalText: string = useMemo(() => formatCurrencyFullSigned(-totalValue), [totalValue]);

  const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  // Helper to get asset name from assetId
  const getAssetName = (assetId: string): string => {
    if (!assetId) return '';
    const a = state.assets.find(x => x.id === assetId);
    return a ? a.name : 'Unknown asset';
  };

  // Custom name field renderer: asset picker dropdown
  const renderAssetPicker = (props: { value: string; onChange: (value: string) => void; editingItemId: string | null }) => {
    // If there's a preselected assetId, set it and clear the preselection
    if (preselectedAssetId && !props.value) {
      props.onChange(preselectedAssetId);
      setPreselectedAssetId(null);
    }

    const handleSelectAsset = (assetId: string) => {
      props.onChange(assetId);
      setAssetPickerOpen(false);
      // Note: If this asset already has a contribution, the upsert logic will handle it on save.
      // The GroupedListDetailScreen will automatically switch to edit mode if findExistingByKey returns a match.
    };

    return (
      <>
        <Pressable
          onPress={() => {
            if (getUserEditableAssets(state.assets).length === 0) {
              navigation.navigate('AssetsDetail', { createForContribution: true, returnRouteKey: route.key, returnRouteName: 'AssetContributionDetail' });
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
          accessibilityLabel="Select asset to contribute to"
        >
          <View style={styles.selectorRow}>
            <Text
              style={[
                styles.selectorValue,
                { color: theme.colors.text.primary },
                !props.value ? [styles.selectorPlaceholder, { color: theme.colors.text.muted }] : null
              ]}
              numberOfLines={1}
            >
              {props.value ? getAssetName(props.value) : 'Select asset to contribute to'}
            </Text>
            <Icon name="chevron-down" size="small" color={theme.colors.text.muted} />
          </View>
        </Pressable>

        {/* Asset picker modal */}
        <Modal transparent={true} visible={assetPickerOpen} animationType="slide" onRequestClose={() => setAssetPickerOpen(false)}>
          <View style={styles.modalRoot}>
            <Pressable style={[styles.modalBackdropFlex, { backgroundColor: theme.colors.overlay.scrim25 }]} onPress={() => setAssetPickerOpen(false)} />
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.bg.card }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>Select asset</Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} keyboardShouldPersistTaps="handled">
                {getUserEditableAssets(state.assets).map(a => (
                  <Pressable
                    key={a.id}
                    onPress={() => handleSelectAsset(a.id)}
                    style={({ pressed }) => [
                      styles.modalOption,
                      {
                        backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
                        borderBottomColor: theme.colors.border.subtle,
                      }
                    ]}
                  >
                    <Text style={[styles.modalOptionText, { color: theme.colors.text.primary }]}>{a.name}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => {
                    setAssetPickerOpen(false);
                    navigation.navigate('AssetsDetail', { createForContribution: true, returnRouteKey: route.key, returnRouteName: 'AssetContributionDetail' });
                  }}
                  style={({ pressed }) => [
                    styles.modalOption,
                    {
                      backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
                      borderBottomColor: theme.colors.border.subtle,
                    }
                  ]}
                >
                  <Text style={[styles.modalOptionText, { color: theme.colors.text.primary }]}>+ Create new asset</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </>
    );
  };

  // Sync draftAssetId when editing starts (GroupedListDetailScreen will call startEditItem)
  // We need to track when editing starts to set draftAssetId
  const handleStartEdit = (item: ContributionItem) => {
    setDraftAssetId(item.assetId);
  };

  return (
    <GroupedListDetailScreen<ContributionItem>
      title="Asset Contributions"
      totalText={totalText}
      subtextMain="Monthly contributions linked to a specific asset"
      helpContent={assetContributionsHelpContent}
      emptyStateText="No contributions yet."
      allowGroups={false}
      editorPlacement="top"
      groups={[]} // No groups for contributions
      setGroups={() => {}} // No-op
      items={postTaxContributions}
      setItems={(items: ContributionItem[]) => {
        // Merge: keep all preTax contributions, replace postTax contributions
        const preTaxContributions = state.assetContributions.filter(c => c.contributionType === 'preTax');
        setAssetContributions([...preTaxContributions, ...items]);
      }}
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
          id: createId('asset-contrib'),
          assetId: name, // name parameter contains assetId
          amountMonthly: amount,
          contributionType: 'postTax' as const, // Explicitly mark as postTax
        };
      }}
      updateItem={(item, name, amount) => {
        // name is actually assetId here
        return {
          ...item,
          assetId: name, // name parameter contains assetId
          amountMonthly: amount,
          contributionType: 'postTax' as const, // Ensure it stays postTax
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
        // Only look for postTax contributions with this assetId
        return postTaxContributions.find(c => c.assetId === key) || null;
      }}
    />
  );
}

const styles = StyleSheet.create({
  selector: {
    borderWidth: 1,
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
  },
  selectorPlaceholder: {
    fontWeight: '500',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropFlex: {
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
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
