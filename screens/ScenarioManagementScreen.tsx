import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import Icon from '../components/Icon';
import SwipeAction from '../components/SwipeAction';
import { useSnapshot } from '../context/SnapshotContext';
import { formatCurrencyFull, formatCurrencyFullSigned } from '../ui/formatters';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { UI_TOLERANCE } from '../constants';
import { selectMonthlySurplus } from '../engines/selectors';
import type { Scenario, ScenarioId } from '../domain/scenario/types';
import { BASELINE_SCENARIO_ID } from '../domain/scenario/types';
import { getScenarios, getActiveScenarioId, setActiveScenarioId, getActiveScenario, deleteScenario } from '../scenarioState';
import { isScenarioTargetValid } from '../domain/scenario/validation';
import { useTheme } from '../ui/theme/useTheme';

// Generate preview text for a scenario
function getScenarioPreviewText(scenario: Scenario, assets: Array<{ id: string; name: string }>, liabilities: Array<{ id: string; name: string }>): string {
  if (scenario.kind === 'FLOW_TO_ASSET') {
    const asset = assets.find(a => a.id === scenario.assetId);
    const assetName = asset ? asset.name : 'Unknown asset';
    return `Adds ${formatCurrencyFull(scenario.amountMonthly)} per month to ${assetName}`;
  }
  if (scenario.kind === 'FLOW_TO_DEBT') {
    const liability = liabilities.find(l => l.id === scenario.liabilityId);
    const liabilityName = liability ? liability.name : 'Unknown loan';
    return `Pays extra ${formatCurrencyFull(scenario.amountMonthly)} per month off ${liabilityName}`;
  }
  return '';
}

const ROW_HEIGHT = 44;

