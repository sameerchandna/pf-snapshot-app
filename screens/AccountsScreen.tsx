import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import SketchBackground from '../components/SketchBackground';
import SectionCard from '../components/SectionCard';
import Divider from '../components/Divider';
import Row from '../components/PressableRow';
import { useSnapshot } from '../context/SnapshotContext';
import { formatCurrencyFull } from '../ui/formatters';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { radius, typography } from '../ui/theme/theme';
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
  const { theme } = useTheme();
  const palette = useScreenPalette();
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
      <SketchBackground color={palette.bg} style={{flex:1}}>
      <ScreenHeader title="Accounts" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <SectionCard style={{ marginTop: layout.sectionGap }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.secondary }]}>ASSETS</Text>
            <Text style={[styles.sectionTotal, { color: theme.colors.text.muted }]}>{formatCurrencyFull(assetsTotal)}</Text>
          </View>
          <View style={{ marginBottom: spacing.base }}>
            <Divider />
          </View>

          {assetRows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>No assets added yet</Text>
              <Pressable
                onPress={navigateToAssets}
                style={({ pressed }) => [
                  styles.emptyButton,
                  { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' }
                ]}
              >
                <Text style={[styles.emptyButtonText, { color: theme.colors.text.tertiary }]}>[ Add asset ]</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.list}>
              {assetRows.map(item => {
                const contributionAmount = contributionMap.get(item.id);
                const metadata = buildAssetMetadata(item, contributionAmount);
                
                return (
                  <Row
                    key={item.id}
                    onPress={navigateToAssets}
                    leading={<Text style={[styles.bullet, { color: theme.colors.text.tertiary }]}>•</Text>}
                    showBottomDivider={false}
                  >
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>{item.name}</Text>
                      <Text style={[styles.rowSubtext, theme.typography.bodyLarge, { color: theme.colors.text.tertiary }]}>{formatCurrencyFull(item.balance)}</Text>
                      <Text style={[styles.rowMetadata, theme.typography.bodySmall, { color: theme.colors.text.muted }]}>{metadata}</Text>
                    </View>
                  </Row>
                );
              })}
            </View>
          )}
        </SectionCard>

        <SectionCard>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.secondary }]}>LIABILITIES</Text>
            <Text style={[styles.sectionTotal, { color: theme.colors.text.muted }]}>{formatCurrencyFull(liabilitiesTotal)}</Text>
          </View>
          <View style={{ marginBottom: spacing.base }}>
            <Divider />
          </View>

          {liabilityRows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>No liabilities added yet</Text>
              <Pressable
                onPress={navigateToLiabilities}
                style={({ pressed }) => [
                  styles.emptyButton,
                  { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' }
                ]}
              >
                <Text style={[styles.emptyButtonText, { color: theme.colors.text.tertiary }]}>[ Add liability ]</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.list}>
              {liabilityRows.map(item => {
                const metadata = buildLiabilityMetadata(item);

                return (
                  <Row
                    key={item.id}
                    onPress={navigateToLiabilities}
                    leading={<Text style={[styles.bullet, { color: theme.colors.text.tertiary }]}>•</Text>}
                    showBottomDivider={false}
                  >
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>{item.name}</Text>
                      <Text style={[styles.rowSubtext, theme.typography.bodyLarge, { color: theme.colors.text.tertiary }]}>{formatCurrencyFull(item.balance)}</Text>
                      <Text style={[styles.rowMetadata, theme.typography.bodySmall, { color: theme.colors.text.muted }]}>{metadata}</Text>
                    </View>
                  </Row>
                );
              })}
            </View>
          )}
        </SectionCard>
      </ScrollView>
      </SketchBackground>
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
    ...typography.groupTitle,
  },
  sectionTotal: {
    ...typography.valueSmall,
  },
  list: {
    gap: spacing.sm,
  },
  bullet: {
    ...typography.bodyLarge,
    width: 16,
    marginTop: layout.componentGapTiny,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    // Typography via theme.typography.bodyLarge
  },
  rowSubtext: {
    // Typography via theme.typography.bodyLarge
    marginTop: layout.micro,
  },
  rowMetadata: {
    // Typography via theme.typography.bodySmall
    marginTop: spacing.tiny,
  },
  emptyState: {
    paddingVertical: spacing.xs,
  },
  emptyText: {
    ...typography.bodyLarge,
    marginBottom: spacing.sm,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  emptyButtonText: {
    ...typography.button,
  },
});


