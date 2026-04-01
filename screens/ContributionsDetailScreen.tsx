import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';

import { useSnapshot } from '../context/SnapshotContext';
import EditableCollectionScreen from './EditableCollectionScreen';
import { ContributionItem } from '../types';
import { formatCurrencyFullSigned } from '../ui/formatters';
import { parseMoney } from '../domain/domainValidation';
import { useTheme } from '../ui/theme/useTheme';
import { typography, radius } from '../ui/theme/theme';
import Icon from '../components/Icon';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import CollectionRowWithActions from '../components/rows/CollectionRowWithActions';

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
            if (state.assets.length === 0) {
              navigation.navigate('AssetsDetail', { createForContribution: true, returnRouteKey: route.key, returnRouteName: 'AssetContributionDetail' });
              return;
            }
            setAssetPickerOpen(true);
          }}
          style={({ pressed }) => [
            styles.selector,
            {
              backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.input,
              borderColor: 'transparent',
              borderRadius: theme.radius.medium,
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
                !props.value ? [styles.selectorPlaceholder, { color: theme.colors.text.muted }] : null
              ]}
              numberOfLines={1}
            >
              {props.value ? getAssetName(props.value) : 'Select asset'}
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
                {state.assets.map(a => (
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

  // Custom row renderer for v2 row architecture
  const renderContributionsRow = (
    item: ContributionItem,
    index: number,
    groupId: string | undefined,
    isLastInGroup: boolean,
    callbacks: {
      onEdit: () => void;
      onDelete: () => void;
      onToggleActive?: () => void;
      swipeableRef?: (ref: Swipeable | null) => void;
      onSwipeableWillOpen?: () => void;
      onSwipeableOpen?: () => void;
      onSwipeableClose?: () => void;
    },
    state: {
      locked: boolean;
      isActive: boolean;
      isInactive: boolean;
      isCurrentlyEditing: boolean;
      dimRow: boolean;
      showTopDivider: boolean;
      name: string;
      amountText: string;
      metaText: string | null;
    },
  ) => {
    // Compute disableDelete using exact legacy conditions from EditableCollectionScreen line 772:
    // deleteDisabled = locked || !canDeleteItems || (groupsEnabled && canCollapseGroups && groupId && !isExpanded(groupId))
    // For Contributions:
    // - allowGroups={false}, so groupsEnabled = false
    // - allowDeleteItems not set, so canDeleteItems = true (default)
    // - Therefore: disableDelete = locked || false || false = locked
    const disableDelete = state.locked;

    return (
      <CollectionRowWithActions
        key={item.id}
        name={state.name}
        amountText={state.amountText}
        subtitle={state.metaText}
        locked={state.locked}
        isCurrentlyEditing={state.isCurrentlyEditing}
        dimRow={state.dimRow}
        isLastInGroup={isLastInGroup}
        pressEnabled={false}
        onEdit={callbacks.onEdit}
        onDelete={callbacks.onDelete}
        disableDelete={disableDelete}
        swipeableRef={callbacks.swipeableRef}
        onSwipeableWillOpen={callbacks.onSwipeableWillOpen}
        onSwipeableOpen={callbacks.onSwipeableOpen}
        onSwipeableClose={callbacks.onSwipeableClose}
      />
    );
  };

  return (
    <EditableCollectionScreen<ContributionItem>
      title="Asset Contributions"
      totalText={totalText}
      subtextMain="Monthly contributions linked to a specific asset"
      helpContent={assetContributionsHelpContent}
      emptyStateText="No contributions yet."
      allowGroups={false}
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
      renderRow={renderContributionsRow}
    />
  );
}

const styles = StyleSheet.create({
  selector: {
    borderWidth: 1,
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
    ...typography.button,
  },
  selectorPlaceholder: {
    fontWeight: '400',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropFlex: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: radius.modal,
    borderTopRightRadius: radius.modal,
    paddingHorizontal: layout.screenPadding,
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
    borderBottomWidth: 1,
  },
  modalOptionText: {
    ...typography.button,
  },
});
