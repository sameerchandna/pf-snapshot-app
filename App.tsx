import React, { useCallback } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './navigation';
import { SnapshotProvider } from './context/SnapshotContext';
import { ThemeProvider } from './ui/theme/ThemeContext';
import { useTheme } from './ui/theme/useTheme';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { theme, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    Virgil: require('./assets/fonts/Virgil-Regular.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

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
        fontFamily: 'Virgil',
        fontWeight: '400' as const,
      },
      medium: {
        fontFamily: 'Virgil',
        fontWeight: '400' as const,
      },
      bold: {
        fontFamily: 'Virgil',
        fontWeight: '400' as const,
      },
      heavy: {
        fontFamily: 'Virgil',
        fontWeight: '400' as const,
      },
    },
  };

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SnapshotProvider>
        <NavigationContainer theme={navigationTheme}>
          <AppNavigator />
        </NavigationContainer>
      </SnapshotProvider>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
