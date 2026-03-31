# UI Structural Audit Report

**Date:** 2024  
**Scope:** List/table-based detail screens  
**Prototype Reference:** `ExpensesDetailScreen.tsx` (v2 row architecture)

---

## Executive Summary

This audit compares all row-based financial detail screens against the Expenses screen implementation, which serves as the visual and interaction prototype. The audit identifies structural differences, visual inconsistencies, interaction patterns, and potential invariant risks.

**Key Findings:**
- **1 screen** uses v2 row architecture (Expenses)
- **7 screens** use legacy FinancialItemRow architecture
- **1 screen** (Deductions) uses DetailScreenShell (non-editable, read-only)
- Hardcoded hex colors found in multiple screens
- All screens use SnapshotContext setters correctly (no direct mutations)
- No Flow vs Stock mixing detected

---

## ExpensesDetailScreen (Prototype)

**File:** `screens/ExpensesDetailScreen.tsx`

### Row Architecture
- **Component:** Custom `ExpenseRowWithActions` → `SemanticRow` → `SwipeRowContainer` → `RowVisual`
- **Type:** v2 row architecture (screen-local semantic row)
- **Pattern:** Replace-mode swipe (row translates, actions revealed)

### Swipe Behavior
- **Actions:** Edit + Delete (right swipe)
- **All actions visible:** Yes
- **Progress-based activation:** No (actions triggered by button press)
- **Screen-level gesture handling:** Yes (EditableCollectionScreen coordinates via `openSwipeableId`)

### Action Surface
- **Edit:** SwipeAction variant="edit" → opens editor
- **Delete:** SwipeAction variant="delete" → opens confirmation modal
- **Disable/Toggle:** ItemActiveCheckbox (leading slot in RowVisual)
- **Ordering:** Edit (left) → Delete (right) ✓

### Theming
- **Hardcoded hex colors:** None ✓
- **Theme token usage:** All colors via `theme.colors.*` ✓

### Mutation Path
- **Functions:** `setExpenses`, `setExpenseGroups` (from `useSnapshot()`)
- **SnapshotContext setters:** Yes, exclusively ✓
- **Inline mutation logic:** No ✓

### Deviations From Expenses
- N/A (this is the prototype)

### Invariant Risk
- **Snapshot immutability:** Low ✓ (uses SnapshotContext setters)
- **Flow vs Stock mixing:** None ✓ (expenses are Flow items)
- **UI-triggered implicit mutation:** None ✓

---

## AssetsDetailScreen

**File:** `screens/AssetsDetailScreen.tsx`

### Row Architecture
- **Component:** `FinancialItemRow` (legacy)
- **Type:** Legacy row architecture
- **Pattern:** Replace-mode swipe (default from EditableCollectionScreen)

### Swipe Behavior
- **Actions:** Edit + Delete (right swipe, via `renderSwipeActions`)
- **All actions visible:** Yes
- **Progress-based activation:** No (actions triggered by button press)
- **Screen-level gesture handling:** Yes (EditableCollectionScreen coordinates)

### Action Surface
- **Edit:** SwipeAction variant="edit" → opens editor (or external screen for loans)
- **Delete:** SwipeAction variant="delete" → opens confirmation modal
- **Disable/Toggle:** ItemActiveCheckbox (via `getItemIsActive` / `setItemIsActive`)
- **Ordering:** Edit (left) → Delete (right) ✓

### Theming
- **Hardcoded hex colors:** None in row rendering ✓
- **Theme token usage:** All colors via `theme.colors.*` ✓
- **Note:** Quick create card uses theme tokens ✓

### Mutation Path
- **Functions:** `setAssets`, `setAssetGroups` (from `useSnapshot()`)
- **SnapshotContext setters:** Yes, exclusively ✓
- **Inline mutation logic:** No ✓

