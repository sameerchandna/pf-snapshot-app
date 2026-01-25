import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './navigation';
import { SnapshotProvider } from './SnapshotContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SnapshotProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </SnapshotProvider>
    </GestureHandlerRootView>
  );
}

