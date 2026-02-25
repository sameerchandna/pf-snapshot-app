# Apple-Native Parity Audit: RowVisual, SemanticRow, and Grouped List Containers

**Date:** 2024-12-19  
**Scope:** Visual implementation audit only (no code changes)  
**Reference:** `/docs/ARCHITECTURE.md`, `/docs/INVARIANTS.md`

---

## 1. RowVisual Inspection

### 1.1 ROW_HEIGHT
- **Current PF App:** `44` (constant defined in `RowVisual.tsx:46`)
- **Apple UIKit Default:** `44pt` (UITableViewCell default)
- **Delta:** `0` ✅
- **Status:** **CORRECT** - Matches Apple HIG exactly

### 1.2 Title Typography
- **Current PF App:**
  - `fontSize: 14` (via `theme.typography.bodyLarge`)
  - `lineHeight: 20` (via `theme.typography.bodyLarge`)
  - `fontWeight: '400'` (regular, via `theme.typography.bodyLarge`)
- **Apple UIKit Default:**
  - `fontSize: 17pt` (UIFont.systemFont(ofSize: 17))
  - `lineHeight: 22pt` (system default for 17pt)
  - `fontWeight: regular` (UIFontWeightRegular)
- **Delta:**
  - Font size: `-3pt` (14 vs 17)
  - Line height: `-2pt` (20 vs 22)
  - Font weight: `0` ✅
- **Recommended Adjustment:** Increase title fontSize to `17` and lineHeight to `22` to match Apple standard

### 1.3 Subtitle Typography
- **Current PF App:**
  - `fontSize: 11` (via `theme.typography.bodySmall`)
  - `lineHeight: 14` (via `theme.typography.bodySmall`)
  - `fontWeight: '400'` (regular, via `theme.typography.bodySmall`)
- **Apple UIKit Default:**
  - `fontSize: 15pt` (UIFont.systemFont(ofSize: 15) for detailTextLabel)
  - `lineHeight: 20pt` (system default for 15pt)
  - `fontWeight: regular` (UIFontWeightRegular)
- **Delta:**
  - Font size: `-4pt` (11 vs 15)
  - Line height: `-6pt` (14 vs 20)
  - Font weight: `0` ✅
- **Recommended Adjustment:** Increase subtitle fontSize to `15` and lineHeight to `20` to match Apple standard

### 1.4 Horizontal Padding
- **Current PF App:** `layout.rowPaddingHorizontal` = `spacing.xl` = `16`
- **Apple UIKit Default:** `16pt` (UITableViewCell standard contentView padding)
- **Delta:** `0` ✅
- **Status:** **CORRECT** - Matches Apple standard

### 1.5 Leading Spacing
- **Current PF App:** `spacing.sm` = `8` (marginRight on leading container)
- **Apple UIKit Default:** `8pt` (standard spacing between imageView and textLabel)
- **Delta:** `0` ✅
- **Status:** **CORRECT** - Matches Apple standard

### 1.6 Trailing Spacing
- **Current PF App:** `spacing.sm` = `8` (marginLeft on trailing container)
- **Apple UIKit Default:** `8pt` (standard spacing between textLabel and accessoryView)
- **Delta:** `0` ✅
- **Status:** **CORRECT** - Matches Apple standard

### 1.7 Separator Implementation
- **Current PF App:**
  - Width: `StyleSheet.hairlineWidth` (~0.5pt on most devices)
  - Color: `theme.colors.border.muted` = `rgba(240, 240, 240, 0.35)`
  - Position: Top border on rowWrapper (conditional via `showTopDivider`)
- **Apple UIKit Default:**
  - Width: `0.5pt` (hairline)
  - Color: `rgba(60, 60, 67, 0.29)` (light mode) / `rgba(84, 84, 88, 0.65)` (dark mode)
  - Position: Bottom border on cell (standard) or top border (first cell in section)
- **Delta:**
  - Width: `~0` ✅ (hairline matches)
  - Color: **DIFFERENT** - Current uses very light grey with low opacity, Apple uses darker grey with higher opacity
  - Position: **DIFFERENT** - Current uses top border, Apple typically uses bottom border
- **Recommended Adjustment:**
  - Update separator color to match Apple standard: `rgba(60, 60, 67, 0.29)` for light mode
  - Consider using bottom border instead of top border for consistency with Apple pattern

### 1.8 Subtitle Top Margin
- **Current PF App:** `spacing.tiny` = `4` (marginTop on subtitle)
- **Apple UIKit Default:** `2pt` (standard spacing between textLabel and detailTextLabel)
- **Delta:** `+2pt` (4 vs 2)
- **Recommended Adjustment:** Reduce subtitle marginTop to `2` to match Apple standard

---

## 2. EditableCollectionScreen (Group Container) Inspection

### 2.1 Section Inset from Screen Edges
- **Current PF App:**
  - ScrollView content padding: `spacing.base` = `12` (all sides)
  - SectionCard padding: `spacing.base` = `12` (all sides)
  - Total effective inset: `12pt` from screen edges
