import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './navigation';
import { SnapshotProvider } from './SnapshotContext';
import { ModeProvider, useMode } from './context/ModeContext';

function AppContent() {
  const { mode, modeInitialized } = useMode();

  // Don't render until mode is determined
  if (!modeInitialized) {
    return null; // Or a loading screen
  }

  return (
    <SnapshotProvider mode={mode}>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SnapshotProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ModeProvider>
        <AppContent />
      </ModeProvider>
    </GestureHandlerRootView>
  );
}

