import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { AppNavigator } from './navigation/AppNavigator';
import { DatabaseProvider } from './context/DatabaseContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthGate } from './components/AuthGate';
import { PanicGestureProvider } from './context/PanicGestureContext';
import { LoginScreen } from './screens/LoginScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { initDatabase } from './database/db';
import { seedLegislationData } from './database/legislationSeedData';
import { theme } from './theme';

const ONBOARDING_KEY = 'evidence_guardian_onboarded';

function AppContent() {
  const { user, loading: authLoading, cloudEnabled } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDING_KEY).then(value => {
      setOnboarded(value === 'true');
    });
  }, []);

  if (onboarded === null || authLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Show onboarding for first-time users
  if (!onboarded) {
    return (
      <OnboardingScreen
        onComplete={() => {
          SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
          setOnboarded(true);
        }}
      />
    );
  }

  // Show login if cloud is enabled and user is not signed in
  if (cloudEnabled && !user) {
    return <LoginScreen />;
  }

  // Main app with biometric gate
  return (
    <DatabaseProvider>
      <PanicGestureProvider>
        <AuthGate>
          <NavigationContainer theme={navTheme}>
            <AppNavigator />
            <StatusBar style="light" />
          </NavigationContainer>
        </AuthGate>
      </PanicGestureProvider>
    </DatabaseProvider>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => seedLegislationData())
      .then(() => setDbReady(true))
      .catch(() => setDbReady(true)); // still start app if seed fails
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const navTheme = {
  dark: true,
  colors: {
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.danger,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '900' as const },
  },
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