export default function ScenarioManagementScreen() {
  const navigation = useNavigation<any>();
  const { state } = useSnapshot();
  const { theme } = useTheme();
  const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioIdLocal] = useState<ScenarioId | undefined>(undefined);
  const [pendingDeleteId, setPendingDeleteId] = useState<ScenarioId | null>(null);
  const [openSwipeableId, setOpenSwipeableId] = useState<string | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  // Gate: Check if baseline surplus is negative (over-allocation)
  const baselineSurplus = selectMonthlySurplus(state);
  const isSurplusNegative = baselineSurplus < -UI_TOLERANCE;

  // Load scenarios whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      async function loadScenarioState() {
        const [scenarios, activeId] = await Promise.all([
          getScenarios(),
          getActiveScenarioId(),
        ]);
        
        // Filter invalid scenarios (targets don't exist in snapshot)
        const validScenarios = scenarios.filter(s => 
          isScenarioTargetValid(s, state.assets, state.liabilities)
        );
        
        // If active scenario is invalid, reset to baseline
        let finalActiveId = activeId;
        if (activeId && activeId !== BASELINE_SCENARIO_ID) {
          const activeScenarioValid = validScenarios.some(s => s.id === activeId);
          if (!activeScenarioValid) {
            console.warn(`Active scenario ${activeId} is invalid (target no longer exists), resetting to baseline`);
            await setActiveScenarioId(BASELINE_SCENARIO_ID);
            finalActiveId = BASELINE_SCENARIO_ID;
          }
        }
        
        setSavedScenarios(validScenarios);
        setActiveScenarioIdLocal(finalActiveId);
      }
      loadScenarioState();
    }, [])
  );

  // Close all swipeables except one
  const closeAllSwipeables = (exceptId?: string) => {
    swipeableRefs.current.forEach((ref, id) => {
      if (id !== exceptId && ref) {
        ref.close();
      }
    });
  };

  // Handle scenario activation (persistence only, no local state updates)
  const handleActivateBaseline = async () => {
    // Gate: Block activation if surplus is negative
    if (isSurplusNegative) {
      return;
    }
    await setActiveScenarioId(undefined);
    navigation.goBack();
  };

  const handleActivateScenario = async (scenarioId: ScenarioId) => {
    // Gate: Block activation if surplus is negative
    if (isSurplusNegative) {
      return;
    }
    await setActiveScenarioId(scenarioId);
    navigation.goBack();
  };

  // Handle edit
  const handleEdit = (scenario: Scenario) => {
    // Guard: baseline cannot be edited
    if (scenario.id === BASELINE_SCENARIO_ID) {
      return;
    }
    closeAllSwipeables();
    navigation.navigate('ScenarioEditor', { scenarioId: scenario.id });
  };

  // Handle delete request
  const handleDeleteRequest = (scenarioId: ScenarioId) => {
    // Guard: baseline cannot be deleted (defensive check)
    if (scenarioId === BASELINE_SCENARIO_ID) {
      return;
    }
    closeAllSwipeables();
    setPendingDeleteId(scenarioId);
  };

  // Cancel delete
  const cancelDelete = () => {
    setPendingDeleteId(null);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!pendingDeleteId) return;

    // Delete scenario (logic-level fallback handles active scenario automatically)
    await deleteScenario(pendingDeleteId);
    
    // Reload scenarios and active ID to reflect any changes
    const [scenarios, activeId] = await Promise.all([
      getScenarios(),
      getActiveScenarioId(),
    ]);
    setSavedScenarios(scenarios);
    setActiveScenarioIdLocal(activeId);

    setPendingDeleteId(null);
  };

  // Render swipe actions (memoized to prevent recreation on every render)
  const renderSwipeActions = useCallback(
    (scenario: Scenario) => {
      const handleEditPress = () => handleEdit(scenario);
      const handleDeletePress = () => handleDeleteRequest(scenario.id);

      return (
        <View style={styles.swipeActionsContainer}>
          <SwipeAction
            variant="edit"
            onPress={handleEditPress}
            accessibilityLabel="Edit"
          />
          <SwipeAction
            variant="delete"
            onPress={handleDeletePress}
            accessibilityLabel="Delete"
          />
        </View>
      );
    },
    [handleEdit, handleDeleteRequest]
  );

  const activeScenario = useMemo(() => 
    getActiveScenario(savedScenarios, activeScenarioId),
    [savedScenarios, activeScenarioId]
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.card }]}>
      <ScreenHeader title="Scenario Management" />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={openSwipeableId === null}
        onScrollBeginDrag={() => {
          closeAllSwipeables();
          setOpenSwipeableId(null);
        }}
      >
        {/* Negative Surplus Banner */}
        {isSurplusNegative && (
          <View style={[styles.warningBanner, { backgroundColor: theme.colors.semantic.warningBg, borderColor: theme.colors.semantic.warning, borderRadius: theme.radius.medium }]}>
            <Text style={[styles.warningBannerText, { color: theme.colors.semantic.warningText, fontSize: theme.typography.bodyLarge.fontSize, lineHeight: theme.typography.bodyLarge.lineHeight }]}>
              Monthly surplus is negative ({formatCurrencyFullSigned(baselineSurplus)}). Reduce allocations or expenses before running what-ifs.
            </Text>
          </View>
        )}

        {/* Baseline Section */}
        <View style={styles.section}>
          <GroupHeader title="Baseline" />
          <View style={[styles.hr, { backgroundColor: theme.colors.border.default }]} />
          <View style={styles.list}>
            <Pressable
              onPress={handleActivateBaseline}
              disabled={isSurplusNegative}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.colors.bg.card },
                pressed ? { backgroundColor: theme.colors.bg.subtle } : null,
                isSurplusNegative ? styles.rowDisabled : null
              ]}
            >
              <View style={[styles.rowMain, { backgroundColor: theme.colors.bg.card }]}>
                <View style={styles.dotContainer}>
                  <Pressable
                    onPress={handleActivateBaseline}
                    hitSlop={10}
                    style={styles.dotPressable}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: !activeScenarioId }}
                  >
                    <View style={[
                      styles.dot,
                      { borderColor: theme.colors.brand.primary },
                      !activeScenarioId ? { backgroundColor: theme.colors.brand.primary } : { backgroundColor: 'transparent', borderColor: theme.colors.border.default }
                    ]} />
                  </Pressable>
                </View>
                <View style={styles.rowBody}>
                  <Text style={[
                    styles.rowTitle,
                    { color: theme.colors.text.primary, fontSize: theme.typography.value.fontSize, fontWeight: theme.typography.value.fontWeight },
                    !activeScenarioId ? { color: theme.colors.brand.primary } : null
                  ]}>Baseline</Text>
                  <Text style={[styles.rowSubtext, { color: theme.colors.text.secondary }]}>Default view</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Scenarios Section */}
        <View style={styles.section}>
          <GroupHeader title="Scenarios" />
          <View style={[styles.hr, { backgroundColor: theme.colors.border.default }]} />
          {savedScenarios.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.colors.text.muted, fontSize: theme.typography.bodyLarge.fontSize }]}>No scenarios yet</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {savedScenarios
                .filter(scenario => scenario.id !== BASELINE_SCENARIO_ID) // Exclude baseline from scenarios list
                .map(scenario => {
                const isActive = activeScenarioId === scenario.id;
                const previewText = getScenarioPreviewText(scenario, state.assets, state.liabilities);
                return (
                  <View key={scenario.id}>
                    <Swipeable
                      ref={(ref) => {
                        if (ref) {
                          swipeableRefs.current.set(scenario.id, ref);
                        } else {
                          swipeableRefs.current.delete(scenario.id);
                        }
                      }}
                      renderRightActions={() => renderSwipeActions(scenario)}
                      overshootRight={false}
                      friction={2}
                      rightThreshold={30}
                      overshootFriction={8}
                      activeOffsetX={[-10, 10]}
                      failOffsetY={[-5, 5]}
                      containerStyle={[styles.swipeableContainer, { backgroundColor: theme.colors.bg.card }]}
                      onSwipeableWillOpen={() => {
                        closeAllSwipeables(scenario.id);
                        setOpenSwipeableId(scenario.id);
                      }}
                      onSwipeableOpen={() => {
                        setOpenSwipeableId(scenario.id);
                      }}
                      onSwipeableClose={() => {
                        if (openSwipeableId === scenario.id) {
                          setOpenSwipeableId(null);
                        }
                      }}
                    >
                      <View style={[styles.row, { backgroundColor: theme.colors.bg.card }]}>
                        <View style={[styles.rowMain, { backgroundColor: theme.colors.bg.card }]}>
                          <View style={styles.dotContainer}>
                            <Pressable
                              onPress={() => handleActivateScenario(scenario.id)}
                              disabled={isSurplusNegative}
                              hitSlop={10}
                              style={[styles.dotPressable, isSurplusNegative ? styles.dotPressableDisabled : null]}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: isActive, disabled: isSurplusNegative }}
                            >
                              <View style={[
                                styles.dot,
                                { borderColor: theme.colors.brand.primary },
                                isActive ? { backgroundColor: theme.colors.brand.primary } : { backgroundColor: 'transparent', borderColor: theme.colors.border.default },
                                isSurplusNegative ? { borderColor: theme.colors.border.default, opacity: 0.5 } : null
                              ]} />
                            </Pressable>
                          </View>
                          <View style={styles.rowBody}>
                            <Text style={[
                              styles.rowTitle,
                              { color: theme.colors.text.primary, fontSize: theme.typography.value.fontSize, fontWeight: theme.typography.value.fontWeight },
                              isActive ? { color: theme.colors.brand.primary } : null
                            ]}>{scenario.name}</Text>
                            <Text style={[styles.rowSubtext, { color: theme.colors.text.secondary }]}>{previewText}</Text>
                          </View>
                        </View>
                      </View>
                    </Swipeable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Create Scenario Row */}
          <Pressable
            onPress={() => {
              if (!isSurplusNegative) {
                navigation.navigate('ScenarioEditor', { scenarioId: undefined });
              }
            }}
            disabled={isSurplusNegative}
            style={({ pressed }) => [
              styles.createRow,
              { borderTopColor: theme.colors.border.subtle },
              pressed ? { backgroundColor: theme.colors.bg.subtle } : null,
              isSurplusNegative ? styles.createRowDisabled : null
            ]}
          >
            <Text style={[
              styles.createRowText,
              { color: theme.colors.brand.primary, fontSize: theme.typography.value.fontSize, fontWeight: theme.typography.value.fontWeight },
              isSurplusNegative ? { color: theme.colors.text.muted } : null
            ]}>
              + Create Scenario
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Delete confirmation modal */}
      {pendingDeleteId ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelDelete}>
          <View style={[styles.deleteModalBackdrop, { backgroundColor: theme.colors.overlay.scrim50 }]}>
            <View style={[styles.deleteModalContent, { backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.large }]}>
              <Text style={[
                styles.deleteModalTitle,
                { color: theme.colors.text.primary, fontSize: theme.typography.valueLarge.fontSize, fontWeight: theme.typography.valueLarge.fontWeight }
              ]}>Delete scenario?</Text>
              <Text style={[
                styles.deleteModalMessage,
                { color: theme.colors.text.secondary, fontSize: theme.typography.bodyLarge.fontSize, lineHeight: theme.typography.bodyLarge.lineHeight }
              ]}>This action cannot be undone.</Text>
              <View style={styles.deleteModalActions}>
                <Pressable
                  onPress={cancelDelete}
                  style={({ pressed }) => [
                    styles.deleteModalButton,
                    styles.deleteModalButtonCancel,
                    {
                      backgroundColor: theme.colors.bg.subtle,
                      borderColor: theme.colors.border.default,
                      borderRadius: theme.radius.medium,
                    },
                    pressed ? { backgroundColor: theme.colors.border.subtle } : null
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[
                    styles.deleteModalButtonCancelText,
                    { color: theme.colors.text.tertiary, fontSize: theme.typography.button.fontSize, fontWeight: theme.typography.button.fontWeight }
                  ]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  style={({ pressed }) => [
                    styles.deleteModalButton,
                    styles.deleteModalButtonConfirm,
                    { backgroundColor: theme.colors.semantic.error, borderRadius: theme.radius.medium },
                    pressed ? { backgroundColor: theme.colors.semantic.errorBg } : null
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete"
                >
                  <Text style={[
                    styles.deleteModalButtonConfirmText,
                    { color: theme.colors.text.primary, fontSize: theme.typography.button.fontSize, fontWeight: theme.typography.button.fontWeight }
                  ]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
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
  hr: {
    height: 1,
    marginTop: layout.sectionTitleBottom,
    marginBottom: layout.componentGap,
  },
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMain: {
    flex: 1,
    height: ROW_HEIGHT,
    paddingHorizontal: layout.rowPaddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  dotContainer: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: layout.componentGap,
  },
  dotPressable: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowSubtext: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    paddingVertical: layout.sectionGap,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  createRow: {
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    marginTop: layout.componentGap,
    borderTopWidth: 1,
  },
  createRowText: {
    fontSize: 15,
    fontWeight: '600',
  },
  swipeableContainer: {
    height: ROW_HEIGHT,
    overflow: 'hidden',
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: ROW_HEIGHT,
    paddingLeft: layout.micro,
    paddingRight: layout.micro,
    paddingVertical: spacing.tiny,
    backgroundColor: 'transparent',
    gap: spacing.tiny,
  },
  swipeActionEdit: {
    width: 35,
    height: ROW_HEIGHT - 8,
    justifyContent: 'center',
    alignItems: 'center',
    // borderRadius set inline with theme.radius.medium
  },
  swipeActionDelete: {
    width: 35,
    height: ROW_HEIGHT - 8,
    justifyContent: 'center',
    alignItems: 'center',
    // borderRadius set inline with theme.radius.medium
    marginLeft: spacing.xs,
  },
  deleteModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    // borderRadius set inline with theme.radius.large
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  deleteModalMessage: {
    fontSize: 14,
    marginBottom: layout.sectionGap,
    lineHeight: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.base,
  },
  deleteModalButton: {
    paddingVertical: layout.inputPadding,
    paddingHorizontal: 20,
    // borderRadius set inline with theme.radius.medium
    minWidth: 80,
    alignItems: 'center',
  },
  deleteModalButtonCancel: {
    borderWidth: 1,
  },
  deleteModalButtonConfirm: {
    // backgroundColor set inline
  },
  deleteModalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteModalButtonConfirmText: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningBanner: {
    marginTop: layout.sectionGap,
    marginHorizontal: layout.screenPadding,
    padding: layout.blockPadding,
    // borderRadius set inline with theme.radius.medium
    borderWidth: 1,
  },
  warningBannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  dotPressableDisabled: {
    opacity: 0.5,
  },
  dotDisabled: {
    opacity: 0.5,
  },
  createRowDisabled: {
    opacity: 0.5,
  },
  createRowTextDisabled: {
    // color set inline
  },
});
