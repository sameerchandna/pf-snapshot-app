// Profile-aware scenario store
// Works with ProfilesState instead of direct AsyncStorage access

import type { ProfilesState, ProfileId } from '../types';
import type { Scenario, ScenarioId } from '../domain/scenario/types';
import { BASELINE_SCENARIO_ID, createBaselineScenario } from '../domain/scenario/types';

/**
 * Gets scenarios from active profile's scenarioState.
 */
export function getScenariosFromProfile(profilesState: ProfilesState): Scenario[] {
  const activeProfile = profilesState.profiles[profilesState.activeProfileId];
  if (!activeProfile) {
    return [createBaselineScenario()];
  }
  return activeProfile.scenarioState.scenarios;
}

/**
 * Gets active scenario ID from active profile's scenarioState.
 */
export function getActiveScenarioIdFromProfile(profilesState: ProfilesState): ScenarioId | undefined {
  const activeProfile = profilesState.profiles[profilesState.activeProfileId];
  if (!activeProfile) {
    return BASELINE_SCENARIO_ID;
  }
  return activeProfile.scenarioState.activeScenarioId ?? BASELINE_SCENARIO_ID;
}

/**
 * Updates scenarios in active profile's scenarioState.
 * Returns updated ProfilesState.
 */
export function updateScenariosInProfile(
  profilesState: ProfilesState,
  scenarios: Scenario[]
): ProfilesState {
  const activeProfileId = profilesState.activeProfileId;
  const activeProfile = profilesState.profiles[activeProfileId];
  if (!activeProfile) {
    return profilesState;
  }

  // Ensure baseline exists
  const hasBaseline = scenarios.some(s => s.id === BASELINE_SCENARIO_ID);
  const finalScenarios = hasBaseline ? scenarios : [createBaselineScenario(), ...scenarios];

  return {
    ...profilesState,
    profiles: {
      ...profilesState.profiles,
      [activeProfileId]: {
        ...activeProfile,
        scenarioState: {
          ...activeProfile.scenarioState,
          scenarios: finalScenarios,
        },
      },
    },
  };
}

/**
 * Updates active scenario ID in active profile's scenarioState.
 * Returns updated ProfilesState.
 */
export function updateActiveScenarioIdInProfile(
  profilesState: ProfilesState,
  activeScenarioId: ScenarioId | undefined
): ProfilesState {
  const activeProfileId = profilesState.activeProfileId;
  const activeProfile = profilesState.profiles[activeProfileId];
  if (!activeProfile) {
    return profilesState;
  }

  // Normalize: undefined and BASELINE_SCENARIO_ID both mean baseline
  const normalizedId = activeScenarioId === undefined || activeScenarioId === BASELINE_SCENARIO_ID
    ? BASELINE_SCENARIO_ID
    : activeScenarioId;

  return {
    ...profilesState,
    profiles: {
      ...profilesState.profiles,
      [activeProfileId]: {
        ...activeProfile,
        scenarioState: {
          ...activeProfile.scenarioState,
          activeScenarioId: normalizedId,
        },
      },
    },
  };
}
