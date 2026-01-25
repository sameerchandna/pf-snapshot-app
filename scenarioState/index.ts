// Scenario state module (Phase 3)
//
// Re-exports for convenient importing.

export {
  loadScenarios,
  saveScenarios,
  loadActiveScenarioId,
  saveActiveScenarioId,
} from './scenarioPersistence';

export {
  getActiveScenario,
  getScenarios,
  saveScenario,
  deleteScenario,
  getActiveScenarioId,
  setActiveScenarioId,
  verifyBaselineInvariants,
  type SaveScenarioOptions,
  type DeleteScenarioOptions,
} from './scenarioStore';
