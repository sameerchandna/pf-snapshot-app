/**
 * Theme hook for accessing current theme based on system color scheme.
 * 
 * Uses React Native's useColorScheme to detect system preference.
 * Falls back to light theme if scheme is null or unknown.
 */

import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, type Theme } from './theme';

export function useTheme(): { theme: Theme; isDark: boolean } {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme: Theme = isDark ? darkTheme : lightTheme;
  return { theme, isDark };
}
