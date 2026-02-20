import { getDatabase } from './db';
import { type SQLiteBindValue } from 'expo-sqlite';
import { EvidenceItem, EvidenceType, EvidenceStatus } from '../types';
import { generateUUID } from '../utils/uuid';

type Row = Record<string, unknown>;

function rowToEvidence(row: Record<string, unknown>): EvidenceItem {
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
    title: row.title as string | undefined,
    description: row.description as string | undefined,
    tags: JSON.parse((row.tags as string) || '[]'),
    courtOrderId: row.court_order_id as string | undefined,
    breachClause: row.breach_clause as string | undefined,
    transcription: row.transcription as string | undefined,
    transcriptionStatus: row.transcription_status as EvidenceItem['transcriptionStatus'],
    parentId: row.parent_id as string | undefined,
    isOriginal: Boolean(row.is_original),
    versionNumber: row.version_number as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function insertEvidence(
  evidence: Omit<EvidenceItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = new Date().toISOString();

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
      evidence.title ?? null,
      evidence.description ?? null,
      JSON.stringify(evidence.tags),
      evidence.courtOrderId ?? null,
      evidence.breachClause ?? null,
      evidence.transcription ?? null,
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
  return (rows as Row[]).map(rowToEvidence);
}

export async function getEvidenceById(id: string): Promise<EvidenceItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM evidence WHERE id = ?', [id]);
  return row ? rowToEvidence(row as Record<string, unknown>) : null;
}

export async function getEvidenceByType(type: EvidenceType): Promise<EvidenceItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM evidence WHERE type = ? ORDER BY captured_at DESC',
    [type]
  );
  return (rows as Row[]).map(rowToEvidence);
}

export async function getEvidenceByCourtOrder(courtOrderId: string): Promise<EvidenceItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM evidence WHERE court_order_id = ? ORDER BY captured_at DESC',
    [courtOrderId]
  );
  return (rows as Row[]).map(rowToEvidence);
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
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description);
  }
  if (updates.tags !== undefined) {
    setClauses.push('tags = ?');
    values.push(JSON.stringify(updates.tags));
  }
  if (updates.courtOrderId !== undefined) {
    setClauses.push('court_order_id = ?');
    values.push(updates.courtOrderId);
  }
  if (updates.breachClause !== undefined) {
    setClauses.push('breach_clause = ?');
    values.push(updates.breachClause);
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
  await db.runAsync(
    `UPDATE evidence SET transcription = ?, transcription_status = ?, updated_at = datetime('now') WHERE id = ?`,
    [transcription, status ?? null, id]
  );
}

export async function getEvidenceVersions(originalId: string): Promise<EvidenceItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM evidence WHERE id = ? OR parent_id = ? ORDER BY version_number ASC',
    [originalId, originalId]
  );
  return (rows as Row[]).map(rowToEvidence);
}

export async function searchEvidence(query: string): Promise<EvidenceItem[]> {
  const db = await getDatabase();
  const pattern = `%${query}%`;
  const rows = await db.getAllAsync(
    `SELECT * FROM evidence
     WHERE title LIKE ? OR description LIKE ? OR tags LIKE ? OR transcription LIKE ?
     ORDER BY captured_at DESC`,
    [pattern, pattern, pattern, pattern]
  );
  return (rows as Row[]).map(rowToEvidence);
}
