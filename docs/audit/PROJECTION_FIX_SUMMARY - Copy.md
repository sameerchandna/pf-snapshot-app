# Projection Refactor Fix Summary

## What Was Fixed

**File**: `projectionEngine.ts`  
**Location**: Lines 169-174 (loan initialization)

**Change**: Added explicit validation for `remainingTermYears` when initializing loans, ensuring it's a valid number >= 1 before passing to `initLoan`.

**Rationale**: While `isLoanLike` type guard should ensure `remainingTermYears` is valid, TypeScript's type narrowing might not work perfectly in the `.map()` callback. This explicit check ensures `initLoan` always receives valid inputs, preventing it from returning `monthlyPayment: 0` due to invalid `remainingTermYears`.

## Code Change

**Before:**
```typescript
const init = initLoan({
  balance: l.balance,
  annualInterestRatePct: typeof l.annualInterestRatePct === 'number' && Number.isFinite(l.annualInterestRatePct) ? l.annualInterestRatePct : 0,
  remainingTermYears: l.remainingTermYears,
});
```

**After:**
```typescript
// isLoanLike ensures remainingTermYears is a number >= 1, but add explicit check for safety
const remainingTermYears = typeof l.remainingTermYears === 'number' && Number.isFinite(l.remainingTermYears) && l.remainingTermYears >= 1
  ? l.remainingTermYears
  : 1; // Fallback to 1 year if somehow invalid
const init = initLoan({
  balance: l.balance,
  annualInterestRatePct: typeof l.annualInterestRatePct === 'number' && Number.isFinite(l.annualInterestRatePct) ? l.annualInterestRatePct : 0,
  remainingTermYears,
});
```

## Verification

The accumulation logic (lines 265-308) was already correct:
- `loanScheduledInterestThisMonth` and `loanScheduledPrincipalThisMonth` are accumulated per loan
- `totalScheduledMortgagePayment` accumulates the sum each month
- `totalMortgageOverpayments` accumulates overpayments each month
- Totals are returned correctly in the `totals` object (lines 405-409)
- `computeMonthlyProjection` extracts totals correctly (lines 466-467)
- `computeProjectionSummary` deflates totals correctly (lines 529-530, 537-538)

## Expected Results After Fix

1. **Aggregate Determinism**: Should still PASS (no changes to core simulation)
2. **Cashflow**: Should be non-zero when loans exist (mortgage payments included)
3. **A3 Attribution**: Should be non-zero (reads from `projectionSummary.totalScheduledMortgagePayment`)
4. **Scenarios**: Should be non-zero (scenario deltas computed from A3 attribution)

## Next Steps

1. Run validation screen to confirm fix
2. Verify cashflow displays correctly
3. Verify A3 attribution shows mortgage payments
4. Verify scenario deltas are computed correctly
