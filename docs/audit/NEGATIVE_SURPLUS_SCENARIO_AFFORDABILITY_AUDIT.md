# Negative Surplus and Scenario Affordability Handling — Audit Report

**Phase:** 3.3 — Negative surplus and scenario affordability handling  
**Date:** 2024  
**Status:** READ-ONLY audit (no code changes)

---

## 1. Monthly Surplus Computation and Formula

### Primary Computation Location
- **Function:** `selectMonthlySurplus(state: SnapshotState)` in `selectors.ts` (line 215)
- **Formula:**
  ```typescript
  monthlySurplus = availableCash - assetContributions - liabilityReduction
  ```
  Where:
  - `availableCash = netIncome - expenses` (line 198)
  - `assetContributions = sum of postTax asset contributions` (line 223)
  - `liabilityReduction = manual debt reduction + overpayments` (line 224)

### Secondary Computation Locations (Display-Only)

1. **`computeMonthlySurplus()` in `ProjectionResultsScreen.tsx`** (line 54):
   ```typescript
   monthlySurplus = Math.max(0, netSurplus - postTaxContributions - debtOverpayments)
   ```
   - Used for attribution display only
   - Clamps to 0 minimum (does not show negative values)

2. **`computeMonthlySurplus()` in `A3ValidationScreen.tsx`** (line 20):
   - Same formula as above
   - Used for validation screen display

3. **`computeA3Attribution()` in `computeA3Attribution.ts`** (line 340):
   ```typescript
   monthlySurplus = Math.max(0, netSurplus - allocationsTotal)
   ```
   - Where `allocationsTotal = postTaxContributions + mortgageOverpayments`
   - Computed inline, not stored in attribution type
   - Clamps to 0 minimum

### Key Properties

- **FLOW concept:** Monthly surplus is a pure cashflow signal, not a stock balance
- **Does NOT reference SYSTEM_CASH:** Selector explicitly avoids SYSTEM_CASH (line 212 comment)
- **Can be negative:** `selectMonthlySurplus()` can return negative values (no clamping)
- **Display clamping:** UI display functions clamp to 0 minimum (`Math.max(0, ...)`)
- **Not part of asset roll-forward:** Monthly surplus is explicitly excluded from asset contributions (line 349 comment in `computeA3Attribution.ts`)

---

## 2. Surplus Through Projection Inputs and Outputs

### Flow Through System

1. **Snapshot → Selector:**
   - `selectMonthlySurplus(state)` computes from snapshot cashflow items
   - Pure FLOW calculation, no projection logic

2. **Selector → Scenario Affordability:**
   - `applyScenarioToProjectionInputs()` uses `selectMonthlySurplus(snapshotState)` for affordability validation (lines 197, 218)
   - Checks: `surplusAfter = baselineSurplus - scenario.amountMonthly`
   - If `surplusAfter < -UI_TOLERANCE`, scenario is unaffordable → returns baseline unchanged

3. **Projection Engine:**
   - Monthly surplus is **NOT** passed to projection engine
   - Projection engine operates on:
     - `assetContributionsMonthly` (from snapshot + scenario deltas)
     - `liabilityOverpaymentsMonthly` (from snapshot + scenario deltas)
     - `monthlyDebtReduction` (from snapshot)
   - **No direct monthly surplus input**

4. **Attribution:**
   - Attribution computes `monthlySurplus` as display-only residual (line 340)
   - Formula: `Math.max(0, netSurplus - allocationsTotal)`
   - **Not used in reconciliation or asset roll-forward**

### Key Finding: Surplus Does NOT Flow Into Projection

- Monthly surplus is used **only** for:
  1. Scenario affordability validation (before projection)
  2. UI display (after projection, in attribution)
- Projection engine does **not** receive monthly surplus as input
- Projection engine operates on explicit contributions and debt reduction, not surplus

---

## 3. Verification: Surplus Does NOT Mutate SYSTEM_CASH or Stock Balances

### SYSTEM_CASH Handling

✅ **SYSTEM_CASH is NOT mutated by monthly surplus:**
- `selectMonthlySurplus()` explicitly avoids SYSTEM_CASH (line 212 comment: "MUST NOT reference SYSTEM_CASH")
- SYSTEM_CASH balance comes from `state.assets` (STOCK concept), not from monthly surplus (FLOW concept)
- Projection engine treats SYSTEM_CASH as normal asset: opening balance, growth, optional contributions
- **No auto-accumulation:** Monthly surplus does not automatically accumulate into SYSTEM_CASH balance

