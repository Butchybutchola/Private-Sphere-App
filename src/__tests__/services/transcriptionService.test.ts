import { transcribeAudio, setWhisperApiKey, getWhisperApiKey } from '../../services/transcriptionService';

jest.mock('../../database/evidenceRepository', () => ({
  updateTranscription: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../database/auditRepository', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

import { updateTranscription } from '../../database/evidenceRepository';

describe('transcriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setWhisperApiKey / getWhisperApiKey', () => {
    it('stores and retrieves the API key', async () => {
      await setWhisperApiKey('sk-test-key-123');
      const key = await getWhisperApiKey();
      expect(key).toBe('sk-test-key-123');
    });
  });

  describe('transcribeAudio', () => {
    it('sets status to processing then fails when no API key is set', async () => {
      // Clear any key by getting a fresh module scope
      jest.resetModules();
      const mod = require('../../services/transcriptionService');

      // No key configured = should throw
      await expect(
        mod.transcribeAudio('ev-1', '/mock/audio.m4a')
      ).rejects.toThrow('Whisper API key not configured');
    });

    it('updates transcription status to processing first', async () => {
      await expect(
        transcribeAudio('ev-1', '/mock/audio.m4a')
      ).rejects.toThrow();

      // First call should set status to 'processing'
      expect(updateTranscription).toHaveBeenCalledWith('ev-1', '', 'processing');
    });
  });
});
