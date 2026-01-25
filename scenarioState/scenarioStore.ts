// Scenario store (Phase 3)
//
// Higher-level API for scenario persistence and state management.
// Wraps scenarioPersistence with app-level operations (upsert, delete).
// Includes pure helper for resolving active scenario.
//
// V1: Now works with ProfilesState when available, falls back to legacy AsyncStorage.

import type { Scenario, ScenarioId } from '../domain/scenario/types';
import { BASELINE_SCENARIO_ID, createBaselineScenario } from '../domain/scenario/types';
import {
  loadScenarios,
  saveScenarios,
  loadActiveScenarioId,
  saveActiveScenarioId,
} from './scenarioPersistence';
import type { ProfilesState } from '../types';
import {
  getScenariosFromProfile,
  getActiveScenarioIdFromProfile,
  updateScenariosInProfile,
  updateActiveScenarioIdInProfile,
} from './scenarioProfileStore';

// Profile-aware scenario store integration
// Set by SnapshotContext to enable profile-aware scenario operations
let profilesStateProvider: (() => ProfilesState | null) | null = null;
let profilesStateUpdater: ((updater: (prev: ProfilesState) => ProfilesState) => void) | null = null;

/**
 * Sets the ProfilesState provider and updater functions.
 * Called by SnapshotContext during initialization.
 */
export function setProfilesStateProvider(
  provider: () => ProfilesState | null,
  updater: (updater: (prev: ProfilesState) => ProfilesState) => void
): void {
  profilesStateProvider = provider;
  profilesStateUpdater = updater;
}

/**
 * Pure helper: resolves active scenario from scenarios array and active ID.
 *
 * Rules:
 * - If activeId is undefined → returns undefined (baseline)
 * - If activeId === BASELINE_SCENARIO_ID → returns undefined (baseline)
 * - If activeId does not exist in scenarios → returns undefined (baseline)
 * - Otherwise returns the matching scenario
 *
 * Note: Baseline scenario is never returned (always undefined) to maintain
 * backward compatibility with projection logic that treats undefined as baseline.
 *
 * @param scenarios - Array of all saved scenarios
 * @param activeId - Optional active scenario ID
 * @returns Active scenario or undefined (baseline)
 */
export function getActiveScenario(
  scenarios: Scenario[],
  activeId?: ScenarioId
): Scenario | undefined {
  // Sanity check: baseline resolution invariant
  // Both undefined and BASELINE_SCENARIO_ID must resolve to baseline (undefined)
  if (activeId === undefined || activeId === BASELINE_SCENARIO_ID) {
    return undefined;
  }

  const result = scenarios.find(s => s.id === activeId);
  
  // Sanity check: if result is baseline scenario, it should still return undefined
  // (baseline is never returned as a scenario object)
  if (result?.id === BASELINE_SCENARIO_ID) {
    console.error('Invariant violation: baseline scenario should not be returned by getActiveScenario');
    return undefined;
  }

  // Sanity check: result must be either undefined (baseline) or an existing scenario
  // If activeId exists but result is undefined, that's fine (scenario doesn't exist, falls back to baseline)
  // But we assert that if result exists, it matches the activeId
  if (result && result.id !== activeId) {
    console.error('Invariant violation: getActiveScenario returned scenario with mismatched ID');
    return undefined;
  }

  return result;
}

/**
 * Loads all scenarios from storage.
 * 
 * V1: Uses ProfilesState when available, falls back to legacy AsyncStorage.
 */
export async function getScenarios(): Promise<Scenario[]> {
  // Try ProfilesState first
  if (profilesStateProvider) {
    const profilesState = profilesStateProvider();
    if (profilesState) {
      return getScenariosFromProfile(profilesState);
    }
  }

  // Fallback to legacy AsyncStorage
  const scenarios = await loadScenarios();
  // Verify invariants after load (non-blocking, best-effort)
  verifyAfterOperation('load');
  return scenarios;
}

/**
 * Options for saveScenario operation.
 */
export interface SaveScenarioOptions {
  /**
   * If true, suppresses baseline mutation warnings (for verification/testing only).
   * Default: false (warnings enabled).
   */
  suppressBaselineWarning?: boolean;
}