### Deviations From Expenses
1. **Structural:** Uses `FinancialItemRow` instead of v2 `SemanticRow` stack
2. **Visual:** Same visual appearance (both use RowVisual under the hood)
3. **Interaction:** Same swipe behavior (replace-mode, Edit + Delete)
4. **Missing capabilities:** None (has active/inactive toggle, same as Expenses)

### Invariant Risk
- **Snapshot immutability:** Low ✓ (uses SnapshotContext setters)
- **Flow vs Stock mixing:** None ✓ (assets are Stock items, correctly handled)
- **UI-triggered implicit mutation:** None ✓

---

## LiabilitiesDetailScreen

**File:** `screens/LiabilitiesDetailScreen.tsx`

### Row Architecture
- **Component:** `FinancialItemRow` (legacy)
- **Type:** Legacy row architecture
- **Pattern:** Replace-mode swipe (default from EditableCollectionScreen)

### Swipe Behavior
- **Actions:** Edit + Delete (right swipe, via `renderSwipeActions`)
- **All actions visible:** Yes (Edit always shown, Delete only if not locked)
- **Progress-based activation:** No (actions triggered by button press)
- **Screen-level gesture handling:** Yes (EditableCollectionScreen coordinates)

### Action Surface
- **Edit:** SwipeAction variant="edit" → opens editor (or external LoanDetail screen for loans)
- **Delete:** SwipeAction variant="delete" → opens confirmation modal (disabled for loans)
- **Disable/Toggle:** ItemActiveCheckbox (via `getItemIsActive` / `setItemIsActive`)
- **Ordering:** Edit (left) → Delete (right) ✓

### Theming
- **Hardcoded hex colors:** **YES** ⚠️
  - Line 192: `backgroundColor: '#f8f8f8'` (template card)
  - Line 194: `borderColor: '#e0e0e0'` (template card)
  - Line 202: `color: '#222'` (template title)
  - Line 207: `color: '#666'` (template subtitle)
- **Theme token usage:** Row rendering uses theme tokens ✓

### Mutation Path
- **Functions:** `setLiabilities`, `setLiabilityGroups`, `setExpenses`, `setLiabilityReductions` (from `useSnapshot()`)
- **SnapshotContext setters:** Yes, exclusively ✓
- **Inline mutation logic:** **YES** ⚠️
  - `setLiabilitiesWithCleanup` (lines 77-96) performs cleanup of related expenses and liability reductions when loans are deleted
  - This is a **screen-level orchestration function**, not inline UI mutation
  - **Assessment:** Acceptable (boundary logic, not UI-triggered implicit mutation)

### Deviations From Expenses
1. **Structural:** Uses `FinancialItemRow` instead of v2 `SemanticRow` stack
2. **Visual:** Same visual appearance (both use RowVisual under the hood)
3. **Interaction:** Same swipe behavior (replace-mode, Edit + Delete)
4. **Missing capabilities:** None (has active/inactive toggle, same as Expenses)
5. **Special behavior:** Loans navigate to external `LoanDetail` screen (not inline edit)

### Invariant Risk
- **Snapshot immutability:** Low ✓ (uses SnapshotContext setters, cleanup is explicit)
- **Flow vs Stock mixing:** None ✓ (liabilities are Stock items, correctly handled)
- **UI-triggered implicit mutation:** None ✓ (cleanup is explicit and intentional)

---

## GrossIncomeDetailScreen

**File:** `screens/GrossIncomeDetailScreen.tsx`

### Row Architecture
- **Component:** `FinancialItemRow` (legacy)
- **Type:** Legacy row architecture
- **Pattern:** Replace-mode swipe (default from EditableCollectionScreen)

### Swipe Behavior
- **Actions:** Edit + Delete (right swipe, via `renderSwipeActions`)
- **All actions visible:** Yes
- **Progress-based activation:** No (actions triggered by button press)
- **Screen-level gesture handling:** Yes (EditableCollectionScreen coordinates)

