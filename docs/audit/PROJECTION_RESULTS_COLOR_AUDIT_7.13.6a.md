# ProjectionResultsScreen Color Tokenization Audit — Phase 7.13.6a

**Date:** 2024-12-19  
**Scope:** Staged color tokenization audit (UI-only, no code changes)  
**File Audited:** `screens/ProjectionResultsScreen.tsx`  
**Total Hardcoded Colors Found:** ~138 instances

**Exclusions:**
- Chart internals (Victory components) — excluded from scope
- Shadow colors (`shadowColor: '#000'`) — acceptable per theme system rules

---

## Summary

**Stage A (Text & Border Colors):** ~96 instances  
**Stage B (Background & Surface Colors):** ~21 instances  
**Stage C (Semantic & Accent Colors):** ~21 instances

---

## Stage A — Text & Border Colors

### Text Colors

| Line | Color | Context | Proposed Token |
|------|-------|---------|----------------|
| 472 | `#999` | snapshotPrimaryValue (muted text) | `theme.colors.text.muted` |
| 4694 | `#111` | toolbarButtonText | `theme.colors.text.primary` |
| 4720 | `#999` | quickWhatIfHint | `theme.colors.text.muted` |
| 4724 | `#2F5BEA` | quickWhatIfHintAmount (brand) | `theme.colors.brand.primary` |
| 4736 | `#777` | quickLabel | `theme.colors.text.secondary` |
| 4756 | `#111` | quickWhatIfSelectorValue | `theme.colors.text.primary` |
| 4760 | `#777` | quickWhatIfPlaceholder | `theme.colors.text.secondary` |
| 4765 | `#999` | quickWhatIfHelper | `theme.colors.text.muted` |
| 4776 | `#111` | quickWhatIfAmountInput | `theme.colors.text.primary` |
| 4786 | `#999` | quickWhatIfAvailableCash | `theme.colors.text.muted` |
| 4790 | `#2F5BEA` | quickWhatIfAvailableCashAmount (brand) | `theme.colors.brand.primary` |
| 4795 | `#d32f2f` | quickWhatIfError (error) | `theme.colors.semantic.error` |
| 4802 | `#aaa` | clearScenarioText | `theme.colors.text.disabled` |
| 4815 | `#666` | educationText | `theme.colors.text.secondary` |
| 4846 | `#999` | chartMiniToggleText | `theme.colors.text.muted` |
| 4850 | `#2f5cff` | chartMiniToggleTextActive (brand variant) | `theme.colors.brand.primary` |
| 4872 | `#111` | toggleCardTitle | `theme.colors.text.primary` |
| 4877 | `#999` | toggleCardSubtitle | `theme.colors.text.muted` |
| 4989 | `#999` | outcomeSubtitle | `theme.colors.text.muted` |
| 4994 | `#333` | outcomeSummary | `theme.colors.text.tertiary` |
| 5015 | `#999` | ageSelectorLabel | `theme.colors.text.muted` |
| 5021 | `#111` | ageSelectorValue | `theme.colors.text.primary` |
| 5037 | `#111` | ageSelectorControlLabel | `theme.colors.text.primary` |
| 5047 | `#111` | ageSelectorControlValue | `theme.colors.text.primary` |
| 5060 | `#111` | keyDriversTitle | `theme.colors.text.primary` |
| 5075 | `#333` | keyDriversLabel | `theme.colors.text.tertiary` |
| 5080 | `#111` | keyDriversValue | `theme.colors.text.primary` |
| 5091 | `#2F5BEA` | keyDriversValuePositive (brand) | `theme.colors.brand.primary` |
| 5098 | `#999` | keyDriversValueNeutral | `theme.colors.text.muted` |
| 5115 | `#111` | keyDriversValueNegative | `theme.colors.text.primary` |
| 5120 | `#555` | keyDriversValueNegativeLabel | `theme.colors.text.secondary` |
| 5126 | `#999` | keyDriversValueNegativeSubtext | `theme.colors.text.muted` |
| 5142 | `#333` | keyDriversRowLabel | `theme.colors.text.tertiary` |
| 5147 | `#111` | keyDriversRowValue | `theme.colors.text.primary` |
| 5166 | `#999` | keyDriversRowValueNeutral | `theme.colors.text.muted` |
| 5173 | `#2F5BEA` | keyDriversRowValuePositive (brand) | `theme.colors.brand.primary` |
| 5180 | `#999` | keyDriversRowValueNegative | `theme.colors.text.muted` |
| 5192 | `#2F5BEA` | keyDriversRowValuePositiveLarge (brand) | `theme.colors.brand.primary` |
| 5199 | `#999` | keyDriversRowValueNeutralLarge | `theme.colors.text.muted` |
| 5206 | `#999` | keyDriversRowValueNegativeLarge | `theme.colors.text.muted` |
| 5213 | `#999` | keyDriversRowValueNeutralSmall | `theme.colors.text.muted` |
| 5220 | `#2F5BEA` | keyDriversRowValuePositiveSmall (brand) | `theme.colors.brand.primary` |
| 5237 | `#999` | keyDriversRowValueNegativeSmall | `theme.colors.text.muted` |
| 5244 | `#2F5BEA` | keyDriversRowValuePositiveTiny (brand) | `theme.colors.brand.primary` |
| 5251 | `#999` | keyDriversRowValueNeutralTiny | `theme.colors.text.muted` |
| 5262 | `#111` | keyDriversRowValueNegativeTiny | `theme.colors.text.primary` |
| 5273 | `#999` | keyDriversRowValueNeutralMicro | `theme.colors.text.muted` |
| 5278 | `#111` | keyDriversRowValueNegativeMicro | `theme.colors.text.primary` |
| 5282 | `#999` | keyDriversRowValueNeutralNano | `theme.colors.text.muted` |
| 5287 | `#2F5BEA` | keyDriversRowValuePositiveNano (brand) | `theme.colors.brand.primary` |
| 5293 | `#999` | keyDriversRowValueNeutralNano | `theme.colors.text.muted` |
| 5313 | `#111` | modalOptionText | `theme.colors.text.primary` |
| 5329 | `#111` | modalOptionTextSecondary | `theme.colors.text.primary` |
| 5334 | `#666` | modalOptionTextSecondary | `theme.colors.text.secondary` |
| 5348 | `#777` | modalOptionMetadata | `theme.colors.text.secondary` |
| 5353 | `#777` | modalEmptyText | `theme.colors.text.secondary` |
| 5359 | `#777` | modalOptionSubtext | `theme.colors.text.secondary` |
| 5371 | `#999` | projectedHeaderLabel | `theme.colors.text.muted` |
| 5376 | `#999` | projectedHeaderValue | `theme.colors.text.muted` |
| 5382 | `#999` | projectedHeaderSubtext | `theme.colors.text.muted` |
| 5433 | `#ddd` | projectedHeaderDivider | `theme.colors.border.subtle` |
| 5509 | `#333` | projectedLabel | `theme.colors.text.tertiary` |
| 5515 | `#999` | projectedValue | `theme.colors.text.muted` |
| 5521 | `#111` | projectedValueBold | `theme.colors.text.primary` |
| 5526 | `#999` | projectedValueNeutral | `theme.colors.text.muted` |
| 5531 | `#999` | projectedValueNeutralSmall | `theme.colors.text.muted` |
| 5537 | `#999` | projectedValueNeutralTiny | `theme.colors.text.muted` |
| 5541 | `#5B8DEF` | projectedDeltaScenario (muted brand blue) | `theme.colors.brand.primary` (or new token?) |
| 5544 | `#999` | projectedDeltaAge | `theme.colors.text.muted` |
| 5547 | `#2F5BEA` | projectedPrimaryValueScenario (brand) | `theme.colors.brand.primary` |
| 5589 | `#ddd` | dualValueDivider | `theme.colors.border.subtle` |
| 5611 | `#bbb` | balanceSheetDualColumnDivider | `theme.colors.border.subtle` |
| 5629 | `#333` | balanceSheetLabel | `theme.colors.text.tertiary` |
| 5638 | `#2F5BEA` | balanceSheetValuePositive (brand) | `theme.colors.brand.primary` |
| 5641 | `#999` | balanceSheetValueNeutral | `theme.colors.text.muted` |
| 5645 | `#999` | balanceSheetValueNegative | `theme.colors.text.muted` |
| 5659 | `#999` | balanceSheetValueNeutralSmall | `theme.colors.text.muted` |
| 5670 | `#999` | balanceSheetValueNeutralTiny | `theme.colors.text.muted` |
| 5683 | `#666` | balanceSheetSubtext | `theme.colors.text.secondary` |
| 5688 | `#999` | balanceSheetSubtextMuted | `theme.colors.text.muted` |
| 5705 | `#000` | balanceSheetValueBold | `theme.colors.text.primary` |
| 5708 | `#666` | balanceSheetValueBoldSecondary | `theme.colors.text.secondary` |
| 5711 | `#666` | balanceSheetValueBoldTertiary | `theme.colors.text.secondary` |
| 5717 | `#000` | balanceSheetValueBoldQuaternary | `theme.colors.text.primary` |
| 5726 | `#999` | balanceSheetValueNeutralQuaternary | `theme.colors.text.muted` |
| 5732 | `#999` | balanceSheetValueNeutralQuinary | `theme.colors.text.muted` |
| 5736 | `#8FA8D4` | balanceSheetValuePositiveMuted (muted blue) | `theme.colors.brand.primary` (or new token?) |
| 5758 | `#999` | balanceSheetValueNeutralSextary | `theme.colors.text.muted` |
| 5778 | `#999` | balanceSheetValueNeutralSeptenary | `theme.colors.text.muted` |
| 5792 | `#333` | balanceSheetLabelSecondary | `theme.colors.text.tertiary` |
| 5804 | `#999` | balanceSheetValueNeutralOctonary | `theme.colors.text.muted` |
| 5810 | `#111` | balanceSheetValueBoldOctonary | `theme.colors.text.primary` |
| 5818 | `#ef4444` | reconciliationFail (error) | `theme.colors.semantic.error` |
| 5830 | `#991b1b` | reconciliationWarningText (error text) | `theme.colors.semantic.errorText` |
| 5844 | `#856404` | warningBannerText (warning text) | `theme.colors.semantic.warningText` |
| 5860 | `#856404` | modalWarningBannerText (warning text) | `theme.colors.semantic.warningText` |

