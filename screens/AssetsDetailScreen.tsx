import React, { useMemo, useState } from 'react';
import { useSnapshot } from '../context/SnapshotContext';
import EditableCollectionScreen, { HelpContent } from './EditableCollectionScreen';
import { AssetItem, Group } from '../types';
import { selectAssets } from '../engines/selectors';
import { formatCurrencyFull } from '../ui/formatters';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseItemName } from '../domain/domainValidation';
import EducationBox from '../components/EducationBox';
import { useTheme } from '../ui/theme/useTheme';
import { radius, typography } from '../ui/theme/theme';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { Swipeable } from 'react-native-gesture-handler';
import CollectionRowWithActions from '../components/rows/CollectionRowWithActions';

const assetsHelpContent: HelpContent = {
  title: 'Assets',
  sections: [
    {
      heading: 'Where this fits in the model',
      paragraphs: [
        'Assets represent what you own today.',
      ],
    },
    {
      heading: 'What are Assets?',
      paragraphs: [
        'Assets include cash, investments, property, and pensions.',
        'They are recorded at current balances.',
      ],
    },
    {
      heading: 'Why Assets matter',
      paragraphs: [
        'Assets are the primary source of long-term growth and financial security.',
      ],
    },
    {
      heading: 'How to use this screen',
      paragraphs: [
        'Enter current balances.',
        'Optionally assign a growth rate for Projection.',
      ],
    },
    {
      heading: 'What this screen does not do',
      paragraphs: [
        'This screen does not apply growth in Snapshot.',
        'It does not value assets dynamically.',
      ],
    },
    {
      heading: 'How this affects Projection',
      paragraphs: [
        'Assets grow over time according to their assigned behaviour.',
      ],
    },
  ],
};

