import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ui/theme/useTheme';
import { ScreenPaletteProvider, palettes } from './ui/theme/palettes';
import SnapshotScreen from './screens/SnapshotScreen';
import GrossIncomeDetailScreen from './screens/GrossIncomeDetailScreen';
import PensionDetailScreen from './screens/PensionDetailScreen';
import NetIncomeDetailScreen from './screens/NetIncomeDetailScreen';
import ExpensesDetailScreen from './screens/ExpensesDetailScreen';
import AvailableCashDetailScreen from './screens/AvailableCashDetailScreen';
import LiabilityReductionsDetailScreen from './screens/LiabilityReductionsDetailScreen';
import ContributionsDetailScreen from './screens/ContributionsDetailScreen';
import MonthlySurplusDetailScreen from './screens/MonthlySurplusDetailScreen';
import AssetsDetailScreen from './screens/AssetsDetailScreen';
import LiabilitiesDetailScreen from './screens/LiabilitiesDetailScreen';
import LoanDetailScreen from './screens/LoanDetailScreen';
import DeductionsDetailScreen from './screens/DeductionsDetailScreen';
import NetWorthDetailScreen from './screens/NetWorthDetailScreen';
import AccountsScreen from './screens/AccountsScreen';
import WhatIfPickerScreen from './screens/WhatIfPickerScreen';
import ScenarioExplorerScreen from './screens/ScenarioExplorerScreen';
import QuestionAnswerScreen from './screens/QuestionAnswerScreen';
import ProjectionResultsScreen from './screens/ProjectionResultsScreen';
import ProjectionSettingsScreen from './screens/ProjectionSettingsScreen';
import ScenarioManagementScreen from './screens/ScenarioManagementScreen';
import ScenarioEditorScreen from './screens/ScenarioEditorScreen';
import SettingsScreen from './screens/SettingsScreen';
import A3ValidationScreen from './screens/A3ValidationScreen';
import ProjectionRefactorValidationScreen from './screens/ProjectionRefactorValidationScreen';
import SnapshotDataSummaryScreen from './screens/SnapshotDataSummaryScreen';
import BalanceDeepDiveScreen from './screens/BalanceDeepDiveScreen';
import GoalEditorScreen from './screens/GoalEditorScreen';

const Stack = createNativeStackNavigator();
const WhatIfStack = createNativeStackNavigator();
const ProjectionStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Wraps a screen component in the entry palette context (pink/purple).
// Used for all data-entry detail screens in the Snapshot stack.
function withEntryPalette(Component: React.ComponentType<any>): React.ComponentType<any> {
  return function EntryPaletteScreen(props: any) {
    return (
      <ScreenPaletteProvider value={palettes.entry}>
        <Component {...props} />
      </ScreenPaletteProvider>
    );
  };
}

// Navigation headers remain disabled app-wide; all screens render their own in-screen headers.
const STACK_HEADER_SHOWN: boolean = false;
const TAB_HEADER_SHOWN: boolean = false;

// Use unique internal route names for tabs to avoid nested name collisions like "Snapshot > Snapshot".
const TAB_ROUTE_SNAPSHOT: string = 'SnapshotTab';
const TAB_ROUTE_WHATIF: string = 'WhatIfTab';
const TAB_ROUTE_PROJECTION: string = 'ProjectionTab';
const TAB_ROUTE_SETTINGS: string = 'SettingsTab';

const TAB_LABEL_SNAPSHOT: string = 'Today';
const TAB_LABEL_WHATIF: string = 'Explore';
const TAB_LABEL_PROJECTION: string = 'Forecast';
const TAB_LABEL_SETTINGS: string = 'Settings';

const TAB_INITIAL_ROUTE_NAME: string = TAB_ROUTE_SNAPSHOT;

function SnapshotStackNavigator() {
  return (
    <ScreenPaletteProvider value={palettes.snapshot}>
      <Stack.Navigator screenOptions={{ headerShown: STACK_HEADER_SHOWN }}>
        <Stack.Screen name="Snapshot" component={SnapshotScreen} />
        <Stack.Screen name="GrossIncomeDetail" component={withEntryPalette(GrossIncomeDetailScreen)} />
        <Stack.Screen name="PensionDetail" component={withEntryPalette(PensionDetailScreen)} />
        <Stack.Screen name="NetIncomeDetail" component={NetIncomeDetailScreen} />
        <Stack.Screen name="DeductionsDetail" component={withEntryPalette(DeductionsDetailScreen)} />
        <Stack.Screen name="ExpensesDetail" component={withEntryPalette(ExpensesDetailScreen)} />
        <Stack.Screen name="AvailableCashDetail" component={AvailableCashDetailScreen} />
        <Stack.Screen name="LiabilityReductionDetail" component={withEntryPalette(LiabilityReductionsDetailScreen)} />
        <Stack.Screen name="AssetContributionDetail" component={withEntryPalette(ContributionsDetailScreen)} />
        <Stack.Screen name="MonthlySurplusDetail" component={MonthlySurplusDetailScreen} />
        <Stack.Screen name="AssetsDetail" component={withEntryPalette(AssetsDetailScreen)} />
        <Stack.Screen name="LiabilitiesDetail" component={withEntryPalette(LiabilitiesDetailScreen)} />
        <Stack.Screen name="LoanDetail" component={withEntryPalette(LoanDetailScreen)} />
        <Stack.Screen name="NetWorthDetail" component={NetWorthDetailScreen} />
        <Stack.Screen name="BalanceDeepDive" component={BalanceDeepDiveScreen} />
        <Stack.Screen name="Report" component={AccountsScreen} />
      </Stack.Navigator>
    </ScreenPaletteProvider>
  );
}

