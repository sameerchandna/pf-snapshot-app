// Phase 6.1: Static demo profiles for exploration mode
// Fully populated SnapshotState for each persona

import type { SnapshotState } from '../types';
import { SYSTEM_CASH_ID } from '../constants';

export type DemoProfileId = 'student' | 'young-professional' | 'couple-renting' | 'family-home';

export interface DemoProfile {
  id: DemoProfileId;
  name: string;
  icon: string; // Feather icon name
  snapshotState: SnapshotState;
}

export const DEFAULT_DEMO_PROFILE_ID: DemoProfileId = 'student';

// Helper to generate stable IDs (profile-scoped to ensure uniqueness)
function createId(profileId: string, prefix: string, index: number): string {
  return `${profileId}-${prefix}-${index}`;
}

// Student / Early Career
const studentProfile: DemoProfile = {
  id: 'student',
  name: 'Student / Early Career',
  icon: 'user',
  snapshotState: {
    grossIncomeItems: [
      { id: createId('student', 'gross-income', 1), name: 'Part-time job', monthlyAmount: 800 },
    ],
    pensionItems: [],
    netIncomeItems: [
      { id: createId('student', 'net-income', 1), name: 'Net income', monthlyAmount: 650 },
    ],
    expenseGroups: [
      { id: 'housing', name: 'Housing' },
      { id: 'subscriptions', name: 'Subscriptions' },
      { id: 'other', name: 'Other' },
    ],
    expenses: [
      { id: createId('student', 'expense', 1), name: 'Rent', monthlyAmount: 400, groupId: 'housing' },
      { id: createId('student', 'expense', 2), name: 'Food', monthlyAmount: 150, groupId: 'other' },
      { id: createId('student', 'expense', 3), name: 'Transport', monthlyAmount: 50, groupId: 'other' },
      { id: createId('student', 'expense', 4), name: 'Phone', monthlyAmount: 25, groupId: 'subscriptions' },
    ],
    assetGroups: [
      { id: 'assets-cash', name: 'Cash' },
      { id: 'assets-savings', name: 'Savings' },
      { id: 'assets-investments', name: 'Investments' },
      { id: 'assets-other', name: 'Other' },
    ],
    assets: [
      {
        id: SYSTEM_CASH_ID,
        name: 'Cash',
        balance: 500,
        annualGrowthRatePct: 0,
        groupId: 'assets-cash',
        availability: { type: 'immediate' },
        isActive: true,
      },
      {
        id: createId('student', 'asset', 1),
        name: 'Emergency fund',
        balance: 2000,
        annualGrowthRatePct: 2.5,
        groupId: 'assets-savings',
        availability: { type: 'immediate' },
        isActive: true,
      },
    ],
    liabilityGroups: [
      { id: 'liab-credit', name: 'Credit' },
      { id: 'liab-other', name: 'Other' },
    ],
    liabilities: [
      {
        id: createId('student', 'liability', 1),
        name: 'Student loan',
        balance: 15000,
        annualInterestRatePct: 4.5,
        groupId: 'liab-other',
        isActive: true,
      },
    ],
    assetContributions: [
      {
        id: createId('student', 'contribution', 1),
        assetId: createId('student', 'asset', 1),
        amountMonthly: 50,
        contributionType: 'postTax',
      },
    ],
    liabilityReductions: [],
    projection: {
      currentAge: 22,
      endAge: 60,
      inflationPct: 2.0,
      monthlyDebtReduction: 100,
    },
  },
};

