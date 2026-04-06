// Test profile fixture — shared source of truth for testing and debugging.
//
// Sync protocol:
//   - Make changes in the app → describe to Claude → Claude updates this file
//   - Claude proposes changes → edits this file → tap "Load Test Profile" in Settings
//
// Profile: Age 43, retiring at 50. High earner, mortgage, ISA + pension.
// Mortgage P&I (~£2,154/mo) is auto-computed by the loan engine — not included in expenses.

import type { ProfilesState } from '../types';

const CREATED_AT = new Date('2026-04-01').getTime();

export const testProfile: ProfilesState = {
  activeProfileId: 'test-profile',
  profiles: {
    'test-profile': {
      snapshotState: {
        // --- Income ---
        grossIncomeItems: [
          { id: 'tp-gross-salary', name: 'Salary', monthlyAmount: 14000 },
        ],
        pensionItems: [],
        netIncomeItems: [
          { id: 'tp-net-salary', name: 'Salary', monthlyAmount: 8200 },
        ],

        // --- Expenses (non-mortgage living costs) ---
        expenseGroups: [
          { id: 'tp-grp-other', name: 'Other' },
        ],
        expenses: [
          { id: 'tp-exp-living', name: 'Living Expenses', monthlyAmount: 3000, groupId: 'tp-grp-other' },
        ],

        // --- Assets ---
        assetGroups: [
          { id: 'tp-grp-investments', name: 'Investments' },
          { id: 'tp-grp-pension', name: 'Pension' },
        ],
        assets: [
          {
            id: 'tp-asset-isa',
            name: 'Stocks ISA',
            balance: 185000,
            annualGrowthRatePct: 4,
            groupId: 'tp-grp-investments',
            availability: { type: 'immediate' },
          },
          {
            id: 'tp-asset-fund',
            name: 'Stocks Fund',
            balance: 30000,
            annualGrowthRatePct: 4,
            groupId: 'tp-grp-investments',
            availability: { type: 'immediate' },
          },
          {
            id: 'tp-asset-pension',
            name: 'Pension',
            balance: 450000,
            annualGrowthRatePct: 4,
            groupId: 'tp-grp-pension',
            availability: { type: 'locked', unlockAge: 57 },
          },
        ],

        // --- Liabilities ---
        liabilityGroups: [
          { id: 'tp-grp-mortgages', name: 'Mortgages' },
        ],
        liabilities: [
          {
            id: 'tp-liability-mortgage',
            name: 'Mortgage',
            balance: 536118,
            annualInterestRatePct: 2.79,
            groupId: 'tp-grp-mortgages',
            kind: 'loan',
            loanTemplate: 'mortgage',
            remainingTermYears: 31,
          },
        ],

        // --- Contributions & Reductions ---
        assetContributions: [
          {
            id: 'tp-contrib-isa',
            assetId: 'tp-asset-isa',
            amountMonthly: 1600,
            contributionType: 'postTax',
          },
        ],
        liabilityReductions: [],

        // --- Projection ---
        projection: {
          currentAge: 43,
          endAge: 85,
          retirementAge: 50,
          inflationPct: 0,
          monthlyDebtReduction: 0,
        },
      },

      scenarioState: {
        scenarios: [],
        activeScenarioId: undefined,
      },

      goalState: {
        goals: [],
      },

      meta: {
        name: 'Test Profile',
        createdAt: CREATED_AT,
        lastOpenedAt: CREATED_AT,
      },
    },
  },
};
