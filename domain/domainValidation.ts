// Domain boundary validation helpers (no branded types, no throwing)
//
// Validation happens only at boundaries:
// - UI input -> domain state
// - persistence load -> domain state
//
// Inside the app (selectors/calculations/rendering), data is assumed valid.

import type { AssetItem, SnapshotState } from '../types';

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

// ---------- Money
// Accepts string or number input.
// Rejects: NaN, negatives, empty, non-numeric.
// Returns a non-negative number or null (no throwing).
export function parseMoney(input: string | number): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    if (input < 0) return null;
    return input;
  }

  const s = input.trim();
  if (s.length === 0) return null;

  // Minimal pragmatic normalization: allow common currency/formatting.
  // Examples: "1234", "1,234.56", "£123.45"
  const normalized = s.replace(/[£$€,\s]/g, '');
  if (normalized.length === 0) return null;

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

// ---------- Item name
// Trims whitespace, rejects empty.
export function parseItemName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.trim();
  return name.length > 0 ? name : null;
}

// ---------- FlatItem constructor (generic)
// Useful for UI boundaries; does not throw.
export type FlatItem = {
  id: string;
  name: string;
  amount: number; // >= 0 at rest
};

export function makeFlatItem(raw: { id: unknown; name: unknown; amount: unknown }): FlatItem | null {
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (id.length === 0) return null;

  const name = parseItemName(raw.name);
  if (!name) return null;

  const amount =
    typeof raw.amount === 'number' || typeof raw.amount === 'string' ? parseMoney(raw.amount) : null;
  if (amount === null) return null;

  return { id, name, amount };
}

// ---------- SnapshotState loader (unknown persisted JSON -> domain state)
// Validates shape + values. Falls back safely to empty defaults.
export function emptySnapshotState(): SnapshotState {
  return {
    grossIncomeItems: [],
    pensionItems: [],
    netIncomeItems: [],
    expenseGroups: [],
    expenses: [],
    assetGroups: [
      { id: 'assets-cash', name: 'Cash' },
      { id: 'assets-savings', name: 'Savings' },
      { id: 'assets-investments', name: 'Investments' },
      { id: 'assets-other', name: 'Other' },
    ],
    assets: [],
    liabilityGroups: [
      { id: 'liab-credit', name: 'Credit' },
      { id: 'liab-other', name: 'Other' },
    ],
    liabilities: [],
    assetContributions: [],
    liabilityReductions: [],
    projection: {
      currentAge: 30,
      endAge: 90,
      retirementAge: 67,
      inflationPct: 0.0,
      monthlyDebtReduction: 0,
    },
  };
}

export function coerceSnapshotState(input: unknown): SnapshotState {
  const base = emptySnapshotState();
  if (!isRecord(input)) return base;

  const liabilityGroupsRaw = parseGroupArray(input.liabilityGroups);
  const liabilityGroups = normalizeLiabilityGroups(liabilityGroupsRaw);

  return {
    grossIncomeItems: parseNamedMoneyArray(input.grossIncomeItems, 'monthlyAmount'),
    pensionItems: parseNamedMoneyArray(input.pensionItems, 'monthlyAmount'),
    netIncomeItems: parseNamedMoneyArray(input.netIncomeItems, 'monthlyAmount'),

    expenseGroups: parseGroupArray(input.expenseGroups),
    expenses: parseGroupedNamedMoneyArray(input.expenses, 'monthlyAmount'),

    assetGroups: parseGroupArray(input.assetGroups),
    assets: parseAssetArray(input.assets),

    liabilityGroups,
    liabilities: parseLiabilityArray(input.liabilities),

    assetContributions: parseAssetContributionArray(input.assetContributions),
    liabilityReductions: parseNamedMoneyArray(input.liabilityReductions, 'monthlyAmount'),
    projection: parseProjectionInputs(input.projection, base.projection),
  };
}

// ---------- internal helpers
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseProjectionInputs(v: unknown, fallback: SnapshotState['projection']): SnapshotState['projection'] {
  if (!isRecord(v)) return fallback;

  const currentAge = typeof v.currentAge === 'number' || typeof v.currentAge === 'string' ? parseMoney(v.currentAge) : null;
  const endAge = typeof v.endAge === 'number' || typeof v.endAge === 'string' ? parseMoney(v.endAge) : null;

  const rawRetirementAge = typeof v.retirementAge === 'number' || typeof v.retirementAge === 'string' ? parseMoney(v.retirementAge) : null;
  // Validate: must be integer and > currentAge; fall back to 67 (UK state pension age)
  const resolvedCurrentAge = currentAge ?? fallback.currentAge;
  const retirementAge =
    rawRetirementAge != null && Number.isInteger(rawRetirementAge) && rawRetirementAge > resolvedCurrentAge
      ? rawRetirementAge
      : (fallback.retirementAge ?? 67);

  const inflationPct =
    typeof v.inflationPct === 'number' || typeof v.inflationPct === 'string' ? parseMoney(v.inflationPct) : null;

  const monthlyDebtReduction =
    typeof v.monthlyDebtReduction === 'number' || typeof v.monthlyDebtReduction === 'string'
      ? parseMoney(v.monthlyDebtReduction)
      : null;

  return {
    currentAge: currentAge ?? fallback.currentAge,
    endAge: endAge ?? fallback.endAge,
    retirementAge,
    inflationPct: inflationPct ?? fallback.inflationPct,
    monthlyDebtReduction: monthlyDebtReduction ?? fallback.monthlyDebtReduction,
  };
}

