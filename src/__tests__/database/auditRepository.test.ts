/**
 * Tests for auditRepository.ts
 *
 * Covers: logAuditEvent, getAuditLog (no filter, resourceType filter,
 *         resourceId filter, combined filter, limit), getAuditLogForEvidence
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
import { logAuditEvent, getAuditLog, getAuditLogForEvidence } from '../../database/auditRepository';

// ─── Shared state ─────────────────────────────────────────────────────────────

let auditRows: Record<string, unknown>[] = [];
let uuidCounter = 0;

const mockRunAsync    = jest.fn();
const mockGetAllAsync = jest.fn();

function setupDbMocks(): void {
  mockRunAsync.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.trim().toUpperCase().includes('INSERT INTO AUDIT_LOG')) {
      const [id, action, resource_type, resource_id, metadata] = params;
      auditRows.push({
        id,
        user_id: 'local_user',
        action,
        resource_type,
        resource_id,
        metadata,
        ip_address: null,
        timestamp: new Date().toISOString(),
      });
    }
  });

  mockGetAllAsync.mockImplementation(async (sql: string, params: unknown[] = []) => {
    let rows = [...auditRows];
    const upper = sql.toUpperCase();

    // Apply WHERE conditions
    if (upper.includes('WHERE')) {
      // resource_type filter
      params.findIndex((_, i) =>
        upper.split('?')[i]?.includes('RESOURCE_TYPE')
      );
      // We reconstruct the filter by inspecting the SQL and params positionally
      const conditions = upper.split('WHERE')[1]?.split('ORDER')[0] ?? '';
      const hasResourceType = conditions.includes('RESOURCE_TYPE');
      const hasResourceId   = conditions.includes('RESOURCE_ID');

      let paramIdx = 0;
      if (hasResourceType) {
        const rt = params[paramIdx++] as string;
        rows = rows.filter(r => r.resource_type === rt);
      }
      if (hasResourceId) {
        const ri = params[paramIdx++] as string;
        rows = rows.filter(r => r.resource_id === ri);
      }

      // Last param is the LIMIT
      const limit = params[params.length - 1] as number;
      return rows.slice(0, limit);
    }

    // No WHERE — just limit (last param)
    const limit = params[params.length - 1] as number;
    return rows.slice(0, limit);
  });

  (getDatabase as jest.Mock).mockResolvedValue({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  auditRows = [];
  uuidCounter = 0;
  jest.clearAllMocks();
  (generateUUID as jest.Mock).mockImplementation(() => `audit-uuid-${++uuidCounter}`);
  setupDbMocks();
});

// ─── logAuditEvent ────────────────────────────────────────────────────────────

describe('logAuditEvent', () => {
  it('inserts a row with the correct action, resourceType, and resourceId', async () => {
    await logAuditEvent('created', 'evidence', 'ev-001');
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe('created');
    expect(auditRows[0].resource_type).toBe('evidence');
    expect(auditRows[0].resource_id).toBe('ev-001');
    expect(auditRows[0].user_id).toBe('local_user');
  });

  it('serialises metadata as JSON when provided', async () => {
    await logAuditEvent('transcribed', 'evidence', 'ev-002', { transcriptionLength: 420 });
    const metadata = JSON.parse(auditRows[0].metadata as string);
    expect(metadata).toEqual({ transcriptionLength: 420 });
  });

  it('stores null for metadata when not provided', async () => {
    await logAuditEvent('viewed', 'evidence', 'ev-003');
    expect(auditRows[0].metadata).toBeNull();
  });

  it('assigns a unique UUID to each event', async () => {
    await logAuditEvent('created', 'evidence', 'ev-004');
    await logAuditEvent('viewed',   'evidence', 'ev-004');
    expect(auditRows[0].id).toBe('audit-uuid-1');
    expect(auditRows[1].id).toBe('audit-uuid-2');
  });

  it('logs different resource types', async () => {
    await logAuditEvent('created', 'court_order', 'co-001');
    expect(auditRows[0].resource_type).toBe('court_order');
  });
});

// ─── getAuditLog ──────────────────────────────────────────────────────────────

describe('getAuditLog', () => {
  beforeEach(async () => {
    // Seed a variety of audit entries
    await logAuditEvent('created',     'evidence',    'ev-001');
    await logAuditEvent('viewed',      'evidence',    'ev-001');
    await logAuditEvent('created',     'evidence',    'ev-002');
    await logAuditEvent('created',     'court_order', 'co-001');
    await logAuditEvent('transcribed', 'evidence',    'ev-001', { transcriptionLength: 200 });
  });

  it('returns all entries up to the default limit of 100 when no filters applied', async () => {
    const entries = await getAuditLog();
    expect(entries).toHaveLength(5);
  });

  it('filters by resourceType', async () => {
    const entries = await getAuditLog('court_order');
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('created');
    expect(entries[0].resourceType).toBe('court_order');
  });

  it('filters by resourceId', async () => {
    const entries = await getAuditLog(undefined, 'ev-002');
    expect(entries).toHaveLength(1);
    expect(entries[0].resourceId).toBe('ev-002');
  });

  it('filters by both resourceType and resourceId', async () => {
    const entries = await getAuditLog('evidence', 'ev-001');
    // created, viewed, transcribed — all for ev-001/evidence
    expect(entries).toHaveLength(3);
    expect(entries.every(e => e.resourceId === 'ev-001')).toBe(true);
    expect(entries.every(e => e.resourceType === 'evidence')).toBe(true);
  });

  it('respects the limit parameter', async () => {
    const entries = await getAuditLog(undefined, undefined, 2);
    expect(entries).toHaveLength(2);
  });

  it('maps snake_case columns to camelCase properties', async () => {
    const entries = await getAuditLog('evidence', 'ev-001');
    const entry = entries[0];
    expect(entry.id).toBeDefined();
    expect(entry.userId).toBe('local_user');
    expect(entry.action).toBe('created');
    expect(entry.resourceType).toBe('evidence');
    expect(entry.resourceId).toBe('ev-001');
    expect(entry.timestamp).toBeDefined();
  });

  it('returns empty array when no entries match the filter', async () => {
    const entries = await getAuditLog('evidence', 'nonexistent-id');
    expect(entries).toHaveLength(0);
  });
});

// ─── getAuditLogForEvidence ───────────────────────────────────────────────────

describe('getAuditLogForEvidence', () => {
  it('returns only entries for the specified evidence item', async () => {
    await logAuditEvent('created',     'evidence',    'ev-A');
    await logAuditEvent('viewed',      'evidence',    'ev-A');
    await logAuditEvent('created',     'evidence',    'ev-B');
    await logAuditEvent('created',     'court_order', 'co-X');

    const entries = await getAuditLogForEvidence('ev-A');
    expect(entries).toHaveLength(2);
    expect(entries.every(e => e.resourceId === 'ev-A')).toBe(true);
    expect(entries.every(e => e.resourceType === 'evidence')).toBe(true);
  });

  it('returns empty array when evidence has no audit events', async () => {
    const entries = await getAuditLogForEvidence('ev-unknown');
    expect(entries).toHaveLength(0);
  });
});
