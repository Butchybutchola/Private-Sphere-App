/**
 * Court Feed Screen
 *
 * Displays Australian court updates, practice directions, and legal news
 * relevant to family violence proceedings.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { CourtFeedItem } from '../types';
import { getCourtFeed, markFeedItemRead, addCourtFeedItem } from '../database/legislationRepository';

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  practice_direction: { label: 'Practice Direction', color: theme.colors.primary, icon: 'document-text' },
  media_release: { label: 'Media Release', color: theme.colors.accent, icon: 'megaphone' },
  judgment: { label: 'Judgment', color: theme.colors.warning, icon: 'hammer' },
  notice: { label: 'Notice', color: theme.colors.textSecondary, icon: 'information-circle' },
  legislative_update: { label: 'Legislative Update', color: theme.colors.danger, icon: 'alert-circle' },
};

const SAMPLE_FEED: Omit<CourtFeedItem, 'id' | 'createdAt'>[] = [
  {
    court: 'Federal Circuit and Family Court of Australia',
    jurisdiction: 'Federal',
    title: 'Updated Practice Direction: Family Violence Evidence in Parenting Matters',
    summary: 'New guidance on the admissibility and presentation of family violence evidence in parenting proceedings, including digital evidence and forensic reports.',
    url: 'https://www.fcfcoa.gov.au/practice-directions',
    category: 'practice_direction',
    publishedAt: '2025-01-10T09:00:00Z',
    isRead: false,
  },
  {
    court: 'Family Court of Australia',
    jurisdiction: 'Federal',
    title: 'Information Notice: Changes to Family Violence Risk Assessment Framework',
    summary: 'Updated risk assessment procedures for family violence matters, incorporating recommendations from the Australian Law Reform Commission review.',
    url: 'https://www.fcfcoa.gov.au/notices',
    category: 'notice',
    publishedAt: '2025-01-08T14:00:00Z',
    isRead: false,
  },
  {
    court: 'NSW Local Court',
    jurisdiction: 'NSW',
    title: 'Coercive Control Offence: First Sentencing Outcomes',
    summary: 'Media release regarding the first sentencing outcomes under the new coercive control offence provisions in NSW (s54D Crimes Act 1900).',
    url: 'https://www.localcourt.nsw.gov.au',
    category: 'media_release',
    publishedAt: '2025-01-05T10:30:00Z',
    isRead: false,
  },
  {
    court: 'Magistrates Court of Victoria',
    jurisdiction: 'VIC',
    title: 'Practice Direction: Technology-Facilitated Abuse Evidence',
    summary: 'Guidance for practitioners on presenting technology-facilitated abuse evidence in intervention order applications, including screenshots, metadata, and digital forensics.',
    url: 'https://www.mcv.vic.gov.au',
    category: 'practice_direction',
    publishedAt: '2025-01-03T11:00:00Z',
    isRead: false,
  },
  {
    court: 'Queensland Magistrates Court',
    jurisdiction: 'QLD',
    title: 'Legislative Update: Coercive Control Offence Commencement',
    summary: 'Notice regarding the full commencement of the coercive control offence under the Criminal Code (Coercive Control) and Other Legislation Amendment Act 2023.',
    url: 'https://www.courts.qld.gov.au/courts/magistrates-court',
    category: 'legislative_update',
    publishedAt: '2024-12-20T08:00:00Z',
    isRead: false,
  },
  {
    court: 'Family Court of Western Australia',
    jurisdiction: 'WA',
    title: 'Judgment: Family Violence and Property Settlement Considerations',
    summary: 'Significant judgment addressing how family violence history should be considered in property settlement proceedings under the Family Court Act 1997 (WA).',
    url: 'https://www.familycourt.wa.gov.au',
    category: 'judgment',
    publishedAt: '2024-12-15T09:00:00Z',
    isRead: false,
  },
];

export function CourtFeedScreen() {
  const [items, setItems] = useState<CourtFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      let data = await getCourtFeed();
      // Seed sample data if empty
      if (data.length === 0 && !filter) {
        for (const item of SAMPLE_FEED) {
          await addCourtFeedItem(item);
        }
        data = await getCourtFeed();
      }
      setItems(data);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePress = async (item: CourtFeedItem) => {
    if (!item.isRead) {
      await markFeedItemRead(item.id);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isRead: true } : i));
    }
    Linking.openURL(item.url).catch(() => {});
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderItem = ({ item }: { item: CourtFeedItem }) => {
    const cat = CATEGORY_CONFIG[item.category];
    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.cardUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: cat.color + '20' }]}>
            <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={12} color={cat.color} />
            <Text style={[styles.categoryLabel, { color: cat.color }]}>{cat.label}</Text>
          </View>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSummary} numberOfLines={3}>{item.summary}</Text>

        <View style={styles.cardMeta}>
          <Text style={styles.courtName}>{item.court}</Text>
          <Text style={styles.dateText}>{formatDate(item.publishedAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="newspaper-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>No court updates available.</Text>
          <Text style={styles.emptySubtext}>Pull to refresh for latest updates.</Text>
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
          ListHeaderComponent={
            <View style={styles.headerInfo}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.headerText}>
                Tap an item to open the source. Unread items have a blue dot.
              </Text>
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
  list: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
    paddingHorizontal: 4,
  },
  headerText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    flex: 1,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
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
  categoryLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
  },
  cardSummary: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
    marginBottom: theme.spacing.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  courtName: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    flex: 1,
  },
  dateText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
  emptySubtext: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
});
