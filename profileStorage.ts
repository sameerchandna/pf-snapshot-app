// Profile persistence layer using AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfilesState, ProfileState, ProfileId, SnapshotState } from './types';
import { emptySnapshotState, coerceSnapshotState } from './domainValidation';
import { createBaselineScenario, BASELINE_SCENARIO_ID } from './domain/scenario/types';
import type { Scenario, ScenarioId } from './domain/scenario/types';
import { ensureSystemCash } from './systemAssets';
import { SYSTEM_CASH_ID } from './constants';

const PROFILES_STORAGE_KEY = '@profiles_state';

/**
 * Creates an empty ProfilesState with a default profile.
 * Exported for demo mode initialization.
 */
export function createEmptyProfilesState(): ProfilesState {
  const now = Date.now();
  const defaultProfileId: ProfileId = 'default-profile';
  
  const defaultProfile: ProfileState = {
    snapshotState: emptySnapshotState(),
    scenarioState: {
      scenarios: [createBaselineScenario()],
      activeScenarioId: BASELINE_SCENARIO_ID,
    },
    meta: {
      name: 'My Profile',
      createdAt: now,
      lastOpenedAt: now,
    },
  };

  return {
    activeProfileId: defaultProfileId,
    profiles: {
      [defaultProfileId]: defaultProfile,
    },
  };
}

/**
 * Loads ProfilesState from storage.
 * Returns empty state if missing or invalid.
 */
export async function loadProfilesState(): Promise<ProfilesState> {
  try {
    const jsonValue = await AsyncStorage.getItem(PROFILES_STORAGE_KEY);
    if (jsonValue == null) {
      return createEmptyProfilesState();
    }

    try {
      const parsed: unknown = JSON.parse(jsonValue);
      const validated = validateProfilesState(parsed);
      return validated;
    } catch (parseError) {
      console.error('Error parsing profiles state:', parseError);
      return createEmptyProfilesState();
    }
  } catch (e) {
    console.error('Error loading profiles state:', e);
    return createEmptyProfilesState();
  }
}

/**
 * Loads ProfilesState from storage if present.
 * Returns null if key is missing, validated state otherwise.
 */
export async function loadProfilesStateIfPresent(): Promise<ProfilesState | null> {
  try {
    const jsonValue = await AsyncStorage.getItem(PROFILES_STORAGE_KEY);
    if (jsonValue == null) return null;

    try {
      const parsed: unknown = JSON.parse(jsonValue);
      const validated = validateProfilesState(parsed);
      return validated;
    } catch (parseError) {
      console.error('Error parsing profiles state:', parseError);
      return createEmptyProfilesState();
    }
  } catch (e) {
    console.error('Error loading profiles state:', e);
    return null;
  }
}

/**
 * Saves ProfilesState to storage.
 * Best-effort: does not throw on failure.
 * 
 * Note: Does NOT mutate the input state. Creates a copy with updated lastOpenedAt.
 */
export async function saveProfilesState(state: ProfilesState): Promise<void> {
  try {
    // Update lastOpenedAt for active profile (create new object, don't mutate)
    const activeProfile = state.profiles[state.activeProfileId];
    const stateToSave = activeProfile
      ? {
          ...state,
          profiles: {
            ...state.profiles,
            [state.activeProfileId]: {
              ...activeProfile,
              meta: {
                ...activeProfile.meta,
                lastOpenedAt: Date.now(),
              },
            },
          },
        }
      : state;

    const jsonValue = JSON.stringify(stateToSave);
    await AsyncStorage.setItem(PROFILES_STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Error saving profiles state:', e);
  }
}

/**
 * Generates a unique profile ID using timestamp and random suffix.
 */
function generateProfileId(): ProfileId {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11); // 9 random alphanumeric chars
  return `profile-${timestamp}-${random}`;
}

/**
 * Creates the initial SnapshotState for a blank profile.
 * Matches the same initial state as a fresh app install (with template groups).
 */
function getInitialSnapshotState(): SnapshotState {
  return {
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
  };
}

