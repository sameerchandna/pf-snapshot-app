Non-authoritative audit document.
Does not define system behavior or meaning.

# UI Theming & Design System Audit Report
**Date:** 2026-01-18  
**Purpose:** Prepare codebase for Light/Dark theme and visual polish  
**Status:** READ-ONLY AUDIT (No changes implemented)

---

## Executive Summary

This audit maps the current state of UI styling across the PF Snapshot App codebase to prepare for introducing a proper theme system. The app currently has **excellent spacing and layout discipline** (via `spacing.ts` and `layout.ts`), but **colors, typography, and component styling are highly fragmented** with extensive hardcoded values.

**Key Findings:**
- ✅ **Spacing system is locked and correct** — DO NOT TOUCH
- ✅ **Layout aliases are locked and correct** — DO NOT TOUCH
- ❌ **611+ hardcoded hex color values** across 20+ files
- ❌ **No centralized color system** (only `snapshotColors.focusBlue` duplicated in 2 files)
- ❌ **Typography is fragmented** — font sizes/weights defined inline in 463+ places
- ❌ **Component surfaces lack consistency** — borders, radius, shadows defined ad-hoc
- ⚠️ **Dark mode assumptions** — many light backgrounds, low-contrast borders, opacity-based states

---

## 1. THEME & COLOR USAGE

### 1.1 Current State

**Color Constants Found:**
- `snapshotColors.focusBlue = '#2F5BEA'` — defined in:
  - `screens/SnapshotScreen.tsx` (line 30-32)
  - `screens/ProjectionResultsScreen.tsx` (line 26-28)
- **No other centralized color constants exist**

**Hardcoded Color Usage:**
- **611+ hex values** found across:
  - All screen files (20+ files)
  - All component files (6+ files)
  - Inline styles in JSX (50+ instances)

### 1.2 Color Categories Identified

#### **Semantic Colors (Need Tokens)**
- **Primary Accent:** `#2F5BEA` (focusBlue) — used 100+ times
- **Text Primary:** `#000`, `#111`, `#222`, `#333` — used 200+ times
- **Text Secondary:** `#444`, `#666`, `#777`, `#888`, `#999` — used 150+ times
- **Text Muted:** `#aaa`, `#bbb`, `#ccc`, `#ddd` — used 50+ times
- **Text Inverse:** `#fff` — used 100+ times

#### **Structural Colors (Need Tokens)**
- **Background Primary:** `#fff` — used 150+ times
- **Background Secondary:** `#fafafa`, `#f8f8f8`, `#f5f5f5`, `#f2f2f2`, `#f0f0f0` — used 80+ times
- **Background Tertiary:** `#eee`, `#e0e0e0` — used 40+ times
- **Background Accent:** `#f3f7ff`, `#e8f0ff`, `#fff7db` — used 10+ times

#### **Border Colors (Need Tokens)**
- **Border Default:** `#e0e0e0`, `#f0f0f0`, `#eee` — used 100+ times
- **Border Muted:** `#d8d8d8`, `#ddd`, `#e6e6e6`, `#e8e8e8` — used 20+ times
- **Border Accent:** `#d6e3ff` (blue tint) — used 2 times
- **Border Error:** `#d32f2f`, `#ffd6d6`, `#fecaca` — used 10+ times

#### **State Colors (Need Tokens)**
- **Error/Destructive:** `#8a1f1f`, `#991b1b`, `#d32f2f`, `#dc2626`, `#ef4444` — used 20+ times
- **Success:** `#22c55e`, `#2d8659`, `#4caf50` — used 5+ times
- **Warning:** `#f59e0b`, `#ffc107`, `#856404`, `#fff3cd` — used 10+ times
- **Active/Selected:** `#2F5BEA` (reused from accent) — used 30+ times
- **Pressed State:** Opacity-based (0.7, 0.75, 0.8, 0.85) — used 50+ times

#### **Special Purpose Colors**
- **Chart Colors:** `#2F5BEA`, `#888`, `#bbb`, `#5B8DEF`, `#2f5cff` — used in ProjectionResultsScreen
- **Education Box:** `#5a4b1b` (warning title), `#fff7db` (warning bg) — used in EducationBox
- **Modal Backdrop:** `rgba(0,0,0,0.25)`, `rgba(0,0,0,0.5)` — used 15+ times