function WhatIfStackNavigator() {
  return (
    <ScreenPaletteProvider value={palettes.whatIf}>
      <WhatIfStack.Navigator screenOptions={{ headerShown: STACK_HEADER_SHOWN }}>
        <WhatIfStack.Screen name="WhatIfPicker" component={WhatIfPickerScreen} />
        <WhatIfStack.Screen name="ScenarioExplorer" component={ScenarioExplorerScreen} />
        <WhatIfStack.Screen name="QuestionAnswer" component={QuestionAnswerScreen} />
        <WhatIfStack.Screen name="ScenarioManagement" component={ScenarioManagementScreen} />
        <WhatIfStack.Screen name="ScenarioEditor" component={ScenarioEditorScreen} />
      </WhatIfStack.Navigator>
    </ScreenPaletteProvider>
  );
}

function ProjectionStackNavigator() {
  return (
    <ScreenPaletteProvider value={palettes.projection}>
      <ProjectionStack.Navigator screenOptions={{ headerShown: STACK_HEADER_SHOWN }}>
        <ProjectionStack.Screen name="ProjectionResults" component={ProjectionResultsScreen} />
        <ProjectionStack.Screen name="ProjectionSettings" component={ProjectionSettingsScreen} />
        <ProjectionStack.Screen name="ScenarioManagement" component={ScenarioManagementScreen} />
        <ProjectionStack.Screen name="ScenarioEditor" component={ScenarioEditorScreen} />
        <ProjectionStack.Screen name="BalanceDeepDive" component={BalanceDeepDiveScreen} />
        <ProjectionStack.Screen name="GoalEditor" component={GoalEditorScreen} />
      </ProjectionStack.Navigator>
    </ScreenPaletteProvider>
  );
}

function SettingsStackNavigator() {
  return (
    <ScreenPaletteProvider value={palettes.settings}>
      <SettingsStack.Navigator screenOptions={{ headerShown: STACK_HEADER_SHOWN }}>
        <SettingsStack.Screen name="Settings" component={SettingsScreen} />
        <SettingsStack.Screen name="A3Validation" component={A3ValidationScreen} />
        <SettingsStack.Screen name="ProjectionRefactorValidation" component={ProjectionRefactorValidationScreen} />
        <SettingsStack.Screen name="SnapshotDataSummary" component={SnapshotDataSummaryScreen} />
      </SettingsStack.Navigator>
    </ScreenPaletteProvider>
  );
}

export default function AppNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName={TAB_INITIAL_ROUTE_NAME}
      screenOptions={{
        headerShown: TAB_HEADER_SHOWN,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e0e0e0',
        },
        tabBarActiveTintColor: '#1e1e1e',
        tabBarInactiveTintColor: '#868e96',
        tabBarLabelStyle: {
          fontFamily: 'Virgil',
          fontSize: 12,
        },
      }}
    >
      <Tab.Screen
        name={TAB_ROUTE_SNAPSHOT}
        component={SnapshotStackNavigator}
        options={{ title: TAB_LABEL_SNAPSHOT, tabBarLabel: TAB_LABEL_SNAPSHOT, tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} /> }}
      />
      <Tab.Screen
        name={TAB_ROUTE_PROJECTION}
        component={ProjectionStackNavigator}
        options={{ title: TAB_LABEL_PROJECTION, tabBarLabel: TAB_LABEL_PROJECTION, tabBarIcon: ({ color, size }) => <Ionicons name="telescope-outline" size={size} color={color} /> }}
      />
      <Tab.Screen
        name={TAB_ROUTE_WHATIF}
        component={WhatIfStackNavigator}
        options={{ title: TAB_LABEL_WHATIF, tabBarLabel: TAB_LABEL_WHATIF, tabBarIcon: ({ color, size }) => <Ionicons name="flask-outline" size={size} color={color} /> }}
      />
      <Tab.Screen
        name={TAB_ROUTE_SETTINGS}
        component={SettingsStackNavigator}
        options={{ title: TAB_LABEL_SETTINGS, tabBarLabel: TAB_LABEL_SETTINGS, tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}