### Action Surface
- **Edit:** SwipeAction variant="edit" → opens editor
- **Delete:** SwipeAction variant="delete" → opens confirmation modal
- **Disable/Toggle:** **NONE** ⚠️ (no `getItemIsActive` / `setItemIsActive` provided)
- **Ordering:** Edit (left) → Delete (right) ✓

### Theming
- **Hardcoded hex colors:** None ✓
- **Theme token usage:** All colors via `theme.colors.*` ✓

### Mutation Path
- **Functions:** `setGrossIncomeItems` (from `useSnapshot()`)
- **SnapshotContext setters:** Yes, exclusively ✓
- **Inline mutation logic:** No ✓

### Deviations From Expenses
1. **Structural:** Uses `FinancialItemRow` instead of v2 `SemanticRow` stack
2. **Visual:** Same visual appearance (both use RowVisual under the hood)
3. **Interaction:** Same swipe behavior (replace-mode, Edit + Delete)
4. **Missing capabilities:** **Active/inactive toggle missing** ⚠️

### Invariant Risk
- **Snapshot immutability:** Low ✓ (uses SnapshotContext setters)
- **Flow vs Stock mixing:** None ✓ (gross income is Flow, correctly handled)
- **UI-triggered implicit mutation:** None ✓

---

## NetIncomeDetailScreen

**File:** `screens/NetIncomeDetailScreen.tsx`

### Row Architecture
- **Component:** `FinancialItemRow` (legacy)
- **Type:** Legacy row architecture
- **Pattern:** Replace-mode swipe (default from EditableCollectionScreen)

### Swipe Behavior
- **Actions:** Edit + Delete (right swipe, via `renderSwipeActions`)
- **All actions visible:** Yes
- **Progress-based activation:** No (actions triggered by button press)
- **Screen-level gesture handling:** Yes (EditableCollectionScreen coordinates)

### Action Surface
- **Edit:** SwipeAction variant="edit" → opens editor
- **Delete:** SwipeAction variant="delete" → opens confirmation modal
- **Disable/Toggle:** **NONE** ⚠️ (no `getItemIsActive` / `setItemIsActive` provided)
- **Ordering:** Edit (left) → Delete (right) ✓

### Theming
- **Hardcoded hex colors:** None ✓
- **Theme token usage:** All colors via `theme.colors.*` ✓

### Mutation Path
- **Functions:** `setNetIncomeItems` (from `useSnapshot()`)
- **SnapshotContext setters:** Yes, exclusively ✓
- **Inline mutation logic:** No ✓

### Deviations From Expenses
1. **Structural:** Uses `FinancialItemRow` instead of v2 `SemanticRow` stack
2. **Visual:** Same visual appearance (both use RowVisual under the hood)
3. **Interaction:** Same swipe behavior (replace-mode, Edit + Delete)
4. **Missing capabilities:** **Active/inactive toggle missing** ⚠️

### Invariant Risk
- **Snapshot immutability:** Low ✓ (uses SnapshotContext setters)
- **Flow vs Stock mixing:** None ✓ (net income is Flow, correctly handled)
- **UI-triggered implicit mutation:** None ✓

---

## ContributionsDetailScreen

**File:** `screens/ContributionsDetailScreen.tsx`

### Row Architecture
- **Component:** `FinancialItemRow` (legacy)
- **Type:** Legacy row architecture
- **Pattern:** Replace-mode swipe (default from EditableCollectionScreen)

### Swipe Behavior
- **Actions:** Edit + Delete (right swipe, via `renderSwipeActions`)
- **All actions visible:** Yes
- **Progress-based activation:** No (actions triggered by button press)
- **Screen-level gesture handling:** Yes (EditableCollectionScreen coordinates)

