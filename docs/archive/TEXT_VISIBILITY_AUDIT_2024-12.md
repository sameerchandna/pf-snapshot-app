# Text Visibility Audit - RowVisual Component

**Date:** 2024-12-19  
**Issue:** Row text is not visible in light or dark mode  
**Scope:** RowVisual component and related usage

---

## 1. Current Implementation Analysis

### 1.1 RowVisual Component Structure

**File:** `components/rows/RowVisual.tsx`

**Text Color Assignment:**
- **Title color** (line 118): `titleColor` 
  - Normal: `theme.colors.text.primary`
  - Locked: `theme.colors.text.muted`
- **Subtitle color** (line 152): `subtitleColor`
  - Normal: `theme.colors.text.muted`
  - Locked: `theme.colors.text.disabled`
- **Trailing color** (line 133): `trailingColor`
  - Normal: `theme.colors.text.primary`
  - Locked: `theme.colors.text.muted`

**Opacity Application:**
- Applied to `content` View container (line 109): `{ opacity }`
- Opacity calculation (lines 78-81):
  ```typescript
  let opacity = 1;
  if (dimmed) opacity = 0.45;
  else if (locked) opacity = 0.7;
  else if (inactive) opacity = 0.5;
  ```

**Background:**
- Row wrapper (line 96): `backgroundColor: theme.colors.bg.card`

---

## 2. Theme Color Values

### 2.1 Light Mode
```typescript
text: {
  primary: '#000',      // Black - should be visible on white
  muted: '#888',        // Medium grey - should be visible
  disabled: '#aaa',     // Light grey - should be visible
}
bg: {
  card: '#fff',         // White background
}
```

### 2.2 Dark Mode
```typescript
text: {
  primary: '#ffffff',   // White - should be visible on dark
  muted: '#707070',     // Medium grey - should be visible
  disabled: '#666666',  // Dark grey - should be visible
}
bg: {
  card: '#1a1a1a',      // Dark grey background
}
```

