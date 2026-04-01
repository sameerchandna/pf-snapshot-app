# PF App — Architecture

This document describes how financial truth, simulation, and explanation flow through the system.

It reflects current system behavior and establishes shared language and boundaries for future change.

---

## Core State Model

### Profiles
The system maintains multiple local profiles.
Each profile is fully isolated and owns its own financial state.

A profile contains:
- Snapshot state
- Scenario state
- Profile metadata

Only one profile is active at a time.

---

### Snapshot (Source of Truth)

Snapshot represents the user's financial state at a point in time.

It includes:
- Income items
- Expense items
- Assets
- Liabilities
- User-defined balances and settings

Snapshot state:
- Is persisted locally
- Is mutated only through explicit SnapshotContext setters
- Is validated at boundaries
- Must always be internally consistent

Snapshot is the **single source of truth**.
No projection or scenario logic may mutate Snapshot.

---

### Projection (Derived Simulation)

Projection is a derived simulation of future outcomes.

Projection:
- Is computed from Snapshot plus assumptions
- Is ephemeral and never persisted
- Recomputes when Snapshot or active Scenario changes

Projection computation:
1. Snapshot → projection inputs
2. Projection inputs → monthly simulation
3. Simulation → time series and summary outputs

Projection owns **simulation only**, not truth.

---

### Scenarios (Projection Modifiers)

Scenarios modify projection inputs without mutating Snapshot.

Current behavior:
- Scenarios apply deltas to monthly flows
- Only one scenario may be active at a time
- Scenarios are reversible and comparative
- Invalid scenarios fall back to baseline

Scenario application occurs **before** projection simulation.
Scenario effects are visible only in Projection outputs.

---

### Attribution (Explanation Layer)

Attribution explains differences between outcomes.

Attribution:
- Is computed from Snapshot and Projection outputs
- Never mutates any state
- Produces a new explanation object on each computation

Attribution explains:
- Cashflow contribution
- Debt contribution
- Asset growth contribution

Explanation is observational, not prescriptive.

---

## Flow vs Stock Semantics

### Stock
- Represents balances at a point in time
- Examples: asset balances, liability balances

### Flow
- Represents movement over time
- Examples: income, expenses, contributions, repayments

Flows affect Stocks only through explicit, traceable rules.
No implicit conversion from Flow to Stock exists.

Monthly surplus is a **flow-derived diagnostic**, not an accumulating balance.

---

## Monthly Simulation Rules

- Asset contributions are applied monthly, then balances compound
- Asset growth compounds monthly from current balance
- Liability overpayments reduce balances after scheduled payments
- Loan amortization follows fixed monthly payment logic
- Paid-off liabilities cease accruing or compounding

All simulation operates on monthly granularity only.

### Retirement & Decumulation (Phase 12)

At `retirementAge` (default 67, editable in Projection Settings):
- Asset contributions stop (income has ceased)
- Discretionary debt reduction stops
- Living expenses + scheduled mortgage payments are withdrawn from assets
- Withdrawals are proportional by balance across withdrawable assets
- Asset availability governs withdrawability:
  - `immediate` — always withdrawable
  - `locked` with `unlockAge` — withdrawable once age >= unlockAge
  - `illiquid` — never withdrawable (e.g. property)
- Loan amortization continues (contractual obligation)
- Depletion is detected when all withdrawable assets reach zero
- `depletionAge` is recorded in `ProjectionSummary`

---

## Cash Semantics

### Available and Surplus Cash
- Available cash = net income minus expenses
- Monthly surplus = available cash minus monthly allocations

Surplus is informational only.
Unused surplus does not modify asset balances automatically.

Negative surplus indicates over-allocation and is surfaced diagnostically.

---

## Guards and Boundaries

The system enforces correctness through:
- Boundary validation of persisted state
- Explicit guards on scenario validity
- Filtering of inactive items at computation boundaries

Internal logic assumes Snapshot validity once validated.
Baseline states always exist and are restored if missing.

---

## Interpretation & Explanation

Two distinct post-simulation layers produce human-readable output from projection results. Neither mutates any state.

### Interpretation (`insights/interpretProjection.ts`)

Produces structured metrics and goal assessments from the projection series:
- Headline / subline / trajectory descriptor
- FI number and FI progress
- Key moments (debt-free age, net worth milestones, retirement start, portfolio depletion)
- Goal status (on_track / off_track / achieved) with achievedAge and gap

Output type: `InterpretationResult`. Used by `InterpretationCard` and the KPI system.

### Chart Explanation (`projection/generateChartExplanation.ts`)

Produces plain-English narrative paragraphs describing each phase of the projection chart:
- Pre-retirement growth phase
- Retirement switch (income stops, withdrawals begin)
- Per-asset breakdown of what's available at retirement
- Depletion risk warnings (with pension gap detection)
- Locked asset unlock events
- Mortgage payoff
- Untracked surplus notice

Output type: `ExplanationParagraph[]` — `{ heading, body, kind?: 'warning' }`. Rendered by `ProjectionResultsScreen`.

### KPI System (`domain/kpi/`)

View-configuration layer that lets users choose which 3 metrics to display as tiles on `InterpretationCard`. Selection is persisted independently via AsyncStorage (not part of `ProfileState`). KPI compute functions are pure — they derive formatted strings from `KpiData` (a bundle of `InterpretationResult`, `ProjectionSummary`, snapshot-derived values, `currentAge`, `endAge`, and an optional `bridgeGap` for the post-retirement accessibility gap).

`KpiData` also drives the actionable warnings section rendered below the KPI tiles:
- **Longevity gap** (error): total assets deplete before `endAge`
- **Bridge gap** (warning): accessible savings run out post-retirement before the next locked asset unlocks
- **Spending > income** (error): negative monthly surplus
- **Unallocated surplus** (warning): > £100/mo free cash not being deployed

`liquidAssets` in `KpiData` includes immediate assets plus locked assets whose `unlockAge` has already passed at `currentAge` — not immediate-only.

---

## Extension Boundaries

The architecture explicitly separates:
- Truth (Snapshot)
- Simulation (Projection)
- Modification (Scenarios)
- Explanation (Attribution, Interpretation, Chart Explanation)
- View Configuration (KPI selection)

This separation allows future extension without violating core ownership or mutation rules.

---

## Row Rendering Doctrine (v2)

`FinancialItemRow` has been removed. `EditableCollectionScreen` has no default row implementation — all collection screens must provide a `renderRow` override.

**Base primitive:** `CollectionRowWithActions` (`components/rows/CollectionRowWithActions.tsx`)  
**Swipe behavior:** Centralized in `SemanticRow` + `SwipeRowContainer`. No implicit UI behavior is allowed.

### renderRow pattern

Every editable collection screen provides its own row renderer via the `renderRow` prop on `EditableCollectionScreen`. This gives each screen full control over its row layout while keeping swipe/delete/edit behavior consistent.

```typescript
// Typical renderRow implementation
renderRow={(item, { onEdit, onDelete }) => (
  <CollectionRowWithActions
    label={item.name}
    value={formatCurrencyFull(item.amount)}
    onEdit={() => onEdit(item)}
    onDelete={() => onDelete(item.id)}
  />
)}
```

Screens that use this pattern: `AssetsDetailScreen`, `LiabilitiesDetailScreen`, `GrossIncomeDetailScreen`, `NetIncomeDetailScreen`, `ExpensesDetailScreen`, `ContributionsDetailScreen`, `LiabilityReductionsDetailScreen`, `PensionDetailScreen`.

Read-only screens (no editing) use `DetailScreenShell` directly without `EditableCollectionScreen`.