### Border Colors

| Line | Color | Context | Proposed Token |
|------|-------|---------|----------------|
| 4712 | `#eee` | quickWhatIfContainer borderTopColor | `theme.colors.border.subtle` |
| 4714 | `#eee` | quickWhatIfContainer borderBottomColor | `theme.colors.border.subtle` |
| 4740 | `#f0f0f0` | quickWhatIfSelector borderColor | `theme.colors.border.subtle` |
| 4770 | `#f0f0f0` | quickWhatIfAmountInput borderColor | `theme.colors.border.subtle` |
| 4780 | `#d32f2f` | quickWhatIfAmountInputError borderColor (error) | `theme.colors.semantic.error` |
| 5000 | `#f0f0f0` | ageSelector borderColor | `theme.colors.border.subtle` |
| 5052 | `#e8e8e8` | keyDriversCard borderColor | `theme.colors.border.default` |
| 5105 | `#f0f0f0` | keyDriversCardSecondary borderColor | `theme.colors.border.subtle` |
| 5325 | `#eee` | modalOption borderBottomColor | `theme.colors.border.subtle` |
| 5491 | `#d8d8d8` | projectedCard borderColor | `theme.colors.border.default` |
| 5503 | `#d8d8d8` | projectedCardSecondary borderColor | `theme.colors.border.default` |
| 5604 | `#d8d8d8` | balanceSheetCard borderColor | `theme.colors.border.default` |
| 5624 | `#e8e8e8` | balanceSheetCardSecondary borderColor | `theme.colors.border.default` |
| 5674 | `#e5e5e5` | balanceSheetCardTertiary borderColor | `theme.colors.border.default` |
| 5698 | `#f0f0f0` | balanceSheetCardQuaternary borderColor | `theme.colors.border.subtle` |
| 5774 | `#ddd` | balanceSheetCardQuinary borderColor | `theme.colors.border.subtle` |
| 5784 | `#f0f0f0` | balanceSheetCardSextary borderColor | `theme.colors.border.subtle` |
| 5823 | `#fecaca` | reconciliationWarning borderColor (error) | `theme.colors.semantic.errorBorder` |
| 5840 | `#ffc107` | warningBanner borderColor (warning) | `theme.colors.semantic.warning` |
| 5856 | `#ffc107` | modalWarningBanner borderColor (warning) | `theme.colors.semantic.warning` |

