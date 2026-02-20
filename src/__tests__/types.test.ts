import {
  EvidenceItem,
  CourtOrder,
  CourtOrderClause,
  BreachLog,
  AuditLogEntry,
  ForensicMetadata,
  BriefingReport,
  AppSettings,
} from '../types';

describe('Type definitions', () => {
  it('EvidenceItem has correct shape', () => {
    const item: EvidenceItem = {
      id: 'ev-1',
      type: 'photo',
      status: 'locked',
      filePath: '/evidence/photo.jpg',
      sha256Hash: 'abc123',
      fileSize: 1024,
      mimeType: 'image/jpeg',
      capturedAt: '2026-02-20T12:00:00Z',
      deviceId: 'device-1',
      tags: ['custody', 'photo'],
      isOriginal: true,
      versionNumber: 1,
      createdAt: '2026-02-20T12:00:00Z',
      updatedAt: '2026-02-20T12:00:00Z',
    };

    expect(item.type).toBe('photo');
    expect(item.status).toBe('locked');
    expect(item.isOriginal).toBe(true);
    expect(item.tags).toHaveLength(2);
  });

  it('CourtOrder has correct shape', () => {
    const order: CourtOrder = {
      id: 'co-1',
      title: 'Custody Order 2026',
      filePath: '/orders/order.pdf',
      sha256Hash: 'def456',
      clauses: [],
      uploadedAt: '2026-02-20T12:00:00Z',
      createdAt: '2026-02-20T12:00:00Z',
    };

    expect(order.clauses).toEqual([]);
    expect(order.title).toBe('Custody Order 2026');
  });

  it('AuditLogEntry has correct shape', () => {
    const entry: AuditLogEntry = {
      id: 'al-1',
      userId: 'user-1',
      action: 'created',
      resourceType: 'evidence',
      resourceId: 'ev-1',
      timestamp: '2026-02-20T12:00:00Z',
    };

    expect(entry.action).toBe('created');
    expect(entry.resourceType).toBe('evidence');
  });

  it('ForensicMetadata has correct shape', () => {
    const meta: ForensicMetadata = {
      sha256Hash: 'abc123',
      capturedAt: '2026-02-20T12:00:00Z',
      ntpServerUsed: 'worldtimeapi.org',
      deviceId: 'device-1',
      appVersion: '1.0.0-mvp',
      captureMethod: 'in-app',
    };

    expect(meta.captureMethod).toBe('in-app');
  });
});