### Projection Engine Behavior

✅ **Projection engine does NOT use monthly surplus:**
- `computeMonthlyProjection()` receives `assetContributionsMonthly` and `liabilityOverpaymentsMonthly`
- These are explicit contributions, not derived from surplus
- SYSTEM_CASH balance is treated as normal asset balance (line 321-340 in `projectionEngine.ts`)

### Attribution Behavior

✅ **Attribution excludes monthly surplus from asset roll-forward:**
- Line 349 comment: "Do NOT include monthlySurplus or cash accumulation in asset contributions"
- Monthly surplus is computed but not stored in attribution type (line 340)
- Asset roll-forward: `endingAssets = startingAssets + contributions + growth` (surplus excluded)

### Guardrails

✅ **DEV guardrails prevent SYSTEM_CASH mutation:**
- `applyScenarioToInputs.ts` line 272-285: DEV guardrail prevents FLOW scenarios from targeting SYSTEM_CASH
- `projectionEngine.ts` line 321-340: DEV guardrail checks SYSTEM_CASH never goes negative (for future STOCK scenarios)

### Conclusion

**✅ NO INVARIANT VIOLATIONS DETECTED:**
- Monthly surplus does NOT implicitly mutate SYSTEM_CASH
- Monthly surplus does NOT implicitly mutate any stock balances
- SYSTEM_CASH balance remains unchanged by FLOW scenarios
- All Cash invariants are satisfied

---

## 4. Scenario Affordability When Snapshot Changes After Save

### Scenario Persistence

- **Storage:** Scenarios are persisted in `scenarioState/scenarioPersistence.ts` and `scenarioState/scenarioProfileStore.ts`
- **No snapshot dependency:** Scenarios are stored independently of snapshot state
- **No validation on save:** Scenarios are saved without affordability validation
- **Validation on apply:** Affordability is checked when scenario is applied to projection inputs

### Affordability Validation Points

#### Point 1: `applyScenarioToProjectionInputs()` (Authoritative)

**Location:** `projection/applyScenarioToInputs.ts` lines 193-233

**For FLOW_TO_ASSET scenarios:**
```typescript
if (scenario.kind === 'FLOW_TO_ASSET' && snapshotState) {
  const baselineSurplus = selectMonthlySurplus(snapshotState);
  const surplusAfter = baselineSurplus - scenario.amountMonthly;
  
  if (surplusAfter < -UI_TOLERANCE) {
    // Unaffordable → return baseline unchanged (fallback)
    return baseline;
  }
}
```

**For FLOW_TO_DEBT scenarios:**
```typescript
if (scenario.kind === 'FLOW_TO_DEBT' && snapshotState) {
  const baselineSurplus = selectMonthlySurplus(snapshotState);
  const surplusAfter = baselineSurplus - scenario.amountMonthly;
  
  if (surplusAfter < -UI_TOLERANCE) {
    // Unaffordable → return baseline unchanged (fallback)
    return baseline;
  }
}
```

**Behavior:**
- ✅ Uses **current snapshot state** (not snapshot at save time)
- ✅ If unaffordable, returns baseline unchanged (silent fallback)
- ✅ Logs warning in `__DEV__` only
- ✅ No error thrown, no UI notification

#### Point 2: `ProjectionResultsScreen.tsx` (Early Feedback)

**Location:** `screens/ProjectionResultsScreen.tsx` lines 1412-1425

**For persisted scenarios:**
```typescript
if (activeScenario.kind === 'FLOW_TO_ASSET') {
  const monthlySurplus = selectMonthlySurplus(state);
  const surplusAfter = monthlySurplus - activeScenario.amountMonthly;
  
  if (surplusAfter < -UI_TOLERANCE) {
    // Returns null → uses baseline projection
    return null;
  }
}
```

**Behavior:**
- ✅ Uses **current snapshot state** (not snapshot at save time)
- ✅ If unaffordable, returns `null` → uses baseline projection
- ✅ Logs warning in `__DEV__` only
- ✅ No error thrown, no UI notification
- ⚠️ **Only checks FLOW_TO_ASSET** (does not check FLOW_TO_DEBT)

#### Point 3: Quick What-If Scenarios

**Location:** `screens/ProjectionResultsScreen.tsx` lines 1328-1336

**Behavior:**
- ✅ Checks affordability before creating domain scenario
- ✅ If unaffordable, returns `null` → uses baseline projection
- ✅ Logs warning (not just `__DEV__`)
- ⚠️ **Only checks FLOW_INVESTING** (does not check FLOW_DEBT_PAYDOWN)

