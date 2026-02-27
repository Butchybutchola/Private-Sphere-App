import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { getLastSyncInfo, syncNTPOffset } from '../services/ntpTime';
import { isEncryptionConfigured } from '../services/encryptionService';
import { setWhisperApiKey, getWhisperApiKey } from '../services/transcriptionService';
import { getAuditLog } from '../database/auditRepository';
import { AuditLogEntry } from '../types';
import { theme } from '../theme';
import { format } from 'date-fns';

const ICON_DISGUISE_KEY = 'evidence_guardian_icon_disguise';
const BIOMETRIC_ENABLED_KEY = 'evidence_guardian_biometric_enabled';

const ICON_DISGUISES = [
  { id: null, name: 'Default (Evidence Guardian)', icon: 'shield-checkmark' },
  { id: 'calculator', name: 'Calculator', icon: 'calculator' },
  { id: 'weather', name: 'Weather', icon: 'partly-sunny' },
  { id: 'notes', name: 'Notes', icon: 'create' },
  { id: 'compass', name: 'Compass', icon: 'compass' },
];

export function SettingsScreen() {
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [ntpInfo, setNtpInfo] = useState<{ offset: number | null; lastSync: number | null }>({ offset: null, lastSync: null });
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [whisperKey, setWhisperKey] = useState('');
  const [showWhisperKey, setShowWhisperKey] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    setBiometricAvailable(hasHardware);

    const encReady = await isEncryptionConfigured();
    setEncryptionReady(encReady);

    const syncInfo = getLastSyncInfo();
    setNtpInfo(syncInfo);

    const key = await getWhisperApiKey();
    if (key) setWhisperKey('••••••••••••');

    const savedIcon = await SecureStore.getItemAsync(ICON_DISGUISE_KEY);
    setSelectedIcon(savedIcon || null);

    const biometricPref = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    // Default to enabled if never set
    setBiometricEnabled(biometricPref !== 'false');
  }

  const handleSyncNTP = async () => {
    await syncNTPOffset();
    const syncInfo = getLastSyncInfo();
    setNtpInfo(syncInfo);
    Alert.alert('NTP Synced', `Clock offset: ${syncInfo.offset?.toFixed(0) ?? 'unknown'}ms`);
  };

  const handleSaveWhisperKey = async () => {
    if (!whisperKey.trim() || whisperKey.includes('••')) return;
    await setWhisperApiKey(whisperKey.trim());
    Alert.alert('Saved', 'Whisper API key stored securely.');
    setWhisperKey('••••••••••••');
    setShowWhisperKey(false);
  };

  const handleLoadAuditLog = async () => {
    const entries = await getAuditLog(undefined, undefined, 50);
    setAuditLog(entries);
    setShowAuditLog(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Security Section */}
      <Text style={styles.sectionTitle}>Security</Text>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Ionicons name="finger-print" size={22} color={theme.colors.primary} />
          <View>
            <Text style={styles.settingLabel}>Biometric Lock</Text>
            <Text style={styles.settingDesc}>
              {biometricAvailable ? 'Require biometrics to open app' : 'Not available on this device'}
            </Text>
          </View>
        </View>
        <Switch
          value={biometricEnabled}
          onValueChange={async (val) => {
            setBiometricEnabled(val);
            await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, val ? 'true' : 'false');
          }}
          trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
          disabled={!biometricAvailable}
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Ionicons name="key" size={22} color={theme.colors.accent} />
          <View>
            <Text style={styles.settingLabel}>Encryption</Text>
            <Text style={styles.settingDesc}>
              AES-256 {encryptionReady ? '(Active)' : '(Initializing...)'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusDot, { backgroundColor: encryptionReady ? theme.colors.success : theme.colors.warning }]} />
      </View>

      {/* Icon Disguise */}
      <Text style={styles.sectionTitle}>App Disguise</Text>
      <Text style={styles.sectionDesc}>
        Change the app icon to appear as a different application.
      </Text>

      {ICON_DISGUISES.map(disguise => (
        <TouchableOpacity
          key={disguise.id ?? 'default'}
          style={[styles.disguiseOption, selectedIcon === disguise.id && styles.disguiseOptionActive]}
          onPress={async () => {
            setSelectedIcon(disguise.id);
            await SecureStore.setItemAsync(ICON_DISGUISE_KEY, disguise.id ?? '');
            Alert.alert('Preference Saved', `App disguise set to "${disguise.name}". Restart the app to apply the change.`);
          }}
        >
          <Ionicons
            name={disguise.icon as keyof typeof Ionicons.glyphMap}
            size={24}
            color={selectedIcon === disguise.id ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.disguiseName, selectedIcon === disguise.id && styles.disguiseNameActive]}>
            {disguise.name}
          </Text>
          {selectedIcon === disguise.id && (
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      ))}

      {/* NTP Time Sync */}
      <Text style={styles.sectionTitle}>Time Verification</Text>
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Ionicons name="time" size={22} color={theme.colors.warning} />
          <View>
            <Text style={styles.settingLabel}>NTP Time Sync</Text>
            <Text style={styles.settingDesc}>
              Offset: {ntpInfo.offset !== null ? `${ntpInfo.offset.toFixed(0)}ms` : 'Not synced'}
              {ntpInfo.lastSync && `\nLast sync: ${format(new Date(ntpInfo.lastSync), 'HH:mm:ss')}`}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.syncButton} onPress={handleSyncNTP}>
          <Text style={styles.syncButtonText}>Sync</Text>
        </TouchableOpacity>
      </View>

      {/* Whisper API */}
      <Text style={styles.sectionTitle}>AI Transcription</Text>
      <View style={styles.settingRow}>
        <View style={[styles.settingInfo, { flex: 1 }]}>
          <Ionicons name="text" size={22} color={theme.colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Whisper API Key</Text>
            {showWhisperKey ? (
              <View style={styles.keyInputRow}>
                <TextInput
                  style={styles.keyInput}
                  value={whisperKey.includes('••') ? '' : whisperKey}
                  onChangeText={setWhisperKey}
                  placeholder="sk-..."
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.keySaveButton} onPress={handleSaveWhisperKey}>
                  <Text style={styles.keySaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setShowWhisperKey(true)}>
                <Text style={styles.settingDesc}>
                  {whisperKey ? 'Key configured' : 'Not configured'} — Tap to change
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Audit Log */}
      <Text style={styles.sectionTitle}>Audit Log</Text>
      <TouchableOpacity style={styles.auditButton} onPress={handleLoadAuditLog}>
        <Ionicons name="list" size={20} color={theme.colors.primary} />
        <Text style={styles.auditButtonText}>View Audit Log</Text>
      </TouchableOpacity>

      {showAuditLog && (
        <View style={styles.auditContainer}>
          {auditLog.length === 0 ? (
            <Text style={styles.auditEmpty}>No audit entries yet.</Text>
          ) : (
            auditLog.map(entry => (
              <View key={entry.id} style={styles.auditEntry}>
                <Text style={styles.auditTime}>
                  {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                </Text>
                <Text style={styles.auditAction}>
                  {entry.action} — {entry.resourceType} ({entry.resourceId.substring(0, 8)}...)
                </Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* Privacy Notice */}
      <View style={styles.privacyNotice}>
        <Ionicons name="shield-checkmark" size={18} color={theme.colors.accent} />
        <Text style={styles.privacyText}>
          Evidence Guardian does not use third-party analytics.
          Your data never leaves your device unless you explicitly export it.
        </Text>
      </View>

      <Text style={styles.version}>Evidence Guardian v1.0.0 (MVP)</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  sectionDesc: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  settingLabel: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  settingDesc: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  disguiseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  disguiseOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  disguiseName: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  disguiseNameActive: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  syncButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  syncButtonText: {
    color: '#FFF',
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  keyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  keyInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.fontSize.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  keySaveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  keySaveText: {
    color: '#FFF',
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  auditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  auditButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: '500',
  },
  auditContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    maxHeight: 300,
  },
  auditEmpty: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    padding: theme.spacing.md,
    textAlign: 'center',
  },
  auditEntry: {
    padding: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  auditTime: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontFamily: 'monospace',
  },
  auditAction: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    marginTop: 2,
  },
  privacyNotice: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent + '15',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xl,
  },
  privacyText: {
    flex: 1,
    color: theme.colors.accent,
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
  },
  version: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
});
