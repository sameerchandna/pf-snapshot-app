import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import ScreenHeader from '../components/ScreenHeader';
import SketchBackground from '../components/SketchBackground';
import SketchCard from '../components/SketchCard';
import SectionHeader from '../components/SectionHeader';
import Divider from '../components/Divider';
import Icon from '../components/Icon';
import SwipeAction from '../components/SwipeAction';
import Row from '../components/PressableRow';
import { layout } from '../ui/layout';
import { spacing } from '../ui/spacing';
import { useSnapshot } from '../context/SnapshotContext';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { radius } from '../ui/theme/theme';
import type { ProfileId, ProfileState, ProfilesState } from '../types';

const ROW_HEIGHT = 44;

export default function ProfilesManagementScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const palette = useScreenPalette();
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
          <SwipeAction
            variant="rename"
            onPress={handleRenamePress}
            accessibilityLabel="Rename"
          />
          <SwipeAction
            variant="reset"
            onPress={handleResetPress}
            accessibilityLabel="Reset"
          />
          <SwipeAction
            variant="delete"
            onPress={handleDeletePress}
            accessibilityLabel="Delete"
          />
        </View>
      );
    },
    [handleRenameRequest, handleResetRequest, handleDeleteRequest]
  );

  if (!profilesState) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <SketchBackground color={palette.accent} style={{flex:1}}>
        <ScreenHeader title="Profiles" />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, theme.typography.bodyLarge, { color: theme.colors.text.muted }]}>Loading...</Text>
        </View>
        </SketchBackground>
      </SafeAreaView>
    );
  }

  const activeProfileId = profilesState.activeProfileId;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.bg} style={{flex:1}}>
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
          <SectionHeader title="Profiles" />
          <View style={{ marginTop: layout.sectionTitleBottom, marginBottom: layout.componentGap }}>
            <Divider />
          </View>
          {sortedProfiles.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, theme.typography.bodyLarge]}>No profiles</Text>
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
                      containerStyle={[styles.swipeableContainer, { backgroundColor: theme.colors.bg.card }]}
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
                      <Row
                        onPress={() => handleActivateProfile(id)}
                        leading={
                          <View style={styles.dotContainer}>
                            <Pressable
                              onPress={() => handleActivateProfile(id)}
                              hitSlop={10}
                              style={styles.dotPressable}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: isActive }}
                            >
                              <View style={[
                                styles.dot,
                                isActive
                                  ? { backgroundColor: theme.colors.brand.primary, borderColor: theme.colors.brand.primary }
                                  : { backgroundColor: 'transparent', borderColor: theme.colors.border.default }
                              ]} />
                            </Pressable>
                          </View>
                        }
                        showBottomDivider={true}
                      >
                        <Text style={[
                          styles.rowTitle,
                          theme.typography.value,
                          { color: isActive ? theme.colors.brand.primary : theme.colors.text.primary }
                        ]}>
                          {profile.meta.name}
                        </Text>
                      </Row>
                    </Swipeable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Create Profile Row */}
          <Divider variant="subtle" />
          <Pressable
            onPress={handleCreateRequest}
            style={({ pressed }) => [
              styles.createRow,
              {
                backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
              }
            ]}
          >
            <Text style={[styles.createRowText, theme.typography.value, { color: theme.colors.brand.primary }]}>+ Add new profile</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Rename modal */}
      {pendingRenameId ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelRename}>
          <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay.scrim50 }]}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.bg.card }]}>
              <Text style={[styles.modalTitle, theme.typography.valueLarge, { color: theme.colors.text.primary }]}>Rename profile</Text>
              <SketchCard
                borderColor={palette.accent}
                fillColor={theme.colors.bg.card}
                borderRadius={radius.medium}
                style={styles.modalInputWrapper}
              >
                <TextInput
                  style={[styles.modalInputInner, theme.typography.input, { color: theme.colors.text.primary }]}
                  value={pendingRenameName}
                  onChangeText={setPendingRenameName}
                  placeholder="Profile name"
                  autoFocus={true}
                  maxLength={50}
                />
              </SketchCard>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={cancelRename}
                  style={({ pressed }) => [
                    styles.modalButton,
                    {
                      backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                      borderColor: theme.colors.border.default,
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.modalButtonCancelText, theme.typography.button, { color: theme.colors.text.tertiary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmRename}
                  disabled={!pendingRenameName.trim()}
                  style={({ pressed }) => [
                    styles.modalButton,
                    {
                      backgroundColor: pressed || !pendingRenameName.trim() ? theme.colors.bg.subtle : theme.colors.brand.primary,
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Save"
                >
                  <Text style={[styles.modalButtonConfirmText, theme.typography.button, { color: theme.colors.brand.onPrimary }]}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Reset confirmation modal */}
      {pendingResetId ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelReset}>
          <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay.scrim50 }]}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.bg.card }]}>
              <Text style={[styles.modalTitle, theme.typography.valueLarge, { color: theme.colors.text.primary }]}>Reset profile?</Text>
              <Text style={[styles.modalMessage, theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>This will clear all snapshot data, scenarios, and settings. Profile name will be kept.</Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={cancelReset}
                  style={({ pressed }) => [
                    styles.modalButton,
                    {
                      backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                      borderColor: theme.colors.border.default,
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.modalButtonCancelText, theme.typography.button, { color: theme.colors.text.tertiary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmReset}
                  style={({ pressed }) => [
                    styles.modalButton,
                    { backgroundColor: pressed ? theme.colors.semantic.warningBg : theme.colors.semantic.warning }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Reset"
                >
                  <Text style={[styles.modalButtonResetText, theme.typography.button, { color: theme.colors.brand.onPrimary }]}>Reset</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Delete confirmation modal */}
      {pendingDeleteId ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelDelete}>
          <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay.scrim50 }]}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.bg.card }]}>
              <Text style={[styles.modalTitle, theme.typography.valueLarge, { color: theme.colors.text.primary }]}>Delete profile?</Text>
              <Text style={[styles.modalMessage, theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>All data will be permanently deleted. This cannot be undone.</Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={cancelDelete}
                  style={({ pressed }) => [
                    styles.modalButton,
                    {
                      backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                      borderColor: theme.colors.border.default,
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.modalButtonCancelText, theme.typography.button, { color: theme.colors.text.tertiary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  style={({ pressed }) => [
                    styles.modalButton,
                    { backgroundColor: pressed ? theme.colors.semantic.errorBg : theme.colors.semantic.error }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete"
                >
                  <Text style={[styles.modalButtonDeleteText, theme.typography.button, { color: theme.colors.brand.onPrimary }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Create profile modal */}
      {pendingCreate ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelCreate}>
          <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay.scrim50 }]}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.bg.card }]}>
              <Text style={[styles.modalTitle, theme.typography.valueLarge, { color: theme.colors.text.primary }]}>New profile</Text>
              <SketchCard
                borderColor={palette.accent}
                fillColor={theme.colors.bg.card}
                borderRadius={radius.medium}
                style={styles.modalInputWrapper}
              >
                <TextInput
                  style={[styles.modalInputInner, theme.typography.input, { color: theme.colors.text.primary }]}
                  value={pendingCreateName}
                  onChangeText={setPendingCreateName}
                  placeholder="Profile name"
                  autoFocus={true}
                  maxLength={50}
                />
              </SketchCard>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={cancelCreate}
                  style={({ pressed }) => [
                    styles.modalButton,
                    {
                      backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.subtle,
                      borderColor: theme.colors.border.default,
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.modalButtonCancelText, theme.typography.button, { color: theme.colors.text.tertiary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmCreate}
                  disabled={!pendingCreateName.trim()}
                  style={({ pressed }) => [
                    styles.modalButton,
                    {
                      backgroundColor: pressed || !pendingCreateName.trim() ? theme.colors.bg.subtle : theme.colors.brand.primary,
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Create"
                >
                  <Text style={[styles.modalButtonConfirmText, theme.typography.button, { color: theme.colors.brand.onPrimary }]}>Create</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
      </SketchBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    // Typography moved to inline style with theme token
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
    // Divider component handles visual styling
  },
  list: {
    gap: spacing.zero,
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
    borderRadius: radius.small,
    borderWidth: 1.5,
  },
  rowTitle: {
    // Typography moved to inline style with theme token
  },
  emptyState: {
    paddingVertical: layout.sectionGap,
    alignItems: 'center',
  },
  emptyText: {
    // Typography moved to inline style with theme token
    fontStyle: 'italic',
  },
  createRow: {
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    marginTop: layout.componentGap,
  },
  createRowText: {
    // Typography moved to inline style with theme token
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
  swipeActionRename: {
    width: 35,
    height: ROW_HEIGHT - 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.medium,
  },
  swipeActionReset: {
    width: 35,
    height: ROW_HEIGHT - 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.medium,
    marginLeft: spacing.xs,
  },
  swipeActionDelete: {
    width: 35,
    height: ROW_HEIGHT - 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.medium,
    marginLeft: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.section,
  },
  modalContent: {
    borderRadius: radius.large,
    padding: spacing.section,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    // Typography moved to inline style with theme token (18px/700 → 18px/600 via theme.typography.valueLarge)
    marginBottom: spacing.sm,
  },
  modalMessage: {
    // Typography moved to inline style with theme token
    marginBottom: layout.sectionGap,
  },
  modalInputWrapper: {
    marginBottom: layout.sectionGap,
  },
  modalInputInner: {
    padding: spacing.base,
    alignSelf: 'stretch',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.base,
  },
  modalButton: {
    paddingVertical: layout.inputPadding,
    paddingHorizontal: spacing.section,
    borderRadius: radius.medium,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    // Typography moved to inline style with theme token
  },
  modalButtonConfirmText: {
    // Typography moved to inline style with theme token
  },
  modalButtonResetText: {
    // Typography moved to inline style with theme token
  },
  modalButtonDeleteText: {
    // Typography moved to inline style with theme token
  },
});
