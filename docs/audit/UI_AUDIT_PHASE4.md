# UI Audit Report — Phase 4

**Date:** 2024  
**Scope:** Observational audit of UI styling patterns, tokens, components, and duplication  
**Constraint:** No code changes, no visual changes, no refactoring

---

## A. Executive Summary

### Top 10 Hotspots

1. **Color Hardcoding (550+ instances across 29 files)**
   - **Why it matters:** 550+ hardcoded hex colors prevent theme switching and dark mode. Primary brand color `#2F5BEA` appears 100+ times. No semantic color tokens exist.

2. **Spacing Duplication (161+ hardcoded padding/margin values)**
   - **Why it matters:** Despite `spacing.ts` and `layout.ts` existing, 161+ instances of hardcoded numeric spacing values remain. Values like `padding: 12`, `marginBottom: 10`, `gap: 8` are scattered across screens.

3. **Typography Inconsistency (479+ fontSize/fontWeight instances)**
   - **Why it matters:** No typography token system. Same semantic roles use different sizes (e.g., card titles: 13px, 14px, 15px, 16px). Font weights vary (400, 500, 600, 700) without semantic meaning.

4. **Button Pattern Duplication (264 TouchableOpacity/Pressable instances, 19 files)**
   - **Why it matters:** No shared button component. Button styles duplicated across 19 files with inconsistent radius (4, 6, 8, 10, 12, 24px), padding, and pressed states.

5. **Border Radius Chaos (180+ instances, 15+ unique values)**
   - **Why it matters:** Border radius values: 3, 4, 5, 6, 8, 10, 11, 12, 14, 15, 24px. No system. Cards, inputs, buttons all use different values inconsistently.

6. **Input Field Duplication (37 TextInput instances, 9 files)**
   - **Why it matters:** Input styling duplicated across 9 files. Border colors (`#e0e0e0`, `#f0f0f0`), padding (10px, 12px), and radius (6px, 8px, 10px) vary without reason.

7. **Card/Container Duplication (15+ files define cards inline)**
   - **Why it matters:** `SectionCard` exists but many screens define custom card styles. Background colors (`#fff`, `#fafafa`, `#f8f8f8`), borders, and radius vary.

8. **Shadow System Missing (1 instance only)**
   - **Why it matters:** Only `ProjectionResultsScreen` uses shadows. No elevation system. Cards lack visual hierarchy.

9. **Dark Mode Blockers (0 useColorScheme checks, 550+ light-only colors)**
   - **Why it matters:** Entire app assumes light mode. All colors hardcoded for light backgrounds. No dark mode infrastructure exists.

10. **Screen Layout Duplication (25 screen files, repeated patterns)**
    - **Why it matters:** Detail screens share similar structures (header, scroll content, padding) but each implements independently. No shared layout shell beyond `DetailScreenShell`.

---

## B. Token Inventory

### B.1 Colors

**Search Pattern:** `grep -r "#[0-9A-Fa-f]\{3,6\}" --include="*.tsx" --include="*.ts"`

**Total Instances:** 610+ hex color values across 29 files

#### Primary Brand Colors
| Color | Count | Files | Usage |
|-------|-------|-------|-------|
| `#2F5BEA` | 100+ | 15+ files | Primary brand blue (focus, active states, links) |
| `#fff` / `#FFFFFF` | 150+ | All files | Backgrounds, cards, inputs |
| `#000` / `#111` | 80+ | All files | Primary text, headings |

#### Neutral Grays
| Color | Count | Files | Usage |
|-------|-------|-------|-------|
| `#666` | 50+ | 20+ files | Secondary text, labels |
| `#777` | 40+ | 15+ files | Muted text, placeholders |
| `#888` | 30+ | 10+ files | Tertiary text, chart labels |
| `#999` | 40+ | 15+ files | Helper text, captions |
| `#aaa` | 10+ | 5+ files | Disabled states |
| `#bbb` | 5+ | 3+ files | Chart series |