- **Apple UIKit Default:**
  - Grouped UITableView style: `0pt` inset (sections extend to screen edges)
  - Section content padding: `0pt` (padding handled by cell insets)
- **Delta:** `+12pt` (current has padding, Apple has none)
- **Recommended Adjustment:** Remove SectionCard padding or reduce to `0` for grouped list sections to match Apple grouped style

### 2.2 Card Background Usage
- **Current PF App:**
  - SectionCard uses: `theme.colors.bg.card` = `#fff` (white)
  - RowVisual uses: `theme.colors.bg.card` = `#fff` (white)
- **Apple UIKit Default:**
  - Grouped UITableView style: `#F2F2F7` (system grouped background)
  - Cell background: `#FFFFFF` (white) for cells
- **Delta:**
  - Card background: **DIFFERENT** - Current uses white, Apple uses light grey system background
  - Row background: `0` ✅ (white matches)
- **Recommended Adjustment:** Use `theme.colors.bg.app` (`#F5F6F8`) for SectionCard background to better match Apple grouped style (though current is close)

### 2.3 Corner Radius
- **Current PF App:** `12` (SectionCard borderRadius)
- **Apple UIKit Default:** `10pt` (standard grouped UITableView section corner radius)
- **Delta:** `+2pt` (12 vs 10)
- **Recommended Adjustment:** Reduce SectionCard borderRadius to `10` to match Apple standard

### 2.4 Separator Inset Alignment
- **Current PF App:**
  - Separator: Full width (no inset, uses borderTopWidth on rowWrapper)
  - Row padding: `16pt` horizontal
- **Apple UIKit Default:**
  - Separator inset: `16pt` from left edge (standard UITableView separatorInset)
  - Separator extends to right edge
- **Delta:**
  - Left inset: `0pt` (current separator starts at left edge, Apple starts at 16pt)
  - Right inset: `0pt` ✅ (both extend to right edge)
- **Recommended Adjustment:** Add `16pt` left inset to separator to match Apple standard (separator should align with text content, not edge)

### 2.5 Border Color Usage
- **Current PF App:**
  - Separator: `theme.colors.border.muted` = `rgba(240, 240, 240, 0.35)`
  - SectionCard: No border (uses background color only)
- **Apple UIKit Default:**
  - Separator: `rgba(60, 60, 67, 0.29)` (light mode)
  - Section: No border (uses background color contrast)
- **Delta:** Separator color differs (see 1.7)
- **Recommended Adjustment:** Update separator color to match Apple standard

---

## 3. Theme Tokens Inspection

### 3.1 bg.app vs bg.card
- **Current PF App:**
  - `bg.app`: `#F5F6F8` (light grey, used for screen backgrounds)
  - `bg.card`: `#fff` (white, used for cards and rows)
- **Apple UIKit Default:**
  - System grouped background: `#F2F2F7` (slightly different grey)
  - Cell background: `#FFFFFF` (white)
- **Delta:**
  - `bg.app`: `#F5F6F8` vs `#F2F2F7` (slightly different, but close)
  - `bg.card`: `0` ✅ (white matches)
- **Status:** **ACCEPTABLE** - Current values are close to Apple standard, minor difference in grouped background color

### 3.2 border.default vs border.subtle
- **Current PF App:**
  - `border.default`: `#e0e0e0` (light grey)
  - `border.subtle`: `#f0f0f0` (very light grey)
  - `border.muted`: `rgba(240, 240, 240, 0.35)` (very subtle, used for separators)
- **Apple UIKit Default:**
  - Standard border: `rgba(60, 60, 67, 0.29)` (light mode separator)
  - Subtle border: Similar opacity-based approach
- **Delta:** Current uses lighter, more transparent borders than Apple standard
- **Recommended Adjustment:** Consider adding Apple-standard separator color token

### 3.3 text.secondary Mapping
- **Current PF App:** `theme.colors.text.secondary` = `#666` (medium grey)
- **Apple UIKit Default:** `UIColor.secondaryLabel` = `rgba(60, 60, 67, 0.6)` (light mode)
- **Delta:** Current uses `#666` (RGB: 102, 102, 102), Apple uses `rgba(60, 60, 67, 0.6)` ≈ `rgba(60, 60, 67, 0.6)`
- **Status:** **ACCEPTABLE** - Both provide secondary text hierarchy, slight color difference

---

## 4. SemanticRow Inspection

### 4.1 Component Structure
- **Current PF App:** Pure gesture-to-meaning adapter (no visual styling)
- **Apple UIKit Default:** N/A (gesture handling is built into UITableViewCell)
- **Status:** **N/A** - SemanticRow is architectural layer, not visual component

### 4.2 Visual Impact
- **Current PF App:** No direct visual styling (delegates to RowVisual)
- **Status:** **N/A** - No visual audit needed for SemanticRow

---

## 5. Summary Comparison Table

