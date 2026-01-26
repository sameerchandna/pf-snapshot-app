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

## Phase 5 — Insights, Explanation & Visual Intuition

Turn projections into learning through observational insight and read-only interaction.
No optimisation, no advice, no user-driven assumption changes.

### Phase 5.1 — Financial Health Summary
- [x] Define structural health dimensions (income, expenses, assets, liabilities, time)
- [x] Generate neutral, descriptive statements (no scoring or judgement)
- [x] Derived read-only from Snapshot + Projection summaries

### Phase 5.2 — Interactive Projection Chart (Read-Only)
- [x] Draggable age cursor on projection chart
- [x] Live display of point-in-time values (assets, liabilities, net worth)
- [x] No modification of projection inputs
- [x] Immediate visual + numeric feedback only

### Phase 5.3 — Structural Chart Layers
- [x] Introduce semantic chart series identity (net worth / assets / liabilities)
- [x] Refactor chart rendering to use structured, addressable series
- [x] Preserve existing visuals (no UI change, no toggles)
- [ ] Optional breakdown layers where already available (contributions, growth) — deferred (not available as time-series)
- [x] No re-simulation or new assumptions

### Phase 5.4 — Key Moment Detection & Highlighting
- [x] Detect key projection events (baseline-only)
- [x] Visually annotate events using subtle dot markers
- [x] Attach moments to semantic chart series and coordinates
- [x] Enable explanation ↔ chart linking (no text yet)

### Phase 5.5 — Observational Hero Insights
- [x] Define insight templates (purely descriptive)
- [x] Activate only when conditions are met
- [x] Every insight must be visually provable on the chart
- [x] No recommendations, alternatives, or rankings

### Phase 5.6 — Savings Deep Dive (Read-Only)
- [ ] Dedicated savings breakdown screen
- [ ] Selectable savings asset from Snapshot
- [ ] Time-based balance projection
- [ ] Visual split between contributions and interest/growth
- [ ] Stacked charts using existing projection outputs
- [ ] Educational framing only

### Phase 5.7 — Mortgage Deep Dive (Read-Only)
- [ ] Dedicated mortgage breakdown screen
- [ ] Selectable liability from Snapshot
- [ ] Amortisation over time
- [ ] Explicit split between principal and interest
- [ ] Balance over time vs equity buildup
- [ ] Payoff moment highlighted visually

### Phase 5.8 — Explain-the-Chart Mode
- [ ] Optional overlay explaining how to read charts
- [ ] Labels for growth, contributions, and interest drag
- [ ] No interaction beyond toggling explanations

### Phase 5.9 — Insight ↔ Chart Linking
- [ ] Tapping insights highlights supporting chart regions
- [ ] Preserve chart context when navigating between screens
- [ ] Maintain read-only guarantees throughout

**Note:** User-driven assumption changes (sliders, editable what-if controls) are deferred to Phase 8.

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

---

## Phase 8 — Guided What-If & Scenario Exploration
- [ ] Savings what-if (contribution and rate changes via sliders)
- [ ] Mortgage what-if (overpayment, term, rate sensitivity)
- [ ] Scenario preview vs baseline comparison
- [ ] Explicit save / discard semantics
- [ ] Guardrails to prevent advice framing or optimisation bias