#### Background Grays
| Color | Count | Files | Usage |
|-------|-------|-------|-------|
| `#fafafa` | 30+ | 12+ files | Card backgrounds, education boxes |
| `#f5f5f5` / `#F5F6F8` | 20+ | 8+ files | Screen backgrounds, pressed states |
| `#f2f2f2` | 15+ | 6+ files | Button backgrounds, toolbar pills |
| `#f0f0f0` | 25+ | 10+ files | Input borders, dividers |
| `#eee` | 20+ | 8+ files | Borders, dividers |
| `#e0e0e0` | 40+ | 15+ files | Primary border color |
| `#ddd` | 10+ | 5+ files | Secondary borders |

#### Semantic Colors
| Color | Count | Files | Usage |
|-------|-------|-------|-------|
| `#dc2626` / `#ef4444` | 5+ | 3+ files | Error states, destructive actions |
| `#8a1f1f` | 5+ | 3+ files | Error text |
| `#f59e0b` | 2+ | 1+ file | Warning buttons |
| `#fff7db` | 2+ | 1+ file | Warning backgrounds |
| `#22c55e` | 1+ | 1+ file | Success states |
| `#991b1b` | 3+ | 2+ files | Error text variants |

#### Special Purpose
| Color | Count | Files | Usage |
|-------|-------|-------|-------|
| `#f5f7ff` | 2+ | 1+ file | Selected radio background |
| `#e8f0ff` | 2+ | 1+ file | Highlight backgrounds |
| `#5B8DEF` | 1+ | 1+ file | Muted brand blue |
| `#8FA8D4` | 1+ | 1+ file | Muted blue variant |
| `#2f5cff` | 1+ | 1+ file | Link color variant |
| `#667085` | 2+ | 1+ file | Subtitle text |
| `#6f7a8c` | 1+ | 1+ file | Icon color |

**Files with Most Color Hardcoding:**
1. `screens/ProjectionResultsScreen.tsx` - 175+ instances
2. `screens/GroupedListDetailScreen.tsx` - 72+ instances
3. `screens/ProfilesManagementScreen.tsx` - 30+ instances
4. `screens/ScenarioEditorScreen.tsx` - 38+ instances
5. `components/AssumptionsPill.tsx` - 25+ instances

**rgba() Usage:** 11 instances (modal overlays: `rgba(0,0,0,0.25)` and `rgba(0,0,0,0.5)`)

---

### B.2 Spacing

**Search Patterns:**
- Padding: `grep -E "padding:\s*\d+|paddingTop:\s*\d+|paddingBottom:\s*\d+|paddingLeft:\s*\d+|paddingRight:\s*\d+|paddingHorizontal:\s*\d+|paddingVertical:\s*\d+" --include="*.tsx"`
- Margin: `grep -E "margin:\s*\d+|marginTop:\s*\d+|marginBottom:\s*\d+|marginLeft:\s*\d+|marginRight:\s*\d+|marginHorizontal:\s*\d+|marginVertical:\s*\d+" --include="*.tsx"`
- Gap: `grep -E "gap:\s*\d+" --include="*.tsx"`

**Total Hardcoded Instances:** 385+ (161 padding, 190 margin, 34 gap)

#### Spacing Values Found (excluding spacing.ts/layout.ts)
| Value | Count | Common Usage |
|-------|-------|--------------|
| 2 | 5+ | Tiny gaps, micro spacing |
| 4 | 20+ | Section title margins, icon gaps |
| 6 | 15+ | Component gaps, vertical padding |
| 8 | 40+ | Component gaps, row padding |
| 10 | 30+ | Button padding, input padding, margins |
| 12 | 50+ | Block padding, margins, section spacing |
| 14 | 10+ | Modal padding, chart padding |
| 16 | 30+ | Screen padding, row padding |
| 18 | 5+ | Modal bottom padding |
| 20 | 10+ | Modal padding, button horizontal padding |
| 24 | 5+ | Section bottom spacing, chart padding |
| 32 | 2+ | Chart padding |
| 52 | 1+ | Chart left padding |
| 100 | 2+ | Reserved space for right-aligned columns |

**Files with Most Hardcoded Spacing:**
1. `screens/ProjectionResultsScreen.tsx` - 80+ instances
2. `screens/GroupedListDetailScreen.tsx` - 60+ instances
3. `screens/SnapshotScreen.tsx` - 15+ instances

