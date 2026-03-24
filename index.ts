import 'react-native-gesture-handler';

import Constants from 'expo-constants';
import { registerRootComponent } from 'expo';

import App from './App';

// TEMP: environment identity (remove after debugging PC vs laptop)
console.log('APP ID DEBUG', {
  name: Constants.expoConfig?.name,
  slug: Constants.expoConfig?.slug,
  projectId: Constants.expoConfig?.extra?.eas?.projectId,
  experienceId: Constants.experienceUrl,
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
