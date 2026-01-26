# Projection Refactor Audit: Zero Cashflow/Attribution/Scenarios

## Problem Summary

After the `runMonthlySimulation` refactor:
- ✅ Aggregate determinism passes (net worth, assets, liabilities correct)
- ✅ Charts render correctly
- ❌ Cashflow = 0
- ❌ A3 attribution = 0  
- ❌ Scenario deltas = 0

## Root Cause: Loan Totals Not Accumulating

### The Bug

**Location**: `projectionEngine.ts:249-304` (loan processing in `runMonthlySimulation`)

**Issue**: The loan processing loop accumulates `loanScheduledInterestThisMonth` and `loanScheduledPrincipalThisMonth` per loan, BUT these variables are **reset to 0 at the start of each month** (lines 261-262) and only updated **inside the loan loop** (lines 282-283).

**Critical Problem**: If there are **no loans** OR if **all loans are skipped** (balance <= 0), then:
- `loanScheduledInterestThisMonth` = 0
- `loanScheduledPrincipalThisMonth` = 0
- `loanOverpaymentThisMonth` = 0
- `scheduledMortgagePaymentThisMonth` = 0 (line 302)
- `totalScheduledMortgagePayment` += 0 (line 303)
- `totalMortgageOverpayments` += 0 (line 304)

**Result**: Totals remain 0 throughout the simulation.

### Why Aggregate Determinism Passes

Aggregate determinism only checks:
- `endAssets`
- `endLiabilities`  
- `endNetWorth`
- `totalContributions`

It does **NOT** check `totalScheduledMortgagePayment` or `totalMortgageOverpayments`. So if you have no loans, these being 0 is "correct" for determinism, but breaks downstream features that expect these values.

### Downstream Impact

1. **A3 Attribution** (`computeA3Attribution.ts:294-295`):
   - Reads `projectionSummary.totalScheduledMortgagePayment` → **0**
   - Reads `projectionSummary.totalMortgageOverpayments` → **0**
   - Result: `livingExpenses` = base expenses only (no mortgage payment)
   - Result: `debtRepayment` = 0 (no overpayments)

2. **Cashflow Display** (`ProjectionResultsScreen.tsx:2545-2548`):
   - Uses `baselineA3Attribution.cashflow.*` → **all 0** (because A3 attribution is 0)

3. **Scenarios** (`ProjectionResultsScreen.tsx:2674-2677`):
   - Uses `scenarioA3AttributionAbs.cashflow.*` → **all 0**
   - Scenario deltas = scenario - baseline = **0 - 0 = 0**

## Verification

**Check if loans exist in your snapshot:**
- If `state.liabilities.filter(l => l.kind === 'loan')` is empty → **This is the bug**
- If loans exist but all have `balance <= 0` → **This is the bug**

**Expected Behavior:**
- If loans exist with `balance > 0`, totals should accumulate
- If no loans exist, totals should be 0 (this is correct, but breaks UI expectations)

## Proposed Fix

### Option 1: Handle Zero-Loan Case in UI (Recommended)

**Files**: `computeA3Attribution.ts`, `ProjectionResultsScreen.tsx`

**Change**: Don't rely on `projectionSummary.totalScheduledMortgagePayment` when there are no loans. Instead, compute loan totals from snapshot loans directly (like `calculateBaselineLoanTotals` does for intermediate ages).

**Minimal Change**: In `computeA3Attribution.ts`, if `projectionSummary.totalScheduledMortgagePayment === 0`, check if loans exist. If loans exist, recompute using `pvLoanTotals()`.

### Option 2: Fix Accumulation Logic (If Loans Exist But Totals Are 0)

**File**: `projectionEngine.ts`

**Check**: Verify that `loanStates` array is populated correctly and loans are being processed.

**Potential Issue**: If `inputs.liabilitiesToday.filter(isLoanLike)` returns empty array, then `loanStates` is empty, and totals remain 0.

## Minimal Fix (Recommended)

**File**: `computeA3Attribution.ts`

**Location**: Lines 292-315 (loan totals section)

**Current Code:**
```typescript
const scheduledMortgagePayment = projectionSummary.totalScheduledMortgagePayment;
const mortgageOverpayments = projectionSummary.totalMortgageOverpayments;
```

**Proposed Fix:**
```typescript
// Use engine outputs if available, otherwise recompute from loans
let scheduledMortgagePayment = projectionSummary.totalScheduledMortgagePayment;
let mortgageOverpayments = projectionSummary.totalMortgageOverpayments;

// Fallback: If engine outputs are 0 but loans exist, recompute
if (scheduledMortgagePayment === 0 && mortgageOverpayments === 0 && loans.length > 0) {
  const loanTotals = pvLoanTotals(loans, horizonMonths, inflationPct);
  scheduledMortgagePayment = loanTotals.scheduledMortgagePayment;
  mortgageOverpayments = 0; // Overpayments come from projectionSummary only
}
```

**Rationale**: This preserves the engine as single source of truth when it works, but provides a fallback when engine outputs are unexpectedly 0.

## Summary

**Broken Output**: `projectionSummary.totalScheduledMortgagePayment` and `projectionSummary.totalMortgageOverpayments`

**Expected Population Site**: `runMonthlySimulation` loop (lines 303-304) accumulates these per month

**Current Behavior**: Totals remain 0 if no loans exist OR if loan processing is skipped

**Proposed Minimal Fix**: Add fallback in `computeA3Attribution` to recompute loan totals from snapshot when engine outputs are 0 but loans exist
