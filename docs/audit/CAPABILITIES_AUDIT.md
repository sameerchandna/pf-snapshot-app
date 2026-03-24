# Capabilities Audit: Simulation and Projection Engine

**Audit type:** Architectural capability audit (read-only).  
**References:** `/docs/ARCHITECTURE.md`, `/docs/INVARIANTS.md`.  
**Scope:** Snapshot domain model, projection engine, scenario/delta layer, attribution engine.  
**No code modified; no refactors; no new features.**

---

## 1. Snapshot Domain Model (Source of Truth)

### 1.1 Supported Asset Types

| Capability | Status | Notes |
|-----------|--------|--------|
| Generic assets | Supported | `AssetItem`: id, name, balance, groupId, optional annualGrowthRatePct, availability, isActive. |
| Per-asset growth rate | Supported | `annualGrowthRatePct` (percent); missing or invalid → 0% in projection. |
| Availability / liquidity | Stored only | `availability`: `immediate` \| `locked` \| `illiquid`; optional `unlockAge`, `availableFromDate`. Not used by projection engine; used in UI only (e.g. `isAssetLiquidAtAge` for chart filtering). |
| SYSTEM_CASH | Supported | Single system asset per profile; 0% growth, immediate; cannot be deleted/renamed; balance is user-defined stock. |
| Pre-tax vs post-tax contributions | Supported | `ContributionItem.contributionType`: `preTax` \| `postTax`; mapped to pension vs post-tax in attribution. |

### 1.2 Supported Liability Types

| Capability | Status | Notes |
|-----------|--------|--------|
| Standard (non-loan) liabilities | Supported | Balance, optional `annualInterestRatePct`; interest compounded monthly; missing rate → 0%. |
| Loan / mortgage | Supported | `kind: 'loan'`, `loanTemplate?: 'mortgage' \| 'loan'`, `remainingTermYears` (required for loans). Fixed monthly payment from amortisation; scheduled payment = expense; overpayments via scenario or (in snapshot) liabilityReductions. |
| Active/inactive | Supported | `isActive`; inactive excluded at projection boundary. |
| Paid-off lifecycle | Enforced | Once balance ≤ 0, no further interest/principal accrual; iteration skips paid-off items. |

### 1.3 Recurring Income Types

| Capability | Status | Notes |
|-----------|--------|--------|
| Gross income | Supported | `grossIncomeItems[]`: id, name, monthlyAmount. |
| Pension (as income category) | Supported | `pensionItems[]`: same shape; also pension contributions as `assetContributions` with `contributionType === 'preTax'`. |
| Net income | Supported | `netIncomeItems[]`: id, name, monthlyAmount. |
| Income at future dates | Not supported | No date or age on income items; all flows are constant monthly from snapshot. |

### 1.4 Recurring Expense Types

| Capability | Status | Notes |
|-----------|--------|--------|
| Grouped expenses | Supported | `expenseGroups[]`, `expenses[]` with groupId, monthlyAmount, isActive. |
| Loan-derived expenses | Supported | Full scheduled mortgage payment (interest + scheduled principal) treated as expense; may be materialised as `loan-interest:${id}` / `loan-principal:${id}` or derived from liabilities. |
| Expense deltas at future dates | Not supported | No scenario type for future expense changes; expenses not inputs to projection engine. |

### 1.5 Lump Sum Events

| Capability | Status | Notes |
|-----------|--------|--------|
| Lump sum in snapshot | Not supported | No one-off events or dated lump sums in SnapshotState. |
| Lump sum in projection | Reserved only | `scenarioTransfers` in ProjectionEngineInputs reserved for future STOCK scenarios (e.g. lump-sum transfers); not used by current FLOW scenarios. |

### 1.6 Inflation Modeling

