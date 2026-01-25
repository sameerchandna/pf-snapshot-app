# Cash Values Propagation Audit — READ-ONLY

**Date:** 2024  
**Status:** READ-ONLY audit (no code changes)  
**Focus:** Trace how `snapshot.computed.totals.availableCash`, `assetContributions`, and `monthlySurplus` propagate into Projection and UI

---

## Executive Summary

This audit traces three cash-related snapshot values through the system:
1. `snapshot.computed.totals.availableCash`
2. `snapshot.computed.totals.assetContributions`
3. `snapshot.computed.totals.monthlySurplus`

**Key Findings:**
- All three values are computed in `selectors.ts` and aggregated in `selectSnapshotTotals()`
- `availableCash` and `monthlySurplus` flow through projection inputs indirectly (via monthly surplus calculation)
- `assetContributions` is directly transformed into `assetContributionsMonthly` array in projection inputs
- Sign inversions occur **only in UI formatting layer**, not in computation logic
- Clamping occurs in **attribution layer** (`Math.max(0, ...)`) and **scenario-adjusted display** (`selectMonthlySurplusWithScenario`)
- No violations of Flow vs Stock invariants detected in computation logic
- **Potential issue:** Attribution layer recomputes `monthlySurplus` with clamping, which may mask negative surplus conditions

---

## 1. `snapshot.computed.totals.availableCash`

### 1.1 Computation (Source of Truth)

**Location:** `selectors.ts:196-199`

```196:199:selectors.ts
export function selectAvailableCash(state: SnapshotState): number {
  // availableCash = netIncome − expenses
  return selectNetIncome(state) - selectSnapshotExpenses(state);
}
```

**Formula:** `availableCash = netIncome - expenses`

**Properties:**
- Pure computation, no clamping
- Can be negative (if expenses exceed net income)
- No sign inversion in computation
- Does NOT reference SYSTEM_CASH (Flow concept only)

### 1.2 Aggregation

**Location:** `selectors.ts:345` (within `selectSnapshotTotals()`)

```345:345:selectors.ts
  const availableCash = netIncome - expenses;
```

**Behavior:** Recomputed inline (not using `selectAvailableCash()` selector). This is a minor inconsistency but functionally equivalent.

### 1.3 Usage in Monthly Surplus Calculation

**Location:** `selectors.ts:222` (within `selectMonthlySurplus()`)

```222:225:selectors.ts
  const availableCash = selectAvailableCash(state);
  const assetContributions = selectAssetContributions(state);
  const liabilityReduction = selectSnapshotLiabilityReduction(state);
  const monthlySurplus = availableCash - assetContributions - liabilityReduction;
```

**Behavior:** Used as input to monthly surplus calculation. No transformation or clamping.

### 1.4 Projection Input Derivation

**Location:** `projection/buildProjectionInputs.ts:22-77`

**Behavior:** `availableCash` is **NOT directly used** in projection inputs. Projection inputs use:
- `assetContributionsMonthly` (derived from `assetContributions`, not `availableCash`)
- `monthlyDebtReduction` (from snapshot projection settings)
- `liabilityOverpaymentsMonthly` (from snapshot liability reductions)

**Note:** `availableCash` influences projection indirectly through affordability validation in scenario application (see Section 3.4).

### 1.5 Attribution Layer

**Location:** `computeA3Attribution.ts:320-324`

**Behavior:** Attribution does NOT use `availableCash` directly. Instead, it recomputes `netSurplus` from:
- `grossIncome - pensionContributions - taxes - livingExpenses`

This is a **different formula** than `availableCash` (which is `netIncome - expenses`). The attribution layer uses gross income and derives taxes, while `availableCash` uses pre-computed net income.

### 1.6 UI Formatting

**Location:** `screens/SnapshotScreen.tsx:73`

```73:73:screens/SnapshotScreen.tsx
  const availableCashText: string = formatCurrencyFullSigned(totals.availableCash);
```

**Sign Inversion:** None. Value passed directly to `formatCurrencyFullSigned()`, which handles sign display based on value sign.

**Location:** `screens/AvailableCashDetailScreen.tsx:72`

```72:72:screens/AvailableCashDetailScreen.tsx
  const availableCashText: string = formatCurrencyFullSigned(availableCashValue);
```