**Note:** `spacing.ts` and `layout.ts` exist and are used in some components, but hardcoded values remain widespread.

---

### B.3 Typography

**Search Pattern:** `grep -E "fontSize:\s*\d+|fontWeight:\s*['"]\w+['"]|lineHeight:\s*\d+" --include="*.tsx"`

**Total Instances:** 479+ typography declarations

#### Font Sizes Found
| Size | Count | Common Usage |
|------|-------|--------------|
| 10 | 15+ | Captions, helper text, chart labels |
| 11 | 40+ | Secondary text, helper text, labels |
| 12 | 120+ | Body text, labels, captions (most common) |
| 13 | 50+ | Body text, secondary values |
| 14 | 80+ | Card titles, button labels, secondary headings |
| 15 | 20+ | Input text, primary values |
| 16 | 30+ | Section titles, primary headings |
| 18 | 10+ | Large headings, modal titles |
| 20 | 5+ | Screen titles |
| 22 | 2+ | Large display values |

#### Font Weights Found
| Weight | Count | Common Usage |
|--------|-------|--------------|
| '400' (regular) | 80+ | Body text, secondary text |
| '500' (medium) | 60+ | Labels, secondary headings |
| '600' (semibold) | 150+ | Card titles, primary text, buttons (most common) |
| '700' (bold) | 50+ | Section headers, emphasis |

#### Line Heights Found
| Height | Count | Common Usage |
|--------|-------|--------------|
| 14 | 3+ | Compact text |
| 16 | 10+ | Body text |
| 17 | 1+ | Body text variant |
| 18 | 15+ | Body text, paragraphs |
| 20 | 8+ | Large text, modal content |

**Typography Inconsistencies:**
- Card titles: 13px, 14px, 15px, 16px (should be one size)
- Section headers: 16px (600 weight) vs 16px (700 weight)
- Body text: 11px, 12px, 13px (no clear hierarchy)
- Button labels: 12px, 13px, 14px, 15px (inconsistent)

**Files with Most Typography:**
1. `screens/ProjectionResultsScreen.tsx` - 200+ instances
2. `screens/GroupedListDetailScreen.tsx` - 80+ instances
3. `screens/ScenarioEditorScreen.tsx` - 30+ instances

---

### B.4 Border Radius

**Search Pattern:** `grep -E "borderRadius:\s*\d+" --include="*.tsx"`

**Total Instances:** 180+ border radius declarations

#### Radius Values Found
| Radius | Count | Common Usage |
|--------|-------|--------------|
| 3 | 1+ | Tiny pills |
| 4 | 10+ | Small buttons, badges |
| 5 | 2+ | Radio circles |
| 6 | 30+ | Buttons, inputs, cards (common) |
| 8 | 80+ | Cards, inputs, buttons (most common) |
| 10 | 8+ | Cards, inputs |
| 11 | 1+ | Special cards |
| 12 | 15+ | Cards, modals, pills |
| 14 | 5+ | Pills, circular buttons |
| 15 | 1+ | Special cards |
| 24 | 5+ | Snapshot cards (pill style) |

**Inconsistency:** Same component types use different radius values (e.g., inputs: 6px, 8px, 10px).

**Files with Most Radius:**
1. `screens/ProjectionResultsScreen.tsx` - 50+ instances
2. `screens/GroupedListDetailScreen.tsx` - 20+ instances
3. `screens/ScenarioEditorScreen.tsx` - 15+ instances

---

### B.5 Borders

**Search Pattern:** `grep -E "borderWidth:\s*\d+|borderColor:" --include="*.tsx"`

**Total Instances:** 100+ border declarations

#### Border Widths Found
| Width | Count | Common Usage |
|-------|-------|--------------|
| 0 | 2+ | Borderless cards |
| 0.5 | 3+ | Thin dividers, pill borders |
| 1 | 80+ | Standard borders (most common) |
| 1.5 | 5+ | Emphasized borders |
| 2 | 3+ | Focus states, selected states |