function parseGroupArray(v: unknown): SnapshotState['expenseGroups'] {
  if (!Array.isArray(v)) return [];
  const out: SnapshotState['expenseGroups'] = [];
  for (const x of v) {
    if (!isRecord(x)) continue;
    const id = typeof x.id === 'string' ? x.id.trim() : '';
    const name = parseItemName(x.name);
    if (!id || !name) continue;
    out.push({ id, name });
  }
  return out;
}

function parseNamedMoneyArray<TKey extends string>(
  v: unknown,
  amountKey: TKey,
): Array<{ id: string; name: string } & Record<TKey, number>> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ id: string; name: string } & Record<TKey, number>> = [];
  for (const x of v) {
    if (!isRecord(x)) continue;
    const id = typeof x.id === 'string' ? x.id.trim() : '';
    const name = parseItemName(x.name);
    const rawAmount = x[amountKey];
    const amount =
      typeof rawAmount === 'number' || typeof rawAmount === 'string' ? parseMoney(rawAmount) : null;
    if (!id || !name || amount === null) continue;
    out.push({ id, name, [amountKey]: amount } as { id: string; name: string } & Record<TKey, number>);
  }
  return out;
}

function parseAssetContributionArray(v: unknown): SnapshotState['assetContributions'] {
  // Phase 2 migration rule: legacy name-based contributions are dropped (cleared),
  // and only the new { id, assetId, amountMonthly } shape is kept.
  if (!Array.isArray(v)) return [];
  const out: SnapshotState['assetContributions'] = [];

  for (const x of v) {
    if (!isRecord(x)) continue;
    const rawId = typeof x.id === 'string' ? x.id.trim() : '';
    const id = rawId.length > 0 ? rawId : createId('asset-contrib');
    const assetId = typeof (x as any).assetId === 'string' ? (x as any).assetId.trim() : '';
    const rawAmount = (x as any).amountMonthly;
    const amountMonthly = typeof rawAmount === 'number' || typeof rawAmount === 'string' ? parseMoney(rawAmount) : null;
    if (!assetId || amountMonthly === null) continue;
    
    // Parse contributionType if present (optional field)
    const rawContributionType = (x as any).contributionType;
    const contributionType = rawContributionType === 'preTax' || rawContributionType === 'postTax' ? rawContributionType : undefined;
    
    out.push({ id, assetId, amountMonthly, contributionType });
  }

  return out;
}

function parseGroupedNamedMoneyArray<TAmountKey extends string>(
  v: unknown,
  amountKey: TAmountKey,
): Array<{ id: string; name: string; groupId: string } & Record<TAmountKey, number>> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ id: string; name: string; groupId: string } & Record<TAmountKey, number>> = [];
  for (const x of v) {
    if (!isRecord(x)) continue;
    const id = typeof x.id === "string" ? x.id.trim() : "";
    const name = parseItemName(x.name);
    const groupId = typeof x.groupId === "string" ? x.groupId.trim() : "";
    const rawAmount = x[amountKey];
    const amount =
      typeof rawAmount === 'number' || typeof rawAmount === 'string' ? parseMoney(rawAmount) : null;
    if (!id || !name || !groupId || amount === null) continue;
    
    // Parse isActive (defaults to true if missing)
    const rawIsActive = (x as any).isActive;
    const isActive = typeof rawIsActive === 'boolean' ? rawIsActive : true;
    
    out.push(
      { id, name, groupId, [amountKey]: amount, isActive } as { id: string; name: string; groupId: string; isActive: boolean } & Record<
        TAmountKey,
        number
      >,
    );
  }
  return out;
}

function parseAssetAvailability(v: unknown): AssetItem['availability'] {
  // Default: all existing assets are immediate (silent migration)
  if (!isRecord(v)) return { type: 'immediate' };

  const rawType = v.type;
  const type = rawType === 'immediate' || rawType === 'locked' || rawType === 'illiquid' ? rawType : 'immediate';

  // If not locked, return simple immediate/illiquid (no age/date)
  if (type !== 'locked') {
    return { type };
  }

  // For locked assets, parse unlockAge and availableFromDate
  const rawUnlockAge = v.unlockAge;
  const unlockAge =
    typeof rawUnlockAge === 'number' || typeof rawUnlockAge === 'string' ? parseMoney(rawUnlockAge) : null;

  const rawAvailableFromDate = v.availableFromDate;
  const availableFromDate =
    typeof rawAvailableFromDate === 'string' && rawAvailableFromDate.trim().length > 0
      ? rawAvailableFromDate.trim()
      : undefined;

  // If locked but no valid unlockAge, fall back to immediate
  if (unlockAge === null) {
    return { type: 'immediate' };
  }

  return {
    type: 'locked',
    unlockAge,
    availableFromDate,
  };
}

