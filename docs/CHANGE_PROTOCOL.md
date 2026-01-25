# PF App — Change Protocol

This document defines how changes to the system are introduced and validated.

A change is any modification that alters system behavior, meaning, or interpretation.

---

## Change Classification

### Doctrine Change
A change that alters:
- System meaning or scope
- Architectural ownership or flow
- Invariants
- User-facing interpretation

Doctrine changes require updating one or more of:
- SYSTEM.md
- ARCHITECTURE.md
- INVARIANTS.md

Doctrine must be updated before implementation.

---

### Implementation Change
A change that alters:
- Code structure
- Performance
- UI presentation
- Internal refactors

Implementation changes must not alter system meaning.

---

## Mandatory Rules

- If behavior changes, doctrine must change first.
- If doctrine has not changed, behavior must not change.
- Any logic change must explicitly list affected invariants.
- Any new concept must be added to ARCHITECTURE.md before use.
- Ambiguity requires stopping and asking.

---

## Prohibited Changes

- Silent behavioral changes
- UI-driven data mutation
- Partial refactors that alter meaning
- Introducing new concepts without documentation
- Allowing Cursor to infer intent

---

## Definition of Done

A change is complete only when:
- All invariants are preserved
- Doctrine is updated if meaning changed
- Implementation matches documented intent
- Roadmap item (if applicable) is checked

---

Failure to follow this protocol invalidates the change.