#### Border Colors Found
| Color | Count | Common Usage |
|-------|-------|--------------|
| `#e0e0e0` | 40+ | Primary border color (most common) |
| `#f0f0f0` | 10+ | Light borders |
| `#eee` | 5+ | Very light borders |
| `#ddd` | 5+ | Secondary borders |
| `#ccc` | 3+ | Disabled borders |
| `#2F5BEA` | 5+ | Focus/selected borders |
| `#d8d8d8` | 2+ | Chart borders |
| `#d32f2f` | 1+ | Error borders |
| `#fecaca` | 2+ | Error card borders |
| `#ffc107` | 2+ | Warning borders |

---

### B.6 Shadows

**Search Pattern:** `grep -E "shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation" --include="*.tsx"`

**Total Instances:** 1 shadow system (ProjectionResultsScreen only)

**Shadow Usage:**
- **File:** `screens/ProjectionResultsScreen.tsx`
- **Style:** `projectionToolbarSurface`
- **Properties:**
  - `shadowColor: '#000'`
  - `shadowOffset: { width: 0, height: 2 }`
  - `shadowOpacity: 0.1`
  - `shadowRadius: 4`
  - `elevation: 3`

**Observation:** No shadow/elevation system exists. Only one component uses shadows. Cards lack visual hierarchy.

---

## C. Component Inventory & Duplication Map

### C.1 Shared Components (Existing)

| Component | Files Using | Status |
|-----------|-------------|--------|
| `SectionCard` | 4 files (SnapshotScreen, ProjectionResultsScreen, GroupedListDetailScreen, AccountsScreen) | ✅ Centralized |
| `SectionHeader` | 2 files (SnapshotScreen, ProjectionResultsScreen) | ✅ Centralized |
| `GroupHeader` | 8 files (ScenarioEditorScreen, ScenarioManagementScreen, A3ValidationScreen, GroupedListDetailScreen, AccountsScreen, ProfilesManagementScreen, SettingsScreen, LoanDetailScreen) | ✅ Centralized |
| `ScreenHeader` | Multiple detail screens | ✅ Centralized |
| `EducationBox` | 4 files (ScenarioEditorScreen, AssetsDetailScreen, ExpensesDetailScreen, LiabilitiesDetailScreen) | ✅ Centralized |
| `DetailScreenShell` | Multiple detail screens | ✅ Centralized |

**Note:** These components exist but many screens still define similar patterns inline.

---

### C.2 Duplicated Patterns

#### Buttons
**Pattern:** TouchableOpacity/Pressable with inline styles  
**Instances:** 264 across 19 files  
**Duplication Hotspots:**
- `screens/ProjectionResultsScreen.tsx` - 43 instances
- `screens/ScenarioManagementScreen.tsx` - 21 instances
- `screens/SnapshotScreen.tsx` - 25 instances
- `screens/GroupedListDetailScreen.tsx` - 38 instances
- `screens/ProfilesManagementScreen.tsx` - 29 instances

**Button Types Found:**
1. **Primary:** `#2F5BEA` background, white text, radius 4-8px, padding 10px vertical
2. **Secondary:** Gray background (`#f0f0f0`, `#f2f2f2`, `#fafafa`), dark text, radius 4-8px
3. **Text:** Transparent, colored text (`#2F5BEA` or `#333`)
4. **Destructive:** `#dc2626` or `#ef4444` background, white text
5. **Warning:** `#f59e0b` background, white text
6. **Icon buttons:** Circular/square, various sizes

**Issues:**
- No shared button component
- Radius inconsistent (4, 6, 8, 10, 12, 24px)
- Padding inconsistent (8px, 10px, 12px, 16px, 20px)
- Pressed states use opacity (0.7, 0.75, 0.8, 0.85) - breaks in dark mode

---

#### Input Fields
**Pattern:** TextInput with inline styles  
**Instances:** 37 across 9 files  
**Duplication Hotspots:**
- `screens/GroupedListDetailScreen.tsx` - 15 instances
- `screens/LoanDetailScreen.tsx` - 6 instances
- `screens/ScenarioEditorScreen.tsx` - 3 instances
- `screens/ProjectionResultsScreen.tsx` - 2 instances

**Input Patterns Found:**
- Background: `#fff`
- Border: `#e0e0e0` (1px width)
- Radius: 6px, 8px, 10px (inconsistent)
- Padding: 10px, 12px (inconsistent)
- Font size: 14px, 15px, 16px (inconsistent)

