# Theme System

The app uses a centralized theme system for UI colors to enable consistent styling and future dark mode support.

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

## Theme Structure

Currently, the theme includes **colors only**. Typography, spacing, and radius tokens will be added in future roadmap items.

### Color Tokens

- `brand.primary` - Primary brand color (#2F5BEA)
- `text.primary` - Primary text color
- `text.secondary` - Secondary text color
- `text.tertiary` - Tertiary text color
- `text.muted` - Muted text color
- `text.disabled` - Disabled text color
- `bg.app` - App background color
- `bg.card` - Card background color
- `bg.subtle` - Subtle background color
- `border.default` - Default border color
- `border.subtle` - Subtle border color
- `semantic.error` - Error color
- `semantic.errorText` - Error text color
- `semantic.warning` - Warning color
- `semantic.warningBg` - Warning background color
- `semantic.warningText` - Warning text color
- `semantic.success` - Success color
- `overlay.scrim25` - 25% opacity overlay
- `overlay.scrim50` - 50% opacity overlay

## Rules

**New UI code should never introduce hardcoded hex colors.** Always use theme tokens via `useTheme()`.

Example:
```typescript
// ❌ Bad
<View style={{ backgroundColor: '#fff' }} />

// ✅ Good
const { theme } = useTheme();
<View style={{ backgroundColor: theme.colors.bg.card }} />
```

## Current Scope

- **Colors only** - Typography, spacing, and radius tokens are planned for future roadmap items
- **Shared components** - Currently applied to centralized components (SectionCard, SectionHeader, GroupHeader, ScreenHeader, EducationBox, DetailScreenShell)
- **Screens** - Screen-wide theme migration is a future roadmap item

## Implementation Notes

- Components use inline style overrides for theme colors while keeping `StyleSheet.create()` for static styles
- Light theme values match current dominant hardcoded values to preserve visuals
- Dark theme is complete but not yet enabled (requires screen-wide migration)
