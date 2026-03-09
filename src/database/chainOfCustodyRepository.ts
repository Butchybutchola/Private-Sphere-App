/**
 * Chain of Custody Repository
 *
 * Records every interaction with a piece of evidence from the moment of capture
 * through every view, export, backup, and inclusion in a report. Each event
 * stores the SHA-256 hash of the evidence file at that instant, allowing
 * tampering between events to be detected forensically.
 *
 * Per Evidence Guardian spec v2.0:
 *   event_type: CAPTURE | VIEW | EXPORT | VERIFY | BACKUP | REPORT_INCLUDE | SHARE
 *   actor_type: USER | SYSTEM | LAWYER | WITNESS
 */

import { getDatabase } from './db';
import { generateUUID } from '../utils/uuid';
import { CoCEventType, CoCActorType, ChainOfCustodyEvent } from '../types';

export async function logCoCEvent(
  evidenceId: string,
  eventType: CoCEventType,
  hashAtEvent: string,
  details?: Record<string, unknown>,
  actorType: CoCActorType = 'USER',
  actorId: string = 'local_user'
): Promise<void> {
  const db = await getDatabase();
  const id = generateUUID();
  const timestamp = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO chain_of_custody_events
       (id, evidence_id, event_type, timestamp, actor_type, actor_id, hash_at_event, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, evidenceId, eventType, timestamp, actorType, actorId, hashAtEvent,
    details ? JSON.stringify(details) : null
  );
}

export async function getChainOfCustody(evidenceId: string): Promise<ChainOfCustodyEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM chain_of_custody_events
     WHERE evidence_id = ?
     ORDER BY timestamp ASC`,
    evidenceId
  );
  return rows.map(mapRow);
}

/**
 * Returns chain-of-custody events for multiple evidence items, ordered by
 * timestamp. Used when generating a multi-item chain-of-custody PDF report.
 */
export async function getChainOfCustodyForEvidenceList(
  evidenceIds: string[]
): Promise<ChainOfCustodyEvent[]> {
  if (evidenceIds.length === 0) return [];
  const db = await getDatabase();
  const placeholders = evidenceIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM chain_of_custody_events
     WHERE evidence_id IN (${placeholders})
     ORDER BY timestamp ASC`,
    ...evidenceIds
  );
  return rows.map(mapRow);
}

function mapRow(r: Record<string, unknown>): ChainOfCustodyEvent {
  return {
    id: r.id as string,
    evidenceId: r.evidence_id as string,
    eventType: r.event_type as CoCEventType,
    timestamp: r.timestamp as string,
    actorType: r.actor_type as CoCActorType,
    actorId: r.actor_id as string,
    hashAtEvent: r.hash_at_event as string,
    details: r.details ? JSON.parse(r.details as string) : null,
    createdAt: r.created_at as string,
  };
}