**Sign Inversion:** None. Direct formatting.

### 1.7 Summary for `availableCash`

| Layer | File | Function | Transformation | Clamping | Sign Inversion |
|-------|------|----------|---------------|---------|---------------|
| Computation | `selectors.ts` | `selectAvailableCash()` | None | None | None |
| Aggregation | `selectors.ts` | `selectSnapshotTotals()` | Recomputed inline | None | None |
| Projection Inputs | `projection/buildProjectionInputs.ts` | `buildProjectionInputsFromState()` | Not used directly | N/A | N/A |
| Attribution | `computeA3Attribution.ts` | `computeA3Attribution()` | Not used (different formula) | N/A | N/A |
| UI Formatting | `screens/SnapshotScreen.tsx` | Display | None | None | Formatter handles sign |

---

## 2. `snapshot.computed.totals.assetContributions`

### 2.1 Computation (Source of Truth)

**Location:** `selectors.ts:164-170`

```164:170:selectors.ts
export function selectAssetContributions(state: SnapshotState): number {
  // Only count postTax contributions (exclude preTax/pension contributions)
  // PreTax contributions come from gross income, not from available cash
  return state.assetContributions
    .filter(c => c.contributionType !== 'preTax')
    .reduce((sum, c) => sum + c.amountMonthly, 0);
}
```

**Formula:** Sum of `amountMonthly` for all `assetContributions` where `contributionType !== 'preTax'`

**Properties:**
- Filters to postTax contributions only (excludes pension/preTax)
- Pure computation, no clamping
- No sign inversion in computation
- Always positive (sum of positive amounts)

### 2.2 Aggregation

**Location:** `selectors.ts:346` (within `selectSnapshotTotals()`)

```346:346:selectors.ts
  const assetContributions = selectAssetContributions(state);
```

**Behavior:** Uses selector directly (consistent).

### 2.3 Usage in Monthly Surplus Calculation

**Location:** `selectors.ts:223` (within `selectMonthlySurplus()`)

```223:225:selectors.ts
  const assetContributions = selectAssetContributions(state);
  const liabilityReduction = selectSnapshotLiabilityReduction(state);
  const monthlySurplus = availableCash - assetContributions - liabilityReduction;
```

**Behavior:** Used as subtraction in monthly surplus calculation. No transformation.

### 2.4 Projection Input Derivation

**Location:** `projection/buildProjectionInputs.ts:33-35`

```33:35:projection/buildProjectionInputs.ts
  const activeContributions = state.assetContributions
    .filter(c => activeAssetIds.has(c.assetId))
    .map(c => ({ assetId: c.assetId, amountMonthly: c.amountMonthly }));
```

**Transformation:**
- Filters to contributions targeting active assets only
- Transforms from flat array to `assetContributionsMonthly` array format
- Maps to `{ assetId: string, amountMonthly: number }` structure
- **No clamping or sign inversion**

**Location:** `projection/buildProjectionInputs.ts:74`

```74:74:projection/buildProjectionInputs.ts
    assetContributionsMonthly: activeContributions,
```

**Behavior:** Passed directly to `ProjectionEngineInputs`.

### 2.5 Scenario Application

**Location:** `projection/applyScenarioToInputs.ts:313-316`

```313:316:projection/applyScenarioToInputs.ts
  const mergedAssetContributions = mergeAssetContributions(
    baseline.assetContributionsMonthly,
    delta.assetContributionsDelta
  );
```

**Transformation:**
- FLOW scenarios merge deltas into `assetContributionsMonthly` array
- If assetId exists, amount is increased; if not, new entry appended
- **No clamping or sign inversion**

### 2.6 Simulation Loop

**Location:** `projectionEngine.ts:203-213`

```203:213:projectionEngine.ts
    for (const c of sortedContributions) {
      const amt = typeof c.amountMonthly === 'number' && Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0;
      if (amt <= 0) continue;
      const idx = assetStates.findIndex(a => a.id === c.assetId);
      if (idx >= 0) {
        assetStates[idx].balance += amt;
      } else {
        // Contribution references a missing asset id. Ignore (state should prevent this).
        // Keep it silent to avoid noisy logs on bad persisted states.
      }
    }
```

