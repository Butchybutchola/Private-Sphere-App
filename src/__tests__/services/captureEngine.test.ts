import * as FileSystem from 'expo-file-system';

// Mock all dependencies before importing captureEngine
jest.mock('../../services/hashService', () => ({
  hashFile: jest.fn().mockResolvedValue('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
}));

jest.mock('../../services/ntpTime', () => ({
  getNTPTime: jest.fn().mockResolvedValue({
    utcTime: '2026-02-20T12:00:00.000Z',
    serverUsed: 'worldtimeapi.org',
    accuracy: 'ntp',
  }),
}));

jest.mock('../../services/locationService', () => ({
  getCurrentLocation: jest.fn().mockResolvedValue({
    latitude: -33.8688,
    longitude: 151.2093,
    altitude: 50,
    accuracy: 5,
  }),
}));

jest.mock('../../services/deviceInfo', () => ({
  getDeviceId: jest.fn().mockResolvedValue('test-device-id'),
  getAppVersion: jest.fn().mockReturnValue('1.0.0-mvp'),
}));

jest.mock('../../database/evidenceRepository', () => ({
  insertEvidence: jest.fn().mockResolvedValue('ev-test-id'),
  getEvidenceById: jest.fn().mockResolvedValue({
    id: 'ev-test-id',
    filePath: '/mock/documents/evidence/photo.jpg',
    sha256Hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  }),
}));

jest.mock('../../database/auditRepository', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

import { hardenAndStoreEvidence, verifyEvidenceIntegrity } from '../../services/captureEngine';
import { hashFile } from '../../services/hashService';
import { getNTPTime } from '../../services/ntpTime';
import { getCurrentLocation } from '../../services/locationService';
import { getDeviceId } from '../../services/deviceInfo';
import { insertEvidence } from '../../database/evidenceRepository';
import { logAuditEvent } from '../../database/auditRepository';

describe('captureEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 2048 });
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('hardenAndStoreEvidence', () => {
    it('collects NTP time, location, device ID, and hashes the file', async () => {
      const result = await hardenAndStoreEvidence('/tmp/photo.jpg', 'photo', 'image/jpeg');

      expect(getNTPTime).toHaveBeenCalled();
      expect(getCurrentLocation).toHaveBeenCalled();
      expect(getDeviceId).toHaveBeenCalled();
      expect(hashFile).toHaveBeenCalledWith('/tmp/photo.jpg');
    });

    it('copies the file to the evidence directory', async () => {
      await hardenAndStoreEvidence('/tmp/photo.jpg', 'photo', 'image/jpeg');

      expect(FileSystem.copyAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '/tmp/photo.jpg',
          to: expect.stringContaining('evidence/'),
        })
      );
    });

    it('verifies hash after copy', async () => {
      await hardenAndStoreEvidence('/tmp/photo.jpg', 'photo', 'image/jpeg');

      // hashFile should be called twice: once for original, once for copy
      expect(hashFile).toHaveBeenCalledTimes(2);
    });

    it('inserts evidence into database', async () => {
      await hardenAndStoreEvidence('/tmp/photo.jpg', 'photo', 'image/jpeg');

      expect(insertEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'photo',
          status: 'locked',
          mimeType: 'image/jpeg',
          isOriginal: true,
          versionNumber: 1,
        })
      );
    });

    it('logs an audit event', async () => {
      await hardenAndStoreEvidence('/tmp/photo.jpg', 'photo', 'image/jpeg');

      expect(logAuditEvent).toHaveBeenCalledWith(
        'created',
        'evidence',
        'ev-test-id',
        expect.objectContaining({
          type: 'photo',
          ntpAccuracy: 'ntp',
        })
      );
    });

    it('returns evidenceId and forensicMetadata', async () => {
      const result = await hardenAndStoreEvidence('/tmp/photo.jpg', 'photo', 'image/jpeg');

      expect(result.evidenceId).toBe('ev-test-id');
      expect(result.forensicMetadata).toEqual(
        expect.objectContaining({
          sha256Hash: expect.any(String),
          capturedAt: '2026-02-20T12:00:00.000Z',
          deviceId: 'test-device-id',
          appVersion: '1.0.0-mvp',
          captureMethod: 'in-app',
        })
      );
    });

    it('throws on hash mismatch after copy', async () => {
      // First call: original hash. Second call: different hash (corrupted copy)
      (hashFile as jest.Mock)
        .mockResolvedValueOnce('original_hash_aaa')
        .mockResolvedValueOnce('different_hash_bbb');

      await expect(
        hardenAndStoreEvidence('/tmp/photo.jpg', 'photo', 'image/jpeg')
      ).rejects.toThrow('INTEGRITY_VIOLATION');
    });
  });

  describe('verifyEvidenceIntegrity', () => {
    it('returns valid=true when hash matches stored hash', async () => {
      const result = await verifyEvidenceIntegrity('ev-test-id');

      expect(result.valid).toBe(true);
      expect(result.currentHash).toBe(result.originalHash);
    });

    it('logs audit event for integrity check', async () => {
      await verifyEvidenceIntegrity('ev-test-id');

      expect(logAuditEvent).toHaveBeenCalledWith(
        'viewed',
        'evidence',
        'ev-test-id',
        expect.objectContaining({ action: 'integrity_check', result: 'valid' })
      );
    });
  });
});
