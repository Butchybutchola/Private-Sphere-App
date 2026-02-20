import { getDatabase } from './db';
import { CourtOrder, CourtOrderClause, BreachLog } from '../types';
import { generateUUID } from '../utils/uuid';

export async function insertCourtOrder(
  order: Omit<CourtOrder, 'id' | 'createdAt' | 'clauses'>
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();

  await db.runAsync(
    `INSERT INTO court_orders (id, title, file_path, sha256_hash, uploaded_at, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [id, order.title, order.filePath, order.sha256Hash, order.uploadedAt]
  );

  return id;
}

export async function getAllCourtOrders(): Promise<CourtOrder[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM court_orders ORDER BY created_at DESC');
  const orders: CourtOrder[] = [];

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const clauses = await getClausesForOrder(r.id as string);
    orders.push({
      id: r.id as string,
      title: r.title as string,
      filePath: r.file_path as string,
      sha256Hash: r.sha256_hash as string,
      uploadedAt: r.uploaded_at as string,
      createdAt: r.created_at as string,
      clauses,
    });
  }

  return orders;
}

export async function getCourtOrderById(id: string): Promise<CourtOrder | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT * FROM court_orders WHERE id = ?', [id]);
  if (!row) return null;

  const r = row as Record<string, unknown>;
  const clauses = await getClausesForOrder(id);
  return {
    id: r.id as string,
    title: r.title as string,
    filePath: r.file_path as string,
    sha256Hash: r.sha256_hash as string,
    uploadedAt: r.uploaded_at as string,
    createdAt: r.created_at as string,
    clauses,
  };
}

export async function addClause(
  courtOrderId: string,
  clauseNumber: string,
  description: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();

  await db.runAsync(
    `INSERT INTO court_order_clauses (id, court_order_id, clause_number, description, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [id, courtOrderId, clauseNumber, description]
  );

  return id;
}

export async function getClausesForOrder(courtOrderId: string): Promise<CourtOrderClause[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM court_order_clauses WHERE court_order_id = ? ORDER BY clause_number',
    [courtOrderId]
  );

  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    courtOrderId: r.court_order_id as string,
    clauseNumber: r.clause_number as string,
    description: r.description as string,
    createdAt: r.created_at as string,
  }));
}

export async function insertBreachLog(
  breach: Omit<BreachLog, 'id' | 'createdAt'>
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();

  await db.runAsync(
    `INSERT INTO breach_logs (id, evidence_id, court_order_id, clause_id, description, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, breach.evidenceId, breach.courtOrderId, breach.clauseId, breach.description, breach.occurredAt]
  );

  return id;
}

export async function getBreachLogsForOrder(courtOrderId: string): Promise<BreachLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM breach_logs WHERE court_order_id = ? ORDER BY occurred_at DESC',
    [courtOrderId]
  );

  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    evidenceId: r.evidence_id as string,
    courtOrderId: r.court_order_id as string,
    clauseId: r.clause_id as string,
    description: r.description as string,
    occurredAt: r.occurred_at as string,
    createdAt: r.created_at as string,
  }));
}

export async function getBreachLogsForEvidence(evidenceId: string): Promise<BreachLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM breach_logs WHERE evidence_id = ? ORDER BY occurred_at DESC',
    [evidenceId]
  );

  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    evidenceId: r.evidence_id as string,
    courtOrderId: r.court_order_id as string,
    clauseId: r.clause_id as string,
    description: r.description as string,
    occurredAt: r.occurred_at as string,
    createdAt: r.created_at as string,
  }));
}