### 1.3 Files with Most Color Leakage

**Critical (100+ color instances):**
- `screens/ProjectionResultsScreen.tsx` — 200+ color instances
- `screens/GroupedListDetailScreen.tsx` — 150+ color instances

**High Priority (20-50 instances):**
- `screens/SnapshotScreen.tsx`
- `screens/ScenarioEditorScreen.tsx`
- `screens/ProfilesManagementScreen.tsx`
- `screens/ScenarioManagementScreen.tsx`
- `screens/AccountsScreen.tsx`
- `components/AssumptionsPill.tsx`

**Medium Priority (10-20 instances):**
- All other screen files
- `components/WhatIfScenario.tsx`
- `components/EducationBox.tsx`
- `components/SectionHeader.tsx`
- `components/GroupHeader.tsx`
- `components/ScreenHeader.tsx`

---

## 2. TYPOGRAPHY SYSTEM

### 2.1 Current State

**Typography Constants Found:**
- `snapshotTypography` — defined in:
  - `screens/SnapshotScreen.tsx` (lines 16-28)
  - `screens/ProjectionResultsScreen.tsx` (lines 15-24)
- **No centralized typography system exists**

### 2.2 Typography Usage Patterns

**Font Sizes Found (463+ instances):**
- **10px:** Used 10+ times (chart labels, compact text)
- **11px:** Used 30+ times (metadata, hints, small labels)
- **12px:** Used 100+ times (body text, labels, helper text)
- **13px:** Used 80+ times (body text, education text)
- **14px:** Used 120+ times (card titles, row titles, buttons)
- **15px:** Used 20+ times (input text, modal options)
- **16px:** Used 40+ times (section headers, card titles)
- **18px:** Used 15+ times (header totals, large values)
- **19px:** Used 5+ times (primary values in Snapshot)
- **20px:** Used 10+ times (screen headers)
- **22px:** Used 2+ times (large display values)

**Font Weights Found:**
- **'400' (regular):** Used 50+ times (body text, helper text)
- **'500' (medium):** Used 80+ times (labels, card titles)
- **'600' (semibold):** Used 150+ times (headers, buttons, emphasis)
- **'700' (bold):** Used 100+ times (section headers, strong emphasis)

**Font Families:**
- **Default (system):** Used everywhere
- **'monospace':** Used 10+ times (debug data, code-like display)

### 2.3 Typography Roles Identified

**Headers:**
- Screen Header: 20px, 600 weight, `#000`
- Section Header (financial): 16px, 600-700 weight, `#2F5BEA`
- Group Header (structural): 12px, 700 weight, `#666`, uppercase
- Card Title: 14px, 500-600 weight, `#111`-`#333`

**Body Text:**
- Primary Body: 12-13px, 400 weight, `#333`-`#444`
- Secondary Body: 12px, 400 weight, `#666`-`#777`
- Helper Text: 11-12px, 400 weight, `#777`-`#999`
- Education Text: 13px, 400 weight, `#444`

**Values:**
- Primary Value: 19-22px, 600-700 weight, `#000`
- Secondary Value: 14-16px, 500-600 weight, `#111`-`#333`
- Muted Value: 12-13px, 400 weight, `#666`-`#999`

**Labels:**
- Field Label: 12-14px, 500-600 weight, `#444`-`#666`
- Button Label: 14px, 600 weight, `#fff` or `#333`
- Caption: 11-12px, 400-500 weight, `#999`

### 2.4 Inconsistencies

- **Same role, different sizes:** Card titles use 13px, 14px, 15px, 16px
- **Same role, different weights:** Section headers use 600 and 700
- **Same role, different colors:** Body text uses `#111`, `#333`, `#444`, `#666`
- **No semantic naming:** Typography defined inline, not via tokens

---

## 3. COMPONENT SURFACES

### 3.1 Buttons

**Current State:**
- No shared button component exists
- Button styles defined inline in 20+ files
- States handled via opacity (0.7, 0.75, 0.8, 0.85) or backgroundColor changes

**Button Types Found:**

