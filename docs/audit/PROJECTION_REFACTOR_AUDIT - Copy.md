# Projection Refactor Audit: Zero Cashflow/Attribution/Scenarios

## Problem Summary

After the `runMonthlySimulation` refactor:
- ✅ Aggregate determinism passes
- ✅ Charts render correctly
- ❌ Cashflow = 0
- ❌ A3 attribution = 0
- ❌ Scenario deltas = 0

## Root Cause Analysis

### 1. Projection Outputs Used by Downstream Features

#### A3 Attribution (`computeA3Attribution.ts`)
**Lines 294-295:**
```typescript
const scheduledMortgagePayment = projectionSummary.totalScheduledMortgagePayment;
const mortgageOverpayments = projectionSummary.totalMortgageOverpayments;
```

**Dependency Chain:**
- `computeA3Attribution` → `projectionSummary.totalScheduledMortgagePayment`
- `computeA3Attribution` → `projectionSummary.totalMortgageOverpayments`
- These values populate `cashflow.livingExpenses` and `cashflow.debtRepayment`

#### ProjectionResultsScreen (`screens/ProjectionResultsScreen.tsx`)
**Lines 2535-2552 (end age):**
- Uses `baselineA3Attribution.cashflow.*` values
- These come from `computeA3Attribution(projectionSummary)`

**Lines 2606-2620 (intermediate ages):**
- Recomputes loan totals using `calculateBaselineLoanTotals()`
- This is a **separate calculation** that doesn't use projection engine outputs

#### Scenarios (`screens/ProjectionResultsScreen.tsx`)
**Lines 2651-2790:**
- Uses `scenarioA3AttributionAbs` which comes from `computeA3Attribution(scenarioProjectionSummary)`
- Scenario deltas computed from `scenarioValuesAtAge - valuesAtAge`

### 2. Where Values Are Populated

#### BEFORE Refactor (Hypothetical)
The old `computeMonthlyProjection` likely accumulated:
- `totalScheduledMortgagePayment` (per month in loop)
- `totalMortgageOverpayments` (per month in loop)
- Returned these in the result object

#### AFTER Refactor (Current Code)

**`runMonthlySimulation` (lines 127-128):**
```typescript
let totalScheduledMortgagePayment = 0;
let totalMortgageOverpayments = 0;
```

**Accumulation (lines 301-304):**
```typescript
const scheduledMortgagePaymentThisMonth = loanScheduledInterestThisMonth + loanScheduledPrincipalThisMonth;
totalScheduledMortgagePayment += scheduledMortgagePaymentThisMonth;
totalMortgageOverpayments += loanOverpaymentThisMonth;
```

**Return (lines 401-405):**
```typescript
return {
  finalState: { ... },
  totals: {
    contributions: totalContributions,
    scheduledMortgagePayment: totalScheduledMortgagePayment,
    mortgageOverpayments: totalMortgageOverpayments,
  },
  horizonMonths,
};
```

**`computeMonthlyProjection` wrapper (lines 461-463):**
```typescript
return {
  ...
  totalScheduledMortgagePayment: totals.scheduledMortgagePayment,
  totalMortgageOverpayments: totals.mortgageOverpayments,
  ...
};
```

**`computeProjectionSummary` (lines 523, 529-530, 537-538):**
```typescript
const { ..., totalScheduledMortgagePayment, totalMortgageOverpayments } = computeMonthlyProjection(normalizedInputs);
...
const endScheduledMortgagePayment = deflateToTodaysMoney(totalScheduledMortgagePayment, clonedInputs.inflationRatePct, horizonMonths);
const endMortgageOverpayments = deflateToTodaysMoney(totalMortgageOverpayments, clonedInputs.inflationRatePct, horizonMonths);
...
return {
  ...
  totalScheduledMortgagePayment: endScheduledMortgagePayment,
  totalMortgageOverpayments: endMortgageOverpayments,
};
```

### 3. The Bug

