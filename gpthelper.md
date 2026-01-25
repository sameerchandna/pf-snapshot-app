# GPT Helper — PF Snapshot App
Last updated: 2026-01-18
Maintained by: Cursor

---

## 1. Purpose of This File

This file exists to help GPT reason about the current codebase.
It is descriptive, not authoritative.
It may lag or contain implementation detail.
It must not override PRODUCT_SPEC.md.

---

## 2. Design Tokens — HARD RULES (UI Guardrail)

All UI work MUST use the app's design token system.
Ad-hoc values are not allowed.

This applies to:
- Snapshot
- Projection
- Scenario Management
- Accounts
- All future screens and components

---

### Spacing
- Always use `spacing.*` or `layout.*`
- Never introduce raw numeric spacing values (e.g. `margin: 12`, `padding: 8`)

---

### Colors
- Always use semantic color tokens
- Use `snapshotColors.focusBlue` for the primary accent
- Do NOT hard-code hex colors unless:
  1. A semantic token does not exist, AND
  2. The token is introduced centrally (not inline in a component)

---

### Radii
- Reuse existing radius conventions
- Do not invent per-component `borderRadius` values

---

### Shadows
- Shadows may be defined inline ONLY if:
  - Applied to a single container surface
  - Not repeated across components
- If reused, promote the shadow to a shared token

---

### Enforcement
- Any change introducing hard-coded spacing or colors should be rejected
- Cursor prompts must explicitly state:
  "All spacing, colors, and layout must use existing design tokens"

This section is a hard guardrail, not a guideline.

IMPORTANT:
Do not refactor existing code.
This rule applies to all future UI changes only.

---

## 3. High-Level Code Structure

- **UI Layer**: React Native screens and components (`screens/`, `components/`)
- **Projection Engine**: Monthly forward simulation (`projectionEngine.ts`)
- **Scenario Engine**: Applies scenario deltas vs baseline (`projection/applyScenarioToInputs.ts`, `domain/scenario/`)
- **Loan Engine**: Amortisation and lifecycle handling (`loanEngine.ts`, `loanDerivation.ts`)
- **Attribution (A3)**: Reconciliation and diagnostics (`computeA3Attribution.ts`)
- **Persistence Layer**: AsyncStorage wrappers and state management (`storage.ts`, `SnapshotContext.tsx`, `scenarioState/`)

---

## 4. Key Modules & Responsibilities

