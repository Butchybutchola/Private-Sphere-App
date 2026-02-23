/**
 * Legislation Browser Screen
 *
 * Browse Australian DV protection legislation by jurisdiction and category.
 * Links to official legislation sources.
 * Includes legal disclaimer, attribution, jurisdiction stats, and update status.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, RefreshControl, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { theme } from '../theme';
import { Legislation, LegislationJurisdiction } from '../types';
import {
  getAllLegislation,
  getLegislationByJurisdiction,
  getLastCheckTime,
  getJurisdictionStats,
} from '../database/legislationRepository';
import { seedLegislationData } from '../database/legislationSeedData';
import { checkForUpdates } from '../services/legislationUpdateService';

const DISCLAIMER_KEY = 'legislation_disclaimer_accepted';

const JURISDICTIONS: { key: LegislationJurisdiction | 'All'; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Federal', label: 'Federal' },
  { key: 'NSW', label: 'NSW' },
  { key: 'VIC', label: 'VIC' },
  { key: 'QLD', label: 'QLD' },
  { key: 'WA', label: 'WA' },
  { key: 'SA', label: 'SA' },
  { key: 'TAS', label: 'TAS' },
  { key: 'ACT', label: 'ACT' },
  { key: 'NT', label: 'NT' },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  dv_protection: { label: 'DV Protection', color: theme.colors.danger, icon: 'shield-checkmark' },
  family_law: { label: 'Family Law', color: theme.colors.primary, icon: 'people' },
  criminal: { label: 'Criminal', color: theme.colors.warning, icon: 'alert-circle' },
  child_protection: { label: 'Child Protection', color: theme.colors.success, icon: 'heart' },
};

export function LegislationScreen() {
  const [items, setItems] = useState<Legislation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<LegislationJurisdiction | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});

  // Check if disclaimer has been accepted
  useEffect(() => {
    SecureStore.getItemAsync(DISCLAIMER_KEY).then(val => {
      if (val !== 'true') {
        setShowDisclaimer(true);
      }
    });
  }, []);

  const acceptDisclaimer = () => {
    SecureStore.setItemAsync(DISCLAIMER_KEY, 'true');
    setShowDisclaimer(false);
  };

  const loadData = useCallback(async () => {
    try {
      let data: Legislation[];
      if (selectedJurisdiction === 'All') {
        data = await getAllLegislation();
      } else {
        data = await getLegislationByJurisdiction(selectedJurisdiction);
      }
      // If no data, seed and retry
      if (data.length === 0 && selectedJurisdiction === 'All') {
        await seedLegislationData();
        data = await getAllLegislation();
      }
      setItems(data);

      // Load metadata
      const [checkTime, jurisdictionStats] = await Promise.all([
        getLastCheckTime(),
        getJurisdictionStats(),
      ]);
      setLastChecked(checkTime);
      setStats(jurisdictionStats);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedJurisdiction]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    setChecking(true);
    try {
      const results = await checkForUpdates(true);
      const changed = results.filter(r => r.changed);
      if (changed.length > 0) {
        Alert.alert(
          'Updates Found',
          `${changed.length} legislation item(s) have been updated. Verify at official sources.`,
        );
      }
    } catch {
      // silent fail - still refresh data
    } finally {
      setChecking(false);
      await loadData();
    }
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const formatLastChecked = (dateStr: string | null) => {
    if (!dateStr) return 'Never checked';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }: { item: Legislation }) => {
    const cat = CATEGORY_LABELS[item.category];
    const isExpanded = expandedId === item.id;
    let provisions: string[] = [];
    try { provisions = JSON.parse(item.keyProvisions); } catch { /* ignore */ }

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: cat.color + '20' }]}>
            <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={14} color={cat.color} />
            <Text style={[styles.categoryText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <Text style={styles.jurisdictionBadge}>{item.jurisdiction}</Text>
        </View>

        <Text style={styles.cardTitle}>{item.shortTitle}</Text>
        <Text style={styles.cardFullTitle}>{item.title}</Text>
        <Text style={styles.cardDescription} numberOfLines={isExpanded ? undefined : 2}>
          {item.description}
        </Text>

        {isExpanded && provisions.length > 0 && (
          <View style={styles.provisionsContainer}>
            <Text style={styles.provisionsTitle}>Key Provisions</Text>
            {provisions.map((p, i) => (
              <View key={i} style={styles.provisionRow}>
                <Text style={styles.provisionBullet}>-</Text>
                <Text style={styles.provisionText}>{p}</Text>
              </View>
            ))}
          </View>
        )}

        {isExpanded && (
          <View style={styles.cardFooter}>
            {item.lastAmended && (
              <Text style={styles.amendedText}>Last amended: {item.lastAmended}</Text>
            )}
            {item.attribution && (
              <Text style={styles.attributionText}>{item.attribution}</Text>
            )}
            <TouchableOpacity style={styles.linkButton} onPress={() => openUrl(item.url)}>
              <Ionicons name="open-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.linkText}>View Official Legislation</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.expandIndicator}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.textMuted}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const totalLegislation = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <View style={styles.container}>
      {/* Legal Disclaimer Modal */}
      <Modal visible={showDisclaimer} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="warning-outline" size={40} color={theme.colors.warning} />
            <Text style={styles.modalTitle}>Legal Disclaimer</Text>
            <Text style={styles.modalText}>
              This is not legal advice. The legislation information provided is for reference purposes only.
              Laws change frequently and may not reflect the most current version.
            </Text>
            <Text style={styles.modalText}>
              Always verify information at the official source and consult a qualified legal professional
              for advice specific to your situation.
            </Text>
            <Text style={styles.modalText}>
              No warranties are provided regarding the accuracy, completeness, or currency of the
              legislation content displayed in this application.
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={acceptDisclaimer}>
              <Text style={styles.modalButtonText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.statusText}>
            Last updated: {formatLastChecked(lastChecked)}
          </Text>
        </View>
        {checking && (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}
        <Text style={styles.statusCount}>{totalLegislation} acts</Text>
      </View>

      {/* Jurisdiction chips with stats */}
      <FlatList
        horizontal
        data={JURISDICTIONS}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          const count = item.key === 'All' ? totalLegislation : (stats[item.key] || 0);
          return (
            <TouchableOpacity
              style={[styles.chip, selectedJurisdiction === item.key && styles.chipActive]}
              onPress={() => setSelectedJurisdiction(item.key)}
            >
              <Text style={[styles.chipText, selectedJurisdiction === item.key && styles.chipTextActive]}>
                {item.label}
              </Text>
              <View style={[styles.chipCount, selectedJurisdiction === item.key && styles.chipCountActive]}>
                <Text style={[styles.chipCountText, selectedJurisdiction === item.key && styles.chipCountTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.chipRow}
        showsHorizontalScrollIndicator={false}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="book-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>No legislation found for this jurisdiction.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
          ListFooterComponent={
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Verify at official source. Pull to check for updates.
              </Text>
              <TouchableOpacity onPress={() => setShowDisclaimer(true)}>
                <Text style={styles.disclaimerLink}>View Legal Disclaimer</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  statusCount: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  chipRow: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFF',
  },
  chipCount: {
    backgroundColor: theme.colors.background,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chipCountText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  chipCountTextActive: {
    color: '#FFF',
  },
  list: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  categoryText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  jurisdictionBadge: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardFullTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },
  cardDescription: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    lineHeight: 20,
  },
  provisionsContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  provisionsTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  provisionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  provisionBullet: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  provisionText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    flex: 1,
    lineHeight: 18,
  },
  cardFooter: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  amendedText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  attributionText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontStyle: 'italic',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  expandIndicator: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  footerText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
  },
  disclaimerLink: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  // Disclaimer Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.md,
    maxWidth: 360,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  modalText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
});
