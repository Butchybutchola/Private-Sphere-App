/**
 * Tests for evidenceRepository.ts
 *
 * Mock strategy:
 *  - jest.mock factories use inline jest.fn() only (no external variable refs — factories
 *    are hoisted before const declarations so external refs would be undefined)
 *  - Implementations are set up in beforeEach via the imported mock references
 *  - DB state is tracked in a module-level `dbRows` array, manipulated through closures
 */

// ─── Mock registrations (factories must NOT reference external lets/consts) ──

jest.mock('../../services/encryptionService', () => ({
  encryptString: jest.fn(),
  decryptString: jest.fn(),
  rotateEncryptionKey: jest.fn(),
}));

jest.mock('../../database/db', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../utils/uuid', () => ({
  generateUUID: jest.fn(() => 'test-uuid-1234'),
}));

// ─── Imports (resolved after jest.mock registrations) ────────────────────────

import { encryptString, decryptString, rotateEncryptionKey } from '../../services/encryptionService';
import { getDatabase } from '../../database/db';
import {
  insertEvidence,
  getAllEvidence,
  getEvidenceById,
  searchEvidence,
  updateTranscription,
  rotateEvidenceEncryption,
} from '../../database/evidenceRepository';
import { EvidenceItem } from '../../types';

// ─── Shared DB state ──────────────────────────────────────────────────────────

let dbRows: Record<string, unknown>[] = [];

const mockRunAsync    = jest.fn();
const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

