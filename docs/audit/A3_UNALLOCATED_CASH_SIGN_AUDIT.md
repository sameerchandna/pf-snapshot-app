# A3 Attribution "Unallocated Cash" Sign Audit — READ-ONLY

**Date:** 2024  
**Status:** READ-ONLY audit (no code changes)  
**Focus:** Why negative monthlySurplus (-£89) appears as positive "Unallocated cash" (+£89) in projected snapshot/A3 output

---

## Executive Summary

**Root Cause:** The `formatCurrencyCompact()` formatter uses `Math.abs()` which strips the sign from negative values, causing a negative monthly surplus to display as a positive "Unallocated cash" amount.

**Location of Issue:**
- `screens/ProjectionResultsScreen.tsx:3475` - Uses `selectMonthlySurplus(state)` (correctly returns -89)
- `screens/ProjectionResultsScreen.tsx:360` - Formats with `formatCurrencyCompact(baselineValue)`
- `formatters.ts:40-44` - `formatCurrencyCompact()` applies `Math.abs()` which strips sign

**Formula Producing +£89:**
```
baselineValue = selectMonthlySurplus(state) = -89
formatCurrencyCompact(-89) = Math.abs(-89) → formats as "£89"
```

**Invariant Violations:**
- ⚠️ **Cash semantics violation:** Negative surplus (deficit) is misrepresented as positive "unallocated cash"
- ⚠️ **Flow vs Stock semantics violation:** A FLOW deficit is displayed as a FLOW surplus
- ✅ **Attribution invariants:** No violation (attribution computation is correct, only display is wrong)

---

## 1. Calculation Path Trace

### 1.1 Source Value (Snapshot)

**Location:** `screens/ProjectionResultsScreen.tsx:3475`

```3475:3475:screens/ProjectionResultsScreen.tsx
                  baselineValue={selectMonthlySurplus(state)}
```

**Value:** `selectMonthlySurplus(state)` returns `-89` (negative monthly surplus)

**Formula:** `monthlySurplus = availableCash - assetContributions - liabilityReduction`

**Status:** ✅ Correct — selector returns negative value without clamping

---

### 1.2 Display Component

**Location:** `screens/ProjectionResultsScreen.tsx:3473-3480`

```3473:3480:screens/ProjectionResultsScreen.tsx
                <DualValueCard
                  title="Unallocated cash"
                  baselineValue={selectMonthlySurplus(state)}
                  scenarioValue={effectiveScenarioActive ? selectMonthlySurplusWithScenario(state, activeScenario) : undefined}
                  scenarioDelta={isScenarioActive ? selectMonthlySurplusWithScenario(state, activeScenario) - selectMonthlySurplus(state) : undefined}
                  showScenario={effectiveScenarioActive && scenarioValuesAtAge !== null}
                  isOutcome={true}
                />
```

**Behavior:** Passes `baselineValue = -89` to `DualValueCard` component

**Status:** ✅ Correct — negative value passed correctly

---

### 1.3 DualValueCard Formatting

**Location:** `screens/ProjectionResultsScreen.tsx:340-407`

**Baseline-only path (line 355-363):**
```355:363:screens/ProjectionResultsScreen.tsx
  if (!showScenario || scenarioValue === undefined) {
    return (
      <View style={[styles.projectedCardBordered, styles.cashflowCard, styles.cashflowPrimaryCard, styles.cashflowMb]}>
        <Text style={[styles.projectedCardTitle, styles.cashflowTextCentered]}>{title}</Text>
        <Text style={[styles.projectedPrimaryValue, isOutcome && styles.projectedPrimaryValueOutcome, styles.cashflowTextCentered]}>
          {formatCurrencyCompact(baselineValue)}
        </Text>
      </View>
    );
  }
```

**Key Line:** `formatCurrencyCompact(baselineValue)` at line 360

**Input:** `baselineValue = -89`

**Status:** ⚠️ **ISSUE** — Uses `formatCurrencyCompact()` which strips sign

---

### 1.4 Formatter Implementation

**Location:** `formatters.ts:40-44`