---

## Stage B — Background & Surface Colors

| Line | Color | Context | Proposed Token |
|------|-------|---------|----------------|
| 4596 | `#e8f0ff` | toolbarPillButtonActive (brand tint) | `theme.colors.bg.subtle` (or new brand tint token?) |
| 4704 | `#fafafa` | toolbarIconButton backgroundColor | `theme.colors.bg.subtle` |
| 4715 | `#fafafa` | quickWhatIfContainer backgroundColor | `theme.colors.bg.subtle` |
| 4820 | `#e0e0e0` | hairlineDivider backgroundColor | `theme.colors.border.default` |
| 4837 | `#f2f2f2` | chartMiniToggle backgroundColor | `theme.colors.bg.subtle` |
| 4842 | `#e8f0ff` | chartMiniToggleActive backgroundColor (brand tint) | `theme.colors.bg.subtle` (or new brand tint token?) |
| 4854 | `#fafafa` | toggleCard backgroundColor | `theme.colors.bg.subtle` |
| 5025 | `#fafafa` | ageSelectorControlRow backgroundColor | `theme.colors.bg.subtle` |
| 5050 | `#fafafa` | keyDriversCard backgroundColor | `theme.colors.bg.subtle` |
| 5103 | `#f8f8f8` | keyDriversCardSecondary backgroundColor | `theme.colors.bg.subtle` |
| 5339 | `#eee` | modalDivider backgroundColor | `theme.colors.border.subtle` |
| 5408 | `#f0f0f0` | projectedCard backgroundColor | `theme.colors.bg.subtle` |
| 5558 | `#ddd` | dualValueDivider backgroundColor | `theme.colors.border.subtle` |
| 5580 | `#ddd` | balanceSheetDualColumnDivider backgroundColor | `theme.colors.border.subtle` |
| 5620 | `#fafafa` | balanceSheetCard backgroundColor | `theme.colors.bg.subtle` |
| 5673 | `#f9f9f9` | balanceSheetCardTertiary backgroundColor | `theme.colors.bg.subtle` |
| 5769 | `#f0f0f0` | balanceSheetCardQuinary backgroundColor | `theme.colors.bg.subtle` |
| 5782 | `#fafafa` | balanceSheetCardSextary backgroundColor | `theme.colors.bg.subtle` |
| 5821 | `#fef2f2` | reconciliationWarning backgroundColor (error) | `theme.colors.semantic.errorBg` |
| 5837 | `#fff3cd` | warningBanner backgroundColor (warning) | `theme.colors.semantic.warningBg` |
| 5853 | `#fff3cd` | modalWarningBanner backgroundColor (warning) | `theme.colors.semantic.warningBg` |

