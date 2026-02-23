/**
 * Login / Register Screen
 *
 * Handles Firebase authentication:
 * - Email/password sign in
 * - Mandatory registration with full profile details (name, DOB, address, phone)
 * - No guest access - registration is required
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { AustralianState } from '../types';
import { saveUserProfile } from '../database/userProfileRepository';

const AUSTRALIAN_STATES: AustralianState[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export function LoginScreen() {
  const { signIn, signUp, cloudEnabled } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Registration fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [selectedState, setSelectedState] = useState<AustralianState | ''>('');
  const [postcode, setPostcode] = useState('');

  // Registration step (1 = account, 2 = personal details)
  const [regStep, setRegStep] = useState(1);

  const validateLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const validateRegStep1 = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return false;
    }
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing Fields', 'First and last name are required.');
      return false;
    }
    return true;
  };

  const validateRegStep2 = () => {
    if (!dateOfBirth.trim()) {
      Alert.alert('Missing Fields', 'Date of birth is required.');
      return false;
    }
    // Basic DOB format check
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateOfBirth.trim())) {
      Alert.alert('Invalid Date', 'Please enter date of birth as DD/MM/YYYY.');
      return false;
    }
    if (!phone.trim()) {
      Alert.alert('Missing Fields', 'Phone number is required.');
      return false;
    }
    if (!address.trim() || !suburb.trim() || !selectedState || !postcode.trim()) {
      Alert.alert('Missing Fields', 'Full address details are required.');
      return false;
    }
    if (!/^\d{4}$/.test(postcode.trim())) {
      Alert.alert('Invalid Postcode', 'Please enter a valid 4-digit Australian postcode.');
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateLogin()) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Authentication failed';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegNext = () => {
    if (!validateRegStep1()) return;
    setRegStep(2);
  };

  const handleRegister = async () => {
    if (!validateRegStep2()) return;
    setLoading(true);
    try {
      // Convert DD/MM/YYYY to YYYY-MM-DD for storage
      const [dd, mm, yyyy] = dateOfBirth.trim().split('/');
      const dobISO = `${yyyy}-${mm}-${dd}`;

      await signUp(email.trim(), password, `${firstName.trim()} ${lastName.trim()}`);

      // Save full profile to local database
      await saveUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dobISO,
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        suburb: suburb.trim(),
        state: selectedState as AustralianState,
        postcode: postcode.trim(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Registration failed';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    icon: string,
    placeholder: string,
    value: string,
    onChangeText: (t: string) => void,
    options?: {
      keyboardType?: 'email-address' | 'phone-pad' | 'number-pad' | 'default';
      autoCapitalize?: 'none' | 'words' | 'sentences';
      secureTextEntry?: boolean;
    },
  ) => (
    <View style={styles.inputContainer}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={theme.colors.textMuted} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={options?.keyboardType || 'default'}
        autoCapitalize={options?.autoCapitalize || 'none'}
        secureTextEntry={options?.secureTextEntry}
        autoCorrect={false}
        editable={!loading}
      />
      {options?.secureTextEntry !== undefined && (
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo & Title */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="shield-checkmark" size={56} color={theme.colors.primary} />
          </View>
          <Text style={styles.appName}>Evidence Guardian</Text>
          <Text style={styles.tagline}>Forensic-grade evidence protection</Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
            onPress={() => { setMode('login'); setRegStep(1); }}
          >
            <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'register' && styles.modeTabActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.modeTabText, mode === 'register' && styles.modeTabTextActive]}>
              Register
            </Text>
          </TouchableOpacity>
        </View>

        {/* Login Form */}
        {mode === 'login' && (
          <View style={styles.form}>
            {renderInput('mail-outline', 'Email', email, setEmail, { keyboardType: 'email-address' })}
            {renderInput('lock-closed-outline', 'Password', password, setPassword, {
              secureTextEntry: !showPassword,
            })}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color="#FFF" />
                  <Text style={styles.submitText}>Sign In</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Registration Form - Step 1: Account Details */}
        {mode === 'register' && regStep === 1 && (
          <View style={styles.form}>
            <Text style={styles.stepLabel}>Step 1 of 2: Account Details</Text>

            <View style={styles.row}>
              <View style={styles.halfInput}>
                {renderInput('person-outline', 'First Name', firstName, setFirstName, {
                  autoCapitalize: 'words',
                })}
              </View>
              <View style={styles.halfInput}>
                {renderInput('person-outline', 'Last Name', lastName, setLastName, {
                  autoCapitalize: 'words',
                })}
              </View>
            </View>

            {renderInput('mail-outline', 'Email', email, setEmail, { keyboardType: 'email-address' })}
            {renderInput('lock-closed-outline', 'Password (min 6 chars)', password, setPassword, {
              secureTextEntry: !showPassword,
            })}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleRegNext}
              disabled={loading}
            >
              <Text style={styles.submitText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Registration Form - Step 2: Personal Details */}
        {mode === 'register' && regStep === 2 && (
          <View style={styles.form}>
            <View style={styles.stepHeader}>
              <TouchableOpacity onPress={() => setRegStep(1)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
              <Text style={styles.stepLabel}>Step 2 of 2: Personal Details</Text>
            </View>

            {renderInput('calendar-outline', 'Date of Birth (DD/MM/YYYY)', dateOfBirth, setDateOfBirth)}
            {renderInput('call-outline', 'Phone Number', phone, setPhone, { keyboardType: 'phone-pad' })}
            {renderInput('home-outline', 'Street Address', address, setAddress, { autoCapitalize: 'words' })}

            <View style={styles.row}>
              <View style={styles.halfInput}>
                {renderInput('location-outline', 'Suburb', suburb, setSuburb, { autoCapitalize: 'words' })}
              </View>
              <View style={styles.halfInput}>
                {renderInput('navigate-outline', 'Postcode', postcode, setPostcode, {
                  keyboardType: 'number-pad',
                })}
              </View>
            </View>

            {/* State Selector */}
            <Text style={styles.fieldLabel}>State / Territory</Text>
            <View style={styles.stateGrid}>
              {AUSTRALIAN_STATES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.stateChip, selectedState === s && styles.stateChipActive]}
                  onPress={() => setSelectedState(s)}
                >
                  <Text style={[styles.stateChipText, selectedState === s && styles.stateChipTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={20} color="#FFF" />
                  <Text style={styles.submitText}>Create Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Security notice */}
        <View style={styles.securityNotice}>
          <Ionicons name="lock-closed" size={14} color={theme.colors.accent} />
          <Text style={styles.securityText}>
            Your data is encrypted and stored securely on your device.
            Registration is required to ensure evidence can be attributed to you in legal proceedings.
          </Text>
        </View>

        {/* Cloud Status */}
        {!cloudEnabled && (
          <View style={styles.offlineNotice}>
            <Ionicons name="cloud-offline" size={16} color={theme.colors.warning} />
            <Text style={styles.offlineText}>
              Cloud services unavailable. All data stored locally.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.primary + '40',
  },
  appName: {
    fontSize: theme.fontSize.hero,
    fontWeight: '700',
    color: theme.colors.text,
  },
  tagline: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: theme.spacing.lg,
  },
  modeTab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  modeTabActive: {
    backgroundColor: theme.colors.primary,
  },
  modeTabText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#FFF',
  },
  form: {
    gap: theme.spacing.sm,
  },
  stepLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  backButton: {
    padding: 4,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    height: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  stateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  stateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stateChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stateChipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  stateChipTextActive: {
    color: '#FFF',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFF',
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
  },
  securityText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.warning + '15',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
  },
  offlineText: {
    flex: 1,
    color: theme.colors.warning,
    fontSize: theme.fontSize.sm,
  },
});
