# Plan: Sketch-Based UI Redesign (Excalidraw-Inspired)

## Context

The app is pivoting from polished fintech to a sketch-based, educational aesthetic. New direction: **"Use your money to learn about money."** Every screen teaches, not just displays. The styling should feel approachable and hand-drawn like Excalidraw — not another corporate finance app.

## Decisions Made

- **Font**: Everything uses Virgil (hand-drawn) — all text, not just headers
- **Dark mode**: Light only for now, add dark later once sketch look is validated
- **Sketch borders**: Full sketch borders using `react-native-svg` (already installed, v15.12.1) — custom `SketchCard` with wobbly bezier curves, no 3rd-party rough libs
- **Rollout**: Big bang — retheme everything at once

---

## Screen Color Map (from Excalidraw mockup)

| Screen Area | Background | Accent | Section Header Bg | Card Bg |
|------------|-----------|--------|-------------------|---------|
| Snapshot ("Where am I now?") | `#e7f5ff` (hachure) | `#1971c2` | `#a5d8ff` | `#ffffff` |
| Projection ("Where am I going?") | `#f8f1ee` (hachure) | `#f08c00` | `#ffec99` | `#ffffff` |
| Entry screens | `#f8f0fc` (hachure) | `#9c36b5` | `#eebefa` | `#ffffff` |
| What If | `#ebfbee` (hachure) | `#2f9e44` | `#b2f2bb` | `#ffffff` |
| Settings | `#e9ecef` (hachure) | `#868e96` | `#e9ecef` | `#ffffff` |

### Screen background: Hachure fill pattern
All screen backgrounds in the mockup use Excalidraw's **hachure** fill (cross-hatched lines drawn over the background color, roughness=1). This is a key part of the sketch aesthetic — not a flat color fill.

**Implementation**: Use `react-native-svg` to render a subtle hachure pattern (diagonal lines at ~45°) over the screen background color. This can be a `SketchBackground` component that renders an SVG pattern fill behind the screen content.

### Section headers: Accent-colored bars, no border
Section headers are **flat colored bars** (full width, ~33px height) with the screen's lighter accent color and **no border** (`stroke: transparent`). Text is dark (`#1e1e1e`).

| Screen | Section Headers | Header Bg |
|--------|----------------|-----------|
| Snapshot | "Your Monthly Cashflow" | `#a5d8ff` |
| Projection | "Key Milestones", "Your Future Projection", "Your Projection Explained" | `#ffec99` |
| Entry | "Quick Entry", "Monthly Expenses" | `#eebefa` |
| What If | "Things that I can do", "Things that might happen" | `#b2f2bb` |

---

## Detailed Screen Element Breakdown

### Common Layout Pattern (all 4 screens)

Every screen follows this structure top-to-bottom:

```
┌─ Screen (hachure-filled bg, accent-colored) ─────────┐
│                                                        │
│  [Title text, medium/20]            [AI circle badge]  │
│  x≈26 from left                     x≈354 from left   │
│ ────────────────────────────────────────────────────── │  ← full-width line, #1e1e1e
│  ┌─ Section Header Bar (accent-light bg, NO border)──┐ │
│  │  "Section Title" (medium/20, centered-ish)         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                        │
│  [ Content: cards / lists / charts ]                   │
│                                                        │
│  ┌─ Section Header Bar ─────────────────────────────┐  │
│  │  "Next Section" (medium/20)                       │  │
│  └────────────────────────────────────────────────────┘ │
│  [ More content ]                                      │
└────────────────────────────────────────────────────────┘
```

**Key structural changes from current app:**
- **Screen header** = Title (left) + AI badge circle (right) + separator line. NOT the current `ScreenHeader` component (which has border-bottom, padding, optional totalText etc.)
- **Section headers** = Full-width accent-colored bars (380px wide, 33px tall) with **no border** (`stroke: transparent`). NOT the current `SectionHeader` (which is just blue text with no background)
- **Section headers are standalone** — they're NOT inside `SectionCard`. They sit between cards/content blocks.
- **No `SectionCard` wrapping** in the current sense — content is either in white sketch-bordered cards or directly on the hachure background
- **No shadows** anywhere — depth via borders and color only
- **GroupHeader** concept merges into section header bars in the new design

