# PF Snapshot App — Claude Guide

## What this app is
A local-only personal finance snapshot and projection tool. Users enter their income, expenses, assets, and liabilities to see a current financial snapshot, run multi-year projections, and model "what-if" scenarios. No cloud, no transaction tracking, no advice — purely observational.

## Read before making any significant change
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data flow and ownership model (Snapshot → Projection → Scenarios → Attribution)
- [docs/INVARIANTS.md](docs/INVARIANTS.md) — correctness rules that must never be violated
- [docs/CHANGE_PROTOCOL.md](docs/CHANGE_PROTOCOL.md) — when docs must be updated before implementation
- [docs/THEME.md](docs/THEME.md) — design token system
- [docs/SYSTEM.md](docs/SYSTEM.md) — product scope and boundaries

---

## UI Rules (mandatory, no exceptions)

### Spacing
- Screens use `layout.*` — `layout.screenPadding`, `layout.sectionGap`, `layout.screenPaddingTop` — from `ui/layout.ts`
- Components use `spacing.*` — `spacing.sm`, `spacing.md`, `spacing.xl`, etc. — from `ui/spacing.ts`
- No hardcoded numeric values: `padding: 16`, `marginBottom: 12`, `gap: 8` are all forbidden

### Section headers
- `SectionHeader` — financial sections with meaning (Snapshot, Cash Flow, Projection)
- `GroupHeader` — structural grouping (Assets, Accounts, Settings items)
- No custom title styles, no inline header typography

### Formatters
- All currency and percentage formatting from `ui/formatters.ts`
- Snapshot screens use full currency (`formatCurrencyFull`), Projection screens use compact (`formatCurrencyCompact`) — do not mix
- No local formatting helpers

### Colors
- Always `theme.*` tokens from `useTheme()` — no hex values, no hardcoded colours
- No opacity-based pressed states — use background colour changes instead

---

## Architecture rules (things that must not be violated)

- **Snapshot** is the single source of truth. Only mutated via explicit `SnapshotContext` setters. Never touched by projection or scenario logic.
- **Projection** is ephemeral — computed from Snapshot + assumptions, never persisted, never mutates Snapshot.
- **Scenarios** modify projection inputs only — reversible, one active at a time, fall back to baseline if invalid.
- **Attribution** is observational — never mutates any state.
- **SYSTEM_CASH** always exists, exactly once per profile — cannot be deleted, renamed, or given a growth rate.
- **Flow vs Stock** — flows affect stocks only through explicit rules. Monthly surplus does not auto-accumulate into SYSTEM_CASH.
- **Doctrine changes** (anything altering system meaning or invariants) require updating the relevant docs/ file before writing code.

---

## New screen checklist
When building a new screen, follow this pattern:

1. Wrap in `DetailScreenShell` for standard screen layout
2. Use `ScreenHeader` for the top navigation bar
3. Use `SectionHeader` for financial sections, `GroupHeader` for structural grouping
4. Spacing from `layout.screenPadding`, `layout.sectionGap` (screens) or `spacing.*` (components)
5. All formatting via `formatters.ts`
6. If it's a collection screen, provide a `renderRow` override — no default row renderer exists
7. Use `CollectionRowWithActions` as the base row primitive for editable lists
8. Follow existing navigation patterns: stack navigator inside the relevant tab

---

## Safe to change
- UI styling and layout of any screen
- Detail screens and their row configurations
- Formatters, spacing tokens, theme colours
- Navigation structure

## Do not touch without care
- `engines/projectionEngine.ts` — core simulation logic
- `engines/loanEngine.ts` — amortisation and loan calculations
- `engines/computeA3Attribution.ts` — A3 attribution reconciliation math
- `context/SnapshotContext.tsx` setters — mutation boundary
- `domain/systemAssets.ts` — SYSTEM_CASH enforcement and migration logic
- Any core invariant listed in `docs/INVARIANTS.md`

If a proposed change touches these, re-read `docs/INVARIANTS.md` and `docs/CHANGE_PROTOCOL.md` first.
