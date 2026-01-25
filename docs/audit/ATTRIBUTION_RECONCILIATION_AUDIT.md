# Attribution Zero-Reconciliation Enforcement — Audit Report

**Phase:** 3.2 — Attribution zero-reconciliation enforcement  
**Date:** 2024  
**Status:** READ-ONLY audit (no code changes)

---

## 1. Attribution Computation Entry Points

### Primary Entry Point
- **Function:** `computeA3Attribution()` in `computeA3Attribution.ts` (line 199)
- **Signature:**
  ```typescript
  computeA3Attribution({
    snapshot: SnapshotState,
    projectionSeries: ProjectionSeriesPoint[],
    projectionSummary: ProjectionSummary,
    projectionInputs?: ProjectionEngineInputs
  }): A3Attribution
  ```

### Call Sites (3 locations)

1. **`ProjectionResultsScreen.tsx`** (3 calls):
   - **Baseline attribution** (line 1455): Computed from baseline projection series/summary
   - **Quick What-If attribution** (line 1656): Computed from scenario projection series/summary with `projectionInputs` parameter
   - **Persisted scenario attribution** (line 1672): Computed from persisted scenario projection series/summary with `projectionInputs` parameter

2. **`A3ValidationScreen.tsx`** (line 59):
   - Validation screen for baseline attribution only
   - Used for internal inspection and debugging

3. **`SnapshotDataSummaryScreen.tsx`** (line 198):
   - Debug export functionality
   - Computes baseline attribution for serialization

### Call Pattern
- All calls follow the same pattern: pass `snapshot`, `projectionSeries`, `projectionSummary`
- Scenario calls additionally pass `projectionInputs` to source contributions from scenario-modified inputs (not baseline snapshot)
- Attribution is **never scenario-aware** — it treats projection outputs as ground truth

---

## 2. Exact Inputs Attribution Consumes

### Required Inputs

1. **`snapshot: SnapshotState`**
   - **Purpose:** Source of truth for starting balances, income/expense items, and contribution metadata
   - **Used for:**
     - Starting asset/liability balances (filtered to active items only)
     - Gross income items (`snapshot.grossIncomeItems`)
     - Net income items (`snapshot.netIncomeItems`)
     - Base living expenses (`snapshot.expenses`, excluding loan-interest/loan-principal items)
     - Asset contribution metadata (`snapshot.assetContributions`) to classify preTax vs postTax
     - Projection settings (`snapshot.projection.currentAge`, `endAge`, `inflationPct`)
   - **Filtering:** Only active items are included (lines 211-213)

2. **`projectionSeries: ProjectionSeriesPoint[]`**
   - **Purpose:** Time series of projection outputs (currently unused in reconciliation, but available for future use)
   - **Note:** Series is passed but not directly used in reconciliation equation

