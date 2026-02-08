import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from './ui/theme/useTheme';
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
import ProjectionResultsScreen from './screens/ProjectionResultsScreen';
import ProjectionSettingsScreen from './screens/ProjectionSettingsScreen';
import ScenarioManagementScreen from './screens/ScenarioManagementScreen';
import ScenarioEditorScreen from './screens/ScenarioEditorScreen';
import SettingsScreen from './screens/SettingsScreen';
import ProfilesManagementScreen from './screens/ProfilesManagementScreen';
import A3ValidationScreen from './screens/A3ValidationScreen';
import ProjectionRefactorValidationScreen from './screens/ProjectionRefactorValidationScreen';
import SnapshotDataSummaryScreen from './screens/SnapshotDataSummaryScreen';
import BalanceDeepDiveScreen from './screens/BalanceDeepDiveScreen';
import EntryScreen from './screens/EntryScreen';

const RootStack = createNativeStackNavigator();
const Stack = createNativeStackNavigator();
const AccountsStack = createNativeStackNavigator();
const ProjectionStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Navigation headers remain disabled app-wide; all screens render their own in-screen headers.
const STACK_HEADER_SHOWN: boolean = false;
const TAB_HEADER_SHOWN: boolean = false;

// Use unique internal route names for tabs to avoid nested name collisions like "Snapshot > Snapshot".
const TAB_ROUTE_SNAPSHOT: string = 'SnapshotTab';
const TAB_ROUTE_ACCOUNTS: string = 'AccountsTab';
const TAB_ROUTE_PROJECTION: string = 'ProjectionTab';
const TAB_ROUTE_SETTINGS: string = 'SettingsTab';

const TAB_LABEL_SNAPSHOT: string = 'Snapshot';
const TAB_LABEL_ACCOUNTS: string = 'Accounts';
const TAB_LABEL_PROJECTION: string = 'Projection';
const TAB_LABEL_SETTINGS: string = 'Settings';

const TAB_INITIAL_ROUTE_NAME: string = TAB_ROUTE_SNAPSHOT;

function SnapshotStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: STACK_HEADER_SHOWN }}>
      <Stack.Screen name="Snapshot" component={SnapshotScreen} />
      <Stack.Screen name="GrossIncomeDetail" component={GrossIncomeDetailScreen} />
      <Stack.Screen name="PensionDetail" component={PensionDetailScreen} />
      <Stack.Screen name="NetIncomeDetail" component={NetIncomeDetailScreen} />
      {/* IncomeDetailScreen retired in favour of the three flat list screens above */}
      <Stack.Screen name="DeductionsDetail" component={DeductionsDetailScreen} />
      <Stack.Screen name="ExpensesDetail" component={ExpensesDetailScreen} />
      <Stack.Screen name="AvailableCashDetail" component={AvailableCashDetailScreen} />
      <Stack.Screen name="LiabilityReductionDetail" component={LiabilityReductionsDetailScreen} />
      <Stack.Screen name="AssetContributionDetail" component={ContributionsDetailScreen} />
      <Stack.Screen name="MonthlySurplusDetail" component={MonthlySurplusDetailScreen} />
      <Stack.Screen name="AssetsDetail" component={AssetsDetailScreen} />
      <Stack.Screen name="LiabilitiesDetail" component={LiabilitiesDetailScreen} />
      <Stack.Screen name="LoanDetail" component={LoanDetailScreen} />
      <Stack.Screen name="NetWorthDetail" component={NetWorthDetailScreen} />
      <Stack.Screen name="BalanceDeepDive" component={BalanceDeepDiveScreen} />
    </Stack.Navigator>
  );
}

function AccountsStackNavigator() {
  return (
    <AccountsStack.Navigator screenOptions={{ headerShown: STACK_HEADER_SHOWN }}>
      <AccountsStack.Screen name="Accounts" component={AccountsScreen} />
      <AccountsStack.Screen name="AccountsAssetsDetail" component={AssetsDetailScreen} />
      <AccountsStack.Screen name="LiabilitiesDetail" component={LiabilitiesDetailScreen} />
      <AccountsStack.Screen name="LoanDetail" component={LoanDetailScreen} />
      <AccountsStack.Screen name="BalanceDeepDive" component={BalanceDeepDiveScreen} />
    </AccountsStack.Navigator>
  );
}

function ProjectionStackNavigator() {
  return (
    <ProjectionStack.Navigator screenOptions={{ headerShown: STACK_HEADER_SHOWN }}>
      <ProjectionStack.Screen name="ProjectionResults" component={ProjectionResultsScreen} />
      <ProjectionStack.Screen name="ProjectionSettings" component={ProjectionSettingsScreen} />
      <ProjectionStack.Screen name="ScenarioManagement" component={ScenarioManagementScreen} />
      <ProjectionStack.Screen name="ScenarioEditor" component={ScenarioEditorScreen} />
      <ProjectionStack.Screen name="BalanceDeepDive" component={BalanceDeepDiveScreen} />
    </ProjectionStack.Navigator>
  );
}

function SettingsStackNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: STACK_HEADER_SHOWN }}>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} />
      <SettingsStack.Screen name="Profiles" component={ProfilesManagementScreen} />
      <SettingsStack.Screen name="A3Validation" component={A3ValidationScreen} />
      <SettingsStack.Screen name="ProjectionRefactorValidation" component={ProjectionRefactorValidationScreen} />
      <SettingsStack.Screen name="SnapshotDataSummary" component={SnapshotDataSummaryScreen} />
    </SettingsStack.Navigator>
  );
}

function MainTabsNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName={TAB_INITIAL_ROUTE_NAME}
      screenOptions={{
        headerShown: TAB_HEADER_SHOWN,
        tabBarStyle: {
          backgroundColor: theme.colors.bg.card,
          borderTopColor: theme.colors.border.default,
        },
        tabBarActiveTintColor: theme.colors.brand.primary,
        tabBarInactiveTintColor: theme.colors.text.secondary,
      }}
    >
      <Tab.Screen
        name={TAB_ROUTE_SNAPSHOT}
        component={SnapshotStackNavigator}
        options={{ title: TAB_LABEL_SNAPSHOT, tabBarLabel: TAB_LABEL_SNAPSHOT }}
      />
      <Tab.Screen
        name={TAB_ROUTE_ACCOUNTS}
        component={AccountsStackNavigator}
        options={{ title: TAB_LABEL_ACCOUNTS, tabBarLabel: TAB_LABEL_ACCOUNTS }}
      />
      <Tab.Screen
        name={TAB_ROUTE_PROJECTION}
        component={ProjectionStackNavigator}
        options={{ title: TAB_LABEL_PROJECTION, tabBarLabel: TAB_LABEL_PROJECTION }}
      />
      <Tab.Screen
        name={TAB_ROUTE_SETTINGS}
        component={SettingsStackNavigator}
        options={{ title: TAB_LABEL_SETTINGS, tabBarLabel: TAB_LABEL_SETTINGS }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Entry" component={EntryScreen} />
      <RootStack.Screen name="MainTabs" component={MainTabsNavigator} options={{ headerShown: false }} />
    </RootStack.Navigator>
  );
}
