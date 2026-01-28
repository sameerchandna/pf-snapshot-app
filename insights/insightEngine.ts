/**
 * Phase 5.4 & 5.5: Key moment detection and insight generation
 * 
 * Shared insight engine for projection-based insights.
 * Used by EntryScreen (Phase 6.8) and ProjectionResultsScreen (Phase 5.5).
 * 
 * Insights are:
 * - Single-sentence
 * - Observational only
 * - Derived from key moments in projection data
 * - Read-only
 */

import { UI_TOLERANCE } from '../constants';

// Phase 5.4: Key moment detection types
export type KeyMomentId = 'LIABILITY_PAYOFF' | 'NET_WORTH_ZERO' | 'ASSETS_OVER_LIABILITIES';

export type KeyMoment = {
  id: KeyMomentId;
  seriesId: 'netWorth' | 'assets' | 'liabilities';
  age: number;
  value: number;
};

// Phase 5.4: Key moment detection function
// Pure function that detects key moments from baseline projection data
export function detectKeyMoments(
  baselineSeries: Array<{ age: number; assets: number; liabilities: number; netWorth: number }>,
  liquidAssetsSeries?: number[]
): KeyMoment[] {
  const moments: KeyMoment[] = [];

  // Guard against empty or insufficient data
  if (!baselineSeries || baselineSeries.length === 0) {
    return moments;
  }

  // LIABILITY_PAYOFF: First point where liabilities <= UI_TOLERANCE
  // If already <= tolerance at first point, mark at first point
  const liabilityPayoffPoint = baselineSeries.find(p => p.liabilities <= UI_TOLERANCE);
  if (liabilityPayoffPoint) {
    moments.push({
      id: 'LIABILITY_PAYOFF',
      seriesId: 'liabilities',
      age: liabilityPayoffPoint.age,
      value: liabilityPayoffPoint.liabilities,
    });
  }

  // NET_WORTH_ZERO: First crossing where netWorth goes from < 0 to >= 0
  // Use the first point where condition is met (no interpolation)
  if (baselineSeries.length > 1) {
    // Find the first point where netWorth >= 0, but only if we've seen a negative value before
    let hasSeenNegative = false;
    for (let i = 0; i < baselineSeries.length; i++) {
      const point = baselineSeries[i];
      if (point.netWorth < 0) {
        hasSeenNegative = true;
      } else if (hasSeenNegative && point.netWorth >= 0) {
        // First crossing from negative to non-negative
        moments.push({
          id: 'NET_WORTH_ZERO',
          seriesId: 'netWorth',
          age: point.age,
          value: point.netWorth,
        });
        break; // Only detect the first crossing
      }
    }
  }

  // ASSETS_OVER_LIABILITIES: First crossing where assets go from < liabilities to >= liabilities
  // Use liquid assets if provided, otherwise use total assets
  if (baselineSeries.length > 1) {
    const assetsData = liquidAssetsSeries && liquidAssetsSeries.length > 0
      ? baselineSeries.map((p, idx) => ({
          age: p.age,
          assets: idx < liquidAssetsSeries.length ? liquidAssetsSeries[idx] : 0,
          liabilities: p.liabilities,
        }))
      : baselineSeries.map(p => ({
          age: p.age,
          assets: p.assets,
          liabilities: p.liabilities,
        }));

    // Check if we start with assets < liabilities and cross to assets >= liabilities
    // Find the first point where assets >= liabilities, but only if we've seen assets < liabilities before
    let hasSeenBelow = false;
    for (let i = 0; i < assetsData.length; i++) {
      const point = assetsData[i];
      if (point.assets < point.liabilities) {
        hasSeenBelow = true;
      } else if (hasSeenBelow && point.assets >= point.liabilities) {
        // First crossing from below to above/equal
        moments.push({
          id: 'ASSETS_OVER_LIABILITIES',
          seriesId: 'assets',
          age: point.age,
          value: point.assets,
        });
        break; // Only detect the first crossing
      }
    }
  }

  return moments;
}

// Phase 5.5: Generate insight text from KeyMoment
export function generateInsightText(moment: KeyMoment): string {
  const age = Math.round(moment.age);
  switch (moment.id) {
    case 'LIABILITY_PAYOFF':
      return `Liabilities are fully repaid by age ${age}.`;
    case 'NET_WORTH_ZERO':
      return `Net worth becomes positive at age ${age}.`;
    case 'ASSETS_OVER_LIABILITIES':
      return `Assets exceed liabilities from age ${age} onward.`;
    default:
      return '';
  }
}
