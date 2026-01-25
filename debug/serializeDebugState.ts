// Dev-only debug state serializer
// Exports lossless JSON representation of app state for debugging

import type { SnapshotState, ScenarioState } from '../types';
import type { ProjectionSummary, ProjectionSeriesPoint } from '../projectionEngine';
import type { A3Attribution } from '../computeA3Attribution';
import { selectSnapshotTotals, selectLoanDerivedRows } from '../selectors';

export interface DebugStatePayload {
  snapshot: {
    state: SnapshotState;
    computed: ReturnType<typeof selectSnapshotTotals>;
    loanDerived: ReturnType<typeof selectLoanDerivedRows>;
  };
  projection?: {
    settings: SnapshotState['projection'];
    selectedAge?: number;
    summary?: ProjectionSummary;
    series?: ProjectionSeriesPoint[];
  };
  scenario?: {
    state: ScenarioState;
    summary?: ProjectionSummary;
    series?: ProjectionSeriesPoint[];
  };
  attribution?: {
    baseline?: A3Attribution;
    scenario?: A3Attribution;
  };
  checks?: {
    reconciliation?: {
      netWorthReconciled?: boolean;
      assetsAligned?: boolean;
      liabilitiesAligned?: boolean;
    };
  };
  valuesAtSelectedAge?: {
    baseline: any; // Values at selected age (baseline)
    scenario: any | null; // Values at selected age (scenario, if active)
  };
  scenarioDeltas?: {
    netWorth: number;
    assets: number;
    liabilities: number;
    allocationDelta: number;
  } | null;
}

export function serializeDebugState(payload: DebugStatePayload): string {
  const obj: any = {
    meta: {
      timestampISO: new Date().toISOString(),
      currency: 'GBP',
    },
    snapshot: {
      inputs: {
        grossIncomeItems: payload.snapshot.state.grossIncomeItems,
        netIncomeItems: payload.snapshot.state.netIncomeItems,
        pensionItems: payload.snapshot.state.pensionItems,
        expenseGroups: payload.snapshot.state.expenseGroups,
        expenses: payload.snapshot.state.expenses,
        assetGroups: payload.snapshot.state.assetGroups,
        assets: payload.snapshot.state.assets,
        liabilityGroups: payload.snapshot.state.liabilityGroups,
        liabilities: payload.snapshot.state.liabilities,
        assetContributions: payload.snapshot.state.assetContributions,
        liabilityReductions: payload.snapshot.state.liabilityReductions,
      },
      computed: {
        totals: payload.snapshot.computed,
        loanDerived: payload.snapshot.loanDerived.map(row => ({
          liabilityId: row.liabilityId,
          name: row.name,
          monthlyInterest: row.monthlyInterest,
          monthlyPrincipal: row.monthlyPrincipal,
        })),
      },
    },
    projection: payload.projection
      ? {
          settings: payload.projection.settings,
          selectedAge: payload.projection.selectedAge ?? null,
          summary: payload.projection.summary
            ? {
                endAssets: payload.projection.summary.endAssets,
                endLiabilities: payload.projection.summary.endLiabilities,
                endNetWorth: payload.projection.summary.endNetWorth,
                totalContributions: payload.projection.summary.totalContributions,
                totalScheduledMortgagePayment: payload.projection.summary.totalScheduledMortgagePayment,
                totalMortgageOverpayments: payload.projection.summary.totalMortgageOverpayments,
              }
            : null,
          series: payload.projection.series ?? null,
        }
      : null,
    scenario: payload.scenario
      ? {
          state: payload.scenario.state,
          summary: payload.scenario.summary
            ? {
                endAssets: payload.scenario.summary.endAssets,
                endLiabilities: payload.scenario.summary.endLiabilities,
                endNetWorth: payload.scenario.summary.endNetWorth,
                totalContributions: payload.scenario.summary.totalContributions,
                totalScheduledMortgagePayment: payload.scenario.summary.totalScheduledMortgagePayment,
                totalMortgageOverpayments: payload.scenario.summary.totalMortgageOverpayments,
              }
            : null,
          series: payload.scenario.series ?? null,
        }
      : null,
    attribution: payload.attribution
      ? {
          baseline: payload.attribution.baseline ?? null,
          scenario: payload.attribution.scenario ?? null,
        }
      : null,
    checks: payload.checks ?? null,
    valuesAtSelectedAge: payload.valuesAtSelectedAge
      ? {
          baseline: payload.valuesAtSelectedAge.baseline,
          scenario: payload.valuesAtSelectedAge.scenario,
        }
      : null,
    scenarioDeltas: payload.scenarioDeltas ?? null,
  };

  // Sanity check: ensure output is valid JSON
  const jsonString = JSON.stringify(obj, null, 2);
  try {
    JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Serialization produced invalid JSON');
  }

  return jsonString;
}
