# Row Architecture Limitations

**Status:** Current limitation blocking Phase 9 migration work  
**Date:** 2024  
**Related:** Phase 9 — List & Row Architecture Unification (ROADMAP.md)

---

## Summary

The canonical row architecture (`RowVisual` → `SwipeRowContainer` → `SemanticRow` → `Semantic*Row`) cannot currently replace `FinancialItemRow` due to missing capabilities required by all `EditableCollectionScreen`-based screens.

---

## Blocking Requirements

### 1. Swipeable Ref Coordination (All Screens)

**Requirement:**  
`EditableCollectionScreen` manages `swipeableRefs` to coordinate row behavior: when one row's swipe actions are revealed, all other rows must close their swipe actions.

**Current Implementation:**  
- `EditableCollectionScreen` maintains a `Map<string, Swipeable>` ref collection
- `GroupedList` passes `swipeableRef` callback to `renderRow`
- `FinancialItemRow` accepts and forwards `swipeableRef` callback

**Missing in Locked Architecture:**  
- `SwipeRowContainer` does not expose the internal `Swipeable` ref
- No mechanism exists to coordinate multiple rows' swipe states
- Without refs, "close others when one opens" behavior cannot be implemented

**Impact:**  
All screens using `EditableCollectionScreen` are blocked from migration.

---

### 2. Overlay Swipe Reveal Mode (Expenses Only)

**Requirement:**  
Expenses screen uses `swipeRevealMode="overlay"` where the row content remains visually fixed while actions slide underneath (counter-translation).

**Current Implementation:**  
- `FinancialItemRow` supports `swipeRevealMode: 'replace' | 'overlay'`
- Overlay mode uses `Animated.Value` to track swipe progress
- Row content counter-translates to maintain visual position

**Missing in Locked Architecture:**  
- `SwipeRowContainer` uses standard `Swipeable` (replace mode only)
- No overlay mode support
- No counter-translation mechanism

**Impact:**  
Expenses screen specifically blocked (in addition to coordination requirement).

---

## Affected Screens

All screens using `EditableCollectionScreen` are blocked:

1. **ExpensesDetailScreen** — Requires overlay mode + coordination
2. **AssetsDetailScreen** — Requires coordination
3. **GrossIncomeDetailScreen** — Requires coordination
4. **NetIncomeDetailScreen** — Requires coordination
5. **LiabilitiesDetailScreen** — Requires coordination
6. **ContributionsDetailScreen** — Requires coordination

---

## Current State

- ExpensesDetailScreen uses v2 architecture with a screen-local semantic row component (v2 prototype)
- `FinancialItemRow` remains the legacy row component used by all other `EditableCollectionScreen`-based screens
- Phase 9 migration work (ROADMAP.md) is partially unblocked via `renderRow` override prop
- ExpensesDetailScreen uses v2 architecture with intentional behavior differences:
  - Replace-mode swipe (no overlay)
  - No open-row coordination
  - Swipe reveals Edit + Delete actions (no row press)
- Other screens remain blocked until architecture supports:
  1. Swipeable ref exposure for coordination (if coordination is required)
  2. Overlay reveal mode (if overlay is required)

---

## V2 vs Legacy Boundary

**V2 Prototype:**
- ExpensesDetailScreen uses a screen-local semantic row component via `renderRow` override prop
- Intentionally accepts behavior differences (replace-mode, no coordination, swipe-to-reveal actions)
- Serves as canonical prototype for future migrations

**Legacy (All Other Screens):**
- AssetsDetailScreen, GrossIncomeDetailScreen, NetIncomeDetailScreen, LiabilitiesDetailScreen, ContributionsDetailScreen
- All use `FinancialItemRow` with full swipe coordination and overlay support
- Migration blocked until architecture supports required capabilities or behavior differences are accepted

**Migration Path:**
- `EditableCollectionScreen.renderRow` prop enables gradual migration
- Screens can opt into v2 architecture by providing custom renderer
- No coordination/overlay support in v2 path (intentional simplification)

## Notes

- This limitation does not affect screens that do not require swipe coordination
- The locked architecture (`SwipeRowContainer`/`SemanticRow`) is intentionally minimal
- ExpensesDetailScreen demonstrates v2 migration pattern (accepts behavior differences)
- Other screens can migrate when ready to accept v2 behavior or when architecture supports legacy requirements
