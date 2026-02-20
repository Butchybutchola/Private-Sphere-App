/**
 * AI Transcription Service
 *
 * Integrates with OpenAI Whisper API for audio-to-text transcription.
 * Configured via environment/secure storage for API key management.
 *
 * For MVP: Provides the interface and mock fallback.
 * Production: Connect to Whisper API endpoint.
 */

import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { updateTranscription } from '../database/evidenceRepository';
import { logAuditEvent } from '../database/auditRepository';

const WHISPER_API_KEY_STORE = 'whisper_api_key';
const WHISPER_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

export async function setWhisperApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(WHISPER_API_KEY_STORE, key);
}

export async function getWhisperApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(WHISPER_API_KEY_STORE);
}

export async function transcribeAudio(
  evidenceId: string,
  audioFileUri: string
): Promise<string> {
  // Update status to processing
  await updateTranscription(evidenceId, '', 'processing');

  try {
    const apiKey = await getWhisperApiKey();

    if (!apiKey) {
      // MVP fallback: mark as pending configuration
      await updateTranscription(
        evidenceId,
        '[Transcription requires Whisper API key. Configure in Settings.]',
        'failed'
      );
      throw new Error('Whisper API key not configured');
    }

    // Read audio file as base64
    const fileBase64 = await FileSystem.readAsStringAsync(audioFileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create form data for Whisper API
    const formData = new FormData();

    // Convert base64 to blob for upload
    const response = await fetch(`data:audio/m4a;base64,${fileBase64}`);
    const blob = await response.blob();
    formData.append('file', blob, 'audio.m4a');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    formData.append('language', 'en');

    const result = await fetch(WHISPER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!result.ok) {
      const error = await result.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const transcription = await result.text();

    // Store transcription
    await updateTranscription(evidenceId, transcription.trim(), 'completed');

    // Log audit event
    await logAuditEvent('transcribed', 'evidence', evidenceId, {
      transcriptionLength: transcription.length,
    });

    return transcription.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await updateTranscription(evidenceId, `[Transcription failed: ${message}]`, 'failed');
    throw error;
  }
}