/**
 * Creates a new blank profile with the given name.
 * 
 * The new profile is initialized with:
 * - snapshotState: Same initial state as a fresh app install (with template groups, no data)
 * - scenarioState: Baseline scenario only (no user-created scenarios)
 * - meta: Name (trimmed), createdAt, lastOpenedAt (all set to now)
 * 
 * The new profile is inserted into ProfilesState.profiles but does NOT become active.
 * Caller must explicitly switch to the new profile if desired.
 * 
 * Returns { profileId, updatedState } on success, or null on failure.
 * Does NOT mutate the input state.
 * Does NOT persist to storage (caller must handle persistence).
 * 
 * @param state - Current ProfilesState
 * @param name - Profile name (will be trimmed)
 * @returns { profileId, updatedState } or null if name is invalid
 */
export function createBlankProfile(
  state: ProfilesState,
  name: string
): { profileId: ProfileId; updatedState: ProfilesState } | null {
  // Validate name: must be non-empty after trimming
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    console.error('Cannot create profile: name is empty after trimming');
    return null;
  }

  // Generate unique profile ID
  let profileId = generateProfileId();
  
  // Ensure ID is unique (extremely unlikely collision, but handle it)
  let attempts = 0;
  while (state.profiles[profileId] && attempts < 10) {
    profileId = generateProfileId();
    attempts++;
  }
  
  if (state.profiles[profileId]) {
    console.error('Failed to generate unique profile ID after multiple attempts');
    return null;
  }

  // Create blank profile
  const now = Date.now();
  const blankProfile: ProfileState = {
    snapshotState: getInitialSnapshotState(),
    scenarioState: {
      scenarios: [createBaselineScenario()],
      activeScenarioId: BASELINE_SCENARIO_ID,
    },
    meta: {
      name: trimmedName,
      createdAt: now,
      lastOpenedAt: now,
    },
  };

  // Insert into ProfilesState (immutable update)
  const updatedState: ProfilesState = {
    ...state,
    profiles: {
      ...state.profiles,
      [profileId]: blankProfile,
    },
  };

  return {
    profileId,
    updatedState,
  };
}

/**
 * Switches the active profile by profileId.
 * Updates ProfilesState.activeProfileId and the new active profile's lastOpenedAt.
 * 
 * Returns the updated ProfilesState, or null if the profileId doesn't exist.
 * Does NOT mutate the input state.
 * 
 * This function is safe to call repeatedly with the same profileId.
 */
export function switchActiveProfile(
  state: ProfilesState,
  profileId: ProfileId
): ProfilesState | null {
  // Validate profile exists
  if (!state.profiles[profileId]) {
    console.error(`Cannot switch to profile ${profileId}: profile does not exist`);
    return null;
  }

  // If already active, just update lastOpenedAt
  if (state.activeProfileId === profileId) {
    const activeProfile = state.profiles[profileId];
    return {
      ...state,
      profiles: {
        ...state.profiles,
        [profileId]: {
          ...activeProfile,
          meta: {
            ...activeProfile.meta,
            lastOpenedAt: Date.now(),
          },
        },
      },
    };
  }

  // Update lastOpenedAt for previous active profile
  const previousActiveProfile = state.profiles[state.activeProfileId];
  const previousProfileUpdated = previousActiveProfile
    ? {
        ...previousActiveProfile,
        meta: {
          ...previousActiveProfile.meta,
          lastOpenedAt: Date.now(),
        },
      }
    : previousActiveProfile;

  // Update lastOpenedAt for new active profile
  const newActiveProfile = state.profiles[profileId];
  const newProfileUpdated = {
    ...newActiveProfile,
    meta: {
      ...newActiveProfile.meta,
      lastOpenedAt: Date.now(),
    },
  };

  return {
    ...state,
    activeProfileId: profileId,
    profiles: {
      ...state.profiles,
      [state.activeProfileId]: previousProfileUpdated,
      [profileId]: newProfileUpdated,
    },
  };
}

/**
 * Renames a profile.
 * 
 * Updates the profile's meta.name to the trimmed new name.
 * Updates meta.lastOpenedAt to current timestamp.
 * 
 * Returns the updated ProfilesState, or null if the profileId doesn't exist or name is invalid.
 * Does NOT mutate the input state.
 * 
 * @param state - Current ProfilesState
 * @param profileId - Profile ID to rename
 * @param newName - New profile name (will be trimmed)
 * @returns Updated ProfilesState or null on failure
 */
