import { getDatabase } from './db';
import { AuditLogEntry, AuditAction } from '../types';
import { generateUUID } from '../utils/uuid';

export async function logAuditEvent(
  action: AuditAction,
  resourceType: AuditLogEntry['resourceType'],
  resourceId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDatabase();
  const id = generateUUID();

  await db.runAsync(
    `INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, metadata, timestamp)
     VALUES (?, 'local_user', ?, ?, ?, ?, datetime('now'))`,
    [id, action, resourceType, resourceId, metadata ? JSON.stringify(metadata) : null]
  );
}

export async function getAuditLog(
  resourceType?: AuditLogEntry['resourceType'],
  resourceId?: string,
  limit: number = 100
): Promise<AuditLogEntry[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM audit_log';
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (resourceType) {
    conditions.push('resource_type = ?');
    params.push(resourceType);
  }
  if (resourceId) {
    conditions.push('resource_id = ?');
    params.push(resourceId);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  const rows = await db.getAllAsync(query, params);
  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    userId: row.user_id as string,
    action: row.action as AuditAction,
    resourceType: row.resource_type as AuditLogEntry['resourceType'],
    resourceId: row.resource_id as string,
    metadata: row.metadata as string | undefined,
    ipAddress: row.ip_address as string | undefined,
    timestamp: row.timestamp as string,
  }));
}

export async function getAuditLogForEvidence(evidenceId: string): Promise<AuditLogEntry[]> {
  return getAuditLog('evidence', evidenceId);
}