**Transformation:**
- Contributions are added directly to asset balances
- Negative or zero contributions are skipped (`if (amt <= 0) continue`)
- **No clamping of positive values**
- **No sign inversion**

### 2.7 Attribution Layer

**Location:** `computeA3Attribution.ts:256-273`

```256:273:computeA3Attribution.ts
  if (projectionInputs) {
    // Compute contributions from projection inputs (scenario case)
    // Use snapshot metadata to classify pension vs postTax
    pensionContribMonthly = projectionInputs.assetContributionsMonthly
      .filter(c => pensionAssetIds.has(c.assetId))
      .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0), 0);
    postTaxContribMonthly = projectionInputs.assetContributionsMonthly
      .filter(c => !pensionAssetIds.has(c.assetId))
      .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0), 0);
  } else {
    // Compute contributions from snapshot (baseline case)
    pensionContribMonthly = snapshot.assetContributions
      .filter(c => c.contributionType === 'preTax' && activeAssetIds.has(c.assetId))
      .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0), 0);
    postTaxContribMonthly = snapshot.assetContributions
      .filter(c => c.contributionType !== 'preTax' && activeAssetIds.has(c.assetId))
      .reduce((sum, c) => sum + (Number.isFinite(c.amountMonthly) ? c.amountMonthly : 0), 0);
  }
```

**Transformation:**
- Attribution separates pension (preTax) from postTax contributions
- Uses projection inputs if provided (scenario case), otherwise snapshot (baseline case)
- **No clamping or sign inversion**

### 2.8 UI Formatting

**Location:** `screens/SnapshotScreen.tsx:68`

```68:68:screens/SnapshotScreen.tsx
  const assetContributionText: string = formatCurrencyFullSigned(-totals.assetContributions);
```

**Sign Inversion:** **EXPLICIT NEGATION** (`-totals.assetContributions`) before formatting.

**Location:** `screens/ContributionsDetailScreen.tsx:92`

```92:92:screens/ContributionsDetailScreen.tsx
  const totalText: string = useMemo(() => formatCurrencyFullSigned(-totalValue), [totalValue]);
```

**Sign Inversion:** **EXPLICIT NEGATION** (`-totalValue`) before formatting.

**Location:** `screens/MonthlySurplusDetailScreen.tsx:57`

```57:57:screens/MonthlySurplusDetailScreen.tsx
  const assetContributionText: string = formatCurrencyFullSigned(-totalAssetContributionsValue);
```

**Sign Inversion:** **EXPLICIT NEGATION** (`-totalAssetContributionsValue`) before formatting.

**Rationale:** Asset contributions are outflows (negative from cash perspective), so UI negates them for display as negative values.

### 2.9 Summary for `assetContributions`

| Layer | File | Function | Transformation | Clamping | Sign Inversion |
|-------|------|----------|---------------|---------|---------------|
| Computation | `selectors.ts` | `selectAssetContributions()` | Filters to postTax only | None | None |
| Aggregation | `selectors.ts` | `selectSnapshotTotals()` | Uses selector directly | None | None |
| Projection Inputs | `projection/buildProjectionInputs.ts` | `buildProjectionInputsFromState()` | Filters to active assets, maps to array | None | None |
| Scenario Application | `projection/applyScenarioToInputs.ts` | `applyScenarioToProjectionInputs()` | Merges deltas into array | None | None |
| Simulation Loop | `projectionEngine.ts` | `computeMonthlyProjection()` | Added to asset balances | Skips <= 0 | None |
| Attribution | `computeA3Attribution.ts` | `computeA3Attribution()` | Separates pension/postTax | None | None |
| UI Formatting | `screens/*.tsx` | Display | None | None | **EXPLICIT NEGATION** |

---

## 3. `snapshot.computed.totals.monthlySurplus`

### 3.1 Computation (Source of Truth)

**Location:** `selectors.ts:215-238`