export function renameProfile(
  state: ProfilesState,
  profileId: ProfileId,
  newName: string
): ProfilesState | null {
  // Validate profile exists
  const profile = state.profiles[profileId];
  if (!profile) {
    console.error(`Cannot rename profile ${profileId}: profile does not exist`);
    return null;
  }

  // Validate name: must be non-empty after trimming
  const trimmedName = newName.trim();
  if (trimmedName.length === 0) {
    console.error('Cannot rename profile: name is empty after trimming');
    return null;
  }

  // Update profile name and lastOpenedAt
  return {
    ...state,
    profiles: {
      ...state.profiles,
      [profileId]: {
        ...profile,
        meta: {
          ...profile.meta,
          name: trimmedName,
          lastOpenedAt: Date.now(),
        },
      },
    },
  };
}

/**
 * Resets a profile to blank state.
 * 
 * Clears all data while preserving:
 * - profileId (unchanged)
 * - meta.name (unchanged)
 * 
 * Resets:
 * - snapshotState to fresh install defaults (getInitialSnapshotState)
 * - scenarioState to baseline scenario only
 * - meta.lastOpenedAt to current timestamp
 * 
 * Returns the updated ProfilesState, or null if the profileId doesn't exist.
 * Does NOT mutate the input state.
 * 
 * If resetting the active profile, the caller should be aware that this will
 * trigger a cold restart when the state change propagates.
 * 
 * @param state - Current ProfilesState
 * @param profileId - Profile ID to reset
 * @returns Updated ProfilesState or null on failure
 */
export function resetProfile(
  state: ProfilesState,
  profileId: ProfileId
): ProfilesState | null {
  // Validate profile exists
  const profile = state.profiles[profileId];
  if (!profile) {
    console.error(`Cannot reset profile ${profileId}: profile does not exist`);
    return null;
  }

  // Reset to blank state (preserve id and name)
  return {
    ...state,
    profiles: {
      ...state.profiles,
      [profileId]: {
        snapshotState: getInitialSnapshotState(),
        scenarioState: {
          scenarios: [createBaselineScenario()],
          activeScenarioId: BASELINE_SCENARIO_ID,
        },
        meta: {
          name: profile.meta.name, // Preserve name
          createdAt: profile.meta.createdAt, // Preserve creation date
          lastOpenedAt: Date.now(), // Update last opened
        },
      },
    },
  };
}

/**
 * Deletes a profile.
 * 
 * Removes the profile from ProfilesState.profiles.
 * 
 * Guardrails:
 * - Cannot delete the last remaining profile (returns null)
 * - If deleting the active profile, returns newActiveProfileId for caller to switch
 * - If deleting inactive profile, returns updated state only
 * 
 * Returns { updatedState, newActiveProfileId? } on success, or null on failure.
 * Does NOT mutate the input state.
 * 
 * @param state - Current ProfilesState
 * @param profileId - Profile ID to delete
 * @returns { updatedState, newActiveProfileId? } or null on failure
 */