```40:44:formatters.ts
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `£${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `£${Math.round(abs / 1_000)}k`;
  return formatCurrencyFull(value);
}
```

**Formula Producing +£89:**
1. Input: `value = -89`
2. `abs = Math.abs(-89) = 89` ← **SIGN STRIPPED HERE**
3. `abs < 1_000_000` and `abs < 1_000`, so falls through to `formatCurrencyFull(89)`
4. `formatCurrencyFull(89)` returns `"£89"` (no sign prefix for positive values)

**Result:** `-89` → `"£89"` (positive display)

**Status:** ⚠️ **ROOT CAUSE** — `Math.abs()` strips sign from negative values

---

### 1.5 Cost Row Check

**Location:** `screens/ProjectionResultsScreen.tsx:2497-2507`

```2497:2507:screens/ProjectionResultsScreen.tsx
    const isCostRow = (label: string): boolean => {
      return label.includes('Cost of borrowing') ||
             label.includes('Interest you pay') ||
             label.includes('Contribution to pension') ||
             label.includes('Money paid in tax') ||
             label.includes('Everyday spending') ||
             label.includes('Money you invest') ||
             label.includes('Money used to pay down debt') ||
             label.includes('Money kept as cash') ||
             label.includes('Debt you pay back');
    };
```

**Check:** "Unallocated cash" is **NOT** in the `isCostRow()` list

**Impact:** "Unallocated cash" is **NOT** negated before formatting (line 2523 would negate if it were a cost row, but it's not)

**Status:** ✅ Correct — "Unallocated cash" is not treated as a cost row (should not be negated)

---

## 2. Attribution Layer Computation

### 2.1 A3 Attribution monthlySurplus Calculation

**Location:** `computeA3Attribution.ts:335-341`

```335:341:computeA3Attribution.ts
  // monthlySurplus computed as cumulative residual (display-only, NOT part of asset roll-forward):
  // FLOW semantics: monthlySurplus = netSurplus - postTaxContributions - debtOverpayments
  // This matches user intuition: money left after all allocations (FLOW concept)
  // Computed inline, not stored in attribution type
  // Preserve sign for diagnostic display (negative surplus indicates over-allocation)
  const allocationsTotal = postTaxContributions + mortgageOverpayments;
  const monthlySurplus = netSurplus - allocationsTotal;
```

**Formula:** `monthlySurplus = netSurplus - allocationsTotal`

**Status:** ✅ Correct — Attribution computes monthlySurplus correctly and preserves sign (no clamping after recent fix)

**Note:** Attribution's `monthlySurplus` is computed inline and **not stored** in the `A3Attribution` type. It's only used for diagnostic logging (line 440-446).

---

### 2.2 Attribution → UI Mapping

**Location:** `screens/ProjectionResultsScreen.tsx:2639`

```2639:2639:screens/ProjectionResultsScreen.tsx
        makeRow('Unallocated cash', selectMonthlySurplus(state), (val) => formatCurrencyFullSigned(val), (val) => formatCurrencyCompactSigned(val)),
```

**Behavior:** Uses `selectMonthlySurplus(state)` directly (not from A3 attribution)

**Formatting:** Uses `formatCurrencyFullSigned()` for baseline, `formatCurrencyCompactSigned()` for scenario

**Status:** ✅ Correct — Attribution table row uses signed formatters (would show negative correctly)

**Note:** This is in the **attribution table** (Key Drivers section), not the "Projected Snapshot" section. The "Projected Snapshot" uses `DualValueCard` which has the issue.

---

## 3. Sign Transformation Analysis

### 3.1 Where Sign is Lost

**File:** `formatters.ts`  
**Function:** `formatCurrencyCompact()`  
**Line:** 41

```41:41:formatters.ts
  const abs = Math.abs(value);
