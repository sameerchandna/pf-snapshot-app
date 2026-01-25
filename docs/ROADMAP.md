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
- [ ] FLOW_TO_ASSET scenario affordability validation
- [ ] FLOW_TO_DEBT scenario affordability validation
- [ ] Scenario delta reconciliation assertions
- [ ] Scenario activation / rollback robustness

---

## Phase 3 — Projection & Attribution Integrity
- [ ] Projection determinism verification
- [ ] Attribution zero-reconciliation enforcement
- [ ] Negative surplus diagnostic handling
- [ ] Paid-off liability edge case audit

---

## Phase 4 — UI System Foundation
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
