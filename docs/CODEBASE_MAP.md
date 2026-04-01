# PF App — Codebase Map

Concrete implementation reference. For concepts see ARCHITECTURE.md, for rules see CLAUDE.md.

---

## Folder Structure

```
├── components/          UI components (reusable primitives)
│   ├── cashflow/        CashflowCardStack, CashflowCardWrapper, CashflowPrimaryCard, CashflowSubCard, CashflowHeroValue
│   ├── list/            List, Row, AddEntry, GroupedList, GroupedListSection
│   └── rows/            CollectionRowWithActions, SemanticRow, SwipeRowContainer, RowVisual
├── context/             SnapshotContext (central state provider)
├── domain/              Domain logic
│   ├── kpi/             KPI metric definitions and selection persistence
│   └── scenario/        Scenario types, delta mapping, validation
├── engines/             Core computation (projection, loan, attribution, selectors)
├── fixtures/            Shared test/debug profile fixtures
├── insights/            Interpretation engine (Phase 10)
├── persistence/         Storage, profile migration, export/import
├── projection/          Projection input building, scenario application, chart explanation
├── scenarioState/       Scenario persistence & profile-aware store
├── screens/             All app screens
├── ui/                  Theme, formatters, layout, spacing
│   ├── theme/           ThemeContext, theme.ts, useTheme.ts
│   └── utils/           getMutedBorderColor
├── validation/          Projection refactor validation
├── types.ts             Root type definitions
├── constants.ts         App-wide constants
└── navigation.tsx       Tab & stack navigator config
```

---

## Key Types (`types.ts`)

| Type | Purpose |
|------|---------|
| `IncomeItem` | Income entry (name, amount, isActive) |
| `ExpenseItem` | Expense with group assignment |
| `AssetItem` | Asset with balance, growth rate, availability flag |
| `LiabilityItem` | Liability/loan with rate, term, kind |
| `ContributionItem` | Monthly asset contribution |
| `LiabilityReductionItem` | Monthly debt payment |
| `ProjectionInputs` | Projection config: currentAge, endAge, retirementAge, inflationPct, monthlyDebtReduction |
| `SnapshotState` | Full financial snapshot (all items + projection inputs) |
| `GoalConfig` | Goal union: `'fi'` \| `'netWorthMilestone'` \| `'retirementIncome'` |
| `GoalState` | `{ goals: GoalConfig[] }` |
| `ProfileState` | Profile data: snapshotState + scenarioState + goalState + meta |
| `ProfilesState` | All profiles + activeProfileId |

---

## Navigation (`navigation.tsx`)

### Tabs
| Tab | Label | Root Screen |
|-----|-------|-------------|
| `SnapshotTab` | Snapshot | SnapshotScreen |
| `WhatIfTab` | What If | WhatIfPickerScreen |
| `ProjectionTab` | Projection | ProjectionResultsScreen |
| `SettingsTab` | Settings | SettingsScreen |

### Snapshot Stack
Snapshot → GrossIncomeDetail, PensionDetail, NetIncomeDetail, DeductionsDetail, ExpensesDetail, AvailableCashDetail, LiabilityReductionDetail, AssetContributionDetail, MonthlySurplusDetail, AssetsDetail, LiabilitiesDetail, LoanDetail, NetWorthDetail, BalanceDeepDive, **Report** (AccountsScreen)

### What If Stack (Phase 11)
WhatIfPicker → ScenarioExplorer, ScenarioManagement, ScenarioEditor

### Projection Stack
ProjectionResults → ProjectionSettings, ScenarioManagement, ScenarioEditor, GoalEditor, BalanceDeepDive

### Settings Stack
Settings → A3Validation, ProjectionRefactorValidation, SnapshotDataSummary

---

## Engines

### `engines/projectionEngine.ts`
- **Types:** `ProjectionEngineInputs`, `ProjectionSummary`, `ProjectionSeriesPoint`
- **Functions:** `computeProjectionSeries()`, `computeProjectionSummary()`, `computeSingleAssetTimeSeries()`, `computeSingleLiabilityTimeSeries()`
- **Helpers:** `annualPctToMonthlyRate()`, `deflateToTodaysMoney()`, `assertProjectionDeterminism()`

### `engines/loanEngine.ts`
- **Types:** `LoanInputs`, `LoanInit`, `LoanMonthResult`
- **Functions:** `initLoan()`, `stepLoanMonth()`

### `engines/computeA3Attribution.ts`
- **Type:** `A3Attribution`
- **Function:** `computeA3Attribution()`