**Primary Buttons:**
- Background: `#2F5BEA`
- Text: `#fff`, 14px, 600 weight
- Border: None or `#2F5BEA`
- Radius: 4px, 6px, 8px (inconsistent)
- Padding: 10px vertical, 12-20px horizontal (inconsistent)
- Pressed: Opacity 0.75-0.85

**Secondary Buttons:**
- Background: `#f0f0f0`, `#f2f2f2`, `#fafafa`, `#eee`
- Text: `#333`, `#111`, 14px, 500-600 weight
- Border: `#e0e0e0`, `#ddd`, 1px
- Radius: 4px, 6px, 8px (inconsistent)
- Padding: 8-10px vertical, 12px horizontal (inconsistent)
- Pressed: Opacity 0.7-0.85

**Text Buttons:**
- Background: `transparent`
- Text: `#2F5BEA`, `#333`, 14px, 500-600 weight
- Border: None
- Pressed: Opacity 0.8-0.85

**Destructive Buttons:**
- Background: `#dc2626`, `#ef4444`
- Text: `#fff`, 14px, 600 weight
- Border: None
- Radius: 8px
- Pressed: Opacity 0.85

**Warning Buttons:**
- Background: `#f59e0b`
- Text: `#fff`, 14px, 600 weight
- Radius: 8px

**Issues:**
- No centralized button component
- Radius values inconsistent (4, 5, 6, 8, 10, 12, 24)
- Padding values inconsistent
- Pressed states use opacity (breaks in dark mode)
- No disabled state tokens

### 3.2 Cards / Containers

**Current State:**
- Cards defined inline in 15+ files
- No shared card component
- Background, border, radius defined ad-hoc

**Card Types Found:**

**Primary Cards (Snapshot pills):**
- Background: `#fff`
- Border: `#f0f0f0`, 1px
- Radius: **24px** (consistent for Snapshot cards)
- Padding: `spacing.tiny` vertical, `spacing.sm` horizontal
- Shadow: None

**Secondary Cards (detail screens):**
- Background: `#fff`, `#fafafa`, `#f8f8f8`
- Border: `#e0e0e0`, `#f0f0f0`, 1px
- Radius: **8px** (most common), also 6px, 10px
- Padding: `spacing.base` (12px) or `layout.blockPadding`
- Shadow: None (except ProjectionResultsScreen modal: shadow with `#000`, 0.1 opacity)

**Education Boxes:**
- Background: `#fafafa` (default), `#fff7db` (warning)
- Border: None
- Radius: **8px**
- Padding: `spacing.xs` vertical, `spacing.sm` horizontal

**Input Cards:**
- Background: `#fff`
- Border: `#e0e0e0`, `#f0f0f0`, 1px
- Radius: 6px, 8px, 10px (inconsistent)
- Padding: 10px, 12px (inconsistent)

**Issues:**
- Radius inconsistent (6, 8, 10, 12, 15, 24)
- Border colors inconsistent (`#e0e0e0`, `#f0f0f0`, `#eee`, `#ddd`)
- No shadow system (only 1 instance in ProjectionResultsScreen)
- Background colors vary (`#fff`, `#fafafa`, `#f8f8f8`, `#f5f5f5`)

### 3.3 Rows

**Current State:**
- Rows defined inline in 10+ files
- No shared row component
- Swipeable rows in GroupedListDetailScreen

**Row Types Found:**

**List Rows:**
- Background: `#fff`, `transparent`
- Border: Bottom border `#e0e0e0`, `#eee`, 0.5-1px
- Padding: `spacing.sm` vertical, `spacing.xl` horizontal
- Pressed: Opacity 0.7-0.8

**Swipeable Rows:**
- Background: `#fff`
- Border: `#e0e0e0`, 1px
- Radius: 8px
- Padding: `layout.rowPadding` (16px horizontal, 8px vertical)
- Swipe Actions: `#dc2626` (delete), `#f0f0f0` (background)

**Editable Rows:**
- Background: `#fff`
- Border: `#e0e0e0`, 1px
- Radius: 8px
- Padding: 10-12px

**Issues:**
- No shared row component
- Border colors inconsistent
- Pressed states use opacity

### 3.4 Indicators

**Active/Inactive Dots:**
- Active: `#2F5BEA`, 6px radius, 3px border radius
- Inactive: Not explicitly defined (uses opacity 0.5-0.7)

