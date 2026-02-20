import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, RefreshControl, Modal,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useDatabase } from '../context/DatabaseContext';
import { CourtOrder } from '../types';
import { insertCourtOrder } from '../database/courtOrderRepository';
import { hashFile } from '../services/hashService';
import { getNTPTime } from '../services/ntpTime';
import { logAuditEvent } from '../database/auditRepository';
import { theme } from '../theme';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system';

const ORDERS_DIR = `${FileSystem.documentDirectory}court_orders/`;

export function CourtOrdersScreen() {
  const { courtOrders, refreshCourtOrders } = useDatabase();
  const [refreshing, setRefreshing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string } | null>(null);
  const navigation = useNavigation<any>();

  useFocusEffect(
    useCallback(() => {
      refreshCourtOrders();
    }, [refreshCourtOrders])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshCourtOrders();
    setRefreshing(false);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf'],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setSelectedFile({ uri: result.assets[0].uri, name: result.assets[0].name });
    }
  };

  const uploadOrder = async () => {
    if (!selectedFile || !title.trim()) {
      Alert.alert('Error', 'Please provide a title and select a PDF file.');
      return;
    }

    try {
      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(ORDERS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(ORDERS_DIR, { intermediates: true });
      }

      // Hash the file
      const sha256Hash = await hashFile(selectedFile.uri);
      const ntpResult = await getNTPTime();

      // Copy to storage
      const destPath = `${ORDERS_DIR}${sha256Hash.substring(0, 8)}_${selectedFile.name}`;
      await FileSystem.copyAsync({ from: selectedFile.uri, to: destPath });

      // Store in database
      const orderId = await insertCourtOrder({
        title: title.trim(),
        filePath: destPath,
        sha256Hash,
        uploadedAt: ntpResult.utcTime,
      });

      await logAuditEvent('created', 'court_order', orderId, {
        title: title.trim(),
        sha256Hash,
      });

      await refreshCourtOrders();

      setShowUpload(false);
      setTitle('');
      setSelectedFile(null);

      Alert.alert('Court Order Uploaded', `SHA-256: ${sha256Hash.substring(0, 16)}...`);
    } catch (error) {
      Alert.alert('Upload Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const renderOrder = ({ item }: { item: CourtOrder }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CourtOrderDetail', { orderId: item.id })}
    >
      <View style={styles.cardIcon}>
        <Ionicons name="document-text" size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardMeta}>
          Uploaded: {format(new Date(item.uploadedAt), 'MMM dd, yyyy')}
        </Text>
        <Text style={styles.cardClauses}>
          {item.clauses.length} clause{item.clauses.length !== 1 ? 's' : ''} defined
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={courtOrders}
        keyExtractor={item => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        ListHeaderComponent={
          <TouchableOpacity style={styles.uploadButton} onPress={() => setShowUpload(true)}>
            <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
            <Text style={styles.uploadButtonText}>Upload Court Order (PDF)</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No Court Orders</Text>
            <Text style={styles.emptyText}>
              Upload a court order PDF to start tagging evidence against specific clauses
            </Text>
          </View>
        }
      />

      {/* Upload Modal */}
      <Modal visible={showUpload} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload Court Order</Text>

            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Court order title..."
              placeholderTextColor={theme.colors.textMuted}
            />

            <TouchableOpacity style={styles.fileButton} onPress={pickDocument}>
              <Ionicons name="document-attach" size={20} color={theme.colors.primary} />
              <Text style={styles.fileButtonText}>
                {selectedFile ? selectedFile.name : 'Select PDF File'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSave} onPress={uploadOrder}>
                <Text style={styles.modalSaveText}>Upload</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowUpload(false); setTitle(''); setSelectedFile(null); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    marginBottom: theme.spacing.md,
  },
  uploadButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
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
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary + '15',
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
  },
  cardMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  cardClauses: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    marginBottom: theme.spacing.lg,
  },
  input: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSize.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  fileButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  modalSave: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  modalSaveText: {
    color: '#FFF',
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
  modalCancelText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
});