```215:238:selectors.ts
export function selectMonthlySurplus(state: SnapshotState): number {
  // monthlySurplus = availableCash − assetContributions − liabilityReduction
  // This is a pure cashflow concept computed ONLY from cashflow inputs:
  //   - availableCash (netIncome - expenses)
  //   - assetContributions (postTax contributions only)
  //   - liabilityReduction (manual debt reduction + overpayments)
  // MUST NOT reference SYSTEM_CASH, asset balances, or projection logic
  const availableCash = selectAvailableCash(state);
  const assetContributions = selectAssetContributions(state);
  const liabilityReduction = selectSnapshotLiabilityReduction(state);
  const monthlySurplus = availableCash - assetContributions - liabilityReduction;

  if (!Number.isFinite(monthlySurplus)) {
    if (__DEV__) {
      throw new Error(
        `[monthlySurplus] Non-finite monthlySurplus. availableCash=${availableCash}, assetContributions=${assetContributions}, liabilityReduction=${liabilityReduction}`
      );
    }
    console.error('[monthlySurplus] Non-finite monthlySurplus, defaulting to 0');
    return 0;
  }

  return monthlySurplus;
}
```

**Formula:** `monthlySurplus = availableCash - assetContributions - liabilityReduction`

**Properties:**
- Pure FLOW concept (no STOCK reference)
- **Can be negative** (no clamping in selector)
- No sign inversion in computation
- Only clamps non-finite values to 0 (defensive guard, not semantic clamping)

### 3.2 Aggregation

**Location:** `selectors.ts:348` (within `selectSnapshotTotals()`)

```348:348:selectors.ts
  const monthlySurplus = selectMonthlySurplus(state);
```

**Behavior:** Uses selector directly (consistent).

### 3.3 Scenario-Adjusted Display Selector

**Location:** `selectors.ts:255-273`

```255:273:selectors.ts
export function selectMonthlySurplusWithScenario(state: SnapshotState, activeScenario?: Scenario): number {
  const baselineSurplus = selectMonthlySurplus(state);
  
  // If no active scenario, return baseline
  if (!activeScenario) {
    return baselineSurplus;
  }
  
  // For FLOW scenarios, subtract the scenario amount from monthly surplus
  // This shows what monthly surplus would be if the scenario were applied
  if (activeScenario.kind === 'FLOW_TO_ASSET' || activeScenario.kind === 'FLOW_TO_DEBT') {
    const adjustedSurplus = baselineSurplus - activeScenario.amountMonthly;
    // Clamp to 0 minimum (surplus cannot go negative in display)
    return Math.max(0, adjustedSurplus);
  }
  
  // Unknown scenario kind, return baseline
  return baselineSurplus;
}
```

**Transformation:**
- Subtracts scenario amount from baseline surplus
- **CLAMPS TO 0 MINIMUM** (`Math.max(0, adjustedSurplus)`)
- **This is display-only** (does not affect projection computation)

**Note:** This clamping may mask negative surplus conditions in UI, but is intentional for display purposes.

### 3.4 Projection Input Derivation

**Location:** `projection/buildProjectionInputs.ts:22-77`

**Behavior:** `monthlySurplus` is **NOT directly used** in projection inputs. Projection inputs use:
- `assetContributionsMonthly` (from `assetContributions`)
- `monthlyDebtReduction` (from snapshot projection settings)
- `liabilityOverpaymentsMonthly` (from snapshot liability reductions)

**Indirect Usage:** `monthlySurplus` is used for **affordability validation** in scenario application:

**Location:** `projection/applyScenarioToInputs.ts:196-220`

```196:220:projection/applyScenarioToInputs.ts
  if (scenario.kind === 'FLOW_TO_ASSET' && snapshotState) {
    const baselineSurplus = selectMonthlySurplus(snapshotState);
    const surplusAfter = baselineSurplus - scenario.amountMonthly;
    
    // If surplusAfter < -UI_TOLERANCE, scenario is unaffordable → return baseline unchanged (fallback)
    // Equality at boundary (=== -UI_TOLERANCE) is allowed
    if (surplusAfter < -UI_TOLERANCE) {
      // Phase 3.3: __DEV__ fail-fast enforcement for unaffordable scenarios
      if (__DEV__) {
        throw new Error(
          `[FLOW_TO_ASSET Affordability] Scenario ${scenario.id} is unaffordable. ` +
          `Baseline surplus: ${baselineSurplus}, scenario amount: ${scenario.amountMonthly}, ` +
          `surplus after: ${surplusAfter} < -${UI_TOLERANCE}. ` +
          `This indicates the scenario exceeds available cashflow.`
        );
      }
      // Production: Log warning and return baseline unchanged (backward compatibility)
      console.warn(
        `[FLOW_TO_ASSET Affordability] Scenario ${scenario.id} is unaffordable. ` +
        `Baseline surplus: ${baselineSurplus}, scenario amount: ${scenario.amountMonthly}, ` +
        `surplus after: ${surplusAfter} < -${UI_TOLERANCE}, falling back to baseline`
      );
      return baseline;
    }
  }
```