### Action Surface
- **Edit:** SwipeAction variant="edit" → opens editor (with asset picker)
- **Delete:** SwipeAction variant="delete" → opens confirmation modal
- **Disable/Toggle:** **NONE** ⚠️ (no `getItemIsActive` / `setItemIsActive` provided)
- **Ordering:** Edit (left) → Delete (right) ✓

### Theming
- **Hardcoded hex colors:** None ✓
- **Theme token usage:** All colors via `theme.colors.*` ✓

### Mutation Path
- **Functions:** `setAssetContributions` (from `useSnapshot()`)
- **SnapshotContext setters:** Yes, exclusively ✓
- **Inline mutation logic:** **YES** ⚠️
  - `setItems` wrapper (lines 214-218) merges preTax contributions with postTax contributions
  - This is a **screen-level orchestration function**, not inline UI mutation
  - **Assessment:** Acceptable (boundary logic, preserves preTax contributions)

### Deviations From Expenses
1. **Structural:** Uses `FinancialItemRow` instead of v2 `SemanticRow` stack
2. **Visual:** Same visual appearance (both use RowVisual under the hood)
3. **Interaction:** Same swipe behavior (replace-mode, Edit + Delete)
4. **Missing capabilities:** **Active/inactive toggle missing** ⚠️
5. **Special behavior:** Custom name field (asset picker dropdown) instead of text input

### Invariant Risk
- **Snapshot immutability:** Low ✓ (uses SnapshotContext setters, merge is explicit)
- **Flow vs Stock mixing:** None ✓ (contributions are Flow, correctly handled)
- **UI-triggered implicit mutation:** None ✓ (merge is explicit and intentional)

---

## LiabilityReductionsDetailScreen

**File:** `screens/LiabilityReductionsDetailScreen.tsx`

### Row Architecture
- **Component:** `FinancialItemRow` (legacy)
- **Type:** Legacy row architecture
- **Pattern:** Replace-mode swipe (default from EditableCollectionScreen)

### Swipe Behavior
- **Actions:** Edit + Delete (right swipe, via `renderSwipeActions`)
- **All actions visible:** Yes (Edit always shown, Delete disabled for locked items)
- **Progress-based activation:** No (actions triggered by button press)
- **Screen-level gesture handling:** Yes (EditableCollectionScreen coordinates)

### Action Surface
- **Edit:** SwipeAction variant="edit" → opens editor
- **Delete:** SwipeAction variant="delete" → opens confirmation modal (disabled for loan overpayments)
- **Disable/Toggle:** **NONE** ⚠️ (no `getItemIsActive` / `setItemIsActive` provided)
- **Ordering:** Edit (left) → Delete (right) ✓

### Theming
- **Hardcoded hex colors:** None ✓
- **Theme token usage:** All colors via `theme.colors.*` ✓

### Mutation Path
- **Functions:** `setLiabilityReductions` (from `useSnapshot()`)
- **SnapshotContext setters:** Yes, exclusively ✓
- **Inline mutation logic:** **YES** ⚠️
  - `setItems` wrapper (lines 89-93) filters out `loan-principal:` items
  - This is a **screen-level orchestration function**, not inline UI mutation
  - **Assessment:** Acceptable (boundary logic, defensive cleanup)

### Deviations From Expenses
1. **Structural:** Uses `FinancialItemRow` instead of v2 `SemanticRow` stack
2. **Visual:** Same visual appearance (both use RowVisual under the hood)
3. **Interaction:** Same swipe behavior (replace-mode, Edit + Delete)
4. **Missing capabilities:** **Active/inactive toggle missing** ⚠️
5. **Special behavior:** Filters out legacy `loan-principal:` items (defensive cleanup)

### Invariant Risk
- **Snapshot immutability:** Low ✓ (uses SnapshotContext setters, filtering is explicit)
- **Flow vs Stock mixing:** None ✓ (liability reductions are Flow, correctly handled)
- **UI-triggered implicit mutation:** None ✓ (filtering is explicit and intentional)

---

## DeductionsDetailScreen

