// Scenario templates (Phase 11)
//
// Human-readable question-based templates that map to underlying scenario kinds.
// Templates drive the What If picker UI and explorer screen defaults.

import type { ScenarioKind } from './types';

export type ScenarioTemplateId = string;

export interface ScenarioTemplate {
  id: ScenarioTemplateId;
  question: string;       // "What if I invested more each month?"
  description: string;    // "See how extra monthly investing affects your net worth"
  scenarioKind: ScenarioKind | null; // null for placeholder templates
  icon: string;           // Phosphor icon name
  targetSelector: 'asset' | 'loan' | null; // null for placeholder
  defaults: {
    amountMonthly: number;
    min: number;
    max: number;
    step: number;
  } | null; // null for placeholder templates
  enabled: boolean;       // false = "Coming soon" placeholder
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'invest-more',
    question: 'What if I invested more each month?',
    description: 'See how extra monthly investing changes your net worth over time',
    scenarioKind: 'FLOW_TO_ASSET',
    icon: 'TrendUp',
    targetSelector: 'asset',
    defaults: {
      amountMonthly: 100,
      min: 50,
      max: 2000,
      step: 50,
    },
    enabled: true,
  },
  {
    id: 'overpay-mortgage',
    question: 'What if I overpaid my mortgage?',
    description: 'See how extra debt payments affect your liabilities and net worth',
    scenarioKind: 'FLOW_TO_DEBT',
    icon: 'HouseSimple',
    targetSelector: 'loan',
    defaults: {
      amountMonthly: 100,
      min: 50,
      max: 1000,
      step: 50,
    },
    enabled: true,
  },
  {
    id: 'go-part-time',
    question: 'What if I went part-time?',
    description: 'See how reduced income would affect your financial trajectory',
    scenarioKind: null,
    icon: 'Clock',
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
    targetSelector: null,
    defaults: null,
    enabled: false,
  },
  {
    id: 'retire-early',
    question: 'What if I retired early?',
    description: 'See how retiring before state pension age affects your net worth',
    scenarioKind: null,
    icon: 'Umbrella',
    targetSelector: null,
    defaults: null,
    enabled: false,
  },
];

export function getTemplateById(id: ScenarioTemplateId): ScenarioTemplate | undefined {
  return SCENARIO_TEMPLATES.find(t => t.id === id);
}