### AI Badge (consistent across all screens)

- White-filled circle (ellipse 45x42), accent-colored stroke
- Contains "AI" text in accent color, size 16 (small)
- Positioned top-right (x≈354 relative to screen)
- Tappable — opens AI/educational features

### Screen 1: Snapshot — "Where am I now?" `#e7f5ff`

**Header**: "Where am I now?" (medium/20, black) + AI badge (blue `#1971c2`)

**Section: "Your Monthly Cashflow"** — bar bg `#a5d8ff`, no border

**Waterfall of value cards** (center-aligned, connected by arrows):
- "+14,000" Gross Income — white card 134x54, black stroke, label ~12 (tiny)
- Branches into two side-by-side cards:
  - "-5,800" Deductions — red stroke `#e03131` (left, x≈47)
  - "-2,400" Pension — green stroke `#2f9e44` (right, x≈252)
- "+8,250" Net Income — wider card 183x54, black stroke (centered)
- "-5,155" Expenses — red stroke `#e03131`
- "+3,120" Available Cash — wider card 236x54, **blue stroke** `#1971c2` (accent)
- Branches into two:
  - "0" Reduce Liabilities — green stroke (left)
  - "-1,600" Increase Assets — green stroke (right)
- "+1,450" Remaining Cash — card 286x54, **tinted bg** `#e3fafc`, blue stroke `#228be6`
  - Value text in **accent blue** `#1971c2` (not black)
  - Label "Remaining Cash in Hand" in black tiny

**CTA**: "see how can this money make a difference?" — small/16, accent blue `#1971c2`

**Card pattern**: Value (medium/20, black) on top, label (tiny/~12, black) below. Chevron ">" in light grey `#ced4da` on right of some cards. Arrows connect cards vertically.

### Screen 2: Projection — "Where am I going?" `#f8f1ee`

**Header**: "Where am I going?" (medium/20) + AI badge (amber `#f08c00`)

**Section: "Key Milestones"** — bar bg `#ffec99`, no border

**3 milestone circles** (119x115 ellipses, side by side, white bg, black stroke):
- "3.5y" / "your assets will last" — large/28 in **amber** `#f08c00`, label small/16 black
- "£1m" / "net worth by age 65" — same pattern
- "£1.4m" / "FIRE Number" — same pattern
- Circles evenly spaced: x≈23, x≈155, x≈287 (relative)

**Section: "Your Future Projection"** — bar bg `#ffec99`

**Chart area** (white rect 394x247, transparent stroke):
- "Retirement" label in green `#2f9e44` (small/16) with green arrow marker
- Multiple colored lines: green `#2f9e44`, red `#e03131`, blue `#1971c2`, black `#1e1e1e`
- X-axis line in black

**Section: "Your Projection Explained"** — bar bg `#ffec99`

**Explanation card** (white rect 371x148, transparent stroke):
- AI narrative text in small/16, black: "At Age 42-55 your money grows, after which you retire...."

### Screen 3: Entry — "Enter Expenses" `#f8f0fc`

**Header**: "Enter Expenses" (medium/20) + AI badge (purple `#9c36b5`)

**Section: "Quick Entry"** — bar bg `#eebefa`, no border

**Input row**:
- "New Expense Name" label (small/16) + input field (192x42, white, grey stroke `#343a40`)
- "Amount" label (small/16) + input field (102x43, white, grey stroke `#343a40`)
- "+" circle button (26x26, green tint bg `#ebfbee`, green text `#2f9e44`)
- "x" circle button (26x26, grey bg `#e9ecef`, grey text `#868e96`)

**Section: "Monthly Expenses"** — bar bg `#eebefa`

**List card** (white rect 371x430, transparent stroke — no sketch border):
- Row: "Mortgage Principal" (left) + "£500" (right) — both small/16, black
- Separator line in light grey `#ced4da`
- Row: "Mortgage Interest" + "£1,200"
- Separator
- Row: "Netflix" + "£11"
- More separators for empty rows

