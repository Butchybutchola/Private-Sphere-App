import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { syncToCloud, getCloudEvidenceCount, getLastSyncTime, SyncResult } from '../services/syncService';
import { useDatabase } from '../context/DatabaseContext';
import { theme } from '../theme';
import { format } from 'date-fns';

export function ProfileScreen() {
  const { user, signOut, cloudEnabled } = useAuth();
  const { evidence } = useDatabase();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [cloudCount, setCloudCount] = useState<number>(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    if (cloudEnabled && user) {
      getCloudEvidenceCount().then(setCloudCount);
      getLastSyncTime().then(setLastSync);
    }
  }, [cloudEnabled, user]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncToCloud();
      setSyncResult(result);

      const count = await getCloudEvidenceCount();
      setCloudCount(count);
      setLastSync(new Date());

      if (result.errors.length === 0) {
        Alert.alert('Sync Complete', `${result.evidencePushed} evidence items synced to cloud.`);
      } else {
        Alert.alert(
          'Sync Partial',
          `Synced: ${result.evidencePushed} evidence, ${result.courtOrdersPushed} orders.\n${result.errors.length} error(s) occurred.`
        );
      }
    } catch (error) {
      Alert.alert('Sync Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Your local data will remain on this device. Cloud sync will stop.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Info */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons
            name={user?.isAnonymous ? 'person-outline' : 'person'}
            size={32}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.displayName}>
          {user?.displayName || (user?.isAnonymous ? 'Guest User' : 'User')}
        </Text>
        <Text style={styles.email}>{user?.email || 'No email (guest account)'}</Text>
        {user?.isAnonymous && (
          <View style={styles.guestBadge}>
            <Text style={styles.guestBadgeText}>Guest - Local Only</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{evidence.length}</Text>
          <Text style={styles.statLabel}>Local</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{cloudCount}</Text>
          <Text style={styles.statLabel}>Cloud</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {lastSync ? format(lastSync, 'HH:mm') : '--:--'}
          </Text>
          <Text style={styles.statLabel}>Last Sync</Text>
        </View>
      </View>

      {/* Sync Section */}
      {cloudEnabled && user && !user.isAnonymous && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cloud Sync</Text>

          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="cloud-upload" size={20} color="#FFF" />
            )}
            <Text style={styles.syncButtonText}>
              {syncing ? 'Syncing...' : 'Sync to Cloud'}
            </Text>
          </TouchableOpacity>

          {syncResult && (
            <View style={styles.syncResultBox}>
              <Text style={styles.syncResultTitle}>Last Sync Result</Text>
              <Text style={styles.syncResultItem}>
                Evidence: {syncResult.evidencePushed} synced
              </Text>
              <Text style={styles.syncResultItem}>
                Court Orders: {syncResult.courtOrdersPushed} synced
              </Text>
              <Text style={styles.syncResultItem}>
                Audit Entries: {syncResult.auditEntriesPushed} synced
              </Text>
              {syncResult.errors.length > 0 && (
                <Text style={styles.syncResultError}>
                  {syncResult.errors.length} error(s)
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Account Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        {user && (
          <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
            <Ionicons name="log-out" size={20} color={theme.colors.danger} />
            <Text style={[styles.actionText, { color: theme.colors.danger }]}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </View>
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
  profileCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  displayName: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  email: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  guestBadge: {
    backgroundColor: theme.colors.warning + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.round,
    marginTop: theme.spacing.sm,
  },
  guestBadgeText: {
    color: theme.colors.warning,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
    color: '#FFF',
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
  syncResultBox: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  syncResultTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  syncResultItem: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    marginTop: 2,
  },
  syncResultError: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionText: {
    fontSize: theme.fontSize.md,
    fontWeight: '500',
  },
});
