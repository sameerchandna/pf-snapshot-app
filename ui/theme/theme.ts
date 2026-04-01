/**
 * Central theme system for UI styling.
 * 
 * This file defines light and dark theme tokens for colors, typography, radius, and shadows.
 * 
 * Light theme values match current dominant hardcoded values to preserve visuals.
 * Dark theme provides a complete palette for future dark mode support.
 * 
 * Phase 7.3: Typography, radius, and shadow tokens added (define only, not yet used).
 */

export const lightTheme = {
  colors: {
    brand: {
      primary: '#2F5BEA',
      primaryPressed: '#254EDB', // Darker shade of primary for pressed/active states
      tint: '#e8f0ff', // Light blue tint for active states and highlights
      onPrimary: '#ffffff', // Content color used on top of brand.primary surfaces (icons, checkmarks, labels)
    },
    text: {
      primary: '#000',
      secondary: '#666',
      tertiary: '#333', // Used for #333 and #444 mappings
      subtle: '#777',   // Mid-tone text between secondary and muted
      muted: '#888',
      disabled: '#aaa', // Used in ScreenHeader subtitleFootnote
    },
    bg: {
      app: '#F5F6F8',
      card: '#fff',
      subtle: '#fafafa',
      input: '#fbfbfb', // Interactive input surface - subtly darker than card, softer tone
      cardGradientTop: '#fff', // Derived from bg.card (same value for subtle gradient start)
      cardGradientBottom: '#f8f8f8', // Derived from bg.subtle, slightly darker than card for subtle gradient end
      subtlePressed: '#eaeaea', // Pressed state for subtle/secondary interactive surfaces
    },
    border: {
      default: '#e0e0e0',
      subtle: '#f0f0f0',
      muted: 'rgba(240, 240, 240, 0.35)', // Very subtle border for reduced visual noise (~35% opacity)
      separator: 'rgba(60, 60, 67, 0.29)', // Apple-standard separator color for grouped lists
    },
    semantic: {
      error: '#dc2626',
      errorText: '#8a1f1f',
      errorBg: '#fff5f5',
      errorBorder: '#ffd6d6',
      warning: '#f59e0b',
      warningBg: '#fff7db',
      warningText: '#5a4b1b',
      success: '#22c55e',
      successText: '#2d8659',
      successBg: '#eaf7ee',
      successBorder: '#d0e8d6',
      info: '#5B8DEF', // Muted brand blue for informational content
      infoText: '#5B8DEF', // Muted brand blue for informational text (scenario deltas, muted values)
    },
    domain: {
      asset: '#5A8A5A',
      liability: '#B85A5A',
    },
    chart: {
      netWorthFill: '#999999', // Neutral grey, no hue
      markerLine: '#888888', // Muted grey for age reference line
    },
    overlay: {
      scrim25: 'rgba(0,0,0,0.25)',
      scrim40: 'rgba(0,0,0,0.4)',
      scrim50: 'rgba(0,0,0,0.5)',
      heroNumberGlow: 'rgba(47, 91, 234, 0.12)', // Derived from brand.primary (#2F5BEA) at 12% opacity for subtle glow
    },
    shadow: {
      color: '#000', // Canonical shadow color — use instead of hardcoding '#000' in shadow styles
    },
    actions: {
      edit: {
        bg: 'rgba(0,0,0,0.04)',
        bgPressed: 'rgba(0,0,0,0.08)', // 2× alpha for pressed feedback
        icon: '#000', // Matches text.primary
      },
      delete: {
        bg: 'rgba(255,59,48,0.12)',
        bgPressed: 'rgba(255,59,48,0.22)', // +0.1 alpha for pressed feedback
        icon: '#FF3B30',
      },
    },
    whatif: {
      sage:       { cardBg: '#EDF5ED', cardBgPressed: '#DCF0DC', iconBg: '#CEEACE', title: '#254A25', body: '#4A7A4A' },
      teal:       { cardBg: '#EDF5F5', cardBgPressed: '#D0EBEB', iconBg: '#C0E0E0', title: '#1A4A4A', body: '#3A7070' },
      rose:       { cardBg: '#F5EDEE', cardBgPressed: '#EDD8DA', iconBg: '#EDD0D2', title: '#5E2830', body: '#8A5058' },
      amber:      { cardBg: '#FBF5EC', cardBgPressed: '#F2E2C6', iconBg: '#F5DEBC', title: '#5A3800', body: '#8A6020' },
      periwinkle: { cardBg: '#EDF0FC', cardBgPressed: '#D8DFF8', iconBg: '#C8D4F4', title: '#1A3478', body: '#4060A8' },
      lavender:   { cardBg: '#F1EDFC', cardBgPressed: '#E0D4F5', iconBg: '#D8CCF4', title: '#321878', body: '#6048A8' },
      mint:       { cardBg: '#EDFAF2', cardBgPressed: '#D0F0DE', iconBg: '#C0EDD4', title: '#1A4A30', body: '#3A7A50' },
      grey:       { cardBg: '#F1F1F5', cardBgPressed: '#E4E4EC', iconBg: '#E4E4EA', title: '#BBBBCC', body: '#CCCCDD' },
    },
  },
  typography: {
    header: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
    groupTitle: {
      fontSize: 12,
      fontWeight: '700' as const,
      lineHeight: 16,
      letterSpacing: 0.6,
    },
    bodyLarge: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    body: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
    bodyMedium: {
      fontSize: 13,
      fontWeight: '400' as const,
      lineHeight: 18,
    },
    bodySmall: {
      fontSize: 11,
      fontWeight: '400' as const,
      lineHeight: 14,
    },
    caption: {
      fontSize: 10,
      fontWeight: '400' as const,
      lineHeight: 14,
    },
    valueLarge: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 22,
    },
    valueHero: {
      fontSize: 22,
      fontWeight: '700' as const,
      lineHeight: 28,
    },
    value: {
      fontSize: 15,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
    valueSmall: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 18,
    },
    button: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
    input: {
      fontSize: 15,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    label: {
      fontSize: 12,
      fontWeight: '600' as const,
      lineHeight: 16,
    },
  },
  radius: {
    none: 0,
    small: 4,
    base: 6,
    medium: 8,
    card: 10,   // Apple-standard card/section corner radius
    large: 12,
    modal: 14,  // Modal sheet top corner radius
    rounded: 16, // Rounded cards and bottom sheet corners
    pill: 24,
  },
  shadows: {
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
  },
} as const;