export function deleteProfile(
  state: ProfilesState,
  profileId: ProfileId
): { updatedState: ProfilesState; newActiveProfileId?: ProfileId } | null {
  // Validate profile exists
  if (!state.profiles[profileId]) {
    console.error(`Cannot delete profile ${profileId}: profile does not exist`);
    return null;
  }

  // Guard: cannot delete last remaining profile
  const profileCount = Object.keys(state.profiles).length;
  if (profileCount <= 1) {
    console.error('Cannot delete profile: must have at least one profile');
    return null;
  }

  // Check if deleting active profile
  const isActiveProfile = state.activeProfileId === profileId;
  let newActiveProfileId: ProfileId | undefined = undefined;

  if (isActiveProfile) {
    // Find most recently used remaining profile (by lastOpenedAt, descending)
    const remainingProfiles = Object.entries(state.profiles)
      .filter(([id]) => id !== profileId)
      .map(([id, profile]) => ({ id, profile }))
      .sort((a, b) => b.profile.meta.lastOpenedAt - a.profile.meta.lastOpenedAt);
    
    if (remainingProfiles.length > 0) {
      newActiveProfileId = remainingProfiles[0].id;
    } else {
      // Fallback: use first remaining profile (shouldn't happen due to guard above)
      const firstRemainingId = Object.keys(state.profiles).find(id => id !== profileId);
      if (firstRemainingId) {
        newActiveProfileId = firstRemainingId;
      }
    }
  }

  // Remove profile from profiles Record
  const { [profileId]: deleted, ...remainingProfiles } = state.profiles;

  // Build updated state
  const updatedState: ProfilesState = {
    ...state,
    profiles: remainingProfiles,
    // Update activeProfileId if deleting active profile
    activeProfileId: isActiveProfile && newActiveProfileId ? newActiveProfileId : state.activeProfileId,
  };

  return {
    updatedState,
    newActiveProfileId: isActiveProfile ? newActiveProfileId : undefined,
  };
}

/**
 * Validates and coerces unknown data into ProfilesState.
 * Falls back to empty state on validation failure.
 */
function validateProfilesState(raw: unknown): ProfilesState {
  if (!isRecord(raw)) {
    console.error('Invalid profiles state: not an object');
    return createEmptyProfilesState();
  }

  const activeProfileId = typeof raw.activeProfileId === 'string' ? raw.activeProfileId : null;
  const profiles = isRecord(raw.profiles) ? raw.profiles : {};

  if (!activeProfileId || !profiles[activeProfileId]) {
    console.error('Invalid profiles state: missing activeProfileId or profile');
    return createEmptyProfilesState();
  }

  // Validate all profiles
  const validatedProfiles: Record<ProfileId, ProfileState> = {};
  for (const [id, profile] of Object.entries(profiles)) {
    if (isRecord(profile)) {
      const validated = validateProfileState(profile);
      if (validated) {
        validatedProfiles[id] = validated;
      }
    }
  }

  // Ensure active profile exists
  if (!validatedProfiles[activeProfileId]) {
    console.error('Invalid profiles state: active profile validation failed');
    return createEmptyProfilesState();
  }

  return {
    activeProfileId,
    profiles: validatedProfiles,
  };
}

/**
 * Validates a single ProfileState.
 * Returns null if validation fails.
 */
function validateProfileState(raw: unknown): ProfileState | null {
  if (!isRecord(raw)) return null;

  // Validate snapshotState (minimal check - full validation happens in domainValidation)
  if (!isRecord(raw.snapshotState)) return null;

  // Validate scenarioState
  if (!isRecord(raw.scenarioState)) return null;
  const scenarios = Array.isArray(raw.scenarioState.scenarios) 
    ? raw.scenarioState.scenarios.filter((s): s is Scenario => isRecord(s) && typeof s.id === 'string')
    : [createBaselineScenario()];
  
  // Ensure baseline exists
  const hasBaseline = scenarios.some(s => s.id === BASELINE_SCENARIO_ID);
  if (!hasBaseline) {
    scenarios.unshift(createBaselineScenario());
  }

  const activeScenarioId = typeof raw.scenarioState.activeScenarioId === 'string'
    ? raw.scenarioState.activeScenarioId
    : BASELINE_SCENARIO_ID;

  // Validate meta
  if (!isRecord(raw.meta)) return null;
  const meta = {
    name: typeof raw.meta.name === 'string' ? raw.meta.name : 'My Profile',
    createdAt: typeof raw.meta.createdAt === 'number' ? raw.meta.createdAt : Date.now(),
    lastOpenedAt: typeof raw.meta.lastOpenedAt === 'number' ? raw.meta.lastOpenedAt : Date.now(),
  };

  // Coerce and validate snapshotState, then run SYSTEM_CASH migration
  const coercedSnapshotState = coerceSnapshotState(raw.snapshotState);
  const migratedSnapshotState = ensureSystemCash(coercedSnapshotState);

  return {
    snapshotState: migratedSnapshotState,
    scenarioState: {
      scenarios,
      activeScenarioId,
    },
    meta,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