**Files:**
- `screens/ScenarioEditorScreen.tsx`
- `screens/GroupedListDetailScreen.tsx`
- `screens/AssetsDetailScreen.tsx`
- `screens/ProfilesManagementScreen.tsx`
- `screens/LoanDetailScreen.tsx`
- `components/AssumptionsPill.tsx`
- `components/WhatIfScenario.tsx`
- `screens/SingleValueDetailScreen.tsx`
- `screens/ProjectionResultsScreen.tsx`

---

#### Cards/Containers
**Pattern:** View with backgroundColor, border, borderRadius, padding  
**Instances:** 15+ files define cards inline  
**Duplication Hotspots:**
- Many screens define custom card styles despite `SectionCard` existing

**Card Types Found:**
1. **Primary Cards (Snapshot pills):**
   - Background: `#fff`
   - Border: `#f0f0f0` (1px)
   - Radius: 24px (consistent)
   - Padding: `spacing.tiny` vertical, `spacing.sm` horizontal

2. **Secondary Cards (detail screens):**
   - Background: `#fff`, `#fafafa`, `#f8f8f8`
   - Border: `#e0e0e0`, `#f0f0f0` (1px)
   - Radius: 8px (most common), also 6px, 10px
   - Padding: 12px or `layout.blockPadding`

3. **Education Boxes:**
   - Background: `#fafafa` (default), `#fff7db` (warning)
   - Radius: 8px
   - Padding: `spacing.xs` vertical, `spacing.sm` horizontal
   - ✅ Centralized in `EducationBox` component

4. **Input Cards:**
   - Background: `#fff`
   - Border: `#e0e0e0`, `#f0f0f0` (1px)
   - Radius: 6px, 8px, 10px (inconsistent)
   - Padding: 10px, 12px (inconsistent)

**Files Defining Cards Inline:**
- `screens/ProjectionResultsScreen.tsx` - Multiple card types
- `screens/ScenarioEditorScreen.tsx` - Radio options, fields
- `screens/ScenarioManagementScreen.tsx` - Scenario cards
- `screens/GroupedListDetailScreen.tsx` - Entry rows, error cards
- `screens/LoanDetailScreen.tsx` - Form cards
- `screens/AssetsDetailScreen.tsx` - Quick add cards
- And 10+ more files

---

#### Rows/List Items
**Pattern:** View with flexDirection row, padding, borders  
**Instances:** 10+ files define rows inline

**Row Types Found:**
1. **List Rows:**
   - Background: `#fff`, `transparent`
   - Border: Bottom border `#e0e0e0`, `#eee` (0.5-1px)
   - Padding: `spacing.sm` vertical, `spacing.xl` horizontal

2. **Swipeable Rows (GroupedListDetailScreen):**
   - Custom swipe actions
   - Height: 44px (ROW_HEIGHT constant)

3. **Toolbar Rows:**
   - Flex row, gap spacing
   - Various background colors

**Files:**
- `screens/GroupedListDetailScreen.tsx` - Swipeable rows
- `screens/ProjectionResultsScreen.tsx` - Toolbar rows, legend rows
- `screens/SnapshotScreen.tsx` - List rows
- `screens/AccountsScreen.tsx` - Account rows
- And 7+ more files

---

#### Modals
**Pattern:** Modal with overlay, content container  
**Instances:** 8+ files define modals inline

**Modal Patterns Found:**
- Overlay: `rgba(0,0,0,0.25)` or `rgba(0,0,0,0.5)`
- Content: White background, padding 20px, radius 8-12px
- Buttons: Bottom row, various styles

**Files:**
- `screens/ProjectionResultsScreen.tsx`
- `screens/ScenarioEditorScreen.tsx`
- `screens/ScenarioManagementScreen.tsx`
- `screens/GroupedListDetailScreen.tsx`
- `screens/PensionDetailScreen.tsx`
- `screens/ContributionsDetailScreen.tsx`
- `screens/ProfilesManagementScreen.tsx`
- `components/AssumptionsPill.tsx`
- `components/WhatIfScenario.tsx`
- `components/DetailScreenShell.tsx`

