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

## Phase 4 — UI System Foundation
- [ ] Make Prjection Screen same look as Snapshot (Section Cards etc)
- [ ] UI audit (tokens, components, duplication)
- [ ] Central theme file (light/dark)
- [ ] Central component style definitions
- [ ] Remove component-local visual decisions

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