/** Wire up the DB mock implementations against the current dbRows reference. */
function setupDbMocks(): void {
  mockRunAsync.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const upper = sql.trim().toUpperCase();

    if (upper.startsWith('INSERT INTO EVIDENCE')) {
      const [
        id, type, status, file_path, thumbnail_path, sha256_hash, file_size, mime_type,
        captured_at, device_id, latitude, longitude, altitude, location_accuracy,
        title, description, tags, court_order_id, breach_clause,
        transcription, transcription_status,
        parent_id, is_original, version_number,
        created_at, updated_at,
      ] = params;
      dbRows.push({
        id, type, status, file_path, thumbnail_path, sha256_hash, file_size, mime_type,
        captured_at, device_id, latitude, longitude, altitude, location_accuracy,
        title, description, tags, court_order_id, breach_clause,
        transcription, transcription_status,
        parent_id, is_original, version_number,
        created_at, updated_at,
      });
      return;
    }

    if (upper.startsWith('UPDATE EVIDENCE SET')) {
      const id = params[params.length - 1] as string;
      const row = dbRows.find(r => r.id === id);
      if (!row) return;

      // rotateEvidenceEncryption bulk update (5 encrypted fields + id)
      if (
        sql.includes('title = ?') &&
        sql.includes('description = ?') &&
        sql.includes('tags = ?') &&
        sql.includes('transcription = ?') &&
        sql.includes('breach_clause = ?')
      ) {
        const [title, description, tags, transcription, breach_clause] = params as (string | null)[];
        Object.assign(row, { title, description, tags, transcription, breach_clause });
        return;
      }

      // updateTranscription
      if (sql.includes('transcription = ?') && sql.includes('transcription_status = ?')) {
        const [transcription, transcription_status] = params as (string | null)[];
        Object.assign(row, { transcription, transcription_status });
        return;
      }

      // updateEvidenceMetadata — generic SET clause parsing
      const setMatch = sql.match(/SET (.+?) WHERE/i);
      if (setMatch) {
        const assignments = setMatch[1].split(',').map(s => s.trim());
        let paramIdx = 0;
        for (const assign of assignments) {
          if (!assign.includes('= ?')) continue;
          const col = assign.replace(/= \?.*/, '').trim();
          (row as Record<string, unknown>)[col] = params[paramIdx++];
        }
      }
    }
  });

  mockGetAllAsync.mockImplementation(async (sql: string) => {
    if (sql.trim().toUpperCase().startsWith(
      'SELECT ID, TITLE, DESCRIPTION, TAGS, TRANSCRIPTION, BREACH_CLAUSE'
    )) {
      return dbRows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        tags: r.tags,
        transcription: r.transcription,
        breach_clause: r.breach_clause,
      }));
    }
    return [...dbRows];
  });

  mockGetFirstAsync.mockImplementation(async (_sql: string, params: unknown[] = []) => {
    return dbRows.find(r => r.id === params[0]) ?? null;
  });

  (getDatabase as jest.Mock).mockResolvedValue({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type EvidenceInput = Omit<EvidenceItem, 'id' | 'createdAt' | 'updatedAt'>;

function baseEvidence(overrides: Partial<EvidenceInput> = {}): EvidenceInput {
  return {
    type: 'photo',
    status: 'locked',
    filePath: '/storage/evidence.jpg',
    sha256Hash: 'abc123hash',
    fileSize: 102400,
    mimeType: 'image/jpeg',
    capturedAt: '2024-01-15T10:30:00.000Z',
    deviceId: 'device-001',
    title: 'Incident photo',
    description: 'Photo taken during incident',
    tags: ['incident', 'bruising'],
    isOriginal: true,
    versionNumber: 1,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  dbRows = [];
  jest.clearAllMocks();

  // Encryption: deterministic EG2 mock
  (encryptString as jest.Mock).mockImplementation(async (v: string) => `EG2:mock:${btoa(v)}`);
  (decryptString as jest.Mock).mockImplementation(async (v: string) => {
    if (v.startsWith('EG2:mock:')) return atob(v.slice('EG2:mock:'.length));
    throw new Error('Invalid encrypted format');
  });

  setupDbMocks();
});

// ─── insertEvidence ───────────────────────────────────────────────────────────

describe('insertEvidence', () => {
  it('returns the generated UUID', async () => {
    const id = await insertEvidence(baseEvidence());
    expect(id).toBe('test-uuid-1234');
  });

  it('stores EG2-encrypted ciphertext for title, not plaintext', async () => {
    await insertEvidence(baseEvidence({ title: 'Incident photo' }));
    const stored = dbRows[0].title as string;
    expect(stored).toBe('EG2:mock:' + btoa('Incident photo'));
    expect(stored).not.toBe('Incident photo');
  });

  it('stores EG2-encrypted ciphertext for description', async () => {
    await insertEvidence(baseEvidence({ description: 'Photo taken during incident' }));
    expect(dbRows[0].description).toBe('EG2:mock:' + btoa('Photo taken during incident'));
  });

  it('stores EG2-encrypted ciphertext for tags (JSON-serialised)', async () => {
    await insertEvidence(baseEvidence({ tags: ['incident', 'bruising'] }));
    expect(dbRows[0].tags).toBe('EG2:mock:' + btoa(JSON.stringify(['incident', 'bruising'])));
  });

  it('stores EG2-encrypted ciphertext for breachClause', async () => {
    await insertEvidence(baseEvidence({ breachClause: 'Clause 4.2' }));
    expect(dbRows[0].breach_clause).toBe('EG2:mock:' + btoa('Clause 4.2'));
  });

  it('stores EG2-encrypted ciphertext for transcription', async () => {
    await insertEvidence(baseEvidence({ transcription: 'He said threatening words.' }));
    expect(dbRows[0].transcription).toBe('EG2:mock:' + btoa('He said threatening words.'));
  });

  it('stores non-sensitive fields as plaintext (sha256Hash, capturedAt, filePath, mimeType)', async () => {
    await insertEvidence(baseEvidence());
    const row = dbRows[0];
    expect(row.sha256_hash).toBe('abc123hash');
    expect(row.captured_at).toBe('2024-01-15T10:30:00.000Z');
    expect(row.file_path).toBe('/storage/evidence.jpg');
    expect(row.mime_type).toBe('image/jpeg');
    expect(row.device_id).toBe('device-001');
  });

  it('stores null for optional fields when not provided', async () => {
    await insertEvidence(baseEvidence({ title: undefined, description: undefined, breachClause: undefined }));
    expect(dbRows[0].title).toBeNull();
    expect(dbRows[0].description).toBeNull();
    expect(dbRows[0].breach_clause).toBeNull();
  });

  it('encrypts title, description, tags, and transcription when all provided', async () => {
    await insertEvidence(baseEvidence({ transcription: 'spoken words' }));
    expect(encryptString).toHaveBeenCalledWith('Incident photo');
    expect(encryptString).toHaveBeenCalledWith('Photo taken during incident');
    expect(encryptString).toHaveBeenCalledWith(JSON.stringify(['incident', 'bruising']));
    expect(encryptString).toHaveBeenCalledWith('spoken words');
  });
});

// ─── getAllEvidence ───────────────────────────────────────────────────────────

describe('getAllEvidence', () => {
  it('decrypts title, description, tags, transcription, breachClause on read', async () => {
    dbRows.push({
      id: 'row-1',
      type: 'photo', status: 'locked',
      file_path: '/storage/p.jpg', thumbnail_path: null,
      sha256_hash: 'deadbeef', file_size: 1024, mime_type: 'image/jpeg',
      captured_at: '2024-01-15T10:30:00.000Z', device_id: 'dev-1',
      latitude: null, longitude: null, altitude: null, location_accuracy: null,
      title:        'EG2:mock:' + btoa('Secret title'),
      description:  'EG2:mock:' + btoa('Secret description'),
      tags:         'EG2:mock:' + btoa(JSON.stringify(['tag1'])),
      court_order_id: null,
      breach_clause: 'EG2:mock:' + btoa('Clause 3'),
      transcription: 'EG2:mock:' + btoa('Spoken words'),
      transcription_status: 'completed',
      parent_id: null, is_original: 1, version_number: 1,
      created_at: '2024-01-15T10:30:00.000Z', updated_at: '2024-01-15T10:30:00.000Z',
    });

    const items = await getAllEvidence();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Secret title');
    expect(items[0].description).toBe('Secret description');
    expect(items[0].tags).toEqual(['tag1']);
    expect(items[0].breachClause).toBe('Clause 3');
    expect(items[0].transcription).toBe('Spoken words');
  });

  it('passes non-sensitive fields through unchanged', async () => {
    dbRows.push({
      id: 'row-2',
      type: 'video', status: 'pending',
      file_path: '/storage/v.mp4', thumbnail_path: '/storage/thumb.jpg',
      sha256_hash: 'cafebabe', file_size: 204800, mime_type: 'video/mp4',
      captured_at: '2024-02-01T08:00:00.000Z', device_id: 'dev-2',
      latitude: -33.8688, longitude: 151.2093, altitude: 10, location_accuracy: 5,
      title: null, description: null, tags: null,
      court_order_id: 'court-order-abc',
      breach_clause: null, transcription: null, transcription_status: null,
      parent_id: null, is_original: 1, version_number: 1,
      created_at: '2024-02-01T08:00:00.000Z', updated_at: '2024-02-01T08:00:00.000Z',
    });

    const items = await getAllEvidence();
    const item = items[0];
    expect(item.sha256Hash).toBe('cafebabe');
    expect(item.capturedAt).toBe('2024-02-01T08:00:00.000Z');
    expect(item.filePath).toBe('/storage/v.mp4');
    expect(item.courtOrderId).toBe('court-order-abc');
    expect(item.latitude).toBe(-33.8688);
  });
});

// ─── getEvidenceById ──────────────────────────────────────────────────────────

describe('getEvidenceById', () => {
  it('returns null when no row matches', async () => {
    const result = await getEvidenceById('nonexistent');
    expect(result).toBeNull();
  });

  it('decrypts fields for a matched row', async () => {
    dbRows.push({
      id: 'row-3',
      type: 'audio', status: 'locked',
      file_path: '/storage/a.m4a', thumbnail_path: null,
      sha256_hash: 'hash3', file_size: 512, mime_type: 'audio/m4a',
      captured_at: '2024-03-01T12:00:00.000Z', device_id: 'dev-3',
      latitude: null, longitude: null, altitude: null, location_accuracy: null,
      title:        'EG2:mock:' + btoa('Audio note'),
      description:  null,
      tags:         'EG2:mock:' + btoa('[]'),
      court_order_id: null, breach_clause: null,
      transcription: 'EG2:mock:' + btoa('I felt unsafe'),
      transcription_status: 'completed',
      parent_id: null, is_original: 1, version_number: 1,
      created_at: '2024-03-01T12:00:00.000Z', updated_at: '2024-03-01T12:00:00.000Z',
    });

    const item = await getEvidenceById('row-3');
    expect(item).not.toBeNull();
    expect(item!.title).toBe('Audio note');
    expect(item!.transcription).toBe('I felt unsafe');
    expect(item!.tags).toEqual([]);
  });
});

// ─── tryDecrypt graceful fallback ─────────────────────────────────────────────

describe('tryDecrypt graceful fallback (legacy plaintext records)', () => {
  it('returns plaintext as-is when decryption fails (pre-encryption record)', async () => {
    // decryptString mock throws for anything that doesn't start with 'EG2:mock:'
    // Seeding a raw plaintext row simulates a legacy pre-encryption record
    dbRows.push({
      id: 'legacy-row',
      type: 'document', status: 'archived',
      file_path: '/storage/doc.pdf', thumbnail_path: null,
      sha256_hash: 'hash-legacy', file_size: 256, mime_type: 'application/pdf',
      captured_at: '2023-01-01T00:00:00.000Z', device_id: 'dev-old',
      latitude: null, longitude: null, altitude: null, location_accuracy: null,
      title:       'Unencrypted old title',   // raw plaintext — decryptString will throw
      description: 'Unencrypted old desc',
      tags:        '["legacy-tag"]',          // raw JSON string
      court_order_id: null, breach_clause: null, transcription: null, transcription_status: null,
      parent_id: null, is_original: 1, version_number: 1,
      created_at: '2023-01-01T00:00:00.000Z', updated_at: '2023-01-01T00:00:00.000Z',
    });

    const items = await getAllEvidence();
    expect(items).toHaveLength(1);
    // tryDecrypt returns the raw value rather than throwing
    expect(items[0].title).toBe('Unencrypted old title');
    expect(items[0].description).toBe('Unencrypted old desc');
    // raw JSON parses correctly through the JSON.parse step in rowToEvidence
    expect(items[0].tags).toEqual(['legacy-tag']);
  });
});

// ─── searchEvidence ───────────────────────────────────────────────────────────

describe('searchEvidence', () => {
  beforeEach(async () => {
    await insertEvidence(baseEvidence({ title: 'Bruise on arm', tags: ['bruise'] }));
    // generateUUID always returns 'test-uuid-1234', so assign unique ids manually for the second row
    (require('../../utils/uuid').generateUUID as jest.Mock).mockReturnValueOnce('test-uuid-5678');
    await insertEvidence(baseEvidence({
      title: 'Threatening message',
      description: 'He sent a threatening text',
      tags: ['message'],
    }));
  });

  it('finds records matching the title query', async () => {
    const results = await searchEvidence('bruise');
    expect(results.some(r => r.title === 'Bruise on arm')).toBe(true);
  });

  it('finds records matching a tag', async () => {
    const results = await searchEvidence('message');
    expect(results.some(r => r.title === 'Threatening message')).toBe(true);
  });

  it('finds records matching the description', async () => {
    const results = await searchEvidence('threatening text');
    expect(results.some(r => r.description === 'He sent a threatening text')).toBe(true);
  });

  it('is case-insensitive', async () => {
    const results = await searchEvidence('BRUISE');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.title === 'Bruise on arm')).toBe(true);
  });

  it('returns empty array when no records match', async () => {
    const results = await searchEvidence('zzznomatch');
    expect(results).toHaveLength(0);
  });

  it('does NOT match non-encrypted fields like sha256Hash or filePath', async () => {
    const results = await searchEvidence('abc123hash');
    expect(results).toHaveLength(0);
  });
});

