import type { Theme } from '../theme/theme';

/**
 * Converts hex color to rgba with reduced opacity for muted borders.
 * Uses ~65% opacity for light mode, ~50% for dark mode to maintain contrast.
 */
export function getMutedBorderColor(hexColor: string, theme: Theme): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Use 65% opacity for light mode, 50% for dark mode (detected by checking if bg.card is dark)
  const opacity = theme.colors.bg.card === '#fff' ? 0.65 : 0.5;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