| Capability | Status | Notes |
|-----------|--------|--------|
| Single inflation rate | Supported | `projection.inflationPct` (percent); applied when converting nominal projection outputs to today’s money. |
| Deflation | Applied at output | `deflateToTodaysMoney(value, inflationRatePct, elapsedMonths)`; nominal simulation, then deflate for summary and series. |
| Per-category inflation | Not supported | Single rate only. |

### 1.7 Return Assumptions

| Capability | Status | Notes |
|-----------|--------|--------|
| Per-asset annual return | Supported | `annualGrowthRatePct`; converted to monthly via `(1 + g)^(1/12) - 1`; missing → 0%. |
| Global return override | Not supported | No single override; only per-asset. |

### 1.8 Retirement Modeling

| Capability | Status | Notes |
|-----------|--------|--------|
| Pension contributions | Supported | Pre-tax contributions to pension assets; part of cashflow and attribution. |
| Retirement age / start date | Not supported | No retirement age or “switch to pension income” at a future date. |
| Retirement income switch | Not supported | Income items have no effective date or age; no modeled switch from salary to drawdown/pension. |

### 1.9 Tax Modeling

| Capability | Status | Notes |
|-----------|--------|--------|
| In projection engine | Not applied | Projection does not compute tax; only balances, contributions, and liability flows. |
| In attribution | Derived | `deriveMonthlyTaxes(snapshot)` = max(0, gross − pension − net); used for cashflow explanation only. |
| Explicit tax rules | Not supported | No marginal rates, bands, or explicit tax logic. |

---

## 2. Projection Capabilities

### 2.1 Time Granularity

| Capability | Status | Notes |
|-----------|--------|--------|
| Monthly granularity | Confirmed | Simulation loop is monthly (`monthIndex` 1..horizonMonths); contributions and growth applied each month. |
| Output sampling | Yearly | Series points every 12 months (`monthIndex % 12 === 0`); start point at month 0 always included. |

### 2.2 Recurring Asset Contributions

| Capability | Status | Notes |
|-----------|--------|--------|
| Monthly contributions | Supported | `assetContributionsMonthly`: per assetId, amountMonthly; applied each month then balance compounds. |
| Order of operations | Fixed | Contributions applied first, then growth on full balance (contributions compound with balance). |
| Deterministic order | Enforced | Contributions sorted by assetId, then amountMonthly before processing. |

### 2.3 Extra Mortgage / Loan Payments

| Capability | Status | Notes |
|-----------|--------|--------|
| Per-loan overpayments (baseline) | Not from snapshot | `buildProjectionInputsFromState` does not map `state.liabilityReductions` to `liabilityOverpaymentsMonthly`. Baseline projection has no per-loan overpayments from snapshot. |
| Per-loan overpayments (scenario) | Supported | FLOW_TO_DEBT scenario adds to `liabilityOverpaymentsMonthly`; merged into inputs by `applyScenarioToProjectionInputs`. |
| Aggregate non-loan debt paydown | Supported | `monthlyDebtReduction` from `state.projection`; applied proportionally to non-loan liabilities by balance. |

### 2.4 Lump Sum Injections

| Capability | Status | Notes |
|-----------|--------|--------|
| In simulation | Not supported | No one-off injections in the monthly loop. |
| scenarioTransfers | Reserved | Present on ProjectionEngineInputs for future STOCK scenarios; not used by FLOW scenarios. |

### 2.5 Expense Deltas

| Capability | Status | Notes |
|-----------|--------|--------|
| In projection | Not supported | Expenses are not inputs to the projection engine; no expense deltas or future expense changes in simulation. |

### 2.6 Income Changes at Future Dates

| Capability | Status | Notes |
|-----------|--------|--------|
| In projection | Not supported | Income not passed into projection; no effective date or age on income items; no future income change events. |

### 2.7 Asset Liquidation Logic

| Capability | Status | Notes |
|-----------|--------|--------|
| In engine | Not supported | Engine does not sell or liquidate assets; no withdrawal or drawdown from assets. |
| Availability | UI only | `availability` (locked/illiquid/unlockAge) used for display (e.g. which assets count in charts at a given age), not for engine logic. |

