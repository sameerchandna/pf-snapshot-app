# Theme System

The app uses a centralized theme system for UI styling to enable consistent design and dark mode support.

Theme is a centralized, read-only design system that provides visual tokens for colors, typography, radius, and shadows.

## Theme File Location

Theme definitions live in `ui/theme/theme.ts`.

This file exports:
- `lightTheme` - Light mode color tokens (matches current app visuals)
- `darkTheme` - Dark mode color tokens (for future dark mode support)
- `Theme` - TypeScript type for theme objects

## Accessing Theme

Use the `useTheme()` hook from `ui/theme/useTheme.ts`:

```typescript
import { useTheme } from '../ui/theme/useTheme';

function MyComponent() {
  const { theme, isDark } = useTheme();
  
  return (
    <View style={{ backgroundColor: theme.colors.bg.card }}>
      <Text style={{ color: theme.colors.text.primary }}>Hello</Text>
    </View>
  );
}
```

The hook automatically detects the system color scheme and returns the appropriate theme. It falls back to light theme if the scheme is unknown.

## Theme Scope

Theme is a centralized, read-only design system that includes:
- **Color tokens** - Brand, text, background, border, semantic, domain, chart, and overlay colors
- **Typography tokens** - Font size, weight, line height for all text styles
- **Radius tokens** - Border radius values for UI elements
- **Shadow tokens** - Elevation and emphasis shadows

Theme must NOT include:
- **Spacing or layout** - These live in `spacing.ts` and `layout.ts` and are locked
- **Logic, conditionals, or UI behavior** - Theme is purely visual tokens

## Theme Structure

### Color Tokens

