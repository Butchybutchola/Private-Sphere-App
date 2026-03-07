/**
 * Tests for courtOrderRepository.ts
 *
 * Covers: insertCourtOrder, getAllCourtOrders, getCourtOrderById,
 *         addClause, getClausesForOrder, insertBreachLog,
 *         getBreachLogsForOrder, getBreachLogsForEvidence
 */

// ─── Mock registrations ───────────────────────────────────────────────────────

jest.mock('../../database/db', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../utils/uuid', () => ({
  generateUUID: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { getDatabase } from '../../database/db';
import { generateUUID } from '../../utils/uuid';
import {
  insertCourtOrder,
  getAllCourtOrders,
  getCourtOrderById,
  addClause,
  getClausesForOrder,
  insertBreachLog,
  getBreachLogsForOrder,
  getBreachLogsForEvidence,
} from '../../database/courtOrderRepository';

// ─── Shared state ─────────────────────────────────────────────────────────────

let orderRows: Record<string, unknown>[] = [];
let clauseRows: Record<string, unknown>[] = [];
let breachRows: Record<string, unknown>[] = [];

let uuidCounter = 0;
const mockRunAsync    = jest.fn();
const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

function setupDbMocks(): void {
  mockRunAsync.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const upper = sql.trim().toUpperCase();

    if (upper.includes('INSERT INTO COURT_ORDERS')) {
      const [id, title, file_path, sha256_hash, uploaded_at] = params;
      orderRows.push({ id, title, file_path, sha256_hash, uploaded_at, created_at: new Date().toISOString() });
      return;
    }
    if (upper.includes('INSERT INTO COURT_ORDER_CLAUSES')) {
      const [id, court_order_id, clause_number, description] = params;
      clauseRows.push({ id, court_order_id, clause_number, description, created_at: new Date().toISOString() });
      return;
    }
    if (upper.includes('INSERT INTO BREACH_LOGS')) {
      const [id, evidence_id, court_order_id, clause_id, description, occurred_at] = params;
      breachRows.push({ id, evidence_id, court_order_id, clause_id, description, occurred_at, created_at: new Date().toISOString() });
      return;
    }
  });

  mockGetAllAsync.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const upper = sql.trim().toUpperCase();
    if (upper.includes('FROM COURT_ORDERS')) return [...orderRows];
    if (upper.includes('FROM COURT_ORDER_CLAUSES')) {
      const orderId = params[0] as string;
      return clauseRows.filter(r => r.court_order_id === orderId);
    }
    if (upper.includes('FROM BREACH_LOGS') && upper.includes('COURT_ORDER_ID')) {
      const orderId = params[0] as string;
      return breachRows.filter(r => r.court_order_id === orderId);
    }
    if (upper.includes('FROM BREACH_LOGS') && upper.includes('EVIDENCE_ID')) {
      const evidenceId = params[0] as string;
      return breachRows.filter(r => r.evidence_id === evidenceId);
    }
    return [];
  });

  mockGetFirstAsync.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const upper = sql.trim().toUpperCase();
    if (upper.includes('FROM COURT_ORDERS')) {
      return orderRows.find(r => r.id === params[0]) ?? null;
    }
    return null;
  });

  (getDatabase as jest.Mock).mockResolvedValue({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  orderRows = [];
  clauseRows = [];
  breachRows = [];
  uuidCounter = 0;
  jest.clearAllMocks();
  (generateUUID as jest.Mock).mockImplementation(() => `uuid-${++uuidCounter}`);
  setupDbMocks();
});

// ─── insertCourtOrder ─────────────────────────────────────────────────────────

describe('insertCourtOrder', () => {
  const orderInput = {
    title: 'Interim Parenting Order 2024',
    filePath: '/storage/orders/order1.pdf',
    sha256Hash: 'deadbeef123',
    uploadedAt: '2024-01-10T09:00:00.000Z',
  };

  it('returns the generated UUID', async () => {
    const id = await insertCourtOrder(orderInput);
    expect(id).toBe('uuid-1');
  });

  it('stores the order fields in the database', async () => {
    await insertCourtOrder(orderInput);
    expect(orderRows).toHaveLength(1);
    expect(orderRows[0].title).toBe('Interim Parenting Order 2024');
    expect(orderRows[0].file_path).toBe('/storage/orders/order1.pdf');
    expect(orderRows[0].sha256_hash).toBe('deadbeef123');
    expect(orderRows[0].uploaded_at).toBe('2024-01-10T09:00:00.000Z');
  });

  it('inserts multiple orders with unique IDs', async () => {
    await insertCourtOrder(orderInput);
    await insertCourtOrder({ ...orderInput, title: 'Second Order' });
    expect(orderRows).toHaveLength(2);
    expect(orderRows[0].id).toBe('uuid-1');
    expect(orderRows[1].id).toBe('uuid-2');
  });
});

