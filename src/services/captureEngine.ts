/**
 * Hardened Capture Engine
 *
 * The forensic core of Evidence Guardian. When evidence is captured:
 * 1. SHA-256 hash is generated immediately
 * 2. GPS coordinates are embedded
 * 3. UTC time is fetched from NTP (not device clock)
 * 4. Device ID is recorded
 * 5. File is stored immutably (original "Master" is never modified)
 *
 * CRITICAL: No filters, edits, or modifications are allowed before storage.
 */

import * as FileSystem from 'expo-file-system';
import { hashFile } from './hashService';
import { getNTPTime } from './ntpTime';
import { getCurrentLocation } from './locationService';
import { getDeviceId, getAppVersion } from './deviceInfo';
import { insertEvidence } from '../database/evidenceRepository';
import { logAuditEvent } from '../database/auditRepository';
import { EvidenceType, ForensicMetadata } from '../types';

const EVIDENCE_DIR = `${FileSystem.documentDirectory}evidence/`;

async function ensureEvidenceDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(EVIDENCE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(EVIDENCE_DIR, { intermediates: true });
  }
}

function getExtensionForType(type: EvidenceType, mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/heic': '.heic',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'audio/m4a': '.m4a',
    'audio/aac': '.aac',
    'audio/wav': '.wav',
    'application/pdf': '.pdf',
  };
  return map[mimeType] || (type === 'photo' ? '.jpg' : type === 'video' ? '.mp4' : type === 'audio' ? '.m4a' : '.bin');
}

export interface CaptureResult {
  evidenceId: string;
  forensicMetadata: ForensicMetadata;
}

export async function hardenAndStoreEvidence(
  sourceUri: string,
  type: EvidenceType,
  mimeType: string
): Promise<CaptureResult> {
  await ensureEvidenceDir();

  // Step 1: Get NTP time immediately
  const ntpResult = await getNTPTime();

  // Step 2: Get location
  const location = await getCurrentLocation();

  // Step 3: Get device ID
  const deviceId = await getDeviceId();

  // Step 4: Generate SHA-256 hash of the ORIGINAL file
  const sha256Hash = await hashFile(sourceUri);

  // Step 5: Copy to immutable evidence storage
  const timestamp = ntpResult.utcTime.replace(/[:.]/g, '-');
  const ext = getExtensionForType(type, mimeType);
  const fileName = `${type}_${timestamp}_${sha256Hash.substring(0, 8)}${ext}`;
  const destUri = `${EVIDENCE_DIR}${fileName}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  // Step 6: Verify hash of copied file matches original
  const verifyHash = await hashFile(destUri);
  if (verifyHash !== sha256Hash) {
    await FileSystem.deleteAsync(destUri, { idempotent: true });
    throw new Error('INTEGRITY_VIOLATION: Hash mismatch after copy. Evidence may be corrupted.');
  }

  // Step 7: Get file info
  const fileInfo = await FileSystem.getInfoAsync(destUri, { size: true });
  const fileSize = (fileInfo as { size?: number }).size ?? 0;

  // Step 8: Build forensic metadata
  const forensicMetadata: ForensicMetadata = {
    sha256Hash,
    capturedAt: ntpResult.utcTime,
    ntpServerUsed: ntpResult.serverUsed,
    deviceId,
    latitude: location?.latitude,
    longitude: location?.longitude,
    altitude: location?.altitude ?? undefined,
    locationAccuracy: location?.accuracy ?? undefined,
    appVersion: getAppVersion(),
    captureMethod: 'in-app',
  };

  // Step 9: Store in database
  const evidenceId = await insertEvidence({
    type,
    status: 'locked',
    filePath: destUri,
    sha256Hash,
    fileSize,
    mimeType,
    capturedAt: ntpResult.utcTime,
    deviceId,
    latitude: location?.latitude,
    longitude: location?.longitude,
    altitude: location?.altitude ?? undefined,
    locationAccuracy: location?.accuracy ?? undefined,
    tags: [],
    isOriginal: true,
    versionNumber: 1,
  });

  // Step 10: Log audit event
  await logAuditEvent('created', 'evidence', evidenceId, {
    type,
    sha256Hash,
    capturedAt: ntpResult.utcTime,
    ntpServer: ntpResult.serverUsed,
    ntpAccuracy: ntpResult.accuracy,
    hasLocation: !!location,
  });

  return { evidenceId, forensicMetadata };
}

export async function importExternalFile(
  sourceUri: string,
  type: EvidenceType,
  mimeType: string
): Promise<CaptureResult> {
  // For imported files, same hardening but marked as imported
  const result = await hardenAndStoreEvidence(sourceUri, type, mimeType);

  // Update the forensic metadata to reflect import
  await logAuditEvent('created', 'evidence', result.evidenceId, {
    ...result.forensicMetadata,
    captureMethod: 'imported',
  });

  return result;
}

export async function verifyEvidenceIntegrity(evidenceId: string): Promise<{
  valid: boolean;
  currentHash: string;
  originalHash: string;
}> {
  const { getEvidenceById } = require('../database/evidenceRepository');
  const evidence = await getEvidenceById(evidenceId);

  if (!evidence) {
    throw new Error(`Evidence not found: ${evidenceId}`);
  }

  const currentHash = await hashFile(evidence.filePath);

  await logAuditEvent('viewed', 'evidence', evidenceId, {
    action: 'integrity_check',
    result: currentHash === evidence.sha256Hash ? 'valid' : 'tampered',
  });

  return {
    valid: currentHash === evidence.sha256Hash,
    currentHash,
    originalHash: evidence.sha256Hash,
  };
}
