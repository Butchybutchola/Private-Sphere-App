import { getDatabase } from './db';
import { type SQLiteBindValue } from 'expo-sqlite';
import { EvidenceItem, EvidenceType, EvidenceStatus } from '../types';
import { generateUUID } from '../utils/uuid';
import { encryptString, decryptString, rotateEncryptionKey } from '../services/encryptionService';

type Row = Record<string, unknown>;

// ---- Encryption helpers ----

async function encryptField(value: string | null | undefined): Promise<string | null> {
  if (value == null) return null;
  return encryptString(value);
}

/**
 * Decrypt a field value that may be:
 *  - null / undefined  → return null
 *  - EG2: ciphertext   → decrypt with current key
 *  - EG1: ciphertext   → decrypt legacy format
 *  - plaintext         → return as-is (graceful fallback for pre-encryption records)
 */
async function tryDecrypt(value: string | null | undefined): Promise<string | null> {
  if (value == null) return null;
  try {
    return await decryptString(value);
  } catch {
    // Not encrypted (legacy plaintext record) — return as-is
    return value;
  }
}

// ---- Row mapping ----

async function rowToEvidence(row: Row): Promise<EvidenceItem> {
  const title       = await tryDecrypt(row.title as string | null);
  const description = await tryDecrypt(row.description as string | null);
  const tagsRaw     = await tryDecrypt(row.tags as string | null);
  const transcription  = await tryDecrypt(row.transcription as string | null);
  const breachClause   = await tryDecrypt(row.breach_clause as string | null);

  const tags: string[] = (() => {
    try { return JSON.parse(tagsRaw || '[]'); } catch { return []; }
  })();

  return {
    id: row.id as string,
    type: row.type as EvidenceType,
    status: row.status as EvidenceStatus,
    filePath: row.file_path as string,
    thumbnailPath: row.thumbnail_path as string | undefined,
    sha256Hash: row.sha256_hash as string,
    fileSize: row.file_size as number,
    mimeType: row.mime_type as string,
    capturedAt: row.captured_at as string,
    deviceId: row.device_id as string,
    latitude: row.latitude as number | undefined,
    longitude: row.longitude as number | undefined,
    altitude: row.altitude as number | undefined,
    locationAccuracy: row.location_accuracy as number | undefined,
    title: title ?? undefined,
    description: description ?? undefined,
    tags,
    courtOrderId: row.court_order_id as string | undefined,
    breachClause: breachClause ?? undefined,
    transcription: transcription ?? undefined,
    transcriptionStatus: row.transcription_status as EvidenceItem['transcriptionStatus'],
    parentId: row.parent_id as string | undefined,
    isOriginal: Boolean(row.is_original),
    versionNumber: row.version_number as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---- CRUD ----

export async function insertEvidence(
  evidence: Omit<EvidenceItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = new Date().toISOString();

  const encTitle       = await encryptField(evidence.title);
  const encDescription = await encryptField(evidence.description);
  const encTags        = await encryptField(JSON.stringify(evidence.tags));
  const encBreachClause = await encryptField(evidence.breachClause);
  const encTranscription = await encryptField(evidence.transcription);

  await db.runAsync(
    `INSERT INTO evidence (
      id, type, status, file_path, thumbnail_path, sha256_hash, file_size, mime_type,
      captured_at, device_id, latitude, longitude, altitude, location_accuracy,
      title, description, tags, court_order_id, breach_clause,
      transcription, transcription_status,
      parent_id, is_original, version_number,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      evidence.type,
      evidence.status,
      evidence.filePath,
      evidence.thumbnailPath ?? null,
      evidence.sha256Hash,
      evidence.fileSize,
      evidence.mimeType,
      evidence.capturedAt,
      evidence.deviceId,
      evidence.latitude ?? null,
      evidence.longitude ?? null,
      evidence.altitude ?? null,
      evidence.locationAccuracy ?? null,
      encTitle,
      encDescription,
      encTags,
      evidence.courtOrderId ?? null,
      encBreachClause,
      encTranscription,
      evidence.transcriptionStatus ?? null,
      evidence.parentId ?? null,
      evidence.isOriginal ? 1 : 0,
      evidence.versionNumber,
      now,
      now,
    ]
  );

  return id;
}

export async function getAllEvidence(): Promise<EvidenceItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM evidence ORDER BY captured_at DESC');
  return Promise.all((rows as Row[]).map(rowToEvidence));
}

export async function getEvidenceById(id: string): Promise<EvidenceItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM evidence WHERE id = ?', [id]);
  return row ? rowToEvidence(row as Row) : null;
}

export async function getEvidenceByType(type: EvidenceType): Promise<EvidenceItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM evidence WHERE type = ? ORDER BY captured_at DESC',
    [type]
  );
  return Promise.all((rows as Row[]).map(rowToEvidence));
}

export async function getEvidenceByCourtOrder(courtOrderId: string): Promise<EvidenceItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM evidence WHERE court_order_id = ? ORDER BY captured_at DESC',
    [courtOrderId]
  );
  return Promise.all((rows as Row[]).map(rowToEvidence));
}

export async function updateEvidenceMetadata(
  id: string,
  updates: Partial<Pick<EvidenceItem, 'title' | 'description' | 'tags' | 'courtOrderId' | 'breachClause'>>
): Promise<void> {
  const db = await getDatabase();
  const setClauses: string[] = [];
  const values: SQLiteBindValue[] = [];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    values.push(updates.title ? await encryptString(updates.title) : null);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description ? await encryptString(updates.description) : null);
  }
  if (updates.tags !== undefined) {
    setClauses.push('tags = ?');
    values.push(await encryptString(JSON.stringify(updates.tags)));
  }
  if (updates.courtOrderId !== undefined) {
    setClauses.push('court_order_id = ?');
    values.push(updates.courtOrderId ?? null);
  }
  if (updates.breachClause !== undefined) {
    setClauses.push('breach_clause = ?');
    values.push(updates.breachClause ? await encryptString(updates.breachClause) : null);
  }

  if (setClauses.length === 0) return;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  await db.runAsync(
    `UPDATE evidence SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function updateTranscription(
  id: string,
  transcription: string,
  status: EvidenceItem['transcriptionStatus']
): Promise<void> {
  const db = await getDatabase();
  const encTranscription = await encryptString(transcription);
  await db.runAsync(
    `UPDATE evidence SET transcription = ?, transcription_status = ?, updated_at = datetime('now') WHERE id = ?`,
    [encTranscription, status ?? null, id]
  );
}

export async function getEvidenceVersions(originalId: string): Promise<EvidenceItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM evidence WHERE id = ? OR parent_id = ? ORDER BY version_number ASC',
    [originalId, originalId]
  );
  return Promise.all((rows as Row[]).map(rowToEvidence));
}

/**
 * Search evidence by decrypting all records in memory and filtering.
 * SQL LIKE cannot be used against encrypted fields.
 */
export async function searchEvidence(query: string): Promise<EvidenceItem[]> {
  const all = await getAllEvidence();
  const q = query.toLowerCase();
  return all.filter(item =>
    item.title?.toLowerCase().includes(q) ||
    item.description?.toLowerCase().includes(q) ||
    item.tags.some(t => t.toLowerCase().includes(q)) ||
    item.transcription?.toLowerCase().includes(q)
  );
}

// ---- Key rotation ----

/**
 * Re-encrypts all sensitive evidence fields with a freshly generated key.
 * Safe to call at any time — a crash mid-rotation leaves the old key in
 * the backup slot so nothing is permanently lost.
 *
 * @returns The number of rows updated and the hex ID of the new key.
 */
export async function rotateEvidenceEncryption(): Promise<{ rotatedCount: number; newKeyId: string }> {
  const db = await getDatabase();

  type RawRow = {
    id: string;
    title: string | null;
    description: string | null;
    tags: string | null;
    transcription: string | null;
    breach_clause: string | null;
  };

  const rows = await db.getAllAsync(
    'SELECT id, title, description, tags, transcription, breach_clause FROM evidence'
  ) as RawRow[];

  // Build a flat ciphertext map keyed by "id:field"
  const ciphertexts: Record<string, string> = {};
  for (const row of rows) {
    if (row.title)        ciphertexts[`${row.id}:title`]       = row.title;
    if (row.description)  ciphertexts[`${row.id}:description`]  = row.description;
    if (row.tags)         ciphertexts[`${row.id}:tags`]         = row.tags;
    if (row.transcription) ciphertexts[`${row.id}:transcription`] = row.transcription;
    if (row.breach_clause) ciphertexts[`${row.id}:breachClause`]  = row.breach_clause;
  }

  const { reEncrypted, newKeyId } = await rotateEncryptionKey(ciphertexts);

  // Write re-encrypted values back to the DB
  let rotatedCount = 0;
  for (const row of rows) {
    const title       = reEncrypted[`${row.id}:title`]        ?? row.title;
    const description = reEncrypted[`${row.id}:description`]  ?? row.description;
    const tags        = reEncrypted[`${row.id}:tags`]         ?? row.tags;
    const transcription = reEncrypted[`${row.id}:transcription`] ?? row.transcription;
    const breachClause  = reEncrypted[`${row.id}:breachClause`]  ?? row.breach_clause;

    const changed =
      title !== row.title ||
      description !== row.description ||
      tags !== row.tags ||
      transcription !== row.transcription ||
      breachClause !== row.breach_clause;

    if (changed) {
      await db.runAsync(
        `UPDATE evidence SET title = ?, description = ?, tags = ?, transcription = ?, breach_clause = ?, updated_at = datetime('now') WHERE id = ?`,
        [title, description, tags, transcription, breachClause, row.id]
      );
      rotatedCount++;
    }
  }

  return { rotatedCount, newKeyId };
}
