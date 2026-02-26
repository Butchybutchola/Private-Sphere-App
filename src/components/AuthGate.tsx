/**
 * Authentication Gate
 *
 * Requires biometric authentication (FaceID/Fingerprint) before
 * allowing access to the app. Also handles panic lock state.
 */

import React, { useEffect, useState, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { usePanicGesture } from '../context/PanicGestureContext';
import { theme } from '../theme';

const BIOMETRIC_ENABLED_KEY = 'evidence_guardian_biometric_enabled';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');
  const [error, setError] = useState<string | null>(null);
  const { isPanicLocked, unlock } = usePanicGesture();

  useEffect(() => {
    checkBiometricType();
    authenticate();
  }, []);

  useEffect(() => {
    if (isPanicLocked) {
      setIsAuthenticated(false);
    }
  }, [isPanicLocked]);

  async function checkBiometricType() {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      setBiometricType('Face ID');
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      setBiometricType('Fingerprint');
    }
  }

  async function authenticate() {
    setError(null);

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const biometricPref = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    const biometricEnabled = biometricPref !== 'false'; // default on if never set

    if (!hasHardware || !isEnrolled || !biometricEnabled) {
      // Skip biometrics if hardware unavailable or user has disabled it
      setIsAuthenticated(true);
      if (isPanicLocked) unlock();
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access Evidence Guardian',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    });

    if (result.success) {
      setIsAuthenticated(true);
      if (isPanicLocked) unlock();
    } else {
      setError('Authentication failed. Please try again.');
    }
  }

  if (isAuthenticated && !isPanicLocked) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.lockContainer}>
        <View style={styles.iconWrapper}>
          <Ionicons name="shield-checkmark" size={64} color={theme.colors.primary} />
        </View>

        <Text style={styles.title}>Evidence Guardian</Text>
        <Text style={styles.subtitle}>
          {isPanicLocked ? 'App Locked' : 'Authentication Required'}
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.authButton} onPress={authenticate}>
          <Ionicons
            name={biometricType === 'Face ID' ? 'scan' : 'finger-print'}
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.authButtonText}>Unlock with {biometricType}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.md,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
});