### `engines/selectors.ts`
- **Income:** `selectGrossIncome()`, `selectPension()`, `selectNetIncome()`
- **Expenses:** `selectExpenses()`, `selectSnapshotExpenses()`, `selectLoanInterestExpense()`
- **Cash flow:** `selectAvailableCash()`, `selectMonthlySurplus()`, `selectMonthlySurplusWithScenario()`
- **Balance:** `selectAssets()`, `selectLiabilities()`, `selectNetWorth()`
- **Contributions:** `selectAssetContributions()`, `selectLiabilityReduction()`
- **Helpers:** `sumFlat()`, `sumAmountMonthly()`, `sumGrouped()`

---

## Projection Pipeline

| Step | File | Function |
|------|------|----------|
| 1. Snapshot → inputs | `projection/buildProjectionInputs.ts` | `buildProjectionInputsFromState()` |
| 2. Apply scenario | `projection/applyScenarioToInputs.ts` | `applyScenarioToProjectionInputs()` |
| 3. Run simulation | `engines/projectionEngine.ts` | `computeProjectionSeries()` / `computeProjectionSummary()` |
| 4. Interpret results | `insights/interpretProjection.ts` | `interpretProjection()` |
| 5. Chart explanation | `projection/generateChartExplanation.ts` | `generateChartExplanation()` |

---

## Interpretation Layer (`insights/interpretProjection.ts`)

- **Input:** ProjectionSeriesPoint[], ProjectionSummary, expenses, age range, GoalConfig[], retirementAge
- **Output:** `InterpretationResult` — headline, subline, trajectory, fiNumber, fiProgress, keyMoments[], goals[], retirementAge, depletionAge?, portfolioLastsYears?
- **Key Moments:** DEBT_FREE, NET_WORTH_POSITIVE, ASSETS_EXCEED_LIABILITIES, NET_WORTH_100K/250K/500K/1M, RETIREMENT_START, PORTFOLIO_DEPLETED
- **Goal Assessment:** status (`on_track` | `off_track` | `achieved`), achievedAge, gap

## Chart Explanation Layer (`projection/generateChartExplanation.ts`)

Separate from `interpretProjection` — generates plain-English narrative paragraphs describing each phase of the projection chart. No UI logic; rendering handled by caller.

- **Input:** `ProjectionEngineInputs`, `ProjectionSummary`, `netMonthlyIncome`, `totalMonthlyExpenses`, `ProjectionSeriesPoint[]`
- **Output:** `ExplanationParagraph[]` — `{ heading, body, kind?: 'warning' }`
- **Phases covered:** Pre-retirement growth, retirement switch, per-asset breakdown, depletion risk warning, locked asset unlock, mortgage payoff, surplus-not-tracked notice

---

## KPI System (`domain/kpi/`)

View-configuration layer for the "Your Projection" dashboard card. Persisted independently of SnapshotContext via AsyncStorage (key: `kpi_selection_v1`).

- **`kpiDefinitions.ts`** — `KpiId`, `KpiData`, `KpiDefinition`, `ALL_KPI_DEFINITIONS` (10 metrics), `DEFAULT_KPI_IDS` (3 defaults)
- **`kpiStorage.ts`** — `loadSelectedKpiIds()`, `saveSelectedKpiIds(ids)` — returns exactly 3 valid IDs, falling back to defaults if saved IDs reference removed metrics

### KpiData fields

`KpiData` bundles: `interpretation`, `projectionSummary`, `currentNetWorth`, `monthlySurplus`, `monthlyExpenses`, `liquidAssets` (immediate + unlocked locked assets at current age), `currentAge`, `endAge`, `bridgeGap?` (post-retirement gap between liquid depletion and next locked-asset unlock).

### KPI Metrics

| ID | Label | Description |
|----|-------|-------------|
| `end_net_worth` | End net worth | Total assets minus liabilities at end of projection |
| `fi_progress` | FI progress | Current net worth as % of FI number (expenses × 25) |
| `debt_free_age` | Debt-free | Age when all liabilities reach zero |
| `nw_at_retirement` | At retirement | Net worth at target retirement age |
| `asset_liab_crossover` | Breakeven age | Age when assets first exceed liabilities |
| `monthly_surplus` | Monthly surplus | Free cash after expenses, contributions, debt payments |
| `liquid_coverage` | Savings last | How long accessible savings (liquid + unlocked) cover current costs; shown as "X yrs · till age Y" |
| `wealth_multiplier` | Wealth × | Net worth multiplier from now to end of projection |
| `total_contributions` | You contribute | Total contributions over full projection period |
| `annual_expenses` | Annual expenses | Current monthly expenses scaled to yearly |

