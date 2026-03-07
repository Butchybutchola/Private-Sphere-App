/**
 * Audio Recorder Screen
 *
 * Records audio evidence with "Black Screen Recording" support.
 * When black screen mode is active, the screen appears off but
 * recording continues.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, StatusBar,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { hardenAndStoreEvidence } from '../services/captureEngine';
import { useDatabase } from '../context/DatabaseContext';
import { theme } from '../theme';

export function AudioRecorderScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [blackScreen, setBlackScreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { refreshEvidence } = useDatabase();

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      deactivateKeepAwake();
    };
  }, []);

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Microphone access is needed for audio evidence.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setDuration(0);

      // Keep screen awake during recording
      await activateKeepAwakeAsync();

      intervalRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch {
      Alert.alert('Error', 'Failed to start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setSaving(true);
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (!uri) {
        Alert.alert('Error', 'Failed to save recording.');
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      deactivateKeepAwake();

      // Harden and store
      const result = await hardenAndStoreEvidence(uri, 'audio', 'audio/m4a');
      await refreshEvidence();

      setRecording(null);
      setIsRecording(false);
      setBlackScreen(false);

      const ntpWarning = result.forensicMetadata.ntpServerUsed === 'device_fallback'
        ? '\n\n⚠️ NTP servers unreachable — timestamp is from device clock and may not be court-admissible.'
        : '';
      Alert.alert(
        'Audio Evidence Captured',
        `Duration: ${formatDuration(duration)}\nSHA-256: ${result.forensicMetadata.sha256Hash.substring(0, 16)}...${ntpWarning}`,
        [
          { text: 'View', onPress: () => navigation.navigate('EvidenceDetail', { evidenceId: result.evidenceId }) },
          { text: 'OK', onPress: () => navigation.goBack() },
        ]
      );
    } catch {
      Alert.alert('Error', 'Failed to save recording.');
    } finally {
      setSaving(false);
    }
  };

  // Black Screen Mode - shows fake "off" screen
  if (blackScreen && isRecording) {
    return (
      <TouchableOpacity
        style={styles.blackScreen}
        onLongPress={() => setBlackScreen(false)}
        activeOpacity={1}
      >
        <StatusBar hidden />
        {/* Tiny indicator that recording is active - barely visible */}
        <View style={styles.blackScreenIndicator} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Timer */}
      <View style={styles.timerContainer}>
        {isRecording && (
          <View style={styles.recIndicator}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </View>
        )}
        <Text style={styles.timer}>{formatDuration(duration)}</Text>
        <Text style={styles.forensicLabel}>FORENSIC AUDIO CAPTURE</Text>
      </View>

      {/* Waveform placeholder */}
      <View style={styles.waveformContainer}>
        <Ionicons
          name={isRecording ? 'radio' : 'mic-outline'}
          size={80}
          color={isRecording ? theme.colors.danger : theme.colors.textMuted}
        />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {!isRecording ? (
          <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
            <View style={styles.recordInner} />
          </TouchableOpacity>
        ) : (
          <View style={styles.recordingControls}>
            {/* Black Screen Mode */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setBlackScreen(true)}
            >
              <Ionicons name="eye-off" size={24} color={theme.colors.text} />
              <Text style={styles.controlLabel}>Stealth</Text>
            </TouchableOpacity>

            {/* Stop */}
            <TouchableOpacity
              style={[styles.recordButton, styles.stopButton]}
              onPress={stopRecording}
              disabled={saving}
            >
              <View style={styles.stopInner} />
            </TouchableOpacity>

            {/* Placeholder for symmetry */}
            <View style={styles.controlButton}>
              <Ionicons name="time" size={24} color={theme.colors.textMuted} />
              <Text style={styles.controlLabel}>{formatDuration(duration)}</Text>
            </View>
          </View>
        )}

        {isRecording && (
          <Text style={styles.stealthHint}>
            Tap "Stealth" for black screen recording
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  timerContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.xxl,
  },
  recIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.danger,
  },
  recText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timer: {
    color: theme.colors.text,
    fontSize: 56,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  forensicLabel: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: theme.spacing.sm,
  },
  waveformContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    alignItems: 'center',
    paddingBottom: theme.spacing.xxl,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: theme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    borderColor: '#FFF',
  },
  recordInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.danger,
  },
  stopInner: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: theme.spacing.xl,
  },
  controlButton: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  controlLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
  stealthHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.md,
  },
  blackScreen: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  blackScreenIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,0,0,0.15)',
  },
});