export default function AssetsDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { state, setAssetGroups, setAssets } = useSnapshot();

  const createForContribution: boolean = Boolean(route?.params?.createForContribution);
  const returnRouteKey: string | null = typeof route?.params?.returnRouteKey === 'string' ? route.params.returnRouteKey : null;
  const returnRouteName: string | null = typeof route?.params?.returnRouteName === 'string' ? route.params.returnRouteName : null;

  const [quickName, setQuickName] = useState<string>('');
  const [quickError, setQuickError] = useState<string>('');

  const totalValue: number = useMemo(() => {
    return selectAssets(state);
  }, [state.assets]);

  const totalText: string = useMemo(() => formatCurrencyFull(totalValue), [totalValue]);

  const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const createNewGroup = (): Group => ({ id: createId('asset-group'), name: 'New Group' });

  function calculateAvailableFromDate(unlockAge: number, currentAge: number): string {
    const today = new Date();
    const yearsUntilUnlock = unlockAge - currentAge;
    const unlockDate = new Date(today);
    unlockDate.setFullYear(today.getFullYear() + yearsUntilUnlock);
    return unlockDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  const quickCreate = () => {
    Keyboard.dismiss();
    const name = parseItemName(quickName);
    if (!name) {
      setQuickError('Asset name is required.');
      return;
    }

    const groupId = state.assetGroups[0]?.id ?? 'assets-other';
    const id = createId('asset');
    setAssets([{ id, name, balance: 0, groupId, annualGrowthRatePct: 0, availability: { type: 'immediate' } }, ...state.assets]);

    if (createForContribution && returnRouteKey) {
      // Navigate back to the originating screen with the new asset ID for auto-selection.
      // Use returnRouteName if provided, otherwise default to PensionDetail.
      const targetRoute = returnRouteName || 'PensionDetail';
      navigation.navigate(targetRoute as any, { preselectAssetId: id });
      return;
    }

    setQuickName('');
    setQuickError('');
  };

  // Custom row renderer for v2 row architecture
  // This override bypasses FinancialItemRow and uses EditableCollectionScreen's swipe coordination.
  // Uses CollectionRowWithActions → SemanticRow → SwipeRowContainer → RowVisual stack.
  const renderAssetRow = (
    item: AssetItem,
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
    // For AssetsDetailScreen:
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
        isActive={state.isActive}
        onToggleActive={callbacks.onToggleActive}
        isCurrentlyEditing={state.isCurrentlyEditing}
        dimRow={state.dimRow}
        isLastInGroup={isLastInGroup}
        pressEnabled={true}
        onPress={() => {
          navigation.navigate('BalanceDeepDive', { itemId: item.id });
        }}
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
    <EditableCollectionScreen<AssetItem>
      title="Assets"
      totalText={totalText}
      subtextMain="Grouped assets"
      subtextFootnote={undefined}
      allowGroups={false}
      showEditor={!createForContribution}
      isItemLocked={createForContribution ? () => true : undefined}
      renderIntro={
        <View>
          <EducationBox lines={['Only active items are used in your Snapshot and projections. Inactive items are kept for reference.']} />
          {createForContribution ? (
            <View style={[
              styles.quickCreateCard,
              {
                backgroundColor: theme.colors.bg.subtle,
                borderColor: theme.colors.border.subtle,
              }
            ]}>
            <View style={styles.quickHeaderRow}>
              <Text style={[styles.quickTitle, { color: theme.colors.text.tertiary }]}>Create asset</Text>
              <Text style={[styles.quickContextTag, { color: theme.colors.brand.primary }]}>From Asset Contributions</Text>
            </View>
            <Text style={[styles.quickHint, { color: theme.colors.text.secondary }]}>Name only. Balance will start at £0.</Text>
            {quickError ? <Text style={[styles.quickError, { color: theme.colors.semantic.errorText }]}>{quickError}</Text> : null}
            <View style={styles.quickRow}>
              <TextInput
                style={[
                  styles.quickInput,
                  {
                    backgroundColor: theme.colors.bg.card,
                    borderColor: theme.colors.border.default,
                    color: theme.colors.text.primary,
                  }
                ]}
                value={quickName}
                onChangeText={t => {
                  setQuickError('');
                  setQuickName(t);
                }}
                placeholder="e.g. Stocks ISA"
                returnKeyType="done"
                onSubmitEditing={quickCreate}
                autoFocus={true}
              />
              <Pressable
                onPress={quickCreate}
                style={({ pressed }) => [
                  styles.quickButton,
                  {
                    backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.brand.primary,
                    borderColor: theme.colors.brand.primary,
                  }
                ]}
              >
                <Text style={[styles.quickButtonText, { color: theme.colors.brand.onPrimary }]}>Create</Text>
              </Pressable>
            </View>
          </View>
          ) : null}
        </View>
      }
      secondaryNumberField={{
        label: 'Growth Rate (%)',
        placeholder: 'Growth %',
        getItemValue: item => item.annualGrowthRatePct,
        min: 0,
        max: 100,
      }}
      liquidityField={{
        getItemLiquidity: item => {
          const avail = item.availability ?? { type: 'immediate' };
          return {
            type: avail.type,
            unlockAge: avail.unlockAge,
          };
        },
        currentAge: state.projection.currentAge,
      }}
      formatItemMetaText={item => {
        const parts: string[] = [];
        
        // Growth rate
        if (typeof item.annualGrowthRatePct === 'number' && Number.isFinite(item.annualGrowthRatePct)) {
          parts.push(`${item.annualGrowthRatePct.toLocaleString('en-GB', { maximumFractionDigits: 2 })}%`);
        }
        
        // Liquidity
        const avail = item.availability ?? { type: 'immediate' };
        const liquidityLabel = avail.type === 'immediate' ? 'Liquid' : avail.type === 'locked' ? 'Locked' : 'Illiquid';
        parts.push(liquidityLabel);
        
        return parts.length > 0 ? parts.join(' • ') : null;
      }}
      helpContent={assetsHelpContent}
      emptyStateText="No assets yet."
      groups={state.assetGroups}
      setGroups={setAssetGroups}
      items={state.assets}
      setItems={setAssets}
      getItemId={item => item.id}
      getItemName={item => item.name}
      getItemAmount={item => item.balance}
      getItemGroupId={item => item.groupId}
      canInlineEditItem={() => true}
      makeNewItem={(groupId, name, amount, extra) => {
        let availability: AssetItem['availability'];
        if (extra?.liquidity) {
          if (extra.liquidity.type === 'locked' && typeof extra.liquidity.unlockAge === 'number') {
            const availableFromDate = calculateAvailableFromDate(extra.liquidity.unlockAge, state.projection.currentAge);
            availability = {
              type: 'locked',
              unlockAge: extra.liquidity.unlockAge,
              availableFromDate,
            };
          } else {
            availability = { type: extra.liquidity.type };
          }
        } else {
          availability = { type: 'immediate' };
        }
        
        return {
          id: createId('asset'),
          name,
          balance: amount,
          annualGrowthRatePct: typeof extra?.secondaryNumber === 'number' ? extra.secondaryNumber : undefined,
          groupId,
          availability,
          isActive: true,
        };
      }}
      updateItem={(item, name, amount, extra) => {
        let availability: AssetItem['availability'] = item.availability ?? { type: 'immediate' };
        if (extra?.liquidity) {
          if (extra.liquidity.type === 'locked' && typeof extra.liquidity.unlockAge === 'number') {
            const availableFromDate = calculateAvailableFromDate(extra.liquidity.unlockAge, state.projection.currentAge);
            availability = {
              type: 'locked',
              unlockAge: extra.liquidity.unlockAge,
              availableFromDate,
            };
          } else {
            availability = { type: extra.liquidity.type };
          }
        }
        
        return {
          ...item,
          name,
          balance: amount,
          annualGrowthRatePct: typeof extra?.secondaryNumber === 'number' ? extra.secondaryNumber : undefined,
          availability,
        };
      }}
      formatAmountText={amount => formatCurrencyFull(amount)}
      formatGroupTotalText={total => formatCurrencyFull(total)}
      createNewGroup={createNewGroup}
      getItemIsActive={item => item.isActive !== false}
      setItemIsActive={(item, isActive) => ({ ...item, isActive })}
      onItemPress={(item) => {
        navigation.navigate('BalanceDeepDive', { itemId: item.id });
      }}
      renderRow={renderAssetRow}
    />
  );
}

const styles = StyleSheet.create({
  quickCreateCard: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  quickHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  quickTitle: { ...typography.groupTitle },
  quickContextTag: { ...typography.bodySmall, fontWeight: '700' },
  quickHint: { ...typography.body, marginBottom: spacing.sm },
  quickError: { ...typography.body, marginBottom: spacing.sm },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quickInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.medium,
    paddingVertical: layout.inputPadding,
    paddingHorizontal: spacing.base,
    ...typography.input,
  },
  quickButton: {
    paddingVertical: layout.inputPadding,
    paddingHorizontal: spacing.base,
    borderRadius: radius.medium,
    borderWidth: 1,
  },
  quickButtonText: { ...typography.groupTitle },
});