### 2.8 Retirement Income Switch

| Capability | Status | Notes |
|-----------|--------|--------|
| In projection | Not supported | No modeled switch from employment income to retirement income at an age or date. |

### 2.9 Withdrawal Modeling

| Capability | Status | Notes |
|-----------|--------|--------|
| In projection | Not supported | No withdrawals or drawdowns; only positive contributions to assets. |

---

## 3. Scenario / Delta Layer

### 3.1 Deltas Without Mutating Snapshot

| Question | Answer |
|----------|--------|
| Can deltas be applied without mutating Snapshot? | Yes. `applyScenarioToProjectionInputs(baseline, scenario, snapshotState)` returns new ProjectionEngineInputs; Snapshot is read-only (used only for affordability and target validation). |
| What is mutated? | Nothing in Snapshot. Only a new inputs object is produced; projection runs on that. |

### 3.2 Delta Application Semantics

| Capability | Status | Notes |
|-----------|--------|--------|
| Scenario kinds | FLOW_TO_ASSET, FLOW_TO_DEBT | FLOW_TO_ASSET: add to `assetContributionsMonthly` for one assetId. FLOW_TO_DEBT: add to `liabilityOverpaymentsMonthly` for one liabilityId. |
| Baseline | No-op | BASELINE_SCENARIO_ID or undefined → baseline inputs returned unchanged. |
| Merge rule | Additive | Existing entry for same assetId/liabilityId: amountMonthly increased; else new entry appended. |
| FLOW scenarios and SYSTEM_CASH | Guarded | FLOW scenarios must not add contributions to SYSTEM_CASH; __DEV__ guardrail in applyScenarioToProjectionInputs. |

### 3.3 Multiple Deltas Stacking

| Question | Answer |
|----------|--------|
| Can multiple deltas stack? | No. Only one scenario is active at a time (`activeScenarioId`). Application is baseline + one scenario’s deltas, not scenario A + scenario B. |

### 3.4 Determinism and Reversibility

| Question | Answer |
|----------|--------|
| Is delta application deterministic? | Yes. Same baseline + same scenario (+ same snapshot for validation) → same merged inputs. Merge and sort order are deterministic. |
| Is it reversible? | Yes, by selection. Reversibility = returning to baseline by selecting baseline (or clearing active scenario). No inverse-delta application; baseline is stored separately and unchanged. |
| Invalid scenario | Target missing or unaffordable or paid-off (FLOW_TO_DEBT) → fallback to baseline (unchanged). |

---

## 4. Attribution

### 4.1 Net Worth Attribution

| Capability | Status | Notes |
|-----------|--------|--------|
| Starting / ending net worth | Supported | startingNetWorth from snapshot (assets − liabilities); endingNetWorth from projectionSummary.endNetWorth. |
| Reconciliation | Enforced | reconciliation.rhs = endAssets − endLiabilities; reconciliation.delta = endNetWorth − rhs; __DEV__ throws if \|delta\| > ATTRIBUTION_TOLERANCE. |

### 4.2 Return vs Contribution Separation

| Capability | Status | Notes |
|-----------|--------|--------|
| Assets | Supported | assets.startingValue, assets.contributions (pension + postTax), assets.growth (residual: endingValue − startingValue − contributions), assets.endingValue. |
| Single-asset series | Supported | `computeSingleAssetTimeSeries`: balance, cumulativeContributions, cumulativeGrowth (residual) per year. |

### 4.3 Cashflow Attribution

| Capability | Status | Notes |
|-----------|--------|--------|
| Cashflow block | Supported | grossIncome, pensionContributions, taxes, livingExpenses, netSurplus, postTaxContributions, debtRepayment (overpayments only). |
| PV aggregation | Supported | Constant monthly amounts discounted over horizon (pvSumConstantMonthly) for income/expense/taxes. |
| Loan payments | From engine | totalScheduledMortgagePayment and totalMortgageOverpayments from projection summary; livingExpenses = baseLivingExpenses + totalScheduledMortgagePayment. |