### Screen 4: What If — "What If... ?" `#ebfbee`

**Header**: "What If... ?" (medium/20) + AI badge (green `#2f9e44`)

**Section: "Things that I can do"** — bar bg `#b2f2bb`, no border

**2-column card grid** (176x109 each, white bg, teal stroke `#12b886`):
- Row 1: "Save & Grow More" | "My Mortgage Changes" — medium/20, green `#2f9e44`
- Gap between columns: ~16px (x≈26 and x≈218)

**Section: "Things that might happen"** — bar bg `#b2f2bb`

**2-column grid continues**:
- Row 2: "...I Retire Early" | "...I spend Less"
- Row 3: "...My income changes or stops" | "Spend Less"
- All card text in accent green `#2f9e44`, medium/20
- Row gap: ~20px between rows

---

## Key Design Patterns Across All Screens

1. **Screen header** = Title (medium/20, left at x≈26) + AI circle badge (right at x≈354) + full-width separator line
2. **Section headers** = Standalone accent-colored bars, full width (x≈24 to x≈404), 33px tall, **no border**, text centred. **Not inside any card.**
3. **Value cards** have semantic border colors: green=positive, red=negative, blue=accent/neutral, grey=input
4. **Only 4 font sizes**: ~12 (tiny), 16 (small), 20 (medium), 28 (large/hero)
5. **Text is almost always `#1e1e1e`** — accent color only for: hero values, AI badge, CTAs
6. **No shadows** — all depth via borders and background color
7. **Hachure background** on all screens — cross-hatched texture is the sketch signature
8. **White cards** — either with sketch borders (for interactive/value cards) or transparent stroke (for passive content like lists/charts)
9. **Card border colors**: `#1e1e1e` (default), `#2f9e44`/`#12b886` (positive/teal), `#e03131` (negative), `#1971c2`/`#228be6` (accent blue), `#343a40` (input), `#ced4da` (separator)

---

## Implementation Steps

### Step 1: Add Virgil Font

- Download Virgil `.ttf` from Excalidraw's GitHub repo (`excalidraw/virgil`)
- Place in `assets/fonts/Virgil-Regular.ttf`
- Add to Expo config (`app.json` or `expo` section) under fonts
- Verify it loads on iOS + Android

### Step 2: Simplify Typography to 4 Sizes

Replace the current 14-token typography system with 4 sizes, all using Virgil:

```ts
// New typography scale
const typography = {
  tiny:   { fontFamily: 'Virgil', fontSize: 12, lineHeight: 16 },   // captions, labels
  small:  { fontFamily: 'Virgil', fontSize: 16, lineHeight: 22 },   // body text, descriptions
  medium: { fontFamily: 'Virgil', fontSize: 20, lineHeight: 26 },   // section titles, values
  large:  { fontFamily: 'Virgil', fontSize: 28, lineHeight: 34 },   // hero numbers, screen titles
}
```

**Migration mapping** (old → new):
- `caption`, `bodySmall`, `label`, `groupTitle` → `tiny`
- `body`, `bodyMedium`, `bodyLarge`, `input`, `button` → `small`
- `header`, `sectionTitle`, `value`, `valueSmall` → `medium`
- `valueLarge`, `valueHero` → `large`

**Key file**: `ui/theme/theme.ts` — redefine `typography` object. Keep old token names as aliases initially for easier migration, then remove.

### Step 3: Create Screen Palettes

New file: `ui/theme/palettes.ts`