---

## Scenario System

### Domain (`domain/scenario/`)
- **types.ts:** `ScenarioKind` = `'FLOW_TO_ASSET'` | `'FLOW_TO_DEBT'`, `Scenario` union type, `BASELINE_SCENARIO_ID`
- **delta.ts:** `scenarioToDelta()` → `ProjectionInputDelta`
- **validation.ts:** `validateScenario()`, `isScenarioTargetValid()`
- **templates.ts (Phase 11):** `ScenarioTemplate` type, `SCENARIO_TEMPLATES[]` (5 presets), `getTemplateById()`

### State (`scenarioState/`)
- **scenarioStore.ts** — high-level API: `getScenarios()`, `saveScenario()`, `deleteScenario()`, `getActiveScenarioId()`, `setActiveScenarioId()`
- **scenarioProfileStore.ts** — profile-aware read/write
- **scenarioPersistence.ts** — AsyncStorage layer

### Screens
- **ScenarioManagementScreen** — list, activate, delete scenarios
- **ScenarioEditorScreen** — create/edit with kind selector, target picker, amount input

---

## Context (`context/SnapshotContext.tsx`)

`useSnapshot()` provides:
- `state` — current SnapshotState
- `profilesState` — all profiles
- `isProfileSwitching` — boolean, true during async profile switch (used to gate renders)
- Setters for all snapshot items (income, expenses, assets, liabilities, contributions, etc.)
- `setGoals()` — goal state mutation
- Profile management (create, switch, rename, delete, reset)
- Export/import

---

## Component Primitives

| Component | Purpose | File |
|-----------|---------|------|
| `DetailScreenShell` | Standard screen layout wrapper | `components/DetailScreenShell.tsx` |
| `ScreenHeader` | Top navigation bar | `components/ScreenHeader.tsx` |
| `SectionHeader` | Financial section divider | `components/SectionHeader.tsx` |
| `GroupHeader` | Structural grouping header | `components/GroupHeader.tsx` |
| `SectionCard` | Card wrapper for sections | `components/SectionCard.tsx` |
| `CollectionRowWithActions` | Row with swipe edit/delete | `components/rows/CollectionRowWithActions.tsx` |
| `ItemEditor` | Modal/inline item editing | `components/ItemEditor.tsx` |
| `InterpretationCard` | Projection headline card with KPI tiles, actionable warnings, and picker modal | `components/InterpretationCard.tsx` |
| `GoalsSection` | Goal assessment display | `components/GoalsSection.tsx` |
| `ControlBar` | Pill/icon filter controls | `components/ControlBar.tsx` |
| `Button` | Standard button | `components/Button.tsx` |
| `Icon` | Icon wrapper | `components/Icon.tsx` |

---

## Persistence (`persistence/`)

- **profileStorage.ts** — load/save profiles, goal validation
- **storage.ts** — low-level AsyncStorage wrapper
- **persistenceModel.ts** — storage schema
- **profileMigration.ts** — data migration across versions
- **exportImport.ts** — export/import infrastructure

KPI selection is persisted separately from the profile via `domain/kpi/kpiStorage.ts` (AsyncStorage key: `kpi_selection_v1`). It is not part of `ProfileState` and survives profile switches.

## Fixtures (`fixtures/`)

Shared test/debug profile fixtures used for in-app testing via "Load Test Profile" in Settings.

- **testProfile.ts** — exports `testProfile: ProfilesState` — Age 43, retiring at 50, with mortgage (£536k @ 2.79%, 31yr), ISA (£185k), Stocks Fund (£30k), Pension (£450k, unlocks 57), net income £8,200/mo, living expenses £3,000/mo

---

## UI Tokens

- **Formatters** (`ui/formatters.ts`): `formatCurrencyFull`, `formatCurrencyFullSigned`, `formatCurrencyCompact`, `formatCurrencyCompactSigned`, `formatPercent`
- **Layout** (`ui/layout.ts`): `layout.screenPadding`, `layout.sectionGap`, `layout.screenPaddingTop`
- **Spacing** (`ui/spacing.ts`): `spacing.xs`, `spacing.sm`, `spacing.md`, `spacing.lg`, `spacing.xl`
- **Theme** (`ui/theme/theme.ts`): `typography.*`, `radius.*`, color tokens via `useTheme()`
- **Charts:** Victory.js (`victory-native` v37.3.6) — VictoryChart, VictoryLine, VictoryArea, VictoryScatter, VictoryAxis