### projectionEngine.ts
- Monthly forward simulation
- Deterministic, pure function
- Produces baseline projections
- Handles asset growth, liability interest, loan amortisation
- Inflation adjustment applied at end (today's money)
- **FLOW scenarios**: Work through contribution deltas (assetContributionsMonthly, liabilityOverpaymentsMonthly)
- **STOCK scenarios** (future): `scenarioTransfers` reserved for lump-sum transfers (not used by FLOW scenarios)
- **Cash (SYSTEM_CASH)**: Treated as pure STOCK asset (opening balance, growth, optional contributions)
- **FLOW scenario guardrail**: DEV-only assertion that FLOW scenarios do not mutate SYSTEM_CASH balance
- **Dev guardrails**: Asserts SYSTEM_CASH exists and never goes negative (for future STOCK scenarios)

### loanEngine.ts
- Pure loan amortisation engine
- Payment computed once at start
- Monthly interest and principal calculation
- Lifecycle handling (pre-payoff vs post-payoff)
- Payoff awareness (clamps to zero)

### projection/applyScenarioToInputs.ts
- Applies scenario deltas vs baseline
- Pure function, no side effects
- Merges deltas into baseline inputs
- **FLOW scenarios**: Work through contribution deltas only (no scenarioTransfers)
  - FLOW_TO_ASSET: Adds delta to `assetContributionsMonthly` (target must not be SYSTEM_CASH)
  - FLOW_TO_DEBT: Adds delta to `liabilityOverpaymentsMonthly`
- **FLOW scenario guardrail**: DEV-only assertion prevents FLOW scenarios from targeting SYSTEM_CASH
- **STOCK scenarios** (future): Will use `scenarioTransfers` for lump-sum transfers (reserved, not yet implemented)

### computeA3Attribution.ts
- Reconciliation and diagnostics
- Explains projection outcomes (cashflow vs debt vs asset growth)
- Validates reconciliation with tolerance checks
- Separates scheduled mortgage payments from overpayments
- **Optional projectionInputs parameter**: When provided (scenario case), sources contributions from projection inputs instead of snapshot
  - Enables correct attribution for FLOW_TO_ASSET scenarios (reads scenario contribution deltas)
  - Uses snapshot metadata to classify pension vs postTax contributions
  - Falls back to snapshot when not provided (baseline case)
- **Asset attribution**: `endingAssets = startingAssets + contributions + growth` (growth is residual)
- **Monthly Surplus**: FLOW concept (display-only residual, not part of asset roll-forward)
- **FLOW scenario guardrails**: 
  - FLOW_TO_ASSET: Validates asset contribution delta reflects scenario amount (accounts for inflation discounting)
  - FLOW_TO_DEBT: Validates overpayment delta > 0 and <= max possible (handles early loan payoff)
- **Dev guardrails**: Asserts SYSTEM_CASH exists with correct properties (0% growth, immediate, active)

### domain/scenario/
- **types.ts**: Scenario domain types (FLOW_TO_ASSET, FLOW_TO_DEBT)
- **delta.ts**: Converts scenarios to projection input deltas
- **validation.ts**: Scenario validation helpers

### scenarioState/
- **scenarioPersistence.ts**: AsyncStorage operations for scenarios
- **scenarioStore.ts**: Higher-level scenario API (CRUD, activation)

### selectors.ts
- Pure financial selectors
- Single source of truth for calculations
- Filters inactive items
- No formatting (formatting in `formatters.ts`)

### domainValidation.ts
- Boundary validation + migration
- Asset identity enforcement
- Availability migration
- Pension migration (legacy → assetContributions)
- Active/Inactive migration
- `emptySnapshotState()`: Creates initial state with SYSTEM_CASH asset (balance 0, 0% growth, immediate availability)

### projection/buildProjectionInputs.ts
- Builds `ProjectionEngineInputs` from `SnapshotState`
- Filters inactive items (assets, liabilities, contributions)
- Only includes contributions to active assets
- Canonical boundary for projection inputs
- **SYSTEM_CASH**: Treated as normal asset (uses actual balance from state.assets, no auto-seeding from monthlySurplus)
- **FLOW vs STOCK**: Cash balance is STOCK-only (user-set), monthlySurplus is FLOW-only (derived, display-only)

### loanDerivation.ts
- One-time loan state derivation as-of "today"
- Derives current balance from original loan contract (start date, original balance, term)
- Uses `loanEngine` step loop (no new formulas)
- Handles future start dates, elapsed months >= term, negative balance clamping

### storage.ts
- AsyncStorage wrappers for snapshot state (legacy, used during migration)
- Key: `@snapshot_state` (legacy, not deleted after migration)
- `loadSnapshotStateIfPresent()`: Returns null if key missing, validated state otherwise
- `loadSnapshotState()`: Always returns valid state (empty if missing/invalid)
- `saveSnapshotState()`: Best-effort save (never throws)

### systemAssets.ts
- **SYSTEM_CASH helpers**: `isSystemCash()`, `ensureSystemCash()`, `getUserEditableAssets()`
- **Migration logic**: Migrates cash-like user assets to SYSTEM_CASH on profile load
  - Detects assets with name "cash" (case-insensitive) OR groupId="assets-cash" with 0% growth and immediate availability
  - Sums balances into SYSTEM_CASH, removes migrated assets, cleans up contributions
  - Preserves net worth within tolerance
- **UI filtering**: `getUserEditableAssets()` filters out SYSTEM_CASH from edit/delete UI and pickers
- SYSTEM_CASH is always included in balances, net worth, and charts

### profileStorage.ts
- AsyncStorage wrappers for ProfilesState
- Key: `@profiles_state`
- `loadProfilesState()`: Always returns valid ProfilesState (empty with default profile if missing/invalid)
- `loadProfilesStateIfPresent()`: Returns null if key missing, validated ProfilesState otherwise
- `saveProfilesState()`: Best-effort save (never throws), updates `lastOpenedAt` for active profile
- `createBlankProfile(state, name)`: Creates a new blank profile
  - Generates unique profileId using `profile-${timestamp}-${random}` format
  - Initializes `snapshotState` with same initial state as fresh app install (template groups, no data)
  - Initializes `scenarioState` with baseline scenario only (no user-created scenarios)
  - Sets `meta.name` to trimmed input, `createdAt` and `lastOpenedAt` to current timestamp
  - Inserts new profile into `ProfilesState.profiles` (does NOT switch active profile)
  - Returns `{ profileId, updatedState }` on success, or `null` if name is invalid
  - Pure function: does not mutate input, does not persist (caller handles persistence)
  - Use case: Parents/clean-slate profiles that start with structure but no data
- `renameProfile(state, profileId, newName)`: Renames a profile
  - Updates `meta.name` to trimmed new name
  - Updates `meta.lastOpenedAt` to current timestamp
  - Returns updated ProfilesState or null on failure (invalid profileId or empty name)
  - Pure function: does not mutate input, does not persist
- `resetProfile(state, profileId)`: Resets a profile to blank state
  - Clears all data while preserving `profileId` and `meta.name`
  - Resets `snapshotState` to fresh install defaults (getInitialSnapshotState)
  - Resets `scenarioState` to baseline scenario only
  - Updates `meta.lastOpenedAt` to current timestamp
  - Returns updated ProfilesState or null on failure
  - Pure function: does not mutate input, does not persist
  - If resetting active profile, triggers cold restart when state change propagates
- `deleteProfile(state, profileId)`: Deletes a profile
  - Removes profile from `ProfilesState.profiles`
  - Guardrails: Cannot delete last remaining profile (returns null)
  - If deleting active profile: returns `newActiveProfileId` (most recently used remaining profile)
  - If deleting inactive profile: returns updated state only
  - Returns `{ updatedState, newActiveProfileId? }` or null on failure
  - Pure function: does not mutate input, does not persist
- `switchActiveProfile(state, profileId)`: Switches active profile
  - Updates `ProfilesState.activeProfileId` to `profileId`
  - Updates new active profile's `meta.lastOpenedAt` to current timestamp
  - Updates previous active profile's `meta.lastOpenedAt` to current timestamp
  - Returns updated ProfilesState (immutable, does not mutate input)
  - Returns null if profileId doesn't exist
  - Safe to call repeatedly with the same profileId (just updates timestamps)

### profileMigration.ts
- One-time migration from legacy single-profile state to ProfilesState
- `migrateLegacyStateToProfiles()`: Main migration function
  - Checks migration flag (`@profiles_migrated`) to prevent re-running
  - Checks for legacy state existence (`@snapshot_state`, `@pf.scenarios`, `@pf.activeScenarioId`)
  - Creates "My Profile" with migrated data
  - Persists ProfilesState and migration flag
  - Idempotent and safe to call multiple times

### persistenceModel.ts
- JSON serialization/deserialization
- Converts between `SnapshotState` and storage format

### constants.ts
- `ATTRIBUTION_TOLERANCE`: £1.00 (for attribution reconciliation checks)
- `UI_TOLERANCE`: £0.01 (for UI display and scenario delta checks)
- `SYSTEM_CASH_ID`: `'SYSTEM_CASH'` (system-defined Cash asset identifier)

### formatters.ts
- Centralized numeric formatting utilities
- **Full format** (Snapshot): `formatCurrencyFull()`, `formatCurrencyFullSigned()`
- **Compact format** (Projection): `formatCurrencyCompact()`, `formatCurrencyCompactSigned()` (uses K/M notation)
- **Percentage**: `formatPercent(value, options?)` (default 1 decimal, configurable)
- All formatting must come from this file (no local helpers)

### spacing.ts
- Primary spacing tokens: `zero`, `tiny` (4), `xs` (6), `sm` (8), `base` (12), `xl` (16), `section` (20), `huge` (24)
- DO NOT add new values - use `layout.ts` aliases for specific use cases

### layout.ts
- Semantic layout aliases mapping design intent to spacing values
- Screens should prefer `layout.*` aliases (e.g., `layout.screenPadding`, `layout.sectionGap`)
- Reusable components may use `spacing.*` tokens directly

### selectors.ts
- Pure financial selectors (single source of truth)
- No formatting, no validation (assume state is valid)
- Filters inactive items automatically
- **FLOW vs STOCK semantics**:
  - `selectMonthlySurplus()`: FLOW concept (availableCash - assetContributions - liabilityReduction)
  - `selectMonthlySurplusWithScenario()`: Scenario-adjusted monthly surplus for display (subtracts scenario amount)
  - Monthly surplus is display-only, does not auto-accumulate into cash balance
- Key selectors: `selectGrossIncome()`, `selectPension()`, `selectNetIncome()`, `selectExpenses()`, `selectLoanInterestExpense()`, `selectLoanPrincipalReduction()`, `selectAssets()`, `selectLiabilities()`, `selectNetWorth()`, `selectMonthlySurplus()`, `selectMonthlySurplusWithScenario()`

---

## 5. Important Screens

### Primary Screens
- **SnapshotScreen**: Today's state and flow (read-only, observational)
  - Shows cash balance as ASSET (STOCK) in Balance Sheet
  - Shows Monthly Surplus as FLOW signal in Cash Flow section
  - Displays scenario-adjusted monthly surplus when FLOW scenario is active (reduced by scenario amount)
  - Cash balance remains unchanged (STOCK concept, not affected by FLOW scenarios)
- **ProjectionResultsScreen**: Forward simulation results with scenario support
- **ScenarioManagementScreen**: List, activate, edit, delete scenarios
- **ScenarioEditorScreen**: Create/edit scenario UI

### Detail Screens
- **AssetsDetailScreen**: Asset balances and contributions (uses `getUserEditableAssets()` to filter out SYSTEM_CASH from edit/delete list)
- **LiabilitiesDetailScreen**: Liability balances and terms
- **ExpensesDetailScreen**: Monthly expenses breakdown
- **GroupedListDetailScreen**: Reusable component used by 9+ detail screens
- **SingleValueDetailScreen**: Single calculated value display
- **DetailScreenShell**: Reusable shell for calculated/derived screens

### Other Screens
- **ProjectionSettingsScreen**: Projection configuration
- **SettingsScreen**: App settings
- **ProfilesManagementScreen**: Profile management (create, switch, rename, reset, delete) - see detailed description below
- **AccountsScreen**: Account management
- **A3ValidationScreen**: Attribution diagnostics (dev-only)

### ProfilesManagementScreen Details
- **Interaction model**: Reuses exact pattern from Scenario Management
  - Selection via left circular indicator (radio-style) - ONLY tap target for switching
  - Row body is NOT tappable (display only)
  - Swipe gestures reveal secondary actions (right-to-left)
  - One gesture per surface: no mixed tap + swipe on same area
- **Row structure**:
  - Left: Circular selection indicator (filled = active, empty = inactive)
  - Center: Profile name (display only, not tappable)
  - Right: Swipe actions (Rename, Reset, Delete)
- **Swipe actions** (right-to-left, in order):
  1. Rename profile (gray background, edit icon)
  2. Reset profile (orange background, refresh icon)
  3. Delete profile (red background, trash icon)
- **Profile ordering**: By `meta.lastOpenedAt` (descending, most recent first)
- **Create profile**: "Add new profile" footer button, prompts for name, does NOT auto-switch
- **Reset profile**:
  - Clears all data (snapshotState → fresh install defaults, scenarioState → baseline only)
  - Preserves profile id and name
  - Requires explicit confirmation
  - If active profile: remains active (cold restart semantics apply)
  - If inactive profile: no immediate effect until switched
- **Delete profile**:
  - Requires confirmation
  - Cannot delete last remaining profile (guardrail)
  - If deleting active profile: auto-switches to most recently used remaining profile
  - If deleting inactive profile: no switch needed
- **Gesture & scroll rules**:
  - Fixed row height (44px, same as Scenario Management)
  - Only one swipe open at a time
  - Disable ScrollView scrolling while swipe is open
  - Close open swipe on scroll start, modal open, or navigation
- **State management**:
  - Reads `profilesState` directly from `SnapshotContext` (no AsyncStorage loading)
  - Renders profiles list from SnapshotContext's in-memory state
  - Uses `activeProfileId` from context for selection indicator
  - React re-renders automatically when SnapshotContext state changes
  - All mutations go through SnapshotContext: `createProfile`, `renameProfile`, `resetProfile`, `deleteProfile`, `switchProfile`
  - No delays, polling, or reloads - all updates are immediate via React re-renders
  - SnapshotContext is the single source of truth for all profile operations

### Navigation Structure (`navigation.tsx`)
- **Bottom tabs** (text-only, no icons): Snapshot, Accounts, Projection, Settings
- **Stack navigators** per tab (headers disabled app-wide, screens render own headers)
- **Snapshot stack**: Snapshot + 13 detail screens (income, expenses, cash, assets, liabilities, net worth)
- **Accounts stack**: Accounts + AssetsDetail, LiabilitiesDetail, LoanDetail
- **Projection stack**: ProjectionResults + ProjectionSettings, ScenarioManagement, ScenarioEditor
- **Settings stack**: Settings + Profiles, A3Validation, SnapshotDataSummary

---

## 7. Component Patterns & Reusability

### Shared Components (`components/`)
- **SectionHeader**: Primary financial section headers (16px, bold, blue #2F5BEA) - used in Snapshot/Projection
- **GroupHeader**: Structural/grouping headers (12px, bold, gray #666, uppercase) - used in Accounts/Settings
- **ScreenHeader**: Standard app-wide header with optional rightAccessory
- **DetailScreenShell**: Reusable shell for calculated/derived screens with help panel support
- **GroupedListDetailScreen**: Reusable component used by 9+ detail screens (list editing pattern)
- **AssumptionsPill**: Settings pill with scenario input support (used in Projection)
- **EducationBox**: Educational content blocks (legacy, minimal usage)
- **WhatIfScenario**: Scenario input component (legacy)

### Component Usage Patterns
- **9 screens** use `GroupedListDetailScreen`: Assets, Liabilities, Expenses, Liability Reductions, Asset Contributions, Gross Income, Net Income, Pension, Projection Settings
- **4 screens** use `DetailScreenShell`: Available Cash, Remaining Cash, Net Worth, Deductions
- All screens render their own headers (navigation headers disabled)

### Color System
- **Primary accent**: `snapshotColors.focusBlue` = `#2F5BEA` (defined in ProjectionResultsScreen, should be centralized)
- **Section headers**: Blue (#2F5BEA) for financial sections, gray (#666) for structural
- **Text colors**: Primary (#000), secondary (#888, #999), muted (#666)
- **Borders**: Light neutral (#f0f0f0)

---

## 8. State Management Patterns

### ProfilesState (V1)
- **Storage key**: `@profiles_state` in AsyncStorage
- **Migration flag**: `@profiles_migrated` (prevents re-running migration)
- **profileStorage.ts**: ProfilesState persistence layer
- **profileMigration.ts**: One-time migration from legacy single-profile state
- **ProfileState structure**:
  - `snapshotState`: Complete SnapshotState (unchanged, canonical)
  - `scenarioState`: `{ scenarios: Scenario[], activeScenarioId?: ScenarioId }`
  - `meta`: `{ name: string, createdAt: number, lastOpenedAt: number }`
- **ProfilesState structure**:
  - `activeProfileId`: ProfileId of currently active profile
  - `profiles`: Record<ProfileId, ProfileState>
- **Migration behavior**:
  - Detects absence of `@profiles_state` AND presence of legacy keys (`@snapshot_state`, `@pf.scenarios`, `@pf.activeScenarioId`)
  - Creates exactly one profile named "My Profile" with migrated data
  - Sets migrated profile as active
  - Runs once and never repeats (tracked by `@profiles_migrated` flag)
  - Legacy keys are NOT deleted after migration (safety net)
- **SYSTEM_CASH migration**: Runs on every profile load in `validateProfileState()` (idempotent)
  - Ensures SYSTEM_CASH exists (creates with balance 0 if missing)
  - Migrates cash-like user assets to SYSTEM_CASH (sums balances, removes assets, cleans contributions)
  - Preserves net worth within `ATTRIBUTION_TOLERANCE`

### SnapshotContext.tsx
- Internally manages `ProfilesState` (not directly `SnapshotState`)
- Exposes `SnapshotState` API for backward compatibility
- Exposes `profilesState: ProfilesState | null` for UI rendering (read-only)
- Routes all reads/writes via `activeProfile.snapshotState`
- Best-effort persistence (debounced ~500ms after hydration)
- `useSnapshot()` hook for components (returns `SnapshotState` from active profile and `profilesState` for UI)
- Hydration logic: Only overwrites state if no local edits occurred before hydration completes
- Migration gate: Runs `migrateLegacyStateToProfiles()` before hydration
- Migration: Auto-converts `pensionItems` → `assetContributions` with `contributionType: 'preTax'`
- State setters: `setGrossIncomeItems()`, `setNetIncomeItems()`, `setExpenses()`, `setAssets()`, `setLiabilities()`, etc.
- Registers ProfilesState provider with `scenarioStore` for profile-aware scenario operations
- **Single source of truth**: SnapshotContext owns ProfilesState in memory and is the authoritative source for all profile operations
- **Profile switching** (public API):
  - `switchProfile(profileId)`: Switches active profile by profileId
  - Updates in-memory `ProfilesState.activeProfileId` and new active profile's `meta.lastOpenedAt`
  - Updates previous active profile's `meta.lastOpenedAt` to current timestamp
  - Triggers cold restart behavior immediately: derived `state` changes, projection recomputes, scenarios reset
  - Persists via existing debounced save mechanism
  - Synchronous and deterministic (no polling, no AppState listeners, no periodic reloads)
  - Safe to call repeatedly with the same profileId
  - Profile switch detection: tracks `activeProfileId` changes and ensures clean state reset
- **Profile creation** (public API):
  - `createProfile(name)`: Creates a new blank profile with given name
  - Calls `createBlankProfile()` to generate profile with initial state
  - Updates ProfilesState with new profile (does NOT switch to it)
  - Persists via existing debounced save mechanism
  - Returns `profileId` for caller to switch if desired, or `null` on failure
- **Profile mutations** (public API):
  - `renameProfile(profileId, newName)`: Renames a profile, updates in-memory state, persists automatically
  - `resetProfile(profileId)`: Resets profile to blank state, updates in-memory state, persists automatically
  - `deleteProfile(profileId)`: Deletes profile, auto-switches if deleting active, updates in-memory state, persists automatically
  - All mutations update in-memory ProfilesState immediately, triggering React re-renders
  - No delays, polling, or reloads required - UI updates synchronously

### Scenario State (`scenarioState/`)
- **Storage keys** (legacy, still used as fallback): `@pf.scenarios`, `@pf.activeScenarioId` in AsyncStorage
- **Primary storage**: Active profile's `scenarioState` in ProfilesState
- **scenarioStore.ts**: Higher-level API (CRUD, activation, baseline fallback)
  - Uses ProfilesState when available (via provider/updater pattern)
  - Falls back to legacy AsyncStorage if ProfilesState not available
- **scenarioPersistence.ts**: Low-level AsyncStorage operations (legacy fallback)
- **scenarioProfileStore.ts**: Profile-aware scenario operations (works with ProfilesState)
- Only one active scenario at a time (baseline = no active scenario)

### State Shape (`types.ts`)
- **ProfilesState**: Top-level state container
  - `activeProfileId`: ProfileId
  - `profiles`: Record<ProfileId, ProfileState>
- **ProfileState**: Per-profile state container
  - `snapshotState`: Complete SnapshotState (unchanged, canonical)
  - `scenarioState`: `{ scenarios: Scenario[], activeScenarioId?: ScenarioId }`
  - `meta`: `{ name: string, createdAt: number, lastOpenedAt: number }`
- **SnapshotState**: Single source of truth (unchanged, canonical)
  - Income: `grossIncomeItems[]`, `pensionItems[]` (legacy), `netIncomeItems[]`
  - Expenses: `expenseGroups[]`, `expenses[]` (with `groupId`, `isActive`)
  - Assets: `assetGroups[]`, `assets[]` (with `balance`, `annualGrowthRatePct`, `availability`, `isActive`)
  - **SYSTEM_CASH**: System-defined asset with fixed identity (`id: 'SYSTEM_CASH'`), always present exactly once
    - Properties: 0% growth, immediate availability, always active
    - Cannot be deleted or renamed by user
    - Excluded from asset edit/delete UI and pickers (via `getUserEditableAssets()`)
    - Included in balances, net worth, and charts
  - Liabilities: `liabilityGroups[]`, `liabilities[]` (with `balance`, `annualInterestRatePct`, `kind`, `remainingTermYears`, `isActive`)
  - Contributions: `assetContributions[]` (with `assetId`, `amountMonthly`, `contributionType`), `liabilityReductions[]`
  - Projection: `projection` (currentAge, endAge, inflationPct, monthlyDebtReduction)

### Inactive Item Handling
- `isActive` defaults to `true` if missing (via migration)
- Selectors filter inactive items automatically
- Projection inputs only include active items
- Contributions to inactive assets are filtered out

---
## 9. Known Deviations from PRODUCT_SPEC

Currently empty. No intentional or temporary mismatches identified.

---
## 10. Recent Audits & Notes

### 2026-01-18
- Initial `gpthelper.md` created
- Codebase structure documented
- Key modules identified and described
- **SYSTEM_CASH implementation** (2026-01-18):
  - Added `SYSTEM_CASH_ID` constant and `systemAssets.ts` helpers
  - Profile migration: `ensureSystemCash()` runs on every load, migrates cash-like assets
  - Projection engine: Added `scenarioTransfers` for explicit SYSTEM_CASH → target asset transfers
  - A3 attribution: Removed `assets.cashAccumulation`, growth is pure residual
  - UI filtering: `getUserEditableAssets()` excludes SYSTEM_CASH from edit/delete UI and pickers
  - Guardrails: SYSTEM_CASH invariants checked in projection engine and A3 attribution
  - Spec update: PRODUCT_SPEC.md updated to reflect SYSTEM_CASH model
- Added ProfilesState (V1) support:
  - Profile domain types and storage layer
  - One-time migration from legacy state
  - SnapshotContext now uses ProfilesState internally
  - Scenario operations route through active profile's scenarioState
- Added internal active profile switching:
  - `switchActiveProfile()` function in profileStorage.ts (pure function, used internally)
  - Internal profile switching in SnapshotContext (not exposed in public API initially)
  - Cold restart behavior on profile switch: state rehydrates, projection recomputes, scenarios reset
  - Profile switch detection and clean state reset
- Fixed profile switching synchronization:
  - Exposed `switchProfile(profileId)` in SnapshotContext public API
  - SnapshotContext is now the single source of truth for active profile switching
  - ProfilesManagementScreen uses `SnapshotContext.switchProfile()` instead of writing directly to AsyncStorage
  - Switching is synchronous and deterministic (no polling, AppState listeners, or periodic reloads)
  - AsyncStorage is not used as a signaling mechanism for profile switching
- Added blank profile creation:
  - `createBlankProfile()` function in profileStorage.ts
  - Creates profiles with initial SnapshotState (template groups, no data) - same as fresh install
  - Initializes with baseline scenario only (no user-created scenarios)
  - Profile ID generation: `profile-${timestamp}-${random}` format
  - Internal `createProfileInternal()` in SnapshotContext (not exposed in public API)
  - Does NOT auto-switch to new profile (caller must explicitly switch if desired)
  - Enables parents/clean-slate use case
- Added Settings → Profiles UI (V1):
  - `ProfilesManagementScreen` reusing exact interaction pattern from Scenario Management
  - Selection via left circular indicator (radio-style), row body not tappable
  - Swipe actions: Rename, Reset, Delete (right-to-left)
  - Profile ordering by `lastOpenedAt` (descending, most recent first)
  - "Add new profile" action with name prompt
  - Reset profile: clears all data, preserves id and name, requires confirmation
  - Delete profile: requires confirmation, cannot delete last profile, auto-switches if deleting active
  - Same gesture rules: one swipe open at a time, scroll disabled while swipe open
  - All profile management functions in profileStorage.ts: `renameProfile`, `resetProfile`, `deleteProfile`
- Fixed profile mutation wiring:
  - Exposed `renameProfile`, `resetProfile`, `deleteProfile` in SnapshotContext public API
  - ProfilesManagementScreen uses SnapshotContext functions instead of direct AsyncStorage writes
  - All mutations update in-memory ProfilesState immediately
  - Fixed stale closure issue in swipe action handlers (memoized with correct dependencies)
- Fixed ProfilesManagementScreen rendering:
  - Exposed `profilesState` in SnapshotContext public API for UI rendering
  - Removed all AsyncStorage loading from ProfilesManagementScreen
  - Screen now renders directly from SnapshotContext's in-memory state
  - All mutations (create, rename, reset, delete) update UI immediately via React re-renders
  - No delays, polling, reloads, or navigation required - all updates are synchronous

---

## 11. Open Technical Constraints

- **Performance**: Projection engine runs monthly simulation (may be slow for long horizons)
- **Library limitations**: Uses AsyncStorage (local-only, no backend)
- **Temporary hacks**: None explicitly identified

---

## 12. Safe-to-Change Areas

- UI component styling (within spacing/layout system constraints)
- Detail screen implementations (using GroupedListDetailScreen pattern)
- Formatter utilities (as long as they remain centralized)
- Screen navigation structure
- Non-core utility functions

---

## 13. Do Not Touch Without Review

- **projectionEngine.ts**: Core projection logic (locked spec)
- **loanEngine.ts**: Loan amortisation (locked spec)
- **computeA3Attribution.ts**: Attribution reconciliation logic
- **PRODUCT_SPEC.md**: Canonical specification (only update when explicitly instructed)
- **Core invariants** (Section 3 of PRODUCT_SPEC.md): Snapshot read-only, projection deterministic, scenarios as deltas
- **LOCKED sections** in PRODUCT_SPEC.md: Product Philosophy, Core Invariants
- **Scenario Management V1**: Considered complete and locked
- **SYSTEM_CASH model**: System-defined asset with fixed identity, migration logic, and UI filtering (design-locked)
- **SYSTEM_CASH model**: System-defined asset with fixed identity, migration logic, and UI filtering (design-locked)

---

## 14. Change Log (Append-Only)

### 2026-01-18
- Initial `gpthelper.md` created
- Documented high-level code structure
- Documented key modules and responsibilities
- Listed important screens
- Identified safe-to-change areas and danger zones
- Added Design Tokens — HARD RULES section (UI guardrail for all future UI changes)
- Added comprehensive codebase details:
  - Expanded Key Modules section (buildProjectionInputs, loanDerivation, storage, constants, formatters, spacing, layout, selectors)
  - Added Component Patterns & Reusability section (shared components, usage patterns, color system)
  - Added State Management Patterns section (SnapshotContext, scenario state, state shape, inactive item handling)
  - Expanded Navigation Structure details
  - Added SYSTEM_CASH implementation details (2026-01-18):
    - `systemAssets.ts` module with helpers (`isSystemCash`, `ensureSystemCash`, `getUserEditableAssets`)
    - Profile migration runs on every load in `validateProfileState()` (idempotent, migrates cash-like assets)
    - Projection engine: `scenarioTransfers` reserved for future STOCK scenarios (lump-sum transfers), not used by FLOW scenarios
    - A3 attribution: Removed `assets.cashAccumulation`, growth is pure residual
    - UI filtering: All asset pickers use `getUserEditableAssets()` to exclude SYSTEM_CASH
    - Guardrails: SYSTEM_CASH invariants checked in projection engine and A3 attribution

### Cash Model Refactor (2026-01-XX)
- **Phase C1-C3: FLOW vs STOCK semantics clarification**:
  - Renamed `remainingCash` → `monthlySurplus` (FLOW concept)
  - Clarified FLOW (cashflow) vs STOCK (asset balance) semantics throughout codebase
  - Removed `SYSTEM_CASH` usage from FLOW scenarios (FLOW_TO_ASSET, FLOW_TO_DEBT)
  - FLOW scenarios now work exclusively through contribution deltas (assetContributionsMonthly, liabilityOverpaymentsMonthly)
  - Cash (SYSTEM_CASH) treated as pure STOCK asset (no auto-seeding from monthlySurplus)
- **Phase C4: Snapshot & UI alignment**:
  - Added `selectMonthlySurplusWithScenario()` selector for scenario-adjusted monthly surplus display
  - SnapshotScreen shows scenario-adjusted monthly surplus when FLOW scenario is active
  - Updated education copy to clarify monthly surplus does not auto-accumulate into cash
- **Phase C5: A3 Attribution cleanup**:
  - Gated `totalContributions` invariant for FLOW scenarios (only enforced for future STOCK scenarios)
  - Added FLOW-specific attribution checks (validates deltas reflect scenario amounts)
  - Updated guardrails to handle FLOW scenarios as reallocation (not money creation)
- **Phase C6: Cleanup & hardening**:
  - Updated PRODUCT_SPEC.md with FLOW vs STOCK semantics documentation
  - Removed stale deprecation comments
  - Verified no FLOW scenario paths reference SYSTEM_CASH (all references are guardrails)
- **A3 Attribution fixes**:
  - Extended `computeA3Attribution()` to accept optional `projectionInputs` parameter
  - When provided, sources contributions from scenario projection inputs (fixes FLOW_TO_ASSET attribution)
  - Updated FLOW_TO_DEBT guardrail to handle early loan payoff (bounds-based checks instead of exact match)
  - A3 guardrails now correctly handle FLOW scenarios without false positives