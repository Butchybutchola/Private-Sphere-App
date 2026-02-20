import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '../context/DatabaseContext';
import { generateReport, shareReport } from '../services/pdfEngine';
import { getAuditLog } from '../database/auditRepository';
import { getBreachLogsForOrder } from '../database/courtOrderRepository';
import { EvidenceType } from '../types';
import { theme } from '../theme';

export function ReportsScreen() {
  const { evidence, courtOrders } = useDatabase();
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState('Evidence Report');
  const [selectedTypes, setSelectedTypes] = useState<Set<EvidenceType>>(
    new Set(['photo', 'video', 'audio', 'document'])
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<{ filePath: string; hash: string } | null>(null);

  const toggleType = (type: EvidenceType) => {
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    setSelectedTypes(next);
  };

  const handleGenerate = async () => {
    const filtered = evidence.filter(e => selectedTypes.has(e.type));

    if (filtered.length === 0) {
      Alert.alert('No Evidence', 'No evidence items match your selection.');
      return;
    }

    setGenerating(true);
    try {
      const auditEntries = await getAuditLog(undefined, undefined, 500);
      const breaches = selectedOrderId
        ? await getBreachLogsForOrder(selectedOrderId)
        : [];
      const courtOrder = selectedOrderId
        ? courtOrders.find(o => o.id === selectedOrderId)
        : undefined;

      const result = await generateReport({
        title: title.trim() || 'Evidence Report',
        evidence: filtered,
        breaches,
        auditEntries,
        courtOrder: courtOrder ?? undefined,
      });

      setLastReport({ filePath: result.filePath, hash: result.sha256Hash });

      Alert.alert(
        'Report Generated',
        `${filtered.length} evidence items included.\nSHA-256: ${result.sha256Hash.substring(0, 16)}...`,
        [
          { text: 'Share', onPress: () => shareReport(result.filePath) },
          { text: 'OK' },
        ]
      );
    } catch (error) {
      Alert.alert('Generation Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="newspaper" size={32} color={theme.colors.primary} />
        <Text style={styles.headerTitle}>Generate Evidence Report</Text>
        <Text style={styles.headerSubtext}>
          Create a court-ready PDF with metadata verification sheets,
          chronological index, and audit trail.
        </Text>
      </View>

      {/* Report Title */}
      <Text style={styles.label}>Report Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Evidence Report"
        placeholderTextColor={theme.colors.textMuted}
      />

      {/* Evidence Type Filter */}
      <Text style={styles.label}>Include Evidence Types</Text>
      <View style={styles.typeRow}>
        {(['photo', 'video', 'audio', 'document'] as EvidenceType[]).map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.typeChip, selectedTypes.has(type) && styles.typeChipActive]}
            onPress={() => toggleType(type)}
          >
            <Ionicons
              name={selectedTypes.has(type) ? 'checkbox' : 'square-outline'}
              size={18}
              color={selectedTypes.has(type) ? '#FFF' : theme.colors.textMuted}
            />
            <Text style={[styles.typeChipText, selectedTypes.has(type) && styles.typeChipTextActive]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Court Order Association */}
      <Text style={styles.label}>Associated Court Order (Optional)</Text>
      <TouchableOpacity
        style={[styles.orderSelect, !selectedOrderId && styles.orderSelectNone]}
        onPress={() => setSelectedOrderId(null)}
      >
        <Text style={styles.orderSelectText}>None</Text>
      </TouchableOpacity>
      {courtOrders.map(order => (
        <TouchableOpacity
          key={order.id}
          style={[styles.orderSelect, selectedOrderId === order.id && styles.orderSelectActive]}
          onPress={() => setSelectedOrderId(order.id)}
        >
          <Ionicons
            name={selectedOrderId === order.id ? 'radio-button-on' : 'radio-button-off'}
            size={18}
            color={selectedOrderId === order.id ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={styles.orderSelectText}>{order.title}</Text>
        </TouchableOpacity>
      ))}

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {evidence.filter(e => selectedTypes.has(e.type)).length} evidence items will be included
        </Text>
      </View>

      {/* Generate Button */}
      <TouchableOpacity
        style={[styles.generateButton, generating && styles.generateButtonDisabled]}
        onPress={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Ionicons name="document-text" size={20} color="#FFF" />
        )}
        <Text style={styles.generateText}>
          {generating ? 'Generating Report...' : 'Generate PDF Report'}
        </Text>
      </TouchableOpacity>

      {/* Last Report */}
      {lastReport && (
        <View style={styles.lastReport}>
          <Text style={styles.lastReportTitle}>Last Generated Report</Text>
          <Text style={styles.lastReportHash}>SHA-256: {lastReport.hash.substring(0, 24)}...</Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => shareReport(lastReport.filePath)}
          >
            <Ionicons name="share" size={18} color={theme.colors.primary} />
            <Text style={styles.shareText}>Share Report</Text>
          </TouchableOpacity>
        </View>
      )}
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
  header: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    marginTop: theme.spacing.sm,
  },
  headerSubtext: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSize.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  typeChipText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
  },
  typeChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  orderSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  orderSelectNone: {},
  orderSelectActive: {
    borderColor: theme.colors.primary,
  },
  orderSelectText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  summary: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  summaryText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateText: {
    color: '#FFF',
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  lastReport: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.success + '40',
  },
  lastReportTitle: {
    color: theme.colors.success,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastReportHash: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontFamily: 'monospace',
    marginBottom: theme.spacing.sm,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: '500',
  },
});