**Status Indicators:**
- Success: `#22c55e`, `#2d8659`, `#4caf50`
- Error: `#8a1f1f`, `#d32f2f`, `#dc2626`
- Warning: `#f59e0b`, `#ffc107`

**Issues:**
- No indicator component
- Colors hardcoded
- Inactive state uses opacity (breaks in dark mode)

### 3.5 Dividers

**Current State:**
- Dividers defined inline in 10+ files
- No shared divider component

**Divider Types Found:**

**Hairline Dividers:**
- Height: 0.5px, 1px
- Color: `#e0e0e0`, `#eee`, `#f0f0f0`
- Margin: `layout.dividerBottom` (14px) or `spacing.base`

**Section Dividers:**
- Height: 1px
- Color: `#e0e0e0`, `#eee`
- Margin: `spacing.section` (20px) or `layout.sectionGap`

**Issues:**
- No shared divider component
- Colors inconsistent
- Heights inconsistent (0.5px vs 1px)

---

## 4. SCREEN-LEVEL STYLING

### 4.1 Background Colors

**Screens with Background Colors:**
- **All screens** set `backgroundColor: '#fff'` in container style
- **No shared screen background token**

**Screens Audited:**
- `SnapshotScreen.tsx` — `#fff`
- `ProjectionResultsScreen.tsx` — `#fff`
- `AccountsScreen.tsx` — `#fff`
- `A3ValidationScreen.tsx` — `#fff`
- `SettingsScreen.tsx` — `#fff`
- `ProfilesManagementScreen.tsx` — `#fff`
- `ScenarioManagementScreen.tsx` — `#fff`
- `ScenarioEditorScreen.tsx` — `#fff`
- All detail screens — `#fff`

**Issues:**
- All screens assume white background (breaks in dark mode)
- No semantic background token (`background.primary`, `background.screen`)

### 4.2 Screen Surface Consistency

**Common Patterns:**
- All screens use `SafeAreaView` with `edges={['top']}`
- All screens use `ScrollView` for content
- Content padding: `layout.screenPadding` (16px) or `spacing.base` (12px)
- Top padding: `layout.screenPaddingTop` (12px)

**Inconsistencies:**
- Some screens use `padding: 16` directly (not `layout.screenPadding`)
- Some screens use `padding: 12` directly (not `layout.screenPaddingTop`)
- Bottom padding varies (12px, 18px, 24px)

---

## 5. DARK MODE READINESS

### 5.1 Critical Issues

**Light Background Assumptions:**
- **150+ instances** of `backgroundColor: '#fff'`
- **80+ instances** of light gray backgrounds (`#fafafa`, `#f8f8f8`, `#f5f5f5`)
- **All screens** assume white background
- **All cards** assume white/light backgrounds

**Low-Contrast Borders:**
- **100+ instances** of `borderColor: '#e0e0e0'`, `#f0f0f0`, `#eee`
- These will be invisible or very low contrast in dark mode
- Need semantic tokens: `border.default`, `border.muted`

**Opacity-Based States:**
- **50+ instances** of pressed states using `opacity: 0.7-0.85`
- Opacity on light backgrounds won't work in dark mode
- Need semantic tokens: `state.pressed`, `state.disabled`

**Opacity-Based Text:**
- **20+ instances** of muted text using opacity (e.g., `opacity: 0.6-0.7`)
- Need semantic color tokens instead

**Hardcoded Text Colors:**
- **200+ instances** of `color: '#000'`, `#111`, `#333`
- These will need dark mode variants
- Need semantic tokens: `text.primary`, `text.secondary`, `text.muted`

**Modal Backdrops:**
- **15+ instances** of `rgba(0,0,0,0.25)`, `rgba(0,0,0,0.5)`
- These assume black overlay (may need adjustment for dark mode)
- Need semantic token: `overlay.backdrop`

### 5.2 Components That Need Semantic Tokens

**High Priority:**
- All text colors → `text.primary`, `text.secondary`, `text.muted`, `text.inverse`
- All background colors → `background.primary`, `background.secondary`, `background.card`
- All border colors → `border.default`, `border.muted`, `border.accent`
- All button states → `button.primary.bg`, `button.primary.text`, `button.pressed`
- All card surfaces → `card.background`, `card.border`

