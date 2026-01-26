# Runtime Validation Results

**Date**: Validation screen created  
**Status**: Ready to run

---

## How to Run Validation

1. Navigate to **Settings → Refactor Validation** in the app
2. The validation runs automatically when the screen loads
3. Results are displayed on screen and logged to console

---

## Expected Results (Based on Code Review)

| Test | Expected Status | Notes |
|------|----------------|-------|
| **Aggregate Determinism** | ✅ **PASS** | `runMonthlySimulation` preserves exact logic |
| **Attribution Reconciliation** | ✅ **PASS** | Attribution unchanged, should reconcile within tolerance |
| **Asset Helper Sanity** | ✅ **PASS** | Logic verified, should pass all checks |
| **Liability Helper Sanity** | ✅ **PASS** | Logic verified, should pass all checks |

---

## Validation Details

### Step 1: Aggregate Projection Determinism

**Test**: `assertProjectionDeterminism(inputs, UI_TOLERANCE)`

**Expected**: Returns `true`

**What it checks**:
- Runs projection twice on deep-cloned inputs
- Compares `computeProjectionSummary()` outputs
- Compares `computeProjectionSeries()` outputs
- All values must match within `UI_TOLERANCE` (0.01 GBP)

**Code Review**: ✅ Logic preserved in `runMonthlySimulation`

---

### Step 2: Attribution Reconciliation

**Test**: `computeA3Attribution()` → `reconciliation.delta <= ATTRIBUTION_TOLERANCE`

**Expected**: Delta ≤ 1.0 GBP

**What it checks**:
- Attribution reconciles: `endingNetWorth = startingNetWorth + cashflow + assets + debt`
- Delta = LHS - RHS (should be near zero)

**Code Review**: ✅ Attribution logic unchanged

---

### Step 3: Single-Asset Helper Sanity

**Test**: `computeSingleAssetTimeSeries()` for one savings asset

**Expected**: All checks pass

**What it checks**:
- ✅ Balances never negative
- ✅ Cumulative contributions monotonically increase
- ✅ Growth reconciliation: `balance = starting + contributions + growth` (within tolerance)

**Code Review**: ✅ Logic verified in code

---

### Step 4: Single-Liability Helper Sanity

**Test**: `computeSingleLiabilityTimeSeries()` for one loan

**Expected**: All checks pass

**What it checks**:
- ✅ Balance monotonically decreases
- ✅ Interest stops after payoff
- ✅ Principal and interest monotonically increase
- ✅ Final balance reaches zero (or expected residual)

**Code Review**: ✅ Logic verified in code

---

## If Any Test Fails

The validation screen will display:
- Which test failed
- Specific cause (with values)
- Additional details (age, amounts, etc.)

Check the console logs for detailed error information.

---

## Next Steps

1. **Run the validation**: Navigate to Settings → Refactor Validation
2. **Review results**: Check screen and console output
3. **Report any failures**: If any test fails, the error details will be shown

---

## Code Review Summary

✅ **All logic preserved**: `runMonthlySimulation` extracts exact same logic  
✅ **No breaking changes**: Aggregate functions delegate correctly  
✅ **Helpers verified**: Single-item helpers use simulation correctly  
✅ **Determinism maintained**: Ordering and state handling unchanged

**Conclusion**: Code review indicates all tests should **PASS**. Runtime validation will confirm numerical identity.
