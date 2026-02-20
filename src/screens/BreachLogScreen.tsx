import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '../context/DatabaseContext';
import { insertBreachLog, getClausesForOrder } from '../database/courtOrderRepository';
import { updateEvidenceMetadata } from '../database/evidenceRepository';
import { logAuditEvent } from '../database/auditRepository';
import { getNTPTime } from '../services/ntpTime';
import { CourtOrderClause } from '../types';
import { theme } from '../theme';

export function BreachLogScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { evidenceId } = route.params;
  const { courtOrders, refreshEvidence } = useDatabase();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [clauses, setClauses] = useState<CourtOrderClause[]>([]);
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    const orderClauses = await getClausesForOrder(orderId);
    setClauses(orderClauses);
    setSelectedClauseId(null);
  };

  const handleSubmit = async () => {
    if (!selectedOrderId || !selectedClauseId || !description.trim()) {
      Alert.alert('Error', 'Please select a court order, clause, and provide a description.');
      return;
    }

    try {
      const ntpResult = await getNTPTime();
      const selectedClause = clauses.find(c => c.id === selectedClauseId);

      await insertBreachLog({
        evidenceId,
        courtOrderId: selectedOrderId,
        clauseId: selectedClauseId,
        description: description.trim(),
        occurredAt: ntpResult.utcTime,
      });

      await updateEvidenceMetadata(evidenceId, {
        courtOrderId: selectedOrderId,
        breachClause: `Clause ${selectedClause?.clauseNumber}: ${selectedClause?.description}`,
      });

      await logAuditEvent('tagged', 'evidence', evidenceId, {
        courtOrderId: selectedOrderId,
        clauseId: selectedClauseId,
        breachDescription: description.trim(),
      });

      await refreshEvidence();

      Alert.alert('Breach Logged', 'Evidence has been linked to the court order clause.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to log breach');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Link Evidence to Court Order Breach</Text>
      <Text style={styles.subtext}>
        Select the court order and clause that this evidence relates to.
      </Text>

      {/* Court Order Selection */}
      <Text style={styles.label}>Court Order</Text>
      {courtOrders.length === 0 ? (
        <Text style={styles.emptyText}>
          No court orders uploaded. Upload one from the Court Orders tab first.
        </Text>
      ) : (
        courtOrders.map(order => (
          <TouchableOpacity
            key={order.id}
            style={[styles.optionCard, selectedOrderId === order.id && styles.optionCardSelected]}
            onPress={() => handleSelectOrder(order.id)}
          >
            <Ionicons
              name={selectedOrderId === order.id ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={selectedOrderId === order.id ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={styles.optionText}>{order.title}</Text>
          </TouchableOpacity>
        ))
      )}

      {/* Clause Selection */}
      {selectedOrderId && (
        <>
          <Text style={styles.label}>Clause</Text>
          {clauses.length === 0 ? (
            <Text style={styles.emptyText}>
              No clauses defined for this order. Add clauses from the Court Order detail screen.
            </Text>
          ) : (
            clauses.map(clause => (
              <TouchableOpacity
                key={clause.id}
                style={[styles.optionCard, selectedClauseId === clause.id && styles.optionCardSelected]}
                onPress={() => setSelectedClauseId(clause.id)}
              >
                <Ionicons
                  name={selectedClauseId === clause.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selectedClauseId === clause.id ? theme.colors.primary : theme.colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionText}>Clause {clause.clauseNumber}</Text>
                  <Text style={styles.optionSubtext}>{clause.description}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </>
      )}

      {/* Description */}
      {selectedClauseId && (
        <>
          <Text style={styles.label}>Breach Description</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe how this evidence relates to the breach..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Ionicons name="flag" size={20} color="#FFF" />
            <Text style={styles.submitText}>Log Breach</Text>
          </TouchableOpacity>
        </>
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
  heading: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  subtext: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  optionText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '500',
  },
  optionSubtext: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: 2,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    fontStyle: 'italic',
    padding: theme.spacing.md,
  },
  textArea: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSize.md,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.warning,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
  },
  submitText: {
    color: '#FFF',
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
});