**Behavior:** Uses `monthlySurplus` to validate scenario affordability. If scenario would make surplus negative beyond tolerance, scenario is rejected (fallback to baseline).

### 3.5 Attribution Layer

**Location:** `computeA3Attribution.ts:335-340`

```335:340:computeA3Attribution.ts
  // monthlySurplus computed as cumulative residual (display-only, NOT part of asset roll-forward):
  // FLOW semantics: monthlySurplus = netSurplus - postTaxContributions - debtOverpayments
  // This matches user intuition: money left after all allocations (FLOW concept)
  // Computed inline, not stored in attribution type
  const allocationsTotal = postTaxContributions + mortgageOverpayments;
  const monthlySurplus = Math.max(0, netSurplus - allocationsTotal);
```

**Transformation:**
- **RECOMPUTED** from attribution's `netSurplus` (not from snapshot `monthlySurplus`)
- Uses different formula: `netSurplus - postTaxContributions - mortgageOverpayments`
- **CLAMPS TO 0 MINIMUM** (`Math.max(0, ...)`)
- **Display-only** (not stored in attribution type, computed inline)

**Note:** This is a **different computation** than snapshot `monthlySurplus`. Attribution uses:
- `netSurplus = grossIncome - pensionContributions - taxes - livingExpenses` (when cashflow modeled)
- `postTaxContributions` (from projection inputs or snapshot)
- `mortgageOverpayments` (from projection summary)

While snapshot uses:
- `availableCash = netIncome - expenses`
- `assetContributions` (postTax only)
- `liabilityReduction` (manual + overpayments)

**Potential Issue:** Attribution's `monthlySurplus` may differ from snapshot `monthlySurplus` due to different formulas and clamping.

### 3.6 UI Formatting

**Location:** `screens/SnapshotScreen.tsx:61,74`

```61:74:screens/SnapshotScreen.tsx
  const monthlySurplusValue = selectMonthlySurplusWithScenario(state, activeScenario);

  const grossIncomeText: string = formatCurrencyFull(totals.grossIncome);
  const pensionText: string = formatCurrencyFullSigned(-totals.pension);
  const netIncomeText: string = formatCurrencyFull(totals.netIncome);
  const expensesText: string = formatCurrencyFullSigned(-totals.expenses);
  const liabilityReductionText: string = formatCurrencyFullSigned(-totals.liabilityReduction);
  const assetContributionText: string = formatCurrencyFullSigned(-totals.assetContributions);
  const totalAssetsText: string = formatCurrencyFull(totals.assets);
  const totalLiabilitiesText: string = formatCurrencyFull(totals.liabilities);
  const deductionsText: string = formatCurrencyFullSigned(-totals.deductions);

  const availableCashText: string = formatCurrencyFullSigned(totals.availableCash);
  const monthlySurplusText: string = formatCurrencyFullSigned(monthlySurplusValue);
```

**Sign Inversion:** None. Value passed directly to `formatCurrencyFullSigned()`, which handles sign display.

**Note:** Uses `selectMonthlySurplusWithScenario()` which clamps to 0 minimum, so negative values are never displayed.

**Location:** `screens/MonthlySurplusDetailScreen.tsx:53`

```53:53:screens/MonthlySurplusDetailScreen.tsx
  const monthlySurplusText: string = formatCurrencyFullSigned(monthlySurplusValue);
```

**Sign Inversion:** None. Direct formatting.

**Note:** Uses `selectMonthlySurplus()` (not scenario-adjusted), so negative values can be displayed.

### 3.7 Summary for `monthlySurplus`

