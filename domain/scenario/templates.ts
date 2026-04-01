// Scenario templates (Phase 11 + 13.4)
//
// Human-readable question-based templates that map to underlying scenario kinds.
// Templates drive the What If picker UI and explorer screen defaults.

import type { ScenarioKind } from './types';

export type ScenarioTemplateId = string;

export type ScenarioCategory = 'assets' | 'liabilities' | 'events';

export interface SliderConfig {
  id: string;             // unique key within template (e.g. 'contribution', 'growthRate')
  label: string;          // section header text
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  format: 'currency_mo' | 'percent' | 'age'; // determines display formatting
  affordabilityClamped?: boolean; // true = clamp max to monthly surplus
}

export interface ScenarioTemplate {
  id: ScenarioTemplateId;
  question: string;       // "What if I invested more each month?"
  description: string;    // "See how extra monthly investing affects your net worth"
  scenarioKind: ScenarioKind | null; // null for placeholder templates
  icon: string;           // Phosphor icon name
  category: ScenarioCategory; // grouping for the What If picker
  targetSelector: 'asset' | 'loan' | null; // null for placeholder
  defaults: {
    amountMonthly: number; // generic initial slider value (may represent age, rate, or monthly amount)
    min: number;
    max: number;
    step: number;
  } | null; // null for placeholder templates
  /** Multi-slider templates define sliders here; single-slider templates use defaults */
  sliders?: SliderConfig[];
  enabled: boolean;       // false = "Coming soon" placeholder
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  // --- Assets ---
  {
    id: 'savings-what-if',
    question: 'What if I saved and grew more?',
    description: 'Adjust your monthly contributions and expected growth rate together',
    scenarioKind: 'SAVINGS_WHAT_IF',
    icon: 'TrendUp',
    category: 'assets',
    targetSelector: 'asset',
    defaults: null,
    sliders: [
      {
        id: 'contribution',
        label: 'Extra monthly contribution',
        defaultValue: 100,
        min: 0,
        max: 2000,
        step: 50,
        format: 'currency_mo',
        affordabilityClamped: true,
      },
      {
        id: 'growthRate',
        label: 'Annual growth rate',
        defaultValue: 8,
        min: 1,
        max: 15,
        step: 0.5,
        format: 'percent',
      },
    ],
    enabled: true,
  },
  // --- Liabilities ---
  {
    id: 'overpay-mortgage',
    question: 'What if I overpaid my mortgage?',
    description: 'See how extra debt payments affect your liabilities and net worth',
    scenarioKind: 'FLOW_TO_DEBT',
    icon: 'HouseSimple',
    category: 'liabilities',
    targetSelector: 'loan',
    defaults: {
      amountMonthly: 100,
      min: 50,
      max: 1000,
      step: 50,
    },
    enabled: true,
  },
  // --- Events ---
  {
    id: 'retire-at-age',
    question: 'What if I retired at a different age?',
    description: 'See how retiring earlier or later changes your long-term picture',
    scenarioKind: 'CHANGE_RETIREMENT_AGE',
    icon: 'Hourglass',
    category: 'events',
    targetSelector: null,
    defaults: {
      amountMonthly: 60,
      min: 40,
      max: 70,
      step: 1,
    },
    enabled: true,
  },
  {
    id: 'spend-less',
    question: 'What if I spent less each month?',
    description: 'See how reducing your expenses changes your financial outlook',
    scenarioKind: 'REDUCE_EXPENSES',
    icon: 'PiggyBank',
    category: 'events',
    targetSelector: null,
    defaults: {
      amountMonthly: 200,
      min: 50,
      max: 1000,
      step: 50,
    },
    enabled: true,
  },
  // --- Coming soon ---
  {
    id: 'go-part-time',
    question: 'What if I went part-time?',
    description: 'See how reduced income would affect your financial trajectory',
    scenarioKind: null,
    icon: 'Clock',
    category: 'events',
    targetSelector: null,
    defaults: null,
    enabled: false,
  },
  {
    id: 'have-a-baby',
    question: 'What if I had a baby?',
    description: 'See how parental leave and childcare costs change your picture',
    scenarioKind: null,
    icon: 'Baby',
    category: 'events',
    targetSelector: null,
    defaults: null,
    enabled: false,
  },
];

export function getTemplateById(id: ScenarioTemplateId): ScenarioTemplate | undefined {
  return SCENARIO_TEMPLATES.find(t => t.id === id);
}