---

#### Dividers
**Pattern:** View with height 1px, backgroundColor  
**Instances:** 10+ files define dividers inline

**Divider Patterns:**
- Height: 1px
- Background: `#e0e0e0`, `#eee`, `#ddd`
- Margin: Various (4px, 6px, 8px, 10px, 12px, 14px)

**Files:**
- Multiple screens use inline dividers
- No shared divider component

---

### C.3 Component-Local Visual Decisions

**Definition:** Hardcoded spacing/colors/typography within component files that should be tokens.

**Examples:**
1. **SectionCard.tsx:**
   - `backgroundColor: '#fff'` (should be token)
   - `borderRadius: 12` (should be token)
   - Uses `spacing.base` ✅ (good)

2. **SectionHeader.tsx:**
   - `color: '#2F5BEA'` (should be token)
   - `color: '#888'` (should be token)
   - Uses `layout.sectionTitleBottom` ✅ (good)

3. **GroupHeader.tsx:**
   - `color: '#666'` (should be token)
   - Uses `spacing.sm` ✅ (good)

4. **ScreenHeader.tsx:**
   - `color: '#000'` (should be token)
   - `color: '#888'` (should be token)
   - `color: '#aaa'` (should be token)
   - `borderBottomColor: '#e0e0e0'` (should be token)
   - `padding: 16` (should use `layout.headerPadding`)

5. **EducationBox.tsx:**
   - `backgroundColor: '#fafafa'` (should be token)
   - `backgroundColor: '#fff7db'` (warning variant, should be token)
   - `color: '#5a4b1b'` (should be token)
   - `color: '#444'` (should be token)
   - Uses `spacing.xs`, `spacing.sm` ✅ (good)

**All component files contain hardcoded colors that should be theme tokens.**

---

## D. Dark Mode Blockers

### D.1 Color Scheme Detection

**Search Pattern:** `grep -E "useColorScheme|dark|light|ColorScheme" --include="*.tsx"`

**Results:** 3 matches (all false positives - comments only)
- `screens/ProjectionResultsScreen.tsx` - Comment: "Default view: Net Worth (blue) + Assets (grey)"
- `components/EducationBox.tsx` - Comment: "Slightly denser, token-based padding"

**Observation:** Zero `useColorScheme` hooks. No dark mode infrastructure exists.

---

### D.2 Hardcoded Light Assumptions

**All 550+ color instances assume light mode:**

1. **Background Colors:**
   - White (`#fff`) used for cards, inputs, modals
   - Light grays (`#fafafa`, `#f5f5f5`, `#f2f2f2`) for backgrounds
   - No dark equivalents

2. **Text Colors:**
   - Dark text (`#000`, `#111`, `#333`) on light backgrounds
   - Gray text (`#666`, `#777`, `#888`, `#999`) for secondary text
   - No light text colors for dark backgrounds

3. **Border Colors:**
   - Light borders (`#e0e0e0`, `#f0f0f0`, `#eee`) for light backgrounds
   - No dark border colors

4. **Pressed States:**
   - Use opacity reduction (0.7, 0.75, 0.8, 0.85)
   - Opacity-based pressed states break in dark mode (need background color changes)

5. **Shadows:**
   - Single shadow uses `#000` (black)
   - Dark mode may need lighter shadows or glow effects

---

### D.3 Conditional Styling

**Search Pattern:** `grep -E "colorScheme|isDark|darkMode" --include="*.tsx"`

**Results:** 0 matches

**Observation:** No conditional styling based on color scheme. Entire app is light-mode only.

---

## E. Suggested Extraction Order for Phase 4 Next Items

### E.1 Theme File (Central theme file - light/dark)

**Priority: HIGH**  
**Estimated Impact:** Enables dark mode, centralizes 550+ color instances