| Layer | File | Function | Transformation | Clamping | Sign Inversion |
|-------|------|----------|---------------|---------|---------------|
| Computation | `selectors.ts` | `selectMonthlySurplus()` | None | None (except non-finite) | None |
| Aggregation | `selectors.ts` | `selectSnapshotTotals()` | Uses selector directly | None | None |
| Scenario Display | `selectors.ts` | `selectMonthlySurplusWithScenario()` | Subtracts scenario amount | **CLAMPS TO 0** | None |
| Projection Inputs | `projection/buildProjectionInputs.ts` | `buildProjectionInputsFromState()` | Not used directly | N/A | N/A |
| Scenario Validation | `projection/applyScenarioToInputs.ts` | `applyScenarioToProjectionInputs()` | Used for affordability check | None | None |
| Attribution | `computeA3Attribution.ts` | `computeA3Attribution()` | **RECOMPUTED** (different formula) | **CLAMPS TO 0** | None |
| UI Formatting | `screens/SnapshotScreen.tsx` | Display | Uses scenario-adjusted (clamped) | Already clamped | Formatter handles sign |
| UI Formatting | `screens/MonthlySurplusDetailScreen.tsx` | Display | Uses baseline (not clamped) | None | Formatter handles sign |

---

## 4. Sign Inversion Analysis

### 4.1 Where Sign Inversion Occurs

**Layer:** UI Formatting only

**Files:**
- `screens/SnapshotScreen.tsx:68` - `formatCurrencyFullSigned(-totals.assetContributions)`
- `screens/ContributionsDetailScreen.tsx:92` - `formatCurrencyFullSigned(-totalValue)`
- `screens/MonthlySurplusDetailScreen.tsx:57` - `formatCurrencyFullSigned(-totalAssetContributionsValue)`

**Pattern:** Only `assetContributions` is explicitly negated before formatting. `availableCash` and `monthlySurplus` are passed directly to formatters.

**Rationale:** Asset contributions are outflows (negative from cash perspective), so UI negates them to display as negative values. `availableCash` and `monthlySurplus` can be positive or negative naturally, so no inversion needed.

### 4.2 Formatter Behavior

**Location:** `formatters.ts:28-31`

