/**
 * KPI metric definitions for the "Your Projection" dashboard card.
 *
 * Each KpiDefinition has:
 * - id: stable identifier used for persistence
 * - label: short display label for the tile
 * - Icon: phosphor-react-native icon component
 * - compute: pure function that derives a formatted string from KpiData, or null if not applicable
 */

import React from 'react';
import {
  ArrowsLeftRight,
  CheckCircle,
  Coins,
  Drop,
  HandCoins,
  PiggyBank,
  Receipt,
  Target,
  TrendUp,
} from 'phosphor-react-native';
import { formatCurrencyCompact } from '../../ui/formatters';
import type { InterpretationResult } from '../../insights/interpretProjection';
import type { ProjectionSummary } from '../../engines/projectionEngine';

// ─── Types ───────────────────────────────────────────────────────────────────

export type KpiId =
  | 'end_net_worth'
  | 'fi_progress'
  | 'debt_free_age'
  | 'nw_at_retirement'
  | 'portfolio_runway'
  | 'asset_liab_crossover'
  | 'monthly_surplus'
  | 'liquid_coverage'
  | 'wealth_multiplier'
  | 'total_contributions'
  | 'annual_expenses';

/** All raw values available to KPI compute functions */
export interface KpiData {
  interpretation: InterpretationResult;
  projectionSummary: ProjectionSummary;
  /** Total assets minus total liabilities at projection start (today) */
  currentNetWorth: number;
  /** selectMonthlySurplus() — free cash after expenses, contributions, debt reduction */
  monthlySurplus: number;
  /** selectExpenses() — total active monthly expenses */
  monthlyExpenses: number;
  /** Sum of assets accessible today (immediate + locked assets already past unlock age) */
  liquidAssets: number;
  /** User's current age (projection start) */
  currentAge: number;
  /** Projection end age */
  endAge: number;
  /** User's target retirement age */
  retirementAge: number;
  /** Gap between accessible-savings depletion and next locked-asset unlock post-retirement */
  bridgeGap?: { fromAge: number; toAge: number; assetName: string };
}

export interface KpiDefinition {
  id: KpiId;
  label: string;
  /** Short description shown in the picker modal only */
  description: string;
  Icon: React.ComponentType<{ size?: number; color?: string; weight?: string }>;
  /** Returns a formatted value string, or null when the metric is not applicable */
  compute: (data: KpiData) => string | null;
}

// ─── Definitions ─────────────────────────────────────────────────────────────

export const ALL_KPI_DEFINITIONS: KpiDefinition[] = [
  {
    id: 'end_net_worth',
    label: 'End net worth',
    description: 'Total assets minus liabilities at the end of your projection',
    Icon: Coins,
    compute: (d) => formatCurrencyCompact(d.interpretation.endNetWorth),
  },
  {
    id: 'fi_progress',
    label: 'FI progress',
    description: 'How close your current net worth is to your FI number (expenses × 25)',
    Icon: Target,
    compute: (d) => `${Math.round(d.interpretation.fiProgress * 100)}%`,
  },
  {
    id: 'debt_free_age',
    label: 'Debt-free',
    description: 'The age at which all your liabilities are projected to reach zero',
    Icon: CheckCircle,
    compute: (d) => {
      const moment = d.interpretation.keyMoments.find(m => m.type === 'DEBT_FREE');
      return moment ? `Age ${Math.round(moment.age)}` : null;
    },
  },
  {
    id: 'nw_at_retirement',
    label: 'At retirement',
    description: 'Projected net worth at your target retirement age',
    Icon: PiggyBank,
    compute: (d) => formatCurrencyCompact(d.interpretation.netWorthAtRetirement),
  },
  {
    id: 'asset_liab_crossover',
    label: 'Breakeven age',
    description: 'The age when your total assets first exceed your total liabilities',
    Icon: ArrowsLeftRight,
    compute: (d) => {
      const moment = d.interpretation.keyMoments.find(
        m => m.type === 'ASSETS_EXCEED_LIABILITIES',
      );
      return moment ? `Age ${Math.round(moment.age)}` : null;
    },
  },
  {
    id: 'monthly_surplus',
    label: 'Monthly surplus',
    description: 'Free cash each month after expenses, contributions, and debt payments',
    Icon: HandCoins,
    compute: (d) => `${formatCurrencyCompact(d.monthlySurplus)}/mo`,
  },
  {
    id: 'liquid_coverage',
    label: 'Savings can last for',
    description: 'How long your accessible savings (cash, investments, unlocked pensions) can support current costs',
    Icon: Drop,
    compute: (d) => {
      if (d.monthlyExpenses <= 0 || d.liquidAssets <= 0) return null;
      const years = d.liquidAssets / (d.monthlyExpenses * 12);
      return `${years.toFixed(1)} yrs`;
    },
  },
  {
    id: 'wealth_multiplier',
    label: 'Wealth ×',
    description: 'How many times larger your net worth will be by the end of the projection',
    Icon: TrendUp,
    compute: (d) => {
      if (d.currentNetWorth <= 0) return null;
      const multiplier = d.interpretation.endNetWorth / d.currentNetWorth;
      return `×${multiplier.toFixed(1)}`;
    },
  },
  {
    id: 'total_contributions',
    label: 'You contribute',
    description: 'Total amount you actively put into assets over the full projection period',
    Icon: PiggyBank,
    compute: (d) => formatCurrencyCompact(d.projectionSummary.totalContributions),
  },
  {
    id: 'annual_expenses',
    label: 'Annual expenses',
    description: 'Your current total monthly expenses scaled to a yearly figure',
    Icon: Receipt,
    compute: (d) => `${formatCurrencyCompact(d.monthlyExpenses * 12)}/yr`,
  },
];

export const DEFAULT_KPI_IDS: KpiId[] = ['end_net_worth', 'fi_progress', 'debt_free_age'];