### Key Findings: Snapshot Changes After Save

✅ **Scenarios are re-validated on each apply:**
- Affordability is checked using **current snapshot state**, not snapshot at save time
- If snapshot changes make scenario unaffordable, scenario silently falls back to baseline

⚠️ **Silent fallback behavior:**
- No user-facing error or notification
- No scenario invalidation or deletion
- Scenario remains saved but effectively inactive
- User may not realize scenario is not being applied

⚠️ **Inconsistent validation coverage:**
- `ProjectionResultsScreen.tsx` only validates FLOW_TO_ASSET for persisted scenarios
- Quick What-If only validates FLOW_INVESTING (not FLOW_DEBT_PAYDOWN)
- `applyScenarioToProjectionInputs()` validates both FLOW_TO_ASSET and FLOW_TO_DEBT (authoritative)

### Saved vs Quick Scenarios

**Saved scenarios:**
- Persisted in storage
- Re-validated on each apply using current snapshot
- Silent fallback if unaffordable
- No invalidation or deletion

**Quick What-If scenarios:**
- Ephemeral (not persisted)
- Validated before creation
- Returns `null` if unaffordable → uses baseline
- Logs warning (not just `__DEV__`)

---

## 5. SYSTEM_CASH Behavior When Unaffordable Scenarios Are Applied

### Current Behavior

✅ **SYSTEM_CASH is NOT affected by unaffordable scenarios:**
- Unaffordable scenarios return baseline unchanged (no mutation)
- SYSTEM_CASH balance remains unchanged
- No implicit mutation occurs

### Guardrails

✅ **DEV guardrails prevent SYSTEM_CASH mutation:**
- `applyScenarioToInputs.ts` line 272-285: Prevents FLOW scenarios from targeting SYSTEM_CASH
- `projectionEngine.ts` line 321-340: Checks SYSTEM_CASH never goes negative

### Conclusion

**✅ NO INVARIANT VIOLATIONS:**
- SYSTEM_CASH balance is NOT affected by unaffordable scenarios
- Unaffordable scenarios fall back to baseline (no mutation)
- All Cash invariants are satisfied

---

## 6. Negative Surplus Surfacing in UI/Logs

### UI Display

#### SnapshotScreen (`screens/SnapshotScreen.tsx`)

**Line 61:** Uses `selectMonthlySurplusWithScenario(state, activeScenario)`

**Line 74:** Formats as `formatCurrencyFullSigned(monthlySurplusValue)`

**Line 112-114:** Positive surplus display:
```typescript
if (monthlySurplusValue >= 0) {
  lines.push(`After all flows, ${amt} remains unallocated each month...`);
}
```

**Line 115-117:** Negative surplus display:
```typescript
else {
  lines.push(`Allocations exceed available cash by ${amt} per month...`);
}
```

**Key finding:** ✅ **Negative surplus IS displayed** in SnapshotScreen insights

#### MonthlySurplusDetailScreen (`screens/MonthlySurplusDetailScreen.tsx`)

**Line 52:** Uses `selectMonthlySurplus(state)` (baseline, not scenario-adjusted)

**Line 53:** Formats as `formatCurrencyFullSigned(monthlySurplusValue)`

**Key finding:** ✅ **Negative surplus IS displayed** in detail screen

#### ProjectionResultsScreen (`screens/ProjectionResultsScreen.tsx`)

**Line 54:** `computeMonthlySurplus()` clamps to 0: `Math.max(0, netSurplus - postTaxContributions - debtOverpayments)`

**Key finding:** ⚠️ **Negative surplus is HIDDEN** in projection results (clamped to 0)

#### A3ValidationScreen (`screens/A3ValidationScreen.tsx`)

**Line 20:** `computeMonthlySurplus()` clamps to 0

**Key finding:** ⚠️ **Negative surplus is HIDDEN** in validation screen (clamped to 0)

### Logs

#### Attribution Logs (`computeA3Attribution.ts`)

**Line 439-446:** Logs error if `monthlySurplus < -ATTRIBUTION_TOLERANCE`:
```typescript
if (isCashflowModeled && monthlySurplus < -ATTRIBUTION_TOLERANCE) {
  console.error(`[A3 Attribution] Cashflow overspend...`);
}
```

**Key finding:** ✅ **Negative surplus IS logged** in attribution (when cashflow is modeled)

#### Scenario Affordability Logs

