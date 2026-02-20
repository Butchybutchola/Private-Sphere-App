import { generateReport, shareReport } from '../../services/pdfEngine';
import { EvidenceItem } from '../../types';

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: '/tmp/generated.pdf' }),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/hashService', () => ({
  hashFile: jest.fn().mockResolvedValue('reporthashabcdef1234567890abcdef1234567890abcdef1234567890'),
  hashString: jest.fn().mockResolvedValue('stringhash123'),
}));

jest.mock('../../database/auditRepository', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { logAuditEvent } from '../../database/auditRepository';

describe('pdfEngine', () => {
  const mockEvidence: EvidenceItem[] = [
    {
      id: 'ev-1',
      type: 'photo',
      status: 'locked',
      filePath: '/evidence/photo.jpg',
      sha256Hash: 'abc123def456',
      fileSize: 2048,
      mimeType: 'image/jpeg',
      capturedAt: '2026-02-20T12:00:00Z',
      deviceId: 'device-1',
      tags: ['custody'],
      isOriginal: true,
      versionNumber: 1,
      createdAt: '2026-02-20T12:00:00Z',
      updatedAt: '2026-02-20T12:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    it('generates a PDF with evidence data', async () => {
      const result = await generateReport({
        title: 'Test Report',
        evidence: mockEvidence,
      });

      expect(Print.printToFileAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Test Report'),
          width: 612,
          height: 792,
        })
      );
      expect(result.filePath).toContain('reports/');
      expect(result.reportId).toBeDefined();
      expect(result.sha256Hash).toBeDefined();
    });

    it('logs audit event after generation', async () => {
      await generateReport({
        title: 'Audit Test',
        evidence: mockEvidence,
      });

      expect(logAuditEvent).toHaveBeenCalledWith(
        'report_generated',
        'report',
        expect.any(String),
        expect.objectContaining({
          title: 'Audit Test',
          evidenceCount: 1,
        })
      );
    });
  });

  describe('shareReport', () => {
    it('shares file when sharing is available', async () => {
      await shareReport('/reports/test.pdf');

      expect(Sharing.shareAsync).toHaveBeenCalledWith('/reports/test.pdf', {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Evidence Report',
      });
    });
  });
});