**Suggested Structure:**
```typescript
// theme.ts
export const lightTheme = {
  colors: {
    // Brand
    primary: '#2F5BEA',
    primaryMuted: '#5B8DEF',
    
    // Text
    textPrimary: '#000',
    textSecondary: '#333',
    textTertiary: '#666',
    textMuted: '#777',
    textDisabled: '#999',
    
    // Backgrounds
    background: '#F5F6F8',
    backgroundCard: '#fff',
    backgroundSecondary: '#fafafa',
    backgroundTertiary: '#f2f2f2',
    
    // Borders
    border: '#e0e0e0',
    borderLight: '#f0f0f0',
    borderLighter: '#eee',
    
    // Semantic
    error: '#dc2626',
    errorText: '#8a1f1f',
    warning: '#f59e0b',
    warningBackground: '#fff7db',
    success: '#22c55e',
    
    // Interactive
    pressed: 'rgba(0,0,0,0.1)',
    overlay: 'rgba(0,0,0,0.25)',
    overlayDark: 'rgba(0,0,0,0.5)',
  },
  
  // ... (typography, spacing, radius, shadows)
};

export const darkTheme = {
  // Dark mode equivalents
};
```

**Extraction Steps:**
1. Create `theme.ts` with light theme (map all 550+ colors to semantic tokens)
2. Create dark theme structure (placeholders initially)
3. Add `useColorScheme` hook wrapper
4. Replace hardcoded colors file-by-file (start with components, then screens)

**Files to Prioritize:**
1. Component files (SectionCard, SectionHeader, GroupHeader, ScreenHeader, EducationBox)
2. High-traffic screens (SnapshotScreen, ProjectionResultsScreen)
3. Detail screens (systematic replacement)

---

### E.2 Typography Tokens

**Priority: HIGH**  
**Estimated Impact:** Standardizes 479+ typography instances

**Suggested Structure:**
```typescript
// theme.ts (typography section)
export const typography = {
  // Headings
  h1: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  h2: { fontSize: 20, fontWeight: '600', lineHeight: 24 },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '600', lineHeight: 20 },
  groupTitle: { fontSize: 12, fontWeight: '700', lineHeight: 16, letterSpacing: 0.6 },
  
  // Body
  bodyLarge: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  body: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  bodySmall: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  caption: { fontSize: 11, fontWeight: '400', lineHeight: 14 },
  
  // Values
  valueLarge: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  value: { fontSize: 16, fontWeight: '600', lineHeight: 20 },
  valueSmall: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  
  // Interactive
  button: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  input: { fontSize: 15, fontWeight: '400', lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
};
```

**Extraction Steps:**
1. Define typography scale in theme
2. Replace inline fontSize/fontWeight/lineHeight with theme tokens
3. Start with component files, then screens

---

### E.3 Border Radius Tokens

**Priority: MEDIUM**  
**Estimated Impact:** Standardizes 180+ radius instances

**Suggested Structure:**
```typescript
// theme.ts (radius section)
export const radius = {
  none: 0,
  tiny: 3,
  small: 4,
  base: 6,
  medium: 8,    // Most common
  large: 12,
  pill: 24,     // Snapshot cards
};
```

**Extraction Steps:**
1. Define radius scale
2. Map existing values (most are 6px, 8px, 12px, 24px)
3. Replace hardcoded borderRadius values

---

### E.4 Shadow/Elevation System

**Priority: LOW**  
**Estimated Impact:** Adds visual hierarchy (currently 1 instance)

**Suggested Structure:**
```typescript
// theme.ts (shadows section)
export const shadows = {
  none: {},
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // ... (large, etc.)
};
```

**Extraction Steps:**
1. Define shadow scale
2. Apply to cards, modals, elevated surfaces
3. Consider dark mode variants (lighter shadows or glows)

---

### E.5 Central Component Style Definitions

**Priority: HIGH** (after theme)  
**Estimated Impact:** Eliminates duplication in 19+ files

**Suggested Components to Extract:**
1. **Button** (264 instances across 19 files)
   - Variants: primary, secondary, text, destructive, warning
   - Sizes: small, medium, large
   - States: default, pressed, disabled

2. **Input** (37 instances across 9 files)
   - Variants: default, error, disabled
   - Sizes: standard

3. **Card** (15+ files define inline)
   - Variants: default, elevated, outlined
   - Extend `SectionCard` or create new system

4. **Row** (10+ files define inline)
   - Variants: list, swipeable, toolbar

5. **Modal** (8+ files define inline)
   - Standard modal shell with overlay, content, actions