**Brand Colors:**
- `brand.primary` - Primary brand color (#2F5BEA)
- `brand.tint` - Brand tint background (#e8f0ff) - Light blue tint for active states and highlights
- `brand.onPrimary` - Content color used on top of brand.primary surfaces (icons, checkmarks, labels)

**Text Colors:**
- `text.primary` - Primary text color (highest contrast)
- `text.secondary` - Secondary text color (medium contrast)
- `text.tertiary` - Tertiary text color (used for #333/#444 mappings)
- `text.muted` - Muted text color (lower contrast)
- `text.disabled` - Disabled text color (lowest contrast)

**Background Colors:**
- `bg.app` - App background color (root container)
- `bg.card` - Card background color (elevated surfaces)
- `bg.subtle` - Subtle background color (pressed states, highlights)

**Border Colors:**
- `border.default` - Default border color (standard dividers)
- `border.subtle` - Subtle border color (light dividers, grid lines)
- `border.muted` - Very subtle border color (low-salience structural borders for dense UI surfaces, ~35–40% opacity) - Used to reduce visual noise without removing affordance, not semantic (not success/error/warning)

**Semantic Colors:**
- `semantic.error` - Error color
- `semantic.errorText` - Error text color
- `semantic.errorBg` - Error background color
- `semantic.errorBorder` - Error border color
- `semantic.warning` - Warning color
- `semantic.warningBg` - Warning background color
- `semantic.warningText` - Warning text color
- `semantic.success` - Success color
- `semantic.successText` - Success text color
- `semantic.successBg` - Success background color
- `semantic.successBorder` - Success border color
- `semantic.info` - Informational color (muted blue for informational text)
- `semantic.infoText` - Informational text color (muted brand blue for scenario deltas and informational content)

**Domain Colors:**
- `domain.asset` - Asset color (green, #5A8A5A)
- `domain.liability` - Liability color (red, #B85A5A)

**Chart Colors:**
- `chart.netWorthFill` - Net worth fill color (neutral grey)
- `chart.markerLine` - Marker line color (muted grey)

**Overlay Colors:**
- `overlay.scrim25` - 25% opacity overlay
- `overlay.scrim50` - 50% opacity overlay

## Hard Rules

### No Hardcoded Colors
**No hardcoded hex/rgb colors in screens or components.** Always use theme tokens via `useTheme()`.

Example:
```typescript
// ❌ Bad
<View style={{ backgroundColor: '#fff' }} />

// ✅ Good
const { theme } = useTheme();
<View style={{ backgroundColor: theme.colors.bg.card }} />
```

### Typography Tokens

**Text Styles:**
- `typography.header` - Screen/page headers (20px, semibold)
- `typography.sectionTitle` - Section titles (16px, semibold)
- `typography.groupTitle` - Group headers (12px, bold, uppercase)
- `typography.bodyLarge` - Large body text (14px, regular)
- `typography.body` - Standard body text (12px, regular)
- `typography.bodySmall` - Small body text (11px, regular)
- `typography.caption` - Captions and footnotes (10px, regular)

**Value Styles:**
- `typography.valueLarge` - Large values (18px, semibold)
- `typography.value` - Standard values (15px, semibold)
- `typography.valueSmall` - Small values (14px, semibold)

**Interactive Styles:**
- `typography.button` - Button text (14px, semibold)
- `typography.input` - Input text (15px, regular)
- `typography.label` - Form labels (12px, semibold)

**Usage:**
```typescript
// ✅ Good
<Text style={theme.typography.header}>Title</Text>
<Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>Body</Text>

// ❌ Bad
<Text style={{ fontSize: 16, fontWeight: '600' }}>Title</Text>
```

### Radius Tokens

- `radius.none` - No radius (0)
- `radius.small` - Small radius (4px) - Small buttons, toggles
- `radius.base` - Base radius (6px) - Standard buttons, pills
- `radius.medium` - Medium radius (8px) - Cards, modals, inputs (most common)
- `radius.large` - Large radius (12px) - Section cards
- `radius.pill` - Pill radius (24px) - Circular pills, profile icons

**Usage:**
```typescript
// ✅ Good
<View style={{ borderRadius: theme.radius.medium }} />

// ❌ Bad
<View style={{ borderRadius: 8 }} />
```

### Shadow Tokens

- `shadows.none` - No shadow (empty object)
- `shadows.small` - Small shadow (elevation: 1, subtle)
- `shadows.medium` - Medium shadow (elevation: 3, standard cards)

**Usage:**
```typescript
// ✅ Good
<View style={[styles.card, theme.shadows.medium]} />

// ❌ Bad
<View style={{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
}} />
```

**Note:** React Native shadow limitations mean `shadowColor` in tokens is hardcoded to `#000`. This is acceptable as shadows are primarily used for elevation, not color. For dark mode, consider using lighter shadow colors or alternative elevation techniques if needed.

### Token Usage Rules

**General Rules:**
- All visual styling must use theme tokens where applicable
- Tokens must map to existing visual values unless an explicit redesign phase states otherwise
- Typography, radius, and shadow values should use theme tokens when available
- No hardcoded numeric values for fontSize, fontWeight, borderRadius, or shadow properties

### Dark Mode
- Dark mode already exists via light/dark theme palettes
- Phase 7 work removes remaining light-mode assumptions only
- No screen should special-case light vs dark mode manually
- Theme hook automatically handles light/dark switching

### Pressed States

**CRITICAL RULE: Opacity-based pressed states are NOT permitted.**

Opacity-based pressed states break dark mode compatibility and violate theme principles. All pressed states must use background color changes.

**Correct Pattern:**
```typescript
// ✅ Good
<Pressable
  style={({ pressed }) => [
    styles.button,
    { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' }
  ]}
>
  <Text>Button</Text>
</Pressable>
```

**Incorrect Pattern:**
```typescript
// ❌ Bad - DO NOT USE
<Pressable
  style={({ pressed }) => [
    styles.button,
    { opacity: pressed ? 0.7 : 1 }
  ]}
>
  <Text>Button</Text>
</Pressable>
```

**Pressed State Colors:**
- Default pressed background: `theme.colors.bg.subtle`
- Destructive pressed background: `theme.colors.semantic.errorBg`
- Pressed-state rules apply app-wide

## Safety Principle

- Theme extensions must be additive
- Introducing new token categories must not cause visual change unless explicitly intended
- Existing color tokens are stable and must not be changed without explicit redesign approval

## Semantic Color Usage Rules

**Informational Colors (`semantic.info`, `semantic.infoText`):**
- `semantic.infoText` - Used for muted informational text, scenario delta values, and secondary brand-related content
- Intended for: Scenario delta values, muted brand-related information, informational text that needs brand association but lower emphasis
- NOT for: Primary brand actions, error/warning/success states, general text content
- Usage context: Projection scenario deltas, muted value indicators, informational highlights

**Brand Tint (`brand.tint`):**
- Used for active state backgrounds, toggle active states, and brand-related highlights
- Intended for: Active button/toggle backgrounds, brand-related surface highlights, active state indicators
- NOT for: Text colors, border colors, general backgrounds, error/warning/success states
- Usage context: Toolbar pill active states, chart toggle active states, brand-related active indicators

## Border Color Usage Rules

**Border Tokens (`border.default`, `border.subtle`, `border.muted`):**
- `border.default` - Standard dividers, card borders, input borders (full opacity, clear separation)
- `border.subtle` - Light dividers, grid lines, secondary separators (reduced opacity, gentle separation)
- `border.muted` - Very subtle structural borders for dense UI surfaces (~35–40% opacity, minimal visual noise)
  - Intended for: Dense list rows, grouped card borders, structural elements where borders should signal grouping without competing with content
  - NOT for: Semantic borders (use `semantic.successBorder`, `semantic.errorBorder`), primary card borders, interactive element borders
  - Usage context: Snapshot Cash Flow rows, dense grouped lists, vertical narrative layouts
  - Dark mode: Uses ~40% opacity (slightly higher than light mode's ~35%) to maintain sufficient contrast
  - Purpose: Reduces visual noise while preserving hierarchy, grouping, and interaction affordances

## Inline Style Exceptions (React Native Constraints)

React Native has limitations that require some inline styles:

**Allowed Inline Styles:**
1. **Theme color overrides** - When applying theme colors dynamically:
   ```typescript
   <View style={[styles.card, { backgroundColor: theme.colors.bg.card }]} />
   ```

2. **Conditional styling** - When styles depend on state or props:
   ```typescript
   <Text style={[
     styles.text,
     { color: isActive ? theme.colors.brand.primary : theme.colors.text.secondary }
   ]} />
   ```

3. **Pressed state styling** - When using Pressable pressed callbacks:
   ```typescript
   <Pressable
     style={({ pressed }) => [
       styles.button,
       { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' }
     ]}
   />
   ```

**Prohibited Inline Styles:**
- Hardcoded hex/rgb colors (must use theme tokens)
- Hardcoded fontSize/fontWeight (must use typography tokens)
- Hardcoded borderRadius (must use radius tokens)
- Hardcoded shadow properties (must use shadow tokens)
- Opacity-based pressed states (must use background color changes)

## Current Status

- **Colors** - Complete light/dark palettes defined and in use
- **Typography** - Tokens defined (Phase 7.3), migration in progress (Phase 7.13)
- **Radius** - Tokens defined (Phase 7.3), migration in progress (Phase 7.13)
- **Shadows** - Tokens defined (Phase 7.3), migration in progress (Phase 7.13)
- **Spacing/layout** - Explicitly excluded from theme (see `spacing.ts` and `layout.ts`)
- **Shared components** - Theme-aware (SectionCard, SectionHeader, GroupHeader, ScreenHeader, EducationBox, DetailScreenShell, Icon, IconButton, Row, Divider)
- **Screens** - Partial migration complete, remaining screens in Phase 7.13

## Implementation Notes

- Components use inline style overrides for theme colors while keeping `StyleSheet.create()` for static styles
- Light theme values match current dominant hardcoded values to preserve visuals
- Dark theme is complete and ready for use once all screens are tokenized
- Theme hook automatically handles light/dark switching based on system preference
