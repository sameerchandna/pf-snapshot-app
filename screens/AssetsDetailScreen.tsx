import React, { useMemo, useState } from 'react';
import { useSnapshot } from '../SnapshotContext';
import { getUserEditableAssets } from '../systemAssets';
import GroupedListDetailScreen, { HelpContent } from './GroupedListDetailScreen';
import { AssetItem, Group } from '../types';
import { selectAssets } from '../selectors';
import { formatCurrencyFull } from '../formatters';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseItemName } from '../domainValidation';
import EducationBox from '../components/EducationBox';

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

  return (
    <GroupedListDetailScreen<AssetItem>
      title="Assets"
      totalText={totalText}
      subtextMain="Grouped assets"
      subtextFootnote={undefined}
      allowGroups={false}
      editorPlacement="top"
      showEditor={!createForContribution}
      isItemLocked={createForContribution ? () => true : undefined}
      renderIntro={
        <View>
          <EducationBox lines={['Only active items are used in your Snapshot and projections. Inactive items are kept for reference.']} />
          {createForContribution ? (
            <View style={styles.quickCreateCard}>
            <View style={styles.quickHeaderRow}>
              <Text style={styles.quickTitle}>Create asset</Text>
              <Text style={styles.quickContextTag}>From Asset Contributions</Text>
            </View>
            <Text style={styles.quickHint}>Name only. Balance will start at £0.</Text>
            {quickError ? <Text style={styles.quickError}>{quickError}</Text> : null}
            <View style={styles.quickRow}>
              <TextInput
                style={styles.quickInput}
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
              <Pressable onPress={quickCreate} style={({ pressed }) => [styles.quickButton, { opacity: pressed ? 0.85 : 1 }]}>
                <Text style={styles.quickButtonText}>Create</Text>
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
      items={getUserEditableAssets(state.assets)}
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
    />
  );
}

const styles = StyleSheet.create({
  quickCreateCard: {
    backgroundColor: '#f3f7ff',
    borderWidth: 1,
    borderColor: '#d6e3ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  quickHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  quickTitle: { fontSize: 13, fontWeight: '700', color: '#444' },
  quickContextTag: { fontSize: 11, fontWeight: '700', color: '#2F5BEA' },
  quickHint: { fontSize: 12, color: '#666', marginBottom: 8, lineHeight: 16 },
  quickError: { fontSize: 12, color: '#8a1f1f', marginBottom: 8 },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111',
  },
  quickButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2F5BEA',
    backgroundColor: '#2F5BEA',
  },
  quickButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

