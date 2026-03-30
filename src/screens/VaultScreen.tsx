import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '../context/DatabaseContext';
import { EvidenceItem, EvidenceType } from '../types';
import { theme } from '../theme';
import { format } from 'date-fns';
import { logAuditEvent } from '../database/auditRepository';

const TYPE_ICONS: Record<EvidenceType, keyof typeof Ionicons.glyphMap> = {
  photo: 'image',
  video: 'videocam',
  audio: 'mic',
  document: 'document',
};

const TYPE_COLORS: Record<EvidenceType, string> = {
  photo: '#4A90D9',
  video: '#E74C3C',
  audio: '#F5A623',
  document: '#27AE60',
};

function EvidenceCard({ item, onPress }: { item: EvidenceItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.typeIndicator, { backgroundColor: TYPE_COLORS[item.type] }]}>
        <Ionicons name={TYPE_ICONS[item.type]} size={24} color="#FFF" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title || `${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Evidence`}
        </Text>
        <Text style={styles.cardMeta}>
          {format(new Date(item.capturedAt), 'MMM dd, yyyy HH:mm')} UTC
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.badge}>
            <Ionicons name="lock-closed" size={10} color={theme.colors.locked} />
            <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.hashPreview}>
            SHA: {item.sha256Hash.substring(0, 12)}...
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

export function VaultScreen() {
  const { evidence, refreshEvidence } = useDatabase();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EvidenceType | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  useFocusEffect(
    useCallback(() => {
      refreshEvidence();
    }, [refreshEvidence])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshEvidence();
    setRefreshing(false);
  };

  const filtered = evidence.filter(item => {
    if (filter !== 'all' && item.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q)) ||
        item.sha256Hash.includes(q)
      );
    }
    return true;
  });

  const handlePress = async (item: EvidenceItem) => {
    await logAuditEvent('viewed', 'evidence', item.id);
    navigation.navigate('EvidenceDetail', { evidenceId: item.id });
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search evidence..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['all', 'photo', 'video', 'audio', 'document'] as const).map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, filter === type && styles.chipActive]}
            onPress={() => setFilter(type)}
          >
            <Text style={[styles.chipText, filter === type && styles.chipTextActive]}>
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Evidence Count */}
      <Text style={styles.countText}>
        {filtered.length} evidence item{filtered.length !== 1 ? 's' : ''}
      </Text>

      {/* Evidence List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <EvidenceCard item={item} onPress={() => handlePress(item)} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shield-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No Evidence Yet</Text>
            <Text style={styles.emptyText}>
              Tap the Capture tab to start recording evidence
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.round,
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
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  countText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeIndicator: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: theme.colors.locked,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  hashPreview: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontFamily: 'monospace',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '600',
    marginTop: theme.spacing.md,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
});
