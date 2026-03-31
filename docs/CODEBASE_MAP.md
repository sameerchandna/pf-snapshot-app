# PF App — Codebase Map

Concrete implementation reference. For concepts see ARCHITECTURE.md, for rules see CLAUDE.md.

---

## Folder Structure

```
├── components/          UI components (reusable primitives)
│   ├── cashflow/        CashflowCardStack, PrimaryCard, SubCard, HeroValue
│   ├── list/            List, Row, AddEntry, GroupedList, GroupedListSection
│   └── rows/            CollectionRowWithActions, SemanticRow, SwipeRowContainer, RowVisual
├── context/             SnapshotContext (central state provider)
├── domain/              Domain logic
│   └── scenario/        Scenario types, delta mapping, validation
├── engines/             Core computation (projection, loan, attribution, selectors)
├── insights/            Interpretation engine (Phase 10)
├── persistence/         Storage, profile migration, export/import
├── projection/          Projection input building & scenario application
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
| `ProjectionInputs` | Projection config: currentAge, endAge, inflationPct, monthlyDebtReduction |
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

---

## Interpretation Layer (`insights/interpretProjection.ts`)

- **Input:** ProjectionSeriesPoint[], ProjectionSummary, expenses, age range, GoalConfig[]
- **Output:** `InterpretationResult` — headline, subline, trajectory, fiNumber, fiProgress, keyMoments[], goals[]
- **Key Moments:** DEBT_FREE, NET_WORTH_POSITIVE, ASSETS_EXCEED_LIABILITIES, NET_WORTH_100K/250K/500K/1M
- **Goal Assessment:** status (`on_track` | `off_track` | `achieved`), achievedAge, gap

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
| `InterpretationCard` | Projection headline card | `components/InterpretationCard.tsx` |
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

---

## UI Tokens

- **Formatters** (`ui/formatters.ts`): `formatCurrencyFull`, `formatCurrencyFullSigned`, `formatCurrencyCompact`, `formatCurrencyCompactSigned`, `formatPercent`
- **Layout** (`ui/layout.ts`): `layout.screenPadding`, `layout.sectionGap`, `layout.screenPaddingTop`
- **Spacing** (`ui/spacing.ts`): `spacing.xs`, `spacing.sm`, `spacing.md`, `spacing.lg`, `spacing.xl`
- **Theme** (`ui/theme/theme.ts`): `typography.*`, `radius.*`, color tokens via `useTheme()`
- **Charts:** Victory.js (`victory-native` v37.3.6) — VictoryChart, VictoryLine, VictoryArea, VictoryScatter, VictoryAxis
