import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import SectionCard from '../components/SectionCard';
import { useSnapshot } from '../SnapshotContext';
import { formatCurrencyFull } from '../formatters';
import { spacing } from '../spacing';
import { layout } from '../layout';
import type { AssetItem, LiabilityItem } from '../types';

const ROUTE_ASSETS_DETAIL: string = 'AccountsAssetsDetail';
const ROUTE_LIABILITIES_DETAIL: string = 'LiabilitiesDetail';

// Format liquidity status text
function formatLiquidityStatus(asset: AssetItem): string {
  const avail = asset.availability ?? { type: 'immediate' };
  
  if (avail.type === 'immediate') {
    return 'Liquid now';
  }
  
  if (avail.type === 'locked') {
    const unlockAge = typeof avail.unlockAge === 'number' && Number.isFinite(avail.unlockAge) 
      ? avail.unlockAge 
      : null;
    if (unlockAge !== null) {
      return `Liquid from age ${unlockAge}`;
    }
    return 'Not automatically liquid';
  }
  
  if (avail.type === 'illiquid') {
    return 'Not automatically liquid';
  }
  
  return 'Liquid now';
}

// Format growth rate text
function formatGrowthRate(asset: AssetItem): string {
  if (typeof asset.annualGrowthRatePct === 'number' && Number.isFinite(asset.annualGrowthRatePct)) {
    return `Growth: ${asset.annualGrowthRatePct}%`;
  }
  return 'No growth rate';
}

// Format contribution text
function formatContribution(amountMonthly: number | undefined): string {
  if (typeof amountMonthly === 'number' && Number.isFinite(amountMonthly) && amountMonthly > 0) {
    return `Contribution: ${formatCurrencyFull(amountMonthly)} / month`;
  }
  return 'No contribution';
}

// Build metadata line for an asset
function buildAssetMetadata(asset: AssetItem, contributionAmount: number | undefined): string {
  const growthText = formatGrowthRate(asset);
  const liquidityText = formatLiquidityStatus(asset);
  const contributionText = formatContribution(contributionAmount);
  
  return `${growthText}   ·   ${liquidityText}   ·   ${contributionText}`;
}

// Format interest rate text for liability
function formatInterestRate(liability: LiabilityItem): string {
  if (typeof liability.annualInterestRatePct === 'number' && Number.isFinite(liability.annualInterestRatePct)) {
    return `Rate: ${liability.annualInterestRatePct}%`;
  }
  return 'No rate';
}

// Format term text for loan/mortgage
function formatTerm(liability: LiabilityItem): string {
  if (liability.kind === 'loan' && typeof liability.remainingTermYears === 'number' && Number.isFinite(liability.remainingTermYears)) {
    return `Term: ${liability.remainingTermYears}yr`;
  }
  return '';
}

// Build metadata line for a liability
function buildLiabilityMetadata(liability: LiabilityItem): string {
  const parts: string[] = [];
  
  // Balance is already shown as subtext, so we show rate and term in metadata
  const rateText = formatInterestRate(liability);
  parts.push(rateText);
  
  // For loans/mortgages, add term
  if (liability.kind === 'loan') {
    const termText = formatTerm(liability);
    if (termText) {
      parts.push(termText);
    }
  }
  
  return parts.join('   ·   ');
}

export default function AccountsScreen() {
  const navigation = useNavigation<any>();
  const { state } = useSnapshot();

  const assetRows = useMemo(() => state.assets, [state.assets]);
  const liabilityRows = useMemo(() => state.liabilities, [state.liabilities]);
  
  // Calculate totals
  const assetsTotal = useMemo(() => {
    return assetRows.reduce((sum, asset) => sum + asset.balance, 0);
  }, [assetRows]);
  
  const liabilitiesTotal = useMemo(() => {
    return liabilityRows.reduce((sum, liability) => sum + liability.balance, 0);
  }, [liabilityRows]);
  
  // Create a map of assetId -> contribution amount for quick lookup
  const contributionMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const contrib of state.assetContributions) {
      map.set(contrib.assetId, contrib.amountMonthly);
    }
    return map;
  }, [state.assetContributions]);

  const navigateToAssets = () => {
    navigation.navigate(ROUTE_ASSETS_DETAIL);
  };

  const navigateToLiabilities = () => {
    navigation.navigate(ROUTE_LIABILITIES_DETAIL);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader title="Accounts" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <SectionCard>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ASSETS</Text>
            <Text style={styles.sectionTotal}>{formatCurrencyFull(assetsTotal)}</Text>
          </View>
          <View style={styles.hr} />

          {assetRows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No assets added yet</Text>
              <Pressable onPress={navigateToAssets} style={({ pressed }) => [styles.emptyButton, pressed ? styles.pressed : null]}>
                <Text style={styles.emptyButtonText}>[ Add asset ]</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.list}>
              {assetRows.map(item => {
                const contributionAmount = contributionMap.get(item.id);
                const metadata = buildAssetMetadata(item, contributionAmount);
                
                return (
                  <Pressable
                    key={item.id}
                    onPress={navigateToAssets}
                    style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
                  >
                    <Text style={styles.bullet}>•</Text>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{item.name}</Text>
                      <Text style={styles.rowSubtext}>{formatCurrencyFull(item.balance)}</Text>
                      <Text style={styles.rowMetadata}>{metadata}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </SectionCard>

        <SectionCard>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>LIABILITIES</Text>
            <Text style={styles.sectionTotal}>{formatCurrencyFull(liabilitiesTotal)}</Text>
          </View>
          <View style={styles.hr} />

          {liabilityRows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No liabilities added yet</Text>
              <Pressable onPress={navigateToLiabilities} style={({ pressed }) => [styles.emptyButton, pressed ? styles.pressed : null]}>
                <Text style={styles.emptyButtonText}>[ Add liability ]</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.list}>
              {liabilityRows.map(item => {
                const metadata = buildLiabilityMetadata(item);
                
                return (
                  <Pressable
                    key={item.id}
                    onPress={navigateToLiabilities}
                    style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
                  >
                    <Text style={styles.bullet}>•</Text>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{item.name}</Text>
                      <Text style={styles.rowSubtext}>{formatCurrencyFull(item.balance)}</Text>
                      <Text style={styles.rowMetadata}>{metadata}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingTop: layout.screenPaddingTop,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.6,
  },
  sectionTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: spacing.base,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    opacity: 0.7,
  },
  bullet: {
    width: 16,
    fontSize: 14,
    color: '#444',
    marginTop: 1,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
  },
  rowSubtext: {
    fontSize: 13,
    color: '#444',
    marginTop: layout.micro,
  },
  rowMetadata: {
    fontSize: 11,
    color: '#777',
    marginTop: spacing.tiny,
    lineHeight: 14,
  },
  emptyState: {
    paddingVertical: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: spacing.sm,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  emptyButtonText: {
    fontSize: 14,
    color: '#444',
  },
  pressed: {
    opacity: 0.7,
  },
});