3. **`projectionSummary: ProjectionSummary`**
   - **Purpose:** Canonical projection outputs (single source of truth)
   - **Fields consumed:**
     - `endAssets`: Ending asset balance (inflation-adjusted, today's money)
     - `endLiabilities`: Ending liability balance (inflation-adjusted, today's money)
     - `endNetWorth`: Ending net worth (inflation-adjusted, today's money)
     - `totalScheduledMortgagePayment`: Full scheduled mortgage payment (interest + scheduled principal) — treated as expense
     - `totalMortgageOverpayments`: Explicit overpayments only — treated as liability reduction

4. **`projectionInputs?: ProjectionEngineInputs`** (optional)
   - **Purpose:** When provided, used to source contributions from scenario-modified inputs instead of baseline snapshot
   - **Used for:** Computing `pensionContribMonthly` and `postTaxContribMonthly` from scenario inputs
   - **Classification:** Uses snapshot metadata (`contributionType === 'preTax'`) to classify contributions

---

## 3. Attribution Buckets and Formulas

### 3.1 Cashflow Bucket (`cashflow`)

**Purpose:** Explains cashflow contributions to net worth change

| Field | Formula | Notes |
|-------|---------|-------|
| `grossIncome` | `pvSumConstantMonthly(grossIncomeMonthly, horizonMonths, inflationPct)` | PV of monthly gross income |
| `pensionContributions` | `pvSumConstantMonthly(pensionContribMonthly, horizonMonths, inflationPct)` | PV of pre-tax pension contributions |
| `taxes` | `pvSumConstantMonthly(taxesMonthly, horizonMonths, inflationPct)` | PV of taxes (derived as residual: `gross - pension - net`) |
| `livingExpenses` | `baseLivingExpenses + scheduledMortgagePayment` | Base expenses + full scheduled mortgage payment (interest + principal) |
| `netSurplus` | **If cashflow modeled:** `grossIncome - pensionContributions - taxes - livingExpenses`<br>**If projection-only:** `postTaxContributions + principalRepaid` | Net cashflow after taxes and expenses |
| `postTaxContributions` | `pvSumConstantMonthly(postTaxContribMonthly, horizonMonths, inflationPct)` | PV of post-tax asset contributions |
| `debtRepayment` | `mortgageOverpayments` | Explicit loan overpayments only (scheduled principal is in expenses) |

**Key Logic:**
- `taxes` is derived as residual: `Math.max(0, gross - pension - net)` (line 65)
- `livingExpenses` includes full scheduled mortgage payment (interest + scheduled principal) as expense
- `netSurplus` logic depends on whether cashflow is modeled (lines 320-333)
- `monthlySurplus` is computed but NOT stored (display-only residual, line 340)

### 3.2 Debt Bucket (`debt`)

**Purpose:** Explains debt-related contributions to net worth change

| Field | Formula | Notes |
|-------|---------|-------|
| `interestPaid` | `pvLoanTotals(loans, horizonMonths, inflationPct).interestPaid` | PV of loan interest paid |
| `principalRepaid` | `pvLoanTotals(loans, horizonMonths, inflationPct).principalRepaid` | PV of total loan principal (scheduled + overpayments) |
| `remainingDebt` | `projectionSummary.endLiabilities` | Ending liability balance (from projection engine) |

**Key Logic:**
- Loan totals computed via `pvLoanTotals()` which simulates loan amortization month-by-month
- `principalRepaid` includes both scheduled principal and overpayments
- `remainingDebt` comes directly from projection engine (single source of truth)

### 3.3 Assets Bucket (`assets`)

**Purpose:** Explains asset growth contributions to net worth change

| Field | Formula | Notes |
|-------|---------|-------|
| `startingValue` | `sumBalances(activeAssets)` | Starting asset balance |
| `contributions` | `pensionContributions + postTaxContributions` | Total contributions (preTax + postTax) |
| `growth` | `endingValue - startingValue - contributions` | **Residual:** Returns/compounding only |
| `endingValue` | `projectionSummary.endAssets` | Ending asset balance (from projection engine) |

**Key Logic:**
- `growth` is computed as **residual** (line 352) — this ensures asset roll-forward reconciles exactly
- Contributions include both pension (preTax) and postTax contributions
- `monthlySurplus` is explicitly NOT included in asset contributions (line 349 comment)

### 3.4 Reconciliation Bucket (`reconciliation`)

**Purpose:** Validates that attribution reconciles to zero

| Field | Formula | Notes |
|-------|---------|-------|
| `lhs` | `endingNetWorth` | From projection summary |
| `rhs` | `endAssets - endLiabilities` | Canonical reconstruction |
| `delta` | `lhs - rhs` | Should be zero (within tolerance) |

**Key Logic:**
- **Primary reconciliation equation:** `endingNetWorth = endAssets - endLiabilities` (line 386-387)
- This is the **canonical** reconciliation — attribution must explain this difference

---

## 4. Target "Difference" Attribution Explains

### Primary Target
**Net Worth Change:** `endingNetWorth - startingNetWorth`

### Decomposition
Attribution explains net worth change through three buckets:

1. **Cashflow contributions:** Income, expenses, contributions, debt repayments
2. **Debt changes:** Interest paid, principal repaid, remaining debt
3. **Asset growth:** Starting assets, contributions, growth (returns/compounding)

### Reconciliation Equation (Derived)

The attribution must satisfy:

```
endingNetWorth = startingNetWorth + cashflow_contribution + debt_contribution + asset_contribution
```

However, the **actual reconciliation equation** enforced is simpler:

```
endingNetWorth = endAssets - endLiabilities
```

This is because:
- `endingNetWorth` comes from projection engine (line 229)
- `endAssets` and `endLiabilities` come from projection engine (lines 345, 369)
- Attribution **explains** how we got from `startingNetWorth` to `endingNetWorth`, but the reconciliation validates that `endingNetWorth` matches the canonical `endAssets - endLiabilities`

---

## 5. Reconciliation Equation and Residual Sources

### Primary Reconciliation Equation

```typescript
// Line 386-387
const rhs = projectionSummary.endAssets - projectionSummary.endLiabilities;
const delta = projectionSummary.endNetWorth - rhs;
```

**Expected:** `delta ≈ 0` (within `ATTRIBUTION_TOLERANCE = £1.00`)

### Where Residuals Can Arise

1. **Floating-point precision errors:**
   - Inflation discounting (`pvSumConstantMonthly`, `deflateToTodaysMoney`)
   - Loan amortization calculations (`pvLoanTotals`)
   - Asset growth compounding (`computeMonthlyProjection`)
   - Multiple rounding operations accumulate

2. **Inflation discounting mismatches:**
   - Attribution uses `pvSumConstantMonthly()` for cashflows (month-by-month discounting)
   - Projection engine uses `deflateToTodaysMoney()` at end (single deflation at horizon end)
   - **Potential source of residual:** Different discounting methods may produce slightly different results

3. **Loan calculation differences:**
   - Attribution recomputes loan amortization via `pvLoanTotals()` (lines 112-183)
   - Projection engine computes loans via `stepLoanMonth()` in `computeMonthlyProjection()`
   - **Potential source of residual:** Two independent loan calculations may diverge slightly due to:
     - Different inflation discounting approaches
     - Rounding differences in monthly calculations
     - Edge cases (paid-off loans, final month clamping)

4. **Asset growth calculation differences:**
   - Attribution computes `growth` as residual: `endingValue - startingValue - contributions`
   - Projection engine computes growth via monthly compounding in `computeMonthlyProjection()`
   - **Potential source of residual:** Attribution's residual calculation should match projection engine's compounding, but floating-point errors may accumulate

5. **Contribution classification differences:**
   - Attribution classifies contributions using snapshot metadata (`contributionType === 'preTax'`)
   - When `projectionInputs` is provided, attribution uses projection inputs but classifies using snapshot metadata
   - **Potential source of residual:** If snapshot metadata is inconsistent with projection inputs, contributions may be misclassified

6. **Non-loan debt paydown:**
   - `projectionSummary.totalContributions` includes non-loan debt paydown (from `monthlyDebtReduction`)
   - Attribution does NOT separately track non-loan debt paydown (only tracks loan principal)
   - **Note:** This is acknowledged in guardrail comment (line 1510) — not a bug, but a known gap

### Secondary Reconciliation Checks (Diagnostics Only)

1. **Asset roll-forward** (line 407-409):
   ```typescript
   const assetRollDelta = startingValue + contributions + growth - endingValue;
   ```
   - **Expected:** `assetRollDelta ≈ 0` (growth is residual, so this should reconcile exactly)
   - **Tolerance:** `ATTRIBUTION_TOLERANCE`

2. **Loan roll-forward** (line 412):
   ```typescript
   const loanRollDelta = startingBalanceNominal - principalRepaidNominal - remainingBalanceNominal;
   ```
   - **Expected:** `loanRollDelta ≈ 0` (nominal, not PV-adjusted)
   - **Tolerance:** `ATTRIBUTION_TOLERANCE`
   - **Note:** This is nominal (not inflation-adjusted), so it's a diagnostic check only

---

## 6. Current Tolerance Handling

### Tolerance Constant
- **`ATTRIBUTION_TOLERANCE = 1.0`** (GBP) — defined in `constants.ts` line 12
- **Rationale:** Attribution involves inflation discounting, loan amortization, and multi-year projections. Small rounding errors accumulate, so £1.00 tolerance accounts for legitimate numerical precision differences.

### Tolerance Usage

1. **Primary reconciliation check** (line 393):
   ```typescript
   if (Math.abs(d) <= ATTRIBUTION_TOLERANCE) return;
   console.error(`[A3 Attribution] ${label} delta is out of tolerance...`);
   ```
   - Logs error if `|delta| > ATTRIBUTION_TOLERANCE`
   - **No enforcement:** Only logs, does not fail or correct

2. **Asset roll-forward check** (line 409):
   - Uses same tolerance check pattern
   - Logs error if out of tolerance

3. **Loan roll-forward check** (line 412):
   - Uses same tolerance check pattern
   - Logs error if out of tolerance

4. **Cashflow overspend check** (line 424):
   - Uses `ATTRIBUTION_TOLERANCE` for negative `monthlySurplus` check
   - Only enforced when `isCashflowModeled === true`

5. **Guardrails in `ProjectionResultsScreen.tsx`** (lines 1467, 1479, 1501):
   - Uses `UI_TOLERANCE` (0.01 GBP) for net worth match check
   - Uses `ATTRIBUTION_TOLERANCE` for reconciliation and contribution decomposition checks
   - **No enforcement:** Only logs errors in `__DEV__` mode

### Tolerance Gaps

- **No production enforcement:** All tolerance checks are diagnostic only (log errors, don't fail)
- **No correction mechanism:** If reconciliation fails, attribution still returns the computed values
- **No validation at call sites:** Callers do not validate reconciliation before using attribution

---

## 7. Current Behavior When Attribution Does Not Reconcile

### When `|delta| > ATTRIBUTION_TOLERANCE`

1. **In `computeA3Attribution()`:**
   - Logs error: `[A3 Attribution] Balance-sheet reconciliation (endNetWorth vs endAssets - endLiabilities) delta is out of tolerance`
   - Includes diagnostic data: `endAssets`, `endLiabilities`, `endNetWorth`, `seriesPoints`
   - **Returns attribution object anyway** with non-zero `delta` field

2. **In `ProjectionResultsScreen.tsx` (guardrails):**
   - Logs error: `[A3 Attribution Guardrail] Baseline attribution net worth reconciliation failed`
   - Includes diagnostic data: `endingAssets`, `endingLiabilities`, `expectedNetWorth`, `attributionNetWorth`, `delta`
   - **Continues execution** — attribution is still used for UI display

3. **In `A3ValidationScreen.tsx`:**
   - Displays delta with red styling if `|delta| > ATTRIBUTION_TOLERANCE` (line 66, 112-114)
   - Shows hint text: "Delta is outside tolerance (|delta| > £1)."
   - **No enforcement** — purely diagnostic display

### Impact

- **UI still renders:** Attribution values are displayed even if reconciliation fails
- **No user-facing error:** Users may see inconsistent numbers without knowing
- **Debugging difficulty:** Errors are logged but not surfaced to users
- **No fail-fast:** System continues operating with potentially incorrect attribution

---

## 8. Architectural Choke Points for Reconciliation Enforcement

### Choke Point 1: `computeA3Attribution()` Return Statement

**Location:** `computeA3Attribution.ts` line 461 (return statement)

**Rationale:**
- Single exit point for all attribution computation
- All reconciliation checks already performed at this point
- Can enforce before returning to callers

**Enforcement Options:**
1. **Assert in `__DEV__`:** Throw error if `|delta| > ATTRIBUTION_TOLERANCE` (fail-fast in development)
2. **Production guard:** Return error object or null if reconciliation fails (force callers to handle)
3. **Correction mechanism:** Adjust `endingNetWorth` to match `endAssets - endLiabilities` (force reconciliation)

**Trade-offs:**
- **Option 1:** Catches bugs early but may break dev workflow if tolerance is too tight
- **Option 2:** Forces callers to handle errors but requires UI changes
- **Option 3:** Hides the problem but ensures reconciliation always passes

### Choke Point 2: Attribution Consumption in `ProjectionResultsScreen.tsx`

**Location:** `ProjectionResultsScreen.tsx` lines 1454-1516 (baseline attribution computation)

**Rationale:**
- Central consumption point for attribution in main UI
- Already has guardrails (lines 1465-1513) that check reconciliation
- Can enforce before using attribution for UI rendering

**Enforcement Options:**
1. **Guardrail upgrade:** Convert diagnostic logs to hard assertions (fail-fast)
2. **UI fallback:** Show error message if reconciliation fails instead of attribution values
3. **Validation gate:** Prevent scenario activation if baseline attribution doesn't reconcile

**Trade-offs:**
- **Option 1:** Catches bugs but may break user workflow
- **Option 2:** Better UX but requires error UI design
- **Option 3:** Prevents cascading errors but may block valid scenarios

### Recommended Approach

**Hybrid enforcement at both choke points:**

1. **In `computeA3Attribution()`:**
   - Add `__DEV__` assertion: throw error if `|delta| > ATTRIBUTION_TOLERANCE`
   - In production: log error but still return (backward compatibility)
   - **Future:** Consider returning error object or null in production

2. **In `ProjectionResultsScreen.tsx`:**
   - Upgrade existing guardrails to hard assertions in `__DEV__`
   - Add UI fallback: show error message if reconciliation fails
   - **Future:** Consider blocking scenario activation if baseline doesn't reconcile

**Rationale:**
- Choke Point 1 catches issues at source (attribution computation)
- Choke Point 2 catches issues at consumption (UI rendering)
- Hybrid approach provides defense in depth without breaking existing behavior

---

## 9. Doctrine Compliance Check

### Attribution Invariants (from `INVARIANTS.md`)

✅ **"Attribution must never mutate any state"**
- **Compliance:** `computeA3Attribution()` is pure function, no mutations observed

✅ **"Attribution must explain differences between outcomes"**
- **Compliance:** Attribution explains net worth change through cashflow, debt, and assets buckets

⚠️ **"Attribution outputs must reconcile to zero within tolerance"**
- **Current state:** Reconciliation is checked but not enforced
- **Gap:** Tolerance violations are logged but attribution still returned
- **Required:** Enforcement mechanism needed to satisfy this invariant

✅ **"Missing or incomplete attribution is a defect"**
- **Compliance:** All attribution buckets are computed and returned

### Architecture Compliance (from `ARCHITECTURE.md`)

✅ **"Attribution is computed from Snapshot and Projection outputs"**
- **Compliance:** Attribution consumes `snapshot`, `projectionSeries`, `projectionSummary`

✅ **"Attribution never mutates any state"**
- **Compliance:** Pure function, no side effects

✅ **"Attribution produces a new explanation object on each computation"**
- **Compliance:** Returns new `A3Attribution` object on each call

### Stop Condition Assessment

**Question:** Is attribution meaning ambiguous or does it contradict doctrine?

**Answer:** **NO** — Attribution meaning is clear and aligns with doctrine. The only gap is enforcement of the reconciliation invariant, which is a **missing enforcement mechanism**, not a meaning contradiction.

**Recommendation:** Proceed with implementation of reconciliation enforcement.

---

## 10. Summary and Recommendations

### Key Findings

1. **Reconciliation equation is clear:** `endingNetWorth = endAssets - endLiabilities`
2. **Tolerance is defined:** `ATTRIBUTION_TOLERANCE = £1.00`
3. **Checks exist but are diagnostic only:** No enforcement mechanism
4. **Residual sources identified:** Floating-point precision, inflation discounting differences, loan calculation differences
5. **Two choke points identified:** Attribution computation and attribution consumption

### Recommendations

1. **Add enforcement at Choke Point 1** (`computeA3Attribution()`):
   - `__DEV__` assertion: throw error if `|delta| > ATTRIBUTION_TOLERANCE`
   - Production: log error but return (backward compatibility)

2. **Add enforcement at Choke Point 2** (`ProjectionResultsScreen.tsx`):
   - Upgrade guardrails to hard assertions in `__DEV__`
   - Add UI fallback for reconciliation failures

3. **Consider tolerance tightening:**
   - Current tolerance (£1.00) may be too loose
   - Consider reducing to `UI_TOLERANCE` (£0.01) for stricter enforcement

4. **Investigate residual sources:**
   - Audit inflation discounting differences between attribution and projection engine
   - Audit loan calculation differences
   - Consider using projection engine's loan totals directly instead of recomputing

### Next Steps

1. Implement enforcement at identified choke points
2. Test with real data to verify tolerance is appropriate
3. Monitor reconciliation failures to identify systematic issues
4. Consider architectural improvements to reduce residual sources

---

**End of Audit Report**
