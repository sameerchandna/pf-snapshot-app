# Plan: UK Pension Screen Enhancement

## Context

The current PensionDetailScreen only captures a single monthly contribution amount linked to a pension asset. It has no concept of employer contributions, contribution percentages, pensionable salary, or state pension. This is too simple for a UK pension reality where:
- Employee contributes a % of pensionable salary (pre-tax, reduces gross income)
- Employer pays a core % + matches up to a % — this goes directly into the pension pot without touching the employee's income
- State pension is a separate future income based on NI qualifying years

**User's scheme:** Pensionable salary £160k, employee 6%, employer core 6%, employer match up to 6% (fully matched). Total into pension pot: £2,400/month (£800 employee + £800 core + £800 match).

**UK pension background:**
- State Pension: £221.20/week full (2024/25 = ~£11,502/yr), 35 NI qualifying years needed (min 10), starts at age 66 (rising to 67 by 2028)
- Workplace DC: employee contribution is pre-tax (salary sacrifice), employer contributions are "free money" that do not reduce take-home
- Tax relief: higher rate taxpayers get 40%+ relief on employee contributions

---

## Three-Leg Workplace Pension Model

| Leg | Who pays | Effect on salary | Example (£160k pensionable) |
|-----|----------|------------------|-----------------------------|
| Employee contribution | Employee (6%) | Pre-tax deduction — reduces take-home | £800/month |
| Employer core | Employer (6%) | Free — doesn't touch salary | £800/month |
| Employer match | Employer (matches employee % up to cap) | Free — doesn't touch salary | £800/month |
| **Total into pot** | | | **£2,400/month** |

---

## What Changes

### 1. New Types — `types.ts`

Add two new interfaces (alongside existing ones, no breaking changes):

```typescript
export interface WorkplacePensionConfig {
  id: string;
  assetId: string;
  pensionableSalary: number;     // annual £, e.g. 160000
  employeePct: number;           // e.g. 6 (for 6%)
  employerCorePct: number;       // e.g. 6
  employerMatchCapPct: number;   // e.g. 6 (employer matches up to this %)
}

export interface StatePensionConfig {
  niQualifyingYears: number;     // current qualifying years, e.g. 15
  weeklyForecast: number;        // expected £/week at SPA
  statePensionAge: number;       // default 66
}
```

Extend `SnapshotState`:
```typescript
workplacePension?: WorkplacePensionConfig;
statePension?: StatePensionConfig;
```

### 2. Context Setters — `context/SnapshotContext.tsx`

Add two setters:
- `setWorkplacePension(config: WorkplacePensionConfig | undefined)`
- `setStatePension(config: StatePensionConfig | undefined)`

When `setWorkplacePension` is called, also automatically upsert the corresponding `ContributionItem` in `assetContributions` with `contributionType: 'preTax'` and `amountMonthly = pensionableSalary × employeePct / 100 / 12`. This keeps the existing deductions/projection pipeline working without changes.

### 3. Projection — `projection/buildProjectionInputs.ts`

After building `assetContributionsMonthly` from `state.assetContributions`, check if `state.workplacePension` exists. If so, compute:
```
employerMonthly = pensionableSalary × (employerCorePct + min(employerMatchCapPct, employeePct)) / 100 / 12
```
Add a synthetic contribution entry for the same `assetId` with `amountMonthly = employerMonthly`. This ensures employer contributions grow the pension pot in projections without appearing in income deductions.

### 4. Selector — `engines/selectors.ts`

No change needed. `selectPension()` already sums `assetContributions` with `preTax` type, which only includes the employee amount.

### 5. Screen — `screens/PensionDetailScreen.tsx`

Full rewrite of the screen into two sections:

**Section: Workplace Pension**
- Asset picker (existing behaviour)
- Pensionable salary (£/year input)
- Your contribution % → live-computed £/month shown inline
- Employer core % → live-computed £/month shown inline
- Employer match cap % → live-computed £/month shown inline
- Summary row: "Total into pension: £X,XXX/month" and "Employer bonus: £X,XXX/month"

**Section: State Pension**
- NI qualifying years (numeric input, 0–35)
- Expected weekly pension (£ input — from HMRC forecast letter or gov.uk checker)
- State pension age (numeric input, default 66)
- Computed display: "Projected annual: £X,XXX" (weeklyForecast × 52) and "Full pension requires: X more years"

All inputs follow existing sketch UI patterns (inline row editing). All styles via `theme.typography.*`, `theme.radius.*`, `spacing.*`.

---

## Files to Modify

| File | Change |
|------|--------|
| `types.ts` | Add `WorkplacePensionConfig`, `StatePensionConfig`, extend `SnapshotState` |
| `context/SnapshotContext.tsx` | Add setters, auto-sync ContributionItem on save |
| `projection/buildProjectionInputs.ts` | Inject employer contribution to pension asset |
| `screens/PensionDetailScreen.tsx` | Full screen rewrite with two sections |

No changes to: `engines/selectors.ts`, `engines/projectionEngine.ts`, `engines/computeA3Attribution.ts`, navigation.

---

## Verification

1. Enter pensionable salary £160k, employee 6%, employer core 6%, employer match cap 6%
2. Verify: employee contribution = £800/month appears in DeductionsDetailScreen as pre-tax deduction
3. Verify: projection shows pension asset balance growing by £2,400/month (£800 employee + £1,600 employer)
4. Enter state pension: 15 NI years, £180/week forecast, age 66 → shows "Projected annual: £9,360" and "Need 20 more years for full pension"
5. Check snapshot totals unchanged (no double-counting of employer contributions)