export const darkTheme = {
  colors: {
    brand: {
      primary: '#4C7DFF', // Brighter, more saturated blue for dark mode visibility
      primaryPressed: '#3A6BFF', // Lighter pressed state for dark mode (pressing lightens in dark mode)
      tint: '#1a2f5a', // Darker blue tint for dark mode active states
      onPrimary: '#ffffff', // Content color used on top of brand.primary surfaces (icons, checkmarks, labels)
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3',
      tertiary: '#cccccc',
      subtle: '#8a8a8a',   // Mid-tone text between secondary and muted (dark mode)
      muted: '#707070',
      disabled: '#666666',
    },
    bg: {
      app: '#000000',
      card: '#1C1C1E',
      subtle: '#2a2a2a',
      input: '#000000', // Interactive input surface - matches bg.app in dark mode
      cardGradientTop: '#1f1f1f', // Derived from bg.card, slightly lighter for subtle gradient start
      cardGradientBottom: '#1a1a1a', // Derived from bg.card (same value for subtle gradient end)
      subtlePressed: '#353535', // Pressed state for subtle/secondary interactive surfaces (dark mode)
    },
    border: {
      default: '#404040',
      subtle: '#333333',
      muted: 'rgba(51, 51, 51, 0.4)', // Very subtle border for reduced visual noise (~40% opacity, slightly higher for dark mode contrast)
      separator: 'rgba(84, 84, 88, 0.5)', // Apple-standard separator color for grouped lists (dark mode) - reduced alpha for subtlety
    },
    semantic: {
      error: '#ef4444',
      errorText: '#ffcccc',
      errorBg: '#3d1f1f',
      errorBorder: '#5a2d2d',
      warning: '#f59e0b',
      warningBg: '#3d2f00',
      warningText: '#ffd700',
      success: '#22c55e',
      successText: '#4ade80',
      successBg: '#1a3d2e',
      successBorder: '#2d5a3d',
      info: '#6B9DEF', // Muted brand blue for dark mode (slightly lighter for contrast)
      infoText: '#6B9DEF', // Muted brand blue for dark mode informational text
    },
    domain: {
      asset: '#6A9A6A',
      liability: '#C86A6A',
    },
    chart: {
      netWorthFill: '#666666', // Neutral grey for dark mode (slightly lighter for contrast)
      markerLine: '#999999', // Muted grey for dark mode
    },
    overlay: {
      scrim25: 'rgba(0,0,0,0.5)',
      scrim40: 'rgba(0,0,0,0.6)',
      scrim50: 'rgba(0,0,0,0.75)',
      heroNumberGlow: 'rgba(76, 125, 255, 0.18)', // Derived from brand.primary (#4C7DFF) at 18% opacity for subtle glow
    },
    shadow: {
      color: '#000', // Canonical shadow color — same in both themes
    },
    actions: {
      edit: {
        bg: 'rgba(255,255,255,0.06)',
        bgPressed: 'rgba(255,255,255,0.12)', // 2× alpha for pressed feedback
        icon: '#ffffff', // Matches text.primary
      },
      delete: {
        bg: 'rgba(255,59,48,0.18)',
        bgPressed: 'rgba(255,59,48,0.28)', // +0.1 alpha for pressed feedback
        icon: '#FF453A',
      },
    },
    whatif: {
      sage:       { cardBg: '#192819', cardBgPressed: '#223C22', iconBg: '#2A4A2A', title: '#7EC47E', body: '#568A56' },
      teal:       { cardBg: '#142424', cardBgPressed: '#1E3A3A', iconBg: '#204040', title: '#70C4C4', body: '#408080' },
      rose:       { cardBg: '#2A1618', cardBgPressed: '#3E2024', iconBg: '#4A2428', title: '#D47480', body: '#9A5058' },
      amber:      { cardBg: '#281E10', cardBgPressed: '#3A2A18', iconBg: '#4A3418', title: '#D4A060', body: '#9A7030' },
      periwinkle: { cardBg: '#141824', cardBgPressed: '#1E2438', iconBg: '#243060', title: '#7898EE', body: '#4A68B8' },
      lavender:   { cardBg: '#1A1428', cardBgPressed: '#261E3C', iconBg: '#382460', title: '#9A80EE', body: '#6848B8' },
      mint:       { cardBg: '#142820', cardBgPressed: '#1E3C2C', iconBg: '#204A34', title: '#70C490', body: '#408A58' },
      grey:       { cardBg: '#1C1C1E', cardBgPressed: '#252528', iconBg: '#2A2A30', title: '#444444', body: '#383838' },
    },
  },
  typography: {
    header: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
    groupTitle: {
      fontSize: 12,
      fontWeight: '700' as const,
      lineHeight: 16,
      letterSpacing: 0.6,
    },
    bodyLarge: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    body: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
    bodyMedium: {
      fontSize: 13,
      fontWeight: '400' as const,
      lineHeight: 18,
    },
    bodySmall: {
      fontSize: 11,
      fontWeight: '400' as const,
      lineHeight: 14,
    },
    caption: {
      fontSize: 10,
      fontWeight: '400' as const,
      lineHeight: 14,
    },
    valueLarge: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 22,
    },
    valueHero: {
      fontSize: 22,
      fontWeight: '700' as const,
      lineHeight: 28,
    },
    value: {
      fontSize: 15,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
    valueSmall: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 18,
    },
    button: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 20,
    },
    input: {
      fontSize: 15,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    label: {
      fontSize: 12,
      fontWeight: '600' as const,
      lineHeight: 16,
    },
  },
  radius: {
    none: 0,
    small: 4,
    base: 6,
    medium: 8,
    card: 10,   // Apple-standard card/section corner radius
    large: 12,
    modal: 14,  // Modal sheet top corner radius
    rounded: 16, // Rounded cards and bottom sheet corners
    pill: 24,
  },
  shadows: {
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
  },
} as const;