// Young Professional
const youngProfessionalProfile: DemoProfile = {
  id: 'young-professional',
  name: 'Young Professional',
  icon: 'briefcase',
  snapshotState: {
    grossIncomeItems: [
      { id: createId('young-professional', 'gross-income', 1), name: 'Salary', monthlyAmount: 3500 },
    ],
    pensionItems: [],
    netIncomeItems: [
      { id: createId('young-professional', 'net-income', 1), name: 'Net income', monthlyAmount: 2800 },
    ],
    expenseGroups: [
      { id: 'housing', name: 'Housing' },
      { id: 'subscriptions', name: 'Subscriptions' },
      { id: 'other', name: 'Other' },
    ],
    expenses: [
      { id: createId('young-professional', 'expense', 1), name: 'Rent', monthlyAmount: 1200, groupId: 'housing' },
      { id: createId('young-professional', 'expense', 2), name: 'Food', monthlyAmount: 300, groupId: 'other' },
      { id: createId('young-professional', 'expense', 3), name: 'Transport', monthlyAmount: 150, groupId: 'other' },
      { id: createId('young-professional', 'expense', 4), name: 'Phone', monthlyAmount: 40, groupId: 'subscriptions' },
      { id: createId('young-professional', 'expense', 5), name: 'Streaming', monthlyAmount: 25, groupId: 'subscriptions' },
      { id: createId('young-professional', 'expense', 6), name: 'Gym', monthlyAmount: 50, groupId: 'other' },
    ],
    assetGroups: [
      { id: 'assets-cash', name: 'Cash' },
      { id: 'assets-savings', name: 'Savings' },
      { id: 'assets-investments', name: 'Investments' },
      { id: 'assets-other', name: 'Other' },
    ],
    assets: [
      {
        id: SYSTEM_CASH_ID,
        name: 'Cash',
        balance: 2000,
        annualGrowthRatePct: 0,
        groupId: 'assets-cash',
        availability: { type: 'immediate' },
        isActive: true,
      },
      {
        id: createId('young-professional', 'asset', 1),
        name: 'Savings account',
        balance: 8000,
        annualGrowthRatePct: 3.0,
        groupId: 'assets-savings',
        availability: { type: 'immediate' },
        isActive: true,
      },
      {
        id: createId('young-professional', 'asset', 2),
        name: 'ISA',
        balance: 5000,
        annualGrowthRatePct: 5.0,
        groupId: 'assets-investments',
        availability: { type: 'immediate' },
        isActive: true,
      },
    ],
    liabilityGroups: [
      { id: 'liab-credit', name: 'Credit' },
      { id: 'liab-other', name: 'Other' },
    ],
    liabilities: [
      {
        id: createId('young-professional', 'liability', 1),
        name: 'Credit card',
        balance: 2000,
        annualInterestRatePct: 18.0,
        groupId: 'liab-credit',
        isActive: true,
      },
    ],
    assetContributions: [
      {
        id: createId('young-professional', 'contribution', 1),
        assetId: createId('young-professional', 'asset', 1),
        amountMonthly: 200,
        contributionType: 'postTax',
      },
      {
        id: createId('young-professional', 'contribution', 2),
        assetId: createId('young-professional', 'asset', 2),
        amountMonthly: 300,
        contributionType: 'postTax',
      },
    ],
    liabilityReductions: [
      {
        id: createId('young-professional', 'reduction', 1),
        name: 'Credit card payment',
        monthlyAmount: 150,
      },
    ],
    projection: {
      currentAge: 28,
      endAge: 60,
      inflationPct: 2.0,
      monthlyDebtReduction: 0,
    },
  },
};

