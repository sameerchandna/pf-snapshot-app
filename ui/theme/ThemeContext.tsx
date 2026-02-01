/**
 * Theme context for manual theme override (testing/debugging).
 * 
 * Allows manual switching between Light, Dark, and System themes.
 * This is a temporary testing control and should be removed before release.
 * 
 * State is ephemeral (in-memory only, not persisted).
 */

import React, { createContext, useContext, useState, type ReactNode } from 'react';

export type ThemeOverride = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeOverride: ThemeOverride;
  setThemeOverride: (override: ThemeOverride) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeOverride, setThemeOverride] = useState<ThemeOverride>('system');

  return (
    <ThemeContext.Provider value={{ themeOverride, setThemeOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