---

## Stage C — Semantic & Accent Colors

### Error Colors

| Line | Color | Context | Proposed Token |
|------|-------|---------|----------------|
| 4780 | `#d32f2f` | quickWhatIfAmountInputError borderColor | `theme.colors.semantic.error` |
| 4795 | `#d32f2f` | quickWhatIfError text color | `theme.colors.semantic.error` |
| 5818 | `#ef4444` | reconciliationFail text color | `theme.colors.semantic.error` |
| 5821 | `#fef2f2` | reconciliationWarning backgroundColor | `theme.colors.semantic.errorBg` |
| 5823 | `#fecaca` | reconciliationWarning borderColor | `theme.colors.semantic.errorBorder` |
| 5830 | `#991b1b` | reconciliationWarningText text color | `theme.colors.semantic.errorText` |

### Warning Colors

| Line | Color | Context | Proposed Token |
|------|-------|---------|----------------|
| 5837 | `#fff3cd` | warningBanner backgroundColor | `theme.colors.semantic.warningBg` |
| 5840 | `#ffc107` | warningBanner borderColor | `theme.colors.semantic.warning` |
| 5844 | `#856404` | warningBannerText text color | `theme.colors.semantic.warningText` |
| 5853 | `#fff3cd` | modalWarningBanner backgroundColor | `theme.colors.semantic.warningBg` |
| 5856 | `#ffc107` | modalWarningBanner borderColor | `theme.colors.semantic.warning` |
| 5860 | `#856404` | modalWarningBannerText text color | `theme.colors.semantic.warningText` |

### Brand/Acent Colors (Requiring Review)

