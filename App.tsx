import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './navigation';
import { SnapshotProvider } from './context/SnapshotContext';
import { ModeProvider, useMode } from './context/ModeContext';
import { ThemeProvider } from './ui/theme/ThemeContext';
import { useTheme } from './ui/theme/useTheme';

function AppContent() {
  const { mode, modeInitialized } = useMode();
  const { theme, isDark } = useTheme();

  // Don't render until mode is determined
  if (!modeInitialized) {
    return null; // Or a loading screen
  }

  // Configure navigation theme to respect dark mode
  const navigationTheme = {
    dark: isDark,
    colors: {
      primary: theme.colors.brand.primary,
      background: theme.colors.bg.app,
      card: theme.colors.bg.card,
      text: theme.colors.text.primary,
      border: theme.colors.border.default,
      notification: theme.colors.brand.primary,
    },
    fonts: {
      regular: {
        fontFamily: 'System',
        fontWeight: '400' as const,
      },
      medium: {
        fontFamily: 'System',
        fontWeight: '500' as const,
      },
      bold: {
        fontFamily: 'System',
        fontWeight: '700' as const,
      },
      heavy: {
        fontFamily: 'System',
        fontWeight: '800' as const,
      },
    },
  };

  return (
    <SnapshotProvider mode={mode}>
      <NavigationContainer theme={navigationTheme}>
        <AppNavigator />
      </NavigationContainer>
    </SnapshotProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ModeProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </ModeProvider>
    </GestureHandlerRootView>
  );
}

