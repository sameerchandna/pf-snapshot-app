# Projection Refactor Validation Report

**Date**: Generated after refactor completion  
**Scope**: Validate numerical identity and safety of projection engine refactor

---

## Summary

| Test | Status | Notes |
|------|--------|-------|
| Aggregate Projection Determinism | ⚠️ **REQUIRES RUNTIME TEST** | Code review: Logic preserved |
| Attribution Reconciliation | ⚠️ **REQUIRES RUNTIME TEST** | Code review: No breaking changes |
| Asset Helper Sanity | ⚠️ **REQUIRES RUNTIME TEST** | Code review: Logic appears correct |
| Liability Helper Sanity | ⚠️ **REQUIRES RUNTIME TEST** | Code review: Logic appears correct |

---

## Step 1 — Aggregate Projection Determinism

### Code Review Findings

**✅ Logic Preservation**
- `runMonthlySimulation` extracts the exact same logic from `computeMonthlyProjection`
- Order of operations preserved:
  1. Asset contributions
  2. Asset growth
  3. Non-loan interest
  4. Loan amortization
  5. Debt reduction
  6. Contribution accumulation
- Deterministic ordering maintained (sorting by id for assets, loans, non-loans, contributions)
- State mutation remains within the loop (ephemeral state)

**✅ Backward Compatibility**
- `computeMonthlyProjection` now delegates to `runMonthlySimulation`
- Callback conversion preserves legacy interface
- Return values match exactly

**✅ Aggregate Functions**
- `computeProjectionSummary` uses `runMonthlySimulation` correctly
- `computeProjectionSeries` uses `computeMonthlyProjection` (which delegates to `runMonthlySimulation`)
- Both functions maintain same defensive copying and normalization

**⚠️ Potential Issues**
- None identified in code review
- **REQUIRES RUNTIME VALIDATION** using `assertProjectionDeterminism()`

### Validation Steps

1. Run `assertProjectionDeterminism(inputs, UI_TOLERANCE)` with real snapshot data
2. Compare `computeProjectionSeries()` outputs before/after refactor (if git history available)
3. Compare `computeProjectionSummary()` outputs before/after refactor

**Expected Result**: All values identical within `UI_TOLERANCE` (0.01 GBP)

---

## Step 2 — Attribution Reconciliation

### Code Review Findings

**✅ No Breaking Changes**
- Attribution computation (`computeA3Attribution`) unchanged
- Attribution reads from `projectionSeries` and `projectionSummary` (unchanged interfaces)
- No changes to attribution math or reconciliation logic

**✅ Input Compatibility**
- `computeA3Attribution` receives same inputs as before
- Projection outputs maintain same structure

**⚠️ Potential Issues**
- None identified in code review
- **REQUIRES RUNTIME VALIDATION** to confirm reconciliation within `ATTRIBUTION_TOLERANCE`

### Validation Steps

1. Run `computeA3Attribution()` with post-refactor projection outputs
2. Check `attribution.reconciliation.delta <= ATTRIBUTION_TOLERANCE` (1.0 GBP)

**Expected Result**: Delta within tolerance

---

## Step 3 — Single-Item Helper Sanity Checks

### Asset Helper (`computeSingleAssetTimeSeries`)

**✅ Code Review Findings**
- Uses `runMonthlySimulation` correctly
- Tracks contributions month-by-month (line 840: `cumulativeContributions += assetContributions`)
- Growth calculated as residual: `balance - startingBalance - cumulativeContributions`
- Yearly sampling (every 12 months)
- Deflation applied correctly

**⚠️ Potential Issue Identified**
- **Line 805-807**: `assetContributions` is calculated as sum of all monthly contributions for the asset
- **Line 840**: This sum is added every month
- **Analysis**: This is correct IF there's only one contribution entry per asset. If multiple entries exist, they should be summed (which the code does). However, the tracking happens OUTSIDE the simulation callback, which means it's tracking contributions independently of the simulation.

**✅ Logic Verification**
- Contributions are applied in simulation (line 222-232 in `runMonthlySimulation`)
- Tracking in helper matches this (adds same amount each month)
- Growth reconciliation should hold: `balance = starting + contributions + growth`

**⚠️ REQUIRES RUNTIME VALIDATION**:
- Verify balances are non-negative
- Verify contributions are monotonically increasing
- Verify growth reconciliation: `balance = starting + contributions + growth` (within tolerance)

### Liability Helper (`computeSingleLiabilityTimeSeries`)

**✅ Code Review Findings**
- Uses `runMonthlySimulation` correctly
- Tracks interest and principal separately for loans vs non-loans
- For loans: Uses `stepLoanMonth` to recalculate (matches simulation logic)
- For non-loans: Tracks interest accrual and debt reduction
- Yearly sampling (every 12 months)
- Deflation applied correctly

**⚠️ Potential Issue Identified**
- **Line 1010-1024**: For non-loans, the code tracks `trackedLoanBalance` (confusing name) and recalculates interest/principal
- **Analysis**: The logic appears correct but complex. It tracks balance separately and recalculates to match simulation state.

**✅ Logic Verification**
- Loan tracking uses same `stepLoanMonth` logic as simulation
- Non-loan tracking matches simulation order (interest first, then debt reduction)
- Balance should monotonically decrease (or stay zero after payoff)

**⚠️ REQUIRES RUNTIME VALIDATION**:
- Verify balance monotonically decreases
- Verify interest + principal sums correctly
- Verify interest stops after payoff
- Verify final balance reaches zero (or expected residual)

---

## Code Issues Found

### Issue 1: Variable Naming in Liability Helper
**Location**: `projectionEngine.ts:1010`  
**Issue**: Variable `trackedLoanBalance` is used for both loans and non-loans (confusing name)  
**Severity**: Low (cosmetic, logic is correct)  
**Recommendation**: Rename to `trackedLiabilityBalance` for clarity

### Issue 2: Contribution Tracking in Asset Helper
**Location**: `projectionEngine.ts:805-807, 840`  
**Issue**: Contributions are summed once and added monthly. This is correct but could be clearer.  
**Severity**: Low (logic is correct)  
**Recommendation**: Add comment explaining that `assetContributions` is the total monthly contribution amount

---

## Validation Script

A validation script has been created at `validation/projectionRefactorValidation.ts`.

**To run validation**:
1. Import and call `validateProjectionRefactor(state)` with a real `SnapshotState`
2. Check the returned `ValidationResult` for PASS/FAIL status
3. Review `errors` array for any failures

**Example**:
```typescript
import { validateProjectionRefactor } from './validation/projectionRefactorValidation';
import { useSnapshot } from './SnapshotContext';

const { state } = useSnapshot();
const result = validateProjectionRefactor(state);
console.log('Validation Result:', result);
```

---

## Recommendations

1. **IMMEDIATE**: Run runtime validation using `assertProjectionDeterminism()` and the validation script
2. **IMMEDIATE**: Test with real snapshot data (multiple assets, liabilities, loans)
3. **OPTIONAL**: Rename `trackedLoanBalance` to `trackedLiabilityBalance` for clarity
4. **OPTIONAL**: Add comments explaining contribution tracking logic in asset helper

---

## Conclusion

**Code Review Status**: ✅ **LOGIC PRESERVED**  
**Runtime Validation Status**: ⚠️ **PENDING**

The refactor appears to preserve all logic correctly. However, **runtime validation is required** to confirm numerical identity. The validation script and `assertProjectionDeterminism()` function are available for this purpose.

**Next Steps**:
1. Run `validateProjectionRefactor()` with real data
2. Check A3ValidationScreen for attribution reconciliation
3. Test single-item helpers with real assets/liabilities