/**
 * Upserts a scenario (insert or update by id).
 * Saves the updated scenarios array to storage.
 * 
 * Hard invariant: baseline scenario cannot be updated.
 * 
 * V1: Uses ProfilesState when available, falls back to legacy AsyncStorage.
 */
export async function saveScenario(
  scenario: Scenario,
  options?: SaveScenarioOptions
): Promise<void> {
  // Guard: baseline cannot be updated
  if (scenario.id === BASELINE_SCENARIO_ID) {
    // Suppress warning only if explicitly requested (for verification/testing)
    if (!options?.suppressBaselineWarning) {
      console.warn('Attempted to update baseline scenario - operation blocked');
    } else if (__DEV__) {
      console.debug('Baseline mutation attempt suppressed (verification mode)');
    }
    // Sanity check: assert baseline mutation is blocked
    console.assert(false, 'Baseline scenario mutation blocked - this should never happen');
    return;
  }

  // Try ProfilesState first
  if (profilesStateProvider && profilesStateUpdater) {
    const profilesState = profilesStateProvider();
    if (profilesState) {
      const scenarios = getScenariosFromProfile(profilesState);
      const existingIndex = scenarios.findIndex(s => s.id === scenario.id);
      
      const updatedScenarios = existingIndex >= 0
        ? scenarios.map((s, i) => i === existingIndex ? scenario : s)
        : [...scenarios, scenario];
      
      profilesStateUpdater(prev => updateScenariosInProfile(prev, updatedScenarios));
      verifyAfterOperation('save');
      return;
    }
  }

  // Fallback to legacy AsyncStorage
  const scenarios = await loadScenarios();

  // Find existing scenario by id
  const existingIndex = scenarios.findIndex(s => s.id === scenario.id);

  if (existingIndex >= 0) {
    // Update existing
    scenarios[existingIndex] = scenario;
  } else {
    // Append new
    scenarios.push(scenario);
  }

  await saveScenarios(scenarios);
  // Verify invariants after save (non-blocking, best-effort)
  verifyAfterOperation('save');
}

/**
 * Options for deleteScenario operation.
 */
export interface DeleteScenarioOptions {
  /**
   * If true, suppresses baseline deletion warnings (for verification/testing only).
   * Default: false (warnings enabled).
   */
  suppressBaselineWarning?: boolean;
}

/**
 * Deletes a scenario by id.
 * 
 * Hard invariant: baseline scenario cannot be deleted.
 * 
 * Active scenario fallback: If the deleted scenario is currently active,
 * automatically falls back to baseline (BASELINE_SCENARIO_ID) before deletion.
 * This ensures the app never enters an invalid state with a missing active scenario.
 * 
 * V1: Uses ProfilesState when available, falls back to legacy AsyncStorage.
 */
