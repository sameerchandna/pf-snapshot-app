// Data models for PASS 2

export interface IncomeItem {
  id: string;
  name: string;
  monthlyAmount: number;
}

export interface ExpenseItem {
  id: string;
  name: string;
  monthlyAmount: number;
  groupId: string;
  isActive?: boolean; // Defaults to true if missing
}

export interface AssetItem {
  id: string;
  name: string;
  balance: number;
  annualGrowthRatePct?: number;
  groupId: string;
  availability?: {
    type: 'immediate' | 'locked' | 'illiquid';
    unlockAge?: number;
    availableFromDate?: string; // ISO date string
  };
  isActive?: boolean; // Defaults to true if missing
}

export interface LiabilityItem {
  id: string;
  name: string;
  balance: number;
  annualInterestRatePct?: number;
  groupId: string;

  // A2: Smart loans (Mortgage / Loan templates)
  // Loans live ONLY in liabilities (never as expenses).
  kind?: 'standard' | 'loan';
  loanTemplate?: 'mortgage' | 'loan';
  remainingTermYears?: number; // integer years (required for kind='loan')
  isActive?: boolean; // Defaults to true if missing
}

export interface ContributionItem {
  id: string;
  assetId: string;
  amountMonthly: number;
  contributionType?: 'preTax' | 'postTax';
}

export interface LiabilityReductionItem {
  id: string;
  name: string;
  monthlyAmount: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
}

export interface ProjectionInputs {
  // Time horizon
  currentAge: number; // integer
  endAge: number; // integer

  // Assumptions (percent values: 2.0 = 2%)
  inflationPct: number;

  // Contributions (monthly)
  monthlyDebtReduction: number; // £, integer
}

export interface SnapshotState {
  // Income (flat item lists)
  grossIncomeItems: IncomeItem[];
  pensionItems: IncomeItem[];
  netIncomeItems: IncomeItem[];
  
  // Expenses (grouped items)
  expenseGroups: Group[];
  expenses: ExpenseItem[];
  
  // Assets (grouped items)
  assetGroups: Group[];
  assets: AssetItem[];
  
  // Liabilities (grouped items)
  liabilityGroups: Group[];
  liabilities: LiabilityItem[];
  
  // Contributions
  assetContributions: ContributionItem[];
  liabilityReductions: LiabilityReductionItem[];

  // Projection inputs (v1)
  projection: ProjectionInputs;
}

// Scenario state (Phase Two: ephemeral, in-memory only)
export type ScenarioState = {
  isActive: boolean;
  type: 'FLOW_INVESTING' | 'FLOW_DEBT_PAYDOWN';
  assetId: string | null;
  liabilityId?: string | null;
  monthlyAmount: number;
};

// Profile domain (V1)
export type ProfileId = string;

export interface ProfileMeta {
  name: string;
  createdAt: number; // timestamp
  lastOpenedAt: number; // timestamp
}

export interface ProfileState {
  snapshotState: SnapshotState;
  scenarioState: {
    scenarios: import('./domain/scenario/types').Scenario[];
    activeScenarioId?: import('./domain/scenario/types').ScenarioId;
  };
  meta: ProfileMeta;
}

export interface ProfilesState {
  activeProfileId: ProfileId;
  profiles: Record<ProfileId, ProfileState>;
}
