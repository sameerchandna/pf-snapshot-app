// Scenario templates (Phase 11 + 13.4)
//
// Human-readable question-based templates that map to underlying scenario kinds.
// Templates drive the What If picker UI and explorer screen defaults.

import type { ScenarioKind } from './types';

export type ScenarioTemplateId = string;

export type ScenarioCategory = 'assets' | 'liabilities' | 'events' | 'wonder';

export interface SliderConfig {
  id: string;             // unique key within template (e.g. 'contribution', 'growthRate')
  label: string;          // section header text
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  format: 'currency_mo' | 'percent' | 'age' | 'years'; // determines display formatting
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
    description: 'Put a bit more away each month and watch how it adds up over time.',
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
  {
    id: 'increase-income',
    question: 'What if I increased my income?',
    description: 'Pay rise or side income? See what more coming in really means.',
    scenarioKind: null,
    icon: 'ChartLineUp',
    category: 'assets',
    targetSelector: null,
    defaults: null,
    enabled: false,
  },
  // --- Liabilities ---
  {
    id: 'mortgage-what-if',
    question: 'What if I changed my mortgage terms?',
    description: 'Overpay a little or tweak your rate — see how soon you could be done.',
    scenarioKind: 'MORTGAGE_WHAT_IF',
    icon: 'HouseSimple',
    category: 'liabilities',
    targetSelector: 'loan',
    defaults: null,
    sliders: [
      {
        id: 'overpayment',
        label: 'Extra monthly overpayment',
        defaultValue: 0,
        min: 0,
        max: 1000,
        step: 50,
        format: 'currency_mo',
        affordabilityClamped: true,
      },
      {
        id: 'interestRate',
        label: 'Annual interest rate',
        defaultValue: 4.5, // static fallback; overridden dynamically from selected mortgage
        min: 0.5,
        max: 10,
        step: 0.25,
        format: 'percent',
      },
      {
        id: 'remainingTerm',
        label: 'Remaining term',
        defaultValue: 25, // static fallback; overridden dynamically from selected mortgage
        min: 5,
        max: 35,
        step: 1,
        format: 'years',
      },
    ],
    enabled: true,
  },
  // --- Events ---
  {
    id: 'retire-at-age',
    question: 'What if I retired at a different age?',
    description: 'Curious what stopping at 55 looks like vs 65? Slide it and see.',
    scenarioKind: 'CHANGE_RETIREMENT_AGE',
    icon: 'Hourglass',
    category: 'wonder',
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
    description: 'Spend a bit less each month — see the difference it makes.',
    scenarioKind: 'REDUCE_EXPENSES',
    icon: 'PiggyBank',
    category: 'assets',
    targetSelector: null,
    defaults: {
      amountMonthly: 200,
      min: 50,
      max: 1000,
      step: 50,
    },
    enabled: true,
  },
  {
    id: 'income-reduces',
    question: 'What if my income stopped or reduced?',
    description: 'Lost your job or went part-time? See how long you could keep things afloat.',
    scenarioKind: null,
    icon: 'ChartLineUp',
    category: 'events',
    targetSelector: null,
    defaults: null,
    enabled: false,
  },
  {
    id: 'markets-crash',
    question: 'What if markets crashed?',
    description: 'Markets tank 30%. How bad does it get, and how long to recover?',
    scenarioKind: null,
    icon: 'TrendUp',
    category: 'events',
    targetSelector: null,
    defaults: null,
    enabled: false,
  },
  {
    id: 'have-a-baby',
    question: 'What if I had a baby?',
    description: 'Parental leave, childcare, the lot — see what a baby really costs your finances.',
    scenarioKind: null,
    icon: 'Baby',
    category: 'wonder',
    targetSelector: null,
    defaults: null,
    enabled: false,
  },
];

export function getTemplateById(id: ScenarioTemplateId): ScenarioTemplate | undefined {
  return SCENARIO_TEMPLATES.find(t => t.id === id);
}
