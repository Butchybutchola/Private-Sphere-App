/**
 * Capture Screen
 *
 * Provides the hardened evidence capture interface.
 * CRITICAL: No filters, edits, or modifications are allowed.
 * The camera feed goes directly to the Hardened Capture Engine.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { hardenAndStoreEvidence, importExternalFile } from '../services/captureEngine';
import { useDatabase } from '../context/DatabaseContext';
import { theme } from '../theme';

export function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<CameraView>(null);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { refreshEvidence } = useDatabase();

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || capturing) return;

    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1, // Maximum quality - no compression
        exif: false, // We inject our own metadata
      });

      if (!photo?.uri) {
        Alert.alert('Error', 'Failed to capture photo');
        return;
      }

      const result = await hardenAndStoreEvidence(photo.uri, 'photo', 'image/jpeg');
      await refreshEvidence();

      const ntpWarning = result.forensicMetadata.ntpServerUsed === 'device_fallback'
        ? '\n\n⚠️ NTP servers unreachable — timestamp is from device clock and may not be court-admissible.'
        : '';
      Alert.alert(
        'Evidence Captured',
        `Photo hardened and locked.\nSHA-256: ${result.forensicMetadata.sha256Hash.substring(0, 16)}...${ntpWarning}`,
        [
          { text: 'View', onPress: () => navigation.navigate('EvidenceDetail', { evidenceId: result.evidenceId }) },
          { text: 'OK' },
        ]
      );
    } catch (error) {
      Alert.alert('Capture Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setCapturing(false);
    }
  }, [capturing, navigation, refreshEvidence]);

  const toggleVideoRecording = useCallback(async () => {
    if (!cameraRef.current) return;

    if (isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      setCapturing(true);
      try {
        const video = await cameraRef.current.recordAsync({
          maxDuration: 300, // 5 min max
        });

        if (!video?.uri) {
          Alert.alert('Error', 'Failed to record video');
          return;
        }

        const result = await hardenAndStoreEvidence(video.uri, 'video', 'video/mp4');
        await refreshEvidence();

        const ntpWarning = result.forensicMetadata.ntpServerUsed === 'device_fallback'
          ? '\n\n⚠️ NTP servers unreachable — timestamp is from device clock and may not be court-admissible.'
          : '';
        Alert.alert(
          'Evidence Captured',
          `Video hardened and locked.\nSHA-256: ${result.forensicMetadata.sha256Hash.substring(0, 16)}...${ntpWarning}`,
          [
            { text: 'View', onPress: () => navigation.navigate('EvidenceDetail', { evidenceId: result.evidenceId }) },
            { text: 'OK' },
          ]
        );
      } catch (error) {
        Alert.alert('Recording Failed', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setCapturing(false);
        setIsRecording(false);
      }
    }
  }, [isRecording, navigation, refreshEvidence]);

  const importDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setCapturing(true);
      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'application/octet-stream';
      let type: 'photo' | 'video' | 'audio' | 'document' = 'document';

      if (mimeType.startsWith('image/')) type = 'photo';
      else if (mimeType.startsWith('video/')) type = 'video';
      else if (mimeType.startsWith('audio/')) type = 'audio';

      const importResult = await importExternalFile(asset.uri, type, mimeType);
      await refreshEvidence();

      const ntpWarning = importResult.forensicMetadata.ntpServerUsed === 'device_fallback'
        ? '\n\n⚠️ NTP servers unreachable — timestamp is from device clock and may not be court-admissible.'
        : '';
      Alert.alert(
        'Evidence Imported',
        `File hardened and locked.\nSHA-256: ${importResult.forensicMetadata.sha256Hash.substring(0, 16)}...${ntpWarning}`,
        [
          { text: 'View', onPress: () => navigation.navigate('EvidenceDetail', { evidenceId: importResult.evidenceId }) },
          { text: 'OK' },
        ]
      );
    } catch (error) {
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setCapturing(false);
    }
  }, [navigation, refreshEvidence]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={theme.colors.textMuted} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          Evidence Guardian needs camera access to capture forensic evidence.
          No filters or edits will be applied.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode={mode}
      >
        {/* Overlay: Mode indicator */}
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <View style={styles.modeBadge}>
              <Ionicons
                name={mode === 'picture' ? 'camera' : 'videocam'}
                size={14}
                color="#FFF"
              />
              <Text style={styles.modeText}>
                {mode === 'picture' ? 'PHOTO' : 'VIDEO'}
                {isRecording ? ' - REC' : ''}
              </Text>
            </View>
            <Text style={styles.forensicLabel}>FORENSIC CAPTURE</Text>
          </View>
        </View>

        {/* Loading overlay */}
        {capturing && !isRecording && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.loadingText}>Hardening evidence...</Text>
          </View>
        )}
      </CameraView>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Mode Switcher */}
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'picture' && styles.modeTabActive]}
            onPress={() => setMode('picture')}
          >
            <Text style={[styles.modeTabText, mode === 'picture' && styles.modeTabTextActive]}>
              Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'video' && styles.modeTabActive]}
            onPress={() => setMode('video')}
          >
            <Text style={[styles.modeTabText, mode === 'video' && styles.modeTabTextActive]}>
              Video
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {/* Import */}
          <TouchableOpacity style={styles.sideButton} onPress={importDocument}>
            <Ionicons name="folder-open" size={24} color={theme.colors.text} />
            <Text style={styles.sideButtonText}>Import</Text>
          </TouchableOpacity>

          {/* Capture Button */}
          <TouchableOpacity
            style={[
              styles.captureButton,
              isRecording && styles.captureButtonRecording,
            ]}
            onPress={mode === 'picture' ? capturePhoto : toggleVideoRecording}
            disabled={capturing && !isRecording}
          >
            {isRecording ? (
              <View style={styles.stopIcon} />
            ) : (
              <View style={[
                styles.captureInner,
                mode !== 'picture' && styles.captureInnerVideo,
              ]} />
            )}
          </TouchableOpacity>

          {/* Audio / Flip */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={() => navigation.navigate('AudioRecorder')}
          >
            <Ionicons name="mic" size={24} color={theme.colors.text} />
            <Text style={styles.sideButtonText}>Audio</Text>
          </TouchableOpacity>
        </View>

        {/* Flip Camera */}
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
        >
          <Ionicons name="camera-reverse" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.flipText}>Flip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.round,
  },
  modeText: {
    color: '#FFF',
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  forensicLabel: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.md,
  },
  controls: {
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  modeSwitcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  modeTab: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.round,
  },
  modeTabActive: {
    backgroundColor: theme.colors.surface,
  },
  modeTabText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: theme.colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing.xl,
  },
  sideButton: {
    alignItems: 'center',
    gap: 4,
  },
  sideButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonRecording: {
    borderColor: theme.colors.danger,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
  },
  captureInnerVideo: {
    backgroundColor: theme.colors.danger,
  },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
  },
  flipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: theme.spacing.sm,
  },
  flipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  permissionTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '600',
    marginTop: theme.spacing.md,
  },
  permissionText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  permissionButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
});
