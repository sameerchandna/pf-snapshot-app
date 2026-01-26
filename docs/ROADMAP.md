# PF App — Roadmap

This file defines the allowed execution surface.
Only unchecked items may be worked on.

---

## Phase 0 — Governance (Locked, Complete)
- [x] SYSTEM.md committed
- [x] ARCHITECTURE.md committed
- [x] INVARIANTS.md committed
- [x] ROLES.md committed
- [x] CHANGE_PROTOCOL.md committed

---

## Phase 1 — System Stability
- [x] Validate all snapshot mutation paths preserve invariants
- [x] Centralize tolerance constants
- [x] Audit scenario fallback logic
- [x] Remove legacy or unused scenario hooks

---

## Phase 2 — Scenario Correctness
- [x] FLOW_TO_ASSET scenario affordability validation
- [x] FLOW_TO_DEBT scenario affordability validation
- [x] Scenario delta reconciliation assertions
- [x] Scenario activation / rollback robustness

---

## Phase 3 — Projection & Attribution Integrity
- [x] Projection determinism verification
- [x] Attribution zero-reconciliation enforcement
- [x] Negative surplus diagnostic handling
- [x] Paid-off liability edge case audit

---

## Phase 4 — UI System Foundation & Dark Mode Readiness
- [x] Make Projection Screen same look as Snapshot (Section Cards etc)
- [x] UI audit (tokens, components, duplication)
- [x] Central theme file (light/dark)
- [x] Central component style definitions (Button v1)
- [x] Remove component-local visual decisions (components verified clean)

### Phase 4.1 — Screen Color Tokenization
- [x] Replace screen-level hardcoded colors with existing theme tokens
- [x] SnapshotScreen color safety (no redesign)
- [x] ProjectionResultsScreen color safety (no redesign)

### Phase 4.2 — Interactive State Normalization
- [x] Remove opacity-based pressed states in screens
- [x] Ensure pressed/selected states are theme-aware

### Phase 4.3 — Background & Container Hierarchy
- [x] Enforce bg.app vs bg.card usage in screens
- [x] Eliminate implicit light-mode background assumptions

### Phase 4.4 — Chart Color Strategy (Projection)
- [x] Centralize chart color palettes
- [x] Define light/dark-safe chart colors
- [x] Apply to ProjectionResultsScreen only

### Phase 4.5 — Dark Mode Verification
- [x] Enable system dark mode
- [x] SnapshotScreen dark mode smoke test
- [x] ProjectionResultsScreen dark mode smoke test
- [x] Log visual issues (no polish yet)

---

## Phase 5 — Insights & Guidance
- [ ] Financial health summary definition
- [ ] Observational nudges (non-prescriptive)
- [ ] Savings vs investment explainer
- [ ] Mortgage trade-off explainer

---

## Phase 6 — Onboarding & Demo
- [ ] Demo profiles
- [ ] Read-only demo edit mode
- [ ] Projection-first landing screen
- [ ] Signup gating

---

## Phase 7 — Release Readiness
- [ ] Error and empty state audit
- [ ] Performance pass
- [ ] Pre-release checklist