// ─── getAllCourtOrders ────────────────────────────────────────────────────────

describe('getAllCourtOrders', () => {
  it('returns empty array when no orders exist', async () => {
    const orders = await getAllCourtOrders();
    expect(orders).toEqual([]);
  });

  it('returns all orders with their clauses', async () => {
    // Seed an order and two clauses
    orderRows.push({
      id: 'order-1', title: 'Order One', file_path: '/o1.pdf',
      sha256_hash: 'hash1', uploaded_at: '2024-01-01T00:00:00.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
    });
    clauseRows.push(
      { id: 'clause-1', court_order_id: 'order-1', clause_number: '4.1', description: 'No contact', created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'clause-2', court_order_id: 'order-1', clause_number: '4.2', description: 'Handover at school', created_at: '2024-01-01T00:00:00.000Z' },
    );

    const orders = await getAllCourtOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe('order-1');
    expect(orders[0].title).toBe('Order One');
    expect(orders[0].clauses).toHaveLength(2);
    expect(orders[0].clauses[0].clauseNumber).toBe('4.1');
    expect(orders[0].clauses[1].clauseNumber).toBe('4.2');
  });

  it('returns orders with empty clauses array when no clauses exist', async () => {
    orderRows.push({
      id: 'order-2', title: 'Order Two', file_path: '/o2.pdf',
      sha256_hash: 'hash2', uploaded_at: '2024-02-01T00:00:00.000Z',
      created_at: '2024-02-01T00:00:00.000Z',
    });

    const orders = await getAllCourtOrders();
    expect(orders[0].clauses).toEqual([]);
  });
});

// ─── getCourtOrderById ────────────────────────────────────────────────────────

describe('getCourtOrderById', () => {
  it('returns null when order does not exist', async () => {
    const order = await getCourtOrderById('nonexistent');
    expect(order).toBeNull();
  });

  it('returns the order with its clauses when found', async () => {
    orderRows.push({
      id: 'order-3', title: 'Order Three', file_path: '/o3.pdf',
      sha256_hash: 'hash3', uploaded_at: '2024-03-01T00:00:00.000Z',
      created_at: '2024-03-01T00:00:00.000Z',
    });
    clauseRows.push({
      id: 'clause-3', court_order_id: 'order-3', clause_number: '1.1',
      description: 'Must not approach', created_at: '2024-03-01T00:00:00.000Z',
    });

    const order = await getCourtOrderById('order-3');
    expect(order).not.toBeNull();
    expect(order!.id).toBe('order-3');
    expect(order!.title).toBe('Order Three');
    expect(order!.sha256Hash).toBe('hash3');
    expect(order!.clauses).toHaveLength(1);
    expect(order!.clauses[0].description).toBe('Must not approach');
  });
});

// ─── addClause / getClausesForOrder ──────────────────────────────────────────

describe('addClause', () => {
  it('returns the generated UUID', async () => {
    const id = await addClause('order-x', '3.1', 'No unsupervised contact');
    expect(id).toBe('uuid-1');
  });

  it('stores clause fields correctly', async () => {
    await addClause('order-x', '3.1', 'No unsupervised contact');
    expect(clauseRows[0].court_order_id).toBe('order-x');
    expect(clauseRows[0].clause_number).toBe('3.1');
    expect(clauseRows[0].description).toBe('No unsupervised contact');
  });

  it('stores multiple clauses for the same order', async () => {
    await addClause('order-x', '3.1', 'No contact');
    await addClause('order-x', '3.2', 'Supervised visits only');
    expect(clauseRows).toHaveLength(2);
  });
});

describe('getClausesForOrder', () => {
  it('returns only clauses belonging to the requested order', async () => {
    clauseRows.push(
      { id: 'c1', court_order_id: 'order-A', clause_number: '1', description: 'Clause A1', created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'c2', court_order_id: 'order-B', clause_number: '1', description: 'Clause B1', created_at: '2024-01-01T00:00:00.000Z' },
    );

    const clauses = await getClausesForOrder('order-A');
    expect(clauses).toHaveLength(1);
    expect(clauses[0].description).toBe('Clause A1');
  });

  it('returns empty array when order has no clauses', async () => {
    const clauses = await getClausesForOrder('no-clauses-order');
    expect(clauses).toEqual([]);
  });

  it('maps snake_case columns to camelCase properties', async () => {
    clauseRows.push({
      id: 'c3', court_order_id: 'order-C', clause_number: '2.1',
      description: 'Handover location', created_at: '2024-01-01T00:00:00.000Z',
    });

    const [clause] = await getClausesForOrder('order-C');
    expect(clause.id).toBe('c3');
    expect(clause.courtOrderId).toBe('order-C');
    expect(clause.clauseNumber).toBe('2.1');
    expect(clause.description).toBe('Handover location');
    expect(clause.createdAt).toBeDefined();
  });
});

