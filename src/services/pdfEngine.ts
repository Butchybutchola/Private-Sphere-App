/**
 * PDF Briefing Engine
 *
 * Generates professional, court-ready evidence reports in PDF format.
 * Includes:
 * - Chronological Table of Contents
 * - Metadata Verification Sheets (time/location proof)
 * - Transcription logs
 * - Chain of custody audit trail
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { EvidenceItem, CourtOrder, BreachLog, AuditLogEntry } from '../types';
import { logAuditEvent } from '../database/auditRepository';
import { generateUUID } from '../utils/uuid';
import { format } from 'date-fns';
import { hashFile } from './hashService';

const REPORTS_DIR = `${FileSystem.documentDirectory}reports/`;

async function ensureReportsDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(REPORTS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(REPORTS_DIR, { intermediates: true });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(isoString: string): string {
  try {
    return format(new Date(isoString), 'yyyy-MM-dd HH:mm:ss \'UTC\'');
  } catch {
    return isoString;
  }
}

function generateTableOfContents(evidence: EvidenceItem[]): string {
  const rows = evidence.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.title || `${item.type} Evidence`)}</td>
      <td>${item.type.toUpperCase()}</td>
      <td>${formatDate(item.capturedAt)}</td>
      <td><code>${item.sha256Hash.substring(0, 16)}...</code></td>
    </tr>
  `).join('');

  return `
    <h2>Table of Contents</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Title</th>
          <th>Type</th>
          <th>Captured (UTC)</th>
          <th>Hash (SHA-256)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function generateMetadataSheet(item: EvidenceItem, index: number): string {
  return `
    <div class="metadata-sheet">
      <h3>Evidence Item #${index + 1}: ${escapeHtml(item.title || `${item.type} Evidence`)}</h3>
      <table class="metadata-table">
        <tr><td class="label">Evidence ID</td><td><code>${item.id}</code></td></tr>
        <tr><td class="label">Type</td><td>${item.type.toUpperCase()}</td></tr>
        <tr><td class="label">Status</td><td>${item.status.toUpperCase()}</td></tr>
        <tr><td class="label">SHA-256 Hash</td><td><code style="word-break:break-all">${item.sha256Hash}</code></td></tr>
        <tr><td class="label">File Size</td><td>${(item.fileSize / 1024).toFixed(2)} KB</td></tr>
        <tr><td class="label">MIME Type</td><td>${item.mimeType}</td></tr>
        <tr><td class="label">Captured At (UTC)</td><td><strong>${formatDate(item.capturedAt)}</strong></td></tr>
        <tr><td class="label">Device ID</td><td><code>${item.deviceId}</code></td></tr>
        <tr><td class="label">GPS Latitude</td><td>${item.latitude?.toFixed(6) ?? 'N/A'}</td></tr>
        <tr><td class="label">GPS Longitude</td><td>${item.longitude?.toFixed(6) ?? 'N/A'}</td></tr>
        <tr><td class="label">GPS Altitude</td><td>${item.altitude?.toFixed(2) ?? 'N/A'} m</td></tr>
        <tr><td class="label">Location Accuracy</td><td>${item.locationAccuracy?.toFixed(2) ?? 'N/A'} m</td></tr>
        <tr><td class="label">Is Original</td><td>${item.isOriginal ? 'YES - MASTER FILE' : `No (Version ${item.versionNumber})`}</td></tr>
        <tr><td class="label">Original Version</td><td>${item.parentId || 'This is the original'}</td></tr>
      </table>

      ${item.description ? `
        <h4>Description</h4>
        <p>${escapeHtml(item.description)}</p>
      ` : ''}

      ${item.transcription ? `
        <h4>Transcription</h4>
        <div class="transcription">${escapeHtml(item.transcription)}</div>
      ` : ''}

      ${item.tags.length > 0 ? `
        <h4>Tags</h4>
        <p>${item.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</p>
      ` : ''}
    </div>
  `;
}

function generateBreachSection(breaches: BreachLog[], courtOrder?: CourtOrder): string {
  if (breaches.length === 0) return '';

  const rows = breaches.map(b => `
    <tr>
      <td>${formatDate(b.occurredAt)}</td>
      <td>${escapeHtml(b.description)}</td>
      <td><code>${b.evidenceId.substring(0, 8)}...</code></td>
    </tr>
  `).join('');

  return `
    <div class="breach-section">
      <h2>Breach Log${courtOrder ? `: ${escapeHtml(courtOrder.title)}` : ''}</h2>
      <table>
        <thead>
          <tr>
            <th>Date/Time (UTC)</th>
            <th>Description</th>
            <th>Evidence Ref</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function generateAuditSection(auditEntries: AuditLogEntry[]): string {
  if (auditEntries.length === 0) return '';

  const rows = auditEntries.map(entry => `
    <tr>
      <td>${formatDate(entry.timestamp)}</td>
      <td>${entry.action}</td>
      <td>${entry.resourceType}</td>
      <td><code>${entry.resourceId.substring(0, 8)}...</code></td>
    </tr>
  `).join('');

  return `
    <div class="audit-section">
      <h2>Chain of Custody / Audit Trail</h2>
      <table>
        <thead>
          <tr>
            <th>Timestamp (UTC)</th>
            <th>Action</th>
            <th>Resource Type</th>
            <th>Resource ID</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function generateFullHTML(
  title: string,
  evidence: EvidenceItem[],
  breaches: BreachLog[],
  auditEntries: AuditLogEntry[],
  courtOrder?: CourtOrder,
  reportHash?: string
): string {
  const generatedAt = new Date().toISOString();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      line-height: 1.5;
      padding: 40px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #1a1a1a;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 22pt; margin-bottom: 5px; }
    .header .subtitle { font-size: 12pt; color: #666; }
    .header .confidential {
      color: #c00;
      font-weight: bold;
      font-size: 10pt;
      margin-top: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    h2 {
      font-size: 16pt;
      margin: 30px 0 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ccc;
    }
    h3 { font-size: 13pt; margin: 20px 0 10px; }
    h4 { font-size: 11pt; margin: 15px 0 8px; color: #333; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 20px;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f5f5f5; font-weight: bold; }
    tr:nth-child(even) { background: #fafafa; }
    .metadata-sheet {
      page-break-inside: avoid;
      border: 1px solid #ccc;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .metadata-table .label {
      width: 180px;
      font-weight: bold;
      background: #f9f9f9;
    }
    .transcription {
      background: #f8f8f0;
      border: 1px solid #ddd;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      white-space: pre-wrap;
    }
    .tag {
      display: inline-block;
      background: #e8f0fe;
      color: #1a73e8;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 9pt;
      margin: 2px;
    }
    code {
      font-family: 'Courier New', monospace;
      font-size: 9pt;
      background: #f5f5f5;
      padding: 1px 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #1a1a1a;
      font-size: 9pt;
      color: #666;
    }
    .integrity-notice {
      background: #f0f7ff;
      border: 1px solid #b0d4ff;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 10pt;
    }
    @media print {
      body { padding: 20px; }
      .metadata-sheet { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>EVIDENCE GUARDIAN</h1>
    <div class="subtitle">${escapeHtml(title)}</div>
    <div class="confidential">Confidential - Legally Privileged</div>
    <p style="margin-top:10px;font-size:10pt;">
      Generated: ${formatDate(generatedAt)} | Evidence Items: ${evidence.length}
    </p>
  </div>

  <div class="integrity-notice">
    <strong>Digital Integrity Notice:</strong> All evidence items in this report have been
    cryptographically hashed (SHA-256) at the point of capture. Timestamps were obtained from
    external NTP servers (not the device clock). GPS coordinates were captured at the time of
    evidence creation. Any modification to the original files can be detected by comparing
    the recorded hash values.
    ${reportHash ? `<br><br><strong>Report Hash (SHA-256):</strong> <code>${reportHash}</code>` : ''}
  </div>

  ${generateTableOfContents(evidence)}

  <h2>Evidence Details</h2>
  ${evidence.map((item, i) => generateMetadataSheet(item, i)).join('')}

  ${generateBreachSection(breaches, courtOrder)}

  ${generateAuditSection(auditEntries)}

  <div class="footer">
    <p><strong>Evidence Guardian</strong> - Forensic Evidence Management Platform</p>
    <p>This report was generated automatically. All timestamps are in UTC.
       Hash values are SHA-256. GPS coordinates are WGS84.</p>
    <p>Report ID: ${generateUUID()}</p>
  </div>
</body>
</html>`;
}

export interface ReportOptions {
  title: string;
  evidence: EvidenceItem[];
  breaches?: BreachLog[];
  auditEntries?: AuditLogEntry[];
  courtOrder?: CourtOrder;
}

export async function generateReport(options: ReportOptions): Promise<{
  filePath: string;
  reportId: string;
  sha256Hash: string;
}> {
  await ensureReportsDir();

  const html = generateFullHTML(
    options.title,
    options.evidence,
    options.breaches || [],
    options.auditEntries || [],
    options.courtOrder
  );

  // Generate PDF
  const { uri } = await Print.printToFileAsync({
    html,
    width: 612, // US Letter width in points
    height: 792, // US Letter height in points
  });

  // Move to reports directory
  const reportId = generateUUID();
  const fileName = `report_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}_${reportId.substring(0, 8)}.pdf`;
  const destPath = `${REPORTS_DIR}${fileName}`;

  await FileSystem.moveAsync({ from: uri, to: destPath });

  // Hash the report
  const sha256Hash = await hashFile(destPath);

  // Log audit event
  await logAuditEvent('report_generated', 'report', reportId, {
    title: options.title,
    evidenceCount: options.evidence.length,
    sha256Hash,
  });

  return { filePath: destPath, reportId, sha256Hash };
}

export async function shareReport(filePath: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Evidence Report',
    });
  }
}