// ─── updateTranscription ─────────────────────────────────────────────────────

describe('updateTranscription', () => {
  it('stores encrypted transcription and status', async () => {
    await insertEvidence(baseEvidence());
    await updateTranscription('test-uuid-1234', 'Victim statement recorded.', 'completed');

    const row = dbRows.find(r => r.id === 'test-uuid-1234');
    expect(row?.transcription).toBe('EG2:mock:' + btoa('Victim statement recorded.'));
    expect(row?.transcription_status).toBe('completed');
  });
});

// ─── rotateEvidenceEncryption ─────────────────────────────────────────────────

describe('rotateEvidenceEncryption', () => {
  it('returns rotatedCount = 0 and newKeyId when table is empty', async () => {
    (rotateEncryptionKey as jest.Mock).mockResolvedValueOnce({ reEncrypted: {}, newKeyId: 'key-empty' });

    const { rotatedCount, newKeyId } = await rotateEvidenceEncryption();
    expect(rotatedCount).toBe(0);
    expect(newKeyId).toBe('key-empty');
  });

  it('returns rotatedCount = 0 when row has no encrypted fields (all null)', async () => {
    dbRows.push({
      id: 'null-row',
      type: 'document', status: 'pending',
      file_path: '/f.pdf', thumbnail_path: null,
      sha256_hash: 'h', file_size: 1, mime_type: 'application/pdf',
      captured_at: '2024-01-01T00:00:00.000Z', device_id: 'dev',
      latitude: null, longitude: null, altitude: null, location_accuracy: null,
      title: null, description: null, tags: null,
      court_order_id: null, breach_clause: null, transcription: null, transcription_status: null,
      parent_id: null, is_original: 1, version_number: 1,
      created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z',
    });

    (rotateEncryptionKey as jest.Mock).mockResolvedValueOnce({ reEncrypted: {}, newKeyId: 'key-002' });

    const { rotatedCount } = await rotateEvidenceEncryption();
    expect(rotatedCount).toBe(0);
  });

  it('returns the newKeyId provided by rotateEncryptionKey', async () => {
    await insertEvidence(baseEvidence({ title: 'Test' }));
    const storedTitle = dbRows[0].title as string;

    (rotateEncryptionKey as jest.Mock).mockResolvedValueOnce({
      reEncrypted: { 'test-uuid-1234:title': storedTitle + ':new' },
      newKeyId: 'new-key-xyz',
    });

    const { newKeyId } = await rotateEvidenceEncryption();
    expect(newKeyId).toBe('new-key-xyz');
  });

  it('returns rotatedCount = 1 when one row has fields that changed', async () => {
    await insertEvidence(baseEvidence({ title: 'Evidence A' }));
    const storedTitle = dbRows[0].title as string;

    (rotateEncryptionKey as jest.Mock).mockResolvedValueOnce({
      reEncrypted: { 'test-uuid-1234:title': storedTitle + ':rotated' },
      newKeyId: 'key-001',
    });

    const { rotatedCount } = await rotateEvidenceEncryption();
    expect(rotatedCount).toBe(1);
  });

  it('writes re-encrypted values back to the database', async () => {
    await insertEvidence(baseEvidence({ title: 'Original', description: 'Orig desc' }));
    const origTranscription = dbRows[0].transcription; // unchanged

    const newTitle = 'EG2:mock:NEW_CIPHER_FOR_TITLE';
    const newDesc  = 'EG2:mock:NEW_CIPHER_FOR_DESC';

    (rotateEncryptionKey as jest.Mock).mockResolvedValueOnce({
      reEncrypted: {
        'test-uuid-1234:title':       newTitle,
        'test-uuid-1234:description': newDesc,
      },
      newKeyId: 'key-003',
    });

    await rotateEvidenceEncryption();

    const updated = dbRows.find(r => r.id === 'test-uuid-1234')!;
    expect(updated.title).toBe(newTitle);
    expect(updated.description).toBe(newDesc);
    expect(updated.transcription).toBe(origTranscription); // unchanged field preserved
  });

  it('rotates multiple rows independently', async () => {
    dbRows.push(
      {
        id: 'row-A', type: 'photo', status: 'locked',
        file_path: '/a.jpg', thumbnail_path: null,
        sha256_hash: 'hashA', file_size: 100, mime_type: 'image/jpeg',
        captured_at: '2024-01-01T00:00:00.000Z', device_id: 'dev',
        latitude: null, longitude: null, altitude: null, location_accuracy: null,
        title: 'EG2:mock:' + btoa('Title A'), description: null, tags: null,
        court_order_id: null, breach_clause: null, transcription: null, transcription_status: null,
        parent_id: null, is_original: 1, version_number: 1,
        created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'row-B', type: 'audio', status: 'locked',
        file_path: '/b.m4a', thumbnail_path: null,
        sha256_hash: 'hashB', file_size: 200, mime_type: 'audio/m4a',
        captured_at: '2024-01-02T00:00:00.000Z', device_id: 'dev',
        latitude: null, longitude: null, altitude: null, location_accuracy: null,
        title: 'EG2:mock:' + btoa('Title B'), description: null, tags: null,
        court_order_id: null, breach_clause: null, transcription: null, transcription_status: null,
        parent_id: null, is_original: 1, version_number: 1,
        created_at: '2024-01-02T00:00:00.000Z', updated_at: '2024-01-02T00:00:00.000Z',
      }
    );

    (rotateEncryptionKey as jest.Mock).mockResolvedValueOnce({
      reEncrypted: {
        'row-A:title': 'EG2:mock:NEW_A',
        'row-B:title': 'EG2:mock:NEW_B',
      },
      newKeyId: 'key-multi',
    });

    const { rotatedCount, newKeyId } = await rotateEvidenceEncryption();
    expect(rotatedCount).toBe(2);
    expect(newKeyId).toBe('key-multi');
    expect(dbRows.find(r => r.id === 'row-A')!.title).toBe('EG2:mock:NEW_A');
    expect(dbRows.find(r => r.id === 'row-B')!.title).toBe('EG2:mock:NEW_B');
  });

  it('calls rotateEncryptionKey with the correct ciphertext map (keyed by id:field)', async () => {
    dbRows.push({
      id: 'map-row', type: 'photo', status: 'locked',
      file_path: '/c.jpg', thumbnail_path: null,
      sha256_hash: 'hashC', file_size: 50, mime_type: 'image/jpeg',
      captured_at: '2024-01-03T00:00:00.000Z', device_id: 'dev',
      latitude: null, longitude: null, altitude: null, location_accuracy: null,
      title:       'EG2:mock:title-cipher',
      description: 'EG2:mock:desc-cipher',
      tags: null, court_order_id: null, breach_clause: null, transcription: null,
      transcription_status: null, parent_id: null, is_original: 1, version_number: 1,
      created_at: '2024-01-03T00:00:00.000Z', updated_at: '2024-01-03T00:00:00.000Z',
    });

    (rotateEncryptionKey as jest.Mock).mockResolvedValueOnce({ reEncrypted: {}, newKeyId: 'k' });

    await rotateEvidenceEncryption();

    expect(rotateEncryptionKey).toHaveBeenCalledWith({
      'map-row:title':       'EG2:mock:title-cipher',
      'map-row:description': 'EG2:mock:desc-cipher',
    });
  });
});