```ts
export type ScreenPalette = {
  bg: string;            // screen background (hachure-filled)
  accent: string;        // accent color (AI badge, highlights, values)
  sectionHeaderBg: string; // section header bar background (no border)
  cardBg: string;        // card fill (white)
  cardBorder: string;    // sketch card border stroke
  text: string;          // primary text (#1e1e1e)
  textSecondary: string; // secondary/muted text
}

export const palettes = {
  snapshot:   { bg: '#e7f5ff', accent: '#1971c2', sectionHeaderBg: '#a5d8ff', cardBg: '#ffffff', cardBorder: '#1e1e1e', text: '#1e1e1e', textSecondary: '#868e96' },
  projection: { bg: '#f8f1ee', accent: '#f08c00', sectionHeaderBg: '#ffec99', cardBg: '#ffffff', cardBorder: '#1e1e1e', text: '#1e1e1e', textSecondary: '#868e96' },
  entry:      { bg: '#f8f0fc', accent: '#9c36b5', sectionHeaderBg: '#eebefa', cardBg: '#ffffff', cardBorder: '#1e1e1e', text: '#1e1e1e', textSecondary: '#868e96' },
  whatIf:     { bg: '#ebfbee', accent: '#2f9e44', sectionHeaderBg: '#b2f2bb', cardBg: '#ffffff', cardBorder: '#1e1e1e', text: '#1e1e1e', textSecondary: '#868e96' },
  settings:   { bg: '#e9ecef', accent: '#868e96', sectionHeaderBg: '#e9ecef', cardBg: '#ffffff', cardBorder: '#1e1e1e', text: '#1e1e1e', textSecondary: '#868e96' },
}
```

**Delivery mechanism**: A `ScreenPaletteContext` provider that each screen sets. Components like `SectionHeader` and `SketchCard` read the active palette from context.

### Step 4: Build `SketchBackground` Component

New file: `components/SketchBackground.tsx`

- Uses `react-native-svg` to render a **hachure pattern** (diagonal cross-hatched lines) over the screen background color
- Props: `color` (the palette bg color), `style`
- Renders as an absolute-positioned SVG behind screen content
- Lines at ~45° angle, subtle opacity, matching Excalidraw's roughness=1 hachure
- Each screen wraps its content with this component

### Step 5: Build `SketchCard` Component

New file: `components/SketchCard.tsx`

- Uses `react-native-svg` (`Svg`, `Path`) — already installed
- Props: `width`, `height`, `children`, `borderColor`, `fillColor`, `style`
- Draws a wobbly rectangle via slightly offset bezier curves on each side
- The wobble = path imperfection (not rotation)
- All cards in the app use this instead of current `SectionCard`
- Must handle dynamic sizing (measure children via `onLayout`, or accept explicit dimensions)

**Note**: `react-native-svg` is installed (v15.12.1) but currently unused in the codebase — this will be its first usage.

### Step 6: Redesign `ScreenHeader` Component

Current `ScreenHeader` has: title, optional totalText, subtitle, subtitleFootnote, rightAccessory, border-bottom divider.

**New design**: Simple title left + AI badge circle right + full-width separator line below.
- Title: medium/20, `#1e1e1e`, at left padding
- AI badge: 45x42 white circle with accent-colored stroke, "AI" text in accent color (small/16)
- Separator: full-width 1px line in `#1e1e1e` (not theme border color)
- Remove: totalText, subtitle, subtitleFootnote (these move into screen content)
- The AI badge color comes from the active screen palette

### Step 7: Redesign `SectionHeader` Component

Current `SectionHeader`: blue text, no background, used inside SectionCard areas.

**New design**: Full-width accent-colored bar, 33px tall, **no border**, standalone.
- Background: palette's `sectionHeaderBg` (e.g. `#a5d8ff` for snapshot)
- Text: medium/20, `#1e1e1e` (dark, not accent colored)
- No border (`stroke: transparent`)
- Standalone — sits between content blocks, **never inside a card**
- Reads palette from `ScreenPaletteContext`
- `GroupHeader` is retired — all group headings become section header bars

### Step 8: Redesign `SectionCard` → `SketchCard`

Current `SectionCard`: white card with theme background, optional gradient, padding, margin, large radius.

**New design**: White card with wobbly SVG borders (or transparent stroke for passive content).
- `SketchCard` replaces `SectionCard` internals
- Props: `children`, `borderColor` (defaults to `#1e1e1e`), `fillColor` (defaults to white)
- Some cards have transparent stroke (list containers, chart areas) — pass `borderColor="transparent"`
- Some cards have semantic borders: green/red/blue — pass explicit `borderColor`
- No shadows, no gradients, no radius tokens (the wobble IS the radius)
- Modify `SectionCard` to render `SketchCard` internally for automatic migration of 28 usages