**File:** `screens/DeductionsDetailScreen.tsx`

### Row Architecture
- **Component:** **N/A** (read-only screen, no rows)
- **Type:** `DetailScreenShell` (non-editable)
- **Pattern:** N/A

### Swipe Behavior
- **Actions:** N/A (read-only)
- **All actions visible:** N/A
- **Progress-based activation:** N/A
- **Screen-level gesture handling:** N/A

### Action Surface
- **Edit:** N/A
- **Delete:** N/A
- **Disable/Toggle:** N/A
- **Ordering:** N/A

### Theming
- **Hardcoded hex colors:** **YES** ⚠️
  - Line 95: `backgroundColor: '#f8f8f8'` (block)
  - Line 97: `borderColor: '#e0e0e0'` (block)
  - Line 105: `color: '#444'` (block title)
  - Line 110: `color: '#333'` (text)
  - Line 116: `color: '#000'` (result)
  - Line 120: `color: '#666'` (caption)
- **Theme token usage:** Partial (some colors hardcoded)

### Mutation Path
- **Functions:** None (read-only screen)
- **SnapshotContext setters:** N/A
- **Inline mutation logic:** N/A

### Deviations From Expenses
1. **Structural:** **Completely different architecture** (DetailScreenShell vs EditableCollectionScreen)
2. **Visual:** Different (calculation blocks vs row list)
3. **Interaction:** N/A (read-only)
4. **Missing capabilities:** All editing capabilities (by design, this is a derived/calculated value)

### Invariant Risk
- **Snapshot immutability:** N/A (read-only)
- **Flow vs Stock mixing:** None ✓ (deductions are Flow-derived, correctly calculated)
- **UI-triggered implicit mutation:** None ✓ (read-only)

---

## Summary of Deviations

### Structural Deviations

| Screen | Row Component | Architecture |
|--------|--------------|-------------|
| Expenses | ExpenseRowWithActions → SemanticRow | v2 (prototype) |
| Assets | FinancialItemRow | Legacy |
| Liabilities | FinancialItemRow | Legacy |
| GrossIncome | FinancialItemRow | Legacy |
| NetIncome | FinancialItemRow | Legacy |
| Contributions | FinancialItemRow | Legacy |
| LiabilityReductions | FinancialItemRow | Legacy |
| Deductions | N/A (read-only) | DetailScreenShell |

### Visual Deviations

| Screen | Hardcoded Colors | Theme Tokens |
|--------|-----------------|--------------|
| Expenses | None ✓ | All ✓ |
| Assets | None ✓ | All ✓ |
| Liabilities | **4 instances** ⚠️ | Partial |
| GrossIncome | None ✓ | All ✓ |
| NetIncome | None ✓ | All ✓ |
| Contributions | None ✓ | All ✓ |
| LiabilityReductions | None ✓ | All ✓ |
| Deductions | **6 instances** ⚠️ | Partial |

### Interaction Deviations

| Screen | Swipe Actions | Active/Inactive Toggle | Special Behavior |
|--------|---------------|----------------------|------------------|
| Expenses | Edit + Delete ✓ | Yes ✓ | None |
| Assets | Edit + Delete ✓ | Yes ✓ | Navigate to BalanceDeepDive |
| Liabilities | Edit + Delete ✓ | Yes ✓ | Navigate to LoanDetail (loans) |
| GrossIncome | Edit + Delete ✓ | **No** ⚠️ | None |
| NetIncome | Edit + Delete ✓ | **No** ⚠️ | None |
| Contributions | Edit + Delete ✓ | **No** ⚠️ | Asset picker (custom name field) |
| LiabilityReductions | Edit + Delete ✓ | **No** ⚠️ | Filters loan-principal items |
| Deductions | N/A | N/A | Read-only (calculated) |

### Mutation Path Deviations