export async function deleteScenario(
  id: ScenarioId,
  options?: DeleteScenarioOptions
): Promise<void> {
  // Guard: baseline cannot be deleted
  if (id === BASELINE_SCENARIO_ID) {
    // Suppress warning only if explicitly requested (for verification/testing)
    if (!options?.suppressBaselineWarning) {
      console.warn('Attempted to delete baseline scenario - operation blocked');
    } else if (__DEV__) {
      console.debug('Baseline deletion attempt suppressed (verification mode)');
    }
    // Sanity check: assert baseline deletion is blocked
    console.assert(false, 'Baseline scenario deletion blocked - this should never happen');
    return;
  }

  // Try ProfilesState first
  if (profilesStateProvider && profilesStateUpdater) {
    const profilesState = profilesStateProvider();
    if (profilesState) {
      const scenarios = getScenariosFromProfile(profilesState);
      const currentActiveId = getActiveScenarioIdFromProfile(profilesState);

      // If deleting active scenario, fallback to baseline IMMEDIATELY (before deletion)
      if (currentActiveId === id) {
        profilesStateUpdater(prev => updateActiveScenarioIdInProfile(prev, BASELINE_SCENARIO_ID));
      }

      // NOW delete the scenario (after fallback is persisted)
      const filtered = scenarios.filter(s => s.id !== id);

      // Sanity check: ensure baseline still exists after deletion
      const baselineStillExists = filtered.some(s => s.id === BASELINE_SCENARIO_ID);
      if (!baselineStillExists) {
        console.error('Invariant violation: baseline scenario missing after deletion');
        // Restore baseline
        const baseline = createBaselineScenario();
        filtered.unshift(baseline);
      }

      // Only update if something changed
      if (filtered.length !== scenarios.length) {
        profilesStateUpdater(prev => updateScenariosInProfile(prev, filtered));
        verifyAfterOperation('delete');
      }
      return;
    }
  }

  // Fallback to legacy AsyncStorage
  // Load scenarios first (needed for validation)
  const scenarios = await loadScenarios();
  
  // Load current activeScenarioId BEFORE deletion (ordering guarantee)
  // Pass scenarios for validation
  const currentActiveId = await loadActiveScenarioId(scenarios);

  // If deleting active scenario, fallback to baseline IMMEDIATELY (before deletion)
  if (currentActiveId === id) {
    await saveActiveScenarioId(BASELINE_SCENARIO_ID);
    // Sanity check: assert fallback was persisted
    const verifyActiveId = await loadActiveScenarioId(scenarios);
    if (verifyActiveId !== BASELINE_SCENARIO_ID) {
      console.error('Invariant violation: active scenario fallback failed');
    }
  }

  // NOW delete the scenario (after fallback is persisted)
  const filtered = scenarios.filter(s => s.id !== id);

  // Sanity check: ensure baseline still exists after deletion
  const baselineStillExists = filtered.some(s => s.id === BASELINE_SCENARIO_ID);
  if (!baselineStillExists) {
    console.error('Invariant violation: baseline scenario missing after deletion');
    // Restore baseline
    const baseline = createBaselineScenario();
    filtered.unshift(baseline);
  }

  // Only save if something changed
  if (filtered.length !== scenarios.length) {
    await saveScenarios(filtered);
    // Verify invariants after delete (non-blocking, best-effort)
    verifyAfterOperation('delete');
  }
}

/**
 * Loads the active scenario ID from storage.
 * 
 * V1: Uses ProfilesState when available, falls back to legacy AsyncStorage.
 */
export async function getActiveScenarioId(): Promise<ScenarioId | undefined> {
  // Try ProfilesState first
  if (profilesStateProvider) {
    const profilesState = profilesStateProvider();
    if (profilesState) {
      return getActiveScenarioIdFromProfile(profilesState);
    }
  }

  // Fallback to legacy AsyncStorage
  return loadActiveScenarioId();
}

/**
 * Sets the active scenario ID.
 * Pass undefined to clear the active scenario (baseline).
 * 
 * Validates that the scenario exists before setting it as active.
 * If a non-baseline scenario ID is provided and doesn't exist, falls back to baseline.
 * 
 * V1: Uses ProfilesState when available, falls back to legacy AsyncStorage.
 */
export async function setActiveScenarioId(id?: ScenarioId): Promise<void> {
  // If setting a specific non-baseline ID, validate it exists
  if (id !== undefined && id !== BASELINE_SCENARIO_ID) {
    const scenarios = await getScenarios();
    const exists = scenarios.some(s => s.id === id);
    if (!exists) {
      console.warn(`Cannot set active scenario: scenario ${id} does not exist, falling back to baseline`);
      id = BASELINE_SCENARIO_ID;
    }
  }

  // Try ProfilesState first
  if (profilesStateProvider && profilesStateUpdater) {
    const profilesState = profilesStateProvider();
    if (profilesState) {
      profilesStateUpdater(prev => updateActiveScenarioIdInProfile(prev, id));
      return;
    }
  }

  // Fallback to legacy AsyncStorage
  await saveActiveScenarioId(id);
}

/**
 * Sanity check function to verify baseline invariants and active scenario validity.
 * Can be called during development/testing to ensure baseline protection is working.
 * 
 * DEV-only: This function is a no-op in production builds.
 */
