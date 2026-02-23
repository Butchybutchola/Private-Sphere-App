/**
 * Legislation Browser Screen
 *
 * Browse Australian DV protection legislation by jurisdiction and category.
 * Links to official legislation sources.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { Legislation, LegislationJurisdiction } from '../types';
import { getAllLegislation, getLegislationByJurisdiction } from '../database/legislationRepository';
import { seedLegislationData } from '../database/legislationSeedData';

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
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<LegislationJurisdiction | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
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

  return (
    <View style={styles.container}>
      {/* Jurisdiction chips */}
      <FlatList
        horizontal
        data={JURISDICTIONS}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, selectedJurisdiction === item.key && styles.chipActive]}
            onPress={() => setSelectedJurisdiction(item.key)}
          >
            <Text style={[styles.chipText, selectedJurisdiction === item.key && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
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
  chipRow: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
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
});
