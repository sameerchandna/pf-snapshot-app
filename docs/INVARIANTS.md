# PF App — Invariants

The following invariants must always hold.
Violations indicate defects and must be rejected.

---

## Profile Invariants

- At least one profile must always exist.
- Exactly one profile is active at any time.
- Active profile state must always resolve.
- Baseline scenario must always exist for a profile.

---

## Snapshot Invariants (Source of Truth)

- Snapshot is the single source of financial truth.
- Snapshot must always be internally consistent.
- Snapshot mutations must be explicit and intentional.
- Snapshot must be validated at persistence boundaries.
- Snapshot must never be mutated by projection or scenario logic.

---

## Projection Invariants (Simulation Only)

- Projection must be fully derivable from Snapshot plus assumptions.
- Projection must never persist state.
- Projection must never mutate Snapshot.
- Projection recomputes deterministically from inputs.

---

## Scenario Invariants

- Scenarios may only modify projection inputs.
- Scenarios must be reversible.
- Only one scenario may be active at a time.
- Invalid scenarios must fall back to baseline.
- Scenarios must not directly mutate Snapshot.

---

## Attribution Invariants

- Attribution must never mutate any state.
- Attribution must explain differences between outcomes.
- Attribution outputs must reconcile to zero within tolerance.
- Missing or incomplete attribution is a defect.

---

## Flow vs Stock Invariants

- Flow and Stock semantics must remain distinct.
- Flows must affect Stocks only through explicit rules.
- No implicit conversion from Flow to Stock is allowed.
- Monthly surplus must not auto-accumulate into stock balances.

---

## Cash Invariants

- SYSTEM_CASH must always exist.
- Exactly one SYSTEM_CASH must exist per profile.
- SYSTEM_CASH must not be deleted or renamed.
- SYSTEM_CASH balance must not be implicitly modified.
- FLOW-based scenarios must not cause SYSTEM_CASH balance changes.
- Negative SYSTEM_CASH balance is only permitted through explicit stock-based operations.

---

## Validity & Guard Invariants

- Persisted state must be validated before use.
- Invalid persisted state must fall back to a safe baseline.
- Inactive items must be excluded from projection and attribution.
- Paid-off liabilities must not accrue or compound further.

---

If a proposed change violates any invariant, it must be rejected or the invariant must be updated first.