**Medium Priority:**
- Chart colors → `chart.primary`, `chart.secondary`, `chart.muted`
- Error/success/warning colors → `semantic.error`, `semantic.success`, `semantic.warning`
- Modal overlays → `overlay.backdrop`, `overlay.sheet`

**Low Priority:**
- Education box variants → `education.default.bg`, `education.warning.bg`
- Divider colors → `divider.default`

---

## 6. SETTINGS & CONFIG

### 6.1 Existing Config Files

**Current Structure:**
```
/
├── spacing.ts          ✅ Locked spacing tokens
├── layout.ts           ✅ Locked layout aliases
├── formatters.ts       ✅ Locked number formatting
├── constants.ts        ✅ App constants (tolerances, system IDs)
└── (no theme/colors files)
```

**What's Currently Stored:**
- `spacing.ts` — Primary spacing scale (zero, tiny, xs, sm, base, xl, section, huge)
- `layout.ts` — Semantic layout aliases (screenPadding, sectionGap, etc.)
- `formatters.ts` — Currency and percentage formatting
- `constants.ts` — Attribution tolerance, UI tolerance, SYSTEM_CASH_ID

**What's Missing:**
- Color tokens
- Typography tokens
- Component style tokens (radius, shadows, borders)
- Theme provider/hook

### 6.2 Proposed File Structure

**New `/theme` folder:**
```
theme/
├── tokens.ts           # Base design tokens (colors, typography, spacing refs)
├── light.ts            # Light theme (extends tokens)
├── dark.ts             # Dark theme (extends tokens)
├── types.ts            # TypeScript types for theme
├── ThemeProvider.tsx    # React context provider
└── useTheme.ts         # Hook to access theme
```

**Alternative (flatter structure):**
```
/
├── colors.ts           # Color tokens (light/dark variants)
├── typography.ts       # Typography tokens
├── components.ts       # Component style tokens (radius, shadows)
├── ThemeProvider.tsx   # React context provider
└── useTheme.ts         # Hook to access theme
```

**Recommendation:** Use `/theme` folder for better organization and future extensibility.

---

## 7. REFACTOR CHECKLIST

### 7.1 Pre-Theming Refactors (Required Before Adding Dark Mode)

**Phase 1: Centralize Colors**
- [ ] Create `theme/tokens.ts` with base color palette
- [ ] Create `theme/light.ts` with light theme colors
- [ ] Extract all hardcoded hex colors to semantic tokens
- [ ] Replace `snapshotColors.focusBlue` with `colors.accent.primary`
- [ ] Replace all `#fff` backgrounds with `colors.background.primary`
- [ ] Replace all `#000`, `#111`, `#333` text with `colors.text.primary`
- [ ] Replace all `#666`, `#777`, `#999` text with `colors.text.secondary`
- [ ] Replace all `#e0e0e0`, `#f0f0f0` borders with `colors.border.default`
- [ ] Replace all error colors with `colors.semantic.error`
- [ ] Replace all success colors with `colors.semantic.success`
- [ ] Replace all warning colors with `colors.semantic.warning`
- [ ] Replace modal backdrops with `colors.overlay.backdrop`

**Phase 2: Centralize Typography**
- [ ] Create `theme/typography.ts` with typography scale
- [ ] Define semantic typography roles (header, body, label, value, caption)
- [ ] Replace all inline `fontSize` with typography tokens
- [ ] Replace all inline `fontWeight` with typography tokens
- [ ] Replace all inline `fontFamily` with typography tokens
- [ ] Remove duplicate `snapshotTypography` definitions

**Phase 3: Centralize Component Styles**
- [ ] Create `theme/components.ts` with component tokens
- [ ] Define border radius tokens (small: 4px, medium: 8px, large: 24px)
- [ ] Define border width tokens (hairline: 0.5px, thin: 1px, medium: 1.5px)
- [ ] Define shadow tokens (if needed)
- [ ] Replace all inline `borderRadius` with component tokens
- [ ] Replace all inline `borderWidth` with component tokens
- [ ] Replace all inline `borderColor` with color tokens