| Property | Current PF App | Apple UIKit Default | Delta | Recommended Adjustment |
|----------|---------------|---------------------|-------|------------------------|
| **RowVisual** |
| ROW_HEIGHT | 44 | 44pt | 0 | ✅ No change |
| Title fontSize | 14 | 17pt | -3pt | Increase to 17 |
| Title lineHeight | 20 | 22pt | -2pt | Increase to 22 |
| Title fontWeight | 400 | regular | 0 | ✅ No change |
| Subtitle fontSize | 11 | 15pt | -4pt | Increase to 15 |
| Subtitle lineHeight | 14 | 20pt | -6pt | Increase to 20 |
| Subtitle fontWeight | 400 | regular | 0 | ✅ No change |
| Horizontal padding | 16 | 16pt | 0 | ✅ No change |
| Leading spacing | 8 | 8pt | 0 | ✅ No change |
| Trailing spacing | 8 | 8pt | 0 | ✅ No change |
| Subtitle top margin | 4 | 2pt | +2pt | Reduce to 2 |
| Separator width | hairline (~0.5pt) | 0.5pt | ~0 | ✅ No change |
| Separator color | rgba(240,240,240,0.35) | rgba(60,60,67,0.29) | Different | Update to Apple standard |
| Separator position | Top border | Bottom border | Different | Consider bottom border |
| **Group Container** |
| Section inset | 12pt | 0pt | +12pt | Remove/reduce padding |
| Card background | #fff | #F2F2F7 | Different | Use bg.app for sections |
| Corner radius | 12 | 10pt | +2pt | Reduce to 10 |
| Separator left inset | 0pt | 16pt | -16pt | Add 16pt left inset |
| **Theme Tokens** |
| bg.app | #F5F6F8 | #F2F2F7 | Close | ✅ Acceptable |
| bg.card | #fff | #FFFFFF | 0 | ✅ No change |
| border.muted | rgba(240,240,240,0.35) | rgba(60,60,67,0.29) | Different | Update to Apple standard |
| text.secondary | #666 | rgba(60,60,67,0.6) | Close | ✅ Acceptable |

---

## 6. Critical Findings

### 6.1 Typography Mismatches
- **Title text is 3pt smaller** than Apple standard (14 vs 17)
- **Subtitle text is 4pt smaller** than Apple standard (11 vs 15)
- **Impact:** Text appears smaller and less readable compared to native iOS apps

### 6.2 Separator Implementation
- **Separator color is too light** compared to Apple standard
- **Separator lacks left inset** (should align with text content at 16pt)
- **Impact:** Separators are less visible and don't align with content

### 6.3 Section Styling
- **Corner radius is 2pt larger** than Apple standard (12 vs 10)
- **Section has padding** where Apple grouped style has none
- **Impact:** Sections appear more rounded and inset than native iOS grouped lists

---

## 7. Recommendations Summary

### High Priority (Visual Parity)
1. ✅ **ROW_HEIGHT: 44** - Already correct, maintain
2. ⚠️ **Title typography** - Increase fontSize to 17, lineHeight to 22
3. ⚠️ **Subtitle typography** - Increase fontSize to 15, lineHeight to 20
4. ⚠️ **Separator color** - Update to `rgba(60, 60, 67, 0.29)` for light mode
5. ⚠️ **Separator inset** - Add 16pt left inset to align with text content
6. ⚠️ **Corner radius** - Reduce SectionCard borderRadius from 12 to 10

### Medium Priority (Visual Polish)
7. ⚠️ **Subtitle margin** - Reduce marginTop from 4 to 2
8. ⚠️ **Section padding** - Consider removing SectionCard padding for grouped lists
9. ⚠️ **Separator position** - Consider using bottom border instead of top border

### Low Priority (Acceptable Differences)
10. ✅ **bg.app color** - Current `#F5F6F8` is close to Apple `#F2F2F7`, acceptable
11. ✅ **text.secondary** - Current `#666` provides similar hierarchy, acceptable

---

## 8. Implementation Notes

### 8.1 Invariant Compliance
- ✅ **ROW_HEIGHT = 44** must remain unchanged (per `/docs/INVARIANTS.md`)
- All typography and spacing adjustments must maintain this invariant

### 8.2 Architecture Compliance
- ✅ All changes are visual-only (per `/docs/ARCHITECTURE.md`)
- No state ownership changes required
- No business logic modifications needed

### 8.3 Theme Token Updates
- Consider adding `border.separator` token with Apple-standard color
- Typography adjustments can be made via theme tokens without code changes

---

## 9. Next Steps (If Implementing)

1. **Update theme typography tokens:**
   - `bodyLarge`: fontSize 14 → 17, lineHeight 20 → 22
   - `bodySmall`: fontSize 11 → 15, lineHeight 14 → 20

2. **Update separator styling:**
   - Add `border.separator` token: `rgba(60, 60, 67, 0.29)`
   - Update RowVisual separator to use new token
   - Add 16pt left inset to separator

3. **Update SectionCard:**
   - Reduce borderRadius from 12 to 10
   - Consider removing padding for grouped list contexts

4. **Update subtitle spacing:**
   - Reduce marginTop from `spacing.tiny` (4) to `2`

5. **Test visual parity:**
   - Compare side-by-side with native iOS Settings app
   - Verify ROW_HEIGHT remains 44
   - Verify all spacing maintains alignment

---

**End of Audit**