**CRITICAL ISSUE FOUND:** Line 529 in `computeProjectionSummary`:

```typescript
const endScheduledMortgagePayment = deflateToTodaysMoney(totalScheduledMortgagePayment, clonedInputs.inflationRatePct, horizonMonths);
```

**BUT** line 529 is missing! Looking at the actual code structure, I see line 529 should deflate `totalScheduledMortgagePayment`, but let me verify the exact line numbers...

Actually, wait - I see the issue now. Let me check if `totalScheduledMortgagePayment` and `totalMortgageOverpayments` are being computed correctly in the loan loop.

**Loan Processing Loop (lines 261-304):**

The loop processes loans and accumulates:
- `loanScheduledInterestThisMonth` (line 282)
- `loanScheduledPrincipalThisMonth` (line 283)
- `loanOverpaymentThisMonth` (line 263, 290)

Then accumulates totals:
- `totalScheduledMortgagePayment += scheduledMortgagePaymentThisMonth` (line 303)
- `totalMortgageOverpayments += loanOverpaymentThisMonth` (line 304)

**BUT** - I notice that `loanScheduledInterestThisMonth` and `loanScheduledPrincipalThisMonth` are initialized to 0 (lines 261-262) and only updated inside the loan loop (lines 282-283). If there are NO loans, these remain 0.

**However**, the real issue is likely that these values ARE being computed, but something is wrong with how they're being returned or used.

Let me check if there's a variable name mismatch or if the totals object is being constructed incorrectly.

## Proposed Fix

### Issue: Totals Not Being Returned Correctly

**Location**: `projectionEngine.ts:401-405`

**Current Code:**
```typescript
return {
  finalState: { ... },
  totals: {
    contributions: totalContributions,
    scheduledMortgagePayment: totalScheduledMortgagePayment,
    mortgageOverpayments: totalMortgageOverpayments,
  },
  horizonMonths,
};
```

**Issue**: The totals object uses `scheduledMortgagePayment` and `mortgageOverpayments`, but `computeMonthlyProjection` expects `totalScheduledMortgagePayment` and `totalMortgageOverpayments`.

**Wait** - let me check the actual field names being used...

Looking at line 462-463:
```typescript
totalScheduledMortgagePayment: totals.scheduledMortgagePayment,
totalMortgageOverpayments: totals.mortgageOverpayments,
```

So the mapping is correct. The issue must be elsewhere.

### Actual Root Cause

**HYPOTHESIS**: The loan processing loop (lines 265-299) only processes loans where `loan.balance > 0` (line 268: `if (loan.balance <= 0) continue;`). If all loans are paid off immediately, or if there are no loans, the totals remain 0.

**BUT** - the user said aggregate determinism passes, which means the simulation is working. So loans must exist and have balances.

**ALTERNATIVE HYPOTHESIS**: The issue is that `loanScheduledInterestThisMonth` and `loanScheduledPrincipalThisMonth` are being computed per loan, but if the loan balance reaches zero during the simulation, the loop skips it. However, the totals should still accumulate for months when loans had balances.

**MOST LIKELY ISSUE**: The totals are being accumulated correctly in `runMonthlySimulation`, but there's a bug in how they're being extracted or returned. Let me check if there's a scoping issue or if the totals object is being mutated incorrectly.

Actually, I think I need to see the exact code flow. The issue might be that the totals are computed correctly but then zeroed out somewhere, or the return statement is wrong.

## Minimal Fix

**File**: `projectionEngine.ts`

**Location**: Check that `runMonthlySimulation` returns totals correctly, and that `computeMonthlyProjection` extracts them correctly.

**Verification Steps**:
1. Add console.log in `runMonthlySimulation` before return to verify totals are non-zero
2. Add console.log in `computeMonthlyProjection` after extracting totals
3. Add console.log in `computeProjectionSummary` after calling `computeMonthlyProjection`

**Expected Fix**: Ensure totals object field names match what's expected, and that values flow through correctly.