| Line | Color | Context | Proposed Token | Notes |
|------|-------|---------|----------------|-------|
| 4724 | `#2F5BEA` | quickWhatIfHintAmount | `theme.colors.brand.primary` | ✅ Exact match |
| 4790 | `#2F5BEA` | quickWhatIfAvailableCashAmount | `theme.colors.brand.primary` | ✅ Exact match |
| 4850 | `#2f5cff` | chartMiniToggleTextActive | `theme.colors.brand.primary` | ⚠️ Slight variant (#2F5BEA vs #2f5cff) |
| 4596 | `#e8f0ff` | toolbarPillButtonActive bg | `theme.colors.bg.subtle` | ⚠️ Brand tint — may need new token |
| 4842 | `#e8f0ff` | chartMiniToggleActive bg | `theme.colors.bg.subtle` | ⚠️ Brand tint — may need new token |
| 5091 | `#2F5BEA` | keyDriversValuePositive | `theme.colors.brand.primary` | ✅ Exact match |
| 5173 | `#2F5BEA` | keyDriversRowValuePositive | `theme.colors.brand.primary` | ✅ Exact match |
| 5220 | `#2F5BEA` | keyDriversRowValuePositiveSmall | `theme.colors.brand.primary` | ✅ Exact match |
| 5244 | `#2F5BEA` | keyDriversRowValuePositiveTiny | `theme.colors.brand.primary` | ✅ Exact match |
| 5287 | `#2F5BEA` | keyDriversRowValuePositiveNano | `theme.colors.brand.primary` | ✅ Exact match |
| 5541 | `#5B8DEF` | projectedDeltaScenario | `theme.colors.brand.primary` | ⚠️ Muted brand blue — may need new token |
| 5547 | `#2F5BEA` | projectedPrimaryValueScenario | `theme.colors.brand.primary` | ✅ Exact match |
| 5638 | `#2F5BEA` | balanceSheetValuePositive | `theme.colors.brand.primary` | ✅ Exact match |
| 5736 | `#8FA8D4` | balanceSheetValuePositiveMuted | `theme.colors.brand.primary` | ⚠️ Muted blue — may need new token |

---

## Ambiguous Cases Requiring Review

### 1. Brand Tint Background (`#e8f0ff`)
- **Locations:** Lines 4596, 4842
- **Context:** Active state backgrounds for toolbar pills and chart toggles
- **Current:** Hardcoded light blue tint
- **Options:**
  - Use `theme.colors.bg.subtle` (accepts visual change)
  - Create new `theme.colors.brand.tint` token (requires theme extension)

### 2. Brand Color Variants
- **`#2f5cff`** (line 4850): Slightly different from `#2F5BEA`
  - **Decision:** Use `theme.colors.brand.primary` (accepts slight visual change)
- **`#5B8DEF`** (line 5541): Muted brand blue
  - **Decision:** Use `theme.colors.brand.primary` or create new token?
- **`#8FA8D4`** (line 5736): Muted blue
  - **Decision:** Use `theme.colors.brand.primary` or create new token?

### 3. Border Color Variations
- Multiple subtle border colors (`#eee`, `#f0f0f0`, `#e8e8e8`, `#e5e5e5`, `#ddd`, `#d8d8d8`)
- **Decision:** Map to `theme.colors.border.subtle` or `theme.colors.border.default` based on context

---

## Implementation Notes

1. **Shadow colors** (`shadowColor: '#000'`) are acceptable per theme system rules and should remain unchanged.

2. **Chart internals** (Victory components) are explicitly excluded from scope.

3. **Visual regression risk:** Some color mappings may result in slight visual differences (e.g., `#2f5cff` → `#2F5BEA`, various border shades → standard tokens).

4. **Brand tint backgrounds:** The `#e8f0ff` brand tint appears in active states. Decision needed on whether to accept `bg.subtle` or create new token.

---

## Next Steps

1. **Review ambiguous cases** (brand tints, color variants)
2. **Confirm token mapping decisions** for edge cases
3. **Proceed with Stage A implementation** (text & border colors only)
4. **Verify light mode visual regression** after Stage A
5. **Proceed to Stage B** (backgrounds) after Stage A approval
6. **Proceed to Stage C** (semantic/accent) after Stage B approval

---

## Explicit Confirmation

**No engine, semantic, layout, or logic changes proposed.**

This audit is UI-only and focuses exclusively on identifying hardcoded color values for replacement with theme tokens. No changes to:
- Projection engine
- Snapshot semantics
- Layout or spacing systems
- Business logic or data models
- Component behavior or interaction patterns