### 4.4 Liability Interest Attribution

| Capability | Status | Notes |
|-----------|--------|--------|
| Debt block | Supported | interestPaid, principalRepaid, remainingDebt (from projection and loan amortisation). |
| Per-loan totals | Computed | pvLoanTotals for PV of interest/principal over horizon; loan lifecycle (payoff) respected. |
| Single-liability series | Supported | `computeSingleLiabilityTimeSeries`: balance, cumulativePrincipalPaid, cumulativeInterestPaid per year. |

### 4.5 Attribution Invariants

| Item | Status |
|------|--------|
| New object each time | Attribution returns a new object; no mutation of caller state. |
| Scenario-agnostic | A3 treats projection outputs as given; same formula for baseline or scenario. |
| Reconciliation to zero | Within ATTRIBUTION_TOLERANCE (e.g. £1); enforced in __DEV__. |

---

## 5. Invariant and Determinism Check

### 5.1 Snapshot and Projection Invariants (INVARIANTS.md)

| Invariant | Check |
|-----------|--------|
| Snapshot not mutated by projection or scenario | Confirmed. Projection clones inputs and mutates only internal loop state. Scenario application returns new inputs and only reads Snapshot for validation. |
| Projection derivable from Snapshot + assumptions | Confirmed. buildProjectionInputsFromState(state) → ProjectionEngineInputs; applyScenarioToProjectionInputs merges deltas into a copy of baseline. |
| Projection does not persist state | Confirmed. No persistence in projectionEngine or applyScenarioToProjectionInputs. |
| Projection recomputes deterministically from inputs | Confirmed. Defensive copy at entry; deterministic sort order for assets, liabilities, contributions, non-loans, loans; pure monthly loop; assertProjectionDeterminism available in __DEV__. |

### 5.2 Scenario Invariants

| Invariant | Check |
|-----------|--------|
| Scenarios only modify projection inputs | Confirmed. scenarioToDelta produces assetContributionsDelta / liabilityOverpaymentsDelta; merged into inputs only. |
| Scenarios reversible | Confirmed. By selecting baseline; baseline unchanged. |
| Only one scenario active | Confirmed. getActiveScenario returns a single scenario or undefined. |
| Invalid scenarios fall back to baseline | Confirmed. Target invalid, unaffordable, or paid-off (FLOW_TO_DEBT) → baseline returned. |
| Scenarios do not mutate Snapshot | Confirmed. Snapshot only read. |

### 5.3 Flow vs Stock and Cash Invariants

| Invariant | Check |
|-----------|--------|
| Monthly surplus does not auto-accumulate into stock | Confirmed. Surplus is flow-derived; SYSTEM_CASH balance not updated by surplus or FLOW scenarios. |
| FLOW scenarios do not change SYSTEM_CASH balance | Confirmed. FLOW deltas are contributions to non-cash assets or liability overpayments; __DEV__ guardrail blocks contribution to SYSTEM_CASH. |

### 5.4 Violations

**None identified.** Projection and scenario logic comply with ARCHITECTURE.md and INVARIANTS.md as inspected. No determinism or Snapshot-derivation violations found.

---

## 6. Constraint Summary

- **Baseline projection:** No per-loan overpayments from snapshot; `liabilityReductions` are not mapped to `liabilityOverpaymentsMonthly`. Only `monthlyDebtReduction` (non-loan, proportional) and FLOW_TO_DEBT scenario overpayments apply.
- **Income/expense:** Not inputs to the projection engine; no future income or expense changes in the simulation.
- **Lump sums / withdrawals / retirement switch:** Not modeled; `scenarioTransfers` reserved for future use.
- **Liquidation:** Engine does not sell or withdraw from assets; availability is for UI only.
- **Single active scenario:** Only one scenario applied at a time; deltas do not stack across multiple scenarios.

---

*End of capabilities audit.*
