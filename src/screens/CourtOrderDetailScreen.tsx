import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { CourtOrder, BreachLog } from '../types';
import { getCourtOrderById, addClause, getBreachLogsForOrder } from '../database/courtOrderRepository';
import { theme } from '../theme';
import { format } from 'date-fns';

export function CourtOrderDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CourtOrderDetail'>>();
  const { orderId } = route.params;

  const [order, setOrder] = useState<CourtOrder | null>(null);
  const [breaches, setBreaches] = useState<BreachLog[]>([]);
  const [addingClause, setAddingClause] = useState(false);
  const [clauseNumber, setClauseNumber] = useState('');
  const [clauseDescription, setClauseDescription] = useState('');

  const loadData = useCallback(async () => {
    const o = await getCourtOrderById(orderId);
    setOrder(o);
    const b = await getBreachLogsForOrder(orderId);
    setBreaches(b);
  }, [orderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddClause = async () => {
    if (!clauseNumber.trim() || !clauseDescription.trim()) {
      Alert.alert('Error', 'Please provide clause number and description.');
      return;
    }

    await addClause(orderId, clauseNumber.trim(), clauseDescription.trim());
    setClauseNumber('');
    setClauseDescription('');
    setAddingClause(false);
    await loadData();
  };

  if (!order) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{order.title}</Text>
        <Text style={styles.meta}>
          Uploaded: {format(new Date(order.uploadedAt), 'MMM dd, yyyy HH:mm')} UTC
        </Text>
        <Text style={styles.hash}>SHA-256: {order.sha256Hash.substring(0, 24)}...</Text>
      </View>

      {/* Clauses */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Clauses</Text>
          <TouchableOpacity onPress={() => setAddingClause(true)}>
            <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {addingClause && (
          <View style={styles.addClauseForm}>
            <TextInput
              style={styles.input}
              value={clauseNumber}
              onChangeText={setClauseNumber}
              placeholder="Clause number (e.g., 4)"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={clauseDescription}
              onChangeText={setClauseDescription}
              placeholder="Clause description..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.saveButton} onPress={handleAddClause}>
                <Text style={styles.saveButtonText}>Add Clause</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAddingClause(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {order.clauses.length === 0 ? (
          <Text style={styles.emptyText}>
            No clauses defined. Add clauses to tag evidence against specific terms.
          </Text>
        ) : (
          order.clauses.map((clause) => (
            <View key={clause.id} style={styles.clauseCard}>
              <View style={styles.clauseNumber}>
                <Text style={styles.clauseNumberText}>{clause.clauseNumber}</Text>
              </View>
              <Text style={styles.clauseDescription}>{clause.description}</Text>
            </View>
          ))
        )}
      </View>

      {/* Breach Log */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Breach History</Text>
        {breaches.length === 0 ? (
          <Text style={styles.emptyText}>
            No breaches logged. Tag evidence from the Evidence Detail screen.
          </Text>
        ) : (
          breaches.map((breach) => (
            <View key={breach.id} style={styles.breachCard}>
              <Text style={styles.breachDate}>
                {format(new Date(breach.occurredAt), 'MMM dd, yyyy HH:mm')} UTC
              </Text>
              <Text style={styles.breachDescription}>{breach.description}</Text>
              <Text style={styles.breachEvidence}>Evidence: {breach.evidenceId.substring(0, 12)}...</Text>
            </View>
          ))
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
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  meta: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: 4,
  },
  hash: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  section: {
    padding: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addClauseForm: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.fontSize.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  cancelText: {
    color: theme.colors.textSecondary,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    fontStyle: 'italic',
  },
  clauseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  clauseNumber: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    minWidth: 40,
    alignItems: 'center',
  },
  clauseNumberText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  clauseDescription: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  breachCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning,
  },
  breachDate: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  breachDescription: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    marginTop: 4,
  },
  breachEvidence: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontFamily: 'monospace',
    marginTop: 4,
  },
});