**Phase 4: Create Theme Provider**
- [ ] Create `theme/ThemeProvider.tsx` with React context
- [ ] Create `theme/useTheme.ts` hook
- [ ] Add theme selection logic (light/dark, system preference)
- [ ] Wrap app in `ThemeProvider` in `App.tsx`

**Phase 5: Replace Opacity-Based States**
- [ ] Replace pressed state opacity with semantic color tokens
- [ ] Replace disabled state opacity with semantic color tokens
- [ ] Replace inactive state opacity with semantic color tokens
- [ ] Define `state.pressed`, `state.disabled`, `state.inactive` tokens

**Phase 6: Screen-Level Refactors**
- [ ] Replace all screen `backgroundColor: '#fff'` with theme token
- [ ] Ensure all screens use `layout.screenPadding` (not hardcoded values)
- [ ] Standardize bottom padding across screens

### 7.2 Post-Theming Tasks (After Dark Mode Added)

- [ ] Create `theme/dark.ts` with dark theme colors
- [ ] Test all screens in dark mode
- [ ] Adjust contrast ratios for accessibility
- [ ] Test chart colors in dark mode
- [ ] Test modal overlays in dark mode
- [ ] Test education boxes in dark mode
- [ ] Add theme toggle in Settings screen (if desired)

---

## 8. DO NOT TOUCH (Locked Systems)

### 8.1 Spacing System ✅
**Files:** `spacing.ts`, `layout.ts`
- **DO NOT** modify spacing token values
- **DO NOT** add new spacing values to `spacing.ts`
- **DO NOT** modify layout aliases (unless adding new semantic use case)
- **Status:** Locked and correct

### 8.2 Layout System ✅
**Files:** `layout.ts`
- **DO NOT** modify existing layout alias values
- **DO NOT** change semantic meanings of aliases
- **Status:** Locked and correct

### 8.3 Formatting System ✅
**Files:** `formatters.ts`
- **DO NOT** modify currency/percentage formatting logic
- **DO NOT** change Snapshot (full) vs Projection (compact) distinction
- **Status:** Locked and correct

### 8.4 Component Semantics ✅
**Files:** `components/SectionHeader.tsx`, `components/GroupHeader.tsx`
- **DO NOT** change SectionHeader vs GroupHeader distinction
- **DO NOT** modify header typography (sizes/weights) — these are locked
- **Status:** Locked and correct

### 8.5 Snapshot Semantics ✅
**Files:** `screens/SnapshotScreen.tsx`, `PRODUCT_SPEC.md`
- **DO NOT** change Snapshot read-only behavior
- **DO NOT** change Snapshot math or calculations
- **DO NOT** change Snapshot visual structure (cards, layout)
- **Status:** Locked and correct

---

## 9. PROPOSED THEME FILE STRUCTURE

### 9.1 File: `theme/tokens.ts`
**Purpose:** Base design tokens (color palette, typography scale, component dimensions)

**Contents:**
- Base color palette (raw hex values, not semantic)
- Typography scale (font sizes, weights, line heights)
- Component dimensions (border radius scale, border widths, shadows)
- Spacing references (imports from `spacing.ts`)

### 9.2 File: `theme/light.ts`
**Purpose:** Light theme semantic tokens

**Contents:**
- Semantic color tokens (text.primary, background.primary, border.default, etc.)
- Typography roles (header.large, body.primary, label.default, etc.)
- Component tokens (button.radius, card.radius, divider.height, etc.)
- State tokens (pressed, disabled, active, inactive)

### 9.3 File: `theme/dark.ts`
**Purpose:** Dark theme semantic tokens (extends/overrides light theme)

**Contents:**
- Dark mode color overrides
- Same structure as `light.ts` but with dark-appropriate values

### 9.4 File: `theme/types.ts`
**Purpose:** TypeScript types for theme system

**Contents:**
- `Theme` interface
- `ColorTokens` interface
- `TypographyTokens` interface
- `ComponentTokens` interface

### 9.5 File: `theme/ThemeProvider.tsx`
**Purpose:** React context provider for theme

**Contents:**
- `ThemeContext` creation
- `ThemeProvider` component
- Theme selection logic (light/dark/system)
- Persistence (if needed)

### 9.6 File: `theme/useTheme.ts`
**Purpose:** Hook to access theme in components

**Contents:**
- `useTheme()` hook
- Type-safe theme access
- Helper functions (if needed)

