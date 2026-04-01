# PF App — Roadmap
This file defines the allowed execution surface.
Only unchecked items may be worked on.
---

## Phase 0 — Governance (Locked, Complete)
- [x] Core documentation (SYSTEM, ARCHITECTURE, INVARIANTS)
- [x] Change protocol
- [x] Governance framework locked

## Phase 1 — System Stability
- [x] Snapshot mutation validation
- [x] Tolerance constants centralized
- [x] Scenario fallback audit and cleanup

## Phase 2 — Scenario Correctness
- [x] FLOW scenario affordability validation
- [x] Delta reconciliation assertions
- [x] Activation/rollback robustness

## Phase 3 — Projection & Attribution Integrity
- [x] Projection determinism verification
- [x] Attribution zero-reconciliation enforcement
- [x] Edge case diagnostics (negative surplus, paid-off liabilities)

## Phase 4 — UI System Foundation & Dark Mode Readiness
- [x] Theme system and color tokenization
- [x] Interactive state normalization
- [x] Dark mode verification

## Phase 5 — Insights, Explanation & Visual Intuition
- [x] 5.1: Financial health summary
- [x] 5.2: Interactive projection chart 
- [x] 5.3: Semantic chart series identity, structured rendering
- [x] 5.4: Key moment detection and highlighting 
- [x] 5.5: Observational hero insights 
- [x] 5.6: Balance Deep Dive (unified savings/mortgage explanation)
- [x] 5.7: Observational insights for Balance Deep Dive 
- [x] 5.8: Educational overlays (savings and mortgage education, optional toggles)
- [x] 5.9: Insight ↔ chart linking (visual feedback, read-only guarantees)

## Phase 6 — UI Clean Up
- [x] Theme tokenization and component primitives
- [x] Screen migrations and chart polish
- [x] Dark mode safety and validation screens

## Phase 8 — UI Fixes
- [x] Sign (+ / −) all numbers in Snapshot → Cash Flow  
- [x] Add semantic colors to Snapshot → Cash Flow borders  
- [x] Add icons for Snapshot rows  
- [x] Remove redundant sub-text from Snapshot cards  
- [x] Change Detailed Entry Interaction - add + Icon
- [x] Change Balance Sheet card structure  
- [x] Make Projected Cashflow same as Snapshot

## Phase 9 — List & Row Architecture Unification
- [x] Canonical component stack: EditableCollectionScreen → CollectionRowWithActions → SemanticRow → SwipeRowContainer → RowVisual
- [x] Row, List, AddEntry primitives defined and implemented
- [x] All editable collection screens migrated
- [x] Swipe coordination, locked/inactive/dimmed states unified across all screens
- [x] Legacy row implementations removed

---

## Phase 10 — Interpretation Layer + Projection Screen Restructure ✓

### Part A — Interpretation engine
- [x] 10.1: Build `insights/interpretProjection.ts` — pure function: ProjectionSummary + Expenses → InterpretationResult
  - Default insights (no goal needed): debt-free age, net worth trajectory, milestone ages (£100k–£1m), FI number (expenses x 25), retirement readiness (UK pension age 67)
  - Custom goal insights (if user changes defaults): on-track / off-track, gap calculation
- [x] 10.2: GoalConfig type — { type: 'fi' | 'netWorthMilestone' | 'retirementIncome', target, targetAge? }. Stored in profile. Defaults computed from snapshot.
- [x] 10.3: Goal editing UI — accessible from Goals section "Edit" button; Reset to defaults supported

### Part B — Projection screen restructure
- [x] 10.4: Interpretation summary card (hero position, above chart) — replaces Financial Health Summary
- [x] 10.5: Key moment annotations on chart (debt-free, milestones £100k–£1M)
- [x] 10.6: Remove quick scenarios from projection screen (moves to What If tab in Phase 11+)
- [x] 10.7: Collapse projected cashflow behind "Show details" toggle
- [x] 10.8: Collapse attribution behind "Show details" toggle
- [x] 10.9: Simplify visible balance sheet to 3 numbers (assets, liabilities, net worth)

---

## Phase 11 — Scenario Redesign (Make It Human) ✓
- [x] 11.1: Scenario template type: { question, description, kind, defaults }
- [x] 11.2: Create 5 presets: "Invest more each month", "Overpay my mortgage" (enabled); "Go part-time", "Have a baby", "Retire early" (coming soon)
- [x] 11.3: WhatIfPickerScreen — template cards, coming-soon badges, replaces Accounts tab
- [x] 11.4: ScenarioExplorerScreen — slider explorer + target picker + live mini-chart
- [x] 11.5: Comparison panel: baseline vs scenario outcome delta (net worth / assets / liabilities)
- [x] 11.6: Savings what-if: contribution and rate sliders (merged into single SAVINGS_WHAT_IF template)
- [x] 11.7: Mortgage what-if: overpayment, term, rate sensitivity (merged into single MORTGAGE_WHAT_IF template)
- [x] 11.8: Save / discard semantics (saves scenario, activates it, navigates back)
- [x] 11.9: Guardrails — no advice framing, no optimisation bias, affordability clamp

---

## Phase 12 — Retirement & Decumulation Simulation ✓
- [x] 12.1: Retirement age in ProjectionInputs (default 67, editable in Projection Settings)
- [x] 12.2: Engine: stop contributions and debt reduction after retirement age
- [x] 12.3: Engine: assets fund expense shortfall post-retirement (respects availability: immediate/locked/illiquid)
- [x] 12.4: Depletion detection: depletionAge in ProjectionSummary
- [x] 12.5: Retirement marker line on chart; depletion dot via key moments
- [x] 12.6: Integrate retirement insights into interpretation layer (RETIREMENT_START, PORTFOLIO_DEPLETED moments; depletionAge, portfolioLastsYears in result)

---

## Phase 13 — Problem Solver System (contextual gap solving)

### Domain foundations
- [x] 13.1: New ScenarioKinds: `CHANGE_RETIREMENT_AGE`, `REDUCE_EXPENSES`, `CHANGE_ASSET_GROWTH_RATE` — update `types.ts`, `delta.ts`, `validation.ts`, `applyScenarioToInputs.ts`

### Projection helpers + back-solve engine
- [x] 13.2: Extract `computeLiquidAssetsSeries` + `computeLockedAssetsSeries` from ProjectionResultsScreen → `projection/computeLiquidAssets.ts`; new `projection/detectProblems.ts`; new `projection/backSolve.ts` (binary-search back-solve for all 4 levers)

### UI: tappable warnings + ProblemSolverScreen
- [x] 13.3: `InterpretationCard` warnings become tappable (bridge gap, longevity gap); new `components/ProblemSolverModal.tsx` (modal lever UI with back-solved targets + live sliders); new `components/CustomSlider.tsx` (extracted)

### WhatIf tab expansion
- [x] 13.4: 2 new enabled templates (retire-at-age, spend-less); `ScenarioExplorerScreen` handles new kinds; `WhatIfPickerScreen` icon map updated; `docs/CODEBASE_MAP.md` synced

---

## Phase 14 — Navigation Redesign (complete — implemented in Phase 11)
- [x] 14.1: 4-tab structure: Snapshot / What If / Projection / Settings (implemented Phase 11)
- [x] 14.2: Scenario/explorer screens in What If tab (implemented Phase 11)
- [x] 14.3: Navigation stack cleanup (implemented Phase 11)

---

## Phase 15 — Release Readiness
- [ ] 15.1: Error and empty state audit
- [ ] 15.2: Performance pass
- [ ] 15.3: Profile switcher on Entry screen
- [ ] 15.4: Pre-release checklist
