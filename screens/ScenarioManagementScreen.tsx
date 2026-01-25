import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import { useSnapshot } from '../SnapshotContext';
import { formatCurrencyFull, formatCurrencyFullSigned } from '../formatters';
import { layout } from '../layout';
import { UI_TOLERANCE } from '../constants';
import { selectMonthlySurplus } from '../selectors';
import type { Scenario, ScenarioId } from '../domain/scenario/types';
import { BASELINE_SCENARIO_ID } from '../domain/scenario/types';
import { getScenarios, getActiveScenarioId, setActiveScenarioId, getActiveScenario, deleteScenario } from '../scenarioState';
import { isScenarioTargetValid } from '../domain/scenario/validation';

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
          <Pressable
            onPress={handleEditPress}
            style={styles.swipeActionEdit}
            accessibilityRole="button"
            accessibilityLabel="Edit"
          >
            <Feather name="edit-2" size={14} color="#333" />
          </Pressable>
          <Pressable
            onPress={handleDeletePress}
            style={styles.swipeActionDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete"
          >
            <Feather name="trash-2" size={14} color="#fff" />
          </Pressable>
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
    <SafeAreaView edges={['top']} style={styles.container}>
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
          <View style={styles.warningBanner}>
            <Text style={styles.warningBannerText}>
              Monthly surplus is negative ({formatCurrencyFullSigned(baselineSurplus)}). Reduce allocations or expenses before running what-ifs.
            </Text>
          </View>
        )}

        {/* Baseline Section */}
        <View style={styles.section}>
          <GroupHeader title="Baseline" />
          <View style={styles.hr} />
          <View style={styles.list}>
            <Pressable
              onPress={handleActivateBaseline}
              disabled={isSurplusNegative}
              style={({ pressed }) => [
                styles.row, 
                pressed ? styles.rowPressed : null,
                isSurplusNegative ? styles.rowDisabled : null
              ]}
            >
              <View style={styles.rowMain}>
                <View style={styles.dotContainer}>
                  <Pressable
                    onPress={handleActivateBaseline}
                    hitSlop={10}
                    style={styles.dotPressable}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: !activeScenarioId }}
                  >
                    <View style={[styles.dot, !activeScenarioId ? styles.dotActive : styles.dotInactive]} />
                  </Pressable>
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, !activeScenarioId ? styles.rowTitleActive : null]}>Baseline</Text>
                  <Text style={styles.rowSubtext}>Default view</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Scenarios Section */}
        <View style={styles.section}>
          <GroupHeader title="Scenarios" />
          <View style={styles.hr} />
          {savedScenarios.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No scenarios yet</Text>
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
                      containerStyle={styles.swipeableContainer}
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
                      <View style={styles.row}>
                        <View style={styles.rowMain}>
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
                                isActive ? styles.dotActive : styles.dotInactive,
                                isSurplusNegative ? styles.dotDisabled : null
                              ]} />
                            </Pressable>
                          </View>
                          <View style={styles.rowBody}>
                            <Text style={[styles.rowTitle, isActive ? styles.rowTitleActive : null]}>{scenario.name}</Text>
                            <Text style={styles.rowSubtext}>{previewText}</Text>
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
              pressed ? styles.rowPressed : null,
              isSurplusNegative ? styles.createRowDisabled : null
            ]}
          >
            <Text style={[styles.createRowText, isSurplusNegative ? styles.createRowTextDisabled : null]}>
              + Create Scenario
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Delete confirmation modal */}
      {pendingDeleteId ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelDelete}>
          <View style={styles.deleteModalBackdrop}>
            <View style={styles.deleteModalContent}>
              <Text style={styles.deleteModalTitle}>Delete scenario?</Text>
              <Text style={styles.deleteModalMessage}>This action cannot be undone.</Text>
              <View style={styles.deleteModalActions}>
                <Pressable
                  onPress={cancelDelete}
                  style={({ pressed }) => [styles.deleteModalButton, styles.deleteModalButtonCancel, { opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.deleteModalButtonCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  style={({ pressed }) => [styles.deleteModalButton, styles.deleteModalButtonConfirm, { opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete"
                >
                  <Text style={styles.deleteModalButtonConfirmText}>Delete</Text>
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
  hr: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginTop: layout.sectionTitleBottom,
    marginBottom: layout.componentGap,
  },
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowMain: {
    flex: 1,
    height: ROW_HEIGHT,
    paddingHorizontal: layout.rowPaddingHorizontal,
    backgroundColor: '#fff',
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
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#2F5BEA',
  },
  dotActive: {
    backgroundColor: '#2F5BEA',
  },
  dotInactive: {
    backgroundColor: 'transparent',
    borderColor: '#ccc',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  rowTitleActive: {
    color: '#2F5BEA',
  },
  rowSubtext: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  emptyState: {
    paddingVertical: layout.sectionGap,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  createRow: {
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    marginTop: layout.componentGap,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  createRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2F5BEA',
  },
  swipeableContainer: {
    height: ROW_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: ROW_HEIGHT,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  swipeActionEdit: {
    width: 35,
    height: ROW_HEIGHT - 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  swipeActionDelete: {
    width: 35,
    height: ROW_HEIGHT - 8,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 6,
  },
  deleteModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  deleteModalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  deleteModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  deleteModalButtonCancel: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  deleteModalButtonConfirm: {
    backgroundColor: '#dc2626',
  },
  deleteModalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  deleteModalButtonConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  warningBanner: {
    marginTop: layout.sectionGap,
    marginHorizontal: layout.screenPadding,
    padding: layout.blockPadding,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  warningBannerText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  dotPressableDisabled: {
    opacity: 0.5,
  },
  dotDisabled: {
    borderColor: '#ccc',
    opacity: 0.5,
  },
  createRowDisabled: {
    opacity: 0.5,
  },
  createRowTextDisabled: {
    color: '#999',
  },
});