// ─── insertBreachLog ──────────────────────────────────────────────────────────

describe('insertBreachLog', () => {
  const breachInput = {
    evidenceId:   'ev-001',
    courtOrderId: 'order-001',
    clauseId:     'clause-001',
    description:  'Respondent appeared at school contrary to clause 4.1',
    occurredAt:   '2024-02-14T08:30:00.000Z',
  };

  it('returns the generated UUID', async () => {
    const id = await insertBreachLog(breachInput);
    expect(id).toBe('uuid-1');
  });

  it('stores breach fields in the database', async () => {
    await insertBreachLog(breachInput);
    expect(breachRows).toHaveLength(1);
    expect(breachRows[0].evidence_id).toBe('ev-001');
    expect(breachRows[0].court_order_id).toBe('order-001');
    expect(breachRows[0].clause_id).toBe('clause-001');
    expect(breachRows[0].description).toBe('Respondent appeared at school contrary to clause 4.1');
    expect(breachRows[0].occurred_at).toBe('2024-02-14T08:30:00.000Z');
  });
});

// ─── getBreachLogsForOrder ────────────────────────────────────────────────────

describe('getBreachLogsForOrder', () => {
  it('returns only breaches for the requested order', async () => {
    breachRows.push(
      { id: 'b1', evidence_id: 'ev-1', court_order_id: 'order-A', clause_id: 'cl-1', description: 'Breach 1', occurred_at: '2024-01-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'b2', evidence_id: 'ev-2', court_order_id: 'order-B', clause_id: 'cl-2', description: 'Breach 2', occurred_at: '2024-01-02T00:00:00.000Z', created_at: '2024-01-02T00:00:00.000Z' },
    );

    const breaches = await getBreachLogsForOrder('order-A');
    expect(breaches).toHaveLength(1);
    expect(breaches[0].description).toBe('Breach 1');
  });

  it('returns empty array when order has no breaches', async () => {
    const breaches = await getBreachLogsForOrder('order-no-breaches');
    expect(breaches).toEqual([]);
  });

  it('maps snake_case columns to camelCase properties', async () => {
    breachRows.push({
      id: 'b3', evidence_id: 'ev-3', court_order_id: 'order-C', clause_id: 'cl-3',
      description: 'Test breach', occurred_at: '2024-03-01T10:00:00.000Z',
      created_at: '2024-03-01T10:00:00.000Z',
    });

    const [breach] = await getBreachLogsForOrder('order-C');
    expect(breach.id).toBe('b3');
    expect(breach.evidenceId).toBe('ev-3');
    expect(breach.courtOrderId).toBe('order-C');
    expect(breach.clauseId).toBe('cl-3');
    expect(breach.occurredAt).toBe('2024-03-01T10:00:00.000Z');
  });
});

// ─── getBreachLogsForEvidence ─────────────────────────────────────────────────

describe('getBreachLogsForEvidence', () => {
  it('returns only breaches linked to the requested evidence item', async () => {
    breachRows.push(
      { id: 'b4', evidence_id: 'ev-X', court_order_id: 'order-1', clause_id: 'cl-1', description: 'Breach X1', occurred_at: '2024-01-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'b5', evidence_id: 'ev-Y', court_order_id: 'order-1', clause_id: 'cl-1', description: 'Breach Y1', occurred_at: '2024-01-02T00:00:00.000Z', created_at: '2024-01-02T00:00:00.000Z' },
      { id: 'b6', evidence_id: 'ev-X', court_order_id: 'order-2', clause_id: 'cl-2', description: 'Breach X2', occurred_at: '2024-01-03T00:00:00.000Z', created_at: '2024-01-03T00:00:00.000Z' },
    );

    const breaches = await getBreachLogsForEvidence('ev-X');
    expect(breaches).toHaveLength(2);
    expect(breaches.every(b => b.evidenceId === 'ev-X')).toBe(true);
  });

  it('returns empty array when evidence has no breaches', async () => {
    const breaches = await getBreachLogsForEvidence('ev-no-breaches');
    expect(breaches).toEqual([]);
  });
});
