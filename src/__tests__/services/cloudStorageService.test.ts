/**
 * Tests for cloudStorageService.ts
 *
 * Focuses on the size-limit guard (assertFileSizeLimit) which is the
 * security-critical new behaviour. Firebase SDK calls are mocked so tests
 * run without network access.
 */

// ─── Mock registrations ───────────────────────────────────────────────────────

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('../../config/firebase', () => ({
  isFirebaseConfigured: jest.fn(() => true),
  getFirebaseStorage: jest.fn(() => ({})),
}));

jest.mock('../../services/authService', () => ({
  getCurrentUser: jest.fn(() => ({ uid: 'user-123' })),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(() => ({})),
  uploadBytesResumable: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system';
import { uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { isFirebaseConfigured } from '../../config/firebase';
import {
  uploadEvidenceFile,
  uploadCourtOrderFile,
  uploadReportFile,
} from '../../services/cloudStorageService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MB = 1024 * 1024;

/** Simulate getInfoAsync returning a file of the given byte size. */
function mockFileSize(bytes: number): void {
  (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
    exists: true,
    size: bytes,
  });
}

/** Simulate a successful Firebase upload that resolves with a download URL. */
function mockSuccessfulUpload(downloadUrl = 'https://storage.example.com/file'): void {
  (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('base64data');
  const snapshotRef = {};
  const uploadTask = {
    on: jest.fn((_event: string, onProgress: unknown, onError: unknown, onComplete: () => void) => {
      // Fire the complete callback synchronously
      onComplete();
    }),
    snapshot: { ref: snapshotRef },
  };
  (uploadBytesResumable as jest.Mock).mockReturnValue(uploadTask);
  (getDownloadURL as jest.Mock).mockResolvedValue(downloadUrl);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (isFirebaseConfigured as jest.Mock).mockReturnValue(true);
});

// ─── uploadEvidenceFile — size limits ─────────────────────────────────────────

describe('uploadEvidenceFile — size limits', () => {
  it('throws when file exceeds 500 MB limit', async () => {
    mockFileSize(501 * MB);

    await expect(
      uploadEvidenceFile('ev-1', '/storage/huge.mp4', 'huge.mp4', 'video/mp4')
    ).rejects.toThrow('File too large for upload');
  });

  it('includes the file size and limit in the error message', async () => {
    mockFileSize(600 * MB);

    await expect(
      uploadEvidenceFile('ev-1', '/storage/huge.mp4', 'huge.mp4', 'video/mp4')
    ).rejects.toThrow('500 MB limit');
  });

  it('allows a file exactly at the 500 MB limit', async () => {
    mockFileSize(500 * MB);
    mockSuccessfulUpload();

    await expect(
      uploadEvidenceFile('ev-1', '/storage/ok.mp4', 'ok.mp4', 'video/mp4')
    ).resolves.toMatchObject({ downloadUrl: expect.any(String) });
  });

  it('allows a small file well under the limit', async () => {
    mockFileSize(2 * MB);
    mockSuccessfulUpload();

    await expect(
      uploadEvidenceFile('ev-1', '/storage/photo.jpg', 'photo.jpg', 'image/jpeg')
    ).resolves.toMatchObject({ storagePath: expect.stringContaining('ev-1') });
  });

  it('throws when file does not exist', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

    await expect(
      uploadEvidenceFile('ev-1', '/storage/missing.jpg', 'missing.jpg', 'image/jpeg')
    ).rejects.toThrow('File not found');
  });

  it('throws when Firebase is not configured', async () => {
    (isFirebaseConfigured as jest.Mock).mockReturnValue(false);

    await expect(
      uploadEvidenceFile('ev-1', '/storage/photo.jpg', 'photo.jpg', 'image/jpeg')
    ).rejects.toThrow('Firebase not configured');
  });
});

// ─── uploadCourtOrderFile — size limits ───────────────────────────────────────

describe('uploadCourtOrderFile — size limits', () => {
  it('throws when PDF exceeds 50 MB limit', async () => {
    mockFileSize(51 * MB);

    await expect(
      uploadCourtOrderFile('co-1', '/storage/order.pdf', 'order.pdf')
    ).rejects.toThrow('File too large for upload');
  });

  it('allows a PDF exactly at the 50 MB limit', async () => {
    mockFileSize(50 * MB);
    mockSuccessfulUpload();

    await expect(
      uploadCourtOrderFile('co-1', '/storage/order.pdf', 'order.pdf')
    ).resolves.toMatchObject({ downloadUrl: expect.any(String) });
  });

  it('allows a small PDF', async () => {
    mockFileSize(1 * MB);
    mockSuccessfulUpload();

    await expect(
      uploadCourtOrderFile('co-1', '/storage/order.pdf', 'order.pdf')
    ).resolves.toMatchObject({ storagePath: expect.stringContaining('co-1') });
  });
});

// ─── uploadReportFile — size limits ──────────────────────────────────────────

describe('uploadReportFile — size limits', () => {
  it('throws when report exceeds 50 MB limit', async () => {
    mockFileSize(55 * MB);

    await expect(
      uploadReportFile('rpt-1', '/storage/report.pdf', 'report.pdf')
    ).rejects.toThrow('File too large for upload');
  });

  it('allows a small report PDF', async () => {
    mockFileSize(3 * MB);
    mockSuccessfulUpload();

    await expect(
      uploadReportFile('rpt-1', '/storage/report.pdf', 'report.pdf')
    ).resolves.toMatchObject({ storagePath: expect.stringContaining('rpt-1') });
  });
});

// ─── Upload progress callback ─────────────────────────────────────────────────

describe('uploadEvidenceFile — progress callback', () => {
  it('invokes onProgress with percentage during upload', async () => {
    mockFileSize(1 * MB);
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('base64data');

    const snapshotRef = {};
    const uploadTask = {
      on: jest.fn((_event: string, onProgress: (snap: unknown) => void, _onError: unknown, onComplete: () => void) => {
        // Fire a progress snapshot then complete
        onProgress({ bytesTransferred: 512 * 1024, totalBytes: 1024 * 1024 });
        onComplete();
      }),
      snapshot: { ref: snapshotRef },
    };
    (uploadBytesResumable as jest.Mock).mockReturnValue(uploadTask);
    (getDownloadURL as jest.Mock).mockResolvedValue('https://storage.example.com/file');

    const progressCalls: number[] = [];
    await uploadEvidenceFile(
      'ev-1', '/storage/photo.jpg', 'photo.jpg', 'image/jpeg',
      (p) => progressCalls.push(p.percentage)
    );

    expect(progressCalls).toHaveLength(1);
    expect(progressCalls[0]).toBeCloseTo(50, 0);
  });
});