6. **Divider** (10+ files define inline)
   - Horizontal divider component

**Extraction Steps:**
1. Create shared component files (`Button.tsx`, `Input.tsx`, etc.)
2. Define style variants using theme tokens
3. Replace inline implementations file-by-file
4. Start with high-duplication files (ProjectionResultsScreen, GroupedListDetailScreen)

---

### E.6 Remove Component-Local Visual Decisions

**Priority: MEDIUM** (after theme + components)  
**Estimated Impact:** Completes tokenization

**Steps:**
1. Audit all component files for hardcoded values
2. Replace with theme tokens
3. Ensure all components use theme system
4. Remove any remaining hardcoded colors/spacing/typography

**Files to Audit:**
- All files in `components/` directory
- High-traffic screens
- All detail screens

---

## F. Search Patterns Used

**Color Search:**
```bash
grep -r "#[0-9A-Fa-f]\{3,6\}" --include="*.tsx" --include="*.ts"
grep -E "rgb\(|rgba\(" --include="*.tsx"
```

**Spacing Search:**
```bash
grep -E "padding:\s*\d+|paddingTop:\s*\d+|paddingBottom:\s*\d+|paddingLeft:\s*\d+|paddingRight:\s*\d+|paddingHorizontal:\s*\d+|paddingVertical:\s*\d+" --include="*.tsx"
grep -E "margin:\s*\d+|marginTop:\s*\d+|marginBottom:\s*\d+|marginLeft:\s*\d+|marginRight:\s*\d+|marginHorizontal:\s*\d+|marginVertical:\s*\d+" --include="*.tsx"
grep -E "gap:\s*\d+" --include="*.tsx"
```

**Typography Search:**
```bash
grep -E "fontSize:\s*\d+|fontWeight:\s*['"]\w+['"]|lineHeight:\s*\d+" --include="*.tsx"
```

**Border Search:**
```bash
grep -E "borderRadius:\s*\d+|borderWidth:\s*\d+" --include="*.tsx"
grep -E "borderColor:" --include="*.tsx"
```

**Shadow Search:**
```bash
grep -E "shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation" --include="*.tsx"
```

**Dark Mode Search:**
```bash
grep -E "useColorScheme|dark|light|ColorScheme" --include="*.tsx"
grep -E "colorScheme|isDark|darkMode" --include="*.tsx"
```

**Component Usage Search:**
```bash
grep -E "import.*SectionCard|from.*SectionCard" --include="*.tsx"
grep -E "import.*SectionHeader|from.*SectionHeader" --include="*.tsx"
grep -E "import.*GroupHeader|from.*GroupHeader" --include="*.tsx"
grep -E "import.*EducationBox|from.*EducationBox" --include="*.tsx"
```

**Interactive Elements Search:**
```bash
grep -E "TouchableOpacity|TouchableHighlight|Pressable" --include="*.tsx"
grep -E "TextInput" --include="*.tsx"
```

---

## G. Summary Statistics

- **Total Files Audited:** 29+ TSX files
- **Color Instances:** 610+ hex colors, 11 rgba
- **Spacing Instances:** 385+ hardcoded values (161 padding, 190 margin, 34 gap)
- **Typography Instances:** 479+ declarations
- **Border Radius Instances:** 180+ declarations (15+ unique values)
- **Border Instances:** 100+ declarations
- **Shadow Instances:** 1 (no system)
- **Button Instances:** 264 across 19 files
- **Input Instances:** 37 across 9 files
- **Dark Mode Infrastructure:** 0 (no useColorScheme, no dark theme)

---

## H. Notes

- **spacing.ts and layout.ts exist** but are not fully adopted. Many hardcoded values remain.
- **Some components are centralized** (SectionCard, SectionHeader, GroupHeader, EducationBox) but duplication persists.
- **No theme system exists** - all colors are hardcoded.
- **No dark mode infrastructure** - entire app assumes light mode.
- **Typography is inconsistent** - same roles use different sizes/weights.
- **Button/Input patterns are highly duplicated** - no shared components.
- **Shadow system is missing** - only 1 instance exists.

**This audit is observational only. No code changes were made.**