// Couple (Renting)
const coupleRentingProfile: DemoProfile = {
  id: 'couple-renting',
  name: 'Couple (Renting)',
  icon: 'users',
  snapshotState: {
    grossIncomeItems: [
      { id: createId('couple-renting', 'gross-income', 1), name: 'Salary (Partner 1)', monthlyAmount: 4000 },
      { id: createId('couple-renting', 'gross-income', 2), name: 'Salary (Partner 2)', monthlyAmount: 3500 },
    ],
    pensionItems: [],
    netIncomeItems: [
      { id: createId('couple-renting', 'net-income', 1), name: 'Net income (Partner 1)', monthlyAmount: 3200 },
      { id: createId('couple-renting', 'net-income', 2), name: 'Net income (Partner 2)', monthlyAmount: 2800 },
    ],
    expenseGroups: [
      { id: 'housing', name: 'Housing' },
      { id: 'subscriptions', name: 'Subscriptions' },
      { id: 'other', name: 'Other' },
    ],
    expenses: [
      { id: createId('couple-renting', 'expense', 1), name: 'Rent', monthlyAmount: 1800, groupId: 'housing' },
      { id: createId('couple-renting', 'expense', 2), name: 'Food', monthlyAmount: 500, groupId: 'other' },
      { id: createId('couple-renting', 'expense', 3), name: 'Transport', monthlyAmount: 300, groupId: 'other' },
      { id: createId('couple-renting', 'expense', 4), name: 'Utilities', monthlyAmount: 150, groupId: 'housing' },
      { id: createId('couple-renting', 'expense', 5), name: 'Streaming', monthlyAmount: 30, groupId: 'subscriptions' },
      { id: createId('couple-renting', 'expense', 6), name: 'Gym', monthlyAmount: 80, groupId: 'other' },
    ],
    assetGroups: [
      { id: 'assets-cash', name: 'Cash' },
      { id: 'assets-savings', name: 'Savings' },
      { id: 'assets-investments', name: 'Investments' },
      { id: 'assets-other', name: 'Other' },
    ],
    assets: [
      {
        id: SYSTEM_CASH_ID,
        name: 'Cash',
        balance: 5000,
        annualGrowthRatePct: 0,
        groupId: 'assets-cash',
        availability: { type: 'immediate' },
        isActive: true,
      },
      {
        id: createId('couple-renting', 'asset', 1),
        name: 'Joint savings',
        balance: 20000,
        annualGrowthRatePct: 3.5,
        groupId: 'assets-savings',
        availability: { type: 'immediate' },
        isActive: true,
      },
      {
        id: createId('couple-renting', 'asset', 2),
        name: 'Pension (Partner 1)',
        balance: 15000,
        annualGrowthRatePct: 5.0,
        groupId: 'assets-investments',
        availability: { type: 'locked', unlockAge: 55 },
        isActive: true,
      },
      {
        id: createId('couple-renting', 'asset', 3),
        name: 'Pension (Partner 2)',
        balance: 12000,
        annualGrowthRatePct: 5.0,
        groupId: 'assets-investments',
        availability: { type: 'locked', unlockAge: 55 },
        isActive: true,
      },
    ],
    liabilityGroups: [
      { id: 'liab-credit', name: 'Credit' },
      { id: 'liab-other', name: 'Other' },
    ],
    liabilities: [],
    assetContributions: [
      {
        id: createId('couple-renting', 'contribution', 1),
        assetId: createId('couple-renting', 'asset', 1),
        amountMonthly: 800,
        contributionType: 'postTax',
      },
      {
        id: createId('couple-renting', 'contribution', 2),
        assetId: createId('couple-renting', 'asset', 2),
        amountMonthly: 400,
        contributionType: 'preTax',
      },
      {
        id: createId('couple-renting', 'contribution', 3),
        assetId: createId('couple-renting', 'asset', 3),
        amountMonthly: 350,
        contributionType: 'preTax',
      },
    ],
    liabilityReductions: [],
    projection: {
      currentAge: 32,
      endAge: 60,
      inflationPct: 2.0,
      monthlyDebtReduction: 0,
    },
  },
};