```

**Transformation:** `-89` → `89` (sign stripped)

**Rationale:** `formatCurrencyCompact()` is designed for **absolute values only** (no sign). It's used for chart axes, balance sheet values, and other contexts where sign is not meaningful.

**Problem:** Used inappropriately for "Unallocated cash" which **requires sign** to distinguish surplus from deficit.

---

### 3.2 Comparison with Other Formatters

| Formatter | Sign Handling | Used For |
|-----------|---------------|----------|
| `formatCurrencyFull()` | `Math.abs()` - strips sign | Absolute values (balances, amounts) |
| `formatCurrencyFullSigned()` | Preserves sign, shows `-` for negative | Signed values (surplus, deficit) |
| `formatCurrencyCompact()` | `Math.abs()` - strips sign | Compact absolute values (charts, summaries) |
| `formatCurrencyCompactSigned()` | Preserves sign, shows `+/-` | Signed compact values (deltas, changes) |

**Issue:** "Unallocated cash" uses `formatCurrencyCompact()` (no sign) but should use `formatCurrencyCompactSigned()` (with sign).

---

## 4. Invariant Violation Analysis

### 4.1 Cash Semantics Violation

**Violation:** Negative surplus (deficit) is displayed as positive "unallocated cash"

**Architecture Reference:** `docs/ARCHITECTURE.md:142-149`

> ### Available and Surplus Cash
> - Available cash = net income minus expenses
> - Monthly surplus = available cash minus monthly allocations
> 
> Surplus is informational only.
> Unused surplus does not modify SYSTEM_CASH automatically.
> 
> **Negative surplus indicates over-allocation and is surfaced diagnostically.**

**Violation:** The system is **not** surfacing negative surplus diagnostically in the "Projected Snapshot" view. Instead, it's masking it as positive.

**Severity:** ⚠️ **HIGH** — Misrepresents financial state

---

### 4.2 Flow vs Stock Semantics Violation

**Violation:** A FLOW deficit is displayed as a FLOW surplus

**Architecture Reference:** `docs/ARCHITECTURE.md:97-111`

> ## Flow vs Stock Semantics
> 
> ### Stock
> - Represents balances at a point in time
> - Examples: asset balances, liability balances, SYSTEM_CASH balance
> 
> ### Flow
> - Represents movement over time
> - Examples: income, expenses, contributions, repayments
> 
> Flows affect Stocks only through explicit, traceable rules.
> No implicit conversion from Flow to Stock exists.
> 
> **Monthly surplus is a flow-derived diagnostic, not an accumulating balance.**

**Violation:** The sign of the FLOW is being inverted (deficit → surplus), which violates the semantic distinction between positive and negative flows.

**Severity:** ⚠️ **HIGH** — Semantic inversion

---

### 4.3 Attribution Invariants

**Status:** ✅ **NO VIOLATION**

**Reference:** `docs/INVARIANTS.md:46-51`

> ## Attribution Invariants
> 
> - Attribution must never mutate any state.
> - Attribution must explain differences between outcomes.
> - Attribution outputs must reconcile to zero within tolerance.
> - Missing or incomplete attribution is a defect.

**Analysis:**
- Attribution computation is correct (preserves sign)
- Attribution does not mutate state
- Attribution reconciliation is unaffected
- The issue is **display-only** (UI formatting), not attribution computation

---

## 5. Complete Calculation Path

### Path Summary

```
1. Snapshot State
   └─> selectMonthlySurplus(state)
       └─> Returns: -89 ✅

2. ProjectionResultsScreen (Projected Snapshot)
   └─> DualValueCard baselineValue={selectMonthlySurplus(state)}
       └─> baselineValue = -89 ✅

3. DualValueCard Component
   └─> formatCurrencyCompact(baselineValue)
       └─> formatCurrencyCompact(-89) ⚠️

4. formatCurrencyCompact() (formatters.ts:40-44)
   └─> Math.abs(-89) = 89 ⚠️ SIGN STRIPPED
   └─> formatCurrencyFull(89)
       └─> Returns: "£89" ❌ (should be "-£89")
```

### Exact Formula Producing +£89

```
Input:  baselineValue = selectMonthlySurplus(state) = -89

Step 1: formatCurrencyCompact(-89)
Step 2:   abs = Math.abs(-89) = 89
Step 3:   abs < 1_000_000 && abs < 1_000
Step 4:   return formatCurrencyFull(89)
Step 5:     formatCurrencyFull(89) = "£89"

