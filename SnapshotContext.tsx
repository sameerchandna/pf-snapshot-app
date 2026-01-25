// Snapshot State Context - central state with best-effort persistence hydration

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AssetItem,
  ContributionItem,
  ExpenseItem,
  Group,
  IncomeItem,
  LiabilityItem,
  LiabilityReductionItem,
  ProjectionInputs,
  SnapshotState,
  ProfilesState,
} from './types';
import { coerceSnapshotState } from './domainValidation';
import { loadProfilesState, loadProfilesStateIfPresent, saveProfilesState, switchActiveProfile, createBlankProfile, renameProfile as renameProfileHelper, resetProfile as resetProfileHelper, deleteProfile as deleteProfileHelper } from './profileStorage';
import { migrateLegacyStateToProfiles } from './profileMigration';
import { setProfilesStateProvider } from './scenarioState/scenarioStore';
import type { ProfileId } from './types';
import { ensureSystemCashExists } from './systemAssets';
import { SYSTEM_CASH_ID } from './constants';

interface SnapshotContextType {
  state: SnapshotState;
  profilesState: ProfilesState | null;
  isProfileSwitching: boolean;
  setGrossIncomeItems: (items: IncomeItem[]) => void;
  setNetIncomeItems: (items: IncomeItem[]) => void;
  setExpenseGroups: (groups: Group[]) => void;
  setExpenses: (items: ExpenseItem[]) => void;
  setAssetContributions: (items: ContributionItem[]) => void;
  setLiabilityReductions: (items: LiabilityReductionItem[]) => void;
  setAssetGroups: (groups: Group[]) => void;
  setAssets: (items: AssetItem[]) => void;
  setLiabilityGroups: (groups: Group[]) => void;
  setLiabilities: (items: LiabilityItem[]) => void;
  setProjection: (inputs: ProjectionInputs) => void;
  switchProfile: (profileId: ProfileId) => void;
  createProfile: (name: string) => ProfileId | null;
  renameProfile: (profileId: ProfileId, newName: string) => void;
  resetProfile: (profileId: ProfileId) => void;
  deleteProfile: (profileId: ProfileId) => void;
}

const SnapshotContext = createContext<SnapshotContextType | undefined>(undefined);

// Initial state with placeholder values (numbers only)
const getInitialState = (): SnapshotState => ({
  grossIncomeItems: [],
  pensionItems: [],
  netIncomeItems: [],
  expenseGroups: [
    { id: 'housing', name: 'Housing' },
    { id: 'subscriptions', name: 'Subscriptions' },
    { id: 'other', name: 'Other' },
  ],
  expenses: [],
  assetGroups: [
    { id: 'assets-cash', name: 'Cash' },
    { id: 'assets-savings', name: 'Savings' },
    { id: 'assets-investments', name: 'Investments' },
    { id: 'assets-other', name: 'Other' },
  ],
  assets: [
    {
      id: SYSTEM_CASH_ID,
      name: 'Cash',
      balance: 0,
      annualGrowthRatePct: 0,
      groupId: 'assets-cash',
      availability: { type: 'immediate' },
      isActive: true,
    },
  ],
  liabilityGroups: [
    { id: 'liab-credit', name: 'Credit' },
    { id: 'liab-other', name: 'Other' },
  ],
  liabilities: [],
  assetContributions: [],
  liabilityReductions: [],
  projection: {
    currentAge: 30,
    endAge: 60,
    inflationPct: 0.0,
    monthlyDebtReduction: 0,
  },
});

