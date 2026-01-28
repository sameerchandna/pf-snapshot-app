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

### Phase 5.6 — Balance Deep Dive (Assets & Liabilities, Read-Only)

Balance Deep Dive is the single, canonical explanatory surface for balance-sheet items. There are no separate savings or mortgage screens. Savings and mortgages are rendered within the same screen using type-specific semantics. All interactions are observational and read-only.

#### Phase 5.6.1 — Screen Foundation and Navigation
- [x] Create BalanceDeepDive screen
- [x] Navigation wiring from Snapshot and Projection screens
- [x] Screen header and layout structure

#### Phase 5.6.2 — Unified Item Picker (Savings Assets + Mortgage Liabilities)
- [x] Combined item picker supporting both savings assets and mortgage/loan liabilities
- [x] Filter savings assets (exclude SYSTEM_CASH and inactive items)
- [x] Filter mortgage/loan liabilities (exclude inactive items)
- [x] Item metadata synthesis (type, rate, term, balance)
- [x] Graceful handling of missing or invalid items

#### Phase 5.6.3 — Read-Only Age Selection and Shared Interaction Model
- [x] Age selector (read-only, modal-based)
- [x] Visual cursor (vertical line) at selected age on charts
- [x] Chart gesture interaction (pan responder for age selection)
- [x] Shared interaction model for both savings and mortgage views
- [x] Age synchronization with projection settings

#### Phase 5.6.4 — Savings Asset Explanation (Contributions vs Growth, Reconciliation Enforced)
- [x] Reuse projection time-series for selected savings asset
- [x] Stacked area chart: contributions + growth layers
- [x] Numeric summary at selected age (starting balance, total contributions, total growth)
- [x] Reconciliation guard (endingBalance ≈ startingBalance + contributions + growth)
- [x] Defensive error handling and validation

#### Phase 5.6.5 — Mortgage / Loan Explanation (Amortisation, Principal vs Interest, Balance Over Time, Payoff Moment)
- [x] Mortgage-specific chart semantics (balance line + stacked principal/interest areas)
- [x] Principal vs interest breakdown visualization
- [x] Balance over time tracking
- [x] Payoff moment detection and visual annotation
- [x] Numeric summary at selected age (remaining balance, principal paid, interest paid)
- [x] Reconciliation guard (startingBalance ≈ remainingBalance + cumulativePrincipalPaid)
- [x] Truncation at payoff moment when detected

#### Phase 5.6.6 — Shared Balance Semantics (Visual Cursor, Metadata Synthesis, Truncation, Defensive Guards)
- [x] Visual cursor (vertical dashed line) synchronized across chart types
- [x] Metadata synthesis for both asset and liability types
- [x] Chart truncation logic (payoff moment handling)
- [x] Defensive guards against invalid data and reconciliation failures
- [x] Error states and placeholder handling

### Phase 5.7 — Observational Insights (Balance Deep Dive)

Insights are single-sentence, template-based statements that are visually provable on the chart. No advice, no scoring or ranking, no optimisation or nudging.

#### Phase 5.7.1 — Insight Framework
- [x] Single-sentence, template-based insight generation
- [x] Insights must be visually provable on the chart
- [x] Activation only when conditions are met
- [x] No advice, no ranking, no optimisation

#### Phase 5.7.2 — Savings-Specific Insights
- [x] Contribution dominance insights (when contributions exceed growth)
- [x] Growth acceleration insights (compounding effects)
- [x] Balance milestone insights (age-based thresholds)
- [x] All insights must reference chart-visible data

#### Phase 5.7.3 — Mortgage-Specific Insights
- [x] Interest drag insights (total interest vs principal)
- [x] Payoff timeline insights (time to zero balance)
- [x] Principal acceleration insights (when principal payments dominate)
- [x] All insights must reference chart-visible data

### Phase 5.8 — Educational Overlays (Explain the Balance)

Passive, optional overlays that explain balance-sheet concepts. No interaction beyond toggling explanations.

#### Phase 5.8.1 — Savings Education
- [x] Growth vs contributions explanation overlay
- [x] Compounding intuition overlay
- [x] Time-series interpretation guidance
- [x] Optional toggle to show/hide educational content

#### Phase 5.8.2 — Mortgage Education
- [x] Amortisation explanation overlay
- [x] Interest drag concept overlay
- [x] Principal acceleration explanation
- [x] Optional toggle to show/hide educational content

