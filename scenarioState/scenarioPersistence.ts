// Scenario persistence layer (Phase 3)
//
// Low-level AsyncStorage operations for scenarios.
// Knows AsyncStorage, keys, JSON.
// Knows nothing about UX or business logic.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Scenario, ScenarioId } from '../domain/scenario/types';
import { BASELINE_SCENARIO_ID, createBaselineScenario } from '../domain/scenario/types';
import { isScenario } from '../domain/scenario/validation';

const SCENARIOS_KEY = '@pf.scenarios';
const ACTIVE_SCENARIO_ID_KEY = '@pf.activeScenarioId';

// Write queue to prevent parallel writes (simple promise chain)
let scenariosWriteQueue: Promise<void> = Promise.resolve();
let activeIdWriteQueue: Promise<void> = Promise.resolve();

/**
 * Loads all scenarios from storage.
 * 
 * Defensive loading with comprehensive error recovery:
 * - Filters out invalid scenarios (best-effort recovery)
 * - Deduplicates by ID (keeps first occurrence)
 * - Filters missing/invalid IDs
 * - Ensures baseline scenario always exists
 * - Guarantees non-empty list (returns [baseline] on any failure)
 */
export async function loadScenarios(): Promise<Scenario[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(SCENARIOS_KEY);
    let scenarios: Scenario[] = [];

    if (jsonValue != null) {
      try {
        const parsed: unknown = JSON.parse(jsonValue);
        if (!Array.isArray(parsed)) {
          console.error('Invalid scenarios format: expected array');
        } else {
          // Filter invalid scenarios, keep valid ones
          for (const item of parsed) {
            if (isScenario(item)) {
              scenarios.push(item);
            } else {
              console.error('Invalid scenario filtered out:', item);
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing scenarios:', parseError);
      }
    }

    // Deduplicate by ID (keep first occurrence)
    const seenIds = new Set<ScenarioId>();
    const deduplicated = scenarios.filter(s => {
      if (!s.id || typeof s.id !== 'string' || s.id.trim() === '') {
        console.warn('Scenario with missing/invalid ID filtered out');
        return false;
      }
      if (seenIds.has(s.id)) {
        console.warn(`Duplicate scenario ID detected: ${s.id}, keeping first occurrence`);
        return false;
      }
      seenIds.add(s.id);
      return true;
    });

    scenarios = deduplicated;

    // Ensure baseline exists (migration: inject if missing)
    const hasBaseline = scenarios.some(s => s.id === BASELINE_SCENARIO_ID);
    if (!hasBaseline) {
      console.warn('Baseline scenario missing, injecting');
      const baseline = createBaselineScenario();
      scenarios.unshift(baseline); // Add at beginning
      // Persist the updated list (one-time migration, best-effort)
      saveScenarios(scenarios).catch(err => {
        console.error('Error persisting baseline injection:', err);
      });
    }

    // Final guarantee: scenario list is never empty
    if (scenarios.length === 0) {
      console.error('Invariant violation: scenario list is empty after filtering');
      const baseline = createBaselineScenario();
      scenarios = [baseline];
    }

    // Sanity check: assert baseline always exists after load
    const baselineExists = scenarios.some(s => s.id === BASELINE_SCENARIO_ID);
    if (!baselineExists) {
      console.error('Invariant violation: baseline scenario missing after load - injecting');
      const baseline = createBaselineScenario();
      scenarios.unshift(baseline);
      saveScenarios(scenarios).catch(err => {
        console.error('Error persisting baseline injection:', err);
      });
    }

    return scenarios;
  } catch (e) {
    console.error('Error loading scenarios:', e);
    // Even on error, return baseline to ensure invariant
    const baseline = createBaselineScenario();
    // Sanity check: assert baseline is returned even on error
    console.assert(baseline.id === BASELINE_SCENARIO_ID, 'Baseline scenario must have correct ID');
    return [baseline];
  }
}

/**
 * Saves all scenarios to storage.
 * 
 * Defensive save with validation and write ordering:
 * - Validates scenario list is non-empty
 * - Ensures baseline exists (injects if missing)
 * - Uses write queue to prevent parallel writes
 * - Best-effort: does not throw on failure
 */
export async function saveScenarios(scenarios: Scenario[]): Promise<void> {
  // Queue writes to prevent parallel execution
  scenariosWriteQueue = scenariosWriteQueue.then(async () => {
    try {
      // Validate before save: scenario list must be non-empty
      if (!Array.isArray(scenarios) || scenarios.length === 0) {
        console.error('Cannot save empty or invalid scenario list');
        return;
      }

      // Ensure baseline exists (inject if missing)
      const hasBaseline = scenarios.some(s => s.id === BASELINE_SCENARIO_ID);
      if (!hasBaseline) {
        console.warn('Baseline missing in save, injecting');
        scenarios.unshift(createBaselineScenario());
      }

      const jsonValue = JSON.stringify(scenarios);
      await AsyncStorage.setItem(SCENARIOS_KEY, jsonValue);
    } catch (e) {
      console.error('Error saving scenarios:', e);
      // Do NOT throw - leave in last known good state
    }
  });

  return scenariosWriteQueue;
}

/**
 * Loads the active scenario ID from storage.
 * 
 * Defensive loading with validation:
 * - Defaults to BASELINE_SCENARIO_ID on read failure or malformed value
 * - Validates against scenarios list if provided (resets stale IDs)
 * - Persists cleanup once detected (best-effort, no loops)
 */
export async function loadActiveScenarioId(scenarios?: Scenario[]): Promise<ScenarioId | undefined> {
  try {
    const jsonValue = await AsyncStorage.getItem(ACTIVE_SCENARIO_ID_KEY);
    if (jsonValue == null) {
      // Missing key: default to baseline
      return BASELINE_SCENARIO_ID;
    }

    try {
      const parsed: unknown = JSON.parse(jsonValue);
      if (typeof parsed === 'string' && parsed.trim() !== '') {
        const id = parsed.trim();
        
        // If scenarios provided, validate ID exists
        if (scenarios) {
          const exists = scenarios.some(s => s.id === id);
          if (!exists && id !== BASELINE_SCENARIO_ID) {
            // Stale activeScenarioId - reset to baseline and persist cleanup
            console.warn(`Stale activeScenarioId detected: ${id}, resetting to baseline`);
            saveActiveScenarioId(BASELINE_SCENARIO_ID).catch(err => {
              console.error('Error persisting activeScenarioId cleanup:', err);
            });
            return BASELINE_SCENARIO_ID;
          }
        }
        
        return id;
      }
      // Invalid type: default to baseline
      return BASELINE_SCENARIO_ID;
    } catch (parseError) {
      console.error('Error parsing active scenario ID:', parseError);
      // Parse error: default to baseline
      return BASELINE_SCENARIO_ID;
    }
  } catch (e) {
    console.error('Error loading active scenario ID:', e);
    // Read error: default to baseline
    return BASELINE_SCENARIO_ID;
  }
}

/**
 * Saves the active scenario ID to storage.
 * 
 * Defensive save with write ordering:
 * - Pass undefined to clear the active scenario (removes key)
 * - Uses write queue to prevent parallel writes
 * - Best-effort: does not throw on failure
 */
export async function saveActiveScenarioId(id?: ScenarioId): Promise<void> {
  // Queue writes to prevent parallel execution
  activeIdWriteQueue = activeIdWriteQueue.then(async () => {
    try {
      if (id === undefined) {
        await AsyncStorage.removeItem(ACTIVE_SCENARIO_ID_KEY);
      } else {
        const jsonValue = JSON.stringify(id);
        await AsyncStorage.setItem(ACTIVE_SCENARIO_ID_KEY, jsonValue);
      }
    } catch (e) {
      console.error('Error saving active scenario ID:', e);
      // Do NOT throw - leave in last known good state
    }
  });

  return activeIdWriteQueue;
}