// Family + Home
const familyHomeProfile: DemoProfile = {
  id: 'family-home',
  name: 'Family + Home',
  icon: 'home',
  snapshotState: {
    grossIncomeItems: [
      { id: createId('family-home', 'gross-income', 1), name: 'Salary (Partner 1)', monthlyAmount: 5000 },
      { id: createId('family-home', 'gross-income', 2), name: 'Salary (Partner 2)', monthlyAmount: 3000 },
    ],
    pensionItems: [],
    netIncomeItems: [
      { id: createId('family-home', 'net-income', 1), name: 'Net income (Partner 1)', monthlyAmount: 4000 },
      { id: createId('family-home', 'net-income', 2), name: 'Net income (Partner 2)', monthlyAmount: 2400 },
    ],
    expenseGroups: [
      { id: 'housing', name: 'Housing' },
      { id: 'subscriptions', name: 'Subscriptions' },
      { id: 'other', name: 'Other' },
    ],
    expenses: [
      { id: createId('family-home', 'expense', 1), name: 'Mortgage', monthlyAmount: 1500, groupId: 'housing' },
      { id: createId('family-home', 'expense', 2), name: 'Council tax', monthlyAmount: 200, groupId: 'housing' },
      { id: createId('family-home', 'expense', 3), name: 'Utilities', monthlyAmount: 250, groupId: 'housing' },
      { id: createId('family-home', 'expense', 4), name: 'Food', monthlyAmount: 600, groupId: 'other' },
      { id: createId('family-home', 'expense', 5), name: 'Transport', monthlyAmount: 400, groupId: 'other' },
      { id: createId('family-home', 'expense', 6), name: 'Childcare', monthlyAmount: 800, groupId: 'other' },
      { id: createId('family-home', 'expense', 7), name: 'Streaming', monthlyAmount: 40, groupId: 'subscriptions' },
    ],
    assetGroups: [
      { id: 'assets-cash', name: 'Cash' },
      { id: 'assets-savings', name: 'Savings' },
      { id: 'assets-investments', name: 'Investments' },
      { id: 'assets-other', name: 'Other' },
    ],
    assets: [
      {
        id: SYSTEM_CASH_ID,
        name: 'Cash',
        balance: 8000,
        annualGrowthRatePct: 0,
        groupId: 'assets-cash',
        availability: { type: 'immediate' },
        isActive: true,
      },
      {
        id: createId('family-home', 'asset', 1),
        name: 'Home equity',
        balance: 150000,
        annualGrowthRatePct: 2.0,
        groupId: 'assets-other',
        availability: { type: 'illiquid' },
        isActive: true,
      },
      {
        id: createId('family-home', 'asset', 2),
        name: 'Savings',
        balance: 25000,
        annualGrowthRatePct: 3.5,
        groupId: 'assets-savings',
        availability: { type: 'immediate' },
        isActive: true,
      },
      {
        id: createId('family-home', 'asset', 3),
        name: 'Pension (Partner 1)',
        balance: 45000,
        annualGrowthRatePct: 5.0,
        groupId: 'assets-investments',
        availability: { type: 'locked', unlockAge: 55 },
        isActive: true,
      },
      {
        id: createId('family-home', 'asset', 4),
        name: 'Pension (Partner 2)',
        balance: 30000,
        annualGrowthRatePct: 5.0,
        groupId: 'assets-investments',
        availability: { type: 'locked', unlockAge: 55 },
        isActive: true,
      },
    ],
    liabilityGroups: [
      { id: 'liab-credit', name: 'Credit' },
      { id: 'liab-other', name: 'Other' },
    ],
    liabilities: [
      {
        id: createId('family-home', 'liability', 1),
        name: 'Mortgage',
        balance: 200000,
        annualInterestRatePct: 3.5,
        groupId: 'liab-other',
        kind: 'loan',
        loanTemplate: 'mortgage',
        remainingTermYears: 25,
        isActive: true,
      },
    ],
    assetContributions: [
      {
        id: createId('family-home', 'contribution', 1),
        assetId: createId('family-home', 'asset', 2),
        amountMonthly: 500,
        contributionType: 'postTax',
      },
      {
        id: createId('family-home', 'contribution', 2),
        assetId: createId('family-home', 'asset', 3),
        amountMonthly: 600,
        contributionType: 'preTax',
      },
      {
        id: createId('family-home', 'contribution', 3),
        assetId: createId('family-home', 'asset', 4),
        amountMonthly: 400,
        contributionType: 'preTax',
      },
    ],
    liabilityReductions: [],
    projection: {
      currentAge: 35,
      endAge: 60,
      inflationPct: 2.0,
      monthlyDebtReduction: 0,
    },
  },
};

export const DEMO_PROFILES: Record<DemoProfileId, DemoProfile> = {
  student: studentProfile,
  'young-professional': youngProfessionalProfile,
  'couple-renting': coupleRentingProfile,
  'family-home': familyHomeProfile,
};

export function getDemoProfile(id: DemoProfileId): DemoProfile {
  return DEMO_PROFILES[id];
}