Output: "£89" (positive, sign lost)
```

---

## 6. Why Negative Surplus Becomes Positive "Unallocated"

**Plain-English Explanation:**

1. **Snapshot correctly computes** negative monthly surplus (-£89) via `selectMonthlySurplus(state)`
2. **Value is passed correctly** to `DualValueCard` component as `baselineValue = -89`
3. **DualValueCard formats** the value using `formatCurrencyCompact(-89)`
4. **formatCurrencyCompact() strips the sign** using `Math.abs(-89) = 89`
5. **Result displays as "£89"** (positive) instead of "-£89" (negative)

**Root Cause:** `formatCurrencyCompact()` is designed for absolute values (balances, chart axes) and uses `Math.abs()` to strip signs. It's being used inappropriately for "Unallocated cash" which is a **signed FLOW value** (surplus vs deficit).

**Semantic Issue:** A **deficit** (negative surplus) is being displayed as **unallocated cash** (positive surplus), which is semantically incorrect. The label "Unallocated cash" implies money available, but a negative value indicates a shortfall.

---

## 7. File and Line Number Summary

| File | Line(s) | Function/Component | Issue |
|------|---------|-------------------|-------|
| `screens/ProjectionResultsScreen.tsx` | 3475 | `DualValueCard baselineValue` | ✅ Correct (passes -89) |
| `screens/ProjectionResultsScreen.tsx` | 360 | `formatCurrencyCompact(baselineValue)` | ⚠️ Uses wrong formatter |
| `formatters.ts` | 41 | `formatCurrencyCompact()` | ⚠️ **ROOT CAUSE** - `Math.abs()` strips sign |
| `computeA3Attribution.ts` | 341 | `monthlySurplus` computation | ✅ Correct (preserves sign) |
| `screens/ProjectionResultsScreen.tsx` | 2639 | Attribution table row | ✅ Correct (uses signed formatter) |

---

## 8. Invariant Violation Summary

### Violations Detected

1. ⚠️ **Cash Semantics Violation**
   - **Location:** `formatters.ts:41` (via `screens/ProjectionResultsScreen.tsx:360`)
   - **Issue:** Negative surplus (deficit) displayed as positive "unallocated cash"
   - **Architecture Reference:** `docs/ARCHITECTURE.md:149` - "Negative surplus indicates over-allocation and is surfaced diagnostically"
   - **Severity:** HIGH

2. ⚠️ **Flow vs Stock Semantics Violation**
   - **Location:** `formatters.ts:41` (via `screens/ProjectionResultsScreen.tsx:360`)
   - **Issue:** FLOW deficit sign is inverted to appear as FLOW surplus
   - **Architecture Reference:** `docs/ARCHITECTURE.md:110` - "Monthly surplus is a flow-derived diagnostic"
   - **Severity:** HIGH

### No Violations

- ✅ **Attribution Invariants:** Attribution computation is correct, issue is display-only
- ✅ **Snapshot Invariants:** Snapshot state is not mutated
- ✅ **Cash Invariants:** SYSTEM_CASH is not affected (display-only issue)

---

## 9. Conclusion

**Root Cause:** `formatCurrencyCompact()` uses `Math.abs()` which strips the sign from negative values. When used for "Unallocated cash" (a signed FLOW value), it causes negative surplus to display as positive.

**Exact Formula:**
```
formatCurrencyCompact(-89) → Math.abs(-89) = 89 → "£89"
```

**Invariant Violations:**
- ⚠️ Cash semantics: Negative surplus not surfaced diagnostically
- ⚠️ Flow vs Stock semantics: FLOW sign inverted

**Fix Required:**
- Replace `formatCurrencyCompact()` with `formatCurrencyCompactSigned()` in `DualValueCard` for "Unallocated cash"
- OR: Add sign-aware formatting logic for outcome values in `DualValueCard`

**Note:** The attribution table row (line 2639) correctly uses `formatCurrencyFullSigned()` and would display negative values correctly. The issue is isolated to the "Projected Snapshot" `DualValueCard` component.