---

## 10. SUMMARY & RECOMMENDATIONS

### 10.1 Current State Summary

**Strengths:**
- ✅ Excellent spacing discipline (`spacing.ts`, `layout.ts`)
- ✅ Consistent formatting system (`formatters.ts`)
- ✅ Locked component semantics (SectionHeader, GroupHeader)
- ✅ Clear product philosophy (calm, neutral, sober)

**Weaknesses:**
- ❌ 611+ hardcoded color values
- ❌ 463+ inline typography definitions
- ❌ No centralized color system
- ❌ No centralized typography system
- ❌ Inconsistent component styling (radius, borders, shadows)
- ❌ Opacity-based states (won't work in dark mode)
- ❌ Light mode assumptions throughout

### 10.2 Recommended Approach

**Step 1: Create Theme Foundation**
1. Create `/theme` folder structure
2. Define base tokens (`tokens.ts`)
3. Define light theme (`light.ts`)
4. Create types (`types.ts`)

**Step 2: Centralize Colors**
1. Extract all colors to semantic tokens
2. Replace hardcoded hex values with theme tokens
3. Remove duplicate `snapshotColors` definitions

**Step 3: Centralize Typography**
1. Extract typography to tokens
2. Replace inline font sizes/weights with typography roles
3. Remove duplicate `snapshotTypography` definitions

**Step 4: Centralize Component Styles**
1. Extract border radius to tokens
2. Extract border widths to tokens
3. Extract shadows to tokens (if needed)

**Step 5: Replace Opacity States**
1. Replace pressed states with color tokens
2. Replace disabled states with color tokens
3. Replace inactive states with color tokens

**Step 6: Add Theme Provider**
1. Create `ThemeProvider` and `useTheme` hook
2. Wrap app in provider
3. Test light mode (should look identical to current)

**Step 7: Add Dark Mode**
1. Create `dark.ts` theme
2. Test all screens in dark mode
3. Adjust contrast as needed

### 10.3 Estimated Effort

**Phase 1-3 (Centralization):** 2-3 days
- Extracting colors: ~1 day
- Extracting typography: ~0.5 days
- Extracting component styles: ~0.5 days
- Testing/verification: ~1 day

**Phase 4-5 (Provider & States):** 1 day
- Theme provider setup: ~0.5 days
- Replacing opacity states: ~0.5 days

**Phase 6 (Dark Mode):** 1-2 days
- Dark theme creation: ~0.5 days
- Testing all screens: ~1 day
- Contrast adjustments: ~0.5 days

**Total:** 4-6 days of focused work

### 10.4 Risk Mitigation

**Risk:** Breaking visual consistency during refactor
**Mitigation:**
- Test each screen after color/typography extraction
- Use visual regression testing (if available)
- Keep light theme identical to current appearance

**Risk:** Performance impact of theme provider
**Mitigation:**
- Use React.memo for theme-dependent components
- Keep theme object stable (no recreations on render)

**Risk:** Dark mode contrast issues
**Mitigation:**
- Test with accessibility tools (WCAG AA minimum)
- Get user feedback on dark mode appearance
- Iterate on contrast values

---

## 11. APPENDIX: File-by-File Color Count

**Files with 100+ color instances:**
- `screens/ProjectionResultsScreen.tsx` — ~200 instances
- `screens/GroupedListDetailScreen.tsx` — ~150 instances

**Files with 20-50 color instances:**
- `screens/SnapshotScreen.tsx` — ~30 instances
- `screens/ScenarioEditorScreen.tsx` — ~40 instances
- `screens/ProfilesManagementScreen.tsx` — ~35 instances
- `screens/ScenarioManagementScreen.tsx` — ~30 instances
- `screens/AccountsScreen.tsx` — ~25 instances
- `components/AssumptionsPill.tsx` — ~25 instances

**Files with 10-20 color instances:**
- All other screen files
- `components/WhatIfScenario.tsx`
- `components/EducationBox.tsx`
- `components/SectionHeader.tsx`
- `components/GroupHeader.tsx`
- `components/ScreenHeader.tsx`
- `components/DetailScreenShell.tsx`

**Total estimated color instances:** 611+

---

**END OF AUDIT REPORT**
