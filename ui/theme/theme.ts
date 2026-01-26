/**
 * Central theme system for UI colors.
 * 
 * This file defines light and dark theme color tokens.
 * Typography, spacing, and radius tokens will be added in future roadmap items.
 * 
 * Light theme values match current dominant hardcoded values to preserve visuals.
 * Dark theme provides a complete palette for future dark mode support.
 */

export const lightTheme = {
  colors: {
    brand: {
      primary: '#2F5BEA',
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
      warning: '#f59e0b',
      warningBg: '#fff7db',
      warningText: '#5a4b1b',
      success: '#22c55e',
    },
    overlay: {
      scrim25: 'rgba(0,0,0,0.25)',
      scrim50: 'rgba(0,0,0,0.5)',
    },
  },
} as const;

export const darkTheme = {
  colors: {
    brand: {
      primary: '#2F5BEA', // Keep brand color same in dark mode
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
      warning: '#f59e0b',
      warningBg: '#3d2f00',
      warningText: '#ffd700',
      success: '#22c55e',
    },
    overlay: {
      scrim25: 'rgba(0,0,0,0.5)',
      scrim50: 'rgba(0,0,0,0.75)',
    },
  },
} as const;

// Theme type that accepts both light and dark themes
export type Theme = typeof lightTheme | typeof darkTheme;