**`applyScenarioToInputs.ts` lines 203-209, 224-230:**
- Logs warning in `__DEV__` only
- Format: `[FLOW_TO_ASSET Affordability] Scenario ${id} is unaffordable...`

**`ProjectionResultsScreen.tsx` lines 1334, 1421:**
- Logs warning (not just `__DEV__`)
- Format: `Quick What-If amount (${amount}) exceeds available cash (${surplus})...`

**Key finding:** ⚠️ **Affordability warnings are logged, but only in `__DEV__` for persisted scenarios**

### Summary: Negative Surplus Surfacing

| Location | Negative Surplus Displayed? | Notes |
|----------|----------------------------|-------|
| SnapshotScreen | ✅ Yes | Shows in insights text |
| MonthlySurplusDetailScreen | ✅ Yes | Shows as formatted value |
| ProjectionResultsScreen | ❌ No | Clamped to 0 |
| A3ValidationScreen | ❌ No | Clamped to 0 |
| Attribution logs | ✅ Yes | Logs error if < -ATTRIBUTION_TOLERANCE |
| Scenario affordability logs | ⚠️ Partial | `__DEV__` only for persisted scenarios |

---

## 7. Ambiguities, Silent Behavior, and Invariant Risks

### Ambiguities

1. **Inconsistent negative surplus display:**
   - SnapshotScreen shows negative surplus
   - ProjectionResultsScreen hides negative surplus (clamped to 0)
   - **Ambiguity:** User may see different values in different screens

2. **Silent scenario fallback:**
   - Unaffordable scenarios silently fall back to baseline
   - No user notification or error
   - **Ambiguity:** User may not realize scenario is not being applied

3. **Inconsistent validation coverage:**
   - `ProjectionResultsScreen.tsx` only validates FLOW_TO_ASSET for persisted scenarios
   - Quick What-If only validates FLOW_INVESTING
   - `applyScenarioToProjectionInputs()` validates both (authoritative)
   - **Ambiguity:** Some validation paths may miss unaffordable scenarios

### Silent Behavior

1. **Unaffordable scenario fallback:**
   - No error thrown
   - No UI notification
   - No scenario invalidation
   - Scenario remains saved but inactive

2. **Negative surplus clamping:**
   - ProjectionResultsScreen clamps to 0
   - A3ValidationScreen clamps to 0
   - **Silent:** User may not see negative surplus in projection context

3. **Affordability logging:**
   - Persisted scenarios: logs only in `__DEV__`
   - Quick What-If: logs in production
   - **Inconsistent:** Different logging behavior for different scenario types

### Invariant Risks

✅ **No invariant violations detected:**
- Monthly surplus does NOT mutate SYSTEM_CASH
- Unaffordable scenarios do NOT mutate SYSTEM_CASH
- All Cash invariants are satisfied
- All Scenario invariants are satisfied

⚠️ **Potential risks (not violations):**
- Silent fallback may confuse users
- Inconsistent validation may allow unaffordable scenarios to be applied in some paths
- Negative surplus clamping may hide important diagnostic information

---

## 8. Architectural Choke Points for Surplus/Scenario Handling

### Choke Point 1: `applyScenarioToProjectionInputs()` (Authoritative)

**Location:** `projection/applyScenarioToInputs.ts` lines 166-403

**Rationale:**
- Single entry point for scenario application
- Authoritative affordability validation (lines 193-233)
- All scenario application flows through this function
- Returns baseline unchanged if unaffordable (silent fallback)

**Current behavior:**
- Validates affordability using current snapshot state
- Returns baseline unchanged if unaffordable
- Logs warning in `__DEV__` only
- No error thrown, no UI notification

**Enforcement options:**
1. **Throw error in `__DEV__`:** Fail fast in development
2. **Return error object:** Force callers to handle unaffordable scenarios
3. **Add UI notification:** Surface unaffordable scenario to user
4. **Invalidate scenario:** Mark scenario as invalid and prevent activation

### Choke Point 2: `selectMonthlySurplus()` (Single Source of Truth)

**Location:** `selectors.ts` line 215

**Rationale:**
- Single source of truth for monthly surplus computation
- Used by all affordability validation
- Pure function, no side effects
- Can return negative values (no clamping)

**Current behavior:**
- Computes from snapshot cashflow items
- Does NOT reference SYSTEM_CASH
- Returns negative values if allocations exceed available cash
- No validation or enforcement

