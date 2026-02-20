/**
 * Cloud Sync Service
 *
 * Bridges local SQLite database with Firebase Firestore for multi-device sync.
 *
 * Sync strategy:
 * - Local-first: all operations work offline via SQLite
 * - Background sync: push local changes to Firestore when online
 * - Pull sync: fetch remote changes on app launch / manual refresh
 * - Conflict resolution: last-write-wins based on updatedAt timestamp
 *
 * Firestore collections:
 *   users/{uid}/evidence/{id}
 *   users/{uid}/court_orders/{id}
 *   users/{uid}/court_order_clauses/{id}
 *   users/{uid}/breach_logs/{id}
 *   users/{uid}/audit_log/{id}
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '../config/firebase';
import { getCurrentUser } from './authService';
import { uploadEvidenceFile, UploadProgress } from './cloudStorageService';
import { getAllEvidence } from '../database/evidenceRepository';
import { getAllCourtOrders } from '../database/courtOrderRepository';
import { getAuditLog } from '../database/auditRepository';
import { EvidenceItem, CourtOrder, AuditLogEntry } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export interface SyncResult {
  evidencePushed: number;
  courtOrdersPushed: number;
  auditEntriesPushed: number;
  errors: string[];
}

function getUserCollection(collectionName: string) {
  const user = getCurrentUser();
  if (!user) throw new Error('Must be authenticated to sync');
  const db = getFirestoreDb();
  return collection(db, 'users', user.uid, collectionName);
}

function getUserDoc(collectionName: string, docId: string) {
  const user = getCurrentUser();
  if (!user) throw new Error('Must be authenticated to sync');
  const db = getFirestoreDb();
  return doc(db, 'users', user.uid, collectionName, docId);
}

async function pushEvidenceToCloud(
  evidence: EvidenceItem,
  onUploadProgress?: (evidenceId: string, progress: UploadProgress) => void
): Promise<void> {
  // Upload file to cloud storage
  const fileName = evidence.filePath.split('/').pop() || 'evidence';
  await uploadEvidenceFile(
    evidence.id,
    evidence.filePath,
    fileName,
    evidence.mimeType,
    onUploadProgress ? (p) => onUploadProgress(evidence.id, p) : undefined
  );

  // Push metadata to Firestore
  await setDoc(getUserDoc('evidence', evidence.id), {
    type: evidence.type,
    status: evidence.status,
    sha256Hash: evidence.sha256Hash,
    fileSize: evidence.fileSize,
    mimeType: evidence.mimeType,
    capturedAt: evidence.capturedAt,
    deviceId: evidence.deviceId,
    latitude: evidence.latitude ?? null,
    longitude: evidence.longitude ?? null,
    altitude: evidence.altitude ?? null,
    locationAccuracy: evidence.locationAccuracy ?? null,
    title: evidence.title ?? null,
    description: evidence.description ?? null,
    tags: evidence.tags,
    courtOrderId: evidence.courtOrderId ?? null,
    breachClause: evidence.breachClause ?? null,
    transcription: evidence.transcription ?? null,
    transcriptionStatus: evidence.transcriptionStatus ?? null,
    parentId: evidence.parentId ?? null,
    isOriginal: evidence.isOriginal,
    versionNumber: evidence.versionNumber,
    localCreatedAt: evidence.createdAt,
    localUpdatedAt: evidence.updatedAt,
    syncedAt: serverTimestamp(),
  }, { merge: true });
}

async function pushCourtOrderToCloud(order: CourtOrder): Promise<void> {
  await setDoc(getUserDoc('court_orders', order.id), {
    title: order.title,
    sha256Hash: order.sha256Hash,
    uploadedAt: order.uploadedAt,
    localCreatedAt: order.createdAt,
    syncedAt: serverTimestamp(),
  }, { merge: true });

  // Push clauses
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  for (const clause of order.clauses) {
    const clauseRef = doc(db, 'users', getCurrentUser()!.uid, 'court_order_clauses', clause.id);
    batch.set(clauseRef, {
      courtOrderId: clause.courtOrderId,
      clauseNumber: clause.clauseNumber,
      description: clause.description,
      localCreatedAt: clause.createdAt,
      syncedAt: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

async function pushAuditLogToCloud(entries: AuditLogEntry[]): Promise<void> {
  const db = getFirestoreDb();
  const user = getCurrentUser();
  if (!user) return;

  // Batch write audit entries (max 500 per batch)
  const batchSize = 500;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = entries.slice(i, i + batchSize);

    for (const entry of chunk) {
      const entryRef = doc(db, 'users', user.uid, 'audit_log', entry.id);
      batch.set(entryRef, {
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata ?? null,
        timestamp: entry.timestamp,
        syncedAt: serverTimestamp(),
      }, { merge: true });
    }

    await batch.commit();
  }
}

export async function syncToCloud(
  onUploadProgress?: (evidenceId: string, progress: UploadProgress) => void
): Promise<SyncResult> {
  if (!isFirebaseConfigured()) {
    return { evidencePushed: 0, courtOrdersPushed: 0, auditEntriesPushed: 0, errors: ['Firebase not configured'] };
  }

  const user = getCurrentUser();
  if (!user) {
    return { evidencePushed: 0, courtOrdersPushed: 0, auditEntriesPushed: 0, errors: ['Not authenticated'] };
  }

  const result: SyncResult = {
    evidencePushed: 0,
    courtOrdersPushed: 0,
    auditEntriesPushed: 0,
    errors: [],
  };

  // Push evidence
  try {
    const evidence = await getAllEvidence();
    for (const item of evidence) {
      try {
        await pushEvidenceToCloud(item, onUploadProgress);
        result.evidencePushed++;
      } catch (error) {
        result.errors.push(`Evidence ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    result.errors.push(`Evidence fetch: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Push court orders
  try {
    const orders = await getAllCourtOrders();
    for (const order of orders) {
      try {
        await pushCourtOrderToCloud(order);
        result.courtOrdersPushed++;
      } catch (error) {
        result.errors.push(`Court order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    result.errors.push(`Court orders fetch: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Push audit log
  try {
    const auditEntries = await getAuditLog(undefined, undefined, 1000);
    await pushAuditLogToCloud(auditEntries);
    result.auditEntriesPushed = auditEntries.length;
  } catch (error) {
    result.errors.push(`Audit log: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

export async function getCloudEvidenceCount(): Promise<number> {
  if (!isFirebaseConfigured() || !getCurrentUser()) return 0;

  try {
    const evidenceCol = getUserCollection('evidence');
    const snapshot = await getDocs(evidenceCol);
    return snapshot.size;
  } catch {
    return 0;
  }
}

export async function getLastSyncTime(): Promise<Date | null> {
  if (!isFirebaseConfigured() || !getCurrentUser()) return null;

  try {
    const evidenceCol = getUserCollection('evidence');
    const q = query(evidenceCol, orderBy('syncedAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const firstDoc = snapshot.docs[0];
    const syncedAt = firstDoc.data().syncedAt;
    if (syncedAt instanceof Timestamp) {
      return syncedAt.toDate();
    }
    return null;
  } catch {
    return null;
  }
}