**Contrast Analysis:**
- Light mode: Black text (#000) on white (#fff) = ✅ High contrast
- Dark mode: White text (#ffffff) on dark (#1a1a1a) = ✅ High contrast

---

## 3. Potential Issues Identified

### Issue #1: Opacity Applied to Content Container
**Location:** Line 109
```typescript
<View style={[styles.content, { opacity }]}>
```

**Problem:**
- Opacity is applied to the entire content container, which includes all text
- If opacity is incorrectly calculated or defaults to a low value, text becomes invisible
- Opacity should be 1.0 by default (when not dimmed/locked/inactive)

**Verification:**
- Default opacity calculation appears correct (starts at 1)
- But if any state flags are incorrectly set, opacity could be reduced

### Issue #2: Style Array Ordering
**Location:** Lines 111-120 (title), 129-135 (trailing), 145-154 (subtitle)

**Current Pattern:**
```typescript
style={[
  styles.title,           // Static styles first
  {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    color: titleColor,    // Color set inline
  },
]}
```

**Potential Problem:**
- If `styles.title` contains a `color` property, it could override the inline color
- Need to verify `styles.title` doesn't have hardcoded color

**Check:**
- `styles.title` (line 203): Only contains `flex: 1` - ✅ No color conflict
- `styles.trailingText` (line 209): Only contains `textAlign: 'right'` - ✅ No color conflict
- `styles.subtitle` (line 212): Only contains `marginTop: 2` - ✅ No color conflict

### Issue #3: Obsolete Prop Being Passed
**Location:** `screens/ExpensesDetailScreen.tsx` line 291

**Problem:**
```typescript
<RowVisual
  ...
  showTopDivider={showTopDivider}  // ❌ This prop no longer exists!
/>
```

**Impact:**
- `showTopDivider` prop was removed from RowVisual Props type (line 31-42)
- Prop is being passed but ignored (TypeScript may not catch this if prop is spread)
- This is not the visibility issue, but indicates usage needs updating

### Issue #4: Trailing Text Uses Theme Typography
**Location:** Line 132

**Current:**
```typescript
<Text
  style={[
    styles.trailingText,
    theme.typography.valueSmall,  // ⚠️ This includes fontSize/lineHeight/weight
    { color: trailingColor },
  ]}
>
```

**Potential Problem:**
- `theme.typography.valueSmall` includes:
  - `fontSize: 14`
  - `fontWeight: '600'`
  - `lineHeight: 18`
- These values are applied BEFORE the inline color
- If `theme.typography.valueSmall` somehow includes a color property, it could override
- However, theme typography tokens should NOT include color (per THEME.md)

**Verification:**
- Theme typography tokens are font metrics only (no color) - ✅ Should be safe

### Issue #5: ContentStartX Calculation Timing
**Location:** Lines 85, 87-89

**Current:**
```typescript
const contentStartX = layout.rowPaddingHorizontal + (leading ? leadingWidth + spacing.sm : 0);
const [leadingWidth, setLeadingWidth] = useState(0);
```

**Problem:**
- `leadingWidth` starts at 0
- Only updates after `onLayout` fires
- This affects separator positioning, NOT text visibility
- Not the root cause

---

## 4. Root Cause Hypothesis

### Most Likely: Opacity State Issue

**Theory:**
The opacity value might be getting set incorrectly due to:
1. State flags (`dimmed`, `locked`, `inactive`) being incorrectly passed as `true` when they should be `false`
2. Opacity calculation logic issue
3. Opacity being applied to wrong element

**Evidence:**
- Text colors are correctly assigned
- Theme colors have proper contrast
- Opacity is the only thing that could make text invisible while still rendering

**Debug Steps Needed:**
1. Check what values `dimmed`, `locked`, `inactive` have when text is invisible
2. Check what `opacity` value is actually being applied
3. Verify `theme.colors.text.primary` is resolving correctly
4. Check if opacity is being applied to parent containers (inheritance)

### Alternative: Text Color Not Applied

**Theory:**
The inline `color` style might not be taking effect due to:
1. Style specificity issue
2. React Native style merging bug
3. Color value being undefined/null

**Evidence:**
- Style array ordering looks correct
- No conflicting colors in static styles
- But if `titleColor`/`subtitleColor`/`trailingColor` are undefined, text would be invisible

**Debug Steps Needed:**
1. Log `titleColor`, `subtitleColor`, `trailingColor` values
2. Verify `theme.colors.text.primary` is not undefined
3. Check if color is being overridden by parent styles

---

## 5. Code Issues Found

### 5.1 Obsolete Prop Usage
**File:** `screens/ExpensesDetailScreen.tsx:291`
- Passing `showTopDivider` prop that no longer exists in RowVisual
- Should be removed (not causing visibility issue, but should be cleaned up)

### 5.2 Missing isLastInGroup Prop
**File:** `screens/ExpensesDetailScreen.tsx:274-292`
- RowVisual is being used but `isLastInGroup` prop is not being passed
- This affects separator rendering, not text visibility
- Should be added for proper separator behavior

---

## 6. Recommended Fixes

### Fix #1: Verify Opacity Values
**Action:** Add console logging or React DevTools inspection to verify:
- What are the actual values of `dimmed`, `locked`, `inactive`?
- What is the calculated `opacity` value?
- Is opacity being applied correctly?

### Fix #2: Verify Color Values
**Action:** Add console logging to verify:
- What is `theme.colors.text.primary` value?
- What is `titleColor` value?
- Are colors being applied to Text components?

### Fix #3: Check Parent Container Styles
**Action:** Verify if any parent containers (SemanticRow, SwipeRowContainer, etc.) are applying:
- Opacity that could compound
- Background colors that could hide text
- Transform/positioning that could move text off-screen

### Fix #4: Remove Obsolete Prop
**Action:** Remove `showTopDivider` prop from ExpensesDetailScreen usage

### Fix #5: Add isLastInGroup Prop
**Action:** Pass `isLastInGroup` prop to RowVisual in ExpensesDetailScreen (if using grouped lists)

---

## 7. Testing Checklist

- [ ] Verify text is visible in light mode (normal state)
- [ ] Verify text is visible in dark mode (normal state)
- [ ] Verify text is visible when `locked={true}` (should be muted but visible)
- [ ] Verify text is visible when `inactive={true}` (should be dimmed but visible)
- [ ] Verify text is visible when `dimmed={true}` (should be very dim but visible)
- [ ] Verify title text color matches theme
- [ ] Verify subtitle text color matches theme
- [ ] Verify trailing text color matches theme
- [ ] Verify opacity values are correct for each state
- [ ] Verify no parent containers are affecting visibility

---

## 8. Most Likely Root Cause

**Primary Hypothesis:** Opacity is being incorrectly applied or calculated, making text invisible.

**Secondary Hypothesis:** Text color values are undefined/null, causing React Native to render transparent text.

**Tertiary Hypothesis:** Parent container (SemanticRow/SwipeRowContainer) is applying styles that hide text.

---

## 9. Immediate Debug Steps

1. **Add temporary logging:**
   ```typescript
   console.log('RowVisual render:', {
     titleColor,
     subtitleColor,
     trailingColor,
     opacity,
     dimmed,
     locked,
     inactive,
     themeTextPrimary: theme.colors.text.primary,
   });
   ```

2. **Inspect computed styles in React DevTools:**
   - Check if Text components have color applied
   - Check if opacity is being applied
   - Check if any parent styles are overriding

3. **Test with hardcoded colors:**
   ```typescript
   color: '#000000'  // Force black in light mode
   color: '#FFFFFF'  // Force white in dark mode
   ```
   If this works, the issue is with theme color resolution.

---

**End of Audit**