```28:31:formatters.ts
export function formatCurrencyFullSigned(value: number): string {
  const sign = value >= 0 ? '' : '-';
  return `${sign}£${Math.abs(value).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
```

**Behavior:** Formatter displays sign based on value sign:
- Positive values: no sign prefix
- Negative values: `-` prefix

**Note:** `Math.abs()` is used for formatting only (to avoid double negative), not for computation.

---

## 5. Clamping Analysis

### 5.1 Where Clamping Occurs

| Value | Location | Function | Clamping Logic |
|-------|----------|----------|---------------|
| `availableCash` | None | N/A | No clamping anywhere |
| `assetContributions` | `projectionEngine.ts:205` | `computeMonthlyProjection()` | Skips `<= 0` contributions (not clamping, filtering) |
| `monthlySurplus` | `selectors.ts:268` | `selectMonthlySurplusWithScenario()` | `Math.max(0, adjustedSurplus)` |
| `monthlySurplus` | `computeA3Attribution.ts:340` | `computeA3Attribution()` | `Math.max(0, netSurplus - allocationsTotal)` |

### 5.2 Clamping Rationale

1. **Scenario-Adjusted Display (`selectMonthlySurplusWithScenario`)**: Clamps to 0 to prevent showing negative surplus in scenario preview (display-only, does not affect projection).

2. **Attribution Layer (`computeA3Attribution`)**: Clamps to 0 for display consistency. Attribution's `monthlySurplus` is display-only residual, not part of asset roll-forward.

3. **Projection Engine**: Skips negative contributions (defensive guard, not semantic clamping).

### 5.3 Potential Issues

**Issue 1:** Attribution's `monthlySurplus` clamping may mask negative surplus conditions that should be surfaced diagnostically.

**Issue 2:** Scenario-adjusted display clamping may hide affordability warnings (negative surplus after scenario application).

**Issue 3:** Attribution recomputes `monthlySurplus` with different formula than snapshot, which may cause inconsistencies.

---

## 6. Flow vs Stock Invariant Compliance

### 6.1 `availableCash`

✅ **Compliant:** Pure FLOW concept. Does not reference SYSTEM_CASH or asset balances.

### 6.2 `assetContributions`

✅ **Compliant:** Pure FLOW concept. Represents monthly cashflow allocation, not stock balance.

### 6.3 `monthlySurplus`

✅ **Compliant:** Pure FLOW concept. Explicitly documented as FLOW-only (see `selectors.ts:212` comment).

**Note:** Attribution layer's `monthlySurplus` is explicitly documented as "display-only, NOT part of asset roll-forward" (see `computeA3Attribution.ts:343` comment), maintaining Flow vs Stock separation.

---

## 7. Cash Invariant Compliance

### 7.1 SYSTEM_CASH Balance

✅ **Compliant:** None of the three values mutate SYSTEM_CASH balance:
- `availableCash`: Does not reference SYSTEM_CASH
- `assetContributions`: Can target SYSTEM_CASH as an asset, but this is explicit user allocation (STOCK scenario), not automatic accumulation
- `monthlySurplus`: Explicitly documented as not auto-accumulating into SYSTEM_CASH (see `selectors.ts:212` comment)

### 7.2 FLOW Scenarios

✅ **Compliant:** FLOW scenarios do not mutate SYSTEM_CASH balance:
- Guardrail in `projection/applyScenarioToInputs.ts:290-300` prevents FLOW scenarios from adding contributions to SYSTEM_CASH
- FLOW scenarios work through contribution deltas to other assets/liabilities only

---

## 8. Findings Summary

### 8.1 Correct Behaviors

1. ✅ All three values are computed correctly in `selectors.ts`
2. ✅ Sign inversions occur only in UI formatting layer (for `assetContributions` only)
3. ✅ No Flow vs Stock violations in computation logic
4. ✅ No Cash invariant violations
5. ✅ Projection inputs correctly transform `assetContributions` to `assetContributionsMonthly` array
6. ✅ Scenario validation uses `monthlySurplus` for affordability checks

### 8.2 Potential Issues

1. ⚠️ **Attribution layer recomputes `monthlySurplus` with different formula** than snapshot, which may cause inconsistencies
2. ⚠️ **Attribution layer clamps `monthlySurplus` to 0**, which may mask negative surplus conditions
3. ⚠️ **Scenario-adjusted display clamps `monthlySurplus` to 0**, which may hide affordability warnings
4. ⚠️ **Minor inconsistency:** `selectSnapshotTotals()` recomputes `availableCash` inline instead of using `selectAvailableCash()` selector

### 8.3 Recommendations (For Future Consideration)

1. **Consider:** Align attribution's `monthlySurplus` formula with snapshot's `monthlySurplus` formula for consistency
2. **Consider:** Remove clamping in attribution layer to surface negative surplus diagnostically
3. **Consider:** Use `selectAvailableCash()` in `selectSnapshotTotals()` for consistency
4. **Consider:** Document rationale for different formulas between snapshot and attribution layers

---

## 9. File Reference Summary

### 9.1 Core Computation Files

- `selectors.ts` - All three values computed here
- `projection/buildProjectionInputs.ts` - Transforms `assetContributions` to projection inputs
- `projection/applyScenarioToInputs.ts` - Applies scenario deltas to projection inputs
- `projectionEngine.ts` - Simulation loop uses `assetContributionsMonthly`
- `computeA3Attribution.ts` - Attribution layer recomputes `monthlySurplus`

### 9.2 UI Display Files

- `screens/SnapshotScreen.tsx` - Main snapshot display
- `screens/AvailableCashDetailScreen.tsx` - Available cash detail
- `screens/ContributionsDetailScreen.tsx` - Asset contributions detail
- `screens/MonthlySurplusDetailScreen.tsx` - Monthly surplus detail
- `formatters.ts` - Currency formatting utilities

---

## 10. Conclusion

The audit reveals that cash-related values propagate correctly through the system with proper Flow vs Stock separation. Sign inversions occur only in UI formatting (for `assetContributions`), and clamping occurs only in display/attribution layers (for `monthlySurplus`). No invariant violations were detected in computation logic.

The main areas for potential improvement are:
1. Attribution layer's different `monthlySurplus` formula
2. Clamping that may mask negative surplus conditions
3. Minor inconsistency in `selectSnapshotTotals()` recomputation

These are not critical issues but may warrant future review for consistency and diagnostic clarity.