export async function verifyBaselineInvariants(): Promise<{
  baselineExists: boolean;
  baselineCannotBeDeleted: boolean;
  baselineCannotBeUpdated: boolean;
  baselineResolutionWorks: boolean;
  activeScenarioIdAlwaysValid: boolean;
  scenarioListNonEmpty: boolean;
  baselineExistsExactlyOnce: boolean;
  activeScenarioIdAlwaysResolves: boolean;
}> {
  // DEV-only: verification is disabled in production
  if (!__DEV__) {
    return {
      baselineExists: true,
      baselineCannotBeDeleted: true,
      baselineCannotBeUpdated: true,
      baselineResolutionWorks: true,
      activeScenarioIdAlwaysValid: true,
      scenarioListNonEmpty: true,
      baselineExistsExactlyOnce: true,
      activeScenarioIdAlwaysResolves: true,
    };
  }

  const scenarios = await loadScenarios();
  const baseline = scenarios.find(s => s.id === BASELINE_SCENARIO_ID);

  // Check 1: Baseline exists
  const baselineExists = baseline !== undefined;

  // Check 2: Baseline cannot be deleted (attempt should be blocked)
  let baselineCannotBeDeleted = true;
  try {
    await deleteScenario(BASELINE_SCENARIO_ID, { suppressBaselineWarning: true });
    const scenariosAfterDelete = await loadScenarios();
    const baselineAfterDelete = scenariosAfterDelete.find(s => s.id === BASELINE_SCENARIO_ID);
    baselineCannotBeDeleted = baselineAfterDelete !== undefined;
  } catch (e) {
    // Expected: deletion should be blocked
  }

  // Check 3: Baseline cannot be updated (attempt should be blocked)
  let baselineCannotBeUpdated = true;
  if (baseline) {
    try {
      const modifiedBaseline = { ...baseline, name: 'Modified Baseline' };
      await saveScenario(modifiedBaseline, { suppressBaselineWarning: true });
      const scenariosAfterUpdate = await loadScenarios();
      const baselineAfterUpdate = scenariosAfterUpdate.find(s => s.id === BASELINE_SCENARIO_ID);
      baselineCannotBeUpdated = baselineAfterUpdate?.name === 'Baseline'; // Name should be unchanged
    } catch (e) {
      // Expected: update should be blocked
    }
  }

  // Check 4: Baseline resolution works (both undefined and BASELINE_SCENARIO_ID resolve to undefined)
  const resolvedUndefined = getActiveScenario(scenarios, undefined);
  const resolvedBaselineId = getActiveScenario(scenarios, BASELINE_SCENARIO_ID);
  const baselineResolutionWorks = resolvedUndefined === undefined && resolvedBaselineId === undefined;

  // Check 5: Active scenario ID always resolves to baseline or existing scenario
  const activeId = await loadActiveScenarioId(scenarios);
  let activeScenarioIdAlwaysValid = true;
  if (activeId !== undefined && activeId !== BASELINE_SCENARIO_ID) {
    const activeScenarioExists = scenarios.some(s => s.id === activeId);
    if (!activeScenarioExists) {
      activeScenarioIdAlwaysValid = false;
      console.error(`Invariant violation: activeScenarioId (${activeId}) does not resolve to existing scenario`);
    }
  }

  // Check 6: Scenario list is non-empty
  const scenarioListNonEmpty = scenarios.length > 0;

  // Check 7: Baseline exists exactly once
  const baselineCount = scenarios.filter(s => s.id === BASELINE_SCENARIO_ID).length;
  const baselineExistsExactlyOnce = baselineCount === 1;

  // Check 8: Active scenario ID always resolves (to baseline or existing scenario)
  const activeScenarioIdAlwaysResolves = 
    activeId === undefined || 
    activeId === BASELINE_SCENARIO_ID || 
    scenarios.some(s => s.id === activeId);

  return {
    baselineExists,
    baselineCannotBeDeleted,
    baselineCannotBeUpdated,
    baselineResolutionWorks,
    activeScenarioIdAlwaysValid,
    scenarioListNonEmpty,
    baselineExistsExactlyOnce,
    activeScenarioIdAlwaysResolves,
  };
}

/**
 * Non-blocking verification helper.
 * Calls verifyBaselineInvariants() and logs any failures (best-effort, fire-and-forget).
 * 
 * DEV-only: This function is a no-op in production builds.
 */
function verifyAfterOperation(operation: string): void {
  // DEV-only: verification is disabled in production
  if (!__DEV__) {
    return;
  }

  verifyBaselineInvariants().then(result => {
    const failures = Object.entries(result)
      .filter(([_, passed]) => !passed)
      .map(([check, _]) => check);
    if (failures.length > 0) {
      console.error(`Invariant verification failed after ${operation}:`, failures);
    }
  }).catch(err => {
    console.error(`Invariant verification error after ${operation}:`, err);
  });
}
