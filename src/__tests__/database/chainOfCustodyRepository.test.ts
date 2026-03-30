/**
 * Chain-of-Custody Repository Tests
 *
 * Verifies that every COC event type is written and retrieved correctly,
 * that the hash_at_event field is stored verbatim, and that the per-evidence
 * and multi-evidence query helpers return the right rows in time order.
 */

const mockDb = {
  runAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([]),
};

jest.mock('../../../src/database/db', () => ({
  getDatabase: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('../../../src/utils/uuid', () => ({
  generateUUID: jest.fn().mockReturnValue('test-uuid-coc'),
}));

const {
  logCoCEvent,
  getChainOfCustody,
  getChainOfCustodyForEvidenceList,
} = require('../../../src/database/chainOfCustodyRepository');

const EVIDENCE_ID = 'evidence-abc-123';
const HASH = 'a'.repeat(64);

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.getAllAsync.mockResolvedValue([]);
});

// ---- logCoCEvent ----

describe('logCoCEvent', () => {
  it('inserts a row with the correct evidence_id and event_type', async () => {
    await logCoCEvent(EVIDENCE_ID, 'CAPTURE', HASH);

    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const [sql, ...params] = mockDb.runAsync.mock.calls[0];
    expect(sql).toContain('INSERT INTO chain_of_custody_events');
    expect(params).toContain(EVIDENCE_ID);
    expect(params).toContain('CAPTURE');
  });

  it('stores the supplied hash verbatim in hash_at_event', async () => {
    const customHash = 'b'.repeat(64);
    await logCoCEvent(EVIDENCE_ID, 'VERIFY', customHash);

    const [, ...params] = mockDb.runAsync.mock.calls[0];
    expect(params).toContain(customHash);
  });

  it('defaults actor_type to USER and actor_id to local_user', async () => {
    await logCoCEvent(EVIDENCE_ID, 'VIEW', HASH);

    const [, ...params] = mockDb.runAsync.mock.calls[0];
    expect(params).toContain('USER');
    expect(params).toContain('local_user');
  });

  it('accepts explicit actor_type SYSTEM', async () => {
    await logCoCEvent(EVIDENCE_ID, 'BACKUP', HASH, undefined, 'SYSTEM');

    const [, ...params] = mockDb.runAsync.mock.calls[0];
    expect(params).toContain('SYSTEM');
  });

  it('serialises details as JSON when provided', async () => {
    const details = { destination: 'firebase', reportId: 'r1' };
    await logCoCEvent(EVIDENCE_ID, 'REPORT_INCLUDE', HASH, details);

    const [, ...params] = mockDb.runAsync.mock.calls[0];
    expect(params).toContain(JSON.stringify(details));
  });

  it('stores null for details when none are provided', async () => {
    await logCoCEvent(EVIDENCE_ID, 'EXPORT', HASH);

    const [, ...params] = mockDb.runAsync.mock.calls[0];
    expect(params).toContain(null);
  });

  it('handles all valid event types without throwing', async () => {
    const eventTypes = ['CAPTURE', 'VIEW', 'EXPORT', 'VERIFY', 'BACKUP', 'REPORT_INCLUDE', 'SHARE'] as const;
    for (const et of eventTypes) {
      await expect(logCoCEvent(EVIDENCE_ID, et, HASH)).resolves.toBeUndefined();
    }
    expect(mockDb.runAsync).toHaveBeenCalledTimes(eventTypes.length);
  });
});

// ---- getChainOfCustody ----

describe('getChainOfCustody', () => {
  const makeRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'coc-1',
    evidence_id: EVIDENCE_ID,
    event_type: 'VIEW',
    timestamp: '2025-01-01T00:00:00.000Z',
    actor_type: 'USER',
    actor_id: 'local_user',
    hash_at_event: HASH,
    details: null,
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('queries by evidence_id with ASC ordering', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    await getChainOfCustody(EVIDENCE_ID);

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('evidence_id = ?'),
      EVIDENCE_ID
    );
    expect(mockDb.getAllAsync.mock.calls[0][0]).toContain('ORDER BY timestamp ASC');
  });

  it('maps snake_case DB columns to camelCase fields', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRow()]);
    const events = await getChainOfCustody(EVIDENCE_ID);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'coc-1',
      evidenceId: EVIDENCE_ID,
      eventType: 'VIEW',
      actorType: 'USER',
      actorId: 'local_user',
      hashAtEvent: HASH,
      details: null,
    });
  });

  it('parses JSON details field when present', async () => {
    const detailsObj = { method: 'share', destination: 'email' };
    mockDb.getAllAsync.mockResolvedValue([
      makeRow({ details: JSON.stringify(detailsObj) }),
    ]);
    const events = await getChainOfCustody(EVIDENCE_ID);

    expect(events[0].details).toEqual(detailsObj);
  });

  it('returns empty array when no events exist', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const events = await getChainOfCustody(EVIDENCE_ID);

    expect(events).toEqual([]);
  });

  it('returns multiple events in insertion order', async () => {
    const rows = [
      makeRow({ id: 'coc-1', event_type: 'CAPTURE', timestamp: '2025-01-01T10:00:00Z' }),
      makeRow({ id: 'coc-2', event_type: 'VIEW',    timestamp: '2025-01-01T11:00:00Z' }),
      makeRow({ id: 'coc-3', event_type: 'EXPORT',  timestamp: '2025-01-01T12:00:00Z' }),
    ];
    mockDb.getAllAsync.mockResolvedValue(rows);
    const events = await getChainOfCustody(EVIDENCE_ID);

    expect(events.map((e: { eventType: string }) => e.eventType)).toEqual([
      'CAPTURE',
      'VIEW',
      'EXPORT',
    ]);
  });
});

// ---- getChainOfCustodyForEvidenceList ----

describe('getChainOfCustodyForEvidenceList', () => {
  it('returns empty array immediately when given no IDs', async () => {
    const events = await getChainOfCustodyForEvidenceList([]);

    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('builds IN clause with correct number of placeholders', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const ids = ['id-1', 'id-2', 'id-3'];
    await getChainOfCustodyForEvidenceList(ids);

    const [sql, ...params] = mockDb.getAllAsync.mock.calls[0];
    expect(sql).toContain('IN (?,?,?)');
    expect(params).toEqual(ids);
  });

  it('passes all evidence IDs as positional params', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const ids = ['ev-a', 'ev-b'];
    await getChainOfCustodyForEvidenceList(ids);

    const [, ...params] = mockDb.getAllAsync.mock.calls[0];
    expect(params).toContain('ev-a');
    expect(params).toContain('ev-b');
  });

  it('maps rows from multiple evidence items correctly', async () => {
    const rows = [
      { id: 'c1', evidence_id: 'ev-a', event_type: 'CAPTURE', timestamp: '2025-01-01T09:00:00Z',
        actor_type: 'SYSTEM', actor_id: 'local_user', hash_at_event: HASH, details: null, created_at: '2025-01-01' },
      { id: 'c2', evidence_id: 'ev-b', event_type: 'VIEW',    timestamp: '2025-01-01T10:00:00Z',
        actor_type: 'USER',   actor_id: 'local_user', hash_at_event: HASH, details: null, created_at: '2025-01-01' },
    ];
    mockDb.getAllAsync.mockResolvedValue(rows);

    const events = await getChainOfCustodyForEvidenceList(['ev-a', 'ev-b']);
    expect(events).toHaveLength(2);
    expect(events[0].evidenceId).toBe('ev-a');
    expect(events[1].evidenceId).toBe('ev-b');
  });
});
