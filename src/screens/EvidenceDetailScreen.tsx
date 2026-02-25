import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Image, ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { EvidenceItem } from '../types';
import { getEvidenceById, updateEvidenceMetadata } from '../database/evidenceRepository';
import { verifyEvidenceIntegrity } from '../services/captureEngine';
import { transcribeAudio } from '../services/transcriptionService';
import { logAuditEvent } from '../database/auditRepository';
import { useDatabase } from '../context/DatabaseContext';
import { theme } from '../theme';
import { format } from 'date-fns';

export function EvidenceDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { evidenceId } = route.params;
  const { refreshEvidence } = useDatabase();

  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<'unknown' | 'valid' | 'tampered'>('unknown');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editingMeta, setEditingMeta] = useState(false);

  // Tag management
  const [newTag, setNewTag] = useState('');
  const [editingTags, setEditingTags] = useState(false);

  // Media playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);

  const loadEvidence = useCallback(async () => {
    const item = await getEvidenceById(evidenceId);
    if (item) {
      setEvidence(item);
      setEditTitle(item.title || '');
      setEditDescription(item.description || '');
    }
    setLoading(false);
  }, [evidenceId]);

  useEffect(() => {
    loadEvidence();
    return () => {
      // Cleanup audio on unmount
      audioSound?.unloadAsync();
    };
  }, [loadEvidence]);

  const verifyIntegrity = async () => {
    if (!evidence) return;
    setVerifying(true);
    try {
      const result = await verifyEvidenceIntegrity(evidence.id);
      setIntegrityStatus(result.valid ? 'valid' : 'tampered');
      await logAuditEvent('viewed', 'evidence', evidence.id, { action: 'integrity_check', valid: result.valid });
      Alert.alert(
        result.valid ? 'Integrity Verified' : 'INTEGRITY VIOLATION',
        result.valid
          ? `File hash matches original.\nSHA-256: ${result.currentHash.substring(0, 24)}...`
          : `File has been modified!\nOriginal: ${result.originalHash.substring(0, 24)}...\nCurrent: ${result.currentHash.substring(0, 24)}...`,
      );
    } catch {
      Alert.alert('Error', 'Failed to verify integrity.');
    }
    setVerifying(false);
  };

  const saveMetadata = async () => {
    if (!evidence) return;
    await updateEvidenceMetadata(evidence.id, {
      title: editTitle,
      description: editDescription,
    });
    await logAuditEvent('tagged', 'evidence', evidence.id, {
      title: editTitle,
      description: editDescription,
    });
    setEditingMeta(false);
    await loadEvidence();
    await refreshEvidence();
  };

  const handleTranscribe = async () => {
    if (!evidence) return;
    try {
      await transcribeAudio(evidence.id, evidence.filePath);
      await loadEvidence();
      Alert.alert('Transcription Complete', 'Audio has been transcribed successfully.');
    } catch (error) {
      Alert.alert('Transcription Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleLogBreach = () => {
    navigation.navigate('BreachLog', { evidenceId });
  };

  // Share/Export evidence file
  const handleShare = async () => {
    if (!evidence) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
        return;
      }

      // Check file exists
      const fileInfo = await FileSystem.getInfoAsync(evidence.filePath);
      if (!fileInfo.exists) {
        Alert.alert('File Not Found', 'The evidence file could not be located.');
        return;
      }

      await logAuditEvent('exported', 'evidence', evidence.id);
      await Sharing.shareAsync(evidence.filePath, {
        mimeType: evidence.mimeType,
        dialogTitle: `Share Evidence: ${evidence.title || 'Untitled'}`,
      });
    } catch (error) {
      Alert.alert('Share Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Audio playback
  const toggleAudioPlayback = async () => {
    if (!evidence) return;

    if (audioSound) {
      if (isPlaying) {
        await audioSound.pauseAsync();
        setIsPlaying(false);
      } else {
        await audioSound.playAsync();
        setIsPlaying(true);
      }
      return;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: evidence.filePath },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setAudioPosition(status.positionMillis);
            setAudioDuration(status.durationMillis ?? 0);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setAudioPosition(0);
            }
          }
        }
      );
      setAudioSound(sound);
      setIsPlaying(true);
    } catch {
      Alert.alert('Playback Error', 'Unable to play audio file.');
    }
  };

  // Tag management
  const addTag = async () => {
    if (!evidence || !newTag.trim()) return;
    const tag = newTag.trim().toLowerCase();
    if (evidence.tags.includes(tag)) {
      setNewTag('');
      return;
    }
    const updatedTags = [...evidence.tags, tag];
    await updateEvidenceMetadata(evidence.id, { tags: updatedTags });
    await logAuditEvent('tagged', 'evidence', evidence.id, { tag_added: tag });
    setNewTag('');
    await loadEvidence();
    await refreshEvidence();
  };

  const removeTag = async (tag: string) => {
    if (!evidence) return;
    const updatedTags = evidence.tags.filter(t => t !== tag);
    await updateEvidenceMetadata(evidence.id, { tags: updatedTags });
    await logAuditEvent('tagged', 'evidence', evidence.id, { tag_removed: tag });
    await loadEvidence();
    await refreshEvidence();
  };

  const formatDuration = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}:${rem.toString().padStart(2, '0')}`;
  };


  const parsedSourceMetadata = (() => {
    if (!evidence?.sourceMetadata) return null;
    try {
      return JSON.parse(evidence.sourceMetadata) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!evidence) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Evidence not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Preview */}
      {evidence.type === 'photo' && (
        <Image source={{ uri: evidence.filePath }} style={styles.preview} resizeMode="contain" />
      )}
      {evidence.type === 'video' && (
        <Video
          source={{ uri: evidence.filePath }}
          style={styles.preview}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
        />
      )}
      {evidence.type === 'audio' && (
        <View style={styles.audioPlayer}>
          <TouchableOpacity style={styles.playButton} onPress={toggleAudioPlayback}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={64}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
          <View style={styles.audioInfo}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: audioDuration > 0 ? `${(audioPosition / audioDuration) * 100}%` : '0%' },
                ]}
              />
            </View>
            <View style={styles.audioTimes}>
              <Text style={styles.timeText}>{formatDuration(audioPosition)}</Text>
              <Text style={styles.timeText}>{formatDuration(audioDuration)}</Text>
            </View>
          </View>
        </View>
      )}
      {evidence.type === 'document' && (
        <View style={styles.previewPlaceholder}>
          <Ionicons name="document" size={48} color={theme.colors.textMuted} />
          <Text style={styles.previewType}>DOCUMENT</Text>
        </View>
      )}

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusBadge, { backgroundColor: theme.colors.locked + '20' }]}>
          <Ionicons name="lock-closed" size={14} color={theme.colors.locked} />
          <Text style={[styles.statusText, { color: theme.colors.locked }]}>
            {evidence.status.toUpperCase()}
          </Text>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: integrityStatus === 'valid'
            ? theme.colors.success + '20'
            : integrityStatus === 'tampered'
              ? theme.colors.danger + '20'
              : theme.colors.surface,
        }]}>
          <Ionicons
            name={integrityStatus === 'valid' ? 'checkmark-circle' : integrityStatus === 'tampered' ? 'alert-circle' : 'help-circle'}
            size={14}
            color={integrityStatus === 'valid' ? theme.colors.success : integrityStatus === 'tampered' ? theme.colors.danger : theme.colors.textMuted}
          />
          <Text style={[styles.statusText, {
            color: integrityStatus === 'valid' ? theme.colors.success : integrityStatus === 'tampered' ? theme.colors.danger : theme.colors.textMuted,
          }]}>
            {integrityStatus === 'valid' ? 'VERIFIED' : integrityStatus === 'tampered' ? 'TAMPERED' : 'UNVERIFIED'}
          </Text>
        </View>
      </View>

      {/* Title & Description */}
      <View style={styles.section}>
        {editingMeta ? (
          <>
            <TextInput
              style={styles.titleInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Evidence title..."
              placeholderTextColor={theme.colors.textMuted}
            />
            <TextInput
              style={styles.descInput}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Add description..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.saveButton} onPress={saveMetadata}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingMeta(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setEditingMeta(true)}>
              <Text style={styles.title}>
                {evidence.title || 'Untitled Evidence'}
                {' '}<Ionicons name="pencil" size={14} color={theme.colors.textMuted} />
              </Text>
            </TouchableOpacity>
            {evidence.description && (
              <Text style={styles.description}>{evidence.description}</Text>
            )}
          </>
        )}
      </View>

      {/* Forensic Metadata */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Forensic Metadata</Text>
        <View style={styles.metaGrid}>
          <MetaRow label="SHA-256" value={evidence.sha256Hash} mono />
          <MetaRow label="Captured (UTC)" value={format(new Date(evidence.capturedAt), 'yyyy-MM-dd HH:mm:ss')} />
          <MetaRow label="Source Captured" value={evidence.sourceCapturedAt ? format(new Date(evidence.sourceCapturedAt), 'yyyy-MM-dd HH:mm:ss') : 'Unavailable'} />
          <MetaRow label="Device ID" value={evidence.deviceId} mono />
          <MetaRow label="GPS" value={
            evidence.latitude && evidence.longitude
              ? `${evidence.latitude.toFixed(6)}, ${evidence.longitude.toFixed(6)}`
              : 'Not available'
          } />
          {evidence.altitude != null && (
            <MetaRow label="Altitude" value={`${evidence.altitude.toFixed(2)} m`} />
          )}
          <MetaRow label="Accuracy" value={evidence.locationAccuracy ? `${evidence.locationAccuracy.toFixed(2)} m` : 'N/A'} />
          <MetaRow label="File Size" value={`${(evidence.fileSize / 1024).toFixed(2)} KB`} />
          <MetaRow label="MIME Type" value={evidence.mimeType} />
          <MetaRow label="Original" value={evidence.isOriginal ? 'Yes (Master)' : `Version ${evidence.versionNumber}`} />
          <MetaRow label="Source File" value={String(parsedSourceMetadata?.originalFileName || 'Unavailable')} />
          <MetaRow label="Source MIME" value={String(parsedSourceMetadata?.originalMimeType || evidence.mimeType)} />
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity style={styles.actionButton} onPress={verifyIntegrity} disabled={verifying}>
          {verifying ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
          )}
          <Text style={styles.actionText}>Verify Integrity</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={theme.colors.accent} />
          <Text style={styles.actionText}>Share / Export Evidence</Text>
        </TouchableOpacity>

        {evidence.type === 'audio' && (
          <TouchableOpacity style={styles.actionButton} onPress={handleTranscribe}>
            <Ionicons name="text" size={20} color={theme.colors.accent} />
            <Text style={styles.actionText}>Transcribe Audio</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionButton} onPress={handleLogBreach}>
          <Ionicons name="flag" size={20} color={theme.colors.warning} />
          <Text style={styles.actionText}>Log Breach Against Court Order</Text>
        </TouchableOpacity>
      </View>

      {/* Transcription */}
      {evidence.transcription && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transcription</Text>
          <View style={styles.transcriptionBox}>
            <Text style={styles.transcriptionText}>{evidence.transcription}</Text>
          </View>
        </View>
      )}

      {/* Tags */}
      <View style={styles.section}>
        <View style={styles.tagHeader}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <TouchableOpacity onPress={() => setEditingTags(!editingTags)}>
            <Ionicons
              name={editingTags ? 'checkmark-circle' : 'add-circle-outline'}
              size={22}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        {evidence.tags.length > 0 && (
          <View style={styles.tagRow}>
            {evidence.tags.map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
                {editingTags && (
                  <TouchableOpacity onPress={() => removeTag(tag)}>
                    <Ionicons name="close-circle" size={16} color={theme.colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {editingTags && (
          <View style={styles.addTagRow}>
            <TextInput
              style={styles.tagInput}
              value={newTag}
              onChangeText={setNewTag}
              placeholder="Add tag..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              onSubmitEditing={addTag}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
              <Text style={styles.addTagButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        {evidence.tags.length === 0 && !editingTags && (
          <Text style={styles.noTagsText}>No tags. Tap + to add tags.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, mono && styles.monoText]} numberOfLines={2}>
        {value}
      </Text>
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.lg,
  },
  preview: {
    width: '100%',
    height: 250,
    backgroundColor: '#000',
  },
  previewPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  previewType: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  // Audio player
  audioPlayer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  playButton: {
    marginBottom: theme.spacing.sm,
  },
  audioInfo: {
    width: '100%',
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  audioTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontFamily: 'monospace',
  },
  // Status
  statusBar: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  section: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginTop: 4,
  },
  titleInput: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
    paddingVertical: 4,
    marginBottom: theme.spacing.sm,
  },
  descInput: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  editActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
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
  metaGrid: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  metaLabel: {
    width: 100,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  metaValue: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: theme.fontSize.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  actionText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '500',
  },
  transcriptionBox: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
  },
  transcriptionText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    lineHeight: 22,
  },
  // Tag management
  tagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  tagText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
  },
  addTagRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  tagInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: theme.fontSize.md,
  },
  addTagButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  addTagButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: theme.fontSize.md,
  },
  noTagsText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontStyle: 'italic',
  },
});