export function SnapshotProvider({ children }: { children: React.ReactNode }) {
  // Internal ProfilesState management
  // Initialize with empty state to prevent null checks
  const [profilesState, setProfilesState] = useState<ProfilesState | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);
  
  // Track activeProfileId to detect profile switches
  const previousActiveProfileIdRef = useRef<ProfileId | null>(null);

  // If the user edits before hydration completes, don't overwrite with older persisted data.
  const hasLocalEditsRef = useRef<boolean>(false);
  
  // Track profile switching state to gate A3 guardrails during transient period
  const [isProfileSwitching, setIsProfileSwitching] = useState<boolean>(false);

  // Derived: active profile's snapshotState (for API compatibility)
  const state: SnapshotState = profilesState
    ? profilesState.profiles[profilesState.activeProfileId]?.snapshotState ?? coerceSnapshotState(getInitialState())
    : coerceSnapshotState(getInitialState());

  const setStateFromUI = useCallback((updater: (prev: SnapshotState) => SnapshotState) => {
    hasLocalEditsRef.current = true;
    setProfilesState(prev => {
      if (!prev) return prev;
      const activeProfile = prev.profiles[prev.activeProfileId];
      if (!activeProfile) return prev;

      const updatedSnapshotState = updater(activeProfile.snapshotState);
      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [prev.activeProfileId]: {
            ...activeProfile,
            snapshotState: coerceSnapshotState(updatedSnapshotState),
          },
        },
      };
    });
  }, []);

  // Keep a ref to the latest profilesState for the provider function
  const profilesStateRef = useRef<ProfilesState | null>(profilesState);
  useEffect(() => {
    profilesStateRef.current = profilesState;
  }, [profilesState]);

  // Register ProfilesState provider with scenarioStore (only once)
  useEffect(() => {
    setProfilesStateProvider(
      () => profilesStateRef.current,
      (updater) => {
        hasLocalEditsRef.current = true;
        setProfilesState(updater);
      }
    );
  }, []); // Empty deps - only register once

  // Migration gate: run before hydration
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Step 1: Run migration if needed
      await migrateLegacyStateToProfiles();
      if (cancelled) return;

      // Step 2: Load ProfilesState
      const loaded = await loadProfilesState();
      if (cancelled) return;

      // Option A: on fresh install (no persisted profiles), keep seeded template groups.
      // Only overwrite state when persisted profiles actually exist.
      if (!hasLocalEditsRef.current) {
        setProfilesState(loaded);
      }

      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Migration: Convert pensionItems → assetContributions with contributionType: 'preTax'
  // This runs once after hydration to migrate legacy pensionItems data
  const pensionMigrationDoneRef = useRef<boolean>(false);
  useEffect(() => {
    if (!hydrated || !profilesState || pensionMigrationDoneRef.current) return;

    const activeProfile = profilesState.profiles[profilesState.activeProfileId];
    if (!activeProfile) return;

    const snapshotState = activeProfile.snapshotState;
    
    // Skip migration if:
    // 1. No pensionItems exist
    // 2. Already have preTax contributions (already migrated)
    // 3. No assets exist (can't create contributions without assetId)
    if (snapshotState.pensionItems.length === 0) {
      pensionMigrationDoneRef.current = true;
      return;
    }
    if (snapshotState.assetContributions.some(c => c.contributionType === 'preTax')) {
      pensionMigrationDoneRef.current = true;
      return;
    }
    if (snapshotState.assets.length === 0) {
      pensionMigrationDoneRef.current = true;
      return;
    }

    // Migrate each pensionItem to a ContributionItem with contributionType: 'preTax'
    // Try to match by asset name, otherwise use the first asset
    const migratedContributions: ContributionItem[] = snapshotState.pensionItems.map((pensionItem, index) => {
      // Try to find an asset with a matching name (case-insensitive)
      let targetAsset = snapshotState.assets.find(
        a => a.name.trim().toLowerCase() === pensionItem.name.trim().toLowerCase()
      );

      // If no match, use the first asset
      if (!targetAsset) {
        targetAsset = snapshotState.assets[0];
      }

      return {
        id: `pension-migrated-${Date.now()}-${index}`,
        assetId: targetAsset.id,
        amountMonthly: pensionItem.monthlyAmount,
        contributionType: 'preTax' as const,
      };
    });

    // Mark migration as done before updating state
    pensionMigrationDoneRef.current = true;

    // Merge with existing contributions and clear pensionItems
    setStateFromUI(prevState => ({
      ...prevState,
      assetContributions: [...prevState.assetContributions, ...migratedContributions],
      pensionItems: [], // Clear after migration
    }));
  }, [hydrated, profilesState, setStateFromUI]);

  // Internal function to create a blank profile (not exposed in public API)
  // Creates a new profile with initial state but does NOT switch to it
  const createProfileInternal = useCallback((name: string): ProfileId | null => {
    if (!profilesState) {
      console.warn('Cannot create profile: ProfilesState not loaded');
      return null;
    }

    const result = createBlankProfile(profilesState, name);
    if (!result) {
      console.error(`Failed to create profile with name: ${name}`);
      return null;
    }

    // Update ProfilesState with new profile
    setProfilesState(result.updatedState);
    
    // Return profileId (caller can switch to it if desired)
    return result.profileId;
  }, [profilesState]);

  // Public function to create a new profile
  // Updates in-memory ProfilesState, inserts new profile, persists via existing debounced save
  // Returns the new profileId, or null on failure
  const createProfile = useCallback((name: string): ProfileId | null => {
    if (!profilesState) {
      console.warn('Cannot create profile: ProfilesState not loaded');
      return null;
    }

    const result = createBlankProfile(profilesState, name);
    if (!result) {
      console.error(`Failed to create profile with name: ${name}`);
      return null;
    }

    // Update in-memory ProfilesState with new profile
    // This will trigger persistence via existing debounced save mechanism
    setProfilesState(result.updatedState);
    
    // Return profileId (caller can switch to it if desired)
    return result.profileId;
  }, [profilesState]);

  // Public function to switch active profile
  // This triggers a cold restart: state rehydrates, projection recomputes, scenarios reset
  // Updates in-memory ProfilesState, triggers cold restart, and persists via existing debounced save
  const switchProfile = useCallback((profileId: ProfileId) => {
    if (!profilesState) {
      console.warn('Cannot switch profile: ProfilesState not loaded');
      return;
    }

    const updated = switchActiveProfile(profilesState, profileId);
    if (!updated) {
      console.error(`Failed to switch to profile ${profileId}`);
      return;
    }

    // Set profile switching flag to gate A3 guardrails during transient period
    setIsProfileSwitching(true);

    // Update ProfilesState - this will trigger:
    // 1. Derived `state` to change (from new active profile's snapshotState)
    // 2. Projection to recompute (via state change)
    // 3. Scenarios to reset (via scenarioStore reading from new active profile)
    // 4. Persistence via existing debounced save mechanism
    setProfilesState(updated);
    
    // Reset local edits flag to allow rehydration from new profile
    hasLocalEditsRef.current = false;
  }, [profilesState]);

  // Public function to rename a profile
  // Updates in-memory ProfilesState and persists via existing debounced save
  const renameProfile = useCallback((profileId: ProfileId, newName: string) => {
    if (!profilesState) {
      console.warn('Cannot rename profile: ProfilesState not loaded');
      return;
    }

    const updated = renameProfileHelper(profilesState, profileId, newName);
    if (!updated) {
      console.error(`Failed to rename profile ${profileId}`);
      return;
    }

    // Update in-memory ProfilesState - persistence happens automatically via debounced save
    setProfilesState(updated);
  }, [profilesState]);

  // Public function to reset a profile to blank state
  // Updates in-memory ProfilesState and persists via existing debounced save
  // If resetting active profile, the state change will naturally trigger cold restart
  const resetProfile = useCallback((profileId: ProfileId) => {
    if (!profilesState) {
      console.warn('Cannot reset profile: ProfilesState not loaded');
      return;
    }

    const updated = resetProfileHelper(profilesState, profileId);
    if (!updated) {
      console.error(`Failed to reset profile ${profileId}`);
      return;
    }

    // Update in-memory ProfilesState - persistence happens automatically via debounced save
    // If resetting active profile, derived `state` will update from reset profile's snapshotState
    // This naturally triggers cold restart behavior
    setProfilesState(updated);
  }, [profilesState]);

  // Public function to delete a profile
  // Updates in-memory ProfilesState and persists via existing debounced save
  // If deleting active profile, auto-switches to most recently used remaining profile
  const deleteProfile = useCallback((profileId: ProfileId) => {
    if (!profilesState) {
      console.warn('Cannot delete profile: ProfilesState not loaded');
      return;
    }

    const result = deleteProfileHelper(profilesState, profileId);
    if (!result) {
      console.error(`Failed to delete profile ${profileId}`);
      return;
    }

    // Update in-memory ProfilesState with deleted profile removed
    setProfilesState(result.updatedState);

    // If deleting active profile, switch to new active profile
    if (result.newActiveProfileId) {
      // Use internal switch logic to update activeProfileId and trigger cold restart
      const switched = switchActiveProfile(result.updatedState, result.newActiveProfileId);
      if (switched) {
        setProfilesState(switched);
        // Reset local edits flag to allow rehydration from new profile
        hasLocalEditsRef.current = false;
      }
    }
  }, [profilesState]);

  // Detect profile switches and ensure clean reset
  useEffect(() => {
    if (!hydrated || !profilesState) return;

    const currentActiveProfileId = profilesState.activeProfileId;
    const previousActiveProfileId = previousActiveProfileIdRef.current;

    // If activeProfileId changed, we've switched profiles
    if (previousActiveProfileId !== null && previousActiveProfileId !== currentActiveProfileId) {
      // Profile switch detected - ensure clean state
      // The derived `state` will automatically update from the new active profile
      // Projection will recompute when `state` changes
      // Scenarios will reset when scenarioStore reads from new active profile's scenarioState
      console.log(`Profile switched from ${previousActiveProfileId} to ${currentActiveProfileId}`);
      
      // Clear profile switching flag on first render after activeProfileId changes
      // Use setTimeout to allow React to finish rendering with new state before clearing flag
      setTimeout(() => {
        setIsProfileSwitching(false);
      }, 0);
    }

    // Update ref for next comparison
    previousActiveProfileIdRef.current = currentActiveProfileId;
  }, [profilesState?.activeProfileId, hydrated]);

  // Persist on changes (debounced, best-effort)
  useEffect(() => {
    if (!hydrated || !profilesState) return;

    const timeout = setTimeout(() => {
      // Best-effort: profileStorage never throws, but we still ignore any rejection.
      void saveProfilesState(profilesState);
    }, 500);

    return () => clearTimeout(timeout);
  }, [profilesState, hydrated]);

  // Expose createProfileInternal via ref for internal use (not in public API)
  const createProfileRef = useRef(createProfileInternal);
  useEffect(() => {
    createProfileRef.current = createProfileInternal;
  }, [createProfileInternal]);

  const setGrossIncomeItems = useCallback((items: IncomeItem[]) => {
    setStateFromUI(s => ({ ...s, grossIncomeItems: items }));
  }, [setStateFromUI]);

  const setNetIncomeItems = useCallback((items: IncomeItem[]) => {
    setStateFromUI(s => ({ ...s, netIncomeItems: items }));
  }, [setStateFromUI]);

  const setExpenseGroups = useCallback((groups: Group[]) => {
    setStateFromUI(s => ({ ...s, expenseGroups: groups }));
  }, [setStateFromUI]);

  const setExpenses = useCallback((items: ExpenseItem[]) => {
    setStateFromUI(s => ({ ...s, expenses: items }));
  }, [setStateFromUI]);

  const setAssetContributions = useCallback((items: ContributionItem[]) => {
    setStateFromUI(s => ({ ...s, assetContributions: items }));
  }, [setStateFromUI]);

  const setLiabilityReductions = useCallback((items: LiabilityReductionItem[]) => {
    setStateFromUI(s => ({ ...s, liabilityReductions: items }));
  }, [setStateFromUI]);

  const setAssetGroups = useCallback((groups: Group[]) => {
    setStateFromUI(s => ({ ...s, assetGroups: groups }));
  }, [setStateFromUI]);

  const setAssets = useCallback((items: AssetItem[]) => {
    // CRITICAL: Always preserve SYSTEM_CASH when updating assets
    // This ensures SYSTEM_CASH exists exactly once, even if user operations drop it
    const assetsWithSystemCash = ensureSystemCashExists(items);
    setStateFromUI(s => ({ ...s, assets: assetsWithSystemCash }));
  }, [setStateFromUI]);

  const setLiabilityGroups = useCallback((groups: Group[]) => {
    setStateFromUI(s => ({ ...s, liabilityGroups: groups }));
  }, [setStateFromUI]);

  const setLiabilities = useCallback((items: LiabilityItem[]) => {
    setStateFromUI(s => ({ ...s, liabilities: items }));
  }, [setStateFromUI]);

  const setProjection = useCallback((inputs: ProjectionInputs) => {
    setStateFromUI(s => ({ ...s, projection: inputs }));
  }, [setStateFromUI]);

  return (
    <SnapshotContext.Provider
      value={{
        state,
        profilesState,
        isProfileSwitching,
        setGrossIncomeItems,
        setNetIncomeItems,
        setExpenseGroups,
        setExpenses,
        setAssetContributions,
        setLiabilityReductions,
        setAssetGroups,
        setAssets,
        setLiabilityGroups,
        setLiabilities,
        setProjection,
        switchProfile,
        createProfile,
        renameProfile,
        resetProfile,
        deleteProfile,
      }}
    >
      {children}
    </SnapshotContext.Provider>
  );
}

export function useSnapshot() {
  const context = useContext(SnapshotContext);
  if (!context) {
    throw new Error('useSnapshot must be used within SnapshotProvider');
  }
  return context;
}

