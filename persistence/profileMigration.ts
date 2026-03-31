// One-time migration from legacy single-profile state to ProfilesState

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfilesState, ProfileState, ProfileId } from '../types';
import { loadSnapshotStateIfPresent } from './storage';
import { loadScenarios, loadActiveScenarioId } from '../scenarioState/scenarioPersistence';
import { createBaselineScenario, BASELINE_SCENARIO_ID } from '../domain/scenario/types';
import type { Scenario } from '../domain/scenario/types';
import { emptySnapshotState } from '../domain/domainValidation';

const PROFILES_STORAGE_KEY = '@profiles_state';
const MIGRATION_FLAG_KEY = '@profiles_migrated';

/**
 * Checks if migration has already been completed.
 */
async function isMigrationComplete(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
    return flag === 'true';
  } catch {
    return false;
  }
}

/**
 * Checks if legacy state exists (needs migration).
 */
async function hasLegacyState(): Promise<boolean> {
  try {
    // Check for legacy snapshot state
    const snapshotState = await AsyncStorage.getItem('@snapshot_state');
    if (snapshotState == null) return false;

    // Check for legacy scenario state (at least one key exists)
    const scenarios = await AsyncStorage.getItem('@pf.scenarios');
    const activeScenarioId = await AsyncStorage.getItem('@pf.activeScenarioId');
    
    // Migration needed if snapshot exists OR scenario keys exist
    return snapshotState != null || scenarios != null || activeScenarioId != null;
  } catch {
    return false;
  }
}

/**
 * Checks if ProfilesState already exists.
 */
async function hasProfilesState(): Promise<boolean> {
  try {
    const profilesState = await AsyncStorage.getItem(PROFILES_STORAGE_KEY);
    return profilesState != null;
  } catch {
    return false;
  }
}

/**
 * Performs one-time migration from legacy state to ProfilesState.
 * 
 * Migration logic:
 * 1. Load legacy SnapshotState from @snapshot_state
 * 2. Load legacy scenarios from @pf.scenarios and @pf.activeScenarioId
 * 3. Create "My Profile" with migrated data
 * 4. Set as active profile
 * 5. Persist ProfilesState
 * 6. Mark migration as complete
 * 
 * This function is idempotent and safe to call multiple times.
 */
export async function migrateLegacyStateToProfiles(): Promise<ProfilesState | null> {
  // Check if migration already completed
  if (await isMigrationComplete()) {
    return null;
  }

  // Check if ProfilesState already exists
  if (await hasProfilesState()) {
    // Mark as migrated to prevent re-running
    await markMigrationComplete();
    return null;
  }

  // Check if legacy state exists
  if (!(await hasLegacyState())) {
    // No legacy state - mark as migrated (fresh install)
    await markMigrationComplete();
    return null;
  }

  console.log('Starting legacy state migration to ProfilesState...');

  try {
    // Load legacy snapshot state
    const legacySnapshotState = await loadSnapshotStateIfPresent();
    
    // Load legacy scenarios
    let legacyScenarios: Scenario[] = [];
    let legacyActiveScenarioId: string | undefined = undefined;
    
    try {
      legacyScenarios = await loadScenarios();
      legacyActiveScenarioId = await loadActiveScenarioId(legacyScenarios);
    } catch (scenarioError) {
      console.error('Error loading legacy scenarios, using baseline:', scenarioError);
      legacyScenarios = [createBaselineScenario()];
      legacyActiveScenarioId = BASELINE_SCENARIO_ID;
    }

    // Ensure baseline exists
    const hasBaseline = legacyScenarios.some(s => s.id === BASELINE_SCENARIO_ID);
    if (!hasBaseline) {
      legacyScenarios.unshift(createBaselineScenario());
    }

    // Use baseline if activeScenarioId is invalid
    if (!legacyActiveScenarioId || !legacyScenarios.some(s => s.id === legacyActiveScenarioId)) {
      legacyActiveScenarioId = BASELINE_SCENARIO_ID;
    }

    // Create migrated profile
    const now = Date.now();
    const migratedProfileId: ProfileId = 'migrated-profile';
    
    const migratedSnapshotState = legacySnapshotState || emptySnapshotState();
    
    const migratedProfile: ProfileState = {
      snapshotState: migratedSnapshotState,
      scenarioState: {
        scenarios: legacyScenarios,
        activeScenarioId: legacyActiveScenarioId,
      },
      meta: {
        name: 'My Profile',
        createdAt: now,
        lastOpenedAt: now,
      },
    };

    // Create ProfilesState
    const profilesState: ProfilesState = {
      activeProfileId: migratedProfileId,
      profiles: {
        [migratedProfileId]: migratedProfile,
      },
    };

    // Persist ProfilesState
    const jsonValue = JSON.stringify(profilesState);
    await AsyncStorage.setItem(PROFILES_STORAGE_KEY, jsonValue);

    // Mark migration as complete
    await markMigrationComplete();

    console.log('Legacy state migration completed successfully');
    return profilesState;
  } catch (error) {
    console.error('Error during legacy state migration:', error);
    // Don't mark as complete on error - allow retry
    return null;
  }
}

/**
 * Marks migration as complete.
 */
async function markMigrationComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  } catch (error) {
    console.error('Error marking migration as complete:', error);
  }
}
