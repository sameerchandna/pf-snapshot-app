/**
 * Semantic layout aliases - maps design intent to spacing values.
 * 
 * These provide meaningful names for common layout patterns and preserve
 * all spacing values not in the primary token set. All values are preserved
 * exactly as they exist in the codebase - no visual changes.
 * 
 * Usage:
 *   import { layout } from './layout';
 *   padding: layout.screenPadding
 *   marginBottom: layout.sectionGap
 */
import { spacing } from './spacing';

export const layout = {
  // Screen-level spacing
  screenPadding: spacing.xl,              // 16 - standard screen content padding
  screenPaddingTop: spacing.base,         // 12 - top padding for scroll content
  screenPaddingBottom: spacing.base,      // 12 - bottom padding for scroll content
  
  // Section spacing
  sectionGap: spacing.section,             // 20 - gap between major sections
  sectionTitleBottom: spacing.tiny,        // 4 - margin below section titles
  sectionSubtextBottom: spacing.base,      // 12 - margin below section subtext
  
  // Education/Info blocks
  educationBottom: 14,                    // 14 - margin below education blocks (non-primary value)
  educationPadding: spacing.base,         // 12 - padding inside education blocks
  
  // Block/Card spacing
  blockPadding: spacing.base,             // 12 - standard block/card padding
  blockPaddingLarge: spacing.xl,          // 16 - larger block padding
  blockPaddingSmall: spacing.sm,          // 8 - smaller block padding
  
  // Component spacing
  componentGap: spacing.sm,                // 8 - gap between related components
  componentGapSmall: spacing.xs,          // 6 - smaller component gap
  componentGapTiny: 2,                    // 2 - tiny component gap (non-primary value)
  
  // Input/Form spacing
  inputPadding: 10,                       // 10 - padding inside inputs (non-primary value)
  inputPaddingHorizontal: spacing.base,   // 12 - horizontal input padding
  inputPaddingVertical: spacing.sm,       // 8 - vertical input padding
  inputMarginBottom: spacing.base,        // 12 - margin below inputs
  amountInputWidth: 130,                  // 130 - standard width for amount input fields
  
  // Modal/Sheet spacing
  modalPadding: spacing.xl,               // 16 - modal content padding
  modalPaddingTop: 14,                     // 14 - modal top padding (non-primary value)
  modalPaddingBottom: 18,                  // 18 - modal bottom padding (non-primary value)
  modalTitleBottom: 10,                    // 10 - margin below modal titles (non-primary value)
  modalListBottom: spacing.base,           // 12 - padding bottom for modal lists
  
  // Header spacing
  headerPadding: spacing.xl,               // 16 - screen header padding
  headerTitleBottom: spacing.tiny,          // 4 - margin below header titles
  headerSubtitleTop: spacing.sm,          // 8 - margin top for subtitles
  
  // Chart spacing (specialized values)
  chartPadding: 32,                        // 32 - standard chart padding (non-primary value)
  chartPaddingLeft: 52,                   // 52 - chart left padding for labels (non-primary value)
  chartPaddingTop: 14,                    // 14 - chart top padding (non-primary value)
  chartPaddingBottom: 22,                  // 22 - chart bottom padding (non-primary value)
  
  // List/Row spacing
  rowGap: spacing.sm,                     // 8 - gap between rows
  rowPadding: spacing.xl,                 // 16 - padding inside rows
  rowPaddingHorizontal: spacing.xl,       // 16 - horizontal row padding
  rowPaddingVertical: spacing.sm,         // 8 - vertical row padding
  
  // Toolbar spacing
  toolbarPadding: spacing.xl,             // 16 - toolbar horizontal padding
  toolbarPaddingVertical: spacing.sm,      // 8 - toolbar vertical padding
  toolbarGap: spacing.xs,                 // 6 - gap between toolbar items
  
  // Help/Hint spacing
  helpSectionDividerTop: spacing.xl,      // 16 - margin top for help section dividers
  helpSectionDividerPaddingTop: spacing.xl, // 16 - padding top for help sections
  helpParagraphBottom: 10,                 // 10 - margin bottom for help paragraphs (non-primary value)
  helpBulletBottom: spacing.xs,           // 6 - margin bottom for help bullets
  
  // Button spacing
  buttonPadding: 10,                      // 10 - button padding (non-primary value)
  buttonPaddingHorizontal: spacing.section, // 20 - button horizontal padding
  buttonPaddingVertical: 10,              // 10 - button vertical padding (non-primary value)
  
  // Divider spacing
  dividerBottom: 14,                      // 14 - margin below dividers (non-primary value)
  
  // Cash Flow indentation
  flowIndent: spacing.xl,                 // 16 - indentation for Cash Flow sub-items
  flowIndentContent: 24,                  // 24 - left column indentation for Cash Flow sub-items
  
  // Screen background colors
  screenBackground: '#F5F6F8',            // Light grey background for Snapshot/Accounts screens
  
  // Additional non-primary values preserved
  micro: 2,                               // 2 - tightest spacing (text block gaps)
  xxs: 5,                                 // 5 - rare gaps
  md: 10,                                 // 10 - medium-small spacing (alias for convenience)
  lg: 14,                                 // 14 - large-medium spacing (alias for convenience)
  xxl: 18,                                // 18 - extra extra large (alias for convenience)
  xxxl: 22,                               // 22 - rare chart padding (alias for convenience)
  giant: 28,                              // 28 - giant spacing (alias for convenience)
  chart: 32,                              // 32 - chart padding (alias for convenience)
  chartLeft: 52,                          // 52 - chart left padding (alias for convenience)
} as const;