### Phase 5.9 — Insight ↔ Chart Linking
- [x] Tapping insights highlights supporting chart regions
- [x] Preserve read-only guarantees and chart context
- [x] Visual feedback linking insight text to chart data points

**Note:** User-driven assumption changes (sliders, editable what-if controls) are deferred to Phase 8.

---

## Phase 6 — Onboarding & Demo

Enable safe exploration of the app with demo data while preserving fast, frictionless access for existing users.
No signup required. No persistence in demo mode.

### 6.1 Demo Profiles (Static Data)
- [x] Define v1 demo personas:
  - Student / Early Career
  - Young Professional
  - Couple (Renting)
  - Family + Home
- [x] Create static demo profile configs
- [x] Fully populate Snapshot inputs (income, expenses, assets, liabilities)
- [x] Define minimal Projection settings (baseline only)

### 6.2 Demo Mode (Non-Persistent State)
- [x] Introduce demo vs user mode at root level
- [x] Demo mode uses in-memory state only (no persistence)
- [x] User mode continues to use existing persistence
- [x] Demo mode allows all existing functionality (edit, scenarios, navigation)
- [x] Demo state is discarded on reload

### 6.3 Entry / Launch Surface (Chart-First)
- [x] Create a new Entry screen outside bottom tab navigation
- [x] Entry screen always renders a hero projection chart
- [x] No empty states on app open

### 6.4 Demo Profile Selector UI
- [x] Add horizontal demo profile selector (icon-based)
- [x] Selecting a demo profile updates the projection chart live

### 6.5 Mode Toggle (User Data ↔ Demo / Explore)
- [x] Add toggle at top of Entry screen
- [x] If no user data exists:
  - User Data option disabled or greyed
  - Demo / Explore active by default
- [x] If user data exists:
  - User Data active by default
  - Demo / Explore remains accessible

### 6.6 Entry CTAs
- [x] CTA: "Go to Snapshot"
- [x] CTA: "Go to Projection"
- [x] Navigation respects current mode (demo or user)

### 6.7 Demo Mode Indicator
- [x] Display subtle indicator in demo mode:
  "Demo mode — changes won't be saved"
- [x] No modals, no blocking behaviour

### 6.8 Entry Insights (Optional)
- [x] Show 1–2 observational insights below the chart
- [x] Reuse Phase 5 insight engine
- [x] Read-only, no advice or optimisation

### 6.9 Existing User Entry Behaviour
- [x] When user data exists:
  - Entry chart reflects user projection data
  - Entry screen acts as a fast orientation surface
  - No onboarding or demo UI shown by default

### 6.10 UI Clean-Up & Polish (Non-Functional)

**Goal:**
Improve visual clarity, spacing, copy, and calmness.
No new logic, no new data, no engine changes.

**Status:** UI-only, optional, safe to stop at any point.

- [x] 6.10.1 Entry Screen visual hierarchy
  - spacing between toggle, selector, chart, CTAs
  - ensure chart is the dominant hero element

- [x] 6.10.2 Mode toggle styling
  - refine segmented control proportions
  - improve active vs disabled contrast

- [x] 6.10.3 Demo profile selector polish
  - consistent icon sizing and touch targets
  - clearer selected state without visual noise

- [ ] 6.10.4 Entry CTA clarity
  - review CTA labels and hierarchy
  - consistent spacing and alignment

- [ ] 6.10.5 Demo mode indicator
  - subtle inline text: "Demo mode — changes won't be saved"
  - no modal, no blocking UI

- [ ] 6.10.6 Header "Explore" action polish
  - confirm label ("Explore" vs "Home")
  - subtle visual weight and spacing

- [ ] 6.10.7 Copy & micro-text pass (optional)
  - neutral, descriptive language
  - no onboarding/tutorial tone

**Notes:**
- Signup and authentication are explicitly out of scope for Phase 6
- No UI restrictions or feature flags based on demo mode
- No changes to core projection, snapshot, or scenario engines

---

## Phase 7 — Release Readiness
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

## Phase 8 — Guided What-If & Scenario Exploration
- [ ] Savings what-if (contribution and rate changes via sliders)
- [ ] Mortgage what-if (overpayment, term, rate sensitivity)
- [ ] Scenario preview vs baseline comparison
- [ ] Explicit save / discard semantics
- [ ] Guardrails to prevent advice framing or optimisation bias
