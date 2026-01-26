# Projection Refactor Validation Summary

## Quick Status

| Test | Status | Action Required |
|------|--------|-----------------|
| **Aggregate Projection Determinism** | ⚠️ PENDING | Run `assertProjectionDeterminism()` |
| **Attribution Reconciliation** | ⚠️ PENDING | Check A3ValidationScreen |
| **Asset Helper Sanity** | ⚠️ PENDING | Run validation script |
| **Liability Helper Sanity** | ⚠️ PENDING | Run validation script |

---

## How to Validate

### Option 1: Use Existing A3ValidationScreen (Attribution Only)

1. Navigate to **Settings → A3 Validation**
2. Check the **Reconciliation** section
3. Verify `Delta (lhs - rhs)` is within tolerance (≤ £1.00)

**Expected**: Delta should be ≤ £1.00 (green)  
**If FAIL**: Attribution reconciliation is broken

---

### Option 2: Use Validation Script (Full Validation)

1. Import the validation function:
```typescript
import { validateProjectionRefactor } from './validation/projectionRefactorValidation';
import { useSnapshot } from './SnapshotContext';

// In a component or test:
const { state } = useSnapshot();
const result = validateProjectionRefactor(state);
console.log('Validation Result:', result);
```

2. Check the result:
```typescript
{
  aggregateProjection: 'PASS' | 'FAIL',
  attributionReconciliation: 'PASS' | 'FAIL',
  assetHelperSanity: 'PASS' | 'FAIL',
  liabilityHelperSanity: 'PASS' | 'FAIL',
  errors: [...]
}
```

---

### Option 3: Manual Determinism Check

```typescript
import { assertProjectionDeterminism, buildProjectionInputsFromState } from './projectionEngine';
import { useSnapshot } from './SnapshotContext';

const { state } = useSnapshot();
const inputs = buildProjectionInputsFromState(state);
const isDeterministic = assertProjectionDeterminism(inputs, 0.01);
console.log('Deterministic:', isDeterministic);
```

**Expected**: `true` (deterministic)  
**If FAIL**: Projection outputs differ between runs

---

## Code Review Findings

✅ **Logic Preserved**: All refactored code maintains exact same logic  
✅ **Order Preserved**: Asset/liability processing order unchanged  
✅ **State Management**: Ephemeral state handling unchanged  
⚠️ **Runtime Validation Required**: Code review cannot verify numerical identity

---

## Expected Results

If refactor is correct:
- ✅ `assertProjectionDeterminism()` returns `true`
- ✅ Attribution delta ≤ £1.00
- ✅ Asset helper: balances non-negative, contributions monotonic, growth reconciles
- ✅ Liability helper: balance decreases, interest stops after payoff

If refactor has issues:
- ❌ Determinism fails → Check `runMonthlySimulation` logic
- ❌ Attribution fails → Check aggregate projection outputs
- ❌ Helper sanity fails → Check single-item tracking logic

---

## Next Steps

1. **IMMEDIATE**: Run validation using one of the options above
2. **REVIEW**: Check `VALIDATION_REPORT.md` for detailed code review
3. **FIX**: If any test fails, review errors array for specific causes