### Step 9: Update Theme System

Modify `ui/theme/theme.ts`:
- Remove `darkTheme` export (or keep as stub that returns light)
- Remove shadow system (sketch style = no shadows)
- Remove gradient support from cards
- Simplify color tokens to essentials (text, accent, semantic status colors)
- Remove `What-If` color schemes (replaced by palette system)
- Keep `radius` tokens (still needed for non-sketch elements like inputs)

Modify `ui/theme/useTheme.ts`:
- Always return light theme
- Add palette access (either from context or prop)

### Step 10: Apply Per-Screen Backgrounds with Hachure

Each screen's root container wraps content in `SketchBackground` with the palette's `bg` color, giving the cross-hatched sketch texture. Wire palettes through:
- Tab navigators (each tab's screens share a palette)
- Stack navigators (detail screens inherit parent tab's palette)

**Screen → Palette mapping**:
- Snapshot tab (all screens): `snapshot` palette
- Projection tab: `projection` palette
- Entry screens (income, expenses, assets, liabilities details): `entry` palette
- What If tab: `whatIf` palette
- Settings tab: `settings` palette

### Step 11: Update All 32 Screens

For each screen:
- Wrap root in `SketchBackground` with palette bg (hachure fill)
- Set `ScreenPaletteContext` provider with the correct palette for this screen's tab
- Replace `theme.typography.X` spreads with new `tiny/small/medium/large` tokens
- Replace `theme.colors.text.*` with `#1e1e1e` default or palette accent where needed
- Remove any shadow styling
- `SectionCard` → auto-migrated to SketchCard (Step 8)
- `SectionHeader` → auto-migrated to accent bars (Step 7)
- `GroupHeader` usages (17 files) → replace with `SectionHeader` (now that it's an accent bar)
- Move any totalText/subtitle from `ScreenHeader` into screen content
- `DetailScreenShell` — update to use new `ScreenHeader` + `SketchBackground`

---

## Files to Modify

| File | Change |
|------|--------|
| `ui/theme/theme.ts` | New typography (4 sizes, Virgil), remove dark theme, simplify colors |
| `ui/theme/useTheme.ts` | Light-only, add palette access |
| `ui/theme/ThemeContext.tsx` | Simplify (no dark mode toggle) |
| `components/ScreenHeader.tsx` | Title left + AI badge circle right + separator line. Remove totalText/subtitle props |
| `components/DetailScreenShell.tsx` | Wire up SketchBackground + new ScreenHeader + palette context |
| `components/SectionCard.tsx` | Render SketchCard internally (auto-migrates 28 usages) |
| `components/SectionHeader.tsx` | Full-width accent bar, no border, palette-aware |
| `components/GroupHeader.tsx` | Retire — replace usages with SectionHeader |
| All 32 screens in `screens/` | Update typography tokens, palette bg, migrate GroupHeader→SectionHeader |
| `app.json` / Expo config | Register Virgil font |

## Files to Create

| File | Purpose |
|------|---------|
| `assets/fonts/Virgil-Regular.ttf` | Hand-drawn font |
| `components/SketchCard.tsx` | Wobbly SVG card borders (bezier wobble, not rotation) |
| `components/SketchBackground.tsx` | Hachure-pattern (diagonal cross-hatch) screen background |
| `ui/theme/palettes.ts` | Per-screen color palettes + ScreenPaletteContext provider |

---

## Verification

1. Load app — confirm Virgil font renders on both iOS and Android
2. Navigate between all tabs — each screen shows correct **hachure-patterned** background color
3. Check SketchCard renders wobbly borders correctly at various sizes
4. Verify section headers show **accent-colored bars with no border**
5. Verify all text is readable at all 4 sizes (especially `tiny` at 12px in Virgil)
6. Confirm no functionality regressions (calculations, navigation, data entry)
7. Compare each screen visually against the Excalidraw mockup
8. Check that detail/sub-screens inherit their parent tab's palette + hachure bg
