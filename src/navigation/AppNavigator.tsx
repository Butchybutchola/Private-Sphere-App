import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

// Screens
import { VaultScreen } from '../screens/VaultScreen';
import { CaptureScreen } from '../screens/CaptureScreen';
import { CourtOrdersScreen } from '../screens/CourtOrdersScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { EvidenceDetailScreen } from '../screens/EvidenceDetailScreen';
import { AudioRecorderScreen } from '../screens/AudioRecorderScreen';
import { CourtOrderDetailScreen } from '../screens/CourtOrderDetailScreen';
import { BreachLogScreen } from '../screens/BreachLogScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  EvidenceDetail: { evidenceId: string };
  AudioRecorder: undefined;
  CourtOrderDetail: { orderId: string };
  BreachLog: { evidenceId: string };
};

export type TabParamList = {
  Vault: undefined;
  Capture: undefined;
  Orders: undefined;
  Reports: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: theme.colors.text,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 85,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Vault"
        component={VaultScreen}
        options={{
          title: 'Evidence Vault',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="lock-closed" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Capture"
        component={CaptureScreen}
        options={{
          title: 'Capture',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={CourtOrdersScreen}
        options={{
          title: 'Court Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EvidenceDetail"
        component={EvidenceDetailScreen}
        options={{ title: 'Evidence Detail' }}
      />
      <Stack.Screen
        name="AudioRecorder"
        component={AudioRecorderScreen}
        options={{ title: 'Record Audio' }}
      />
      <Stack.Screen
        name="CourtOrderDetail"
        component={CourtOrderDetailScreen}
        options={{ title: 'Court Order' }}
      />
      <Stack.Screen
        name="BreachLog"
        component={BreachLogScreen}
        options={{ title: 'Log Breach' }}
      />
    </Stack.Navigator>
  );
}
