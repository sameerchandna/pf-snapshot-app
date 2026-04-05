/**
 * Theme hook — always returns light (sketch) theme.
 * Dark mode deferred until sketch look is validated.
 */

import { lightTheme, type Theme } from './theme';

export function useTheme(): { theme: Theme; isDark: boolean } {
  return { theme: lightTheme, isDark: false };
}
