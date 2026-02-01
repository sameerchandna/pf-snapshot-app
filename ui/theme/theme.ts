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
      tint: '#e8f0ff', // Light blue tint for active states and highlights
    },
    text: {
      primary: '#000',
      secondary: '#666',
      tertiary: '#333', // Used for #333 and #444 mappings
      muted: '#888',
      disabled: '#aaa', // Used in ScreenHeader subtitleFootnote
    },
    bg: {
      app: '#F5F6F8',
      card: '#fff',
      subtle: '#fafafa',
    },
    border: {
      default: '#e0e0e0',
      subtle: '#f0f0f0',
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
      scrim50: 'rgba(0,0,0,0.5)',
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
    large: 12,
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
      primary: '#2F5BEA', // Keep brand color same in dark mode
      tint: '#1a2f5a', // Darker blue tint for dark mode active states
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3',
      tertiary: '#cccccc',
      muted: '#999999',
      disabled: '#666666',
    },
    bg: {
      app: '#000000',
      card: '#1a1a1a',
      subtle: '#2a2a2a',
    },
    border: {
      default: '#404040',
      subtle: '#333333',
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
      scrim50: 'rgba(0,0,0,0.75)',
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
    large: 12,
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
