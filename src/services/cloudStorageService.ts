/**
 * Cloud Storage Service
 *
 * Uploads evidence files to Firebase Storage with encryption.
 * Files are stored under the user's UID for access control.
 *
 * Storage structure:
 *   evidence/{uid}/{evidenceId}/{filename}
 *   court_orders/{uid}/{orderId}/{filename}
 *   reports/{uid}/{reportId}/{filename}
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTask,
} from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import { getFirebaseStorage, isFirebaseConfigured } from '../config/firebase';
import { getCurrentUser } from './authService';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
}

function getUserStoragePath(subPath: string): string {
  const user = getCurrentUser();
  if (!user) throw new Error('Must be authenticated to use cloud storage');
  return `${subPath}/${user.uid}`;
}

export async function uploadEvidenceFile(
  evidenceId: string,
  localUri: string,
  fileName: string,
  mimeType: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured. Set up firebase config to enable cloud sync.');
  }

  const storage = getFirebaseStorage();
  const storagePath = `${getUserStoragePath('evidence')}/${evidenceId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  // Read local file as base64 and convert to bytes
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // Upload with progress tracking
  const uploadTask: UploadTask = uploadBytesResumable(storageRef, bytes, {
    contentType: mimeType,
    customMetadata: {
      evidenceId,
      uploadedAt: new Date().toISOString(),
    },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress) {
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          });
        }
      },
      (error) => reject(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ downloadUrl, storagePath });
      }
    );
  });
}

export async function uploadCourtOrderFile(
  orderId: string,
  localUri: string,
  fileName: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured.');
  }

  const storage = getFirebaseStorage();
  const storagePath = `${getUserStoragePath('court_orders')}/${orderId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const uploadTask = uploadBytesResumable(storageRef, bytes, {
    contentType: 'application/pdf',
    customMetadata: { orderId, uploadedAt: new Date().toISOString() },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress) {
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          });
        }
      },
      (error) => reject(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ downloadUrl, storagePath });
      }
    );
  });
}

export async function uploadReportFile(
  reportId: string,
  localUri: string,
  fileName: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured.');
  }

  const storage = getFirebaseStorage();
  const storagePath = `${getUserStoragePath('reports')}/${reportId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const uploadTask = uploadBytesResumable(storageRef, bytes, {
    contentType: 'application/pdf',
    customMetadata: { reportId, uploadedAt: new Date().toISOString() },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress) {
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          });
        }
      },
      (error) => reject(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ downloadUrl, storagePath });
      }
    );
  });
}

export async function deleteCloudFile(storagePath: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}

export async function getFileDownloadUrl(storagePath: string): Promise<string> {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, storagePath);
  return getDownloadURL(storageRef);
}