| Screen | SnapshotContext Setters | Inline Mutation Logic |
|--------|-------------------------|----------------------|
| Expenses | Yes ✓ | No ✓ |
| Assets | Yes ✓ | No ✓ |
| Liabilities | Yes ✓ | **Yes** ⚠️ (cleanup function) |
| GrossIncome | Yes ✓ | No ✓ |
| NetIncome | Yes ✓ | No ✓ |
| Contributions | Yes ✓ | **Yes** ⚠️ (merge function) |
| LiabilityReductions | Yes ✓ | **Yes** ⚠️ (filter function) |
| Deductions | N/A | N/A |

---

## Risk Flags

### ⚠️ Medium Risk

1. **Hardcoded hex colors in LiabilitiesDetailScreen** (4 instances)
   - Location: Template card styles (lines 192, 194, 202, 207)
   - Impact: Theme non-compliance, potential dark mode issues
   - Recommendation: Replace with theme tokens

2. **Hardcoded hex colors in DeductionsDetailScreen** (6 instances)
   - Location: Calculation block styles (lines 95, 97, 105, 110, 116, 120)
   - Impact: Theme non-compliance, potential dark mode issues
   - Recommendation: Replace with theme tokens

3. **Missing active/inactive toggle in 4 screens**
   - Screens: GrossIncome, NetIncome, Contributions, LiabilityReductions
   - Impact: Inconsistent UX, cannot disable items without deleting
   - Recommendation: Add `getItemIsActive` / `setItemIsActive` support

### ✅ Low Risk (Acceptable Patterns)

1. **Screen-level orchestration functions**
   - LiabilitiesDetailScreen: `setLiabilitiesWithCleanup` (cleanup of related expenses)
   - ContributionsDetailScreen: `setItems` wrapper (merge preTax/postTax)
   - LiabilityReductionsDetailScreen: `setItems` wrapper (filter loan-principal)
   - Assessment: These are boundary logic functions, not UI-triggered implicit mutations. They are explicit and intentional.

### ✅ No Risk

1. **All screens use SnapshotContext setters exclusively**
   - No direct Snapshot mutations detected
   - All mutations go through explicit setters

2. **No Flow vs Stock mixing detected**
   - All screens correctly handle their item types
   - No implicit conversions detected

3. **No UI-triggered implicit state mutations**
   - All state changes are explicit and intentional
   - No hidden side effects detected

---

## Doctrine Clarification Required

**None.** All detected patterns align with ARCHITECTURE.md and INVARIANTS.md:

- ✅ Snapshot mutations go through SnapshotContext setters
- ✅ No projection/scenario logic mutates Snapshot
- ✅ Flow and Stock semantics remain distinct
- ✅ Screen-level orchestration functions are explicit boundary logic (not implicit mutations)

---

## Recommendations (For Future Consideration)

1. **Migrate all screens to v2 row architecture** (SemanticRow stack)
   - Unifies interaction patterns
   - Simplifies swipe coordination
   - Enables consistent visual feedback

2. **Replace hardcoded hex colors with theme tokens**
   - LiabilitiesDetailScreen: Template card styles
   - DeductionsDetailScreen: Calculation block styles

3. **Add active/inactive toggle to all editable screens**
   - GrossIncomeDetailScreen
   - NetIncomeDetailScreen
   - ContributionsDetailScreen
   - LiabilityReductionsDetailScreen

4. **Standardize action ordering**
   - All screens currently use: Edit (left) → Delete (right) ✓
   - No changes needed (already consistent)

---

## Appendix: Component Hierarchy

### Expenses (v2 Prototype)
```
ExpenseRowWithActions
  └─ SemanticRow
      └─ SwipeRowContainer
          └─ RowVisual
```

### All Other Screens (Legacy)
```
FinancialItemRow
  └─ Swipeable (react-native-gesture-handler)
      └─ Pressable
          └─ RowVisual (implicit, via FinancialItemRow internals)
```

---

**End of Report**