// Theme type that accepts both light and dark themes
export type Theme = typeof lightTheme | typeof darkTheme;

/**
 * Standalone radius tokens — same values as theme.radius, exported separately
 * so static StyleSheets (outside components) can use them without needing useTheme().
 * Radius does not differ between light and dark themes.
 */
export const radius = {
  none: 0,
  small: 4,
  base: 6,
  medium: 8,
  card: 10,   // Apple-standard card/section corner radius
  large: 12,
  modal: 14,  // Modal sheet top corner radius
  rounded: 16, // Rounded cards and bottom sheet corners
  pill: 24,
} as const;

/**
 * Standalone typography tokens — same values as theme.typography, exported separately
 * so static StyleSheets (outside components) can use them without needing useTheme().
 * Typography scale (fontSize/fontWeight/lineHeight) does not differ between light and dark themes.
 */
export const typography = {
  header:       { fontSize: 20, fontWeight: '600' as const, lineHeight: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600' as const, lineHeight: 20 },
  groupTitle:   { fontSize: 12, fontWeight: '700' as const, lineHeight: 16, letterSpacing: 0.6 },
  bodyLarge:    { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  body:         { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  bodyMedium:   { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  bodySmall:    { fontSize: 11, fontWeight: '400' as const, lineHeight: 14 },
  caption:      { fontSize: 10, fontWeight: '400' as const, lineHeight: 14 },
  valueLarge:   { fontSize: 18, fontWeight: '600' as const, lineHeight: 22 },
  valueHero:    { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  value:        { fontSize: 15, fontWeight: '600' as const, lineHeight: 20 },
  valueSmall:   { fontSize: 14, fontWeight: '600' as const, lineHeight: 18 },
  button:       { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  input:        { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
  label:        { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
} as const;
