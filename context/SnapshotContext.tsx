// Snapshot State Context - central state with best-effort persistence hydration

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AssetItem,
  ContributionItem,
  ExpenseItem,
  Group,
  GoalConfig,
  IncomeItem,
  LiabilityItem,
  LiabilityReductionItem,
  ProjectionInputs,
  SnapshotState,
  ProfilesState,
} from '../types';
import { coerceSnapshotState } from '../domain/domainValidation';
import { loadProfilesState, saveProfilesState, switchActiveProfile, createBlankProfile, renameProfile as renameProfileHelper, resetProfile as resetProfileHelper, deleteProfile as deleteProfileHelper } from '../persistence/profileStorage';
import { migrateLegacyStateToProfiles } from '../persistence/profileMigration';
import { setProfilesStateProvider } from '../scenarioState/scenarioStore';
import type { ProfileId } from '../types';
import { ensureSystemCashExists } from '../domain/systemAssets';
import { SYSTEM_CASH_ID } from '../constants';

interface SnapshotContextType {
  state: SnapshotState;
  profilesState: ProfilesState | null;
  isProfileSwitching: boolean;
  isSwitching: boolean;
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
  setGoals: (goals: GoalConfig[]) => void;
  switchProfile: (profileId: ProfileId) => void;
  createProfile: (name: string) => ProfileId | null;
  renameProfile: (profileId: ProfileId, newName: string) => void;
  resetProfile: (profileId: ProfileId) => void;
  deleteProfile: (profileId: ProfileId) => void;
  reloadFromStorage: () => Promise<void>;
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
  const [profilesState, setProfilesState] = useState<ProfilesState | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);

  const previousActiveProfileIdRef = useRef<ProfileId | null>(null);
  const hasLocalEditsRef = useRef<boolean>(false);
  const [isProfileSwitching, setIsProfileSwitching] = useState<boolean>(false);
  const isSwitching = isProfileSwitching;

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

  const profilesStateRef = useRef<ProfilesState | null>(profilesState);
  useEffect(() => {
    profilesStateRef.current = profilesState;
  }, [profilesState]);

  useEffect(() => {
    setProfilesStateProvider(
      () => profilesStateRef.current,
      (updater) => {
        hasLocalEditsRef.current = true;
        setProfilesState((prev) => {
          if (prev === null) return null;
          return updater(prev);
        });
      }
    );
  }, []);

  // Load from storage on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await migrateLegacyStateToProfiles();
      if (cancelled) return;

      const loaded = await loadProfilesState();
      if (cancelled) return;

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
  const pensionMigrationDoneRef = useRef<boolean>(false);
  useEffect(() => {
    if (!hydrated || !profilesState || pensionMigrationDoneRef.current) return;

    const activeProfile = profilesState.profiles[profilesState.activeProfileId];
    if (!activeProfile) return;

    const snapshotState = activeProfile.snapshotState;

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

    const migratedContributions: ContributionItem[] = snapshotState.pensionItems.map((pensionItem, index) => {
      let targetAsset = snapshotState.assets.find(
        a => a.name.trim().toLowerCase() === pensionItem.name.trim().toLowerCase()
      );
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

    pensionMigrationDoneRef.current = true;

    setStateFromUI(prevState => ({
      ...prevState,
      assetContributions: [...prevState.assetContributions, ...migratedContributions],
      pensionItems: [],
    }));
  }, [hydrated, profilesState, setStateFromUI]);

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
    setProfilesState(result.updatedState);
    return result.profileId;
  }, [profilesState]);

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
    setProfilesState(result.updatedState);
    return result.profileId;
  }, [profilesState]);

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
    setIsProfileSwitching(true);
    setProfilesState(updated);
    hasLocalEditsRef.current = false;
  }, [profilesState]);

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
    setProfilesState(updated);
  }, [profilesState]);

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
    setProfilesState(updated);
  }, [profilesState]);

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
    setProfilesState(result.updatedState);
    if (result.newActiveProfileId) {
      const switched = switchActiveProfile(result.updatedState, result.newActiveProfileId);
      if (switched) {
        setProfilesState(switched);
        hasLocalEditsRef.current = false;
      }
    }
  }, [profilesState]);

  // Detect profile switches and clear switching flag
  useEffect(() => {
    if (!hydrated || !profilesState) return;

    const currentActiveProfileId = profilesState.activeProfileId;
    const previousActiveProfileId = previousActiveProfileIdRef.current;

    if (previousActiveProfileId !== null && previousActiveProfileId !== currentActiveProfileId) {
      console.log(`Profile switched from ${previousActiveProfileId} to ${currentActiveProfileId}`);
      setTimeout(() => {
        setIsProfileSwitching(false);
      }, 0);
    }

    previousActiveProfileIdRef.current = currentActiveProfileId;
  }, [profilesState?.activeProfileId, hydrated]);

  // Persist on changes (debounced, best-effort)
  useEffect(() => {
    if (!hydrated || !profilesState) return;

    const timeout = setTimeout(() => {
      void saveProfilesState(profilesState);
    }, 500);

    return () => clearTimeout(timeout);
  }, [profilesState, hydrated]);

  // Keep createProfileInternal ref up to date (used internally)
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

  const setGoals = useCallback((goals: GoalConfig[]) => {
    hasLocalEditsRef.current = true;
    setProfilesState(prev => {
      if (!prev) return prev;
      const activeProfile = prev.profiles[prev.activeProfileId];
      if (!activeProfile) return prev;
      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [prev.activeProfileId]: {
            ...activeProfile,
            goalState: { goals },
          },
        },
      };
    });
  }, []);

  const reloadFromStorage = useCallback(async () => {
    const loaded = await loadProfilesState();
    hasLocalEditsRef.current = false;
    setProfilesState(loaded);
  }, []);

  return (
    <SnapshotContext.Provider
      value={{
        state,
        profilesState,
        isProfileSwitching,
        isSwitching,
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
        setGoals,
        switchProfile,
        createProfile,
        renameProfile,
        resetProfile,
        deleteProfile,
        reloadFromStorage,
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
