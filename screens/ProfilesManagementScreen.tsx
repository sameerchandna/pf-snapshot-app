import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import { layout } from '../layout';
import { useSnapshot } from '../SnapshotContext';
import type { ProfileId, ProfileState, ProfilesState } from '../types';

const ROW_HEIGHT = 44;

export default function ProfilesManagementScreen() {
  const navigation = useNavigation<any>();
  const { 
    profilesState,
    switchProfile: switchProfileFromContext, 
    createProfile: createProfileFromContext,
    renameProfile: renameProfileFromContext,
    resetProfile: resetProfileFromContext,
    deleteProfile: deleteProfileFromContext,
  } = useSnapshot();
  const [pendingRenameId, setPendingRenameId] = useState<ProfileId | null>(null);
  const [pendingRenameName, setPendingRenameName] = useState<string>('');
  const [pendingResetId, setPendingResetId] = useState<ProfileId | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<ProfileId | null>(null);
  const [pendingCreate, setPendingCreate] = useState<boolean>(false);
  const [pendingCreateName, setPendingCreateName] = useState<string>('');
  const [openSwipeableId, setOpenSwipeableId] = useState<string | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  // Close all swipeables except one (stable function, no dependencies)
  const closeAllSwipeables = useCallback((exceptId?: string) => {
    swipeableRefs.current.forEach((ref, id) => {
      if (id !== exceptId && ref) {
        ref.close();
      }
    });
  }, []);

  // Get sorted profiles (by lastOpenedAt, descending)
  const sortedProfiles = useMemo(() => {
    if (!profilesState) return [];
    return Object.entries(profilesState.profiles)
      .map(([id, profile]) => ({ id, profile }))
      .sort((a, b) => b.profile.meta.lastOpenedAt - a.profile.meta.lastOpenedAt);
  }, [profilesState]);

  // Handle profile activation (switch)
  // Uses SnapshotContext.switchProfile which updates in-memory state, triggers cold restart, and persists
  const handleActivateProfile = (profileId: ProfileId) => {
    // Call SnapshotContext.switchProfile - this handles:
    // - Updating in-memory ProfilesState.activeProfileId
    // - Updating meta.lastOpenedAt
    // - Triggering cold restart (snapshot rehydrates, projection recomputes, scenarios reset)
    // - Persisting via existing debounced save mechanism
    // UI will update automatically via React re-render when profilesState changes
    switchProfileFromContext(profileId);
    
    // Navigate back to see the updated snapshot/projection
    navigation.goBack();
  };

  // Handle rename request
  const handleRenameRequest = useCallback((profileId: ProfileId) => {
    if (!profilesState) return;
    const profile = profilesState.profiles[profileId];
    if (!profile) return;
    
    closeAllSwipeables();
    setPendingRenameId(profileId);
    setPendingRenameName(profile.meta.name);
  }, [profilesState, closeAllSwipeables]);

  // Cancel rename
  const cancelRename = () => {
    setPendingRenameId(null);
    setPendingRenameName('');
  };

  // Confirm rename
  // Uses SnapshotContext.renameProfile which updates in-memory state and persists
  const confirmRename = () => {
    if (!pendingRenameId) return;

    // Call SnapshotContext.renameProfile - this handles:
    // - Updating in-memory ProfilesState
    // - Persisting via existing debounced save mechanism
    // UI will update automatically via React re-render when profilesState changes
    renameProfileFromContext(pendingRenameId, pendingRenameName.trim());

    setPendingRenameId(null);
    setPendingRenameName('');
  };

  // Handle reset request
  const handleResetRequest = useCallback((profileId: ProfileId) => {
    closeAllSwipeables();
    setPendingResetId(profileId);
  }, [closeAllSwipeables]);

  // Cancel reset
  const cancelReset = () => {
    setPendingResetId(null);
  };

  // Confirm reset
  // Uses SnapshotContext.resetProfile which updates in-memory state and persists
  const confirmReset = () => {
    if (!pendingResetId) return;

    // Call SnapshotContext.resetProfile - this handles:
    // - Updating in-memory ProfilesState
    // - Persisting via existing debounced save mechanism
    // - If resetting active profile, cold restart happens automatically via state change
    // UI will update automatically via React re-render when profilesState changes
    resetProfileFromContext(pendingResetId);

    setPendingResetId(null);
  };

  // Handle delete request
  const handleDeleteRequest = useCallback((profileId: ProfileId) => {
    if (!profilesState) return;
    
    // Guard: cannot delete last profile
    const profileCount = Object.keys(profilesState.profiles).length;
    if (profileCount <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one profile.');
      return;
    }
    
    closeAllSwipeables();
    setPendingDeleteId(profileId);
  }, [profilesState, closeAllSwipeables]);

  // Cancel delete
  const cancelDelete = () => {
    setPendingDeleteId(null);
  };

  // Confirm delete
  // Uses SnapshotContext.deleteProfile which updates in-memory state, persists, and auto-switches if needed
  const confirmDelete = () => {
    if (!pendingDeleteId) return;

    // Call SnapshotContext.deleteProfile - this handles:
    // - Updating in-memory ProfilesState with deleted profile removed
    // - Persisting via existing debounced save mechanism
    // - Auto-switching to most recently used remaining profile if deleting active profile
    // UI will update automatically via React re-render when profilesState changes
    deleteProfileFromContext(pendingDeleteId);

    setPendingDeleteId(null);
  };

  // Handle create request
  const handleCreateRequest = () => {
    closeAllSwipeables();
    setPendingCreate(true);
    setPendingCreateName('');
  };

  // Cancel create
  const cancelCreate = () => {
    setPendingCreate(false);
    setPendingCreateName('');
  };

  // Confirm create
  // Uses SnapshotContext.createProfile which updates in-memory state and persists
  const confirmCreate = () => {
    if (!pendingCreateName.trim()) return;

    // Call SnapshotContext.createProfile - this handles:
    // - Updating in-memory ProfilesState with new profile
    // - Persisting via existing debounced save mechanism
    // UI will update automatically via React re-render when profilesState changes
    createProfileFromContext(pendingCreateName.trim());

    setPendingCreate(false);
    setPendingCreateName('');
  };

  // Render swipe actions (memoized with correct dependencies to avoid stale closures)
  const renderSwipeActions = useCallback(
    (profileId: ProfileId) => {
      const handleRenamePress = () => handleRenameRequest(profileId);
      const handleResetPress = () => handleResetRequest(profileId);
      const handleDeletePress = () => handleDeleteRequest(profileId);

      return (
        <View style={styles.swipeActionsContainer}>
          <Pressable
            onPress={handleRenamePress}
            style={styles.swipeActionRename}
            accessibilityRole="button"
            accessibilityLabel="Rename"
          >
            <Feather name="edit-2" size={14} color="#333" />
          </Pressable>
          <Pressable
            onPress={handleResetPress}
            style={styles.swipeActionReset}
            accessibilityRole="button"
            accessibilityLabel="Reset"
          >
            <Feather name="refresh-cw" size={14} color="#333" />
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
    [handleRenameRequest, handleResetRequest, handleDeleteRequest]
  );

  if (!profilesState) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScreenHeader title="Profiles" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeProfileId = profilesState.activeProfileId;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader title="Profiles" />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={openSwipeableId === null}
        onScrollBeginDrag={() => {
          closeAllSwipeables();
          setOpenSwipeableId(null);
        }}
      >
        <View style={styles.section}>
          <GroupHeader title="Profiles" />
          <View style={styles.hr} />
          {sortedProfiles.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No profiles</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {sortedProfiles.map(({ id, profile }) => {
                const isActive = activeProfileId === id;
                return (
                  <View key={id}>
                    <Swipeable
                      ref={(ref) => {
                        if (ref) {
                          swipeableRefs.current.set(id, ref);
                        } else {
                          swipeableRefs.current.delete(id);
                        }
                      }}
                      renderRightActions={() => renderSwipeActions(id)}
                      overshootRight={false}
                      friction={2}
                      rightThreshold={30}
                      overshootFriction={8}
                      activeOffsetX={[-10, 10]}
                      failOffsetY={[-5, 5]}
                      containerStyle={styles.swipeableContainer}
                      onSwipeableWillOpen={() => {
                        closeAllSwipeables(id);
                        setOpenSwipeableId(id);
                      }}
                      onSwipeableOpen={() => {
                        setOpenSwipeableId(id);
                      }}
                      onSwipeableClose={() => {
                        if (openSwipeableId === id) {
                          setOpenSwipeableId(null);
                        }
                      }}
                    >
                      <View style={styles.row}>
                        <View style={styles.rowMain}>
                          <View style={styles.dotContainer}>
                            <Pressable
                              onPress={() => handleActivateProfile(id)}
                              hitSlop={10}
                              style={styles.dotPressable}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: isActive }}
                            >
                              <View style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]} />
                            </Pressable>
                          </View>
                          <View style={styles.rowBody}>
                            <Text style={[styles.rowTitle, isActive ? styles.rowTitleActive : null]}>{profile.meta.name}</Text>
                          </View>
                        </View>
                      </View>
                    </Swipeable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Create Profile Row */}
          <Pressable
            onPress={handleCreateRequest}
            style={({ pressed }) => [styles.createRow, pressed ? styles.rowPressed : null]}
          >
            <Text style={styles.createRowText}>+ Add new profile</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Rename modal */}
      {pendingRenameId ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelRename}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Rename profile</Text>
              <TextInput
                style={styles.modalInput}
                value={pendingRenameName}
                onChangeText={setPendingRenameName}
                placeholder="Profile name"
                autoFocus={true}
                maxLength={50}
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={cancelRename}
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonCancel, { opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmRename}
                  disabled={!pendingRenameName.trim()}
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonConfirm, { opacity: pressed || !pendingRenameName.trim() ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Save"
                >
                  <Text style={styles.modalButtonConfirmText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Reset confirmation modal */}
      {pendingResetId ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelReset}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Reset profile?</Text>
              <Text style={styles.modalMessage}>This will clear all snapshot data, scenarios, and settings. Profile name will be kept.</Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={cancelReset}
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonCancel, { opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmReset}
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonReset, { opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Reset"
                >
                  <Text style={styles.modalButtonResetText}>Reset</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Delete confirmation modal */}
      {pendingDeleteId ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelDelete}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Delete profile?</Text>
              <Text style={styles.modalMessage}>All data will be permanently deleted. This cannot be undone.</Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={cancelDelete}
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonCancel, { opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonConfirm, { opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete"
                >
                  <Text style={styles.modalButtonDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Create profile modal */}
      {pendingCreate ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelCreate}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New profile</Text>
              <TextInput
                style={styles.modalInput}
                value={pendingCreateName}
                onChangeText={setPendingCreateName}
                placeholder="Profile name"
                autoFocus={true}
                maxLength={50}
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={cancelCreate}
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonCancel, { opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmCreate}
                  disabled={!pendingCreateName.trim()}
                  style={({ pressed }) => [styles.modalButton, styles.modalButtonConfirm, { opacity: pressed || !pendingCreateName.trim() ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Create"
                >
                  <Text style={styles.modalButtonConfirmText}>Create</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
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
  },
  rowTitleActive: {
    color: '#2F5BEA',
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
  swipeActionRename: {
    width: 35,
    height: ROW_HEIGHT - 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  swipeActionReset: {
    width: 35,
    height: ROW_HEIGHT - 8,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 6,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111',
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalButtonConfirm: {
    backgroundColor: '#2F5BEA',
  },
  modalButtonReset: {
    backgroundColor: '#f59e0b',
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalButtonConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonResetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
