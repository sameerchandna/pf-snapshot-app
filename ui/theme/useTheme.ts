/**
 * Theme hook for accessing current theme based on system color scheme or manual override.
 * 
 * Manual override (from ThemeContext) takes precedence over system color scheme.
 * Falls back to light theme if scheme is null or unknown.
 */

import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, type Theme } from './theme';
import { useThemeContext } from './ThemeContext';

export function useTheme(): { theme: Theme; isDark: boolean } {
  const { themeOverride } = useThemeContext();
  const systemColorScheme = useColorScheme();
  
  // Manual override takes precedence over system color scheme
  const effectiveScheme = themeOverride === 'system' ? systemColorScheme : themeOverride;
  
  const isDark = effectiveScheme === 'dark';
  const theme: Theme = isDark ? darkTheme : lightTheme;
  return { theme, isDark };
}