function parseAssetArray(v: unknown): SnapshotState['assets'] {
  if (!Array.isArray(v)) return [];
  const out: SnapshotState['assets'] = [];
  let placeholderCounter = 0;

  for (const x of v) {
    if (!isRecord(x)) continue;
    const rawId = typeof x.id === 'string' ? x.id.trim() : '';
    const id = rawId.length > 0 ? rawId : createId('asset');

    const parsedName = parseItemName(x.name);
    const name = parsedName ? parsedName : `Asset ${++placeholderCounter}`;

    const rawGroupId = typeof x.groupId === 'string' ? x.groupId.trim() : '';
    const groupId = rawGroupId.length > 0 ? rawGroupId : 'assets-other';
    const rawBalance = x.balance;
    const balance = typeof rawBalance === 'number' || typeof rawBalance === 'string' ? parseMoney(rawBalance) : null;
    if (balance === null) continue;

    const rawGrowth = (x as any).annualGrowthRatePct;
    const annualGrowthRatePct =
      typeof rawGrowth === 'number' || typeof rawGrowth === 'string' ? parseMoney(rawGrowth) : null;

    const rawAvailability = (x as any).availability;
    const availability = parseAssetAvailability(rawAvailability);

    // Parse isActive (defaults to true if missing)
    const rawIsActive = (x as any).isActive;
    const isActive = typeof rawIsActive === 'boolean' ? rawIsActive : true;

    out.push({
      id,
      name,
      groupId,
      balance,
      annualGrowthRatePct: annualGrowthRatePct ?? undefined,
      // Always include availability (even if default) to ensure it persists
      availability: availability ?? { type: 'immediate' },
      isActive,
    });
  }

  return out;
}

function parseLiabilityArray(v: unknown): SnapshotState['liabilities'] {
  if (!Array.isArray(v)) return [];
  const out: SnapshotState['liabilities'] = [];

  for (const x of v) {
    if (!isRecord(x)) continue;
    const id = typeof x.id === 'string' ? x.id.trim() : '';
    const name = parseItemName(x.name);
    const groupId = typeof x.groupId === 'string' ? x.groupId.trim() : '';
    const rawBalance = x.balance;
    const balance = typeof rawBalance === 'number' || typeof rawBalance === 'string' ? parseMoney(rawBalance) : null;
    if (!id || !name || !groupId || balance === null) continue;

    const rawAnnualRate = x.annualInterestRatePct;
    const annualInterestRatePct =
      typeof rawAnnualRate === 'number' || typeof rawAnnualRate === 'string' ? parseMoney(rawAnnualRate) : null;

    const rawKind = x.kind;
    const kind = rawKind === 'loan' || rawKind === 'standard' ? rawKind : undefined;

    const rawTemplate = x.loanTemplate;
    const loanTemplate = rawTemplate === 'mortgage' || rawTemplate === 'loan' ? rawTemplate : undefined;

    const rawTermYears = x.remainingTermYears;
    const parsedTermYears =
      typeof rawTermYears === 'number' || typeof rawTermYears === 'string' ? parseMoney(rawTermYears) : null;
    const remainingTermYears = parsedTermYears === null ? undefined : Math.max(0, Math.floor(parsedTermYears));

    // Only treat as a "loan" if required fields are present and valid enough to compute.
    const isValidLoan = kind === 'loan' && Boolean(loanTemplate) && typeof remainingTermYears === 'number' && remainingTermYears >= 1;

    // Parse isActive (defaults to true if missing)
    const rawIsActive = (x as any).isActive;
    const isActive = typeof rawIsActive === 'boolean' ? rawIsActive : true;

    out.push({
      id,
      name,
      groupId,
      balance,
      annualInterestRatePct: annualInterestRatePct ?? undefined,
      isActive,
      ...(isValidLoan
        ? {
            kind: 'loan' as const,
            loanTemplate,
            remainingTermYears,
          }
        : kind === 'standard'
          ? { kind: 'standard' as const }
          : {}),
    });
  }

  return out;
}

function normalizeLiabilityGroups(groups: SnapshotState['liabilityGroups']): SnapshotState['liabilityGroups'] {
  // Dev-only reset/migration friendliness:
  // - "Mortgage" -> "Mortgages"
  // - "Loan" -> "Loans"
  // Keep ids stable; only adjust display names.
  return groups.map(g => {
    const n = g.name.trim();
    const lower = n.toLowerCase();
    if (lower === 'mortgage') return { ...g, name: 'Mortgages' };
    if (lower === 'loan') return { ...g, name: 'Loans' };
    return g;
  });
}