**Enforcement options:**
1. **Add validation:** Assert monthly surplus is finite
2. **Add logging:** Log negative surplus occurrences
3. **Add UI notification:** Surface negative surplus to user
4. **Add enforcement:** Prevent negative surplus (would require doctrine change)

### Recommended Approach

**Hybrid enforcement at both choke points:**

1. **In `applyScenarioToProjectionInputs()`:**
   - Add `__DEV__` assertion: throw error if scenario is unaffordable
   - In production: log warning and return baseline (backward compatibility)
   - **Future:** Consider returning error object or null in production

2. **In `selectMonthlySurplus()`:**
   - Keep current behavior (can return negative values)
   - Add optional logging for negative surplus
   - **Future:** Consider UI notification for persistent negative surplus

**Rationale:**
- Choke Point 1 catches issues at scenario application (authoritative validation)
- Choke Point 2 catches issues at surplus computation (single source of truth)
- Hybrid approach provides defense in depth without breaking existing behavior

---

## 9. Doctrine Compliance Check

### Cash Invariants (from `INVARIANTS.md`)

✅ **"SYSTEM_CASH must always exist"**
- **Compliance:** SYSTEM_CASH is enforced in profile storage and migration

✅ **"SYSTEM_CASH balance must not be implicitly modified"**
- **Compliance:** Monthly surplus does NOT modify SYSTEM_CASH balance

✅ **"FLOW-based scenarios must not cause SYSTEM_CASH balance changes"**
- **Compliance:** FLOW scenarios work through contribution deltas, not SYSTEM_CASH transfers

✅ **"Monthly surplus must not auto-accumulate into stock balances"**
- **Compliance:** Monthly surplus is explicitly excluded from asset roll-forward

### Scenario Invariants (from `INVARIANTS.md`)

✅ **"Invalid scenarios must fall back to baseline"**
- **Compliance:** Unaffordable scenarios return baseline unchanged

✅ **"Scenarios must not directly mutate Snapshot"**
- **Compliance:** Scenarios modify projection inputs only, not snapshot

### Flow vs Stock Invariants (from `INVARIANTS.md`)

✅ **"Flow and Stock semantics must remain distinct"**
- **Compliance:** Monthly surplus is FLOW, SYSTEM_CASH balance is STOCK

✅ **"No implicit conversion from Flow to Stock is allowed"**
- **Compliance:** Monthly surplus does NOT accumulate into SYSTEM_CASH

### Stop Condition Assessment

**Question:** Does surplus or unaffordable scenarios implicitly mutate SYSTEM_CASH or violate Cash/Scenario invariants?

**Answer:** **NO** — All invariants are satisfied. Monthly surplus does NOT mutate SYSTEM_CASH, and unaffordable scenarios fall back to baseline without mutation.

**Recommendation:** Proceed with implementation of negative surplus diagnostic handling and scenario affordability improvements.

---

## 10. Summary and Recommendations

### Key Findings

1. **Monthly surplus formula is clear:** `availableCash - assetContributions - liabilityReduction`
2. **Surplus does NOT flow into projection:** Projection engine operates on explicit contributions
3. **SYSTEM_CASH is NOT mutated:** Monthly surplus does NOT affect SYSTEM_CASH balance
4. **Scenarios are re-validated:** Affordability checked using current snapshot state
5. **Silent fallback behavior:** Unaffordable scenarios silently fall back to baseline
6. **Inconsistent negative surplus display:** Some screens show negative, others clamp to 0
7. **Two choke points identified:** Scenario application and surplus computation

### Recommendations

1. **Add `__DEV__` enforcement at Choke Point 1:**
   - Throw error if scenario is unaffordable in development
   - Log warning in production (backward compatibility)

2. **Improve negative surplus display consistency:**
   - Consider showing negative surplus in ProjectionResultsScreen
   - Or document why negative surplus is clamped in projection context

3. **Add user notification for unaffordable scenarios:**
   - Surface unaffordable scenario status to user
   - Consider invalidating or marking scenarios as inactive

4. **Improve validation coverage:**
   - Ensure all scenario types are validated consistently
   - Consider validating FLOW_TO_DEBT in ProjectionResultsScreen

5. **Add logging for negative surplus:**
   - Log negative surplus occurrences (not just in attribution)
   - Consider UI notification for persistent negative surplus

### Next Steps

1. Implement `__DEV__` enforcement at identified choke points
2. Improve negative surplus display consistency
3. Add user notification for unaffordable scenarios
4. Improve validation coverage
5. Add logging for negative surplus

---

**End of Audit Report**
