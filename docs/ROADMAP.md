# PF App — Roadmap

This file defines the allowed execution surface.
Only unchecked items may be worked on.

---

## Phase 0 — Governance (Locked, Complete)
- [x] Core documentation (SYSTEM, ARCHITECTURE, INVARIANTS)
- [x] Roles and change protocol
- [x] Governance framework locked

---

## Phase 1 — System Stability
- [x] Snapshot mutation validation
- [x] Tolerance constants centralized
- [x] Scenario fallback audit and cleanup

---

## Phase 2 — Scenario Correctness
- [x] FLOW scenario affordability validation
- [x] Delta reconciliation assertions
- [x] Activation/rollback robustness

---

## Phase 3 — Projection & Attribution Integrity
- [x] Projection determinism verification
- [x] Attribution zero-reconciliation enforcement
- [x] Edge case diagnostics (negative surplus, paid-off liabilities)

---

## Phase 4 — UI System Foundation & Dark Mode Readiness
- [x] Theme system and color tokenization
- [x] Interactive state normalization
- [x] Dark mode verification

---

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

---

## Phase 6 — Onboarding & Demo
- [x] Demo profiles and non-persistent mode
- [x] Chart-first entry screen with mode toggle
- [x] Entry CTAs and UI polish

---

## Phase 7 — UI Clean Up
- [x] Theme tokenization and component primitives
- [x] Screen migrations and chart polish
- [x] Dark mode safety and validation screens

---

## Phase 8 — UI Fixes

### Visual Semantics & Readability

- [x] Sign (+ / −) all numbers in Snapshot → Cash Flow  
  Clarify inflow vs outflow direction at a glance without relying on color alone.

- [ ] Add semantic colors to Snapshot → Cash Flow numbers  
  Use muted, non-judgmental tones to encode direction (outflows = dull warm/red, allocations/contributions = dull cool/green); avoid success/error framing.

- [ ] Standardise directional iconography for Snapshot rows  
  Reinforce flow semantics (inflow, outflow, allocation) consistently using arrows/icons.

---

### Density & De-cluttering

- [ ] Remove redundant sub-text from Snapshot cards  
  Eliminate explanatory copy for obvious rows (income, expenses, contributions) to reduce visual noise.

- [ ] Retain minimal annotation only for derived rows  
  Keep short, non-instructional hints for aggregates (e.g. "After deductions", "After expenses", "After allocations").

---

### Interaction Contract (Snapshot)

- [ ] Make Snapshot cards read-only (no tap navigation)  
  Cards represent financial truth only; remove implicit navigation to avoid accidental edits.

- [ ] Introduce explicit edit affordance via plus (➕) icon  
  All Snapshot data modification must be intentional and exposed through a single, consistent affordance.

- [ ] Place ➕ icon outside Snapshot cards (right-aligned)  
  Visually separate observation (card) from intervention (edit) to reinforce read vs change semantics.

- [ ] Scope ➕ to section-level editing only  
  One ➕ per editable card/section (e.g. Cash Flow, Balance Sheet); avoid row-level clutter.

- [ ] Define ➕ navigation targets explicitly  
  ➕ always routes to the relevant manage/edit screen for that section; no secondary meanings.

---

### Education Surface (Conceptual)

- [ ] Introduce 🧠 icon as the sole conceptual explanation affordance  
  🧠 always represents "understand the mental model", never help, tips, or actions.

- [ ] Add 🧠 icon at Snapshot section headers only  
  Apply to Cash Flow and Balance Sheet to keep explanations intentional and non-intrusive.

- [ ] Design lightweight 🧠 explanation modals  
  Each modal includes: one-sentence summary, simple flow diagram, and 2–4 clarifying bullets; no advice or actions.

---

### Balance Sheet Structure

- [ ] Change Balance Sheet card structure  
  Improve symmetry and scanability between Assets and Liabilities, reinforcing stock semantics.

---

## Phase 9 — Release Readiness
- [ ] Error and empty state audit
- [ ] Performance pass
- [ ] Pre-release checklist
- [ ] Profile Switcher (Entry Screen)
  - Allow switching between existing USER profiles directly from the Entry screen (similar visual pattern to Demo profiles)
  - Show the currently active profile and other available profiles
  - Include a subtle "+" affordance to create a new profile using the existing profile creation flow
  - This is a navigation and affordance change, not just visual polish
  - Must preserve existing profile invariants:
    * exactly one active profile
    * profile isolation
  - Must not introduce advice, nudging, or onboarding language
  - Visual language should align with demo profile selector but remain semantically distinct (user profiles ≠ demo profiles)
  - No persistence or logic changes beyond existing profile switching

---

## Phase 10— Guided What-If & Scenario Exploration
- [ ] Savings what-if (contribution and rate changes via sliders)
- [ ] Mortgage what-if (overpayment, term, rate sensitivity)
- [ ] Scenario preview vs baseline comparison
- [ ] Explicit save / discard semantics
- [ ] Guardrails to prevent advice framing or optimisation bias
